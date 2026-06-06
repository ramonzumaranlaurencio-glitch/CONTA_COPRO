from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from src.api.dependencies import get_current_context, require_feature_dependency
from src.application.services.tax_compliance_service import TaxComplianceService
from src.config import settings
from src.domain.models.accounting import DeadLetterEvent, FinancialDocument, OutboxEvent, DianSubmission
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.adapters.dian.invoice_generator import InvoiceGenerator
from src.infrastructure.adapters.dian.radian_submission import RadianSubmissionService
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(
    prefix="/tax",
    tags=["DIAN Colombia Enterprise"],
    dependencies=[Depends(require_feature_dependency("dian"))],
)


class XmlPayload(BaseModel):
    document_type: str = "01"
    xml_raw: str


class CdrPayload(BaseModel):
    cdr_base64_or_xml: str


class RadianSubmissionPayload(BaseModel):
    company_nit: str
    period: str
    operations: list[dict]


class DianRegistroPayload(BaseModel):
    company_nit: str
    period: str
    entries: list[dict]


class DianAuditLogPayload(BaseModel):
    company_nit: str
    period: str
    lines: list[dict]


class DianSubmissionCreatePayload(BaseModel):
    financial_document_id: str | None = None
    submission_type: str = "INVOICE"
    endpoint_type: str = "DIAN"
    ticket: str | None = None
    xml_hash: str | None = None


class DianResponseUpdatePayload(BaseModel):
    status: str
    cud_code: str | None = None
    response_description: str | None = None
    raw_response: dict | None = None


def tax_service() -> TaxComplianceService:
    return TaxComplianceService(settings.dian_xsd_dir)


@router.get("/capabilities")
async def capabilities(ctx=Depends(get_current_context)):
    return {"tenant_id": ctx["tenant_id"], **tax_service().capability_matrix()}


@router.post("/ubl/invoice")
async def build_invoice_ubl(payload: dict, ctx=Depends(get_current_context)):
    payload["tenant_id"] = ctx["tenant_id"]
    if settings.dian_nit and "dian_nit" not in payload:
        payload["dian_nit"] = settings.dian_nit
    return tax_service().build_invoice_xml(payload)


@router.post("/ubl/credit-note")
async def build_credit_note_ubl(payload: dict, ctx=Depends(get_current_context)):
    payload["tenant_id"] = ctx["tenant_id"]
    return tax_service().build_note_xml(payload, note_type="credit")


@router.post("/ubl/debit-note")
async def build_debit_note_ubl(payload: dict, ctx=Depends(get_current_context)):
    payload["tenant_id"] = ctx["tenant_id"]
    return tax_service().build_note_xml(payload, note_type="debit")


@router.post("/ubl/validate")
async def validate_ubl(payload: XmlPayload, ctx=Depends(get_current_context)):
    return {"tenant_id": ctx["tenant_id"], **tax_service().validate_xml(payload.xml_raw, payload.document_type)}


@router.post("/cdr/parse")
async def parse_cdr(payload: CdrPayload, ctx=Depends(get_current_context)):
    return {"tenant_id": ctx["tenant_id"], **tax_service().parse_cdr(payload.cdr_base64_or_xml)}


@router.post("/radian/registro")
async def generate_radian_registro(payload: RadianSubmissionPayload, ctx=Depends(get_current_context)):
    """Genera registro electrónico para RADIAN (Resolución de la DIAN)."""
    service = RadianSubmissionService()
    content = service.generate_registro_txt(payload.company_nit, payload.period, payload.operations)
    return {
        "tenant_id": ctx["tenant_id"],
        "filename": f"RADIAN_{payload.company_nit}_{payload.period}.zip",
        "content_base64": __import__("base64").b64encode(content).decode("ascii"),
    }


@router.post("/audit-log/diario", dependencies=[Depends(require_feature_dependency("audit"))])
async def generate_audit_log_diario(payload: DianRegistroPayload, ctx=Depends(get_current_context)):
    """Genera libro diario para auditoría DIAN."""
    content = InvoiceGenerator().generate_audit_log_diario(payload.company_nit, payload.period, payload.entries)
    return {
        "tenant_id": ctx["tenant_id"],
        "filename": f"DIARIO_{payload.company_nit}_{payload.period}.txt",
        "content_base64": __import__("base64").b64encode(content).decode("ascii"),
    }


@router.post("/audit-log/mayor", dependencies=[Depends(require_feature_dependency("audit"))])
async def generate_audit_log_mayor(payload: DianAuditLogPayload, ctx=Depends(get_current_context)):
    """Genera libro mayor para auditoría DIAN."""
    content = InvoiceGenerator().generate_audit_log_mayor(payload.company_nit, payload.period, payload.lines)
    return {
        "tenant_id": ctx["tenant_id"],
        "filename": f"MAYOR_{payload.company_nit}_{payload.period}.txt",
        "content_base64": __import__("base64").b64encode(content).decode("ascii"),
    }


