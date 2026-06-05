from __future__ import annotations

import base64
import json
import mimetypes
import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from src.api.dependencies import get_current_context
from src.config import settings

router = APIRouter(prefix="/purchases", tags=["Purchases IA"])

CENTRO_COSTO_DEFAULT = "LIM-ADM"
ROUNDING_EXPENSE_ACCOUNT = "659101"
ROUNDING_INCOME_ACCOUNT = "759901"
PRIOR_BALANCE_ACCOUNT = "421201"
PAYABLE_ACCOUNT = "4212"
IGV_CREDIT_ACCOUNT = "40111"
AUTO_ROUNDING_TOLERANCE = Decimal("0.10")

COST_CENTER_LIBRARY = {
    "LIM-ADM": {
        "name": "Administracion Lima",
        "keywords": ["administracion", "oficina", "gerencia", "servicios publicos", "luz", "agua", "internet", "telefono"],
    },
    "LIM-COM": {
        "name": "Comercial Lima",
        "keywords": ["venta", "comercial", "marketing", "publicidad", "cliente", "campaña"],
    },
    "FIN-TES": {
        "name": "Tesoreria y Finanzas",
        "keywords": ["banco", "comision bancaria", "interes financiero", "tesoreria"],
    },
    "FIN-CXP": {
        "name": "Cuentas por Pagar",
        "keywords": ["proveedor", "cuentas por pagar", "cxp", "deuda anterior", "saldo anterior"],
    },
    "FIN-CXC": {
        "name": "Cuentas por Cobrar",
        "keywords": ["cliente", "cobranza", "cxc"],
    },
    "TI-CORE": {
        "name": "Tecnologia y Sistemas",
        "keywords": ["software", "servidor", "nube", "hosting", "sistema", "licencia", "computadora", "laptop"],
    },
    "OPS-PROD": {
        "name": "Operaciones Produccion",
        "keywords": ["produccion", "planta", "maquina", "operacion", "energia productiva"],
    },
    "LOG-ALM": {
        "name": "Logistica Almacen",
        "keywords": ["flete", "transporte", "almacen", "logistica", "courier", "delivery"],
    },
    "RRHH": {
        "name": "Recursos Humanos",
        "keywords": ["planilla", "capacitacion", "personal", "rrhh"],
    },
}

PCGE_RULE_LIBRARY = [
    {
        "account_code": "636101",
        "account_name": "Servicios basicos",
        "keywords": [
            "agua", "alcantarillado", "sedapal", "luz", "electricidad", "energia", "energia activa",
            "hidrandina", "enel", "luz del sur", "gas", "internet", "telefono", "telefonia",
            "cargo fijo", "alumbrado publico", "reconexion", "mantenimiento electrico"
        ],
        "default_cost_center": "LIM-ADM",
        "tax_treatment": "IGV credito fiscal si cumple causalidad, comprobante valido, RUC valido y anotacion oportuna.",
        "deductibility": "DEDUCIBLE",
        "igv_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "632101",
        "account_name": "Asesoria y consultoria",
        "keywords": ["asesoria", "consultoria", "consultor", "legal", "contable", "auditoria", "honorario", "profesional"],
        "default_cost_center": "LIM-ADM",
        "tax_treatment": "Gasto deducible sujeto a causalidad, fehaciencia, sustento documental y bancarizacion cuando corresponda.",
        "deductibility": "DEDUCIBLE",
        "igv_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "624101",
        "account_name": "Transportes y fletes",
        "keywords": ["flete", "transporte", "courier", "delivery", "traslado", "carga", "envio"],
        "default_cost_center": "LOG-ALM",
        "tax_treatment": "Evaluar detraccion si corresponde por servicio de transporte de bienes y validar sustento.",
        "deductibility": "DEDUCIBLE",
        "igv_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "634101",
        "account_name": "Mantenimiento y reparaciones",
        "keywords": ["mantenimiento", "reparacion", "soporte tecnico", "servicio tecnico"],
        "default_cost_center": "LIM-ADM",
        "tax_treatment": "Gasto deducible si esta vinculado con bienes o actividades del negocio.",
        "deductibility": "DEDUCIBLE",
        "igv_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "635101",
        "account_name": "Alquileres",
        "keywords": ["alquiler", "arrendamiento", "renta", "local", "oficina"],
        "default_cost_center": "LIM-ADM",
        "tax_treatment": "Revisar contrato, comprobante, detraccion si corresponde y fehaciencia del uso del inmueble.",
        "deductibility": "DEDUCIBLE",
        "igv_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "637101",
        "account_name": "Publicidad y marketing",
        "keywords": ["publicidad", "marketing", "anuncio", "campaña", "redes", "diseño"],
        "default_cost_center": "LIM-COM",
        "tax_treatment": "Deducible si acredita necesidad comercial, causalidad, fehaciencia y sustento documental.",
        "deductibility": "DEDUCIBLE",
        "igv_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "656101",
        "account_name": "Suministros diversos",
        "keywords": ["utiles", "suministro", "material", "limpieza", "oficina", "papel", "toner", "tinta"],
        "default_cost_center": "LIM-ADM",
        "tax_treatment": "Gasto operativo deducible si cumple causalidad y sustento.",
        "deductibility": "DEDUCIBLE",
        "igv_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "336101",
        "account_name": "Activo fijo - equipos diversos",
        "keywords": ["laptop", "computadora", "impresora", "maquina", "equipo", "mobiliario", "activo", "vehiculo"],
        "default_cost_center": "LIM-ADM",
        "tax_treatment": "No enviar directo a gasto si supera politica de capitalizacion; activar y depreciar segun politica contable.",
        "deductibility": "REVISION",
        "igv_credit": "REVISION",
        "requires_support": True,
    },
    {
        "account_code": "601101",
        "account_name": "Compras de mercaderias",
        "keywords": ["mercaderia", "producto para venta", "inventario", "stock"],
        "default_cost_center": "LOG-ALM",
        "tax_treatment": "Afecta inventario/kardex y costo de ventas segun politica de inventarios.",
        "deductibility": "DEDUCIBLE",
        "igv_credit": "SI",
        "requires_support": False,
    },
]

LEGAL_TAX_REVIEW_LIBRARY = [
    "Causalidad del gasto: relacion directa o razonable con generacion de renta o mantenimiento de fuente.",
    "Fehaciencia: conservar comprobante, contrato, orden, guia, evidencia de prestacion, conformidad y medio de pago.",
    "Bancarizacion: revisar umbrales y medios de pago exigidos para deduccion tributaria cuando aplique.",
    "IGV credito fiscal: validar comprobante valido, operacion gravada, adquisicion vinculada, RUC habido/activo y anotacion oportuna.",
    "Detraccion: revisar servicios sujetos al SPOT segun naturaleza del servicio y porcentaje vigente.",
    "Retencion/percepcion: evaluar condicion del proveedor, regimen aplicable y comprobante.",
    "No deducibles u observados: multas, sanciones, gastos personales, liberalidades o conceptos sin causalidad.",
    "Servicios publicos: separar consumo actual, cargo fijo, alumbrado publico, mantenimiento, deuda anterior, pagos a cuenta, mora/intereses, redondeos e IGV.",
    "Redondeo monetario: linea tecnica de conciliacion. No integra base imponible del IGV ni genera credito fiscal; no debe bloquear si esta dentro de tolerancia razonable.",
]


