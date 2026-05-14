from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from src.api.dependencies import get_current_context
from src.application.services.tax_compliance_service import TaxComplianceService
from src.config import settings
from src.domain.models.accounting import DeadLetterEvent, FinancialDocument, OutboxEvent, SunatSubmission
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.adapters.sunat.ple_generator import PleGenerator
from src.infrastructure.adapters.sunat.sire_generator import SireGenerator
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(prefix="/tax", tags=["SUNAT Enterprise"])


class XmlPayload(BaseModel):
    document_type: str = "01"
    xml_raw: str


class CdrPayload(BaseModel):
    cdr_base64_or_xml: str


class SirePayload(BaseModel):
    company_ruc: str
    period: str
    operations: list[dict]


class PleDailyPayload(BaseModel):
    company_ruc: str
    period: str
    entries: list[dict]


class PleLedgerPayload(BaseModel):
    company_ruc: str
    period: str
    lines: list[dict]


class SunatSubmissionCreatePayload(BaseModel):
    financial_document_id: str | None = None
    submission_type: str = "INVOICE"
    endpoint_type: str = "SUNAT"
    ticket: str | None = None
    xml_hash: str | None = None


class SunatCdrUpdatePayload(BaseModel):
    status: str
    cdr_code: str | None = None
    cdr_description: str | None = None
    raw_response: dict | None = None


def tax_service() -> TaxComplianceService:
    return TaxComplianceService(settings.sunat_xsd_dir)


@router.get("/capabilities")
async def capabilities(ctx=Depends(get_current_context)):
    return {"tenant_id": ctx["tenant_id"], **tax_service().capability_matrix()}


@router.post("/ubl/invoice")
async def build_invoice_ubl(payload: dict, ctx=Depends(get_current_context)):
    payload["tenant_id"] = ctx["tenant_id"]
    if settings.sunat_ruc and "sunat_ruc" not in payload:
        payload["sunat_ruc"] = settings.sunat_ruc
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


@router.post("/sire/rvie")
async def generate_sire_rvie(payload: SirePayload, ctx=Depends(get_current_context)):
    content = SireGenerator().generate_rvie_txt(payload.company_ruc, payload.period, payload.operations)
    return {
        "tenant_id": ctx["tenant_id"],
        "filename": f"LE{payload.company_ruc}{payload.period}0014040011111.zip",
        "content_base64": __import__("base64").b64encode(content).decode("ascii"),
    }


@router.post("/ple/daily-book")
async def generate_ple_daily_book(payload: PleDailyPayload, ctx=Depends(get_current_context)):
    content = PleGenerator().generate_daily_book(payload.company_ruc, payload.period, payload.entries)
    return {
        "tenant_id": ctx["tenant_id"],
        "filename": f"LE{payload.company_ruc}{payload.period}00050100001111.zip",
        "content_base64": __import__("base64").b64encode(content).decode("ascii"),
    }


@router.post("/ple/general-ledger")
async def generate_ple_general_ledger(payload: PleLedgerPayload, ctx=Depends(get_current_context)):
    content = PleGenerator().generate_general_ledger(payload.company_ruc, payload.period, payload.lines)
    return {
        "tenant_id": ctx["tenant_id"],
        "filename": f"LE{payload.company_ruc}{payload.period}00060100001111.zip",
        "content_base64": __import__("base64").b64encode(content).decode("ascii"),
    }


@router.post("/submissions")
async def create_submission(payload: SunatSubmissionCreatePayload, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        submission = SunatSubmission(
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
                document.sunat_status = "QUEUED"

        await uow.commit()
        return {"id": str(submission.id), "status": submission.status}


@router.get("/submissions")
async def list_submissions(limit: int = 200, ctx=Depends(get_current_context)):
    from sqlalchemy import select

    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(SunatSubmission)
            .where(SunatSubmission.tenant_id == ctx["tenant_id"])
            .order_by(SunatSubmission.created_at.desc())
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
                "cdr_code": row.cdr_code,
                "cdr_description": row.cdr_description,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]


@router.post("/submissions/{submission_id}/cdr")
async def update_submission_cdr(submission_id: str, payload: SunatCdrUpdatePayload, ctx=Depends(get_current_context)):
    from sqlalchemy import select

    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(SunatSubmission).where(
                SunatSubmission.tenant_id == ctx["tenant_id"],
                SunatSubmission.id == submission_id,
            )
        )
        submission = result.scalar_one_or_none()
        if submission is None:
            raise HTTPException(status_code=404, detail="Submission no encontrado")

        submission.status = payload.status
        submission.cdr_code = payload.cdr_code
        submission.cdr_description = payload.cdr_description
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
                document.cdr_status = payload.status
                document.cdr_description = payload.cdr_description
                document.sunat_status = "ACCEPTED" if payload.status.upper() == "ACCEPTED" else "REJECTED"

        await uow.commit()
        return {"id": str(submission.id), "status": submission.status, "cdr_code": submission.cdr_code}


@router.post("/submissions/{submission_id}/retry")
async def retry_submission(submission_id: str, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(SunatSubmission).where(
                SunatSubmission.tenant_id == ctx["tenant_id"],
                SunatSubmission.id == submission_id,
            )
        )
        submission = result.scalar_one_or_none()
        if submission is None:
            raise HTTPException(status_code=404, detail="Submission no encontrado")

        submission.status = "RETRYING"
        outbox = OutboxEvent(
            tenant_id=ctx["tenant_id"],
            topic="sunat.submission.retry",
            aggregate_type="sunat_submission",
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
            select(SunatSubmission).where(
                SunatSubmission.tenant_id == ctx["tenant_id"],
                SunatSubmission.id == submission_id,
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
            select(SunatSubmission.status, func.count(SunatSubmission.id))
            .where(SunatSubmission.tenant_id == ctx["tenant_id"])
            .group_by(SunatSubmission.status)
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
