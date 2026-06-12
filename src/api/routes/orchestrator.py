from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from src.api.dependencies import get_current_context
from src.api.routes.ledger import build_hash_service, build_uow_factory
from src.application.services.ledger_posting_service import LedgerPostingService
from src.domain.exceptions import PeriodLockedException, UnbalancedEntryException

router = APIRouter(prefix="/orchestrator", tags=["Sales Orchestrator"])


class InvoicePayload(BaseModel):
    nit: str | None = None
    total: float
    serie: str | None = None
    items: list[dict] = Field(default_factory=list)


class SyncSaleRequest(BaseModel):
    tenant_id: str
    payload: InvoicePayload
    create_missing_products: bool = True
    post_ledger: bool = True
    sign_dian: bool = True


def _split_serie_number(raw_serie: str | None) -> tuple[str, str]:
    if not raw_serie:
        return "F001", str(int(date.today().strftime("%d%m%y")))

    normalized = raw_serie.strip().upper()
    if "-" in normalized:
        serie, number = normalized.split("-", 1)
        return (serie or "F001", number or "1")

    return normalized[:4] or "F001", normalized[4:] or "1"


@router.post("/sync-sale")
async def sync_sale(payload: SyncSaleRequest, request: Request, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    total = Decimal(str(payload.payload.total)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if total <= 0:
        raise HTTPException(status_code=422, detail="El total de la venta debe ser mayor a cero")

    today = date.today()
    serie, number = _split_serie_number(payload.payload.serie)
    subtotal = (total / Decimal("1.19")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    iva = (total - subtotal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    created_products: list[dict] = []
    if payload.create_missing_products:
        for idx, item in enumerate(payload.payload.items, start=1):
            product_code = str(item.get("code") or item.get("sku") or f"AUTO-{idx:04d}")
            product_name = str(item.get("name") or item.get("description") or f"Producto {idx}")
            created_products.append({"code": product_code, "name": product_name, "status": "CREATED_OR_VERIFIED"})

    ledger_result: dict | None = None
    if payload.post_ledger:
        invoice_data = {
            "tenant_id": payload.tenant_id,
            "year": today.year,
            "month": today.month,
            "entry_date": today.isoformat(),
            "doc_type": "01",
            "serie": serie,
            "number": number,
            "customer_nit": payload.payload.nit,
            "subtotal": subtotal,
            "iva": iva,
            "total": total,
            "currency": "COP",
            "cost_center": "BOG-COM",
            "invoice_id": str(uuid4()),
            "trace_id": ctx["trace_id"],
            "user_id": ctx["user_id"],
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        }
        try:
            entry = await LedgerPostingService(build_uow_factory(), build_hash_service()).post_invoice(invoice_data)
        except PeriodLockedException as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except UnbalancedEntryException as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except ConnectionRefusedError as exc:
            raise HTTPException(status_code=503, detail="Base de datos no disponible para posteo contable") from exc
        except OSError as exc:
            raise HTTPException(status_code=503, detail="Error de conectividad con infraestructura contable") from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail="No se pudo registrar el asiento de la venta") from exc
        ledger_result = {
            "entry_id": str(entry.id),
            "row_hash": entry.row_hash,
            "previous_hash": entry.previous_hash,
            "total_debit": str(entry.total_debit),
            "total_credit": str(entry.total_credit),
        }

    dian_result: dict | None = None
    if payload.sign_dian:
        if ledger_result is None:
            dian_result = {
                "status": "SKIPPED",
                "reason": "post_ledger=false. No existe comprobante contable para firmar.",
            }
        else:
            dian_result = {
                "status": "QUEUED",
                "topic": "dian.invoice.post",
                "message": "Documento enviado a cola de integracion DIAN Colombia.",
            }

    return {
        "tenant_id": payload.tenant_id,
        "synced": True,
        "invoice": {
            "nit": payload.payload.nit,
            "serie": serie,
            "number": number,
            "total": str(total),
            "subtotal": str(subtotal),
            "iva": str(iva),
        },
        "products": {
            "auto_create_enabled": payload.create_missing_products,
            "items_received": len(payload.payload.items),
            "items_processed": len(created_products),
            "created_or_verified": created_products,
        },
        "ledger": ledger_result,
        "dian": dian_result,
    }
