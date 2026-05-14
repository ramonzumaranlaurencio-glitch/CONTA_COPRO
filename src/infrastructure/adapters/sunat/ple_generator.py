from __future__ import annotations

import io
import zipfile
from decimal import Decimal
from dataclasses import dataclass
from datetime import date


@dataclass
class PleLine51:
    account: str
    debit: Decimal
    credit: Decimal
    cost_center: str | None = None
    centro_costo_id: str | None = None
    currency: str = "PEN"
    doc_type: str | None = None
    doc_number: str | None = None
    doc_serie: str | None = None
    doc_num: str | None = None


@dataclass
class PleEntry51:
    id: str
    cuo: str
    correlative: str
    date: date
    description: str
    lines: list[PleLine51]


class PleGenerator:
    @staticmethod
    def generate_diario_5_1(company_ruc: str, period: str, entries: list[PleEntry51]) -> tuple[str, str]:
        """Genera el libro Diario 5.1 con formato de campos SUNAT."""
        filename = f"LE{company_ruc}{period}00050100001111.txt"
        output = io.StringIO()

        for entry in entries:
            for line in entry.lines:
                row = [
                    f"{period}00",
                    entry.cuo,
                    f"M{entry.correlative}",
                    line.account,
                    line.cost_center or "",
                    line.centro_costo_id or "",
                    line.currency,
                    line.doc_type or "00",
                    line.doc_number or "0",
                    line.doc_serie or "",
                    line.doc_num or "",
                    entry.date.strftime("%d/%m/%Y"),
                    entry.description[:200],
                    f"{line.debit:.2f}",
                    f"{line.credit:.2f}",
                    f"{entry.id}_ST",
                    "1",
                ]
                output.write("|".join(row) + "|\r\n")

        return filename, output.getvalue()

    def generate_daily_book(self, company_ruc: str, period: str, entries: list[dict]) -> bytes:
        rows = io.StringIO()
        for entry in entries:
            for index, line in enumerate(entry.get("lines", []), start=1):
                fields = [
                    period,
                    f"{entry['correlative']}-{index}",
                    str(entry.get("entry_date", "")),
                    line["account_code"],
                    line.get("cost_center", ""),
                    line.get("currency", entry.get("currency", "PEN")),
                    line.get("document_type", ""),
                    line.get("document_series", ""),
                    line.get("document_number", ""),
                    line.get("description", entry.get("description", "")),
                    self.money(line.get("debit", "0.00")),
                    self.money(line.get("credit", "0.00")),
                    "1",
                ]
                rows.write("|".join(fields) + "|\r\n")
        filename = f"LE{company_ruc}{period}00050100001111.txt"
        return self._zip(filename, rows.getvalue())

    def generate_general_ledger(self, company_ruc: str, period: str, lines: list[dict]) -> bytes:
        rows = io.StringIO()
        for line in lines:
            fields = [
                period,
                line["account_code"],
                line.get("account_name", ""),
                self.money(line.get("opening_debit", "0.00")),
                self.money(line.get("opening_credit", "0.00")),
                self.money(line.get("period_debit", "0.00")),
                self.money(line.get("period_credit", "0.00")),
                self.money(line.get("closing_debit", "0.00")),
                self.money(line.get("closing_credit", "0.00")),
                "1",
            ]
            rows.write("|".join(fields) + "|\r\n")
        filename = f"LE{company_ruc}{period}00060100001111.txt"
        return self._zip(filename, rows.getvalue())

    @staticmethod
    def money(value) -> str:
        return format(Decimal(str(value)).quantize(Decimal("0.00")), "f")

    @staticmethod
    def _zip(filename: str, content: str) -> bytes:
        zbuf = io.BytesIO()
        with zipfile.ZipFile(zbuf, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(filename, content)
        return zbuf.getvalue()
