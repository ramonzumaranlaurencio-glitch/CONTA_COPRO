from __future__ import annotations

from base64 import b64encode
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from src.api.dependencies import get_current_context
from src.application.services.books_service import BooksService
from src.application.services.financial_reporting_service import FinancialReportingService
from src.application.services.report_export_service import ReportExportService
from src.domain.models.accounting import SunatSubmission
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(prefix="/reports", tags=["Financial Reports"])
BOOK_PACKAGES: dict[str, dict] = {}


def reporting_service() -> FinancialReportingService:
    return FinancialReportingService(lambda tenant_id: UnitOfWork(AsyncSessionLocal, tenant_id))


def books_service() -> BooksService:
    return BooksService(lambda tenant_id: UnitOfWork(AsyncSessionLocal, tenant_id))


def export_service() -> ReportExportService:
    return ReportExportService()


class BooksGeneratePayload(BaseModel):
    year: int
    month: int


@router.get("/trial-balance")
async def trial_balance(year: int, month: int | None = None, company_id: str | None = None, ctx=Depends(get_current_context)):
    return await reporting_service().trial_balance(ctx["tenant_id"], year=year, month=month, company_id=company_id)


@router.get("/balance-sheet")
async def balance_sheet(year: int, month: int | None = None, company_id: str | None = None, ctx=Depends(get_current_context)):
    return await reporting_service().balance_sheet(ctx["tenant_id"], year=year, month=month, company_id=company_id)


@router.get("/income-statement")
async def income_statement(year: int, month: int | None = None, company_id: str | None = None, ctx=Depends(get_current_context)):
    return await reporting_service().income_statement(ctx["tenant_id"], year=year, month=month, company_id=company_id)


@router.get("/cash-flow")
async def cash_flow(year: int, month: int | None = None, company_id: str | None = None, ctx=Depends(get_current_context)):
    return await reporting_service().cash_flow(ctx["tenant_id"], year=year, month=month, company_id=company_id)


@router.get("/general-ledger/{account_code}")
async def general_ledger(account_code: str, year: int, month: int | None = None, limit: int = 500, ctx=Depends(get_current_context)):
    return await reporting_service().general_ledger(ctx["tenant_id"], account_code=account_code, year=year, month=month, limit=limit)


@router.get("/accounts-receivable/aging")
async def ar_aging(ctx=Depends(get_current_context)):
    return await reporting_service().aging(ctx["tenant_id"], direction="AR")


@router.get("/accounts-payable/aging")
async def ap_aging(ctx=Depends(get_current_context)):
    return await reporting_service().aging(ctx["tenant_id"], direction="AP")


@router.get("/financial-pack")
async def financial_pack(
    year: int,
    month: int | None = None,
    compare_year: int | None = None,
    compare_month: int | None = None,
    company_id: str | None = None,
    ctx=Depends(get_current_context),
):
    return await reporting_service().financial_pack(
        ctx["tenant_id"],
        year=year,
        month=month,
        compare_year=compare_year,
        compare_month=compare_month,
        company_id=company_id,
    )


@router.get("/financial-pack/xlsx")
async def financial_pack_xlsx(
    year: int,
    month: int | None = None,
    compare_year: int | None = None,
    compare_month: int | None = None,
    company_id: str | None = None,
    ctx=Depends(get_current_context),
):
    payload = await reporting_service().financial_pack(
        ctx["tenant_id"],
        year=year,
        month=month,
        compare_year=compare_year,
        compare_month=compare_month,
        company_id=company_id,
    )
    content = export_service().build_financial_pack_xlsx(payload)
    return {
        "filename": f"financial-pack-{payload['period']}.xlsx",
        "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content_base64": b64encode(content).decode("ascii"),
    }


@router.get("/financial-pack/pdf")
async def financial_pack_pdf(
    year: int,
    month: int | None = None,
    compare_year: int | None = None,
    compare_month: int | None = None,
    company_id: str | None = None,
    ctx=Depends(get_current_context),
):
    payload = await reporting_service().financial_pack(
        ctx["tenant_id"],
        year=year,
        month=month,
        compare_year=compare_year,
        compare_month=compare_month,
        company_id=company_id,
    )
    content = export_service().build_financial_pack_pdf(payload)
    return {
        "filename": f"financial-pack-{payload['period']}.pdf",
        "mime_type": "application/pdf",
        "content_base64": b64encode(content).decode("ascii"),
    }