# Biblioteca sectorial de servicios publicos.
# Prioridad: estos conceptos se clasifican ANTES que redondeo.
# Aporte Ley, FOSE, FISE, MRSE, alumbrado, saneamiento, mantenimiento y cargos regulados NO son redondeo.
UTILITY_SERVICE_LIBRARY = [
    {"sector": "ELECTRICIDAD", "account_code": "636101", "account_name": "Energia electrica - consumo activo", "line_type": "EXPENSE_OR_ASSET", "patterns": [r"ENERGIA\s+ACTIVA", r"CONSUMO\s+ENERGIA", r"ENERG[IÍ]A\s+EL[EÉ]CTRICA"], "taxable_default": True, "igv_credit": "SI", "requires_support": False},
    {"sector": "ELECTRICIDAD", "account_code": "636102", "account_name": "Energia electrica - cargo fijo", "line_type": "EXPENSE_OR_ASSET", "patterns": [r"CARGO\s+FIJO"], "taxable_default": True, "igv_credit": "SI", "requires_support": False},
    {"sector": "ELECTRICIDAD", "account_code": "636103", "account_name": "Energia electrica - alumbrado publico", "line_type": "REGULATED_CHARGE", "patterns": [r"ALUMBRADO\s+P[UÚ]BLICO", r"ALUMBRADO\s+PUBLICO"], "taxable_default": False, "igv_credit": "NO", "requires_support": False},
    {"sector": "ELECTRICIDAD", "account_code": "636104", "account_name": "Energia electrica - reposicion y mantenimiento", "line_type": "REGULATED_CHARGE", "patterns": [r"REPOSICI[OÓ]N", r"MANTENIMIENTO", r"REPOSICION\s*/\s*MANTENIMIENTO"], "taxable_default": False, "igv_credit": "NO", "requires_support": False},
    {"sector": "ELECTRICIDAD", "account_code": "636105", "account_name": "Energia electrica - Aporte Ley 28749", "line_type": "REGULATED_CHARGE", "patterns": [r"APORTE\s+LEY", r"LEY\s+28749", r"APORTE\s+LEY\s+NRO\.?\s*28749"], "taxable_default": False, "igv_credit": "NO", "requires_support": False},
    {"sector": "ELECTRICIDAD", "account_code": "636106", "account_name": "Energia electrica - FOSE/FISE", "line_type": "REGULATED_CHARGE", "patterns": [r"FOSE", r"FISE", r"LEY\s+27510"], "taxable_default": False, "igv_credit": "NO", "requires_support": False},

    {"sector": "AGUA", "account_code": "636111", "account_name": "Agua potable - consumo", "line_type": "EXPENSE_OR_ASSET", "patterns": [r"SERVICIO\s+DE\s+AGUA", r"AGUA\s+POTABLE", r"CONSUMO\s+AGUA", r"\bAGUA\b"], "taxable_default": True, "igv_credit": "SI", "requires_support": False},
    {"sector": "AGUA", "account_code": "636112", "account_name": "Agua potable - alcantarillado", "line_type": "EXPENSE_OR_ASSET", "patterns": [r"ALCANTARILLADO", r"SANEAMIENTO"], "taxable_default": True, "igv_credit": "SI", "requires_support": False},
    {"sector": "AGUA", "account_code": "636113", "account_name": "Agua potable - cargo fijo", "line_type": "EXPENSE_OR_ASSET", "patterns": [r"CARGO\s+FIJO"], "taxable_default": True, "igv_credit": "SI", "requires_support": False},
    {"sector": "AGUA", "account_code": "636114", "account_name": "Agua potable - reposicion y mantenimiento", "line_type": "REGULATED_CHARGE", "patterns": [r"REPOSICI[OÓ]N", r"MANTENIMIENTO", r"CONEXI[OÓ]N", r"RECONEXI[OÓ]N"], "taxable_default": False, "igv_credit": "NO", "requires_support": False},
    {"sector": "AGUA", "account_code": "636115", "account_name": "Agua potable - cargos regulados/aportes/MRSE", "line_type": "REGULATED_CHARGE", "patterns": [r"MRSE", r"MECANISMO\s+DE\s+RETRIBUCI[OÓ]N", r"SERVICIOS\s+ECOSIST[EÉ]MICOS", r"APORTE", r"FONDO", r"CARGO\s+REGULADO"], "taxable_default": False, "igv_credit": "NO", "requires_support": False},

    {"sector": "TELECOM", "account_code": "636121", "account_name": "Internet empresarial", "line_type": "EXPENSE_OR_ASSET", "patterns": [r"INTERNET", r"BANDA\s+ANCHA", r"FIBRA", r"DATOS"], "taxable_default": True, "igv_credit": "SI", "requires_support": False},
    {"sector": "TELECOM", "account_code": "636122", "account_name": "Telefonia fija y movil", "line_type": "EXPENSE_OR_ASSET", "patterns": [r"TELEFON[IÍ]A", r"TELEFONO", r"CELULAR", r"M[OÓ]VIL", r"LINEA"], "taxable_default": True, "igv_credit": "SI", "requires_support": False},
    {"sector": "TELECOM", "account_code": "636123", "account_name": "Telecomunicaciones - instalacion/equipos", "line_type": "EXPENSE_OR_ASSET", "patterns": [r"INSTALACI[OÓ]N", r"ROUTER", r"MODEM", r"EQUIPO", r"RECONEXI[OÓ]N"], "taxable_default": True, "igv_credit": "SI", "requires_support": False},

    {"sector": "GAS", "account_code": "636131", "account_name": "Gas - consumo", "line_type": "EXPENSE_OR_ASSET", "patterns": [r"GAS\s+NATURAL", r"CONSUMO\s+GAS", r"\bGAS\b", r"GLP"], "taxable_default": True, "igv_credit": "SI", "requires_support": False},
    {"sector": "GAS", "account_code": "636132", "account_name": "Gas - cargo fijo/distribucion", "line_type": "EXPENSE_OR_ASSET", "patterns": [r"CARGO\s+FIJO", r"DISTRIBUCI[OÓ]N", r"TRANSPORTE"], "taxable_default": True, "igv_credit": "SI", "requires_support": False},
]

