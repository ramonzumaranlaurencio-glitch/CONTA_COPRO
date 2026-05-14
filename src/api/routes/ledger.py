from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from uuid import UUID, uuid4
from datetime import date
from decimal import Decimal
from io import BytesIO
import base64
from sqlalchemy import and_, select
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from src.api.dependencies import get_current_context
from src.application.dto.ledger import InvoicePostRequest, JournalEntryListItem, JournalEntryResponse, JournalPostRequest, PurchasePostRequest
from src.application.services.ledger_posting_service import LedgerPostingService
from src.application.services.integrity_scanner import LedgerIntegrityScanner
from src.application.services.expert_accounting_guard import ExpertAccountingGuard
from src.application.services.sunat_realtime_verifier import SunatRealtimeVerifier
from src.config import settings
from src.domain.models.accounting import AccountingPeriod, AuditLog, FinancialDocument, JournalEntry, OutboxEvent
from src.domain.exceptions import ExpertValidationException
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.hash_chain import LedgerHashService
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(prefix="/ledger", tags=["Ledger"])


class DocumentModificationRequest(BaseModel):
    tenant_id: str
    direction: str = Field(pattern="^(AR|AP)$")
    series: str
    number: str
    motivo: str
    justificacion: str
    datos_nuevos: dict = Field(default_factory=dict)
    periodo_declarado: bool = False


class GuiaLineItemRequest(BaseModel):
    productCode: str = ""
    description: str = ""
    unit: str = "UND"
    quantity: str = "0.00"


class GuiaRemisionRequest(BaseModel):
    tenant_id: str
    direction: str = Field(default="AR", pattern="^(AR|AP)$")
    source_document: str
    serie: str = Field(min_length=1, max_length=10)
    number: str | None = Field(default=None, max_length=30)
    issueDate: str
    transferDate: str
    motivoTraslado: str
    modalidadTransporte: str
    pesoBrutoTotal: str = "0.00"
    numeroBultos: str = "1"
    partidaDireccion: str
    partidaUbigeo: str = "150101"
    llegadaDireccion: str
    llegadaUbigeo: str = "150101"
    transportistaRuc: str
    transportistaRazonSocial: str
    conductorDni: str = ""
    conductorLicencia: str = ""
    placaVehiculo: str
    destinatarioRuc: str
    line_items: list[GuiaLineItemRequest] = Field(default_factory=list)


class GuiaRemisionPrintRequest(BaseModel):
    tenant_id: str
    direction: str = Field(default="AR", pattern="^(AR|AP)$")
    serie: str
    number: str
    printer_name: str
    printer_ip: str | None = None


class GuiaRemisionPdfRequest(BaseModel):
    tenant_id: str
    direction: str = Field(default="AR", pattern="^(AR|AP)$")
    serie: str
    number: str

def build_uow_factory():
    return lambda tenant_id: UnitOfWork(AsyncSessionLocal, tenant_id)

def build_hash_service():
    return LedgerHashService(settings.ledger_hmac_secret.encode())


def _safe_user_uuid(user_id: str | None) -> str | None:
    if not user_id:
        return None
    try:
        return str(UUID(user_id))
    except Exception:
        return None


def _split_series_number(q: str | None, series: str | None, number: str | None) -> tuple[str, str]:
    if series and number:
        return series.strip().upper(), number.strip()
    if q and "-" in q:
        left, right = q.strip().split("-", 1)
        return left.upper(), right
    raise HTTPException(status_code=422, detail="Ingrese Serie-Numero, por ejemplo F001-8422")


def _third_day_next_month(issue_date):
    from datetime import date

    year = issue_date.year + (1 if issue_date.month == 12 else 0)
    month = 1 if issue_date.month == 12 else issue_date.month + 1
    return date(year, month, 3)


def _document_to_old_payload(document: FinancialDocument) -> dict:
    metadata = document.metadata_json or {}
    return {
        "id": str(document.id),
        "direction": document.direction,
        "document_type": document.document_type,
        "series": document.series,
        "number": document.number,
        "issue_date": document.issue_date.isoformat(),
        "currency": document.currency,
        "taxable_amount": str(document.taxable_amount),
        "tax_amount": str(document.tax_amount),
        "total_amount": str(document.total_amount),
        "total": str(document.total_amount),
        "partner_ruc": metadata.get("customer_ruc") or metadata.get("supplier_ruc"),
        "customer_ruc": metadata.get("customer_ruc"),
        "supplier_ruc": metadata.get("supplier_ruc"),
        "metadata": metadata,
    }


