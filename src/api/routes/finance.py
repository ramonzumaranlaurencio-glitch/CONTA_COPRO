from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from src.api.dependencies import require_roles
from src.application.services.treasury_service import TreasuryService
from src.api.routes.ledger import build_hash_service, build_uow_factory
from src.application.services.ledger_posting_service import LedgerPostingService
from src.domain.models.accounting import FinancialDocument, TreasuryMovement
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(prefix="/finance", tags=["Core Finance"])


class ProvisionRequest(BaseModel):
    tenant_id: str
    company_id: str | None = None
    year: int
    month: int
    amount: Decimal
    description: str
    debit_account: str
    credit_account: str
    cost_center: str | None = None


class DepreciationRequest(BaseModel):
    tenant_id: str
    company_id: str | None = None
    year: int
    month: int
    amount: Decimal
    asset_code: str
    expense_account: str = "681"
    accumulated_account: str = "391"
    cost_center: str | None = None


class FxDifferenceRequest(BaseModel):
    tenant_id: str
    company_id: str | None = None
    year: int
    month: int
    amount: Decimal
    source_account: str
    gain: bool
    partner_ruc: str | None = None
    document_series: str | None = None
    document_number: str | None = None


class AnnualCloseRequest(BaseModel):
    tenant_id: str
    company_id: str | None = None
    fiscal_year: int
    profit_or_loss: Decimal
    retained_earnings_account: str = "591"
    result_account: str = "891"


class ArPaymentRequest(BaseModel):
    tenant_id: str
    series: str
    number: str
    amount: Decimal
    treasury_account_id: str
    reference: str | None = None


class ApPaymentRequest(BaseModel):
    tenant_id: str
    series: str
    number: str
    amount: Decimal
    treasury_account_id: str
    reference: str | None = None


class TreasuryReconcileRequest(BaseModel):
    tenant_id: str
    movement_ids: list[str]


class TreasuryStatementImportRequest(BaseModel):
    tenant_id: str
    treasury_account_id: str
    csv_content: str
    default_currency: str = "COP"


class TreasuryAutoMatchRequest(BaseModel):
    tenant_id: str
    limit: int = 200


async def _post(payload: dict, request: Request, ctx: dict):
    if payload["tenant_id"] != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    payload["trace_id"] = ctx["trace_id"]
    payload["user_id"] = ctx["user_id"]
    payload["ip_address"] = request.client.host if request.client else None
    payload["user_agent"] = request.headers.get("user-agent")
    entry = await LedgerPostingService(build_uow_factory(), build_hash_service()).post_journal(payload)
    return {
        "entry_id": str(entry.id),
        "row_hash": entry.row_hash,
        "previous_hash": entry.previous_hash,
        "total_debit": str(entry.total_debit),
        "total_credit": str(entry.total_credit),
    }


@router.post("/provisions")
async def post_provision(payload: ProvisionRequest, request: Request, ctx=Depends(require_roles("ADMIN", "CONTROLLER", "ACCOUNTANT"))):
    return await _post({
        **payload.model_dump(),
        "description": payload.description,
        "source_module": "PROVISIONS",
        "source_id": f"provision:{payload.year}-{payload.month}:{payload.description}",
        "currency": "COP",
        "lines": [
            {"account_code": payload.debit_account, "account_name": "Provision expense", "debit": payload.amount, "credit": Decimal("0.00"), "cost_center": payload.cost_center},
            {"account_code": payload.credit_account, "account_name": "Provision liability", "debit": Decimal("0.00"), "credit": payload.amount, "cost_center": payload.cost_center},
        ],
    }, request, ctx)


