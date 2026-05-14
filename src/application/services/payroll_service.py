from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from typing import Dict, Any, Optional
from src.domain.models.accounting import HrWorker, PayrollJournalEntry, PayrollJournalLine, PayrollProvision
from sqlalchemy.ext.asyncio import AsyncSession
import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

try:
    from weasyprint import HTML  # type: ignore
except ImportError:
    HTML = None  # type: ignore


class PayrollMasterCalculator:
    def __init__(self, uit: Decimal = Decimal("5150")):
        self.uit = uit

    def calcular_renta_quinta(self, trabajador: Any, remuneracion_mensual: Decimal) -> Decimal:
        proyeccion_anual = remuneracion_mensual * Decimal("14")
        base_imponible = proyeccion_anual - (Decimal("7") * self.uit)
        if base_imponible <= Decimal("0"):
            return Decimal("0.00")
        impuesto_anual = (base_imponible * Decimal("0.08")).quantize(Decimal("0.01"), ROUND_HALF_UP)
        return (impuesto_anual / Decimal("12")).quantize(Decimal("0.01"), ROUND_HALF_UP)

    def calcular_sctr(self, remuneracion_mensual: Decimal, riesgo: str = "BAJO") -> Decimal:
        tasas = {"BAJO": 0.0053, "MEDIO": 0.0125, "ALTO": 0.0155}
        tasa = Decimal(str(tasas.get(riesgo.upper(), 0.0053)))
        return (remuneracion_mensual * tasa).quantize(Decimal("0.01"), ROUND_HALF_UP)


class PayrollMasterEngine:
    """Motor de cálculo y automatización contable - Nivel Enterprise"""

    def __init__(self, tazas_afp: Optional[Dict[str, Decimal]] = None):
        self.calculator = PayrollMasterCalculator()
        self.tazas_afp = tazas_afp or {
            "aporte": Decimal("0.10"),
            "seguro": Decimal("0.0184"),
            "comision": Decimal("0.015"),
        }

    def procesar_cierre_mensual(self, trabajador: Any) -> Dict[str, Any]:
        sueldo = Decimal(str(trabajador.sueldo_pactado))
        asig_fam = Decimal("102.50") if getattr(trabajador, "tiene_hijos", False) else Decimal("0")
        base_imponible = sueldo + asig_fam

        if trabajador.tipo_seguro == "ONP":
            retencion = (base_imponible * Decimal("0.13")).quantize(Decimal("0.01"), ROUND_HALF_UP)
        else:
            tasa_total_afp = sum(self.tazas_afp.values())
            retencion = (base_imponible * tasa_total_afp).quantize(Decimal("0.01"), ROUND_HALF_UP)

        essalud = (base_imponible * Decimal("0.09")).quantize(Decimal("0.01"), ROUND_HALF_UP)
        riesgo = getattr(trabajador, "riesgo", "BAJO") or "BAJO"
        sctr = self.calculator.calcular_sctr(base_imponible, riesgo)
        renta_quinta = self.calculator.calcular_renta_quinta(trabajador, base_imponible)
        descuentos_totales = retencion + sctr + renta_quinta
        neto_pagar = base_imponible - descuentos_totales

        provisiones = {
            "cts": (base_imponible * Decimal("1.0833") / Decimal("12")).quantize(Decimal("0.01")),
            "gratificacion": (base_imponible / Decimal("6")).quantize(Decimal("0.01")),
            "vacaciones": (base_imponible / Decimal("12")).quantize(Decimal("0.01")),
        }

        asiento = self._construir_asiento(
            trabajador,
            base_imponible,
            essalud,
            retencion,
            sctr,
            renta_quinta,
            neto_pagar,
        )

        return {
            "boleta": {
                "ingresos": base_imponible,
                "descuentos": descuentos_totales,
                "neto": neto_pagar,
                "essalud": essalud,
                "sctr": sctr,
                "renta_quinta": renta_quinta,
                "retencion_pension": retencion,
            },
            "provisiones": provisiones,
            "asiento": asiento,
        }

    def _construir_asiento(
        self,
        trabajador: Any,
        base_imponible: Decimal,
        essalud: Decimal,
        retencion: Decimal,
        sctr: Decimal,
        renta_quinta: Decimal,
        neto: Decimal,
    ) -> Dict[str, Any]:
        items = [
            {"cuenta": "6211", "desc": "Sueldos", "monto": base_imponible, "tipo": "D"},
            {"cuenta": "6271", "desc": "EsSalud", "monto": essalud, "tipo": "D"},
        ]

        items.append({"cuenta": "4031", "desc": "EsSalud x Pagar", "monto": essalud, "tipo": "H"})
        items.append({"cuenta": "4032", "desc": "Retenciones Pensión x Pagar", "monto": retencion, "tipo": "H"})
        if sctr > Decimal("0.00"):
            items.append({"cuenta": "4034", "desc": "SCTR x Pagar", "monto": sctr, "tipo": "H"})
        if renta_quinta > Decimal("0.00"):
            items.append({"cuenta": "4035", "desc": "Renta Quinta x Pagar", "monto": renta_quinta, "tipo": "H"})
        items.append({"cuenta": "4111", "desc": "Sueldos x Pagar", "monto": neto, "tipo": "H"})

        return {
            "glosa": f"Planilla y Provisiones - {trabajador.dni} - {datetime.now().strftime('%m/%Y')}",
            "items": items,
        }