@router.post("/submissions")
async def create_submission(payload: DianSubmissionCreatePayload, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        submission = DianSubmission(
            tenant_id=ctx["tenant_id"],
            financial_document_id=payload.financial_document_id,
            submission_type=payload.submission_type,
            endpoint_type=payload.endpoint_type,
            status="PENDING",
            ticket=payload.ticket,
            xml_hash=payload.xml_hash,
        )
        uow.session.add(submission)

        if payload.financial_document_id:
            from sqlalchemy import select

            result = await uow.session.execute(
                select(FinancialDocument).where(
                    FinancialDocument.tenant_id == ctx["tenant_id"],
                    FinancialDocument.id == payload.financial_document_id,
                )
            )
            document = result.scalar_one_or_none()
            if document:
                document.dian_status = "QUEUED"

        await uow.commit()
        return {"id": str(submission.id), "status": submission.status}


@router.get("/submissions")
async def list_submissions(limit: int = 200, ctx=Depends(get_current_context)):
    from sqlalchemy import select

    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(DianSubmission)
            .where(DianSubmission.tenant_id == ctx["tenant_id"])
            .order_by(DianSubmission.created_at.desc())
            .limit(limit)
        )
        rows = list(result.scalars().all())
        return [
            {
                "id": str(row.id),
                "financial_document_id": str(row.financial_document_id) if row.financial_document_id else None,
                "submission_type": row.submission_type,
                "endpoint_type": row.endpoint_type,
                "status": row.status,
                "ticket": row.ticket,
                "cud_code": row.cud_code,
                "response_description": row.response_description,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]


@router.post("/submissions/{submission_id}/response")
async def update_submission_response(submission_id: str, payload: DianResponseUpdatePayload, ctx=Depends(get_current_context)):
    from sqlalchemy import select

    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(DianSubmission).where(
                DianSubmission.tenant_id == ctx["tenant_id"],
                DianSubmission.id == submission_id,
            )
        )
        submission = result.scalar_one_or_none()
        if submission is None:
            raise HTTPException(status_code=404, detail="Submission no encontrado")

        submission.status = payload.status
        submission.cud_code = payload.cud_code
        submission.response_description = payload.response_description
        submission.raw_response = payload.raw_response

        if submission.financial_document_id:
            doc_result = await uow.session.execute(
                select(FinancialDocument).where(
                    FinancialDocument.tenant_id == ctx["tenant_id"],
                    FinancialDocument.id == submission.financial_document_id,
                )
            )
            document = doc_result.scalar_one_or_none()
            if document:
                document.dian_response_status = payload.status
                document.dian_response_description = payload.response_description
                document.dian_status = "ACCEPTED" if payload.status.upper() == "ACCEPTED" else "REJECTED"

        await uow.commit()
        return {"id": str(submission.id), "status": submission.status, "cud_code": submission.cud_code}


@router.post("/submissions/{submission_id}/retry")
async def retry_submission(submission_id: str, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(DianSubmission).where(
                DianSubmission.tenant_id == ctx["tenant_id"],
                DianSubmission.id == submission_id,
            )
        )
        submission = result.scalar_one_or_none()
        if submission is None:
            raise HTTPException(status_code=404, detail="Submission no encontrado")

        submission.status = "RETRYING"
        outbox = OutboxEvent(
            tenant_id=ctx["tenant_id"],
            topic="dian.submission.retry",
            aggregate_type="dian_submission",
            aggregate_id=str(submission.id),
            payload={"submission_id": str(submission.id), "endpoint_type": submission.endpoint_type},
            status="PENDING",
            attempts=0,
            max_attempts=3,
        )
        uow.session.add(outbox)
        await uow.commit()

        return {"id": str(submission.id), "status": submission.status, "outbox_event_id": str(outbox.id)}


@router.post("/submissions/{submission_id}/reprocess")
async def reprocess_submission(submission_id: str, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(DianSubmission).where(
                DianSubmission.tenant_id == ctx["tenant_id"],
                DianSubmission.id == submission_id,
            )
        )
        submission = result.scalar_one_or_none()
        if submission is None:
            raise HTTPException(status_code=404, detail="Submission no encontrado")
        submission.status = "PENDING"
        await uow.commit()
        return {"id": str(submission.id), "status": submission.status}


@router.get("/ops/queue-status")
async def queue_status(ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        outbox_result = await uow.session.execute(
            select(OutboxEvent.status, func.count(OutboxEvent.id))
            .where(OutboxEvent.tenant_id == ctx["tenant_id"])
            .group_by(OutboxEvent.status)
        )
        submission_result = await uow.session.execute(
            select(DianSubmission.status, func.count(DianSubmission.id))
            .where(DianSubmission.tenant_id == ctx["tenant_id"])
            .group_by(DianSubmission.status)
        )
        dlq_result = await uow.session.execute(
            select(func.count(DeadLetterEvent.id)).where(DeadLetterEvent.tenant_id == ctx["tenant_id"])
        )

    return {
        "tenant_id": ctx["tenant_id"],
        "outbox": {row[0]: row[1] for row in outbox_result.all()},
        "submissions": {row[0]: row[1] for row in submission_result.all()},
        "dlq_total": int(dlq_result.scalar_one() or 0),
    }


@router.get("/ops/dlq")
async def dlq_events(limit: int = 50, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(DeadLetterEvent)
            .where(DeadLetterEvent.tenant_id == ctx["tenant_id"])
            .order_by(DeadLetterEvent.created_at.desc())
            .limit(limit)
        )
        rows = list(result.scalars().all())

    return [
        {
            "id": str(row.id),
            "topic": row.topic,
            "aggregate_id": row.aggregate_id,
            "reason": row.reason,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]
