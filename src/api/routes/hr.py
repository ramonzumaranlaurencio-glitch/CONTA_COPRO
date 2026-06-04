from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
import httpx
from sqlalchemy import select

from src.api.dependencies import require_roles
from src.api.routes.ledger import build_hash_service, build_uow_factory
from src.infrastructure.adapters.ai.vision_provider import get_vision_client, is_vision_available
from src.application.services.hr_ai_service import (
    CV_EXTRACTION_PROMPT,
    LABOR_LEGAL_LIBRARY,
    CvExtractionService,
    LaborContractGenerator,
    new_worker_code,
)
from src.application.services.ledger_posting_service import LedgerPostingService
from src.application.services.legal_rag_service import HashEmbeddingClient, LegalDocumentInput, LegalRagService
from src.application.services.payroll_service import ColombianDocumentService, NOMINA_ACCOUNTS_PUC
from src.domain.services.payroll_calculator import ColombianPayrollCalculator
from src.ai.vector_store import PgVectorAccountingStore
from src.config import settings
from src.domain.models.accounting import AccountingPeriod, HrContract, HrWorker, JournalEntry
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.repositories.ledger_repository import LedgerRepository
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(prefix="/hr", tags=["RRHH IA"])


class WorkerCreatePayload(BaseModel):
    tenant_id: str
    company_id: str | None = None
    nombres: str
    apellidos: str
    dni: str = Field(min_length=5, max_length=12)  # Cédula de Ciudadanía Colombia (5-12 dígitos)
    fecha_nacimiento: date | None = None
    fecha_inicio_contrato: date | None = None
    fecha_fin_contrato: date | None = None
    direccion_domicilio: str | None = None
    direccion_reniec: str | None = None
    telefono: str | None = None
    email: str | None = None
    profesion: str | None = None
    experiencia: str | None = None
    estudios_realizados: str | None = None
    cargo_postulado: str
    sueldo_pactado: Decimal = Decimal("0.00")
    pension_system: str | None = None
    habilidades_clave: list[str] = Field(default_factory=list)
    cv_metadata: dict = Field(default_factory=dict)


class ContractGeneratePayload(BaseModel):
    tenant_id: str
    worker_id: str
    tipo_contrato: str = "PLAZO INDETERMINADO"
    start_date: date | None = None
    end_date: date | None = None
    pension_system: str | None = None
    requirements: list[dict] = Field(default_factory=list)
    requirement_summary: dict = Field(default_factory=dict)
    include_annex_package: bool = True


class SignatureWebhookPayload(BaseModel):
    signed: bool = True
    signed_at: date | None = None
    signer_name: str | None = None


class PayrollJournalPostPayload(BaseModel):
    tenant_id: str
    year: int
    month: int
    entry_date: date | None = None
    company_id: str | None = None
    cost_center: str = "COL-ADM"


class IdentityValidationPayload(BaseModel):
    dni: str = Field(min_length=5, max_length=12)  # Cédula de Ciudadanía Colombia
    nombres: str = ""
    apellidos: str = ""


def _safe_user_uuid(user_id: str | None) -> str | None:
    if not user_id:
        return None
    try:
        return str(UUID(user_id))
    except Exception:
        return None


