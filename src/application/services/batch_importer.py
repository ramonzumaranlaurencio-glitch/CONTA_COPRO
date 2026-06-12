from __future__ import annotations

from typing import Any


class BatchAccountingImporter:
    def __init__(self, parser: Any, ledger_service: Any, tenant_repository: Any):
        self.parser = parser
        self.ledger_service = ledger_service
        self.tenant_repository = tenant_repository

    async def find_tenant_by_nit(self, nit: str):
        return await self.tenant_repository.find_by_ruc(nit)

    async def calculate_lines(self, data: dict) -> list[dict]:
        subtotal = data.get("subtotal", 0)
        iva = data.get("iva", 0)
        total = data.get("total", subtotal + iva)

        # Colombian chart of accounts
        # 6135 = Compras de material, suministros e insumos
        # 2408 = IVA por pagar (descontable)
        # 2705 = Cuentas por pagar proveedores
        return [
            {"account": "6135", "debit": subtotal, "credit": 0},
            {"account": "2408", "debit": iva, "credit": 0},
            {"account": "2705", "debit": 0, "credit": total},
        ]

    async def process_folder(self, uow_factory, xml_files: list[str]):
        summary = {"processed": 0, "errors": 0}

        for xml_file in xml_files:
            data = self.parser.parse_invoice(xml_file)

            tenant = await self.find_tenant_by_ruc(data["ruc_emisor"]) or await self.find_tenant_by_ruc(data["ruc_receptor"])

            if tenant:
                async with uow_factory(tenant.id) as uow:
                    await self.ledger_service.post_entry(uow, {
                        "date": data["fecha_emision"],
                        "description": f"Carga Masiva: {data['serie_correlativo']}",
                        "lines": await self.calculate_lines(data),
                    })
                    summary["processed"] += 1
            else:
                summary["errors"] += 1

        return summary
