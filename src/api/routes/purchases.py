from __future__ import annotations

import json
import mimetypes
import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from src.api.dependencies import get_current_context
from src.config import settings
from src.infrastructure.adapters.ai.vision_provider import get_vision_client, is_vision_available, active_provider_name

router = APIRouter(prefix="/purchases", tags=["Purchases IA"])

CENTRO_COSTO_DEFAULT = "BOG-ADM"
ROUNDING_EXPENSE_ACCOUNT = "539595"   # Gastos varios PUC Colombia
ROUNDING_INCOME_ACCOUNT  = "429595"   # Ingresos diversos PUC Colombia
PRIOR_BALANCE_ACCOUNT    = "220505"   # Proveedores PUC Colombia
PAYABLE_ACCOUNT          = "2205"     # Proveedores nacionales PUC
IVA_DESCONTABLE_ACCOUNT  = "2408"     # IVA por pagar (descontable) PUC
AUTO_ROUNDING_TOLERANCE  = Decimal("0.50")

COST_CENTER_LIBRARY = {
    "BOG-ADM": {
        "name": "Administracion Bogota",
        "keywords": ["administracion", "oficina", "gerencia", "servicios publicos", "luz", "agua", "internet", "telefono"],
    },
    "BOG-COM": {
        "name": "Comercial Bogota",
        "keywords": ["venta", "comercial", "marketing", "publicidad", "cliente", "campaña"],
    },
    "MED-OPS": {
        "name": "Operaciones Medellin",
        "keywords": ["produccion", "planta", "maquina", "operacion", "energia productiva"],
    },
    "CAL-OPS": {
        "name": "Operaciones Cali",
        "keywords": ["produccion cali", "planta cali", "operacion cali"],
    },
    "FIN-TES": {
        "name": "Tesoreria y Finanzas",
        "keywords": ["banco", "comision bancaria", "interes financiero", "tesoreria", "gmf", "4x1000"],
    },
    "FIN-CXP": {
        "name": "Cuentas por Pagar",
        "keywords": ["proveedor", "cuentas por pagar", "cxp", "saldo anterior"],
    },
    "FIN-CXC": {
        "name": "Cuentas por Cobrar",
        "keywords": ["cliente", "cobranza", "cxc"],
    },
    "TI-CORE": {
        "name": "Tecnologia y Sistemas",
        "keywords": ["software", "servidor", "nube", "hosting", "sistema", "licencia", "computadora", "laptop"],
    },
    "LOG-ALM": {
        "name": "Logistica Almacen",
        "keywords": ["flete", "transporte", "almacen", "logistica", "courier", "delivery"],
    },
    "RRHH": {
        "name": "Recursos Humanos",
        "keywords": ["nomina", "capacitacion", "personal", "rrhh", "bienestar"],
    },
}

PUC_RULE_LIBRARY = [
    # ── SERVICIOS / GASTOS CORRIENTES (no ingresan al almacén) ──────────────
    {
        "account_code": "513540",
        "account_name": "Servicios publicos (administracion)",
        "is_inventory": False,
        "keywords": [
            "agua", "acueducto", "epm", "empresas publicas", "luz", "electricidad", "energia",
            "codensa", "celsia", "electrificadora", "gas natural", "surtigas", "gases del caribe",
            "internet", "telefono", "telefonia", "claro", "movistar", "tigo", "etb", "une",
            "cargo fijo", "alumbrado publico", "reconexion", "mantenimiento electrico",
            "acometida", "contador energia"
        ],
        "default_cost_center": "BOG-ADM",
        "tax_treatment": "IVA descontable si cumple causalidad, NIT valido en DIAN y factura electronica con CUFE.",
        "deductibility": "DEDUCIBLE",
        "iva_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "513035",
        "account_name": "Honorarios y consultoria",
        "is_inventory": False,
        "keywords": ["asesoria", "consultoria", "consultor", "legal", "contable", "auditoria", "honorario", "profesional"],
        "default_cost_center": "BOG-ADM",
        "tax_treatment": "Aplicar ReteFuente 11% persona juridica / 10% persona natural declarante. IVA descontable 19%.",
        "deductibility": "DEDUCIBLE",
        "iva_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "513575",
        "account_name": "Transporte, fletes y acarreos",
        "is_inventory": False,
        "keywords": ["flete", "transporte", "courier", "delivery", "traslado", "carga", "envio", "mensajeria"],
        "default_cost_center": "LOG-ALM",
        "tax_treatment": "ReteFuente 3.5% sobre valor bruto. IVA descontable. Verificar NIT transportador en DIAN.",
        "deductibility": "DEDUCIBLE",
        "iva_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "513545",
        "account_name": "Mantenimiento y reparaciones",
        "is_inventory": False,
        "keywords": ["mantenimiento", "reparacion", "soporte tecnico", "servicio tecnico"],
        "default_cost_center": "BOG-ADM",
        "tax_treatment": "ReteFuente 4% servicios. IVA descontable 19%. Verificar NIT proveedor activo en DIAN.",
        "deductibility": "DEDUCIBLE",
        "iva_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "513510",
        "account_name": "Arrendamientos",
        "is_inventory": False,
        "keywords": ["alquiler", "arrendamiento", "renta", "local", "bodega", "oficina arrendada"],
        "default_cost_center": "BOG-ADM",
        "tax_treatment": "ReteFuente 3.5% arrendamiento inmueble. IVA si arrendador es responsable. Verificar contrato.",
        "deductibility": "DEDUCIBLE",
        "iva_credit": "REVISION",
        "requires_support": True,
    },
    {
        "account_code": "513570",
        "account_name": "Publicidad, propaganda y promocion",
        "is_inventory": False,
        "keywords": ["publicidad", "marketing", "anuncio", "campaña", "redes", "diseño grafico", "pauta"],
        "default_cost_center": "BOG-COM",
        "tax_treatment": "IVA descontable 19%. ReteFuente 4% si servicio. Acreditar necesidad comercial y causalidad.",
        "deductibility": "DEDUCIBLE",
        "iva_credit": "SI",
        "requires_support": False,
    },
    # ── INVENTARIO — BIENES FÍSICOS QUE INGRESAN AL ALMACÉN ─────────────────
    {
        "account_code": "1430",
        "account_name": "Mercancias no fabricadas por la empresa",
        "is_inventory": True,
        "item_class": "MERCADERIA",
        "keywords": [
            "mercancia", "producto para venta", "articulo para reventa", "producto terminado para venta",
            "stock para venta", "producto comercial", "articulo comercial"
        ],
        "default_cost_center": "LOG-ALM",
        "tax_treatment": "Bien inventariable para reventa. Afecta kardex. IVA descontable si NIT valido en DIAN.",
        "deductibility": "DEDUCIBLE",
        "iva_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "1435",
        "account_name": "Materias primas",
        "is_inventory": True,
        "item_class": "MATERIA_PRIMA",
        "keywords": [
            "cemento", "concreto", "acero", "varilla corrugada", "madera",
            "triplex", "plywood", "ladrillo", "ceramica", "porcelanato", "pintura",
            "mortero", "yeso", "cal", "barniz", "laca", "resina",
            "tela", "hilo", "cuero", "plastico", "caucho", "vidrio",
            "arena", "gravilla", "piedra triturada", "ripio", "agregado", "arcilla"
        ],
        "default_cost_center": "MED-OPS",
        "tax_treatment": "Materia prima para produccion. Afecta kardex. IVA descontable si cumple requisitos DIAN.",
        "deductibility": "DEDUCIBLE",
        "iva_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "1455",
        "account_name": "Materiales, repuestos y accesorios",
        "is_inventory": True,
        "item_class": "INSUMOS",
        "keywords": [
            "papel bond", "papel a4", "papel oficio", "toner", "cartucho tinta",
            "utiles escritorio", "archivador", "folder", "cinta adhesiva",
            "lapiz", "boligrafo", "engrapadora", "perforadora", "post it", "resma",
            "jabon", "detergente", "hipoclorito", "desinfectante", "papel higienico", "escoba",
            "trapero", "bolsa", "guante latex", "alcohol", "gel antibacterial",
            "gasolina", "acpm", "diesel", "combustible", "aceite motor", "lubricante",
            "grasa industrial", "gas natural vehicular",
            "casco", "guante cuero", "guante nitrilo", "lentes seguridad",
            "botas seguridad", "chaleco reflectivo", "tapa oidos", "respirador",
            "arnes", "epp", "elemento proteccion personal",
            "suministro", "insumo", "consumible",
            "repuesto", "pieza cambio", "broca", "cuchilla",
            "filtro aceite", "filtro aire", "correa", "rodamiento",
            "valvula", "sello", "empaque", "retenedor"
        ],
        "default_cost_center": "LOG-ALM",
        "tax_treatment": "Suministro/repuesto inventariable. Afecta kardex. IVA descontable si cumple requisitos DIAN.",
        "deductibility": "DEDUCIBLE",
        "iva_credit": "SI",
        "requires_support": False,
    },
    {
        "account_code": "1528",
        "account_name": "Equipo de computo y comunicacion (activo fijo)",
        "is_inventory": True,
        "item_class": "ACTIVO_FIJO",
        "keywords": [
            "laptop", "computador", "computadora", "pc escritorio", "monitor", "impresora",
            "escaner", "proyector", "servidor", "switch", "router", "ups",
            "telefono ip", "tablet", "celular corporativo", "camara ip"
        ],
        "default_cost_center": "TI-CORE",
        "tax_treatment": "Activo fijo depreciable (3 años). IVA descontable. Capitalizar si supera 50% UVT (2026: ~$2.330.000 COP).",
        "deductibility": "REVISION",
        "iva_credit": "REVISION",
        "requires_support": True,
    },
    {
        "account_code": "1520",
        "account_name": "Maquinaria y equipo (activo fijo)",
        "is_inventory": True,
        "item_class": "ACTIVO_FIJO",
        "keywords": [
            "maquina", "maquinaria", "equipo industrial", "horno", "prensa",
            "compresor industrial", "planta electrica", "grupo electrogeno",
            "refrigerador industrial", "aire acondicionado", "planta de agua"
        ],
        "default_cost_center": "MED-OPS",
        "tax_treatment": "Activo fijo depreciable (10 años). IVA descontable. Capitalizar. Verificar soporte tecnico.",
        "deductibility": "REVISION",
        "iva_credit": "REVISION",
        "requires_support": True,
    },
    {
        "account_code": "1520",
        "account_name": "Herramientas y utensilios electromecánicos",
        "is_inventory": True,
        "item_class": "HERRAMIENTAS",
        "keywords": [
            "taladro", "amoladora", "esmeril", "soldadora", "nivel laser",
            "compresor", "pistola pintura", "llave torquimetro", "destornillador electrico",
            "mezcladora concreto", "vibrador concreto", "sierra circular",
            "martillo neumatico", "andamio", "escalera metalica",
            "pulidora", "lijadora", "fresadora", "torno"
        ],
        "default_cost_center": "MED-OPS",
        "tax_treatment": "Herramienta electromecánica. Evaluar capitalización según política de empresa Colombia.",
        "deductibility": "REVISION",
        "iva_credit": "SI",
        "requires_support": True,
    },
]