REGULATED_LINE_TYPES = {"REGULATED_CHARGE", "REGULATED_DISCOUNT"}


def _matches_any(patterns: list[str], value: str) -> bool:
    return any(re.search(pattern, value, flags=re.IGNORECASE) for pattern in patterns)


def _utility_service_rule(description: str, supplier_name: str = "") -> dict[str, Any] | None:
    text = f"{description or ''} {supplier_name or ''}".upper()
    for rule in UTILITY_SERVICE_LIBRARY:
        if _matches_any(rule["patterns"], text):
            return rule
    return None


def _is_rounding_description(description: str, code: str = "") -> bool:
    text = f"{code or ''} {description or ''}".upper()
    if _utility_service_rule(text):
        return False
    return bool(re.search(
        r"REDONDEO|ROUNDING|AJUSTE\s+POR\s+REDONDEO|SALDO\s+POR\s+REDONDEO|DIFERENCIA\s+(DE|POR)\s+REDONDEO|AJUSTE\s+MONEDA|REDONDEO\s+MES",
        text,
    ))


def _money(value: Any, default: str = "0.00") -> Decimal:
    try:
        raw = str(default if value is None or value == "" else value)
        raw = raw.replace("S/", "").replace("s/", "").replace(",", ".").strip()
        raw = re.sub(r"[^0-9.\-]", "", raw)
        if raw in {"", "-", ".", "-."}:
            raw = default
        return Decimal(raw).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except Exception:
        return Decimal(default).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _money_str(value: Any) -> str:
    return f"{_money(value):.2f}"


def _norm_text(value: Any) -> str:
    return str(value or "").strip()


def _norm_upper(value: Any) -> str:
    return _norm_text(value).upper()


def _only_digits(value: Any) -> str:
    return re.sub(r"\D", "", str(value or ""))


def _is_valid_ruc(value: Any) -> bool:
    digits = _only_digits(value)
    return len(digits) == 11 and digits[:2] in {"10", "15", "17", "20"}


def _line_kind(description: str, code: str = "") -> str:
    text = f"{code} {description}".upper()

    if _utility_service_rule(text):
        return "REGULATED_CHARGE"

    if _is_rounding_description(description, code):
        return "ROUNDING"

    if re.search(r"DEUDA\s+ANT|DEUDA\s+ANTERIOR|SALDO\s+ANTERIOR|SALDO\s+VENCIDO|RECIBO\s+ANTERIOR|PENDIENTE\s+DE\s+PAGO|CARGO\s+ANTERIOR", text):
        return "PRIOR_BALANCE"
    if re.search(r"PAGO\s+A\s+CUENTA|ABONO|SALDO\s+A\s+FAVOR|CREDITO\s+ANTERIOR|CR[EÉ]DITO\s+ANTERIOR|COMPENSACION|COMPENSACI[OÓ]N", text):
        return "ADVANCE_PAYMENT"
    if re.search(r"MORA|INTER[EÉ]S|INTERES|PENALIDAD|RECARGO|CARGO\s+POR\s+ATRASO", text):
        return "LATE_FEE"
    return "NORMAL"


def _classify_local(description: str, supplier_name: str = "", fallback_cost_center: str = CENTRO_COSTO_DEFAULT) -> dict[str, Any]:
    kind = _line_kind(description)
    utility_rule = _utility_service_rule(description, supplier_name)
    if utility_rule:
        return {
            "account_code": utility_rule["account_code"],
            "account_name": utility_rule["account_name"],
            "cost_center": fallback_cost_center,
            "tax_treatment": (
                f"Concepto sectorial {utility_rule['sector']} clasificado por biblioteca de servicios publicos. "
                "No es redondeo. IGV solo segun discriminacion expresa del comprobante y reglas vigentes del regulador/SUNAT."
            ),
            "deductibility": "DEDUCIBLE",
            "igv_credit": utility_rule["igv_credit"],
            "requires_support": bool(utility_rule.get("requires_support", False)),
            "line_type": utility_rule["line_type"],
            "ai_reason": f"Clasificado por biblioteca sectorial de servicios publicos: {utility_rule['account_name']}.",
            "ai_confidence": 0.97,
        }
    if kind == "ROUNDING":
        return {
            "account_code": ROUNDING_EXPENSE_ACCOUNT,
            "account_name": "Ajuste por redondeo",
            "cost_center": fallback_cost_center,
            "tax_treatment": "Redondeo monetario del comprobante. No integra base imponible del IGV, no genera credito fiscal y se usa para reconciliar el total impreso.",
            "deductibility": "DEDUCIBLE",
            "igv_credit": "NO",
            "requires_support": False,
            "line_type": "ROUNDING",
            "ai_reason": "Linea tecnica de redondeo/ajuste monetario.",
            "ai_confidence": 0.99,
        }
    if kind == "PRIOR_BALANCE":
        return {
            "account_code": PRIOR_BALANCE_ACCOUNT,
            "account_name": "Cuentas por pagar - deuda anterior",
            "cost_center": "-",
            "tax_treatment": "Saldo/deuda de periodo anterior. No representa gasto nuevo ni genera nuevo IGV credito fiscal; validar que la obligacion original fue registrada.",
            "deductibility": "REVISION",
            "igv_credit": "NO",
            "requires_support": False,
            "line_type": "PRIOR_BALANCE",
            "ai_reason": "La linea corresponde a deuda o saldo anterior incluido en el recibo.",
            "ai_confidence": 0.96,
        }
    if kind == "ADVANCE_PAYMENT":
        return {
            "account_code": PAYABLE_ACCOUNT,
            "account_name": "Compensacion / pago a cuenta",
            "cost_center": "-",
            "tax_treatment": "Pago a cuenta, abono o saldo a favor. No es gasto nuevo y no genera IGV; se aplica como compensacion de cuenta por pagar.",
            "deductibility": "NO_DEDUCIBLE",
            "igv_credit": "NO",
            "requires_support": False,
            "line_type": "ADVANCE_PAYMENT",
            "ai_reason": "La linea corresponde a abono, credito o pago a cuenta.",
            "ai_confidence": 0.96,
        }
    if kind == "LATE_FEE":
        return {
            "account_code": "659101",
            "account_name": "Moras, recargos e intereses por servicios",
            "cost_center": fallback_cost_center,
            "tax_treatment": "Mora, penalidad o recargo. No mezclar con el servicio principal. Deducibilidad e IGV sujetos a revision y sustento.",
            "deductibility": "REVISION",
            "igv_credit": "NO",
            "requires_support": True,
            "line_type": "LATE_FEE",
            "ai_reason": "La linea corresponde a mora, recargo o penalidad.",
            "ai_confidence": 0.86,
        }

    text = f"{description} {supplier_name}".lower()
    for rule in PCGE_RULE_LIBRARY:
        if any(keyword.lower() in text for keyword in rule["keywords"]):
            cc = rule.get("default_cost_center") or fallback_cost_center
            return {
                "account_code": rule["account_code"],
                "account_name": rule["account_name"],
                "cost_center": cc,
                "tax_treatment": rule["tax_treatment"],
                "deductibility": rule["deductibility"],
                "igv_credit": rule["igv_credit"],
                "requires_support": bool(rule.get("requires_support", False)),
                "line_type": "EXPENSE_OR_ASSET",
                "ai_reason": f"Clasificado por regla PCGE/local: {rule['account_name']}.",
                "ai_confidence": 0.93,
            }
    return {
        "account_code": "659101",
        "account_name": "Otros gastos de gestion",
        "cost_center": fallback_cost_center,
        "tax_treatment": "Requiere revision contable y tributaria por falta de regla confiable.",
        "deductibility": "REVISION",
        "igv_credit": "REVISION",
        "requires_support": True,
        "line_type": "EXPENSE_OR_ASSET",
        "ai_reason": "No se identifico una regla contable confiable.",
        "ai_confidence": 0.55,
    }


