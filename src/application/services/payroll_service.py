from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date
from typing import Dict, Any, Optional, List
import os
import io
import base64

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from src.domain.models.accounting import HrWorker, PayrollJournalEntry, PayrollJournalLine, PayrollProvision
from src.domain.services.payroll_calculator import ColombianPayrollCalculator, SMMLV, AUX_TRANSPORTE, UVT

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    REPORTLAB_OK = True
except ImportError:
    REPORTLAB_OK = False

try:
    from weasyprint import HTML as WeasyprintHTML
    WEASYPRINT_OK = True
except ImportError:
    WEASYPRINT_OK = False

# ─── PUC COLOMBIA — CUENTAS DE NÓMINA ────────────────────────────────────────
# Gastos de personal (Clase 5 — Grupo 51)
C_SUELDOS         = "510506"   # Sueldos y salarios ordinarios
C_HORAS_EXTRAS    = "510512"   # Horas extras y recargos (Art. 168 CST)
C_AUX_TRANSPORTE  = "510530"   # Subsidio de transporte (Ley 1/1963)
C_CESANTIAS_G     = "510518"   # Gasto provisión cesantías (Art. 249 CST)
C_INT_CESANTIAS_G = "510519"   # Gasto intereses cesantías (Art. 99 Ley 50/1990)
C_PRIMA_G         = "510521"   # Gasto provisión prima de servicios (Art. 306 CST)
C_VACACIONES_G    = "510527"   # Gasto provisión vacaciones (Art. 186 CST)
C_EPS_G           = "510522"   # Gasto EPS empleador 8.5% (Art. 204 Ley 100/1993)
C_AFP_G           = "510524"   # Gasto AFP empleador 12% (Art. 20 Ley 100/1993)
C_ARL_G           = "510523"   # Gasto ARL (Decreto 1607/2002)
C_CCF_G           = "510525"   # Gasto CCF 4% (Ley 21/1982)
C_SENA_G          = "510510"   # Gasto SENA 2% (Ley 21/1982)
C_ICBF_G          = "510515"   # Gasto ICBF 3% (Ley 21/1982)

# Pasivos por pagar (Clase 2)
C_AFP_P           = "2405"     # AFP pensiones por pagar (empleado + empleador) — pago PILA antes del 21
C_EPS_P           = "2406"     # EPS salud por pagar (empleado + empleador) — PILA
C_ARL_P           = "2407"     # ARL por pagar
C_FONDO_SOL_P     = "2408"     # Fondo solidaridad pensional empleado
C_CCF_P           = "2413"     # CCF por pagar
C_SENA_P          = "2414"     # SENA por pagar
C_ICBF_P          = "2415"     # ICBF por pagar
C_RETEFUENTE_P    = "2365"     # ReteFuente rentas laborales (Art. 383 ET) — DIAN
C_CESANTIAS_P     = "2610"     # Cesantías consolidadas (consignar fondo antes del 14/feb)
C_INT_CES_P       = "2615"     # Intereses cesantías por pagar al trabajador (enero)
C_PRIMA_P         = "2620"     # Prima de servicios por pagar (jun y dic)
C_VACACIONES_P    = "2625"     # Vacaciones consolidadas
C_NOMINAS_P       = "2370"     # Nóminas por pagar (neto empleado)
C_BANCOS          = "1110"     # Bancos — pago nómina


# ─── CUENTAS PARA SINCRONIZAR AL PUC ─────────────────────────────────────────
NOMINA_ACCOUNTS_PUC = [
    {"code": C_SUELDOS,         "name": "Sueldos y salarios",                   "class": "51", "statement": "PROFIT_LOSS",   "nature": "DEBIT",  "cc": True},
    {"code": C_HORAS_EXTRAS,    "name": "Horas extras y recargos",              "class": "51", "statement": "PROFIT_LOSS",   "nature": "DEBIT",  "cc": True},
    {"code": C_AUX_TRANSPORTE,  "name": "Subsidio de transporte",               "class": "51", "statement": "PROFIT_LOSS",   "nature": "DEBIT",  "cc": True},
    {"code": C_CESANTIAS_G,     "name": "Gasto provisión cesantías",            "class": "51", "statement": "PROFIT_LOSS",   "nature": "DEBIT",  "cc": True},
    {"code": C_INT_CESANTIAS_G, "name": "Gasto intereses sobre cesantías",      "class": "51", "statement": "PROFIT_LOSS",   "nature": "DEBIT",  "cc": True},
    {"code": C_PRIMA_G,         "name": "Gasto provisión prima de servicios",   "class": "51", "statement": "PROFIT_LOSS",   "nature": "DEBIT",  "cc": True},
    {"code": C_VACACIONES_G,    "name": "Gasto provisión vacaciones",           "class": "51", "statement": "PROFIT_LOSS",   "nature": "DEBIT",  "cc": True},
    {"code": C_EPS_G,           "name": "Gasto EPS empleador 8.5%",             "class": "51", "statement": "PROFIT_LOSS",   "nature": "DEBIT",  "cc": True},
    {"code": C_AFP_G,           "name": "Gasto AFP empleador 12%",              "class": "51", "statement": "PROFIT_LOSS",   "nature": "DEBIT",  "cc": True},
    {"code": C_ARL_G,           "name": "Gasto ARL empleador",                  "class": "51", "statement": "PROFIT_LOSS",   "nature": "DEBIT",  "cc": True},
    {"code": C_CCF_G,           "name": "Gasto CCF 4%",                         "class": "51", "statement": "PROFIT_LOSS",   "nature": "DEBIT",  "cc": True},
    {"code": C_SENA_G,          "name": "Gasto SENA 2%",                        "class": "51", "statement": "PROFIT_LOSS",   "nature": "DEBIT",  "cc": True},
    {"code": C_ICBF_G,          "name": "Gasto ICBF 3%",                        "class": "51", "statement": "PROFIT_LOSS",   "nature": "DEBIT",  "cc": True},
    {"code": C_AFP_P,           "name": "AFP pensiones por pagar",              "class": "24", "statement": "BALANCE_SHEET", "nature": "CREDIT", "cc": False},
    {"code": C_EPS_P,           "name": "EPS salud por pagar",                  "class": "24", "statement": "BALANCE_SHEET", "nature": "CREDIT", "cc": False},
    {"code": C_ARL_P,           "name": "ARL por pagar",                        "class": "24", "statement": "BALANCE_SHEET", "nature": "CREDIT", "cc": False},
    {"code": C_FONDO_SOL_P,     "name": "Fondo solidaridad pensional",          "class": "24", "statement": "BALANCE_SHEET", "nature": "CREDIT", "cc": False},
    {"code": C_CCF_P,           "name": "CCF por pagar",                        "class": "24", "statement": "BALANCE_SHEET", "nature": "CREDIT", "cc": False},
    {"code": C_SENA_P,          "name": "SENA por pagar",                       "class": "24", "statement": "BALANCE_SHEET", "nature": "CREDIT", "cc": False},
    {"code": C_ICBF_P,          "name": "ICBF por pagar",                       "class": "24", "statement": "BALANCE_SHEET", "nature": "CREDIT", "cc": False},
    {"code": C_RETEFUENTE_P,    "name": "ReteFuente rentas laborales",          "class": "23", "statement": "BALANCE_SHEET", "nature": "CREDIT", "cc": False},
    {"code": C_CESANTIAS_P,     "name": "Cesantías consolidadas",               "class": "26", "statement": "BALANCE_SHEET", "nature": "CREDIT", "cc": False},
    {"code": C_INT_CES_P,       "name": "Intereses sobre cesantías",            "class": "26", "statement": "BALANCE_SHEET", "nature": "CREDIT", "cc": False},
    {"code": C_PRIMA_P,         "name": "Prima de servicios por pagar",         "class": "26", "statement": "BALANCE_SHEET", "nature": "CREDIT", "cc": False},
    {"code": C_VACACIONES_P,    "name": "Vacaciones consolidadas",              "class": "26", "statement": "BALANCE_SHEET", "nature": "CREDIT", "cc": False},
    {"code": C_NOMINAS_P,       "name": "Nóminas por pagar",                    "class": "23", "statement": "BALANCE_SHEET", "nature": "CREDIT", "cc": False},
    {"code": C_BANCOS,          "name": "Bancos",                               "class": "11", "statement": "BALANCE_SHEET", "nature": "DEBIT",  "cc": False},
]


