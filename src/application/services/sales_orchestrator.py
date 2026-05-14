from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Protocol, Any


class LedgerPort(Protocol):
    async def exists(self, serie_numero: str) -> bool: ...
    async def post_entry(self, asiento: dict[str, Any]) -> str: ...


class InventoryPort(Protocol):
    async def update_stock_from_invoice(self, raw_data: dict[str, Any]) -> None: ...


class SalesOrchestrator:
    def __init__(self, ai_engine, ledger: LedgerPort, inventory: InventoryPort):
        self.ai = ai_engine
        self.ledger = ledger
        self.inventory = inventory

    async def process_client_upload(self, tenant_id: str, file_path: str):
        raw_data = self.ai.extract_data(file_path)

        serie_numero = raw_data.get("serie_numero")
        if not serie_numero:
            raise ValueError("No se pudo extraer serie y numero del comprobante")

        if await self.ledger.exists(serie_numero):
            raise Exception("Factura ya procesada anteriormente.")

        total = Decimal(str(raw_data.get("total") or "0"))
        if total <= 0:
            raise ValueError("No se pudo identificar el monto total de la factura")

        igv = (total * Decimal("0.1525")).quantize(Decimal("0.01"))
        subtotal = (total / Decimal("1.18")).quantize(Decimal("0.01"))

        asiento = {
            "tenant_id": tenant_id,
            "date": date.today().isoformat(),
            "glosa": f"Venta IA: {serie_numero}",
            "source_module": "SALES_IA",
            "lines": [
                {"cuenta": "1212", "debe": float(total), "haber": 0.0},
                {"cuenta": "4011", "debe": 0.0, "haber": float(igv)},
                {"cuenta": "7011", "debe": 0.0, "haber": float(subtotal)},
            ],
        }

        entry_id = await self.ledger.post_entry(asiento)
        await self.inventory.update_stock_from_invoice(raw_data)

        return {"status": "SUCCESS", "id": entry_id, "data": raw_data}
