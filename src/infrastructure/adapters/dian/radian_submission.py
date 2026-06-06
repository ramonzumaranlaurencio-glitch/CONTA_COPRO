import io
import zipfile
from typing import Any


class RadianSubmissionService:
    """Minimal DIAN RADIAN registry generator for submission endpoints."""

    def generate_registro_txt(self, company_nit: str, period: str, operations: list[dict[str, Any]]) -> bytes:
        lines = [
            "RADIAN REGISTRO\n",
            "NIT|PERIOD|TYPE|NUMBER|TOTAL|CURRENCY|REFERENCE\n",
        ]

        for op in operations:
            operation_type = str(op.get("type", "UNKNOWN"))
            operation_number = str(op.get("number", op.get("invoice_number", "")))
            total_amount = str(op.get("total", op.get("amount", "0.00")))
            currency = str(op.get("currency", "COP"))
            reference = str(op.get("reference", op.get("notes", "")))
            lines.append("|".join([company_nit, period, operation_type, operation_number, total_amount, currency, reference]) + "\n")

        content = "".join(lines)
        filename = f"RADIAN_{company_nit}_{period}.txt"
        return self._zip_bytes(filename, content)

    def _zip_bytes(self, filename: str, body: str) -> bytes:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(filename, body.encode("utf-8"))
        return buffer.getvalue()