@router.post("/fixed-assets/depreciation")
async def post_depreciation(payload: DepreciationRequest, request: Request, ctx=Depends(require_roles("ADMIN", "CONTROLLER", "ACCOUNTANT"))):
    return await _post({
        **payload.model_dump(),
        "description": f"Depreciacion activo {payload.asset_code}",
        "source_module": "FIXED_ASSETS",
        "source_id": f"depreciation:{payload.asset_code}:{payload.year}-{payload.month}",
        "currency": "COP",
        "lines": [
            {"account_code": payload.expense_account, "account_name": "Depreciation expense", "debit": payload.amount, "credit": Decimal("0.00"), "cost_center": payload.cost_center},
            {"account_code": payload.accumulated_account, "account_name": "Accumulated depreciation", "debit": Decimal("0.00"), "credit": payload.amount, "cost_center": payload.cost_center},
        ],
    }, request, ctx)


@router.post("/currency/fx-difference")
async def post_fx_difference(payload: FxDifferenceRequest, request: Request, ctx=Depends(require_roles("ADMIN", "CONTROLLER", "ACCOUNTANT", "TREASURY"))):
    result_account = "776" if payload.gain else "676"
    lines = [
        {"account_code": payload.source_account, "account_name": "Foreign currency source", "debit": payload.amount if payload.gain else Decimal("0.00"), "credit": Decimal("0.00") if payload.gain else payload.amount, "partner_ruc": payload.partner_ruc, "document_series": payload.document_series, "document_number": payload.document_number},
        {"account_code": result_account, "account_name": "FX gain" if payload.gain else "FX loss", "debit": Decimal("0.00") if payload.gain else payload.amount, "credit": payload.amount if payload.gain else Decimal("0.00"), "partner_ruc": payload.partner_ruc, "document_series": payload.document_series, "document_number": payload.document_number},
    ]
    return await _post({
        **payload.model_dump(),
        "description": "Diferencia de cambio ganancia" if payload.gain else "Diferencia de cambio perdida",
        "source_module": "FX_REVALUATION",
        "source_id": f"fx:{payload.source_account}:{payload.year}-{payload.month}",
        "currency": "COP",
        "lines": lines,
    }, request, ctx)


@router.post("/annual-close")
async def post_annual_close(payload: AnnualCloseRequest, request: Request, ctx=Depends(require_roles("ADMIN", "CONTROLLER"))):
    amount = abs(payload.profit_or_loss)
    profit = payload.profit_or_loss >= 0
    lines = [
        {"account_code": payload.result_account, "account_name": "Resultado del ejercicio", "debit": amount if profit else Decimal("0.00"), "credit": Decimal("0.00") if profit else amount},
        {"account_code": payload.retained_earnings_account, "account_name": "Resultados acumulados", "debit": Decimal("0.00") if profit else amount, "credit": amount if profit else Decimal("0.00")},
    ]
    return await _post({
        "tenant_id": payload.tenant_id,
        "company_id": payload.company_id,
        "year": payload.fiscal_year,
        "month": 12,
        "description": f"Cierre anual {payload.fiscal_year}",
        "source_module": "ANNUAL_CLOSE",
        "source_id": f"annual-close:{payload.fiscal_year}",
        "currency": "COP",
        "lines": lines,
    }, request, ctx)


@router.post("/accounts-receivable/apply-payment")
async def apply_ar_payment(payload: ArPaymentRequest, ctx=Depends(require_roles("ADMIN", "TREASURY", "ACCOUNTANT"))):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    if payload.amount <= 0:
        raise HTTPException(status_code=422, detail="El monto debe ser mayor a cero")

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        from sqlalchemy import select

        result = await uow.session.execute(
            select(FinancialDocument).where(
                FinancialDocument.tenant_id == payload.tenant_id,
                FinancialDocument.direction == "AR",
                FinancialDocument.series == payload.series,
                FinancialDocument.number == payload.number,
            )
        )
        document = result.scalar_one_or_none()
        if document is None:
            raise HTTPException(status_code=404, detail="Documento AR no encontrado")
        if Decimal(str(document.balance_amount)) < payload.amount:
            raise HTTPException(status_code=422, detail="Monto excede saldo del documento")

        document.balance_amount = Decimal(str(document.balance_amount)) - payload.amount
        movement = TreasuryMovement(
            id=uuid4(),
            tenant_id=payload.tenant_id,
            company_id=document.company_id,
            treasury_account_id=payload.treasury_account_id,
            movement_date=document.issue_date,
            movement_type="RECEIPT",
            amount=payload.amount,
            currency=document.currency,
            reference=payload.reference or f"Cobranza {payload.series}-{payload.number}",
            financial_document_id=document.id,
            journal_entry_id=document.journal_entry_id,
            reconciliation_status="OPEN",
        )
        uow.session.add(movement)
        await uow.commit()

        return {
            "document": f"{payload.series}-{payload.number}",
            "balance_amount": str(document.balance_amount),
            "movement_id": str(movement.id),
            "movement_type": movement.movement_type,
        }