def _r(v: Decimal) -> Decimal:
    return Decimal(str(v)).quantize(Decimal("1"), ROUND_HALF_UP)


def _fmtCOP(v: Decimal) -> str:
    return f"$ {int(v):,}".replace(",", ".")


class ColombianDocumentService:
    """Generador de documentos laborales colombianos en PDF."""

    @staticmethod
    def generar_comprobante_nomina_pdf(data: Dict[str, Any]) -> bytes:
        """Comprobante de Nómina (Art. 62 CST — obligatorio entregar al trabajador)."""
        if WEASYPRINT_OK:
            return ColombianDocumentService._comprobante_weasyprint(data)
        return ColombianDocumentService._comprobante_reportlab(data)

    @staticmethod
    def _comprobante_weasyprint(data: Dict[str, Any]) -> bytes:
        periodo = data.get("periodo", datetime.now().strftime("%B %Y"))
        empresa = data.get("empresa", "EMPRESA S.A.S.")
        nit = data.get("nit", "")
        nombres = data.get("nombres", "")
        apellidos = data.get("apellidos", "")
        cedula = data.get("cedula", "")
        cargo = data.get("cargo", "")
        dep = data.get("departamento", "")
        cc_empresa = data.get("cc_empresa", "")

        comp = data.get("comprobante", {})
        apor = data.get("aportes_empleador", {})
        prov = data.get("provisiones", {})

        def row(label, v, color="#fff"):
            if not v or v == 0:
                return ""
            return f"<tr style='background:{color}'><td>{label}</td><td style='text-align:right'>{_fmtCOP(Decimal(str(v)))}</td></tr>"

        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  body {{ font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 16px; color: #1a1a2e; }}
  .header {{ background: #1a365d; color: white; padding: 12px 16px; border-radius: 6px 6px 0 0; }}
  .header h1 {{ margin: 0; font-size: 16px; letter-spacing: 1px; }}
  .header p {{ margin: 2px 0; font-size: 10px; opacity: 0.85; }}
  .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 10px 0; border-bottom: 2px solid #2b6cb0; margin-bottom: 10px; }}
  .info-item {{ font-size: 10px; }} .info-item b {{ display: block; color: #2b6cb0; font-size: 9px; text-transform: uppercase; }}
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 12px; }}
  th {{ background: #2b6cb0; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }}
  td {{ padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }}
  .section-title {{ background: #ebf8ff; font-weight: bold; color: #2b6cb0; padding: 5px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }}
  .total {{ background: #1a365d !important; color: white; font-weight: bold; font-size: 12px; }}
  .total td {{ color: white; border: none; padding: 8px; }}
  .firma-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }}
  .firma-box {{ border-top: 1px solid #333; padding-top: 4px; text-align: center; font-size: 10px; }}
  .note {{ font-size: 9px; color: #718096; margin-top: 8px; padding: 6px; background: #f7fafc; border-left: 3px solid #2b6cb0; }}
  .badge {{ display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: bold; }}
  .badge-green {{ background: #c6f6d5; color: #22543d; }}
</style>
</head>
<body>
<div class="header">
  <h1>COMPROBANTE DE NÓMINA</h1>
  <p>{empresa} &nbsp;|&nbsp; NIT: {nit} &nbsp;|&nbsp; Período: {periodo}</p>
</div>
<div class="info-grid">
  <div class="info-item"><b>Empleado</b>{nombres} {apellidos}</div>
  <div class="info-item"><b>Cédula de Ciudadanía</b>{cedula}</div>
  <div class="info-item"><b>Cargo</b>{cargo}</div>
  <div class="info-item"><b>Departamento / C. Costo</b>{dep}</div>
  <div class="info-item"><b>Días trabajados</b>{comp.get('dias_trabajados', 30)}</div>
  <div class="info-item"><b>Tipo de salario</b>{comp.get('tipo_salario', 'ORDINARIO')}</div>
</div>

<!-- DEVENGADO -->
<table>
  <tr><th colspan="2">INGRESOS DEVENGADOS</th></tr>
  <tr class="section-title"><td colspan="2">Salario y complementos</td></tr>
  {row('Salario básico', comp.get('salario_basico'))}
  {row('Salario proporcional a días', comp.get('salario_proporcional'), '#f7fafc')}
  {row('Auxilio de transporte (Art. 7 Ley 1/1963)', comp.get('auxilio_transporte'))}
  {row('Horas extras y recargos (Art. 168 CST)', data.get('horas_extras_val'))}
  {row('Bonificaciones constitutivas de salario', data.get('bonificaciones_const'))}
  {row('Bonificaciones no constitutivas', data.get('bonificaciones_no_const'), '#f7fafc')}
  {row('Comisiones', data.get('comisiones'))}
  {row('Incapacidad (días 1-3 cargo empleador)', data.get('incapacidad_val'))}
  {row('Vacaciones disfrutadas (Art. 192 CST)', data.get('vacaciones_val'))}
  <tr class="total"><td><b>TOTAL DEVENGADO</b></td><td style="text-align:right"><b>{_fmtCOP(Decimal(str(comp.get('total_devengado', 0))))}</b></td></tr>
</table>

<!-- DEDUCCIONES -->
<table>
  <tr><th colspan="2">DEDUCCIONES</th></tr>
  {row('AFP — Pensión empleado 4% (Art. 20 Ley 100/1993)', comp.get('afp_empleado'))}
  {row('EPS — Salud empleado 4% (Art. 204 Ley 100/1993)', comp.get('eps_empleado'), '#f7fafc')}
  {row('Fondo Solidaridad Pensional (Art. 27 Ley 100/1993)', comp.get('fondo_solidaridad'))}
  {row('Retención en la Fuente (Art. 383 ET)', comp.get('retefuente'))}
  {row('Libranza / crédito empleado', data.get('libranza'))}
  {row('Adelanto de nómina', data.get('adelanto_nomina'), '#f7fafc')}
  {row('Otras deducciones', data.get('otras_deducciones'))}
  <tr class="total"><td><b>TOTAL DEDUCCIONES</b></td><td style="text-align:right"><b>{_fmtCOP(Decimal(str(comp.get('total_descuentos', 0))))}</b></td></tr>
</table>

<!-- NETO -->
<table>
  <tr style="background:#22543d;color:white;font-size:14px">
    <td><b>NETO A PAGAR</b></td>
    <td style="text-align:right"><b>{_fmtCOP(Decimal(str(comp.get('neto_pagar', 0))))}</b></td>
  </tr>
</table>

<!-- APORTES EMPLEADOR (informativo) -->
<table>
  <tr><th colspan="2">APORTES EMPLEADOR (no descuentan al trabajador)</th></tr>
  {row('AFP — Pensión empleador 12% (Art. 20 Ley 100/1993)', apor.get('afp_empleador'))}
  {row('EPS — Salud empleador 8.5% (Art. 204 Ley 100/1993)', apor.get('eps_empleador'), '#f7fafc')}
  {row('ARL (Decreto 1607/2002)', apor.get('arl'))}
  {row('CCF 4% (Ley 21/1982)', apor.get('ccf'))}
  {row('SENA 2% (Ley 21/1982)', apor.get('sena'), '#f7fafc')}
  {row('ICBF 3% (Ley 21/1982)', apor.get('icbf'))}
  <tr class="total"><td><b>TOTAL APORTES EMPLEADOR</b></td><td style="text-align:right"><b>{_fmtCOP(Decimal(str(apor.get('total', 0))))}</b></td></tr>
</table>

<!-- PROVISIONES -->
<table>
  <tr><th colspan="2">PROVISIONES MENSUALES (acumulado)</th></tr>
  {row('Cesantías 8.33% (Art. 249 CST)', prov.get('cesantias'))}
  {row('Intereses sobre cesantías 1%/mes (Art. 99 Ley 50/1990)', prov.get('int_cesantias'), '#f7fafc')}
  {row('Prima de servicios 8.33% (Art. 306 CST)', prov.get('prima'))}
  {row('Vacaciones 4.17% (Art. 186 CST)', prov.get('vacaciones'))}
  <tr class="total"><td><b>TOTAL PROVISIONES</b></td><td style="text-align:right"><b>{_fmtCOP(Decimal(str(prov.get('total', 0))))}</b></td></tr>
</table>

<div class="note">
  <b>Nota PILA:</b> Los aportes a seguridad social (AFP + EPS + ARL + CCF + SENA + ICBF) deben liquidarse vía
  Planilla Integrada de Liquidación de Aportes (PILA) a más tardar el día 21 del mes siguiente. — UGPP.
  Las cesantías deben consignarse al fondo antes del 14 de febrero de cada año (Art. 99 Ley 50/1990).
</div>

<div class="firma-grid">
  <div class="firma-box">
    <p>{nombres} {apellidos}</p>
    <p>C.C. {cedula}</p>
    <p>EMPLEADO — Firma de recibido</p>
  </div>
  <div class="firma-box">
    <p>{cc_empresa or ''}</p>
    <p>{empresa}</p>
    <p>EMPLEADOR — Representante Legal</p>
  </div>
</div>

</body>
</html>"""

        return WeasyprintHTML(string=html).write_pdf()

    @staticmethod
    def _comprobante_reportlab(data: Dict[str, Any]) -> bytes:
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=1.5*cm, leftMargin=1.5*cm, topMargin=1.5*cm, bottomMargin=1.5*cm)
        styles = getSampleStyleSheet()
        titulo = ParagraphStyle("titulo", parent=styles["Title"], fontSize=14, textColor=colors.HexColor("#1a365d"), spaceAfter=6)
        subtitulo = ParagraphStyle("sub", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#2b6cb0"), spaceAfter=4)
        normal = ParagraphStyle("n", parent=styles["Normal"], fontSize=9)

        comp = data.get("comprobante", {})
        apor = data.get("aportes_empleador", {})
        prov = data.get("provisiones", {})

        elements = [
            Paragraph("COMPROBANTE DE NÓMINA", titulo),
            Paragraph(f"{data.get('empresa','EMPRESA S.A.S.')} — NIT: {data.get('nit','')} — Período: {data.get('periodo', datetime.now().strftime('%B %Y'))}", subtitulo),
            Spacer(1, 0.3*cm),
        ]

        # Info empleado
        info_data = [
            ["Empleado:", f"{data.get('nombres','')} {data.get('apellidos','')}", "Cédula:", data.get("cedula","")],
            ["Cargo:", data.get("cargo",""), "Días trab.:", str(comp.get("dias_trabajados", 30))],
        ]
        t_info = Table(info_data, colWidths=[3.5*cm, 6*cm, 3*cm, 5*cm])
        t_info.setStyle(TableStyle([("FONTSIZE", (0,0), (-1,-1), 9), ("TEXTCOLOR", (0,0), (0,-1), colors.HexColor("#2b6cb0")), ("TEXTCOLOR", (2,0), (2,-1), colors.HexColor("#2b6cb0")), ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"), ("FONTNAME", (2,0), (2,-1), "Helvetica-Bold"), ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0"))]))
        elements.extend([t_info, Spacer(1, 0.4*cm)])

        def table_section(title, rows):
            t_data = [[title, ""]]
            for label, val in rows:
                if val and Decimal(str(val)) != 0:
                    t_data.append([label, _fmtCOP(Decimal(str(val)))])
            if len(t_data) == 1:
                return []
            t = Table(t_data, colWidths=[13*cm, 5*cm])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#2b6cb0")),
                ("TEXTCOLOR", (0,0), (-1,0), colors.white),
                ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                ("FONTSIZE", (0,0), (-1,-1), 9),
                ("ALIGN", (1,0), (1,-1), "RIGHT"),
                ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#f7fafc")]),
                ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
                ("BOTTOMPADDING", (0,0), (-1,-1), 4),
                ("TOPPADDING", (0,0), (-1,-1), 4),
            ]))
            return [t, Spacer(1, 0.3*cm)]

        elements += table_section("DEVENGADO", [
            ("Salario básico", comp.get("salario_basico")),
            ("Auxilio de transporte", comp.get("auxilio_transporte")),
            ("TOTAL DEVENGADO", comp.get("total_devengado")),
        ])
        elements += table_section("DEDUCCIONES", [
            ("AFP empleado 4%", comp.get("afp_empleado")),
            ("EPS empleado 4%", comp.get("eps_empleado")),
            ("Fondo Solidaridad Pensional", comp.get("fondo_solidaridad")),
            ("ReteFuente (Art. 383 ET)", comp.get("retefuente")),
            ("TOTAL DEDUCCIONES", comp.get("total_descuentos")),
        ])
        elements += table_section("NETO A PAGAR", [("NETO A PAGAR", comp.get("neto_pagar"))])
        elements += table_section("APORTES EMPLEADOR", [
            ("AFP empleador 12%", apor.get("afp_empleador")),
            ("EPS empleador 8.5%", apor.get("eps_empleador")),
            ("ARL", apor.get("arl")),
            ("CCF 4%", apor.get("ccf")),
            ("SENA 2%", apor.get("sena")),
            ("ICBF 3%", apor.get("icbf")),
            ("TOTAL APORTES EMPLEADOR", apor.get("total")),
        ])
        elements += table_section("PROVISIONES MENSUALES", [
            ("Cesantías 8.33%", prov.get("cesantias")),
            ("Intereses cesantías", prov.get("int_cesantias")),
            ("Prima 8.33%", prov.get("prima")),
            ("Vacaciones 4.17%", prov.get("vacaciones")),
            ("TOTAL PROVISIONES", prov.get("total")),
        ])

        # Firmas
        elements.append(Spacer(1, 1.5*cm))
        firma_data = [
            ["_______________________________", "_______________________________"],
            [f"{data.get('nombres','')} {data.get('apellidos','')}", data.get("empresa", "EMPRESA S.A.S.")],
            [f"C.C. {data.get('cedula','')}", "Representante Legal"],
            ["EMPLEADO — Recibido conforme", "EMPLEADOR"],
        ]
        t_firma = Table(firma_data, colWidths=[9*cm, 9*cm])
        t_firma.setStyle(TableStyle([("FONTSIZE", (0,0), (-1,-1), 9), ("ALIGN", (0,0), (-1,-1), "CENTER"), ("TOPPADDING", (0,0), (-1,-1), 3)]))
        elements.append(t_firma)

        doc.build(elements)
        return buf.getvalue()

    @staticmethod
    def generar_certificado_laboral_pdf(data: Dict[str, Any]) -> bytes:
        """Certificado laboral — Art. 57 num. 7 CST."""
        if WEASYPRINT_OK:
            return ColombianDocumentService._cert_laboral_weasyprint(data)
        return ColombianDocumentService._cert_laboral_reportlab(data)

    @staticmethod
    def _cert_laboral_weasyprint(data: Dict[str, Any]) -> bytes:
        fecha = data.get("fecha_expedicion", date.today().strftime("%d de %B de %Y"))
        empresa = data.get("empresa", "EMPRESA S.A.S.")
        nit = data.get("nit", "")
        nombres = data.get("nombres", "")
        apellidos = data.get("apellidos", "")
        cedula = data.get("cedula", "")
        cargo = data.get("cargo", "")
        fecha_ingreso = data.get("fecha_ingreso", "")
        fecha_retiro = data.get("fecha_retiro", "")
        salario = Decimal(str(data.get("salario", 0)))
        tipo_contrato = data.get("tipo_contrato", "TÉRMINO INDEFINIDO")
        tipo_sal = data.get("tipo_salario", "ORDINARIO")
        rl = data.get("representante_legal", "")
        cargo_rl = data.get("cargo_representante", "Representante Legal")
        estado = "activo" if not fecha_retiro else "retirado"
        vinculacion = f"desde el {fecha_ingreso}" + (f" hasta el {fecha_retiro}" if fecha_retiro else " hasta la fecha de expedición del presente certificado")

        html = f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
body {{ font-family: Arial, sans-serif; font-size: 12px; color: #1a1a2e; padding: 40px; line-height: 1.6; }}
.header {{ text-align: center; margin-bottom: 30px; }}
.header h2 {{ color: #1a365d; letter-spacing: 1px; font-size: 18px; margin-bottom: 4px; }}
.header p {{ font-size: 11px; color: #718096; }}
h3 {{ text-align: center; color: #1a365d; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid #2b6cb0; padding-bottom: 6px; margin: 20px 0; }}
.body {{ text-align: justify; margin-bottom: 20px; }}
.firma {{ margin-top: 60px; }}
.firma-line {{ border-top: 1px solid #333; width: 300px; margin: 40px auto 0; }}
.firma-info {{ text-align: center; font-size: 11px; margin-top: 4px; }}
.footer {{ font-size: 10px; color: #718096; border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 8px; text-align: center; }}
</style></head><body>
<div class="header">
  <h2>{empresa}</h2>
  <p>NIT: {nit} — Expedido en: {fecha}</p>
</div>
<h3>Certificado Laboral</h3>
<div class="body">
<p>{rl or 'El suscrito Representante Legal'} de <b>{empresa}</b>, identificada con NIT {nit},</p>
<p><b>CERTIFICA QUE:</b></p>
<p>La señora/señor <b>{nombres} {apellidos}</b>, identificada/o con Cédula de Ciudadanía N° <b>{cedula}</b>,
ha laborado/labora en esta empresa en el cargo de <b>{cargo}</b>, bajo contrato de trabajo de <b>{tipo_contrato}</b>,
{vinculacion}.</p>
<p>Durante su vinculación ha devengado un salario <b>{tipo_sal.lower()}</b> equivalente a
<b>{_fmtCOP(salario)} mensuales</b> (en letras: {_numero_a_letras(salario)} pesos colombianos m/cte.).</p>
<p>Esta certificación se expide a solicitud del interesado/a para los fines que estime convenientes,
conforme al Art. 57 numeral 7 del Código Sustantivo del Trabajo.</p>
</div>
<div class="firma">
  <div class="firma-line"></div>
  <div class="firma-info">
    <p><b>{rl}</b></p>
    <p>{cargo_rl}</p>
    <p>{empresa} — NIT: {nit}</p>
  </div>
</div>
<div class="footer">Documento generado el {fecha} — {empresa} — NIT {nit}. Este certificado tiene validez de 30 días calendario desde su expedición.</div>
</body></html>"""
        return WeasyprintHTML(string=html).write_pdf()

    @staticmethod
    def _cert_laboral_reportlab(data: Dict[str, Any]) -> bytes:
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=2.5*cm, leftMargin=2.5*cm, topMargin=2.5*cm, bottomMargin=2.5*cm)
        styles = getSampleStyleSheet()
        titulo = ParagraphStyle("t", parent=styles["Title"], fontSize=14, textColor=colors.HexColor("#1a365d"), spaceAfter=8, alignment=TA_CENTER)
        body = ParagraphStyle("b", parent=styles["Normal"], fontSize=11, spaceAfter=12, leading=18)
        salario = Decimal(str(data.get("salario", 0)))
        elements = [
            Paragraph(f"{data.get('empresa','')}", titulo),
            Paragraph("CERTIFICADO LABORAL", titulo),
            Spacer(1, 0.5*cm),
            Paragraph(f"El suscrito Representante Legal de <b>{data.get('empresa','')}</b>, NIT {data.get('nit','')}, <b>CERTIFICA QUE:</b>", body),
            Paragraph(f"La señora/señor <b>{data.get('nombres','')} {data.get('apellidos','')}</b>, C.C. <b>{data.get('cedula','')}</b>, ha laborado en el cargo de <b>{data.get('cargo','')}</b> con contrato de <b>{data.get('tipo_contrato','TÉRMINO INDEFINIDO')}</b> desde el {data.get('fecha_ingreso','')}, devengando un salario de <b>{_fmtCOP(salario)} mensuales</b>.", body),
            Paragraph("Esta certificación se expide a solicitud del interesado/a para los fines que estime convenientes (Art. 57 num. 7 CST).", body),
            Spacer(1, 2*cm),
            Paragraph("_____________________________", body),
            Paragraph(f"{data.get('representante_legal','Representante Legal')}", body),
            Paragraph(f"{data.get('empresa','')}", body),
        ]
        doc.build(elements)
        return buf.getvalue()

    @staticmethod
    def generar_paz_y_salvo_pdf(data: Dict[str, Any]) -> bytes:
        """Paz y Salvo laboral."""
        if not REPORTLAB_OK:
            return b""
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=2.5*cm, leftMargin=2.5*cm, topMargin=2.5*cm, bottomMargin=2.5*cm)
        styles = getSampleStyleSheet()
        titulo = ParagraphStyle("t", parent=styles["Title"], fontSize=14, textColor=colors.HexColor("#1a365d"), alignment=TA_CENTER, spaceAfter=8)
        body = ParagraphStyle("b", parent=styles["Normal"], fontSize=11, spaceAfter=12, leading=18)
        fecha = data.get("fecha", date.today().strftime("%d de %B de %Y"))
        elements = [
            Paragraph(data.get("empresa","EMPRESA S.A.S."), titulo),
            Paragraph("PAZ Y SALVO LABORAL", titulo),
            Spacer(1, 0.5*cm),
            Paragraph(f"La empresa <b>{data.get('empresa','')}</b>, NIT <b>{data.get('nit','')}</b>, certifica que la señora/señor <b>{data.get('nombres','')} {data.get('apellidos','')}</b>, C.C. <b>{data.get('cedula','')}</b>, cargo <b>{data.get('cargo','')}</b>, a la fecha <b>{fecha}</b>:", body),
            Paragraph("✅ Se encuentra a PAZ Y SALVO con la empresa por concepto de:", body),
        ]
        conceptos = data.get("conceptos_liquidados", [
            "Salarios y prestaciones sociales (cesantías, intereses, prima, vacaciones)",
            "Aportes a seguridad social (EPS, AFP, ARL, CCF, SENA, ICBF)",
            "Dotaciones y elementos de trabajo entregados",
            "Anticipos de nómina y libranzas autorizadas",
            "Equipos, herramientas y activos a cargo",
        ])
        for c in conceptos:
            elements.append(Paragraph(f"• {c}", body))
        elements.extend([
            Spacer(1, 0.5*cm),
            Paragraph(data.get("observaciones", "Sin observaciones adicionales."), body),
            Spacer(1, 2*cm),
            Paragraph("_____________________________          _____________________________", body),
            Paragraph(f"{data.get('nombres','')} {data.get('apellidos','')}          {data.get('representante_legal','')}", body),
            Paragraph(f"C.C. {data.get('cedula','')}          Representante Legal", body),
            Paragraph(f"TRABAJADOR                          {data.get('empresa','')}", body),
            Spacer(1, 0.5*cm),
            Paragraph(f"Expedido el {fecha}", ParagraphStyle("sm", parent=styles["Normal"], fontSize=9, textColor=colors.grey)),
        ])
        doc.build(elements)
        return buf.getvalue()

    @staticmethod
    def generar_acta_liquidacion_pdf(data: Dict[str, Any]) -> bytes:
        """Acta de liquidación de prestaciones sociales — Art. 64-66 CST."""
        if not REPORTLAB_OK:
            return b""
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=1.5*cm, leftMargin=1.5*cm, topMargin=2*cm, bottomMargin=2*cm)
        styles = getSampleStyleSheet()
        titulo = ParagraphStyle("t", parent=styles["Title"], fontSize=13, textColor=colors.HexColor("#1a365d"), alignment=TA_CENTER, spaceAfter=8)
        body = ParagraphStyle("b", parent=styles["Normal"], fontSize=10, spaceAfter=8, leading=16)
        fecha = data.get("fecha_retiro", date.today().strftime("%d/%m/%Y"))
        salario = Decimal(str(data.get("ultimo_salario", 0)))

        liquidacion = data.get("liquidacion", {})
        ces  = Decimal(str(liquidacion.get("cesantias", 0)))
        ic   = Decimal(str(liquidacion.get("int_cesantias", 0)))
        pri  = Decimal(str(liquidacion.get("prima", 0)))
        vac  = Decimal(str(liquidacion.get("vacaciones", 0)))
        ind  = Decimal(str(liquidacion.get("indemnizacion", 0)))
        total = ces + ic + pri + vac + ind

        rows = [["Concepto", "Base de cálculo", "Valor"]]
        if ces:   rows.append(["Cesantías (Art. 249 CST)", f"{data.get('dias_cesantias',0)} días", _fmtCOP(ces)])
        if ic:    rows.append(["Intereses sobre cesantías (Art. 99 Ley 50/1990)", "12% anual", _fmtCOP(ic)])
        if pri:   rows.append(["Prima de servicios (Art. 306 CST)", f"{data.get('dias_prima',0)} días", _fmtCOP(pri)])
        if vac:   rows.append(["Vacaciones (Art. 186 CST)", f"{data.get('dias_vac_pend',0)} días", _fmtCOP(vac)])
        if ind:   rows.append(["Indemnización por terminación (Art. 64 CST)", "", _fmtCOP(ind)])
        rows.append(["TOTAL LIQUIDACIÓN", "", _fmtCOP(total)])

        elements = [
            Paragraph(data.get("empresa", "EMPRESA S.A.S."), titulo),
            Paragraph("ACTA DE LIQUIDACIÓN DE PRESTACIONES SOCIALES", titulo),
            Spacer(1, 0.3*cm),
            Paragraph(f"Empleado: <b>{data.get('nombres','')} {data.get('apellidos','')}</b> — C.C.: <b>{data.get('cedula','')}</b>", body),
            Paragraph(f"Cargo: <b>{data.get('cargo','')}</b> — Último salario: <b>{_fmtCOP(salario)}</b>", body),
            Paragraph(f"Fecha ingreso: <b>{data.get('fecha_ingreso','')}</b> — Fecha retiro: <b>{fecha}</b>", body),
            Paragraph(f"Causa terminación: {data.get('causa_terminacion','Terminación sin justa causa')}", body),
            Spacer(1, 0.3*cm),
        ]

        t = Table(rows, colWidths=[9*cm, 4*cm, 5*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#2b6cb0")),
            ("TEXTCOLOR", (0,0), (-1,0), colors.white),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (-1,-1), 9),
            ("ALIGN", (2,0), (2,-1), "RIGHT"),
            ("ROWBACKGROUNDS", (0,1), (-1,-2), [colors.white, colors.HexColor("#f7fafc")]),
            ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#1a365d")),
            ("TEXTCOLOR", (0,-1), (-1,-1), colors.white),
            ("FONTNAME", (0,-1), (-1,-1), "Helvetica-Bold"),
            ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
            ("TOPPADDING", (0,0), (-1,-1), 5),
        ]))
        elements.extend([t, Spacer(1, 1.5*cm)])

        elements += [
            Paragraph("Con la firma de este documento el trabajador declara haber recibido a entera satisfacción el pago de las prestaciones sociales relacionadas y no tener ningún reclamo adicional contra la empresa por este concepto.", body),
            Spacer(1, 1.5*cm),
            Paragraph("_______________________________          _______________________________", body),
            Paragraph(f"{data.get('nombres','')} {data.get('apellidos','')}          {data.get('representante_legal','')}", body),
            Paragraph(f"C.C. {data.get('cedula','')}                           Representante Legal", body),
            Paragraph(f"TRABAJADOR                               {data.get('empresa','')}", body),
        ]
        doc.build(elements)
        return buf.getvalue()

    @staticmethod
    def generar_autorizacion_descuentos_pdf(data: Dict[str, Any]) -> bytes:
        """Autorización de descuentos de nómina — Art. 149 CST."""
        if not REPORTLAB_OK:
            return b""
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=2.5*cm, leftMargin=2.5*cm, topMargin=2.5*cm, bottomMargin=2.5*cm)
        styles = getSampleStyleSheet()
        titulo = ParagraphStyle("t", parent=styles["Title"], fontSize=14, textColor=colors.HexColor("#1a365d"), alignment=TA_CENTER, spaceAfter=8)
        body = ParagraphStyle("b", parent=styles["Normal"], fontSize=11, spaceAfter=10, leading=18)
        elements = [
            Paragraph(data.get("empresa","EMPRESA S.A.S."), titulo),
            Paragraph("AUTORIZACIÓN DE DESCUENTOS DE NÓMINA", titulo),
            Paragraph("(Art. 149 Código Sustantivo del Trabajo)", ParagraphStyle("sm", parent=styles["Normal"], fontSize=9, alignment=TA_CENTER, textColor=colors.grey, spaceAfter=16)),
            Spacer(1, 0.3*cm),
            Paragraph(f"Yo, <b>{data.get('nombres','')} {data.get('apellidos','')}</b>, identificado/a con Cédula de Ciudadanía N° <b>{data.get('cedula','')}</b>, empleado/a de <b>{data.get('empresa','')}</b> en el cargo de <b>{data.get('cargo','')}</b>, por medio del presente documento AUTORIZO expresamente a la empresa a realizar los siguientes descuentos de mi nómina mensual:", body),
        ]
        conceptos = data.get("descuentos_autorizados", [
            "Aportes al sistema de seguridad social (AFP, EPS) según Ley 100/1993",
            "Retención en la Fuente sobre ingresos laborales según Art. 383 ET",
            "Cuotas de libranza y/o crédito de consumo previamente aceptadas",
            "Deducciones por ausencias, permisos no remunerados o sanciones disciplinarias",
            "Reintegro de anticipos de nómina otorgados por la empresa",
        ])
        for c in conceptos:
            elements.append(Paragraph(f"• {c}", body))
        elements.extend([
            Spacer(1, 0.5*cm),
            Paragraph("Esta autorización es de carácter voluntario y podrá ser revocada en cualquier momento mediante comunicación escrita a la empresa, con un preaviso de 30 días calendario.", body),
            Spacer(1, 2*cm),
            Paragraph(f"Firma: ___________________________          Fecha: ____________________", body),
            Paragraph(f"{data.get('nombres','')} {data.get('apellidos','')}", body),
            Paragraph(f"C.C. {data.get('cedula','')}", body),
        ])
        doc.build(elements)
        return buf.getvalue()

    @staticmethod
    def generar_pila_txt(workers_data: List[Dict[str, Any]], periodo: str, nit_empresa: str, nombre_empresa: str) -> str:
        """Genera archivo plano PILA (Planilla Integrada de Liquidación de Aportes) — UGPP."""
        lineas = [f"01|{nit_empresa}|{nombre_empresa}|{periodo}|PILA|01"]
        for w in workers_data:
            comp = w.get("comprobante", {})
            apor = w.get("aportes_empleador", {})
            ibc = int(comp.get("salario_basico", 0))
            dias = comp.get("dias_trabajados", 30)
            total_afp = int(Decimal(str(comp.get("afp_empleado", 0))) + Decimal(str(apor.get("afp_empleador", 0))))
            total_eps = int(Decimal(str(comp.get("eps_empleado", 0))) + Decimal(str(apor.get("eps_empleador", 0))))
            arl = int(apor.get("arl", 0))
            ccf = int(apor.get("ccf", 0))
            sena = int(apor.get("sena", 0))
            icbf = int(apor.get("icbf", 0))
            lineas.append(
                f"02|CC|{w.get('cedula','')}|{w.get('apellidos','')}|{w.get('nombres','')}|"
                f"1|{dias}|{ibc}|{total_afp}|{total_eps}|{arl}|{ccf}|{sena}|{icbf}|"
                f"{w.get('afp_nombre','AFP PORVENIR')}|{w.get('eps_nombre','EPS SURA')}|"
                f"{w.get('arl_nombre','ARL SURA')}|{w.get('ccf_nombre','COMPENSAR')}"
            )
        lineas.append(f"99|{len(workers_data)}|FIN")
        return "\n".join(lineas)


def _numero_a_letras(n: Decimal) -> str:
    """Convierte un número a letras (simplificado para certificados)."""
    try:
        v = int(n)
        if v == 0:
            return "cero"
        millones = v // 1_000_000
        miles = (v % 1_000_000) // 1_000
        resto = v % 1_000
        partes = []
        if millones:
            partes.append(f"{millones} millón{'es' if millones > 1 else ''}")
        if miles:
            partes.append(f"{miles} mil")
        if resto:
            partes.append(str(resto))
        return " ".join(partes)
    except Exception:
        return str(n)


class PayrollService:
    """Servicio de nómina Colombia — genera asientos, provisiones, comprobantes y documentos."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.calculator = ColombianPayrollCalculator()

    async def calcular_neto_y_provisiones(self, worker_id: str, dias_trabajados: int = 30):
        worker = await self.db.get(HrWorker, worker_id)
        if not worker:
            raise ValueError("Trabajador no encontrado.")
        resultado = self.calculator.liquidar(worker, dias_trabajados)
        asiento = self._construir_asiento(worker, resultado)
        await self._persistir_asiento(worker, asiento)
        await self._persistir_provisiones(worker, resultado["provisiones"])
        await self.db.commit()
        return {"status": "success", "neto": resultado["comprobante"]["neto_pagar"], "detalles": resultado}

    async def generar_comprobante_pago(self, worker_id: str, periodo: str = None, empresa_data: dict = None):
        if periodo is None:
            periodo = datetime.now().strftime("%B %Y")
        worker = await self.db.get(HrWorker, worker_id)
        if not worker:
            raise ValueError("Trabajador no encontrado.")
        resultado = self.calculator.liquidar(worker)
        doc_data = {
            **resultado,
            "nombres": worker.nombres,
            "apellidos": worker.apellidos,
            "cedula": worker.dni,
            "cargo": worker.cargo_postulado,
            "periodo": periodo,
            "empresa": (empresa_data or {}).get("nombre", "EMPRESA S.A.S."),
            "nit": (empresa_data or {}).get("nit", ""),
        }
        pdf_bytes = ColombianDocumentService.generar_comprobante_nomina_pdf(doc_data)
        b64 = base64.b64encode(pdf_bytes).decode("utf-8")
        return {"status": "success", "filename": f"comprobante_{worker.dni}_{periodo}.pdf", "pdf_base64": b64}

    async def cerrar_planilla_mes(self, periodo: str):
        stmt = update(PayrollProvision).where(
            PayrollProvision.periodo_mes == periodo,
            PayrollProvision.estado_pago == "PENDIENTE",
        ).values(estado_pago="PAGADO")
        result = await self.db.execute(stmt)
        await self.db.commit()
        return {"status": "success", "provisiones_actualizadas": result.rowcount}

    async def generar_pila(self, periodo: str, nit_empresa: str = "", nombre_empresa: str = ""):
        from sqlalchemy import select as _select
        stmt = _select(HrWorker).where(HrWorker.estado_laboral == "ACTIVO" if hasattr(HrWorker, "estado_laboral") else HrWorker.id.isnot(None))
        result = await self.db.execute(stmt)
        workers = list(result.scalars().all())
        workers_data = []
        for w in workers:
            liq = self.calculator.liquidar(w)
            workers_data.append({
                **liq,
                "cedula": w.dni,
                "nombres": w.nombres,
                "apellidos": w.apellidos,
            })
        contenido = ColombianDocumentService.generar_pila_txt(workers_data, periodo, nit_empresa, nombre_empresa)
        return {"status": "success", "filename": f"PILA_{periodo}.txt", "contenido": contenido}

    def _construir_asiento(self, worker: HrWorker, resultado: Dict[str, Any]) -> Dict[str, Any]:
        comp = resultado["comprobante"]
        apor = resultado["aportes_empleador"]
        prov = resultado["provisiones"]
        cedula = worker.dni

        items = []
        # Débitos — Gastos de personal
        if comp["salario_proporcional"]: items.append({"cuenta": C_SUELDOS, "desc": "Sueldos y salarios", "monto": comp["salario_proporcional"], "tipo": "D"})
        if comp["auxilio_transporte"]:   items.append({"cuenta": C_AUX_TRANSPORTE, "desc": "Auxilio de transporte", "monto": comp["auxilio_transporte"], "tipo": "D"})
        if prov["cesantias"]:  items.append({"cuenta": C_CESANTIAS_G, "desc": "Gasto cesantías 8.33%", "monto": prov["cesantias"], "tipo": "D"})
        if prov["int_cesantias"]: items.append({"cuenta": C_INT_CESANTIAS_G, "desc": "Gasto intereses cesantías", "monto": prov["int_cesantias"], "tipo": "D"})
        if prov["prima"]:      items.append({"cuenta": C_PRIMA_G, "desc": "Gasto prima de servicios 8.33%", "monto": prov["prima"], "tipo": "D"})
        if prov["vacaciones"]: items.append({"cuenta": C_VACACIONES_G, "desc": "Gasto vacaciones 4.17%", "monto": prov["vacaciones"], "tipo": "D"})
        if apor["afp_empleador"]:  items.append({"cuenta": C_AFP_G, "desc": "Gasto AFP empleador 12%", "monto": apor["afp_empleador"], "tipo": "D"})
        if apor["eps_empleador"]:  items.append({"cuenta": C_EPS_G, "desc": "Gasto EPS empleador 8.5%", "monto": apor["eps_empleador"], "tipo": "D"})
        if apor["arl"]:        items.append({"cuenta": C_ARL_G, "desc": "Gasto ARL", "monto": apor["arl"], "tipo": "D"})
        if apor["ccf"]:        items.append({"cuenta": C_CCF_G, "desc": "Gasto CCF 4%", "monto": apor["ccf"], "tipo": "D"})
        if apor["sena"]:       items.append({"cuenta": C_SENA_G, "desc": "Gasto SENA 2%", "monto": apor["sena"], "tipo": "D"})
        if apor["icbf"]:       items.append({"cuenta": C_ICBF_G, "desc": "Gasto ICBF 3%", "monto": apor["icbf"], "tipo": "D"})

        # Créditos — Pasivos
        total_afp = comp["afp_empleado"] + apor["afp_empleador"]
        total_eps = comp["eps_empleado"] + apor["eps_empleador"]
        if total_afp:   items.append({"cuenta": C_AFP_P, "desc": "AFP pensiones por pagar (PILA)", "monto": total_afp, "tipo": "H"})
        if total_eps:   items.append({"cuenta": C_EPS_P, "desc": "EPS salud por pagar (PILA)", "monto": total_eps, "tipo": "H"})
        if apor["arl"]: items.append({"cuenta": C_ARL_P, "desc": "ARL por pagar", "monto": apor["arl"], "tipo": "H"})
        if comp["fondo_solidaridad"]: items.append({"cuenta": C_FONDO_SOL_P, "desc": "Fondo solidaridad pensional", "monto": comp["fondo_solidaridad"], "tipo": "H"})
        if apor["ccf"]: items.append({"cuenta": C_CCF_P, "desc": "CCF por pagar", "monto": apor["ccf"], "tipo": "H"})
        if apor["sena"]: items.append({"cuenta": C_SENA_P, "desc": "SENA por pagar", "monto": apor["sena"], "tipo": "H"})
        if apor["icbf"]: items.append({"cuenta": C_ICBF_P, "desc": "ICBF por pagar", "monto": apor["icbf"], "tipo": "H"})
        if comp["retefuente"]: items.append({"cuenta": C_RETEFUENTE_P, "desc": "ReteFuente rentas laborales (DIAN)", "monto": comp["retefuente"], "tipo": "H"})
        if prov["cesantias"]:  items.append({"cuenta": C_CESANTIAS_P, "desc": "Cesantías consolidadas", "monto": prov["cesantias"], "tipo": "H"})
        if prov["int_cesantias"]: items.append({"cuenta": C_INT_CES_P, "desc": "Intereses cesantías por pagar", "monto": prov["int_cesantias"], "tipo": "H"})
        if prov["prima"]:      items.append({"cuenta": C_PRIMA_P, "desc": "Prima de servicios por pagar", "monto": prov["prima"], "tipo": "H"})
        if prov["vacaciones"]: items.append({"cuenta": C_VACACIONES_P, "desc": "Vacaciones consolidadas", "monto": prov["vacaciones"], "tipo": "H"})
        items.append({"cuenta": C_NOMINAS_P, "desc": "Nóminas por pagar (neto empleado)", "monto": comp["neto_pagar"], "tipo": "H"})

        return {
            "glosa": f"Nómina Colombia — CC {cedula} — {datetime.now().strftime('%m/%Y')}",
            "items": items,
        }

    async def _persistir_asiento(self, worker: HrWorker, asiento: Dict[str, Any]):
        total_debe = sum(item["monto"] for item in asiento["items"] if item["tipo"] == "D")
        total_haber = sum(item["monto"] for item in asiento["items"] if item["tipo"] == "H")
        entry = PayrollJournalEntry(
            fecha_asiento=datetime.now().date(),
            glosa=asiento["glosa"],
            total_debe=total_debe,
            total_haber=total_haber,
            tipo_asiento="NOMINA_COLOMBIA",
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

    async def _persistir_provisiones(self, worker: HrWorker, provisiones: Dict[str, Decimal], periodo: str = None):
        if periodo is None:
            periodo = datetime.now().strftime("%Y-%m")
        provision = PayrollProvision(
            trabajador_id=worker.id,
            periodo_mes=periodo,
            monto_cesantias=provisiones["cesantias"],
            monto_prima=provisiones["prima"],
            monto_vacaciones=provisiones["vacaciones"],
            tenant_id=worker.tenant_id,
            company_id=worker.company_id,
        )
        self.db.add(provision)