@router.get("/books/status")
async def books_status(year: int, month: int, ctx=Depends(get_current_context)):
    return await books_service().period_status(ctx["tenant_id"], year=year, month=month)


@router.post("/books/generate")
async def books_generate(payload: BooksGeneratePayload, ctx=Depends(get_current_context)):
    package = await books_service().generate_books(ctx["tenant_id"], year=payload.year, month=payload.month)
    period = f"{payload.year}-{payload.month:02d}"
    latest_version = 0
    for item in BOOK_PACKAGES.values():
        if item["tenant_id"] == ctx["tenant_id"] and item["period"] == period:
            latest_version = max(latest_version, int(item.get("version", 1)))
    package_id = str(uuid4())
    filename = f"libros_{payload.year}_{payload.month:02d}.zip"
    BOOK_PACKAGES[package_id] = {
        "tenant_id": ctx["tenant_id"],
        "created_at": datetime.now(timezone.utc),
        "filename": filename,
        "zip_base64": b64encode(package.zip_bytes).decode("ascii"),
        "files": [{"filename": name, "size": len(content.encode("utf-8"))} for name, content in package.files.items()],
        "period": period,
        "version": latest_version + 1,
        "status": "GENERATED",
        "submitted_submission_id": None,
    }

    # Keep memory bounded for local runtime usage.
    expires_before = datetime.now(timezone.utc) - timedelta(hours=6)
    for key in list(BOOK_PACKAGES.keys()):
        if BOOK_PACKAGES[key]["created_at"] < expires_before:
            del BOOK_PACKAGES[key]

    return {
        "package_id": package_id,
        "period": period,
        "version": BOOK_PACKAGES[package_id]["version"],
        "status": BOOK_PACKAGES[package_id]["status"],
        "filename": filename,
        "files": BOOK_PACKAGES[package_id]["files"],
        "download": {
            "filename": filename,
            "content_base64": BOOK_PACKAGES[package_id]["zip_base64"],
        },
    }


@router.get("/books/download/{package_id}")
async def books_download(package_id: str, ctx=Depends(get_current_context)):
    package = BOOK_PACKAGES.get(package_id)
    if not package or package["tenant_id"] != ctx["tenant_id"]:
        raise HTTPException(status_code=404, detail="Package not found")

    return {
        "package_id": package_id,
        "period": package["period"],
        "version": package["version"],
        "status": package["status"],
        "filename": package["filename"],
        "content_base64": package["zip_base64"],
        "generated_at": package["created_at"].isoformat(),
    }


@router.get("/books/packages")
async def books_packages(period: str | None = None, ctx=Depends(get_current_context)):
    rows = []
    for package_id, pkg in BOOK_PACKAGES.items():
        if pkg["tenant_id"] != ctx["tenant_id"]:
            continue
        if period and pkg["period"] != period:
            continue
        rows.append(
            {
                "package_id": package_id,
                "period": pkg["period"],
                "version": pkg["version"],
                "status": pkg["status"],
                "filename": pkg["filename"],
                "generated_at": pkg["created_at"].isoformat(),
                "files": pkg["files"],
                "submitted_submission_id": pkg.get("submitted_submission_id"),
            }
        )
    rows.sort(key=lambda item: (item["period"], item["version"]), reverse=True)
    return rows


@router.post("/books/packages/{package_id}/submit-sunat")
async def books_submit_sunat(package_id: str, ctx=Depends(get_current_context)):
    package = BOOK_PACKAGES.get(package_id)
    if not package or package["tenant_id"] != ctx["tenant_id"]:
        raise HTTPException(status_code=404, detail="Package not found")

    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        submission = SunatSubmission(
            tenant_id=ctx["tenant_id"],
            submission_type="BOOKS_PACKAGE",
            endpoint_type="SUNAT",
            status="QUEUED",
            ticket=package_id,
            xml_hash=None,
            raw_response={"period": package["period"], "version": package["version"], "filename": package["filename"]},
        )
        uow.session.add(submission)
        await uow.commit()

    package["status"] = "SUBMITTED"
    package["submitted_submission_id"] = str(submission.id)
    return {
        "package_id": package_id,
        "status": package["status"],
        "submission_id": str(submission.id),
    }
