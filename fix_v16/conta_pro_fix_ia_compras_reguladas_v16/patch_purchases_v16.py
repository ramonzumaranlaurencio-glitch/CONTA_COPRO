
from pathlib import Path
import ast

path = Path("src/api/routes/purchases.py")
if not path.exists():
    raise SystemExit("No existe src/api/routes/purchases.py. Ejecuta desde la raiz del proyecto.")

text = path.read_text(encoding="utf-8")

prompt_rule = '''REGLA MADRE CONTA_PRO PARA COMPRAS:
- FASE 1: lectura visual pura del comprobante. Transcribe importes tal como figuran; no inventes ni recalcules.
- FASE 2: validacion matematica contra total impreso.
- FASE 3: clasificacion contable/tributaria por concepto.
- FASE 4: asiento contable.

RECIBOS PUBLICOS / SERVICIOS REGULADOS:
- En electricidad, agua, saneamiento, telecom, municipalidad o gobierno, los importes impresos mandan.
- Prioridad: subcuenta correcta, centro de costo correcto en gastos clase 6/9 y total igual al recibo.
- Si existe SUB TOTAL impreso, ese SUB TOTAL manda como base gravada del bloque.
- Si existe IGV impreso o se deduce del SUB TOTAL visible, usar ese IGV; no convertir diferencias de IGV en redondeo falso.
- Si el recibo trae Saldo por redondeo o Diferencia de redondeo, NO crear una tercera linea de ajuste.
- La linea visible Diferencia de redondeo absorbe el cuadre contra el total impreso.
- Aporte Ley 28749 es cargo regulado no afecto al IGV si aparece despues del IGV; no requiere revision contable si esta identificado.
- FOSE/FISE posterior al total es informativo si el total ya cuadra sin sumarlo; no contabilizar doble.
- El IGV no debe aparecer como item de detalle; debe ir solo a 40111.
- Facturas comerciales normales siguen con validacion estricta.

'''

if prompt_rule not in text:
    marker = "REGLAS SECTORIALES DE SERVICIOS PUBLICOS - OBLIGATORIAS:"
    if marker in text:
        text = text.replace(marker, prompt_rule + marker, 1)
    else:
        marker2 = "Analiza el archivo como comprobante empresarial peruano."
        if marker2 in text:
            text = text.replace(marker2, prompt_rule + marker2, 1)

helper = r'''

def _item_amount_value(item: dict[str, Any]) -> Decimal:
    return _money(item.get("line_subtotal") or item.get("total_line") or item.get("unit_price"))


def _set_item_amount_value(item: dict[str, Any], value: Decimal) -> None:
    amount = _money_str(value)
    item["line_subtotal"] = amount
    item["unit_price"] = amount
    item["total_line"] = amount


def _desc_upper(item: dict[str, Any]) -> str:
    return _norm_upper(item.get("description"))


def _is_igv_item(item: dict[str, Any]) -> bool:
    desc = _desc_upper(item)
    return any(token in desc for token in ["IGV", "I.G.V", "IMP. GRAL", "IMPUESTO GENERAL A LAS VENTAS"])


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
    # Reconocer tanto proveedores peruanos como colombianos; priorizar lógica colombiana
    return any(token in text for token in [
        # Peruanos (compatibilidad hacia atrás)
        "HIDRANDINA", "ELECTRONORTE", "ENEL", "LUZ DEL SUR", "ELECTRICIDAD", "ENERGIA", "ENERGÍA",
        "SEDAPAL", "EPS", "SUNASS", "SANEAMIENTO", "AGUA POTABLE", "OSINERGMIN", "SUNAT",
        # Colombianos (añadidos)
        "EPM", "CODENSA", "VANTI", "TRIPLE A", "AAA", "CELSIA", "SURTIGAS", "ACUEDUCTO", "AGUAS",
        "CLARO", "MOVISTAR", "TIGO", "ETB", "CARGO FIJO", "ALUMBRADO", "APORTE LEY",
        # Generales/administrativos
        "MUNICIPALIDAD", "GOBIERNO", "MINISTERIO", "FOSE", "FISE",
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

    base_tokens = (
        "CARGO FIJO",
        "REPOSICION",
        "REPOSICIÓN",
        "MANTENIMIENTO",
        "ENERGIA ACTIVA",
        "ENERGÍA ACTIVA",
        "ALUMBRADO PUBLICO",
        "ALUMBRADO PÚBLICO",
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
        # Colombia: IVA 19% (parametrizable si se integra settings posteriormente)
        expected_igv = (subtotal * Decimal("0.19")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if igv == 0 or abs(igv - expected_igv) <= Decimal("1.10"):
            if igv != expected_igv:
                ocr_warnings.append(f"IGV corregido de {igv} a {expected_igv} usando SUB TOTAL visible {subtotal}.")
            igv = expected_igv
            data["igv"] = _money_str(igv)

    for item in items:
        if _is_aporte_ley(item):
            item["line_type"] = "REGULATED_CHARGE"
            # Mapear a subcuenta PUC Colombiano para aportes/leyes
            item["account_code"] = item.get("account_code") or "513542"
            item["account_name"] = item.get("account_name") or "Energia electrica - Aporte Ley 28749"
            item["taxable"] = False
            item["igv_amount"] = "0.00"
            item["requires_support"] = False
            item["tax_treatment"] = "Cargo regulado no afecto al IGV segun recibo; clasificado como subcuenta de electricidad."

    saldo = sum((_item_amount_value(item) for item in items if _is_saldo_redondeo(item)), Decimal("0.00")).quantize(Decimal("0.01"))
    aporte = sum((_item_amount_value(item) for item in items if _is_aporte_ley(item)), Decimal("0.00")).quantize(Decimal("0.01"))
    diff_items = [item for item in items if _is_diferencia_redondeo(item)]

    if diff_items:
        current_diff = sum((_item_amount_value(item) for item in diff_items), Decimal("0.00")).quantize(Decimal("0.01"))
        expected_diff = (total_read - subtotal - igv - saldo - aporte).quantize(Decimal("0.01"))
        # Ajuste de tolerancia para pesos colombianos: permitir diferencias razonables por redondeo (ej. hasta 100 COP)
        if abs(current_diff - expected_diff) <= Decimal("100.00"):
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

'''