# Alias para compatibilidad con código que referencie PCGE_RULE_LIBRARY
PCGE_RULE_LIBRARY = PUC_RULE_LIBRARY

# Mapa rapido cuenta inventario PUC → clase de articulo (para auto-crear en almacen)
INVENTARIO_ACCOUNT_CLASS: dict[str, str] = {
    "14": "MERCADERIA",   # 14xx = Inventarios PUC Colombia
    "15": "ACTIVO_FIJO",  # 15xx = Propiedades planta y equipo
    "16": "ACTIVO_FIJO",  # 16xx = Intangibles
}

# ─── Reglas servicios públicos domiciliarios Colombia (CREG) ─────────────────
ELECTRIC_REGULATED_RULES = [
    {
        "keywords": ("CONTRIBUCION LEY", "FONDO ESPECIAL", "CARGO SOCIAL"),
        "account_code": "513542",
        "account_name": "Servicios publicos - Contribucion especial",
        "taxable": False,
        "tax_treatment": "Cargo regulado no sujeto a IVA; subcuenta de servicios publicos.",
    },
    {
        "keywords": ("SUBSIDIO ESTRATOS", "SUBSIDIO TARIFA", "APORTE SOLIDARIDAD"),
        "account_code": "513543",
        "account_name": "Servicios publicos - Subsidio/aporte solidaridad",
        "taxable": False,
        "tax_treatment": "Cargo regulado por solidaridad no afecto a IVA.",
    },
    {
        "keywords": ("ALUMBRADO PUBLICO", "ALUMBRADO PÚBLICO", "IMPUESTO ALUMBRADO"),
        "account_code": "513040",
        "account_name": "Impuestos - Alumbrado publico",
        "taxable": False,
        "tax_treatment": "Impuesto municipal de alumbrado publico (no es IVA ni servicio).",
    },
    {
        "keywords": ("CARGO FIJO", "CARGO FIJO ENERGIA", "CARGO FIJO GAS"),
        "account_code": "513541",
        "account_name": "Servicios publicos - Cargo fijo",
        "taxable": True,
        "tax_treatment": "Cargo fijo regulado del servicio publico domiciliario sujeto a IVA.",
    },
    {
        "keywords": (
            "MANTENIMIENTO RED", "CARGO MANTENIMIENTO", "MANTENIMIENTO ELECTRICO",
            "MANTENIMIENTO RED GAS",
        ),
        "account_code": "513544",
        "account_name": "Servicios publicos - Cargo mantenimiento red",
        "taxable": True,
        "tax_treatment": "Cargo regulado de mantenimiento de red sujeto a IVA.",
    },
    {
        "keywords": (
            "ENERGIA ACTIVA", "ENERGÍA ACTIVA", "CONSUMO ACTIVO",
            "ENERGIA REACTIVA", "ENERGÍA REACTIVA", "POTENCIA",
        ),
        "account_code": "636101",
        "account_name": "Energia electrica - Consumo activo",
        "taxable": True,
        "tax_treatment": "Consumo de energia electrica activa afecto al IVA.",
    },
]

# ─── SUNASS: Agua potable y saneamiento ──────────────────────────────────────
WATER_REGULATED_RULES = [
    {
        "keywords": ("CARGO FIJO AGUA", "CARGO FIJO DE AGUA", "CARGO BASICO AGUA"),
        "account_code": "636201",
        "account_name": "Agua potable - Cargo fijo",
        "taxable": True,
        "tax_treatment": "Cargo fijo regulado del servicio de agua potable afecto al IVA.",
    },
    {
        "keywords": (
            "CONSUMO DE AGUA", "AGUA POTABLE", "VOLUMEN CONSUMIDO",
            "M3", "METROS CUBICOS", "METROS CÚBICOS",
        ),
        "account_code": "636202",
        "account_name": "Agua potable - Consumo",
        "taxable": True,
        "tax_treatment": "Consumo de agua potable afecto al IVA.",
    },
    {
        "keywords": (
            "ALCANTARILLADO", "DESAGUE", "DESAGÜE", "SERVICIO DE ALCANTARILLADO",
            "TRATAMIENTO", "AGUAS RESIDUALES",
        ),
        "account_code": "636203",
        "account_name": "Agua potable - Alcantarillado y saneamiento",
        "taxable": True,
        "tax_treatment": "Cargo de alcantarillado y saneamiento afecto al IVA.",
    },
    {
        "keywords": ("SUNASS", "APORTE SUNASS", "REGULACION SUNASS"),
        "account_code": "636204",
        "account_name": "Agua potable - Aporte SUNASS",
        "taxable": False,
        "tax_treatment": "Cargo regulado SUNASS no afecto al IVA.",
    },
]