def _account_meta(account_code: str, account_name: str, accepts_partner: bool = True) -> dict[str, Any]:
    code = "".join(ch for ch in str(account_code or "") if ch.isdigit()) or "659101"
    first = code[:1]
    return {
        "account_code": code,
        "account_name": account_name or f"Cuenta {code}",
        "account_class": first,
        "statement": "BALANCE" if first in {"1", "2", "3", "4", "5"} else "PROFIT_LOSS",
        "nature": "CREDIT" if first in {"2", "3", "4", "5", "7"} else "DEBIT",
        "accepts_cost_center": first in {"6", "9"},
        "accepts_partner": accepts_partner,
    }


def _cost_center_meta(code: str) -> dict[str, str]:
    clean = _norm_upper(code) or CENTRO_COSTO_DEFAULT
    return {
        "code": clean,
        "name": COST_CENTER_LIBRARY.get(clean, {}).get("name") or clean,
        "parent_code": "",
    }


def _json_schema_instruction() -> str:
    pcge_rules = json.dumps(PCGE_RULE_LIBRARY, ensure_ascii=False)
    cc_rules = json.dumps(COST_CENTER_LIBRARY, ensure_ascii=False)
    legal_rules = json.dumps(LEGAL_TAX_REVIEW_LIBRARY, ensure_ascii=False)

    return f"""
Devuelve SOLO JSON valido, sin markdown, sin explicaciones fuera del JSON.

Eres CONTA_PRO Vision Accounting Engine, motor contable, tributario, legal-documentario y de auditoria para un ERP colombiano empresarial bajo normativa DIAN y Estatuto Tributario.

REGLA PRINCIPAL INNEGOCIABLE:
El TOTAL A PAGAR impreso en el comprobante manda. No modifiques el total para hacerlo coincidir con tus calculos. Si la suma de conceptos no coincide, crea una linea de ajuste por redondeo y marca observacion.

LECTURA PIXEL POR PIXEL Y ROLES DE DATOS:
1. Lee el comprobante completo, incluyendo encabezado, logo, datos del emisor, datos del cliente, periodo, detalle, totales, notas pequeñas, QR y talon.
2. El proveedor/emisor es la empresa que emite/cobra el comprobante. NO confundas el RUC del cliente, DNI, codigo de suministro, numero de medidor, codigo de pago, recibo o numero de contrato con el RUC proveedor.
3. El supplier_ruc debe ser un RUC de 11 digitos del emisor/proveedor. Si no estas seguro, deja supplier_ruc vacio y agrega warning. No inventes RUC.
4. supplier_name debe ser la razon social/nombre comercial del emisor/proveedor. Si no esta legible, deja vacio y agrega warning.
5. En recibos de servicios publicos, distingue: empresa emisora, titular/cliente, suministro, codigo de pago, medidor y recibo.

BIBLIOTECA PCGE/CRITERIOS BASE:
{pcge_rules}

BIBLIOTECA CENTROS DE COSTO:
{cc_rules}

BIBLIOTECA DE REVISION TRIBUTARIA/LEGAL:
{legal_rules}

REGLA RECIBO_PUBLICO_FLEXIBLE:
- En recibos de gobierno, municipalidad o servicios publicos/regulados, los montos impresos mandan.
- Lo mas importante es subcuenta correcta, centro de costo correcto y total igual al recibo.
- No crear ajuste adicional si ya existe redondeo explicito.
- FOSE/FISE posterior al total es informativo si el total cuadra sin sumarlo.
- Facturas comerciales normales siguen con validacion estricta.

REGLAS SECTORIALES DE SERVICIOS PUBLICOS - OBLIGATORIAS:
- Para electricidad, agua/saneamiento, telecom y gas, lee todos los conceptos y usa subcuentas.
- Aporte Ley 28749, FOSE, FISE, alumbrado publico, electrificacion, reposicion, mantenimiento, MRSE, fondos, aportes o cargos regulados NO son redondeo.
- Redondeo solo si el texto dice explicitamente redondeo, saldo por redondeo, diferencia por redondeo o ajuste monetario.
- Si aparece Aporte/Ley/FOSE/FISE/Alumbrado/MRSE/Saneamiento/Fondo/Cargo regulado, clasifica como REGULATED_CHARGE.
- No inventes IGV por concepto. Usa el IGV discriminado del comprobante.
- Si falta diferencia mayor a 0.10, busca concepto regulado omitido antes de crear ajuste.
- Subcuentas sugeridas:
  electricidad consumo 636101, cargo fijo 636102, alumbrado 636103, reposicion/mantenimiento 636104, aporte ley 636105, FOSE/FISE 636106.
  agua consumo 636111, alcantarillado 636112, cargo fijo 636113, reposicion/mantenimiento 636114, aportes/MRSE/cargos regulados 636115.
  internet 636121, telefonia 636122, equipos/instalacion telecom 636123.
  gas consumo 636131, cargo fijo/distribucion 636132.

REGLAS ESPECIALES OBLIGATORIAS:
- REDONDEO / ROUNDING / REDONDEO MES ACTUAL: linea tecnica de conciliacion monetaria. No es base imponible, no genera IGV, no requiere sustento humano si el importe es pequeno/razonable. Si aumenta el total, usar 659101 al debe. Si disminuye el total, usar 759901 al haber.
- DEUDA ANTERIOR / SALDO ANTERIOR / RECIBO ANTERIOR / SALDO VENCIDO: no es gasto nuevo, no genera nuevo IGV credito fiscal. Usar 421201 como deuda anterior/obligacion previa al debe si esta incluida dentro del total a pagar.
- PAGO A CUENTA / ABONO / SALDO A FAVOR / CREDITO ANTERIOR: no es gasto, no genera IGV. Tratar como compensacion o reduccion de cuenta por pagar.
- MORA / INTERES / PENALIDAD / RECARGO: no mezclar con servicios basicos. Clasificar separado, usualmente 659101, IGV credito NO/REVISION y requiere sustento.
- IGV: separar en 40111 solo si corresponde credito fiscal. No calcules IGV sobre deuda anterior, pago a cuenta, redondeo, mora o conceptos no gravados.
- Centros de costo: cuentas clase 6 o 9 deben tener centro de costo por linea.

FORMATO JSON OBLIGATORIO:
{{
  "document_type": "01|03|14|RECIBO_SERVICIO|OTRO",
  "serie": "",
  "number": "",
  "issue_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "period": "YYYY-MM",
  "supplier_ruc": "",
  "supplier_name": "",
  "currency": "PEN",
  "subtotal": "0.00",
  "igv": "0.00",
  "non_taxed_amount": "0.00",
  "exempt_amount": "0.00",
  "other_charges": "0.00",
  "rounding_adjustment": "0.00",
  "total": "0.00",
  "total_read_from_document": "0.00",
  "reconciliation_status": "OK|OBSERVED|REQUIRES_REVIEW",
  "reconciliation_difference": "0.00",
  "cost_center": "{CENTRO_COSTO_DEFAULT}",
  "expense_account": "636101",
  "items": [
    {{
      "code": "",
      "description": "",
      "unit": "UND",
      "quantity": "1.00",
      "unit_price": "0.00",
      "line_subtotal": "0.00",
      "taxable": true,
      "igv_amount": "0.00",
      "total_line": "0.00",
      "line_type": "EXPENSE_OR_ASSET|PRIOR_BALANCE|ADVANCE_PAYMENT|LATE_FEE|ROUNDING",
      "account_code": "",
      "account_name": "",
      "cost_center": "",
      "tax_treatment": "",
      "deductibility": "DEDUCIBLE|NO_DEDUCIBLE|OBSERVADO|REVISION",
      "igv_credit": "SI|NO|REVISION",
      "requires_bancarization": false,
      "requires_detraccion_review": false,
      "requires_support": false,
      "ai_reason": "",
      "ai_confidence": 0.00
    }}
  ],
  "account_lines": [
    {{
      "account_code": "",
      "account_name": "",
      "cost_center": "",
      "debit": "0.00",
      "credit": "0.00",
      "line_type": "EXPENSE_OR_ASSET|TAX|PAYABLE|ROUNDING|PRIOR_BALANCE|ADVANCE_PAYMENT|LATE_FEE|WITHHOLDING|DETRACTION|PERCEPTION",
      "tax_treatment": "",
      "audit_note": ""
    }}
  ],
  "accounts_to_upsert": [],
  "cost_centers_to_upsert": [],
  "warnings": [],
  "audit_metadata": {{
    "document_quality": "GOOD|MEDIUM|LOW",
    "ocr_warnings": [],
    "tax_warnings": [],
    "legal_warnings": [],
    "accounting_warnings": [],
    "reconciliation_notes": [],
    "requires_human_review": false,
    "review_reason": ""
  }}
}}

VALIDACION FINAL INTERNA ANTES DE RESPONDER:
- suma(account_lines.debit) = suma(account_lines.credit)
- total = total_read_from_document
- Cuentas clase 6 y 9 tienen centro de costo.
- IGV esta separado en 40111 si corresponde credito fiscal.
- Cuentas por pagar comerciales usa 4212.
- Si no cuadra, marca REQUIRES_REVIEW y explica.
"""