def _guard() -> ExpertAccountingGuard:
    return ExpertAccountingGuard(
        SunatRealtimeVerifier(
            ruc_lookup_url=settings.sunat_ruc_lookup_url,
            cpe_lookup_url=settings.sunat_cpe_lookup_url,
            token=settings.sunat_lookup_token,
            timeout_seconds=settings.sunat_realtime_timeout_seconds,
        ),
        sunat_enabled=settings.sunat_realtime_guard_enabled,
        block_on_unavailable=settings.sunat_guard_block_on_unavailable,
    )


def _parse_int_safe(value: str) -> int | None:
    try:
        return int(value)
    except Exception:
        return None


def _next_guide_number(existing_numbers: list[str]) -> str:
    max_number = 0
    for value in existing_numbers:
        parsed = _parse_int_safe((value or "").strip())
        if parsed is not None and parsed > max_number:
            max_number = parsed
    return str(max_number + 1).zfill(8)


def _build_guide_pdf_bytes(document: FinancialDocument) -> bytes:
    metadata = document.metadata_json or {}
    styles = getSampleStyleSheet()
    buffer = BytesIO()
    pdf = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
    )

    story = []
    story.append(Paragraph("GUIA DE REMISION REMITENTE", styles["Title"]))
    story.append(Spacer(1, 4 * mm))

    header_data = [
        ["Serie-Numero", f"{document.series}-{document.number}", "Tipo", "09"],
        ["Documento origen", metadata.get("source_document", ""), "Fecha emision", document.issue_date.isoformat()],
        ["Fecha traslado", metadata.get("transferDate", ""), "Motivo", metadata.get("motivoTraslado", "")],
        ["Modalidad", metadata.get("modalidadTransporte", ""), "Destinatario RUC", metadata.get("destinatarioRuc", "")],
        ["Partida", metadata.get("partidaDireccion", ""), "Ubigeo", metadata.get("partidaUbigeo", "")],
        ["Llegada", metadata.get("llegadaDireccion", ""), "Ubigeo", metadata.get("llegadaUbigeo", "")],
        ["Transportista", metadata.get("transportistaRazonSocial", ""), "RUC", metadata.get("transportistaRuc", "")],
        ["Placa", metadata.get("placaVehiculo", ""), "Licencia", metadata.get("conductorLicencia", "")],
        ["DNI Conductor", metadata.get("conductorDni", ""), "Bultos", metadata.get("numeroBultos", "")],
    ]
    header_table = Table(header_data, colWidths=[35 * mm, 70 * mm, 30 * mm, 45 * mm])
    header_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 4 * mm))

    line_items = metadata.get("line_items") or []
    rows = [["Codigo", "Descripcion", "Unidad", "Cantidad"]]
    for item in line_items:
        rows.append([
            str(item.get("productCode", "")),
            str(item.get("description", "")),
            str(item.get("unit", "")),
            str(item.get("quantity", "")),
        ])

    detail_table = Table(rows, colWidths=[30 * mm, 110 * mm, 20 * mm, 20 * mm])
    detail_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (2, 1), (3, -1), "CENTER"),
            ]
        )
    )
    story.append(detail_table)

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Representacion impresa de la Guia de Remision Remitente (SUNAT)", styles["Italic"]))

    pdf.build(story)
    return buffer.getvalue()