# ─── OSINERGMIN: Gas natural ──────────────────────────────────────────────────
GAS_REGULATED_RULES = [
    {
        "keywords": ("CARGO FIJO GAS", "CARGO FIJO DE GAS", "CARGO BASICO GAS"),
        "account_code": "636301",
        "account_name": "Gas natural - Cargo fijo",
        "taxable": True,
        "tax_treatment": "Cargo fijo regulado del servicio de gas natural afecto al IVA.",
    },
    {
        "keywords": (
            "CONSUMO DE GAS", "GAS NATURAL", "VOLUMEN GAS",
            "M3 GAS", "THERMS", "ENERGIA GAS",
        ),
        "account_code": "636302",
        "account_name": "Gas natural - Consumo",
        "taxable": True,
        "tax_treatment": "Consumo de gas natural afecto al IVA.",
    },
    {
        "keywords": ("TRANSPORTE GAS", "CARGO TRANSPORTE", "DISTRIBUCION GAS"),
        "account_code": "636303",
        "account_name": "Gas natural - Transporte y distribucion",
        "taxable": True,
        "tax_treatment": "Cargo de transporte y distribucion de gas afecto al IVA.",
    },
]

# ─── OSIPTEL: Telecomunicaciones ─────────────────────────────────────────────
TELECOM_REGULATED_RULES = [
    {
        "keywords": (
            "RENTA BASICA", "CARGO FIJO TELEFONO", "CARGO FIJO INTERNET",
            "CARGO BASICO", "PLAN BASICO",
        ),
        "account_code": "636401",
        "account_name": "Telecomunicaciones - Cargo fijo / renta basica",
        "taxable": True,
        "tax_treatment": "Cargo fijo de telecomunicaciones afecto al IVA.",
    },
    {
        "keywords": (
            "INTERNET", "BANDA ANCHA", "FIBRA OPTICA", "FIBRA ÓPTICA",
            "SERVICIO INTERNET", "ACCESO INTERNET",
        ),
        "account_code": "636402",
        "account_name": "Telecomunicaciones - Internet",
        "taxable": True,
        "tax_treatment": "Servicio de internet afecto al IVA.",
    },
    {
        "keywords": (
            "TELEFONIA", "TELEFONÍA", "LLAMADAS", "MINUTOS",
            "TELEFONO FIJO", "TELÉFONO FIJO", "LINEA TELEFONICA",
        ),
        "account_code": "636403",
        "account_name": "Telecomunicaciones - Telefonia",
        "taxable": True,
        "tax_treatment": "Servicio de telefonia afecto al IVA.",
    },
    {
        "keywords": (
            "CABLE", "TV CABLE", "TELEVISION", "TELEVISIÓN",
            "SENAL TV", "SEÑAL TV", "STREAMING",
        ),
        "account_code": "636404",
        "account_name": "Telecomunicaciones - Television por cable",
        "taxable": True,
        "tax_treatment": "Servicio de television por cable afecto al IVA.",
    },
    {
        "keywords": ("OSIPTEL", "APORTE OSIPTEL", "FITEL"),
        "account_code": "636405",
        "account_name": "Telecomunicaciones - Aporte OSIPTEL/FITEL",
        "taxable": False,
        "tax_treatment": "Aporte regulado OSIPTEL/FITEL no afecto al IVA.",
    },
]


LEGAL_TAX_REVIEW_LIBRARY = [
    "Causalidad del gasto (Art. 107 ET Colombia): relacion directa o razonable con actividad productora de renta.",
    "Fehaciencia: conservar comprobante, contrato, orden, guia, evidencia de prestacion, conformidad y medio de pago.",
    "Bancarizacion: en Colombia operaciones > $1.000.000 COP requieren pago bancarizado para ser deducibles (Art. 771-5 ET).",
    "IVA descontable: validar factura electronica con CUFE, NIT activo en DIAN, operacion gravada, vinculada con actividad generadora de IVA.",
    "Retencion en la fuente: aplicar tarifas correctas segun concepto (compras 3.5%, servicios 4%, honorarios 11%) y verificar cuantia minima.",
    "Retencion/percepcion: evaluar condicion del proveedor, regimen aplicable y comprobante.",
    "No deducibles u observados: multas, sanciones, gastos personales, liberalidades o conceptos sin causalidad.",
    "Servicios publicos Colombia: separar consumo actual, cargo fijo, alumbrado publico (impuesto municipal), mantenimiento red, deuda anterior, mora/intereses e IVA.",
    "Redondeo monetario: linea tecnica de conciliacion. No integra base gravable del IVA ni genera IVA descontable; no debe bloquear si esta dentro de tolerancia razonable.",
]


def _money(value: Any, default: str = "0.00") -> Decimal:
    try:
        raw = str(default if value is None or value == "" else value)
        raw = raw.replace("S/", "").replace("s/", "").strip()
        raw = re.sub(r"\s", "", raw)
        # Detectar formato: si hay tanto punto como coma, el último es el separador decimal.
        # Formato peruano/europeo "1.590,20" → 1590.20
        # Formato anglosajón "1,590.20" → 1590.20
        if "," in raw and "." in raw:
            if raw.rfind(",") > raw.rfind("."):
                raw = raw.replace(".", "").replace(",", ".")
            else:
                raw = raw.replace(",", "")
        elif "," in raw:
            raw = raw.replace(",", ".")
        raw = re.sub(r"[^0-9.\-]", "", raw)
        # Si quedaron múltiples puntos, conservar solo el último como decimal
        if raw.count(".") > 1:
            parts = raw.split(".")
            raw = "".join(parts[:-1]) + "." + parts[-1]
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


def _is_valid_nit(value: Any) -> bool:
    """Valida NIT colombiano con algoritmo módulo 11 de la DIAN.
    Acepta NIT de 9 dígitos (sin dígito de verificación) o 10 (con dígito).
    """
    digits = _only_digits(value)
    if len(digits) not in (9, 10) or digits[0] == '0':
        return False
    if len(digits) == 9:
        return True  # formato sin dígito de verificación es válido estructuralmente
    # Verificar dígito de control (posición 10)
    nit_base = digits[:9]
    check = int(digits[9])
    factors = [3, 7, 13, 17, 19, 23, 29, 37, 41]  # de derecha a izquierda
    total = sum(int(d) * f for d, f in zip(reversed(nit_base), factors))
    remainder = total % 11
    expected = remainder if remainder <= 1 else 11 - remainder
    return expected == check


# Alias para compatibilidad con código existente que use _is_valid_ruc
_is_valid_ruc = _is_valid_nit


