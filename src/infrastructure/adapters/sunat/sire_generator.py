import io
import zipfile
from decimal import Decimal


class PilaGenerator:
    """Genera el archivo PILA (Planilla Integrada de Liquidación de Aportes) — UGPP Colombia.
    Formato .txt pipe-delimitado para cargar en operadores PILA autorizados (SOI, Mi Planilla, Aportes En Línea, etc.)
    Vence el día 21 de cada mes. Referencia normativa: Decreto 1990/2016, UGPP Circular 001/2020.
    Reemplaza al generador SIRE/RVIE de Perú.
    """

    def generate_pila_txt(self, company_nit: str, period: str, workers: list[dict]) -> bytes:
        """
        Genera el archivo PILA para pago de aportes a seguridad social.

        Campos por trabajador:
        - nit_empresa, periodo (AAAAMM), tipo_cotizante (01=dependiente, 02=independiente, 12=aprendiz)
        - cedula_trabajador, nombre, salario_base
        - ibc (Ingreso Base de Cotización)
        - aporte_pension_empleado (4%), aporte_pension_empleador (12%)
        - aporte_salud_empleado (4%), aporte_salud_empleador (8.5%)
        - aporte_arl (0.348% a 6.96% según clase riesgo), aporte_ccf (4%)
        - sena (2% — exento si < 10 SMMLV), icbf (3% — exento si < 10 SMMLV)
        """
        buffer = io.StringIO()
        for w in workers:
            fields = [
                company_nit,
                period,
                w.get("tipo_cotizante", "01"),
                w["cedula"],
                w.get("nombre", ""),
                self.money(w.get("salario_base", 0)),
                self.money(w.get("ibc", w.get("salario_base", 0))),
                self.money(w.get("pension_empleado", 0)),
                self.money(w.get("pension_empleador", 0)),
                self.money(w.get("salud_empleado", 0)),
                self.money(w.get("salud_empleador", 0)),
                self.money(w.get("arl", 0)),
                self.money(w.get("ccf", 0)),
                self.money(w.get("sena", 0)),
                self.money(w.get("icbf", 0)),
                self.money(w.get("total_aportes", 0)),
                w.get("estado", "1"),
            ]
            self.validate(fields)
            buffer.write("|".join(fields) + "|\r\n")

        filename = f"PILA_{company_nit}_{period}.txt"
        return self.zip_file(filename, buffer.getvalue())

    def generate_exogena_txt(self, company_nit: str, year: str, operations: list[dict]) -> bytes:
        """
        Genera información exógena DIAN (Formato 1001 — pagos y retenciones).
        Referencia: Resolución DIAN 000098/2020.
        """
        buffer = io.StringIO()
        for op in operations:
            fields = [
                company_nit,
                year,
                op.get("concepto", ""),
                op.get("nit_tercero", ""),
                op.get("nombre_tercero", ""),
                self.money(op.get("valor_pagado", 0)),
                self.money(op.get("retefuente", 0)),
                self.money(op.get("reteiva", 0)),
                self.money(op.get("reteica", 0)),
                op.get("currency", "COP"),
                op.get("status", "1"),
            ]
            buffer.write("|".join(fields) + "|\r\n")

        filename = f"Exogena_{company_nit}_{year}.txt"
        return self.zip_file(filename, buffer.getvalue())

    @staticmethod
    def money(value) -> str:
        return format(Decimal(str(value)).quantize(Decimal("0.01")), "f")

    @staticmethod
    def validate(fields: list[str]):
        if len(fields) < 17:
            raise ValueError("PILA requiere mínimo 17 campos por trabajador")
        if not fields[3] or len(fields[3]) < 5:
            raise ValueError("Cédula inválida — debe tener entre 5 y 12 dígitos")

    @staticmethod
    def zip_file(filename: str, content: str) -> bytes:
        zbuf = io.BytesIO()
        with zipfile.ZipFile(zbuf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr(filename, content)
        return zbuf.getvalue()


# Alias backward-compat — código que importe SireGenerator sigue funcionando
SireGenerator = PilaGenerator