@router.post("/journal", response_model=JournalEntryResponse)
async def post_journal(payload: JournalPostRequest, request: Request, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    data = payload.model_dump()
    data["trace_id"] = ctx["trace_id"]
    data["user_id"] = ctx["user_id"]
    data["ip_address"] = request.client.host if request.client else None
    data["user_agent"] = request.headers.get("user-agent")

    service = LedgerPostingService(build_uow_factory(), build_hash_service())
    try:
        entry = await service.post_journal(data)
    except ExpertValidationException as exc:
        raise HTTPException(status_code=422, detail={"message": str(exc), "checks": exc.checks}) from exc
    return JournalEntryResponse(
        id=str(entry.id),
        row_hash=entry.row_hash,
        previous_hash=entry.previous_hash,
        total_debit=str(entry.total_debit),
        total_credit=str(entry.total_credit),
    )

@router.post("/invoice", response_model=JournalEntryResponse)
async def post_invoice(payload: InvoicePostRequest, request: Request, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    data = payload.model_dump()
    data["trace_id"] = ctx["trace_id"]
    data["user_id"] = ctx["user_id"]
    data["ip_address"] = request.client.host if request.client else None
    data["user_agent"] = request.headers.get("user-agent")

    service = LedgerPostingService(build_uow_factory(), build_hash_service())
    try:
        entry = await service.post_invoice(data)
    except ExpertValidationException as exc:
        raise HTTPException(status_code=422, detail={"message": str(exc), "checks": exc.checks}) from exc
    return JournalEntryResponse(
        id=str(entry.id),
        row_hash=entry.row_hash,
        previous_hash=entry.previous_hash,
        total_debit=str(entry.total_debit),
        total_credit=str(entry.total_credit),
    )

@router.post("/purchase-invoice", response_model=JournalEntryResponse)
async def post_purchase_invoice(payload: PurchasePostRequest, request: Request, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    data = payload.model_dump()
    data["trace_id"] = ctx["trace_id"]
    data["user_id"] = ctx["user_id"]
    data["ip_address"] = request.client.host if request.client else None
    data["user_agent"] = request.headers.get("user-agent")

    service = LedgerPostingService(build_uow_factory(), build_hash_service())
    try:
        entry = await service.post_purchase_invoice(data)
    except ExpertValidationException as exc:
        raise HTTPException(status_code=422, detail={"message": str(exc), "checks": exc.checks}) from exc
    return JournalEntryResponse(
        id=str(entry.id),
        row_hash=entry.row_hash,
        previous_hash=entry.previous_hash,
        total_debit=str(entry.total_debit),
        total_credit=str(entry.total_credit),
    )

@router.get("/journal", response_model=list[JournalEntryListItem])
async def list_journal(year: int | None = None, month: int | None = None, limit: int = 100, offset: int = 0, ctx=Depends(get_current_context)):
    async with build_uow_factory()(ctx["tenant_id"]) as uow:
        from src.infrastructure.repositories.ledger_repository import LedgerRepository

        entries = await LedgerRepository(uow.session).list_entries_page(ctx["tenant_id"], year=year, month=month, limit=limit, offset=offset)
    period = f"{year}-{month:02d}" if year and month else str(year or "")
    return [
        JournalEntryListItem(
            id=str(entry.id),
            entry_date=entry.entry_date.isoformat(),
            period=period,
            description=entry.description,
            source_module=entry.source_module,
            currency=entry.currency,
            total_debit=str(entry.total_debit),
            total_credit=str(entry.total_credit),
            row_hash=entry.row_hash,
            previous_hash=entry.previous_hash,
        )
        for entry in entries
    ]


@router.get("/documents/lookup")
async def lookup_financial_document(
    direction: str = "AR",
    q: str | None = None,
    series: str | None = None,
    number: str | None = None,
    ctx=Depends(get_current_context),
):
    series_value, number_value = _split_series_number(q, series, number)
    direction_value = direction.upper()
    if direction_value not in {"AR", "AP"}:
        raise HTTPException(status_code=422, detail="direction debe ser AR o AP")

    async with build_uow_factory()(ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(FinancialDocument, JournalEntry)
            .outerjoin(JournalEntry, JournalEntry.id == FinancialDocument.journal_entry_id)
            .where(
                and_(
                    FinancialDocument.tenant_id == ctx["tenant_id"],
                    FinancialDocument.direction == direction_value,
                    FinancialDocument.series == series_value,
                    FinancialDocument.number == number_value,
                )
            )
        )
        row = result.first()
        if row is None:
            raise HTTPException(status_code=404, detail="Documento no encontrado")

        document, entry = row
        deadline = _third_day_next_month(document.issue_date)
        metadata = document.metadata_json or {}
        return {
            "found": True,
            "posted": bool(document.journal_entry_id),
            "direction": document.direction,
            "document": {
                "id": str(document.id),
                "document_type": document.document_type,
                "series": document.series,
                "number": document.number,
                "issue_date": document.issue_date.isoformat(),
                "currency": document.currency,
                "taxable_amount": str(document.taxable_amount),
                "tax_amount": str(document.tax_amount),
                "total_amount": str(document.total_amount),
                "balance_amount": str(document.balance_amount),
                "sunat_status": document.sunat_status,
                "cdr_status": document.cdr_status,
                "metadata_json": metadata,
                "partner_ruc": metadata.get("customer_ruc") or metadata.get("supplier_ruc"),
                "customer_ruc": metadata.get("customer_ruc"),
                "supplier_ruc": metadata.get("supplier_ruc"),
            },
            "entry": None if entry is None else {
                "id": str(entry.id),
                "entry_date": entry.entry_date.isoformat(),
                "status": entry.status,
                "source_module": entry.source_module,
                "row_hash": entry.row_hash,
                "description": entry.description,
            },
            "compliance": {
                "annulment_deadline": deadline.isoformat(),
                "annulment_status": "EN_PLAZO" if date.today() <= deadline else "VENCIDO",
                "annulment_rule": "Solo hasta el 3er dia calendario del mes siguiente segun politica de control configurada.",
            },
        }


@router.post("/documents/modification/validate")
async def validate_document_modification(payload: DocumentModificationRequest, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with build_uow_factory()(ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(FinancialDocument)
            .where(
                and_(
                    FinancialDocument.tenant_id == ctx["tenant_id"],
                    FinancialDocument.direction == payload.direction,
                    FinancialDocument.series == payload.series,
                    FinancialDocument.number == payload.number,
                )
            )
        )
        document = result.scalar_one_or_none()
        if document is None:
            raise HTTPException(status_code=404, detail="Documento no encontrado")

        period_result = await uow.session.execute(
            select(AccountingPeriod).where(
                AccountingPeriod.tenant_id == ctx["tenant_id"],
                AccountingPeriod.year == document.issue_date.year,
                AccountingPeriod.month == document.issue_date.month,
            )
        )
        period = period_result.scalar_one_or_none()
        periodo_declarado = payload.periodo_declarado or bool(period and (period.is_closed or period.status.upper() in {"CLOSED", "DECLARED"}))

        old_payload = _document_to_old_payload(document)
        new_payload = {**old_payload, **payload.datos_nuevos}
        evaluation = _guard().validar_modificacion_asiento(
            old_payload,
            new_payload,
            payload.justificacion,
            motivo=payload.motivo,
            periodo_declarado=periodo_declarado,
            usuario=ctx.get("user_id"),
        )

        audit = AuditLog(
            tenant_id=ctx["tenant_id"],
            trace_id=ctx["trace_id"],
            entity_type="FinancialDocument",
            entity_id=str(document.id),
            action="DOCUMENT_MODIFICATION_REQUEST",
            before_state=old_payload,
            after_state={
                "requested_changes": payload.datos_nuevos,
                "motivo": payload.motivo,
                "justificacion": payload.justificacion,
                "periodo_declarado": periodo_declarado,
                "criterio_ia": evaluation,
            },
            actor_user_id=_safe_user_uuid(ctx.get("user_id")),
            ip_address=None,
            user_agent=None,
        )
        uow.session.add(audit)

        if evaluation.get("credit_note_draft"):
            uow.session.add(
                OutboxEvent(
                    tenant_id=ctx["tenant_id"],
                    topic="sunat.credit_note.draft",
                    aggregate_type="FinancialDocument",
                    aggregate_id=str(document.id),
                    payload={
                        "financial_document_id": str(document.id),
                        "credit_note_draft": evaluation["credit_note_draft"],
                        "trace_id": ctx["trace_id"],
                    },
                    status="PENDING",
                    attempts=0,
                    max_attempts=3,
                )
            )

        await uow.commit()
        return {
            "document": f"{payload.series}-{payload.number}",
            "periodo_declarado": periodo_declarado,
            **evaluation,
        }


@router.post("/integrity/scan")
async def scan_integrity(ctx=Depends(get_current_context)):
    scanner = LedgerIntegrityScanner(build_uow_factory(), build_hash_service())
    alerts = await scanner.scan_tenant(ctx["tenant_id"], ctx["trace_id"])
    return {"alerts": len(alerts), "severity": "CRITICAL" if alerts else "OK"}


@router.get("/documents/printers/detect")
async def detect_printers(ctx=Depends(get_current_context)):
    return {
        "items": [
            {"name": "Xerox Phaser", "ip": "192.168.1.100"},
            {"name": "HP LaserJet Pro", "ip": "192.168.1.101"},
            {"name": "Epson WorkForce", "ip": "192.168.1.102"},
        ]
    }


@router.post("/documents/guide/save")
async def save_guia_remision(payload: GuiaRemisionRequest, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with build_uow_factory()(ctx["tenant_id"]) as uow:
        series = payload.serie.strip().upper()
        direction = payload.direction.upper()

        number = (payload.number or "").strip()
        if not number:
            result = await uow.session.execute(
                select(FinancialDocument.number).where(
                    and_(
                        FinancialDocument.tenant_id == ctx["tenant_id"],
                        FinancialDocument.direction == direction,
                        FinancialDocument.document_type == "09",
                        FinancialDocument.series == series,
                    )
                )
            )
            existing_numbers = [row[0] for row in result.all()]
            number = _next_guide_number(existing_numbers)

        existing = await uow.session.execute(
            select(FinancialDocument).where(
                and_(
                    FinancialDocument.tenant_id == ctx["tenant_id"],
                    FinancialDocument.direction == direction,
                    FinancialDocument.document_type == "09",
                    FinancialDocument.series == series,
                    FinancialDocument.number == number,
                )
            )
        )
        document = existing.scalar_one_or_none()

        issue_date = date.fromisoformat(payload.issueDate)
        metadata = {
            "source_document": payload.source_document,
            "transferDate": payload.transferDate,
            "motivoTraslado": payload.motivoTraslado,
            "modalidadTransporte": payload.modalidadTransporte,
            "pesoBrutoTotal": payload.pesoBrutoTotal,
            "numeroBultos": payload.numeroBultos,
            "partidaDireccion": payload.partidaDireccion,
            "partidaUbigeo": payload.partidaUbigeo,
            "llegadaDireccion": payload.llegadaDireccion,
            "llegadaUbigeo": payload.llegadaUbigeo,
            "transportistaRuc": payload.transportistaRuc,
            "transportistaRazonSocial": payload.transportistaRazonSocial,
            "conductorDni": payload.conductorDni,
            "conductorLicencia": payload.conductorLicencia,
            "placaVehiculo": payload.placaVehiculo,
            "destinatarioRuc": payload.destinatarioRuc,
            "line_items": [item.model_dump() for item in payload.line_items],
        }

        if document is None:
            document = FinancialDocument(
                id=uuid4(),
                tenant_id=ctx["tenant_id"],
                direction=direction,
                document_type="09",
                series=series,
                number=number,
                issue_date=issue_date,
                currency="PEN",
                taxable_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                exempt_amount=Decimal("0.00"),
                total_amount=Decimal("0.00"),
                balance_amount=Decimal("0.00"),
                detraccion_amount=Decimal("0.00"),
                percepcion_amount=Decimal("0.00"),
                retencion_amount=Decimal("0.00"),
                sunat_status="PENDING",
                metadata_json=metadata,
            )
            uow.session.add(document)
        else:
            document.issue_date = issue_date
            document.metadata_json = metadata

        await uow.commit()

        return {
            "saved": True,
            "series": series,
            "number": number,
            "document_type": "09",
            "guide_id": f"{series}-{number}",
        }


@router.post("/documents/guide/pdf")
async def guide_pdf(payload: GuiaRemisionPdfRequest, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with build_uow_factory()(ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(FinancialDocument).where(
                and_(
                    FinancialDocument.tenant_id == ctx["tenant_id"],
                    FinancialDocument.direction == payload.direction.upper(),
                    FinancialDocument.document_type == "09",
                    FinancialDocument.series == payload.serie,
                    FinancialDocument.number == payload.number,
                )
            )
        )
        document = result.scalar_one_or_none()
        if document is None:
            raise HTTPException(status_code=404, detail="Guia no encontrada")

        pdf_bytes = _build_guide_pdf_bytes(document)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename=guia-{document.series}-{document.number}.pdf"},
        )


@router.post("/documents/guide/print")
async def queue_guide_print(payload: GuiaRemisionPrintRequest, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with build_uow_factory()(ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(FinancialDocument).where(
                and_(
                    FinancialDocument.tenant_id == ctx["tenant_id"],
                    FinancialDocument.direction == payload.direction.upper(),
                    FinancialDocument.document_type == "09",
                    FinancialDocument.series == payload.serie,
                    FinancialDocument.number == payload.number,
                )
            )
        )
        document = result.scalar_one_or_none()
        if document is None:
            raise HTTPException(status_code=404, detail="Guia no encontrada")

        pdf_bytes = _build_guide_pdf_bytes(document)
        pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

        outbox = OutboxEvent(
            tenant_id=ctx["tenant_id"],
            topic="print.queue.guide",
            aggregate_type="FinancialDocument",
            aggregate_id=str(document.id),
            payload={
                "guide_id": f"{document.series}-{document.number}",
                "printer_name": payload.printer_name,
                "printer_ip": payload.printer_ip,
                "document_type": "09",
                "pdf_base64": pdf_b64,
                "trace_id": ctx["trace_id"],
            },
            status="PENDING",
            attempts=0,
            max_attempts=3,
        )
        uow.session.add(outbox)
        await uow.commit()

        return {
            "queued": True,
            "queue_topic": "print.queue.guide",
            "guide_id": f"{document.series}-{document.number}",
            "printer": payload.printer_name,
        }