if "def _clean_public_receipt_items_and_amounts" not in text:
    marker = "\ndef _normalize_ai_response(data: dict[str, Any]) -> dict[str, Any]:"
    if marker not in text:
        raise SystemExit("No encontre def _normalize_ai_response en purchases.py")
    text = text.replace(marker, helper + marker, 1)

text = text.replace(
    '        if local.get("line_type") in REGULATED_LINE_TYPES:',
    '        if kind != "INFO_ONLY" and local.get("line_type") in REGULATED_LINE_TYPES:',
    1,
)

old = '''    subtotal = _money(data.get("subtotal") or sum(_money(item["line_subtotal"]) for item in items if item.get("line_type") == "EXPENSE_OR_ASSET"))
    igv = _money(data.get("igv") or sum(_money(item.get("igv_amount")) for item in items))
    total_read = _money(data.get("total_read_from_document") or data.get("total") or subtotal + igv)
    total = total_read
'''
new = '''    subtotal = _money(data.get("printed_subtotal") or data.get("subtotal") or sum(_money(item["line_subtotal"]) for item in items if item.get("line_type") == "EXPENSE_OR_ASSET"))
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
'''
if "_clean_public_receipt_items_and_amounts(" not in text[text.find("def _normalize_ai_response"):]:
    if old not in text:
        raise SystemExit("No encontre bloque subtotal/igv/total_read esperado en purchases.py")
    text = text.replace(old, new, 1)

old = '''        amount = _money(item.get("line_subtotal"))

        if kind == "ROUNDING" and abs(amount) <= AUTO_ROUNDING_TOLERANCE:
'''
new = '''        amount = _money(item.get("line_subtotal"))

        if kind == "INFO_ONLY":
            reconciliation_notes.append(f"Linea informativa no contabilizada: {item.get('description')}.")
            continue

        if kind == "ROUNDING" and abs(amount) <= AUTO_ROUNDING_TOLERANCE:
'''
last_loop = text.rfind("    for item in items:")
if last_loop != -1 and 'if kind == "INFO_ONLY":' not in text[last_loop:]:
    if old not in text:
        raise SystemExit("No encontre bloque amount/kind en purchases.py")
    text = text.replace(old, new, 1)

old = '''    if difference != 0:
        if difference > 0:
'''
new = '''    has_explicit_rounding = _has_explicit_rounding_items(items)

    if difference != 0 and not has_explicit_rounding:
        if difference > 0:
'''
if "has_explicit_rounding = _has_explicit_rounding_items(items)" not in text:
    if old not in text:
        raise SystemExit("No encontre bloque difference en purchases.py")
    text = text.replace(old, new, 1)

old = '''        reconciliation_notes.append(f"Ajuste automatico contra total impreso: {difference}.")
        if abs(difference) > AUTO_ROUNDING_TOLERANCE:
            accounting_warnings.append(f"Diferencia mayor a tolerancia de redondeo ({AUTO_ROUNDING_TOLERANCE}): {difference}. Revisar OCR/importes.")
'''
new = '''        reconciliation_notes.append(f"Ajuste automatico contra total impreso: {difference}.")
        if abs(difference) > AUTO_ROUNDING_TOLERANCE:
            accounting_warnings.append(f"Diferencia mayor a tolerancia de redondeo ({AUTO_ROUNDING_TOLERANCE}): {difference}. Revisar OCR/importes.")
    elif difference != 0 and has_explicit_rounding:
        reconciliation_notes.append(f"Diferencia {difference} no genera ajuste adicional porque ya existe redondeo explicito.")
'''
if "no genera ajuste adicional porque ya existe redondeo explicito" not in text:
    if old not in text:
        raise SystemExit("No encontre cierre de ajuste automatico en purchases.py")
    text = text.replace(old, new, 1)

old = '''    requires_review = bool(accounting_warnings or [w for w in warnings if "No se pudo leer" in w])
    reconciliation_status = "OK" if reconciliation_difference == 0 and not requires_review else "REQUIRES_REVIEW"
'''
new = '''    is_public_receipt = _is_public_regulated_receipt(data, items)
    if is_public_receipt and reconciliation_difference == 0:
        accounting_warnings = [w for w in accounting_warnings if "Asiento no cuadrado" in str(w)]
        requires_review = bool([w for w in warnings if "No se pudo leer RUC" in str(w) or "No se pudo leer razon social" in str(w)])
    else:
        requires_review = bool(accounting_warnings or [w for w in warnings if "No se pudo leer" in w] or data.get("requires_visual_review"))

    reconciliation_status = "OK" if reconciliation_difference == 0 and not requires_review else "REQUIRES_REVIEW"
'''
if "is_public_receipt = _is_public_regulated_receipt(data, items)" not in text:
    if old not in text:
        raise SystemExit("No encontre bloque requires_review en purchases.py")
    text = text.replace(old, new, 1)

ast.parse(text)
path.write_text(text, encoding="utf-8")
print("OK: purchases.py potenciado para recibos publicos/regulados sin tocar frontend ni ledger.")