@router.post("/accounts-payable/apply-payment")
async def apply_ap_payment(payload: ApPaymentRequest, ctx=Depends(require_roles("ADMIN", "TREASURY", "ACCOUNTANT"))):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    if payload.amount <= 0:
        raise HTTPException(status_code=422, detail="El monto debe ser mayor a cero")

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        from sqlalchemy import select

        result = await uow.session.execute(
            select(FinancialDocument).where(
                FinancialDocument.tenant_id == payload.tenant_id,
                FinancialDocument.direction == "AP",
                FinancialDocument.series == payload.series,
                FinancialDocument.number == payload.number,
            )
        )
        document = result.scalar_one_or_none()
        if document is None:
            raise HTTPException(status_code=404, detail="Documento AP no encontrado")
        if Decimal(str(document.balance_amount)) < payload.amount:
            raise HTTPException(status_code=422, detail="Monto excede saldo del documento")

        document.balance_amount = Decimal(str(document.balance_amount)) - payload.amount
        movement = TreasuryMovement(
            id=uuid4(),
            tenant_id=payload.tenant_id,
            company_id=document.company_id,
            treasury_account_id=payload.treasury_account_id,
            movement_date=document.issue_date,
            movement_type="PAYMENT",
            amount=payload.amount,
            currency=document.currency,
            reference=payload.reference or f"Pago {payload.series}-{payload.number}",
            financial_document_id=document.id,
            journal_entry_id=document.journal_entry_id,
            reconciliation_status="OPEN",
        )
        uow.session.add(movement)
        await uow.commit()

        return {
            "document": f"{payload.series}-{payload.number}",
            "balance_amount": str(document.balance_amount),
            "movement_id": str(movement.id),
            "movement_type": movement.movement_type,
        }


@router.post("/treasury/reconcile")
async def reconcile_treasury(payload: TreasuryReconcileRequest, ctx=Depends(require_roles("ADMIN", "TREASURY", "ACCOUNTANT"))):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        from sqlalchemy import select

        result = await uow.session.execute(
            select(TreasuryMovement).where(
                TreasuryMovement.tenant_id == payload.tenant_id,
                TreasuryMovement.id.in_(payload.movement_ids),
            )
        )
        movements = list(result.scalars().all())
        for movement in movements:
            movement.reconciliation_status = "RECONCILED"
        await uow.commit()

        return {"reconciled": len(movements), "movement_ids": [str(m.id) for m in movements]}


@router.post("/treasury/import-statement")
async def import_statement(payload: TreasuryStatementImportRequest, ctx=Depends(require_roles("ADMIN", "TREASURY", "ACCOUNTANT"))):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    service = TreasuryService(lambda tenant_id: UnitOfWork(AsyncSessionLocal, tenant_id))
    result = await service.import_statement_csv(
        payload.tenant_id,
        treasury_account_id=payload.treasury_account_id,
        csv_content=payload.csv_content,
        default_currency=payload.default_currency,
    )
    return {"imported": result.imported, "rejected": result.rejected}


@router.post("/treasury/auto-match")
async def auto_match_statement(payload: TreasuryAutoMatchRequest, ctx=Depends(require_roles("ADMIN", "TREASURY", "ACCOUNTANT"))):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    service = TreasuryService(lambda tenant_id: UnitOfWork(AsyncSessionLocal, tenant_id))
    result = await service.auto_match_open_items(payload.tenant_id, limit=payload.limit)
    return {"reviewed": result.reviewed, "matched": result.matched}