class DocumentService:
    @staticmethod
    def generar_boleta_pdf(data: Dict[str, Any]) -> str:
        filename = f"boleta_{data['dni']}_{data.get('periodo', datetime.now().strftime('%Y-%m'))}.pdf"
        if HTML is not None:
            html_content = f"""
            <html>
            <style>
                body {{ font-family: Helvetica, Arial, sans-serif; font-size: 12px; }}
                .header {{ text-align: center; background: #1a365d; color: white; padding: 12px; }}
                .section {{ margin-top: 16px; }}
                .table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
                .table th, .table td {{ border: 1px solid #333; padding: 8px; }}
                .total-row {{ background: #edf2f7; font-weight: bold; }}
            </style>
            <body>
                <div class="header"><h1>BOLETA DE PAGO</h1></div>
                <div class="section">
                    <p><b>Trabajador:</b> {data['nombres']} | <b>DNI:</b> {data['dni']}</p>
                    <p><b>Periodo:</b> {data.get('periodo', datetime.now().strftime('%B %Y'))}</p>
                </div>
                <table class="table">
                    <thead>
                        <tr><th>Concepto</th><th>Ingreso</th><th>Descuento</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>Sueldo Básico</td><td>S/ {data['ingresos']:.2f}</td><td>-</td></tr>
                        <tr><td>EsSalud</td><td>-</td><td>S/ {data['essalud']:.2f}</td></tr>
                        <tr><td>Pensión</td><td>-</td><td>S/ {data['retencion_pension']:.2f}</td></tr>
                        <tr><td>SCTR</td><td>-</td><td>S/ {data['sctr']:.2f}</td></tr>
                        <tr><td>Renta Quinta</td><td>-</td><td>S/ {data['renta_quinta']:.2f}</td></tr>
                        <tr class="total-row"><td>NETO A PAGAR</td><td colspan="2" style="text-align:right;">S/ {data['neto']:.2f}</td></tr>
                    </tbody>
                </table>
            </body>
            </html>
            """
            HTML(string=html_content).write_pdf(filename)
            return filename

        filepath = os.path.join("temp", filename)
        os.makedirs("temp", exist_ok=True)
        doc = SimpleDocTemplate(filepath, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = [Paragraph("BOLETA DE PAGO", styles["Title"]), Spacer(1, 12)]
        data_rows = [
            ["Empresa:", "CONTA PRO ENTERPRISE"],
            ["Trabajador:", f"{data['nombres']} {data['apellidos']}"],
            ["DNI:", data['dni']],
            ["Periodo:", data.get('periodo', datetime.now().strftime('%Y-%m'))],
        ]
        table = Table(data_rows)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.extend([table, Spacer(1, 12)])
        payment_data = [
            ["Concepto", "Ingreso", "Descuento"],
            ["Sueldo Básico", f"S/ {data['ingresos']:.2f}", ""],
            ["EsSalud", "", f"S/ {data['essalud']:.2f}"],
            ["Retención Pension", "", f"S/ {data['retencion_pension']:.2f}"],
            ["SCTR", "", f"S/ {data['sctr']:.2f}"],
            ["Renta Quinta", "", f"S/ {data['renta_quinta']:.2f}"],
            ["NETO A PAGAR", f"S/ {data['neto']:.2f}", ""],
        ]
        payment_table = Table(payment_data)
        payment_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.append(payment_table)
        doc.build(elements)
        return filepath


class PayrollService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.engine = PayrollMasterEngine()

    async def calcular_neto_y_provisiones(self, worker_id: str):
        worker = await self.db.get(HrWorker, worker_id)
        if not worker:
            raise ValueError("Trabajador no encontrado.")

        resultado = self.engine.procesar_cierre_mensual(worker)
        await self._persistir_asiento(worker, resultado["asiento"])
        await self._persistir_provisiones(worker, resultado["provisiones"])
        await self.db.commit()

        return {
            "status": "success",
            "neto": resultado["boleta"]["neto"],
            "detalles": resultado["boleta"],
        }

    async def generar_boleta_pago(self, worker_id: str, periodo: str = None):
        if periodo is None:
            periodo = datetime.now().strftime("%Y-%m")

        worker = await self.db.get(HrWorker, worker_id)
        if not worker:
            raise ValueError("Trabajador no encontrado.")

        resultado = self.engine.procesar_cierre_mensual(worker)
        boleta_data = {
            **resultado["boleta"],
            "nombres": worker.nombres,
            "apellidos": worker.apellidos,
            "dni": worker.dni,
            "periodo": periodo,
        }
        filepath = DocumentService.generar_boleta_pdf(boleta_data)
        worker.ruta_cv_pdf = filepath
        await self.db.commit()
        return {"status": "success", "boleta_path": filepath}

    async def ejecutar_flujo_contratacion_y_pago(self, worker_id: str, periodo: str | None = None):
        if periodo is None:
            periodo = datetime.now().strftime("%Y-%m")

        worker = await self.db.get(HrWorker, worker_id)
        if not worker:
            raise ValueError("Trabajador no encontrado.")

        resultado = self.engine.procesar_cierre_mensual(worker)
        if not self._validar_partida_doble(resultado["asiento"]):
            raise Exception("❌ Alerta de Auditoría: El asiento contable está descuadrado.")

        await self._persistir_asiento(worker, resultado["asiento"])
        await self._persistir_provisiones(worker, resultado["provisiones"], periodo)

        boleta_data = {
            **resultado["boleta"],
            "nombres": worker.nombres,
            "apellidos": worker.apellidos,
            "dni": worker.dni,
            "periodo": periodo,
        }
        filepath = DocumentService.generar_boleta_pdf(boleta_data)
        worker.ruta_cv_pdf = filepath
        await self.db.commit()

        return {
            "status": "success",
            "message": "Proceso completado: Contabilidad asentada y boleta generada.",
            "boleta_path": filepath,
        }

    async def cerrar_planilla_mes(self, periodo: str):
        from sqlalchemy import update

        stmt = update(PayrollProvision).where(
            PayrollProvision.periodo_mes == periodo,
            PayrollProvision.estado_pago == "PENDIENTE",
        ).values(estado_pago="PAGADO")

        result = await self.db.execute(stmt)
        await self.db.commit()
        return {"status": "success", "provisiones_actualizadas": result.rowcount}

    async def generar_archivo_telecredito(self, periodo: str):
        from sqlalchemy import select

        stmt = select(HrWorker).where(HrWorker.estado_laboral == "ACTIVO")
        result = await self.db.execute(stmt)
        workers = result.scalars().all()

        filename = f"telecredito_{periodo}.txt"
        filepath = os.path.join("temp", filename)
        os.makedirs("temp", exist_ok=True)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("HEADER|BCP|CONTA_PRO|2024-01-01\n")
            for worker in workers:
                if worker.cuenta_bancaria and worker.cci:
                    sueldo = Decimal(str(worker.sueldo_pactado))
                    descuento = (sueldo * Decimal("0.13")).quantize(Decimal("0.01"))
                    neto = sueldo - descuento
                    line = f"DETAIL|{worker.dni}|{worker.cuenta_bancaria}|{worker.cci}|{neto}|{worker.nombres} {worker.apellidos}\n"
                    f.write(line)
            f.write("TRAILER|TOTAL_REGISTROS\n")

        return {"status": "success", "archivo_path": filepath}

    async def generar_archivo_plame(self, periodo: str):
        from sqlalchemy import select

        filename = f"plame_{periodo}.txt"
        filepath = os.path.join("temp", filename)
        os.makedirs("temp", exist_ok=True)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("1|CONTA_PRO|RUC_EMPRESA|2024|01|01\n")
            stmt = select(HrWorker).where(HrWorker.estado_laboral == "ACTIVO")
            result = await self.db.execute(stmt)
            workers = result.scalars().all()
            for worker in workers:
                tipo_doc = "1"
                situacion = "1"
                tipo_trabajador = "1"
                regimen_pensionario = "1" if worker.tipo_seguro == "ONP" else "2"
                sueldo = Decimal(str(worker.sueldo_pactado))
                descuento_pension = (sueldo * Decimal("0.13")).quantize(Decimal("0.01")) if worker.tipo_seguro == "ONP" else (sueldo * Decimal("0.1334")).quantize(Decimal("0.01"))
                essalud = (sueldo * Decimal("0.09")).quantize(Decimal("0.01"))
                line = f"2|{tipo_doc}|{worker.dni}|{worker.apellidos}|{worker.nombres}|0|0|{situacion}|{tipo_trabajador}|{regimen_pensionario}|{sueldo}|{descuento_pension}|{essalud}|0|0|0|0\n"
                f.write(line)

        return {"status": "success", "plame_path": filepath}

    async def _persistir_asiento(self, worker: HrWorker, asiento: Dict[str, Any]):
        total_debe = sum(item["monto"] for item in asiento["items"] if item["tipo"] == "D")
        total_haber = sum(item["monto"] for item in asiento["items"] if item["tipo"] == "H")

        entry = PayrollJournalEntry(
            fecha_asiento=datetime.now().date(),
            glosa=asiento["glosa"],
            total_debe=total_debe,
            total_haber=total_haber,
            tipo_asiento="PLANILLA",
            tenant_id=worker.tenant_id,
        )
        self.db.add(entry)
        await self.db.flush()

        lineas = [
            PayrollJournalLine(
                asiento_id=entry.id,
                cuenta_contable=item["cuenta"],
                denominacion=item.get("desc"),
                monto=item["monto"],
                tipo_movimiento=item["tipo"],
                tenant_id=worker.tenant_id,
                company_id=worker.company_id,
            )
            for item in asiento["items"]
        ]
        self.db.add_all(lineas)

    async def _persistir_provisiones(self, worker: HrWorker, provisiones: Dict[str, Decimal], periodo: str | None = None):
        if periodo is None:
            periodo = datetime.now().strftime("%Y-%m")
        provision = PayrollProvision(
            trabajador_id=worker.id,
            periodo_mes=periodo,
            monto_cts=provisiones["cts"],
            monto_gratificacion=provisiones["gratificacion"],
            monto_vacaciones=provisiones["vacaciones"],
            tenant_id=worker.tenant_id,
            company_id=worker.company_id,
        )
        self.db.add(provision)

    def _validar_partida_doble(self, asiento: Dict[str, Any]) -> bool:
        total_debe = sum(item["monto"] for item in asiento["items"] if item["tipo"] == "D")
        total_haber = sum(item["monto"] for item in asiento["items"] if item["tipo"] == "H")
        return abs(total_debe - total_haber) <= Decimal("0.01")