def _item_amount_value(item: dict[str, Any]) -> Decimal:
    return _money(item.get("line_subtotal") or item.get("total_line") or item.get("unit_price"))


def _set_item_amount_value(item: dict[str, Any], value: Decimal) -> None:
    amount = _money_str(value)
    item["line_subtotal"] = amount
    item["unit_price"] = amount
    item["total_line"] = amount


def _receipt_text_for_public_mode(data: dict[str, Any], items: list[dict[str, Any]]) -> str:
    return " ".join([_norm_upper(data.get("supplier_name")), _norm_upper(data.get("document_type"))] + [_norm_upper(i.get("description")) for i in items])


def _is_public_regulated_receipt(data: dict[str, Any], items: list[dict[str, Any]]) -> bool:
    txt = _receipt_text_for_public_mode(data, items)
    return any(t in txt for t in [
        "RECIBO_SERVICIO", "HIDRANDINA", "ELECTRONORTE", "ENEL", "LUZ DEL SUR", "ELECTRICIDAD",
        "SEDAPAL", "EPS", "SUNASS", "OSINERGMIN", "MUNICIPALIDAD", "SAT", "GOBIERNO",
        "MINISTERIO", "ESSALUD", "SUNAT", "FOSE", "FISE", "APORTE LEY", "ALUMBRADO PUBLICO",
        "ALUMBRADO PÚBLICO", "MRSE",
    ])