def _line_kind(description: str, code: str = "") -> str:
    text = f"{code} {description}".upper()
    if re.search(r"REDONDEO|ROUNDING|AJUSTE\s+MONEDA|DIFERENCIA\s+DE\s+REDONDEO|REDONDEO\s+MES", text):
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
    if kind == "ROUNDING":
        return {
            "account_code": ROUNDING_EXPENSE_ACCOUNT,
            "account_name": "Ajuste por redondeo",
            "cost_center": fallback_cost_center,
            "tax_treatment": "Redondeo monetario del comprobante. No integra base imponible del IGV, no genera credito fiscal y se usa para reconciliar el total impreso.",
            "deductibility": "DEDUCIBLE",
            "iva_credit": "NO",
            "requires_support": False,
            "line_type": "ROUNDING",
            "is_inventory": False,
            "item_class": None,
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
            "iva_credit": "NO",
            "requires_support": False,
            "line_type": "PRIOR_BALANCE",
            "is_inventory": False,
            "item_class": None,
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
            "iva_credit": "NO",
            "requires_support": False,
            "line_type": "ADVANCE_PAYMENT",
            "is_inventory": False,
            "item_class": None,
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
            "iva_credit": "NO",
            "requires_support": True,
            "line_type": "LATE_FEE",
            "is_inventory": False,
            "item_class": None,
            "ai_reason": "La linea corresponde a mora, recargo o penalidad.",
            "ai_confidence": 0.86,
        }

    text = f"{description} {supplier_name}".lower()
    for rule in PCGE_RULE_LIBRARY:
        if any(keyword.lower() in text for keyword in rule["keywords"]):
            cc = rule.get("default_cost_center") or fallback_cost_center
            is_inv = bool(rule.get("is_inventory", False))
            return {
                "account_code": rule["account_code"],
                "account_name": rule["account_name"],
                "cost_center": cc,
                "tax_treatment": rule["tax_treatment"],
                "deductibility": rule["deductibility"],
                "iva_credit": rule["iva_credit"],
                "requires_support": bool(rule.get("requires_support", False)),
                "line_type": "INVENTORY_PURCHASE" if is_inv else "EXPENSE_OR_ASSET",
                "is_inventory": is_inv,
                "item_class": rule.get("item_class"),
                "ai_reason": f"Clasificado por regla PUC/local Colombia: {rule['account_name']}.",
                "ai_confidence": 0.93,
            }
    return {
        "account_code": "659101",
        "account_name": "Otros gastos de gestion",
        "cost_center": fallback_cost_center,
        "tax_treatment": "Requiere revision contable y tributaria por falta de regla confiable.",
        "deductibility": "REVISION",
        "iva_credit": "REVISION",
        "requires_support": True,
        "line_type": "EXPENSE_OR_ASSET",
        "is_inventory": False,
        "item_class": None,
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

Eres CONTA_COLPRO Vision Accounting Engine, motor contable, tributario, legal-documentario y de auditoria para un ERP colombiano empresarial bajo normativa DIAN y Estatuto Tributario de Colombia.

══════════════════════════════════════════════════════════════════
DETECCIÓN OBLIGATORIA: INVENTARIO vs GASTO/SERVICIO
══════════════════════════════════════════════════════════════════
REGLA FUNDAMENTAL: Determina si cada ítem es un BIEN FÍSICO TANGIBLE o un SERVICIO.

BIEN FÍSICO TANGIBLE (ingresa al almacén → account_code = cuenta inventario PUC Colombia 14xx o 15xx):
  ┌──────────┬─────────────────────────────────────┬──────────────────────────────────────────────────────┐
  │ Cuenta   │ Nombre PUC Colombia                 │ Cuando usar                                          │
  ├──────────┼─────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ 1430     │ Mercancias no fabricadas            │ Productos para reventa (comercio)                    │
  │ 1435     │ Materias primas                     │ Cemento, acero, madera, ladrillo, pintura, tela      │
  │          │                                     │ Arena, gravilla, piedra triturada, mineral, arcilla  │
  │ 1455     │ Materiales, repuestos y accesorios  │ Papel, toner, utiles, elementos aseo, EPP            │
  │          │                                     │ combustible, aceite, lubricantes, repuestos maq.     │
  │          │                                     │ HERRAMIENTAS MANUALES de bajo valor: PALA, PICO,     │
  │          │                                     │ COMBA, BARRETA, RASTRILLO, SERRUCHO, CINCEL, etc.    │
  │ 1540     │ Flota y equipo de transporte        │ Vehiculos (activo fijo)                              │
  │ 1528     │ Equipo de computo y comunicacion    │ Laptops, PCs, servidores, equipos electronicos       │
  │ 1520     │ Maquinaria y equipo                 │ Herramientas ELECTROMECÁNICAS de alto valor          │
  │          │                                     │ taladros, amoladoras, soldadoras, compresoras        │
  │          │                                     │ NO usar 1520 para palas, picos, combas manuales      │
  │          │                                     │ → esas van a 1455                                    │
  └──────────┴─────────────────────────────────────┴──────────────────────────────────────────────────────┘
  → is_inventory = true
  → line_type = "INVENTORY_PURCHASE"
  → El account_code del item DEBE ser la cuenta de inventario PUC (14xx o 15xx), NO la cuenta de gasto (5xxx)
  → REGLA CLAVE: Herramientas MANUALES simples (pala, pico, comba, barreta, rastrillo,
    serrucho, cincel, carretilla, martillo, paleta) → SIEMPRE cuenta 1455, NUNCA 1520
  → REGLA CLAVE: 1520 es SOLO para herramientas eléctricas/mecánicas de alto valor

SERVICIO / GASTO CORRIENTE (NO ingresa al almacén → account_code = cuenta gasto PUC 5xxx):
  - 513540: servicios publicos domiciliarios (luz, agua, gas, internet, telefonia) — EPM, Codensa, Celsia, ETB, Claro
  - 513035: honorarios y consultoria
  - 513575: fletes, transporte y acarreos
  - 513545: mantenimiento y reparaciones
  - 513510: arrendamientos de local u oficina
  - 513570: publicidad, propaganda y promocion
  - 519595: otros gastos de administracion
  → is_inventory = false
  → line_type = "EXPENSE_OR_ASSET"

EJEMPLOS CRITICOS (aplican para CUALQUIER factura en Colombia):
  "Papel Bond A4 x 500 hojas"              → cuenta 1455 (INVENTARIO, material de oficina)
  "ACPM / Diesel 20 gal"                   → cuenta 1455 (INVENTARIO, combustible)
  "Casco de seguridad x 5 unds"            → cuenta 1455 (INVENTARIO, EPP)
  "Guantes de cuero x 10 pares"            → cuenta 1455 (INVENTARIO, EPP)
  "Pala punta de acero con mango x 5"      → cuenta 1455 (INVENTARIO, herramienta manual, NO activo fijo)
  "Pico punta y pala con mango x 5"        → cuenta 1455 (INVENTARIO, herramienta manual, NO activo fijo)
  "Comba de 5 libras"                       → cuenta 1455 (INVENTARIO, herramienta manual)
  "Barreta metalica 1.5m"                  → cuenta 1455 (INVENTARIO, herramienta manual)
  "Carretilla de obra"                      → cuenta 1455 (INVENTARIO, herramienta manual)
  "Cemento Argos 50kg x 50 bultos"         → cuenta 1435 (INVENTARIO, materia prima)
  "Acero corrugado 1/2 x 100 varillas"     → cuenta 1435 (INVENTARIO, materia prima)
  "Laptop HP 15 i5"                        → cuenta 1528 (INVENTARIO, equipo de computo)
  "Taladro percutor 13mm Bosch"            → cuenta 1520 (INVENTARIO, herramienta electrica)
  "Amoladora angular 7 pulgadas"           → cuenta 1520 (INVENTARIO, herramienta electrica)
  "Camioneta 4x4"                          → cuenta 1540 (INVENTARIO, vehiculo)
  "Servicio de internet mensual - ETB"     → cuenta 513540 (SERVICIO, no ingresa almacen)
  "Honorarios contables"                   → cuenta 513035 (SERVICIO)
  "Arriendo local comercial"               → cuenta 513510 (SERVICIO)
  "Mantenimiento correctivo maquina"       → cuenta 513545 (SERVICIO)
  "Flete de transporte"                    → cuenta 513575 (SERVICIO)

Si el comprobante tiene items MIXTOS (algunos bienes fisicos, algunos servicios), clasifica cada uno independientemente.

CUENTA POR PAGAR PARA COMPRAS DE INVENTARIO: siempre 2205 (Proveedores PUC Colombia).
IVA descontable de compras de inventario: siempre 2408 si cumple requisitos DIAN (CUFE valido, NIT activo, operacion gravada).
══════════════════════════════════════════════════════════════════

REGLA PRINCIPAL INNEGOCIABLE:
El TOTAL A PAGAR impreso en el comprobante manda. No modifiques el total para hacerlo coincidir con tus calculos. Si la suma de conceptos no coincide, crea una linea de ajuste por redondeo/diferencia de lectura y marca observacion.

LECTURA PIXEL POR PIXEL Y ROLES DE DATOS:
1. Lee el comprobante completo, incluyendo encabezado, logo, datos del emisor, datos del cliente, periodo, detalle, totales, notas pequeñas, QR y talon.
2. El proveedor/emisor es la empresa que emite/cobra el comprobante. NO confundas el NIT del cliente, cedula, codigo de suministro, numero de medidor, codigo de pago o numero de contrato con el NIT proveedor.
3. El supplier_ruc debe ser el NIT del emisor/proveedor (9-10 digitos colombianos). Si no estas seguro, deja supplier_ruc vacio y agrega warning. No inventes NIT.
4. supplier_name debe ser la razon social/nombre comercial del emisor/proveedor. Si no esta legible, deja vacio y agrega warning.
5. En recibos de servicios publicos, distingue: empresa emisora, titular/cliente, suministro, codigo de pago, medidor y recibo.

BIBLIOTECA PUC COLOMBIA/CRITERIOS BASE:
{pcge_rules}

BIBLIOTECA CENTROS DE COSTO:
{cc_rules}

BIBLIOTECA DE REVISION TRIBUTARIA/LEGAL:
{legal_rules}

REGLAS ESPECIALES OBLIGATORIAS (NORMATIVA COLOMBIANA):
- REDONDEO / ROUNDING / DIFERENCIA REDONDEO: linea tecnica de conciliacion monetaria. No es base gravable, no genera IVA. Si aumenta el total, usar 539595 al debe. Si disminuye el total, usar 429595 al haber.
- DEUDA ANTERIOR / SALDO ANTERIOR / RECIBO ANTERIOR / SALDO VENCIDO: no es gasto nuevo, no genera nuevo IVA descontable. Usar 220505 como obligacion previa al debe si esta incluida dentro del total a pagar.
- PAGO A CUENTA / ABONO / SALDO A FAVOR / CREDITO ANTERIOR: no es gasto, no genera IVA. Tratar como compensacion o reduccion de cuenta por pagar (2205).
- MORA / INTERES / PENALIDAD / RECARGO: no mezclar con servicios publicos. Clasificar separado en 519595, IVA descontable NO/REVISION y requiere sustento.
- IVA: separar en 2408 solo si corresponde IVA descontable (CUFE valido, NIT activo DIAN). No calcules IVA sobre deuda anterior, pago a cuenta, redondeo, mora o conceptos no gravados.
- RETENCION EN LA FUENTE: registrar en 2365 lo que el proveedor retiene. Verificar tarifa segun concepto (compras 3.5%, servicios 4%, honorarios 11%).
- ICA: si el municipio es Bogota, Medellin, Cali, etc., registrar ICA en 240810 o cuentas especificas del municipio.
- Centros de costo: cuentas clase 5 (gastos) deben tener centro de costo por linea.

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
  "currency": "COP",
  "subtotal": "0.00",
  "iva": "0.00",
  "non_taxed_amount": "0.00",
  "exempt_amount": "0.00",
  "other_charges": "0.00",
  "rounding_adjustment": "0.00",
  "total": "0.00",
  "total_read_from_document": "0.00",
  "reconciliation_status": "OK|OBSERVED|REQUIRES_REVIEW",
  "reconciliation_difference": "0.00",
  "cost_center": "{CENTRO_COSTO_DEFAULT}",
  "expense_account": "513540",
  "items": [
    {{
      "code": "",
      "description": "",
      "unit": "UND",
      "quantity": "1.00",
      "unit_price": "0.00",
      "line_subtotal": "0.00",
      "taxable": true,
      "iva_amount": "0.00",
      "total_line": "0.00",
      "line_type": "INVENTORY_PURCHASE|EXPENSE_OR_ASSET|PRIOR_BALANCE|ADVANCE_PAYMENT|LATE_FEE|ROUNDING",
      "account_code": "",
      "account_name": "",
      "cost_center": "",
      "is_inventory": false,
      "item_class": "MERCADERIA|MATERIA_PRIMA|INSUMOS|HERRAMIENTAS|ACTIVO_FIJO|null",
      "tax_treatment": "",
      "deductibility": "DEDUCIBLE|NO_DEDUCIBLE|OBSERVADO|REVISION",
      "iva_credit": "SI|NO|REVISION",
      "requires_bancarization": false,
      "requires_retefuente_review": false,
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
      "line_type": "EXPENSE_OR_ASSET|TAX|PAYABLE|ROUNDING|PRIOR_BALANCE|ADVANCE_PAYMENT|LATE_FEE|WITHHOLDING|ICA",
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
- IVA descontable separado en 2408 si corresponde (CUFE valido, NIT activo DIAN).
- Cuentas por pagar comerciales usa 2205 (Proveedores PUC Colombia).
- Si no cuadra, marca REQUIRES_REVIEW y explica.
"""



def _item_amount_value(item: dict[str, Any]) -> Decimal:
    return _money(item.get("line_subtotal") or item.get("total_line") or item.get("unit_price"))


def _set_item_amount_value(item: dict[str, Any], value: Decimal) -> None:
    amount = _money_str(value)
    item["line_subtotal"] = amount
    item["unit_price"] = amount
    item["total_line"] = amount


def _desc_upper(item: dict[str, Any]) -> str:
    return _norm_upper(item.get("description"))


def _is_iva_item(item: dict[str, Any]) -> bool:
    desc = _desc_upper(item)
    return any(token in desc for token in ["IVA", "I.V.A", "IMPUESTO AL VALOR", "IMP VALOR AGREGADO"])


# Alias para compatibilidad con código existente
_is_igv_item = _is_iva_item


def _is_fake_ocr_adjustment(item: dict[str, Any]) -> bool:
    desc = _desc_upper(item)
    return any(token in desc for token in [
        "AJUSTE POR DIFERENCIA",
        "DIFERENCIA DE LECTURA",
        "AJUSTE PARA CUADRAR",
        "CONCEPTO REGULADO NO IDENTIFICADO",
        "AJUSTE OCR",
    ])


def _is_fose_fise(item: dict[str, Any]) -> bool:
    desc = _desc_upper(item)
    return "FOSE" in desc or "FISE" in desc or "LEY 27510" in desc


def _is_aporte_ley(item: dict[str, Any]) -> bool:
    desc = _desc_upper(item)
    return "APORTE LEY" in desc or "LEY 28749" in desc or "LEY NRO" in desc


def _is_saldo_redondeo(item: dict[str, Any]) -> bool:
    return "SALDO POR REDONDEO" in _desc_upper(item)


def _is_diferencia_redondeo(item: dict[str, Any]) -> bool:
    desc = _desc_upper(item)
    return "DIFERENCIA DE REDONDEO" in desc or "DIFERENCIA POR REDONDEO" in desc


def _has_explicit_rounding_items(items: list[dict[str, Any]]) -> bool:
    return any("REDONDEO" in _desc_upper(item) for item in items)


def _is_public_regulated_receipt(data: dict[str, Any], items: list[dict[str, Any]]) -> bool:
    text = " ".join(
        [_norm_upper(data.get("supplier_name")), _norm_upper(data.get("document_type"))]
        + [_desc_upper(item) for item in items]
    )
    return any(token in text for token in [
        # OSINERGMIN - Electricidad
        "HIDRANDINA", "ELECTRONORTE", "ELECTRONOROESTE", "ELECTROCENTRO", "ELECTROSUR",
        "ENEL", "LUZ DEL SUR", "SEAL", "ENOSA", "ENSA", "ENELPERU",
        "ELECTRICIDAD", "ENERGIA ELECTRICA", "ENERGÍA ELÉCTRICA",
        "ENERGIA ACTIVA", "ENERGÍA ACTIVA", "ALUMBRADO PUBLICO", "ALUMBRADO PÚBLICO",
        "CARGO FIJO", "FOSE", "FISE", "APORTE LEY", "LEY 28749", "MRSE",
        "OSINERGMIN",
        # OSINERGMIN - Gas natural
        "CALIDDA", "QUAVII", "GAS NATURAL", "GAS DE LIMA", "CONTUGAS",
        "GASES DEL PACIFICO",
        # SUNASS - Agua y saneamiento
        "SEDAPAL", "SEDALIB", "EPS GRAU", "EPS ILO", "EPS TACNA", "SEDACAJ",
        "SEDACHIMBOTE", "EMAPICA", "EMAPISCO", "EMAPAT", "EMAPAVIGS",
        "EPS SELVA CENTRAL", "SUNASS", "AGUA POTABLE", "ALCANTARILLADO",
        "SANEAMIENTO", "SERVICIO DE AGUA",
        # OSIPTEL - Telecomunicaciones
        "MOVISTAR", "TELEFONICA", "TELEFONÍA", "CLARO", "ENTEL", "BITEL",
        "VIRGIN MOBILE", "WOM", "OSIPTEL", "FITEL",
        "INTERNET", "FIBRA OPTICA", "FIBRA ÓPTICA", "BANDA ANCHA",
        # Genérico gobierno/regulado
        "MUNICIPALIDAD", "SAT", "GOBIERNO", "MINISTERIO", "ESSALUD",
    ])


def _clean_public_receipt_items_and_amounts(
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
    # Normaliza recibos publicos/regulados sin tocar facturas comerciales normales.
    if not _is_public_regulated_receipt(data, items):
        return items, subtotal, igv

    cleaned: list[dict[str, Any]] = []
    explicit_rounding = _has_explicit_rounding_items(items)

    for item in items:
        if _is_igv_item(item):
            reconciliation_notes.append(f"IGV eliminado del detalle y tratado solo como impuesto: {item.get('description')}.")
            continue
        if explicit_rounding and _is_fake_ocr_adjustment(item):
            reconciliation_notes.append(f"Ajuste OCR eliminado porque ya existe redondeo explicito: {item.get('description')}.")
            continue
        cleaned.append(item)
    items = cleaned

    # Tokens gravados que forman la base imponible del servicio regulado
    base_tokens = (
        # Electricidad (OSINERGMIN)
        "CARGO FIJO", "REPOSICION", "REPOSICIÓN", "MANTENIMIENTO",
        "ENERGIA ACTIVA", "ENERGÍA ACTIVA", "ALUMBRADO PUBLICO", "ALUMBRADO PÚBLICO",
        # Agua (SUNASS)
        "CONSUMO DE AGUA", "AGUA POTABLE", "ALCANTARILLADO",
        # Gas (OSINERGMIN)
        "GAS NATURAL", "CONSUMO DE GAS",
        # Telecomunicaciones (OSIPTEL)
        "RENTA BASICA", "INTERNET", "TELEFONIA", "TELEFONÍA", "CABLE",
    )
    base_sum = sum(
        (_item_amount_value(item) for item in items if any(token in _desc_upper(item) for token in base_tokens)),
        Decimal("0.00"),
    ).quantize(Decimal("0.01"))

    if base_sum > 0 and (subtotal == 0 or abs(subtotal - base_sum) <= Decimal("1.10")):
        if subtotal != base_sum:
            ocr_warnings.append(f"Subtotal corregido de {subtotal} a {base_sum} segun conceptos visibles antes del SUB TOTAL.")
        subtotal = base_sum
        data["subtotal"] = _money_str(subtotal)

    if subtotal > 0:
        expected_igv = (subtotal * Decimal("0.18")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if igv == 0 or abs(igv - expected_igv) <= Decimal("1.10"):
            if igv != expected_igv:
                ocr_warnings.append(f"IGV corregido de {igv} a {expected_igv} usando SUB TOTAL visible {subtotal}.")
            igv = expected_igv
            data["igv"] = _money_str(igv)

    # Aplicar reglas de todos los organismos reguladores
    all_regulated_rules = (
        ELECTRIC_REGULATED_RULES      # OSINERGMIN - Electricidad
        + WATER_REGULATED_RULES       # SUNASS - Agua y saneamiento
        + GAS_REGULATED_RULES         # OSINERGMIN - Gas natural
        + TELECOM_REGULATED_RULES     # OSIPTEL - Telecomunicaciones
    )

    for item in items:
        desc_up = _desc_upper(item)
        matched_rule: dict[str, Any] | None = None
        for rule in all_regulated_rules:
            if any(token in desc_up for token in rule["keywords"]):
                matched_rule = rule
                break
        if matched_rule is None:
            continue
        item["line_type"] = "REGULATED_CHARGE"
        item["account_code"] = matched_rule["account_code"]
        item["account_name"] = matched_rule["account_name"]
        item["taxable"] = bool(matched_rule["taxable"])
        if not matched_rule["taxable"]:
            item["igv_amount"] = "0.00"
        item["requires_support"] = False
        item["requires_bancarization"] = False
        item["requires_retefuente_review"] = False
        item["deductibility"] = "DEDUCIBLE"
        item["iva_credit"] = "SI" if matched_rule["taxable"] else "NO"
        item["tax_treatment"] = matched_rule.get("tax_treatment") or "Cargo regulado; subcuenta especifica segun organismo regulador."
        item["ai_reason"] = f"Reclasificado por reglas reguladas ({matched_rule['account_name']})."
        item["ai_confidence"] = 0.98

    saldo = sum((_item_amount_value(item) for item in items if _is_saldo_redondeo(item)), Decimal("0.00")).quantize(Decimal("0.01"))
    aporte = sum((_item_amount_value(item) for item in items if _is_aporte_ley(item)), Decimal("0.00")).quantize(Decimal("0.01"))
    diff_items = [item for item in items if _is_diferencia_redondeo(item)]

    if diff_items:
        current_diff = sum((_item_amount_value(item) for item in diff_items), Decimal("0.00")).quantize(Decimal("0.01"))
        expected_diff = (total_read - subtotal - igv - saldo - aporte).quantize(Decimal("0.01"))
        if abs(current_diff - expected_diff) <= Decimal("2.00"):
            if current_diff != expected_diff:
                ocr_warnings.append(f"Diferencia de redondeo corregida de {current_diff} a {expected_diff} usando TOTAL impreso.")
            _set_item_amount_value(diff_items[0], expected_diff)

    diff = sum((_item_amount_value(item) for item in diff_items), Decimal("0.00")).quantize(Decimal("0.01"))
    fose_items = [item for item in items if _is_fose_fise(item)]
    total_without_fose = (subtotal + igv + saldo + aporte + diff).quantize(Decimal("0.01"))

    if fose_items and abs(total_without_fose - total_read) <= Decimal("0.02"):
        for item in fose_items:
            item["line_type"] = "INFO_ONLY"
            item["taxable"] = False
            item["igv_amount"] = "0.00"
            item["requires_support"] = False
            item["tax_treatment"] = "FOSE/FISE informativo posterior al total; no se contabiliza doble si el total cuadra."
        reconciliation_notes.append("FOSE/FISE tratado como INFO_ONLY porque el total cuadra sin sumarlo.")

    def _keep_warning(value: Any) -> bool:
        s = str(value).upper()
        return not any(token in s for token in [
            "IGV DECLARADO",
            "NO CORRESPONDE AL 18",
            "NO ES EL 18",
            "BASE IMPONIBLE",
            "AUDITOR",
            "DIFERENCIA MAYOR A TOLERANCIA",
            "AJUSTE AUTOMATICO CONTRA TOTAL",
            "SUMA DE LOS CONCEPTOS",
        ])

    warnings[:] = [w for w in warnings if _keep_warning(w)]
    tax_warnings[:] = [w for w in tax_warnings if _keep_warning(w)]
    accounting_warnings[:] = [w for w in accounting_warnings if _keep_warning(w)]

    reconciliation_notes.append("RECIBO_PUBLICO_FLEXIBLE: se respetan montos impresos, subcuentas y centro de costo de gastos.")
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
    if supplier_ruc and not _is_valid_nit(supplier_ruc):
        warnings.append(f"NIT proveedor descartado por no pasar validacion modulo 11 DIAN: {supplier_ruc}.")
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

        account_code = _only_digits(raw.get("account_code")) or local["account_code"]
        account_name = _norm_text(raw.get("account_name")) or local["account_name"]
        cost_center = _norm_upper(raw.get("cost_center")) or local["cost_center"] or fallback_cc

        line_subtotal = _money(raw.get("line_subtotal") or raw.get("subtotal") or raw.get("unit_price"))
        total_line = _money(raw.get("total_line") or line_subtotal)
        igv_amount = _money(raw.get("igv_amount"))

        if kind in {"ROUNDING", "PRIOR_BALANCE", "ADVANCE_PAYMENT", "LATE_FEE"}:
            account_code = local["account_code"]
            account_name = local["account_name"]
            cost_center = local["cost_center"]
            igv_amount = Decimal("0.00")
            raw["taxable"] = False
            raw["iva_credit"] = local["iva_credit"]
            raw["requires_support"] = local["requires_support"]

        if kind == "ROUNDING" and abs(line_subtotal) <= AUTO_ROUNDING_TOLERANCE:
            raw["requires_support"] = False

        # Detectar si es inventario: la IA puede indicarlo con is_inventory=true o con
        # account_code que comienza por 2x o 3x, o por line_type INVENTORY_PURCHASE.
        ai_is_inventory = bool(raw.get("is_inventory", False))
        ai_item_class = _norm_text(raw.get("item_class")) or None
        code_prefix = account_code[:2] if len(account_code) >= 2 else ""
        is_inventory = (
            ai_is_inventory
            or kind == "INVENTORY_PURCHASE"
            or code_prefix in INVENTARIO_ACCOUNT_CLASS
            or local.get("is_inventory", False)
        )
        item_class = ai_item_class or local.get("item_class") or INVENTARIO_ACCOUNT_CLASS.get(code_prefix)
        resolved_kind = kind if kind != "NORMAL" else ("INVENTORY_PURCHASE" if is_inventory else "EXPENSE_OR_ASSET")

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
            "line_type": resolved_kind,
            "account_code": account_code,
            "account_name": account_name,
            "cost_center": cost_center,
            "is_inventory": is_inventory,
            "item_class": item_class,
            "tax_treatment": _norm_text(raw.get("tax_treatment")) or local["tax_treatment"],
            "deductibility": _norm_text(raw.get("deductibility")) or local["deductibility"],
            "iva_credit": _norm_text(raw.get("iva_credit")) or local["iva_credit"],
            "requires_bancarization": bool(raw.get("requires_bancarization", False)),
            "requires_retefuente_review": bool(raw.get("requires_retefuente_review", False)),
            "requires_support": bool(raw.get("requires_support", local.get("requires_support", False))),
            "ai_reason": _norm_text(raw.get("ai_reason")) or local["ai_reason"],
            "ai_confidence": float(raw.get("ai_confidence") or local["ai_confidence"]),
        }
        items.append(item)

    subtotal = _money(data.get("printed_subtotal") or data.get("subtotal") or sum(_money(item["line_subtotal"]) for item in items if item.get("line_type") in {"EXPENSE_OR_ASSET", "INVENTORY_PURCHASE"}))
    igv = _money(data.get("printed_igv") or data.get("igv") or sum(_money(item.get("igv_amount")) for item in items))
    total_read = _money(data.get("printed_total") or data.get("total_read_from_document") or data.get("total") or subtotal + igv)
    total = total_read

    items, subtotal, igv = _clean_public_receipt_items_and_amounts(
        data,
        items,
        subtotal,
        igv,
        total_read,
        warnings,
        tax_warnings,
        accounting_warnings,
        ocr_warnings,
        reconciliation_notes,
    )

    # ── LOOKUP CATÁLOGO ALMACÉN ──────────────────────────────────────────────
    # Para cada ítem de inventario, buscar en el catálogo por keywords.
    # Si existe → asignar catalog_code estructurado (CTA-NAT-RUB-SEQQ-TK).
    # Si no existe → generar código provisional con la misma estructura.
    # Multi-empresa: catalog_code es universal; el producto en BD es por empresa.
    from src.domain.item_catalog import (
        lookup as catalog_lookup,
        infer_nat_from_description,
        infer_tk_from_description,
        build_structured_code,
        item_class_from_nat,
    )
    for item in items:
        if not item.get("is_inventory"):
            continue
        desc = _norm_text(item.get("description"))
        acc  = _norm_text(item.get("account_code"))
        match = catalog_lookup(desc, acc)
        if match:
            item["catalog_code"]  = match["code"]
            item["catalog_name"]  = match["name"]
            item["catalog_unit"]  = match["unit"]
            item["gasto_account"] = match["gasto"]
            item["gasto_name"]    = match["gasto_name"]
            item["catalog_nat"]   = match["nat"]
            item["catalog_rub"]   = match["rub"]
            item["catalog_tk"]    = match["tk"]
            # REGLA: El catálogo maestro es autoridad en la clasificación contable.
            # Si el catálogo dice que una pala es "252" (suministro), se usa 252
            # aunque la IA de Gemini haya devuelto "333x" (activo fijo).
            # La IA es buena leyendo texto/montos, pero el catálogo tiene las
            # reglas PCGE correctas por tipo de bien.
            cat_cta = match["cta"]   # ej: "252" para herramientas manuales
            ai_cta  = acc[:3] if acc else ""
            # Solo respetar la cuenta de la IA si es compatible con el catálogo
            # (misma familia PCGE: ambas 25x, ambas 33x, etc.)
            if ai_cta and ai_cta == cat_cta:
                # IA y catálogo coinciden en familia → preservar subcuenta IA si es más específica
                item["account_code"] = acc if len(acc) >= len(cat_cta) else cat_cta
            else:
                # IA discrepa (ej: IA=3337, catálogo=252) → el catálogo gana
                item["account_code"] = cat_cta
            item["account_name"] = match.get("gasto_name", match.get("name", "Inventarios"))
            item["item_class"]   = item_class_from_nat(match["nat"])
            item["catalog_match"] = True
        else:
            # No está en catálogo → construir código provisional para almacén
            # account_code (contable) y catalog_code (almacén) son campos separados
            cta = acc if len(acc) >= 3 else "252"   # mantener subcuenta PCGE completa
            cta3 = cta[:3]                           # solo primeros 3 dígitos para el token
            nat = infer_nat_from_description(desc, cta3)
            tk  = infer_tk_from_description(desc, nat)
            # SEQQ 9999 = pendiente de asignar secuencia real al ingresar al almacén
            provisional_code = build_structured_code(cta3, nat, "GE", 9999, tk)
            item["catalog_code"]   = provisional_code   # código almacén (≠ account_code)
            item["catalog_name"]   = desc
            item["catalog_unit"]   = _norm_text(item.get("unit")) or "UND"
            item["gasto_account"]  = ""
            item["gasto_name"]     = ""
            item["catalog_nat"]    = nat
            item["catalog_rub"]    = "GE"
            item["catalog_tk"]     = tk
            item["item_class"]     = item_class_from_nat(nat)
            item["catalog_match"]  = False
            accounting_warnings.append(
                f"Ítem '{desc[:60]}' no encontrado en catálogo → código provisional {provisional_code}. "
                "Almacén creará el artículo automáticamente con esta estructura."
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
            "iva_credit": local["iva_credit"],
            "requires_bancarization": False,
            "requires_retefuente_review": False,
            "requires_support": True,
            "ai_reason": "Linea creada por fallback por falta de detalle OCR.",
            "ai_confidence": 0.50,
        })
        warnings.append("OCR no devolvio items detallados; se creo linea fallback.")

    account_lines = []
    # Ítems de INVENTARIO → línea individual por ítem (trazabilidad Pala/Pico/etc.)
    # Ítems de GASTO/SERVICIO → se agrupan por cuenta (comportamiento estándar)
    debit_by_key: dict[tuple[str, str, str, str], Decimal] = {}
    credit_by_key: dict[tuple[str, str, str, str], Decimal] = {}

    for item in items:
        code = _norm_text(item.get("account_code")) or "659101"
        name = _norm_text(item.get("account_name")) or f"Cuenta {code}"
        cc = _norm_upper(item.get("cost_center")) or fallback_cc
        kind = _norm_text(item.get("line_type")) or "EXPENSE_OR_ASSET"
        amount = _money(item.get("line_subtotal"))
        desc = _norm_text(item.get("description")) or name

        if kind == "INFO_ONLY":
            reconciliation_notes.append(f"Linea informativa no contabilizada: {item.get('description')}.")
            continue

        if kind == "ROUNDING" and abs(amount) <= AUTO_ROUNDING_TOLERANCE:
            pass
        elif kind == "ROUNDING":
            accounting_warnings.append(f"Redondeo superior a tolerancia automatica: {amount}. Revisar OCR o comprobante.")

        if kind == "ADVANCE_PAYMENT":
            key = (code, name, "-", kind)
            credit_by_key[key] = credit_by_key.get(key, Decimal("0.00")) + abs(amount)
            continue

        target_cc = cc if code[:1] in {"6", "9"} else "-"

        # Ítems de inventario: una línea por ítem para ver Pala, Pico, etc. por separado
        if kind == "INVENTORY_PURCHASE" and amount > 0:
            qty  = _norm_text(item.get("quantity")) or "1"
            unit = _norm_text(item.get("unit")) or "UND"
            account_lines.append({
                "account_code": code,
                "account_name": name,
                "cost_center":  target_cc,
                "debit":        _money_str(amount),
                "credit":       "0.00",
                "line_type":    "INVENTORY_PURCHASE",
                "description":  f"{desc} ({qty} {unit})",
                "tax_treatment": item.get("tax_treatment") or "Bien físico de inventario.",
                "audit_note":   "",
            })
        else:
            # Gastos/servicios: agrupar por cuenta (estándar)
            key = (code, name, target_cc, kind)
            debit_by_key[key] = debit_by_key.get(key, Decimal("0.00")) + amount

        if item.get("requires_support") and kind not in {"ROUNDING", "PRIOR_BALANCE", "ADVANCE_PAYMENT", "REGULATED_CHARGE", "INFO_ONLY"}:
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
            "account_code": IVA_DESCONTABLE_ACCOUNT,
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

    has_explicit_rounding = _has_explicit_rounding_items(items)

    if difference != 0 and not has_explicit_rounding:
        if difference > 0:
            account_lines.append({
                "account_code": ROUNDING_EXPENSE_ACCOUNT,
                "account_name": "Ajuste por redondeo o diferencia de lectura",
                "cost_center": fallback_cc,
                "debit": _money_str(difference),
                "credit": "0.00",
                "line_type": "ROUNDING",
                "tax_treatment": "Ajuste para reconciliar contra total impreso; no integra base IGV. Revisar si excede tolerancia.",
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

    is_public_receipt = _is_public_regulated_receipt(data, items)
    if is_public_receipt and reconciliation_difference == 0:
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
        "currency": _norm_text(data.get("currency")) or "COP",
        "subtotal": _money_str(subtotal),
        "iva": _money_str(igv),
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
    if not is_vision_available():
        raise HTTPException(status_code=500, detail="Configura CLAUDE_API_KEY o GEMINI_API_KEY para activar lectura IA de comprobantes.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Archivo vacio")

    mime_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"

    prompt = f"""
Eres CONTA_COLPRO Vision Accounting Engine para Colombia — DIAN, PUC, Estatuto Tributario. Lee el comprobante PIXEL POR PIXEL.

REGLA SUPREMA: El TOTAL A PAGAR impreso en el comprobante manda siempre. No calcules, no redondees, no inventes importes.

DECIMALES PERUANOS: Los importes pueden usar punto (.) o coma (,) como separador decimal.
- "190,10" = 190.10 soles
- "1.590,20" = 1590.20 soles
- "50.19" = 50.19 soles
Devuelve SIEMPRE los importes como string con punto decimal: "190.10", "1590.20", "50.19".

ORGANISMOS REGULADORES PERUANOS - DESGLOSE OBLIGATORIO por fila visible:

OSINERGMIN - Electricidad (HIDRANDINA, ELECTRONORTE, ENEL, LUZ DEL SUR, SEAL, ELECTROCENTRO):
  * Energia activa / Consumo activo → cuenta 636101
  * Cargo fijo → cuenta 636102
  * Alumbrado publico → cuenta 636103
  * Reposicion y mantenimiento → cuenta 636104
  * Aporte Ley 28749 → cuenta 636105 (NO afecto IGV)
  * FOSE/FISE → cuenta 636106 (NO afecto IGV)

SUNASS - Agua y saneamiento (SEDAPAL, SEDALIB, EPS GRAU, EPS ILO, SEDACAJ):
  * Cargo fijo agua → cuenta 636201
  * Consumo agua potable (m3) → cuenta 636202
  * Alcantarillado / desague → cuenta 636203
  * Aporte SUNASS → cuenta 636204 (NO afecto IGV)

OSINERGMIN - Gas natural (CALIDDA, QUAVII, CONTUGAS):
  * Cargo fijo gas → cuenta 636301
  * Consumo gas natural → cuenta 636302
  * Transporte/distribucion gas → cuenta 636303

OSIPTEL - Telecomunicaciones (MOVISTAR, CLARO, ENTEL, BITEL):
  * Renta basica / cargo fijo → cuenta 636401
  * Internet / banda ancha → cuenta 636402
  * Telefonia → cuenta 636403
  * TV cable → cuenta 636404
  * Aporte OSIPTEL/FITEL → cuenta 636405 (NO afecto IGV)

SALDO ANTERIOR / DEUDA ANTERIOR (EN CUALQUIER RECIBO DE SERVICIO PUBLICO):
  * Si aparece "Saldo anterior", "Deuda anterior", "Recibo anterior" → es deuda de periodo anterior
  * Cuenta: 421201 (Cuentas por pagar - deuda anterior)
  * NO genera nuevo IGV, NO es gasto nuevo
  * line_type: "PRIOR_BALANCE"

REGLAS PARA TODOS LOS RECIBOS REGULADOS:
- Cada fila del recibo = un item separado en el JSON. PROHIBIDO agrupar.
- El IGV no va en items; solo como campo "igv" del JSON.
- Si no lees el importe exacto, pon el importe mas cercano visible y marca requires_visual_review=true.
- FOSE/FISE y Aporte Ley aparecen DESPUES del total; si el total ya cuadra sin ellos, son informativos.
- Diferencia de redondeo / Saldo por redondeo → absorbe el cuadre contra el total.
- Si existe IGV impreso o se deduce del SUB TOTAL visible, usar ese IGV; no convertir diferencias de IGV en redondeo falso.
- Si el recibo trae Saldo por redondeo o Diferencia de redondeo, NO crear una tercera linea de ajuste.
- La linea visible Diferencia de redondeo absorbe el cuadre contra el total impreso.
- Los cargos regulados de la CREG (contribucion especial, cargo solidaridad, alumbrado publico) no generan IVA; no crear linea IVA sobre ellos.
- El IVA no debe aparecer como item de detalle del servicio; debe ir solo a 2408 como linea separada de tipo TAX.
- Facturas comerciales normales siguen con validacion estricta de CUFE y NIT en DIAN.
- Si el comprobante es de un prestador de servicios publicos domiciliarios (EPM, Codensa, Celsia, Gas Natural, Surtigas, ETB, Claro, Movistar) aplicar reglas de servicios regulados Colombia.

Analiza el archivo como comprobante empresarial colombiano bajo normativa DIAN y Estatuto Tributario.
Usa criterio contable PUC, tributario colombiano, legal-documentario y auditoria.
{_json_schema_instruction()}
"""

    try:
        client = get_vision_client()
        response = await client.analyze_document(
            instruction=prompt,
            file_bytes=raw,
            mime_type=mime_type,
        )
        text = client.response_text(response) or "{}"
        data = json.loads(text)

        if not isinstance(data, dict):
            raise ValueError("Gemini no devolvio un objeto JSON")

        return _normalize_ai_response(data)

    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini devolvio JSON invalido: {str(exc)}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error Gemini: {str(exc)}") from exc