def _money(value: Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def _summarize_requirements(requirements: list[dict]) -> dict:
    total = len(requirements)
    approved = sum(1 for item in requirements if item.get("status") == "APROBADO")
    observed = sum(1 for item in requirements if item.get("status") == "OBSERVADO")
    pending = sum(1 for item in requirements if item.get("status") == "PENDIENTE")
    required_pending = [
        item.get("name") or item.get("id") or "Requisito"
        for item in requirements
        if item.get("required") and item.get("status") != "APROBADO"
    ]
    return {
        "total": total,
        "approved": approved,
        "observed": observed,
        "pending": pending,
        "required_pending": required_pending,
    }


@router.get("/legal-library")
async def legal_library(ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    return {"tenant_id": ctx["tenant_id"], "documents": LABOR_LEGAL_LIBRARY}


@router.post("/legal-library/seed")
async def seed_legal_library(ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    documents = [
        LegalDocumentInput(
            source_id=item["source_id"],
            title=item["title"],
            content=(
                f"{item['title']}. Fuente oficial/referencial: {item['url']}. "
                "Usar como contexto legal laboral colombiano para seleccion, contratacion, nomina, "
                "jornada (CST), SST (Ley 1562/2012), seguridad social (Ley 100/1993), parafiscales (Ley 21/1982), "
                "PILA (UGPP), ReteFuente (ET Art. 383), proteccion datos (Ley 1581/2012)."
            ),
            metadata={"url": item["url"], "domain": "laboral_peru"},
        )
        for item in LABOR_LEGAL_LIBRARY
    ]
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        service = LegalRagService(
            pgvector_store=PgVectorAccountingStore(uow.session),
            chroma_store=None,
            vector_provider="pgvector",
            embedding_client=HashEmbeddingClient(settings.rag_embedding_dimensions),
        )
        result = await service.load_legal_documents(ctx["tenant_id"], documents)
        await uow.commit()
        return result.__dict__


@router.post("/legal-library/upload")
async def upload_legal_library_documents(
    files: list[UploadFile] = File(...),
    ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER")),
):
    if not files:
        raise HTTPException(status_code=422, detail="Debe adjuntar al menos un PDF o TXT legal")

    extractor = CvExtractionService()
    documents: list[LegalDocumentInput] = []
    warnings: list[str] = []

    for index, upload in enumerate(files, start=1):
        raw = await upload.read()
        text, extraction_warnings = extractor.extract_text(upload.filename or f"doc_{index}", upload.content_type, raw)
        warnings.extend(extraction_warnings)
        if not text.strip():
            warnings.append(f"Sin texto util en archivo {upload.filename or index}.")
            continue
        source_id = f"UPLOAD_{index}_{(upload.filename or 'documento').replace(' ', '_')}"
        documents.append(
            LegalDocumentInput(
                source_id=source_id[:120],
                title=upload.filename or f"Documento legal {index}",
                content=text,
                metadata={"uploaded": True, "filename": upload.filename, "domain": "laboral_peru"},
            )
        )

    if not documents:
        raise HTTPException(status_code=422, detail="No se pudo extraer texto de los archivos cargados")

    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        service = LegalRagService(
            pgvector_store=PgVectorAccountingStore(uow.session),
            chroma_store=None,
            vector_provider=settings.rag_vector_provider,
            embedding_client=HashEmbeddingClient(settings.rag_embedding_dimensions),
        )
        result = await service.load_legal_documents(ctx["tenant_id"], documents)
        await uow.commit()
        return {
            "tenant_id": ctx["tenant_id"],
            "uploaded_files": len(files),
            "indexed_documents": result.documents,
            "indexed_chunks": result.chunks,
            "provider": result.provider,
            "warnings": [*warnings, *result.warnings],
        }


@router.post("/cv/extract")
async def extract_cv(
    reniec_address: str | None = None,
    file: UploadFile = File(...),
    ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER")),
):
    raw = await file.read()
    mime_type = file.content_type or "application/octet-stream"
    filename = file.filename or "cv"
    warnings: list[str] = []

    # Intentar extracción con Claude o Gemini si hay API key configurada
    if is_vision_available() and mime_type in {
        "application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"
    }:
        try:
            client = get_vision_client()
            response = await client.analyze_document(
                instruction=CV_EXTRACTION_PROMPT,
                file_bytes=raw,
                mime_type=mime_type,
            )
            import json as _json
            text_raw = client.response_text(response)
            # Intentar parsear si Gemini devuelve JSON directo
            try:
                gemini_data = _json.loads(text_raw)
                if isinstance(gemini_data, dict):
                    worker = {
                        "nombres": gemini_data.get("Nombres") or gemini_data.get("nombres") or "",
                        "apellidos": gemini_data.get("Apellidos") or gemini_data.get("apellidos") or "",
                        "dni": gemini_data.get("DNI") or gemini_data.get("dni") or "",
                        "fecha_nacimiento": gemini_data.get("Fecha de nacimiento") or gemini_data.get("fecha_nacimiento"),
                        "direccion_domicilio": gemini_data.get("Direccion") or gemini_data.get("direccion_domicilio") or "",
                        "telefono": gemini_data.get("Telefono") or gemini_data.get("telefono") or "",
                        "email": gemini_data.get("Correo") or gemini_data.get("email") or "",
                        "profesion": gemini_data.get("Profesion") or gemini_data.get("profesion") or "",
                        "experiencia": gemini_data.get("Experiencia") or gemini_data.get("experiencia") or "",
                        "estudios_realizados": gemini_data.get("Estudios") or gemini_data.get("estudios_realizados") or "",
                        "cargo_postulado": gemini_data.get("cargo_postulado") or gemini_data.get("Profesion") or "Por definir",
                        "sueldo_pactado": str(gemini_data.get("sueldo_pactado") or "0.00"),
                        "pension_system": gemini_data.get("Sistema pensionario") or gemini_data.get("pension_system") or "AFP",
                        "cuenta_bancaria": gemini_data.get("cuenta bancaria") or gemini_data.get("cuenta_bancaria") or "",
                        "cci": gemini_data.get("CCI") or gemini_data.get("cci") or "",
                        "habilidades_clave": gemini_data.get("habilidades_clave") or [],
                        "requirements": gemini_data.get("requirements") or [],
                        "alerts": gemini_data.get("alerts") or [],
                    }
                    return {
                        "tenant_id": ctx["tenant_id"],
                        "filename": filename,
                        "text_preview": text_raw[:600],
                        "warnings": warnings,
                        "worker": worker,
                        "workers_batch": [{"candidate_index": 1, "worker": worker}],
                        "batch_count": 1,
                        "provider": "gemini",
                    }
            except _json.JSONDecodeError:
                # Gemini devolvió texto libre — pasar como texto para el parser local
                raw = text_raw.encode("utf-8")
                mime_type = "text/plain"
        except Exception as exc:
            warnings.append(f"Gemini no disponible, usando OCR local: {exc}")

    # Fallback: extracción local con pytesseract/regex
    service = CvExtractionService()
    text, local_warnings = service.extract_text(filename, mime_type, raw)
    warnings.extend(local_warnings)
    workers_batch = service.parse_cv_batch(text, reniec_address=reniec_address)
    primary = workers_batch[0]["worker"] if workers_batch else service.parse_cv(text, reniec_address=reniec_address).as_dict()
    if len(workers_batch) > 1:
        warnings.append(f"Se detectaron {len(workers_batch)} candidatos en un solo archivo.")
    return {
        "tenant_id": ctx["tenant_id"],
        "filename": filename,
        "text_preview": text[:900],
        "warnings": warnings,
        "worker": primary,
        "workers_batch": workers_batch,
        "batch_count": len(workers_batch),
        "provider": "local_ocr",
    }


@router.post("/cv/extract/batch")
async def extract_cv_batch(
    reniec_address: str | None = None,
    file: UploadFile = File(...),
    ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER")),
):
    raw = await file.read()
    service = CvExtractionService()
    text, warnings = service.extract_text(file.filename or "cv", file.content_type, raw)
    workers_batch = service.parse_cv_batch(text, reniec_address=reniec_address)
    return {
        "tenant_id": ctx["tenant_id"],
        "filename": file.filename,
        "warnings": warnings,
        "batch_count": len(workers_batch),
        "workers_batch": workers_batch,
        "text_preview": text[:900],
    }


@router.post("/identity/validate")
async def validate_identity(payload: IdentityValidationPayload, ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    if not payload.dni.isdigit():
        raise HTTPException(status_code=422, detail="DNI debe ser numerico")

    normalized_given = f"{payload.nombres} {payload.apellidos}".strip().lower()
    warnings: list[str] = []
    checks = {
        "dni_format_ok": len(payload.dni) == 8,
        "name_matches_input": bool(normalized_given),
        "reniec_checked": False,
        "antecedentes_checked": False,
        "critical_legal_alert": False,
    }

    # Optional external lookups when endpoints are configured.
    async with httpx.AsyncClient(timeout=8.0) as client:
        if settings.sunat_ruc_lookup_url:
            try:
                reniec_resp = await client.get(settings.sunat_ruc_lookup_url, params={"dni": payload.dni})
                checks["reniec_checked"] = reniec_resp.status_code < 400
                if reniec_resp.status_code < 400:
                    reniec_data = reniec_resp.json() if "application/json" in reniec_resp.headers.get("content-type", "") else {}
                    remote_name = str(reniec_data.get("nombre") or reniec_data.get("razon_social") or "").strip().lower()
                    if remote_name and normalized_given and remote_name not in normalized_given and normalized_given not in remote_name:
                        warnings.append("Alerta: nombre ingresado no coincide con padron externo.")
                else:
                    warnings.append("No se pudo validar RENIEC/SUNAT en linea.")
            except Exception:
                warnings.append("Servicio RENIEC/SUNAT no disponible, validar manualmente.")
        else:
            warnings.append("Endpoint RENIEC/SUNAT no configurado; validacion automatica parcial.")

        if settings.sunat_cpe_lookup_url:
            try:
                antecedentes_resp = await client.get(settings.sunat_cpe_lookup_url, params={"dni": payload.dni})
                checks["antecedentes_checked"] = antecedentes_resp.status_code < 400
                if antecedentes_resp.status_code < 400:
                    raw = antecedentes_resp.text.lower()
                    if "alerta" in raw or "critico" in raw or "inhabilitado" in raw:
                        checks["critical_legal_alert"] = True
                        warnings.append("Se detectaron alertas legales criticas en la consulta externa.")
                else:
                    warnings.append("No se pudo consultar antecedentes externos.")
            except Exception:
                warnings.append("Servicio de antecedentes no disponible.")
        else:
            warnings.append("Endpoint de antecedentes no configurado; control manual requerido.")

    return {
        "tenant_id": ctx["tenant_id"],
        "dni": payload.dni,
        "status": "ALERT" if checks["critical_legal_alert"] else "OK",
        "checks": checks,
        "warnings": warnings,
    }


@router.post("/workers")
async def create_worker(payload: WorkerCreatePayload, ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    if not payload.dni.isdigit():
        raise HTTPException(status_code=422, detail="DNI debe tener 8 digitos numericos")

    alerts = list(payload.cv_metadata.get("alerts", [])) if isinstance(payload.cv_metadata, dict) else []
    requirements = payload.cv_metadata.get("requirements", []) if isinstance(payload.cv_metadata, dict) else []
    required_pending = [
        item for item in requirements
        if isinstance(item, dict) and item.get("required") and item.get("status") != "APROBADO"
    ]
    status = "ALERT" if alerts or required_pending else "READY"
    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        worker = HrWorker(
            tenant_id=payload.tenant_id,
            company_id=payload.company_id,
            worker_code=new_worker_code(),
            nombres=payload.nombres,
            apellidos=payload.apellidos,
            dni=payload.dni,
            fecha_nacimiento=payload.fecha_nacimiento,
            fecha_inicio_contrato=payload.fecha_inicio_contrato,
            fecha_fin_contrato=payload.fecha_fin_contrato,
            direccion_domicilio=payload.direccion_domicilio,
            direccion_reniec=payload.direccion_reniec,
            telefono=payload.telefono,
            email=payload.email,
            profesion=payload.profesion,
            experiencia=payload.experiencia,
            estudios_realizados=payload.estudios_realizados,
            cargo_postulado=payload.cargo_postulado,
            sueldo_pactado=payload.sueldo_pactado,
            pension_system=payload.pension_system,
            habilidades_clave=payload.habilidades_clave,
            cv_metadata=payload.cv_metadata,
            compliance_status=status,
            created_by=_safe_user_uuid(ctx.get("user_id")),
        )
        uow.session.add(worker)
        await uow.commit()
        return {"id": str(worker.id), "worker_code": worker.worker_code, "compliance_status": worker.compliance_status}


@router.get("/workers")
async def list_workers(limit: int = 100, ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(HrWorker)
            .where(HrWorker.tenant_id == ctx["tenant_id"])
            .order_by(HrWorker.created_at.desc())
            .limit(limit)
        )
        rows = list(result.scalars().all())
        return [
            {
                "id": str(row.id),
                "worker_code": row.worker_code,
                "nombres": row.nombres,
                "apellidos": row.apellidos,
                "dni": row.dni,
                "fecha_nacimiento": row.fecha_nacimiento.isoformat() if row.fecha_nacimiento else None,
                "fecha_inicio_contrato": row.fecha_inicio_contrato.isoformat() if row.fecha_inicio_contrato else None,
                "fecha_fin_contrato": row.fecha_fin_contrato.isoformat() if row.fecha_fin_contrato else None,
                "direccion_domicilio": row.direccion_domicilio,
                "direccion_reniec": row.direccion_reniec,
                "cargo_postulado": row.cargo_postulado,
                "sueldo_pactado": str(row.sueldo_pactado),
                "email": row.email,
                "telefono": row.telefono,
                "profesion": row.profesion,
                "experiencia": row.experiencia,
                "estudios_realizados": row.estudios_realizados,
                "pension_system": row.pension_system,
                "habilidades_clave": row.habilidades_clave,
                "cv_metadata": row.cv_metadata,
                "compliance_status": row.compliance_status,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]


@router.post("/payroll/journal")
async def post_payroll_journal(
    payload: PayrollJournalPostPayload,
    request: Request,
    ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER")),
):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    period_code = f"{payload.year}-{str(payload.month).zfill(2)}"
    source_id = f"payroll:{period_code}"

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        existing_result = await uow.session.execute(
            select(JournalEntry).where(
                JournalEntry.tenant_id == payload.tenant_id,
                JournalEntry.source_module == "PAYROLL",
                JournalEntry.source_id == source_id,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            return {
                "id": str(existing.id),
                "row_hash": existing.row_hash,
                "previous_hash": existing.previous_hash,
                "total_debit": str(existing.total_debit),
                "total_credit": str(existing.total_credit),
                "already_posted": True,
                "period": period_code,
            }

        worker_filters = [HrWorker.tenant_id == payload.tenant_id]
        if payload.company_id:
            worker_filters.append(HrWorker.company_id == payload.company_id)
        workers_result = await uow.session.execute(select(HrWorker).where(*worker_filters))
        workers = list(workers_result.scalars().all())

    if not workers:
        raise HTTPException(status_code=422, detail="No hay trabajadores para postear planilla")

    # Auto-create accounting period if it does not exist (avoids PeriodLockedException)
    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as period_uow:
        period_check = await period_uow.session.execute(
            select(AccountingPeriod).where(
                AccountingPeriod.tenant_id == payload.tenant_id,
                AccountingPeriod.year == payload.year,
                AccountingPeriod.month == payload.month,
            )
        )
        if not period_check.scalar_one_or_none():
            period_uow.session.add(
                AccountingPeriod(
                    tenant_id=payload.tenant_id,
                    year=payload.year,
                    month=payload.month,
                    status="OPEN",
                    is_closed=False,
                )
            )
            await period_uow.commit()

    # ── Cálculo nómina Colombia — CST / Ley 100/1993 / Decreto 1072/2015 ─────────
    calc = ColombianPayrollCalculator()
    totales: dict = {
        "sueldos": Decimal("0"), "aux_transporte": Decimal("0"),
        "afp_emp": Decimal("0"), "eps_emp": Decimal("0"), "fondo_sol": Decimal("0"), "retefuente": Decimal("0"),
        "afp_empr": Decimal("0"), "eps_empr": Decimal("0"), "arl": Decimal("0"),
        "ccf": Decimal("0"), "sena": Decimal("0"), "icbf": Decimal("0"),
        "cesantias": Decimal("0"), "int_ces": Decimal("0"), "prima": Decimal("0"), "vacaciones": Decimal("0"),
    }
    for worker in workers:
        liq = calc.liquidar(worker)
        c = liq["comprobante"]
        a = liq["aportes_empleador"]
        p = liq["provisiones"]
        totales["sueldos"]       += c["salario_proporcional"]
        totales["aux_transporte"] += c["auxilio_transporte"]
        totales["afp_emp"]        += c["afp_empleado"]
        totales["eps_emp"]        += c["eps_empleado"]
        totales["fondo_sol"]      += c["fondo_solidaridad"]
        totales["retefuente"]     += c["retefuente"]
        totales["afp_empr"]       += a["afp_empleador"]
        totales["eps_empr"]       += a["eps_empleador"]
        totales["arl"]            += a["arl"]
        totales["ccf"]            += a["ccf"]
        totales["sena"]           += a["sena"]
        totales["icbf"]           += a["icbf"]
        totales["cesantias"]      += p["cesantias"]
        totales["int_ces"]        += p["int_cesantias"]
        totales["prima"]          += p["prima"]
        totales["vacaciones"]     += p["vacaciones"]

    def _m(k): return _money(totales[k])

    neto_pagar = _m("sueldos") + _m("aux_transporte") - _m("afp_emp") - _m("eps_emp") - _m("fondo_sol") - _m("retefuente")
    total_afp = _m("afp_emp") + _m("afp_empr")
    total_eps = _m("eps_emp") + _m("eps_empr")
    total_debit = (
        _m("sueldos") + _m("aux_transporte") +
        _m("cesantias") + _m("int_ces") + _m("prima") + _m("vacaciones") +
        _m("afp_empr") + _m("eps_empr") + _m("arl") + _m("ccf") + _m("sena") + _m("icbf")
    )

    if total_debit <= 0:
        raise HTTPException(status_code=422, detail="La nómina no tiene importe contable")

    # ── Asientos PUC Colombia ──────────────────────────────────────────────────
    def _line(code, name, debit=Decimal("0"), credit=Decimal("0"), cc=None):
        entry = {"account_code": code, "account_name": name, "debit": debit, "credit": credit}
        if cc:
            entry["cost_center"] = cc
        return entry

    lines = []
    # Débitos — gastos de personal (Clase 51)
    if _m("sueldos"):       lines.append(_line("510506", "Sueldos y salarios",                   debit=_m("sueldos"),       cc=payload.cost_center))
    if _m("aux_transporte"): lines.append(_line("510530", "Auxilio de transporte",              debit=_m("aux_transporte"), cc=payload.cost_center))
    if _m("cesantias"):     lines.append(_line("510518", "Gasto cesantías 8.33%",               debit=_m("cesantias"),      cc=payload.cost_center))
    if _m("int_ces"):       lines.append(_line("510519", "Gasto intereses cesantías",           debit=_m("int_ces"),        cc=payload.cost_center))
    if _m("prima"):         lines.append(_line("510521", "Gasto prima de servicios 8.33%",      debit=_m("prima"),          cc=payload.cost_center))
    if _m("vacaciones"):    lines.append(_line("510527", "Gasto vacaciones 4.17%",              debit=_m("vacaciones"),     cc=payload.cost_center))
    if _m("afp_empr"):      lines.append(_line("510524", "Gasto AFP empleador 12%",             debit=_m("afp_empr"),       cc=payload.cost_center))
    if _m("eps_empr"):      lines.append(_line("510522", "Gasto EPS empleador 8.5%",            debit=_m("eps_empr"),       cc=payload.cost_center))
    if _m("arl"):           lines.append(_line("510523", "Gasto ARL",                           debit=_m("arl"),            cc=payload.cost_center))
    if _m("ccf"):           lines.append(_line("510525", "Gasto CCF 4%",                        debit=_m("ccf"),            cc=payload.cost_center))
    if _m("sena"):          lines.append(_line("510510", "Gasto SENA 2%",                       debit=_m("sena"),           cc=payload.cost_center))
    if _m("icbf"):          lines.append(_line("510515", "Gasto ICBF 3%",                       debit=_m("icbf"),           cc=payload.cost_center))
    # Créditos — pasivos (Clases 23-26)
    if total_afp:           lines.append(_line("2405",   "AFP pensiones por pagar (PILA)",       credit=total_afp))
    if total_eps:           lines.append(_line("2406",   "EPS salud por pagar (PILA)",           credit=total_eps))
    if _m("arl"):           lines.append(_line("2407",   "ARL por pagar",                        credit=_m("arl")))
    if _m("fondo_sol"):     lines.append(_line("2408",   "Fondo solidaridad pensional",          credit=_m("fondo_sol")))
    if _m("ccf"):           lines.append(_line("2413",   "CCF por pagar",                        credit=_m("ccf")))
    if _m("sena"):          lines.append(_line("2414",   "SENA por pagar",                       credit=_m("sena")))
    if _m("icbf"):          lines.append(_line("2415",   "ICBF por pagar",                       credit=_m("icbf")))
    if _m("retefuente"):    lines.append(_line("2365",   "ReteFuente rentas laborales (DIAN)",   credit=_m("retefuente")))
    if _m("cesantias"):     lines.append(_line("2610",   "Cesantías consolidadas",               credit=_m("cesantias")))
    if _m("int_ces"):       lines.append(_line("2615",   "Intereses cesantías por pagar",        credit=_m("int_ces")))
    if _m("prima"):         lines.append(_line("2620",   "Prima de servicios por pagar",         credit=_m("prima")))
    if _m("vacaciones"):    lines.append(_line("2625",   "Vacaciones consolidadas",              credit=_m("vacaciones")))
    lines.append(_line("2370", "Nóminas por pagar (neto empleados)",                            credit=neto_pagar))

    # Upsert PUC Colombia al plan contable — garantiza visibilidad en libro diario
    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow_acct:
        repo_acct = LedgerRepository(uow_acct.session)
        for acct in NOMINA_ACCOUNTS_PUC:
            await repo_acct.upsert_chart_account(
                payload.tenant_id,
                company_id=payload.company_id,
                code=acct["code"],
                name=acct["name"],
                account_class=acct["class"],
                statement=acct["statement"],
                nature=acct["nature"],
                accepts_cost_center=acct["cc"],
                accepts_partner=False,
            )
        await uow_acct.commit()

    entry = await LedgerPostingService(build_uow_factory(), build_hash_service()).post_journal({
        "tenant_id": payload.tenant_id,
        "company_id": payload.company_id,
        "year": payload.year,
        "month": payload.month,
        "entry_date": payload.entry_date or date(payload.year, payload.month, 1),
        "description": f"Nómina Colombia {period_code} — CST/Ley100/Decreto1072",
        "source_module": "PAYROLL",
        "source_id": source_id,
        "currency": "COP",
        "user_id": ctx.get("user_id"),
        "trace_id": ctx["trace_id"],
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
        "lines": lines,
    })

    return {
        "id": str(entry.id),
        "row_hash": entry.row_hash,
        "previous_hash": entry.previous_hash,
        "total_debit": str(entry.total_debit),
        "total_credit": str(entry.total_credit),
        "already_posted": False,
        "period": period_code,
    }


@router.post("/payroll/sync-chart-accounts")
async def sync_payroll_chart_accounts(ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    """Registra/actualiza en el PUC Colombia TODAS las cuentas de nómina.
    Ejecutar una vez si los asientos no aparecen en el libro diario."""
    tenant_id = ctx["tenant_id"]
    async with UnitOfWork(AsyncSessionLocal, tenant_id) as uow:
        repo = LedgerRepository(uow.session)
        synced = []
        for acct in NOMINA_ACCOUNTS_PUC:
            await repo.upsert_chart_account(
                tenant_id,
                company_id=None,
                code=acct["code"],
                name=acct["name"],
                account_class=acct["class"],
                statement=acct["statement"],
                nature=acct["nature"],
                accepts_cost_center=acct["cc"],
                accepts_partner=False,
            )
            synced.append(acct["code"])
        await uow.commit()
    return {"ok": True, "norma": "PUC_COLOMBIA", "synced_accounts": synced, "count": len(synced)}


# ─── COMPROBANTE DE NÓMINA ────────────────────────────────────────────────────
class ComprobantePayload(BaseModel):
    tenant_id: str
    worker_id: str
    periodo: str | None = None
    empresa: str = "EMPRESA S.A.S."
    nit: str = ""
    representante_legal: str = ""


@router.post("/payroll/comprobante")
async def generar_comprobante_nomina(payload: ComprobantePayload, ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    """Genera Comprobante de Nómina individual (Art. 62 CST). Conexión en tiempo real con libro diario."""
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    import base64 as _b64
    from datetime import datetime as _dt

    periodo = payload.periodo or _dt.now().strftime("%B %Y")
    calc = ColombianPayrollCalculator()

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        result = await uow.session.execute(
            select(HrWorker).where(HrWorker.tenant_id == payload.tenant_id, HrWorker.id == payload.worker_id)
        )
        worker = result.scalar_one_or_none()
        if not worker:
            raise HTTPException(status_code=404, detail="Trabajador no encontrado")

        liq = calc.liquidar(worker)
        doc_data = {
            **liq,
            "nombres": worker.nombres,
            "apellidos": worker.apellidos,
            "cedula": worker.dni,
            "cargo": worker.cargo_postulado,
            "periodo": periodo,
            "empresa": payload.empresa,
            "nit": payload.nit,
            "cc_empresa": payload.representante_legal,
        }
        pdf_bytes = ColombianDocumentService.generar_comprobante_nomina_pdf(doc_data)
        b64 = _b64.b64encode(pdf_bytes).decode("utf-8")

    return {
        "worker_id": payload.worker_id,
        "cedula": worker.dni,
        "nombres": f"{worker.nombres} {worker.apellidos}",
        "periodo": periodo,
        "liquidacion": liq,
        "filename": f"comprobante_{worker.dni}_{periodo.replace(' ', '_')}.pdf",
        "mime_type": "application/pdf",
        "pdf_base64": b64,
    }


@router.post("/payroll/comprobante-masivo")
async def generar_comprobantes_masivos(
    tenant_id: str,
    periodo: str | None = None,
    empresa: str = "EMPRESA S.A.S.",
    nit: str = "",
    ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER")),
):
    """Genera comprobantes de nómina para todos los trabajadores activos del período."""
    if tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    import base64 as _b64
    from datetime import datetime as _dt

    periodo = periodo or _dt.now().strftime("%B %Y")
    calc = ColombianPayrollCalculator()

    async with UnitOfWork(AsyncSessionLocal, tenant_id) as uow:
        result = await uow.session.execute(select(HrWorker).where(HrWorker.tenant_id == tenant_id))
        workers = list(result.scalars().all())

    comprobantes = []
    for w in workers:
        liq = calc.liquidar(w)
        doc_data = {**liq, "nombres": w.nombres, "apellidos": w.apellidos, "cedula": w.dni,
                    "cargo": w.cargo_postulado, "periodo": periodo, "empresa": empresa, "nit": nit}
        pdf_bytes = ColombianDocumentService.generar_comprobante_nomina_pdf(doc_data)
        comprobantes.append({
            "cedula": w.dni,
            "nombre": f"{w.nombres} {w.apellidos}",
            "neto_pagar": str(liq["comprobante"]["neto_pagar"]),
            "filename": f"comprobante_{w.dni}_{periodo.replace(' ','_')}.pdf",
            "pdf_base64": _b64.b64encode(pdf_bytes).decode("utf-8"),
        })

    return {"periodo": periodo, "total_trabajadores": len(comprobantes), "comprobantes": comprobantes}


# ─── PILA ─────────────────────────────────────────────────────────────────────
@router.post("/payroll/pila")
async def generar_pila(
    tenant_id: str,
    periodo: str,
    nit_empresa: str = "",
    nombre_empresa: str = "",
    ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER")),
):
    """Genera archivo PILA (Planilla Integrada de Liquidación de Aportes) — UGPP."""
    if tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    calc = ColombianPayrollCalculator()

    async with UnitOfWork(AsyncSessionLocal, tenant_id) as uow:
        result = await uow.session.execute(select(HrWorker).where(HrWorker.tenant_id == tenant_id))
        workers = list(result.scalars().all())

    workers_data = []
    for w in workers:
        liq = calc.liquidar(w)
        workers_data.append({**liq, "cedula": w.dni, "nombres": w.nombres, "apellidos": w.apellidos})

    contenido = ColombianDocumentService.generar_pila_txt(workers_data, periodo, nit_empresa, nombre_empresa)
    import base64 as _b64
    return {
        "periodo": periodo,
        "trabajadores": len(workers_data),
        "filename": f"PILA_{periodo}.txt",
        "contenido_base64": _b64.b64encode(contenido.encode("utf-8")).decode("utf-8"),
        "preview": contenido[:500],
        "nota": "Liquidar vía operador PILA autorizado (SOI, Mi Planilla, Aportes En Línea) antes del día 21 del mes siguiente — UGPP.",
    }


# ─── CERTIFICADO LABORAL ──────────────────────────────────────────────────────
class CertificadoLaboralPayload(BaseModel):
    tenant_id: str
    worker_id: str
    empresa: str = "EMPRESA S.A.S."
    nit: str = ""
    representante_legal: str = ""
    cargo_representante: str = "Representante Legal"
    tipo_contrato: str = "TÉRMINO INDEFINIDO"
    incluir_fecha_retiro: bool = False
    causa_terminacion: str | None = None


@router.post("/workers/certificado-laboral")
async def generar_certificado_laboral(payload: CertificadoLaboralPayload, ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    """Genera Certificado Laboral (Art. 57 num. 7 CST)."""
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    import base64 as _b64
    from datetime import datetime as _dt

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        result = await uow.session.execute(
            select(HrWorker).where(HrWorker.tenant_id == payload.tenant_id, HrWorker.id == payload.worker_id)
        )
        worker = result.scalar_one_or_none()
        if not worker:
            raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    doc_data = {
        "empresa": payload.empresa, "nit": payload.nit,
        "nombres": worker.nombres, "apellidos": worker.apellidos, "cedula": worker.dni,
        "cargo": worker.cargo_postulado, "salario": str(worker.sueldo_pactado),
        "fecha_ingreso": worker.fecha_inicio_contrato.isoformat() if worker.fecha_inicio_contrato else "",
        "fecha_retiro": worker.fecha_fin_contrato.isoformat() if (payload.incluir_fecha_retiro and worker.fecha_fin_contrato) else "",
        "tipo_contrato": payload.tipo_contrato,
        "representante_legal": payload.representante_legal,
        "cargo_representante": payload.cargo_representante,
        "fecha_expedicion": _dt.now().strftime("%d de %B de %Y"),
    }
    pdf_bytes = ColombianDocumentService.generar_certificado_laboral_pdf(doc_data)
    b64 = _b64.b64encode(pdf_bytes).decode("utf-8")

    return {
        "worker_id": payload.worker_id, "cedula": worker.dni,
        "filename": f"certificado_laboral_{worker.dni}.pdf",
        "mime_type": "application/pdf", "pdf_base64": b64,
    }


# ─── PAZ Y SALVO ──────────────────────────────────────────────────────────────
class PazYSalvoPayload(BaseModel):
    tenant_id: str
    worker_id: str
    empresa: str = "EMPRESA S.A.S."
    nit: str = ""
    representante_legal: str = ""
    conceptos_liquidados: list[str] = []
    observaciones: str = ""


@router.post("/workers/paz-y-salvo")
async def generar_paz_y_salvo(payload: PazYSalvoPayload, ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    """Genera Paz y Salvo laboral."""
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    import base64 as _b64

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        result = await uow.session.execute(
            select(HrWorker).where(HrWorker.tenant_id == payload.tenant_id, HrWorker.id == payload.worker_id)
        )
        worker = result.scalar_one_or_none()
        if not worker:
            raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    doc_data = {
        "empresa": payload.empresa, "nit": payload.nit,
        "nombres": worker.nombres, "apellidos": worker.apellidos, "cedula": worker.dni,
        "cargo": worker.cargo_postulado, "representante_legal": payload.representante_legal,
        "conceptos_liquidados": payload.conceptos_liquidados or None,
        "observaciones": payload.observaciones,
    }
    pdf_bytes = ColombianDocumentService.generar_paz_y_salvo_pdf(doc_data)
    b64 = _b64.b64encode(pdf_bytes).decode("utf-8")

    return {
        "worker_id": payload.worker_id, "cedula": worker.dni,
        "filename": f"paz_y_salvo_{worker.dni}.pdf",
        "mime_type": "application/pdf", "pdf_base64": b64,
    }


# ─── ACTA DE LIQUIDACIÓN ──────────────────────────────────────────────────────
class ActaLiquidacionPayload(BaseModel):
    tenant_id: str
    worker_id: str
    empresa: str = "EMPRESA S.A.S."
    nit: str = ""
    representante_legal: str = ""
    causa_terminacion: str = "Terminación sin justa causa (Art. 64 CST)"
    fecha_retiro: date | None = None
    liquidacion: dict = {}


@router.post("/workers/acta-liquidacion")
async def generar_acta_liquidacion(payload: ActaLiquidacionPayload, ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    """Genera Acta de Liquidación de Prestaciones Sociales (Art. 64-66 CST)."""
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    import base64 as _b64
    from datetime import datetime as _dt

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        result = await uow.session.execute(
            select(HrWorker).where(HrWorker.tenant_id == payload.tenant_id, HrWorker.id == payload.worker_id)
        )
        worker = result.scalar_one_or_none()
        if not worker:
            raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    calc = ColombianPayrollCalculator()
    liq = calc.liquidar(worker)

    doc_data = {
        "empresa": payload.empresa, "nit": payload.nit,
        "nombres": worker.nombres, "apellidos": worker.apellidos, "cedula": worker.dni,
        "cargo": worker.cargo_postulado, "ultimo_salario": str(worker.sueldo_pactado),
        "fecha_ingreso": worker.fecha_inicio_contrato.isoformat() if worker.fecha_inicio_contrato else "",
        "fecha_retiro": (payload.fecha_retiro or date.today()).isoformat(),
        "causa_terminacion": payload.causa_terminacion,
        "representante_legal": payload.representante_legal,
        "liquidacion": payload.liquidacion or {
            "cesantias": str(liq["provisiones"]["cesantias"]),
            "int_cesantias": str(liq["provisiones"]["int_cesantias"]),
            "prima": str(liq["provisiones"]["prima"]),
            "vacaciones": str(liq["provisiones"]["vacaciones"]),
        },
    }
    pdf_bytes = ColombianDocumentService.generar_acta_liquidacion_pdf(doc_data)
    b64 = _b64.b64encode(pdf_bytes).decode("utf-8")

    return {
        "worker_id": payload.worker_id, "cedula": worker.dni,
        "filename": f"acta_liquidacion_{worker.dni}.pdf",
        "mime_type": "application/pdf", "pdf_base64": b64,
        "liquidacion_calculada": liq["provisiones"],
    }


# ─── AUTORIZACIÓN DESCUENTOS ──────────────────────────────────────────────────
class AutorizacionDescuentosPayload(BaseModel):
    tenant_id: str
    worker_id: str
    empresa: str = "EMPRESA S.A.S."
    nit: str = ""
    descuentos_autorizados: list[str] = []


@router.post("/workers/autorizacion-descuentos")
async def generar_autorizacion_descuentos(payload: AutorizacionDescuentosPayload, ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    """Genera Autorización de Descuentos de Nómina (Art. 149 CST) — debe firmar el trabajador."""
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    import base64 as _b64

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        result = await uow.session.execute(
            select(HrWorker).where(HrWorker.tenant_id == payload.tenant_id, HrWorker.id == payload.worker_id)
        )
        worker = result.scalar_one_or_none()
        if not worker:
            raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    doc_data = {
        "empresa": payload.empresa, "nit": payload.nit,
        "nombres": worker.nombres, "apellidos": worker.apellidos, "cedula": worker.dni,
        "cargo": worker.cargo_postulado,
        "descuentos_autorizados": payload.descuentos_autorizados or None,
    }
    pdf_bytes = ColombianDocumentService.generar_autorizacion_descuentos_pdf(doc_data)
    b64 = _b64.b64encode(pdf_bytes).decode("utf-8")

    return {
        "worker_id": payload.worker_id, "cedula": worker.dni,
        "filename": f"autorizacion_descuentos_{worker.dni}.pdf",
        "mime_type": "application/pdf", "pdf_base64": b64,
        "nota": "Documento que DEBE firmar el trabajador (Art. 149 CST). Archivar en hoja de vida.",
    }


# ─── RESUMEN DOCUMENTOS POR TRABAJADOR ───────────────────────────────────────
@router.get("/workers/{worker_id}/documentos")
async def listar_documentos_trabajador(worker_id: str, ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    """Lista todos los documentos laborales disponibles para generar para un trabajador."""
    return {
        "worker_id": worker_id,
        "documentos_empleador_firma_trabajador": [
            {"nombre": "Contrato de Trabajo",              "endpoint": "POST /api/v1/hr/contracts/generate",                "norma": "Art. 22-45 CST"},
            {"nombre": "Autorización Descuentos de Nómina","endpoint": "POST /api/v1/hr/workers/autorizacion-descuentos",   "norma": "Art. 149 CST"},
            {"nombre": "Acta de Liquidación Prestaciones",  "endpoint": "POST /api/v1/hr/workers/acta-liquidacion",          "norma": "Art. 64-66 CST"},
        ],
        "documentos_empresa_genera": [
            {"nombre": "Comprobante de Nómina",             "endpoint": "POST /api/v1/hr/payroll/comprobante",               "norma": "Art. 62 CST"},
            {"nombre": "Comprobantes Masivos",              "endpoint": "POST /api/v1/hr/payroll/comprobante-masivo",         "norma": "Art. 62 CST"},
            {"nombre": "Certificado Laboral",               "endpoint": "POST /api/v1/hr/workers/certificado-laboral",       "norma": "Art. 57 num.7 CST"},
            {"nombre": "Paz y Salvo Laboral",               "endpoint": "POST /api/v1/hr/workers/paz-y-salvo",               "norma": "Práctica laboral"},
            {"nombre": "PILA — Planilla Integrada Aportes", "endpoint": "POST /api/v1/hr/payroll/pila",                      "norma": "UGPP / Ley 100/1993"},
            {"nombre": "Asiento Nómina → Libro Diario",     "endpoint": "POST /api/v1/hr/payroll/journal",                   "norma": "PUC Colombia / Dec. 2649/1993"},
        ],
        "documentos_afiliacion": [
            {"nombre": "Formulario afiliación AFP",         "entidad": "AFP (Porvenir/Protección/Colfondos/Old Mutual/Colpensiones)", "norma": "Art. 20 Ley 100/1993"},
            {"nombre": "Formulario afiliación EPS",         "entidad": "EPS (Sura/Sanitas/Nueva EPS/Compensar/etc.)",         "norma": "Art. 204 Ley 100/1993"},
            {"nombre": "Formulario afiliación CCF",         "entidad": "CCF (Compensar/Cafam/Colsubsidio/etc.)",              "norma": "Ley 21/1982"},
            {"nombre": "Formulario afiliación ARL",         "entidad": "ARL (Sura/Positiva/Bolívar/etc.)",                   "norma": "Decreto 1607/2002"},
        ],
    }


@router.post("/contracts/generate")
async def generate_contract(payload: ContractGeneratePayload, ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        result = await uow.session.execute(
            select(HrWorker).where(HrWorker.tenant_id == payload.tenant_id, HrWorker.id == payload.worker_id)
        )
        worker = result.scalar_one_or_none()
        if worker is None:
            raise HTTPException(status_code=404, detail="Trabajador no encontrado")

        stored_metadata = worker.cv_metadata or {}
        stored_requirements = stored_metadata.get("requirements", []) if isinstance(stored_metadata, dict) else []
        requirements = payload.requirements or (stored_requirements if isinstance(stored_requirements, list) else [])
        requirement_summary = payload.requirement_summary or _summarize_requirements(requirements)
        worker_payload = {
            "id": str(worker.id),
            "nombres": worker.nombres,
            "apellidos": worker.apellidos,
            "dni": worker.dni,
            "direccion_domicilio": worker.direccion_domicilio,
            "cargo_postulado": worker.cargo_postulado,
            "sueldo_pactado": str(worker.sueldo_pactado),
            "profesion": worker.profesion,
            "requirements": requirements,
        }
        rag_service = LegalRagService(
            pgvector_store=PgVectorAccountingStore(uow.session),
            chroma_store=None,
            vector_provider=settings.rag_vector_provider,
            embedding_client=HashEmbeddingClient(settings.rag_embedding_dimensions),
        )
        rag_query = (
            f"Contrato laboral Colombia {payload.tipo_contrato} para cargo {worker.cargo_postulado} "
            f"CC {worker.dni}. Clausulas CST: jornada, SST Ley 1562, datos personales Ley 1581, "
            f"seguridad social Ley 100/1993, parafiscales Ley 21/1982."
        )
        rag_context = await rag_service.query(payload.tenant_id, rag_query, limit=6)
        legal_hits = rag_context.get("results", [])

        today = date.today()
        contract_terms = {
            "start_date": payload.start_date.isoformat() if payload.start_date else today.isoformat(),
            "end_date": payload.end_date.isoformat() if payload.end_date else None,
            "pension_system": payload.pension_system,
            "t_registro_due": (today.toordinal() + 1),
            "requirements": requirements,
            "requirement_summary": requirement_summary,
        }

        generator = LaborContractGenerator()
        text = generator.generate_contract_text(
            worker_payload,
            payload.tipo_contrato,
            legal_context=legal_hits,
            contract_terms=contract_terms,
        )
        pdf_base64 = generator.generate_pdf_base64(
            worker_payload,
            payload.tipo_contrato,
            legal_context=legal_hits,
            contract_terms=contract_terms,
        )
        _, package_zip_base64 = generator.generate_annex_zip_base64(
            worker=worker_payload,
            tipo_contrato=payload.tipo_contrato,
            contract_pdf_base64=pdf_base64,
            contract_text=text,
            contract_terms=contract_terms,
            legal_context=legal_hits,
        )
        t_registro_due_date = date.fromordinal(today.toordinal() + 1).isoformat()

        expiring_in_days = None
        if payload.end_date:
            expiring_in_days = (payload.end_date - today).days
        compliance_alerts = []
        if expiring_in_days is not None and expiring_in_days <= 15:
            compliance_alerts.append("Contrato a plazo fijo vence en <= 15 dias.")
        required_pending = requirement_summary.get("required_pending", [])
        if required_pending:
            compliance_alerts.append(
                f"Expediente con requisitos obligatorios pendientes/observados: {', '.join(required_pending[:6])}."
            )

        contract = HrContract(
            tenant_id=payload.tenant_id,
            worker_id=payload.worker_id,
            contract_type=payload.tipo_contrato,
            status="PENDING_SIGNATURE",
            legal_basis={
                "documents": LABOR_LEGAL_LIBRARY,
                "rag_ready": True,
                "rag_hits": legal_hits,
                "rag_provider": rag_context.get("provider"),
                "rag_warnings": rag_context.get("warnings", []),
                "contract_start_date": contract_terms["start_date"],
                "contract_end_date": contract_terms["end_date"],
                "pension_system": contract_terms["pension_system"],
                "t_registro_due": t_registro_due_date,
                "requirements": requirements,
                "requirement_summary": requirement_summary,
                "alerts": compliance_alerts,
            },
            contract_text=text,
            pdf_base64=pdf_base64,
            created_by=_safe_user_uuid(ctx.get("user_id")),
        )
        uow.session.add(contract)
        await uow.commit()
        package_filename = f"paquete-contratacion-{worker.dni}.zip"
        return {
            "contract_id": str(contract.id),
            "status": contract.status,
            "filename": f"contrato-{worker.dni}.pdf",
            "mime_type": "application/pdf",
            "pdf_base64": contract.pdf_base64,
            "package_filename": package_filename,
            "package_zip_base64": package_zip_base64 if payload.include_annex_package else None,
            "legal_basis": contract.legal_basis,
            "signature_webhook": f"/api/v1/hr/contracts/{contract.id}/signature-webhook",
            "pila_afiliacion_plazo": "Afiliar a EPS/AFP/ARL/CCF ANTES del primer día de trabajo (Ley 100/1993)",
            "compliance_alerts": compliance_alerts,
            "preview": contract.contract_text[:1200],
        }


@router.post("/contracts/{contract_id}/signature-webhook")
async def signature_webhook(contract_id: str, payload: SignatureWebhookPayload, ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(HrContract).where(HrContract.tenant_id == ctx["tenant_id"], HrContract.id == contract_id)
        )
        contract = result.scalar_one_or_none()
        if contract is None:
            raise HTTPException(status_code=404, detail="Contrato no encontrado")

        legal_basis = dict(contract.legal_basis or {})
        legal_basis["signed_at"] = (payload.signed_at or date.today()).isoformat()
        legal_basis["signer_name"] = payload.signer_name
        legal_basis["t_registro_action_required"] = True
        legal_basis["t_registro_deadline_hours"] = 24
        contract.legal_basis = legal_basis
        contract.status = "SIGNED" if payload.signed else contract.status

        await uow.commit()
        return {
            "contract_id": str(contract.id),
            "status": contract.status,
            "message": "Contrato firmado. Afiliar al trabajador en EPS/AFP/ARL/CCF antes del primer día de trabajo.",
            "pila_afiliacion_urgente": True,
            "accion_requerida": "Afiliación PILA — EPS (Art. 204 Ley 100) + AFP (Art. 20 Ley 100) + ARL (Ley 1562) + CCF (Ley 21/1982)",
        }


@router.get("/contracts/expiring")
async def expiring_contracts(days: int = 15, ctx=Depends(require_roles("ADMIN", "ACCOUNTANT", "CONTROLLER"))):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(HrContract, HrWorker)
            .join(HrWorker, HrWorker.id == HrContract.worker_id)
            .where(HrContract.tenant_id == ctx["tenant_id"])
            .order_by(HrContract.created_at.desc())
            .limit(300)
        )

        today = date.today()
        rows = []
        for contract, worker in result.all():
            legal_basis = contract.legal_basis or {}
            end_raw = legal_basis.get("contract_end_date")
            if not end_raw:
                continue
            try:
                end_date = date.fromisoformat(str(end_raw))
            except Exception:
                continue
            pending_days = (end_date - today).days
            if pending_days <= days:
                rows.append(
                    {
                        "contract_id": str(contract.id),
                        "worker_id": str(worker.id),
                        "worker_name": f"{worker.nombres} {worker.apellidos}".strip(),
                        "dni": worker.dni,
                        "contract_type": contract.contract_type,
                        "status": contract.status,
                        "end_date": end_date.isoformat(),
                        "days_to_expire": pending_days,
                    }
                )
        return {"tenant_id": ctx["tenant_id"], "days_window": days, "items": rows}