def _public_receipt_cleanup(
    data: dict[str, Any],
    items: list[dict[str, Any]],
    subtotal: Decimal,
    igv: Decimal,
    total_read: Decimal,
    warnings: list[str],
    tax_warnings: list[str],
    accounting_warnings: list[str],
    ocr_warnings: list[str],
    reconciliation_notes: list[str],
) -> tuple[list[dict[str, Any]], Decimal, Decimal]:
    if not _is_public_regulated_receipt(data, items):
        return items, subtotal, igv

    # 1) Eliminar ajuste ficticio si el recibo ya tiene redondeo visible.
    if any("REDONDEO" in _norm_upper(i.get("description")) for i in items):
        kept = []
        for i in items:
            d = _norm_upper(i.get("description"))
            fake = ("AJUSTE POR DIFERENCIA" in d or "DIFERENCIA DE LECTURA" in d or "CONCEPTO REGULADO NO IDENTIFICADO" in d or "AJUSTE OCR" in d)
            if fake:
                reconciliation_notes.append(f"Linea OCR eliminada por redondeo explicito: {i.get('description')}.")
                continue
            kept.append(i)
        items = kept

    # 2) Base visible para recibos electricos.
    base_tokens = ("CARGO FIJO", "REPOSICION", "REPOSICIÓN", "MANTENIMIENTO", "ENERGIA ACTIVA", "ENERGÍA ACTIVA", "ALUMBRADO PUBLICO", "ALUMBRADO PÚBLICO")
    base_sum = sum((_item_amount_value(i) for i in items if any(t in _norm_upper(i.get("description")) for t in base_tokens)), Decimal("0.00")).quantize(Decimal("0.01"))
    if base_sum > 0 and abs(subtotal - base_sum) <= Decimal("1.10"):
        if subtotal != base_sum:
            ocr_warnings.append(f"Subtotal corregido de {subtotal} a {base_sum} por bloque visible.")
        subtotal = base_sum
        data["subtotal"] = _money_str(subtotal)

    # 3) IGV desde subtotal visible: corrige 15.00 -> 16.00 cuando corresponde.
    if subtotal > 0:
        expected = (subtotal * Decimal("0.18")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if abs(igv - expected) <= Decimal("1.10"):
            if igv != expected:
                ocr_warnings.append(f"IGV corregido de {igv} a {expected} por SUB TOTAL visible {subtotal}.")
            igv = expected
            data["igv"] = _money_str(igv)

    saldo = sum((_item_amount_value(i) for i in items if "SALDO POR REDONDEO" in _norm_upper(i.get("description"))), Decimal("0.00"))
    aporte = sum((_item_amount_value(i) for i in items if "APORTE LEY" in _norm_upper(i.get("description")) or "LEY 28749" in _norm_upper(i.get("description")) or "LEY NRO" in _norm_upper(i.get("description"))), Decimal("0.00"))
    diff_items = [i for i in items if "DIFERENCIA DE REDONDEO" in _norm_upper(i.get("description")) or "DIFERENCIA POR REDONDEO" in _norm_upper(i.get("description"))]
    if diff_items:
        current = sum((_item_amount_value(i) for i in diff_items), Decimal("0.00")).quantize(Decimal("0.01"))
        expected_diff = (total_read - subtotal - igv - saldo - aporte).quantize(Decimal("0.01"))
        if abs(current - expected_diff) <= Decimal("2.00"):
            if current != expected_diff:
                ocr_warnings.append(f"Diferencia de redondeo corregida de {current} a {expected_diff} usando TOTAL impreso.")
            _set_item_amount_value(diff_items[0], expected_diff)

    # 4) FOSE/FISE informativo si el total cuadra sin sumarlo.
    diff = sum((_item_amount_value(i) for i in diff_items), Decimal("0.00")).quantize(Decimal("0.01"))
    fose_items = [i for i in items if "FOSE" in _norm_upper(i.get("description")) or "FISE" in _norm_upper(i.get("description"))]
    total_wo_fose = (subtotal + igv + saldo + aporte + diff).quantize(Decimal("0.01"))
    if fose_items and abs(total_wo_fose - total_read) <= Decimal("0.02"):
        for i in fose_items:
            i["line_type"] = "INFO_ONLY"
            i["taxable"] = False
            i["igv_amount"] = "0.00"
            i["requires_support"] = False
            i["tax_treatment"] = "FOSE/FISE informativo posterior al total; no se contabiliza doble si el total cuadra."
        reconciliation_notes.append("FOSE/FISE tratado como INFO_ONLY.")

    def keep(w: Any) -> bool:
        s = str(w).upper()
        return not any(x in s for x in ["IGV DECLARADO", "NO CORRESPONDE AL 18", "NO ES EL 18", "BASE IMPONIBLE", "AUDITOR", "DIFERENCIA MAYOR A TOLERANCIA"])

    warnings[:] = [w for w in warnings if keep(w)]
    tax_warnings[:] = [w for w in tax_warnings if keep(w)]
    accounting_warnings[:] = [w for w in accounting_warnings if keep(w)]
    reconciliation_notes.append("Modo RECIBO_PUBLICO_FLEXIBLE aplicado.")
    return items, subtotal, igv

def _normalize_ai_response(data: dict[str, Any]) -> dict[str, Any]:
    warnings = list(data.get("warnings") or [])
    audit = dict(data.get("audit_metadata") or {})
    accounting_warnings = list(audit.get("accounting_warnings") or [])
    tax_warnings = list(audit.get("tax_warnings") or [])
    legal_warnings = list(audit.get("legal_warnings") or [])
    ocr_warnings = list(audit.get("ocr_warnings") or [])
    reconciliation_notes = list(audit.get("reconciliation_notes") or [])

    supplier_name = _norm_text(data.get("supplier_name"))
    supplier_ruc = _only_digits(data.get("supplier_ruc"))
    if supplier_ruc and not _is_valid_ruc(supplier_ruc):
        warnings.append(f"RUC proveedor descartado por no ser RUC valido de 11 digitos: {supplier_ruc}.")
        supplier_ruc = ""
    if not supplier_name:
        warnings.append("No se pudo leer razon social del proveedor con seguridad.")
    if not supplier_ruc:
        warnings.append("No se pudo leer RUC del proveedor con seguridad; no se debe inventar.")

    fallback_cc = _norm_upper(data.get("cost_center")) or CENTRO_COSTO_DEFAULT

    items = []
    raw_items = data.get("items") or []
    for raw in raw_items:
        description = _norm_text(raw.get("description"))
        local = _classify_local(description, supplier_name, fallback_cc)
        kind = _norm_text(raw.get("line_type")) or local.get("line_type") or _line_kind(description, raw.get("code", ""))
        if kind != "INFO_ONLY" and local.get("line_type") in REGULATED_LINE_TYPES:
            kind = local["line_type"]
            raw["line_type"] = kind
            raw["taxable"] = False
            raw["igv_credit"] = local["igv_credit"]
            raw["requires_support"] = False

        account_code = _only_digits(raw.get("account_code")) or local["account_code"]
        account_name = _norm_text(raw.get("account_name")) or local["account_name"]
        cost_center = _norm_upper(raw.get("cost_center")) or local["cost_center"] or fallback_cc

        line_subtotal = _money(raw.get("line_subtotal") or raw.get("subtotal") or raw.get("unit_price"))
        total_line = _money(raw.get("total_line") or line_subtotal)
        igv_amount = _money(raw.get("igv_amount"))

        if kind in {"REGULATED_CHARGE", "REGULATED_DISCOUNT", "ROUNDING", "PRIOR_BALANCE", "ADVANCE_PAYMENT", "LATE_FEE"}:
            account_code = local["account_code"]
            account_name = local["account_name"]
            cost_center = local["cost_center"]
            igv_amount = Decimal("0.00")
            raw["taxable"] = False
            raw["igv_credit"] = local["igv_credit"]
            raw["requires_support"] = local["requires_support"]

        if kind == "ROUNDING" and abs(line_subtotal) <= AUTO_ROUNDING_TOLERANCE:
            raw["requires_support"] = False

        item = {
            "code": _norm_text(raw.get("code")),
            "description": description or account_name,
            "unit": _norm_text(raw.get("unit")) or "UND",
            "quantity": _money_str(raw.get("quantity") or "1"),
            "unit_price": _money_str(raw.get("unit_price") or line_subtotal),
            "line_subtotal": _money_str(line_subtotal),
            "taxable": bool(raw.get("taxable", True)),
            "igv_amount": _money_str(igv_amount),
            "total_line": _money_str(total_line),
            "line_type": kind if kind != "NORMAL" else "EXPENSE_OR_ASSET",
            "account_code": account_code,
            "account_name": account_name,
            "cost_center": cost_center,
            "tax_treatment": _norm_text(raw.get("tax_treatment")) or local["tax_treatment"],
            "deductibility": _norm_text(raw.get("deductibility")) or local["deductibility"],
            "igv_credit": _norm_text(raw.get("igv_credit")) or local["igv_credit"],
            "requires_bancarization": bool(raw.get("requires_bancarization", False)),
            "requires_detraccion_review": bool(raw.get("requires_detraccion_review", False)),
            "requires_support": bool(raw.get("requires_support", local.get("requires_support", False))),
            "ai_reason": _norm_text(raw.get("ai_reason")) or local["ai_reason"],
            "ai_confidence": float(raw.get("ai_confidence") or local["ai_confidence"]),
        }
        items.append(item)

    subtotal = _money(data.get("printed_subtotal") or data.get("subtotal") or sum(_money(item["line_subtotal"]) for item in items if item.get("line_type") == "EXPENSE_OR_ASSET"))
    igv = _money(data.get("printed_igv") or data.get("igv") or sum(_money(item.get("igv_amount")) for item in items))
    total_read = _money(data.get("printed_total") or data.get("total_read_from_document") or data.get("total") or subtotal + igv)
    total = total_read

    items, subtotal, igv = _public_receipt_cleanup(
        data, items, subtotal, igv, total_read,
        warnings, tax_warnings, accounting_warnings, ocr_warnings, reconciliation_notes
    )

    if not items and subtotal > 0:
        local = _classify_local(_norm_text(data.get("supplier_name")) or "gasto por clasificar", supplier_name, fallback_cc)
        items.append({
            "code": "",
            "description": "Gasto por clasificar desde comprobante",
            "unit": "UND",
            "quantity": "1.00",
            "unit_price": _money_str(subtotal),
            "line_subtotal": _money_str(subtotal),
            "taxable": True,
            "igv_amount": _money_str(igv),
            "total_line": _money_str(subtotal),
            "line_type": "EXPENSE_OR_ASSET",
            "account_code": local["account_code"],
            "account_name": local["account_name"],
            "cost_center": local["cost_center"],
            "tax_treatment": local["tax_treatment"],
            "deductibility": local["deductibility"],
            "igv_credit": local["igv_credit"],
            "requires_bancarization": False,
            "requires_detraccion_review": False,
            "requires_support": True,
            "ai_reason": "Linea creada por fallback por falta de detalle OCR.",
            "ai_confidence": 0.50,
        })
        warnings.append("OCR no devolvio items detallados; se creo linea fallback.")

    account_lines = []
    debit_by_key: dict[tuple[str, str, str, str], Decimal] = {}
    credit_by_key: dict[tuple[str, str, str, str], Decimal] = {}

    for item in items:
        code = _norm_text(item.get("account_code")) or "659101"
        name = _norm_text(item.get("account_name")) or f"Cuenta {code}"
        cc = _norm_upper(item.get("cost_center")) or fallback_cc
        kind = _norm_text(item.get("line_type")) or "EXPENSE_OR_ASSET"
        amount = _money(item.get("line_subtotal"))

        if kind == "INFO_ONLY":
            reconciliation_notes.append(f"Linea informativa no contabilizada: {item.get('description')}.")
            continue

        if kind == "ROUNDING" and abs(amount) <= AUTO_ROUNDING_TOLERANCE:
            pass
        elif kind == "ROUNDING":
            accounting_warnings.append(f"Redondeo superior a tolerancia automatica: {amount}. Revisar OCR o comprobante.")

        if kind in REGULATED_LINE_TYPES:
            target_cc = cc if code[:1] in {"6", "9"} else "-"
            key = (code, name, target_cc, kind)
            debit_by_key[key] = debit_by_key.get(key, Decimal("0.00")) + amount
            continue

        if kind == "ADVANCE_PAYMENT":
            # Si el comprobante muestra abono o saldo a favor como importe positivo, reduce el payable con credito de cuenta puente.
            key = (code, name, "-", kind)
            credit_by_key[key] = credit_by_key.get(key, Decimal("0.00")) + abs(amount)
            continue

        # Deuda anterior, gasto actual, mora y redondeo que incrementa total se reconocen al debe.
        target_cc = cc if code[:1] in {"6", "9"} else "-"
        key = (code, name, target_cc, kind)
        debit_by_key[key] = debit_by_key.get(key, Decimal("0.00")) + amount

        if item.get("requires_support") and kind not in {"ROUNDING", "PRIOR_BALANCE", "ADVANCE_PAYMENT"}:
            tax_warnings.append(f"{item.get('description')}: requiere sustento adicional.")

    for (code, name, cc, kind), amount in debit_by_key.items():
        if amount == 0:
            continue
        account_lines.append({
            "account_code": code,
            "account_name": name,
            "cost_center": cc,
            "debit": _money_str(amount),
            "credit": "0.00",
            "line_type": kind if kind in {"ROUNDING", "PRIOR_BALANCE", "LATE_FEE"} else "EXPENSE_OR_ASSET",
            "tax_treatment": "Clasificado por IA con validacion contable, tributaria y documental.",
            "audit_note": "",
        })

    for (code, name, cc, kind), amount in credit_by_key.items():
        if amount == 0:
            continue
        account_lines.append({
            "account_code": code,
            "account_name": name,
            "cost_center": cc,
            "debit": "0.00",
            "credit": _money_str(amount),
            "line_type": kind,
            "tax_treatment": "Abono, pago a cuenta o saldo a favor. No genera IGV ni gasto nuevo.",
            "audit_note": "",
        })

    if igv != 0:
        account_lines.append({
            "account_code": IGV_CREDIT_ACCOUNT,
            "account_name": "IGV credito fiscal",
            "cost_center": "-",
            "debit": _money_str(igv),
            "credit": "0.00",
            "line_type": "TAX",
            "tax_treatment": "IGV credito fiscal sujeto a validacion formal, causalidad y anotacion oportuna.",
            "audit_note": "",
        })

    debit_before_reconcile = sum(_money(line["debit"]) for line in account_lines)
    credit_before_reconcile = sum(_money(line["credit"]) for line in account_lines)
    expected_credit = total_read
    difference = (expected_credit + credit_before_reconcile - debit_before_reconcile).quantize(Decimal("0.01"))

    has_explicit_rounding = any("REDONDEO" in _norm_upper(item.get("description")) for item in items)

    if difference != 0 and not has_explicit_rounding:
        if difference > 0:
            account_lines.append({
                "account_code": ROUNDING_EXPENSE_ACCOUNT,
                "account_name": "Diferencia de conciliacion OCR / concepto regulado no identificado",
                "cost_center": fallback_cc,
                "debit": _money_str(difference),
                "credit": "0.00",
                "line_type": "ROUNDING",
                "tax_treatment": "Diferencia contra total impreso. Si excede tolerancia de redondeo, revisar concepto regulado omitido; no clasificar automaticamente como redondeo.",
                "audit_note": "El total del documento manda; se agrego ajuste al debe.",
            })
        else:
            account_lines.append({
                "account_code": ROUNDING_INCOME_ACCOUNT,
                "account_name": "Ajuste por redondeo favorable",
                "cost_center": "-",
                "debit": "0.00",
                "credit": _money_str(abs(difference)),
                "line_type": "ROUNDING",
                "tax_treatment": "Ajuste favorable para reconciliar contra total impreso; no integra base IGV. Revisar si excede tolerancia.",
                "audit_note": "El total del documento manda; se agrego ajuste al haber.",
            })
        reconciliation_notes.append(f"Ajuste automatico contra total impreso: {difference}.")
        if abs(difference) > AUTO_ROUNDING_TOLERANCE:
            accounting_warnings.append(f"Diferencia mayor a tolerancia de redondeo ({AUTO_ROUNDING_TOLERANCE}): {difference}. Revisar OCR/importes.")
    elif difference != 0 and has_explicit_rounding:
        reconciliation_notes.append(f"Diferencia {difference} no genera ajuste adicional porque ya existe redondeo explicito.")

    account_lines.append({
        "account_code": PAYABLE_ACCOUNT,
        "account_name": "Cuentas por pagar comerciales",
        "cost_center": "-",
        "debit": "0.00",
        "credit": _money_str(expected_credit),
        "line_type": "PAYABLE",
        "tax_treatment": "Reconocimiento de obligacion con proveedor por total del comprobante.",
        "audit_note": "",
    })

    total_debit = sum(_money(line["debit"]) for line in account_lines)
    total_credit = sum(_money(line["credit"]) for line in account_lines)
    reconciliation_difference = (total_debit - total_credit).quantize(Decimal("0.01"))

    if reconciliation_difference != 0:
        accounting_warnings.append(f"Asiento no cuadrado despues de reconciliacion: {reconciliation_difference}.")

    is_public_or_regulated_receipt = _is_public_regulated_receipt(data, items)
    if is_public_or_regulated_receipt and reconciliation_difference == 0:
        accounting_warnings = [w for w in accounting_warnings if "Asiento no cuadrado" in str(w)]
        requires_review = bool([w for w in warnings if "No se pudo leer RUC" in str(w) or "No se pudo leer razon social" in str(w)])
    else:
        requires_review = bool(accounting_warnings or [w for w in warnings if "No se pudo leer" in w] or data.get("requires_visual_review"))

    reconciliation_status = "OK" if reconciliation_difference == 0 and not requires_review else "REQUIRES_REVIEW"

    accounts_to_upsert = []
    seen_accounts = set()
    for line in account_lines:
        code = _norm_text(line.get("account_code"))
        if code and code not in seen_accounts:
            accounts_to_upsert.append(_account_meta(code, _norm_text(line.get("account_name")), accepts_partner=True))
            seen_accounts.add(code)

    cost_centers_to_upsert = []
    seen_centers = set()
    for line in account_lines:
        cc = _norm_upper(line.get("cost_center"))
        if cc and cc != "-" and cc not in seen_centers:
            cost_centers_to_upsert.append(_cost_center_meta(cc))
            seen_centers.add(cc)

    data.update({
        "document_type": data.get("document_type") or "RECIBO_SERVICIO",
        "serie": _norm_text(data.get("serie")),
        "number": _norm_text(data.get("number")),
        "issue_date": _norm_text(data.get("issue_date")),
        "due_date": _norm_text(data.get("due_date")),
        "period": _norm_text(data.get("period")),
        "supplier_ruc": supplier_ruc,
        "supplier_name": supplier_name,
        "currency": _norm_text(data.get("currency")) or "PEN",
        "subtotal": _money_str(subtotal),
        "igv": _money_str(igv),
        "non_taxed_amount": _money_str(data.get("non_taxed_amount")),
        "exempt_amount": _money_str(data.get("exempt_amount")),
        "other_charges": _money_str(data.get("other_charges")),
        "rounding_adjustment": _money_str(data.get("rounding_adjustment") or difference),
        "total": _money_str(total),
        "total_read_from_document": _money_str(total_read),
        "reconciliation_status": reconciliation_status,
        "reconciliation_difference": _money_str(reconciliation_difference),
        "cost_center": fallback_cc,
        "expense_account": account_lines[0]["account_code"] if account_lines else "659101",
        "items": items,
        "account_lines": account_lines,
        "accounts_to_upsert": accounts_to_upsert,
        "cost_centers_to_upsert": cost_centers_to_upsert,
        "warnings": warnings,
        "audit_metadata": {
            "document_quality": audit.get("document_quality") or "MEDIUM",
            "ocr_warnings": ocr_warnings,
            "tax_warnings": tax_warnings,
            "legal_warnings": legal_warnings,
            "accounting_warnings": accounting_warnings,
            "reconciliation_notes": reconciliation_notes,
            "requires_human_review": requires_review,
            "review_reason": "; ".join(accounting_warnings or warnings or []),
        },
    })

    return data


@router.post("/process-ia")
async def process_purchase_with_gemini(
    file: UploadFile = File(...),
    ctx=Depends(get_current_context),
):
    if not settings.gemini_api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY no configurado")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Archivo vacio")

    mime_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    encoded = base64.b64encode(raw).decode("utf-8")

    try:
        import google.generativeai as genai
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Falta instalar google-generativeai. Ejecuta: pip install google-generativeai",
        ) from exc

    prompt = f"""
Eres CONTA_PRO Vision Accounting Engine.
Analiza el archivo como comprobante empresarial colombiano bajo normativa DIAN.
Analiza el archivo como comprobante empresarial colombiano.
Usa criterio contable, tributario, legal-documentario y auditoria.
{_json_schema_instruction()}
"""

    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model or "gemini-1.5-pro")
        result = model.generate_content(
            [
                prompt,
                {
                    "mime_type": mime_type,
                    "data": encoded,
                },
            ],
            generation_config={
                "temperature": 0.02,
                "response_mime_type": "application/json",
            },
        )

        text = result.text or "{}"
        data = json.loads(text)

        if not isinstance(data, dict):
            raise ValueError("Gemini no devolvio un objeto JSON")

        return _normalize_ai_response(data)

    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini devolvio JSON invalido: {str(exc)}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error Gemini: {str(exc)}") from exc
