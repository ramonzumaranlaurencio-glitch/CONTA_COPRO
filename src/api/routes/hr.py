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
from src.application.services.hr_ai_service import (
    CV_EXTRACTION_PROMPT,
    LABOR_LEGAL_LIBRARY,
    CvExtractionService,
    LaborContractGenerator,
    new_worker_code,
)
from src.application.services.ledger_posting_service import LedgerPostingService
from src.application.services.legal_rag_service import HashEmbeddingClient, LegalDocumentInput, LegalRagService
from src.ai.vector_store import PgVectorAccountingStore
from src.config import settings
from src.domain.models.accounting import HrContract, HrWorker, JournalEntry
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(prefix="/hr", tags=["RRHH IA"])


class WorkerCreatePayload(BaseModel):
    tenant_id: str
    company_id: str | None = None
    nombres: str
    apellidos: str
    dni: str = Field(min_length=8, max_length=8)
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
    cost_center: str = "LIM-ADM"


class IdentityValidationPayload(BaseModel):
    dni: str = Field(min_length=8, max_length=8)
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
                "Usar como contexto legal laboral para seleccion, tratamiento de CV, jornada, SST, "
                "modalidades contractuales, subordinacion, periodo de prueba y proteccion de datos personales."
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
    service = CvExtractionService()
    text, warnings = service.extract_text(file.filename or "cv", file.content_type, raw)
    workers_batch = service.parse_cv_batch(text, reniec_address=reniec_address)
    primary = workers_batch[0]["worker"] if workers_batch else service.parse_cv(text, reniec_address=reniec_address).as_dict()
    if len(workers_batch) > 1:
        warnings.append(f"Se detectaron {len(workers_batch)} candidatos en un solo archivo.")
    return {
        "tenant_id": ctx["tenant_id"],
        "prompt": CV_EXTRACTION_PROMPT,
        "filename": file.filename,
        "text_preview": text[:900],
        "warnings": warnings,
        "worker": primary,
        "workers_batch": workers_batch,
        "batch_count": len(workers_batch),
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

    gross = _money(sum((Decimal(str(worker.sueldo_pactado or 0)) for worker in workers), Decimal("0.00")))
    pension = _money(sum(
        (
            Decimal(str(worker.sueldo_pactado or 0)) *
            (Decimal("0.13") if str(worker.pension_system or "AFP").upper() == "ONP" else Decimal("0.1334"))
        )
        for worker in workers
    ))
    essalud = _money(gross * Decimal("0.09"))
    net_payable = _money(gross - pension)
    total_debit = _money(gross + essalud)

    if total_debit <= 0:
        raise HTTPException(status_code=422, detail="La planilla no tiene importe contable")

    lines = [
        {
            "account_code": "6211",
            "account_name": "Sueldos y salarios",
            "debit": gross,
            "credit": Decimal("0.00"),
            "cost_center": payload.cost_center,
        },
        {
            "account_code": "6271",
            "account_name": "Seguridad y prevision social",
            "debit": essalud,
            "credit": Decimal("0.00"),
            "cost_center": payload.cost_center,
        },
        {
            "account_code": "4111",
            "account_name": "Remuneraciones por pagar",
            "debit": Decimal("0.00"),
            "credit": net_payable,
        },
        {
            "account_code": "4032",
            "account_name": "ONP/AFP por pagar",
            "debit": Decimal("0.00"),
            "credit": pension,
        },
        {
            "account_code": "4031",
            "account_name": "EsSalud por pagar",
            "debit": Decimal("0.00"),
            "credit": essalud,
        },
    ]

    entry = await LedgerPostingService(build_uow_factory(), build_hash_service()).post_journal({
        "tenant_id": payload.tenant_id,
        "company_id": payload.company_id,
        "year": payload.year,
        "month": payload.month,
        "entry_date": payload.entry_date or date(payload.year, payload.month, 1),
        "description": f"Planilla mensual {period_code}",
        "source_module": "PAYROLL",
        "source_id": source_id,
        "currency": "PEN",
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
            f"Contrato laboral peru {payload.tipo_contrato} para cargo {worker.cargo_postulado} "
            f"con DNI {worker.dni}. Clausulas de jornada, SST, datos personales y vigencia."
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
            "t_registro_due": t_registro_due_date,
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
            "message": "Contrato firmado. Ejecutar alta en T-Registro dentro de 24 horas.",
            "t_registro_required": True,
            "t_registro_deadline_hours": 24,
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
