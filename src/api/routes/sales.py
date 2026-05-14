from __future__ import annotations

import tempfile
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from src.api.dependencies import get_current_context
from src.api.routes.ledger import build_hash_service, build_uow_factory
from src.application.services.ledger_posting_service import LedgerPostingService
from src.application.services.sales_orchestrator import SalesOrchestrator
from src.infrastructure.ai.vision_extractor import InvoiceVisionAI

router = APIRouter(prefix="/sales", tags=["Sales IA"])

_processed_refs: set[str] = set()


class ApiLedgerAdapter:
    async def exists(self, serie_numero: str) -> bool:
        return serie_numero in _processed_refs

    async def post_entry(self, asiento: dict) -> str:
        total_debe = sum(float(line.get("debe", 0)) for line in asiento["lines"])
        total_haber = sum(float(line.get("haber", 0)) for line in asiento["lines"])

        payload = {
            "tenant_id": asiento["tenant_id"],
            "year": int(asiento["date"][0:4]),
            "month": int(asiento["date"][5:7]),
            "description": asiento["glosa"],
            "source_module": asiento.get("source_module", "SALES_IA"),
            "source_id": f"sales-ia:{uuid4()}",
            "currency": "PEN",
            "lines": [
                {
                    "account_code": line["cuenta"],
                    "account_name": f"Cuenta {line['cuenta']}",
                    "debit": line.get("debe", 0),
                    "credit": line.get("haber", 0),
                    "cost_center": "LIM-COM",
                }
                for line in asiento["lines"]
            ],
            "trace_id": f"sales-ia-{uuid4()}",
            "user_id": "sales-ia",
            "ip_address": None,
            "user_agent": "sales-ia-orchestrator",
        }

        if round(total_debe, 2) != round(total_haber, 2):
            raise ValueError("Asiento generado por IA no cuadra")

        service = LedgerPostingService(build_uow_factory(), build_hash_service())
        entry = await service.post_journal(payload)
        _processed_refs.add(asiento["glosa"].replace("Venta IA: ", ""))
        return str(entry.id)


class InventoryAdapter:
    async def update_stock_from_invoice(self, raw_data: dict) -> None:
        return None


@router.post("/process-ia")
async def process_sale_with_ai(
    file: UploadFile | None = File(default=None),
    ctx=Depends(get_current_context),
):
    temp_path: Path | None = None

    try:
        if file is None:
            raise HTTPException(status_code=400, detail="Adjunta una imagen de factura para procesar con IA")

        suffix = Path(file.filename or "invoice.jpg").suffix or ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            temp_path = Path(tmp.name)

        orchestrator = SalesOrchestrator(InvoiceVisionAI(), ApiLedgerAdapter(), InventoryAdapter())
        return await orchestrator.process_client_upload(ctx["tenant_id"], str(temp_path))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)
