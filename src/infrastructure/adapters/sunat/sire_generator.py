import io, zipfile
from decimal import Decimal

class SireGenerator:
    def generate_rvie_txt(self, company_ruc: str, period: str, operations: list[dict]) -> bytes:
        buffer = io.StringIO()
        for op in operations:
            fields = [
                company_ruc,
                period,
                op["correlative_id"],
                op["invoice_date"],
                op.get("due_date", ""),
                op["doc_type"],
                op["serie"],
                op["number"],
                op.get("customer_doc_type", "6"),
                op["customer_ruc"],
                op.get("customer_name", ""),
                self.money(op["base_imponible"]),
                self.money(op["igv"]),
                self.money(op.get("otros_cargos", 0)),
                self.money(op["total"]),
                op.get("currency", "PEN"),
                op.get("exchange_rate", ""),
                op.get("status", "1"),
            ]
            self.validate(fields)
            buffer.write("|".join(fields) + "|\r\n")
        filename = f"LE{company_ruc}{period}0014040011111.txt"
        return self.zip_file(filename, buffer.getvalue())

    @staticmethod
    def money(value) -> str:
        return format(Decimal(str(value)).quantize(Decimal("0.01")), "f")

    @staticmethod
    def validate(fields: list[str]):
        if len(fields) < 18:
            raise ValueError("RVIE requiere campos mínimos")
        if len(fields[0]) != 11:
            raise ValueError("RUC inválido")

    @staticmethod
    def zip_file(filename: str, content: str) -> bytes:
        zbuf = io.BytesIO()
        with zipfile.ZipFile(zbuf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr(filename, content)
        return zbuf.getvalue()
