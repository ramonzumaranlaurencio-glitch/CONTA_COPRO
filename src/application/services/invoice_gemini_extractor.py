from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import json
import re
from typing import Any, Literal

from src.application.services.dian_realtime_verifier import DianRealtimeVerifier
from src.infrastructure.adapters.ai.gemini import GeminiClient


Direction = Literal["purchase", "sale"]


class InvoiceGeminiExtractor:
    """Extracts Colombian invoice fields from images/PDFs using Gemini vision."""

    def __init__(
        self,
        gemini_client: GeminiClient,
        dian_verifier: DianRealtimeVerifier,
        *,
        company_nit: str | None = None,
    ) -> None:
        self.gemini_client = gemini_client
        self.dian_verifier = dian_verifier
        self.company_nit = company_nit

    async def extract(
        self,
        *,
        file_bytes: bytes,
        mime_type: str,
        filename: str | None,
        direction: Direction,
        target_fields: list[str] | None = None,
    ) -> dict[str, Any]:
        response = await self.gemini_client.analyze_document(
            instruction=self._prompt(direction, filename, mime_type, target_fields),
            file_bytes=file_bytes,
            mime_type=mime_type,
        )
        if response.get("status") == "configuration_required":
            return {
                "status": "configuration_required",
                "provider": "gemini",
                "message": "Configura GEMINI_API_KEY para activar lectura visual de comprobantes.",
            }

        content = GeminiClient.response_text(response)
        extracted = self._parse_json(content)
        normalized = self._normalize(extracted, direction)
        dian_validation = self._verify_dian(normalized)
        normalized["dian_validation"] = dian_validation
        normalized["compliance"] = self._compliance_status(dian_validation)
        normalized["provider"] = "gemini"
        normalized["model"] = self.gemini_client.model
        normalized["checked_at"] = datetime.now(UTC).isoformat()
        return normalized

    def _prompt(self, direction: Direction, filename: str | None, mime_type: str, target_fields: list[str] | None) -> str:
        partner_role = "proveedor/emisor" if direction == "purchase" else "cliente/receptor"
        fields = ", ".join(target_fields or self._default_target_fields(direction))
        return f"""
Eres el motor OCR fiscal de CONTA_PRO Enterprise para Colombia.
Lee la imagen PIXEL POR PIXEL y por layout visual. Analiza cada pixel del archivo adjunto. Puede ser JPG, PNG, WEBP o PDF.
Extrae solo datos visibles del comprobante. No inventes datos; si no estas seguro usa null y baja la confianza.

Contexto del flujo: {direction}. El NIT o cedula partner debe ser el documento del {partner_role}.
Campos que se van a llenar en el formulario actual: {fields}.
Archivo: {filename or "sin_nombre"} ({mime_type}).

Devuelve exclusivamente JSON valido con esta forma:
{{
  "document_type": "factura|nota_credito|nota_debito|documento_soporte|otro",
  "serie": "F001",
  "number": "12345",
  "serie_numero": "F001-12345",
  "issue_date": "YYYY-MM-DD",
  "supplier_nit": "901234567-8",
  "supplier_name": "RAZON SOCIAL EMISOR",
  "customer_nit": "901234567-8",
  "customer_name": "RAZON SOCIAL RECEPTOR",
  "partner_nit": "NIT usado por el flujo",
  "currency": "COP|USD",
  "subtotal": "0.00",
  "iva": "0.00",
  "total": "0.00",
  "retencion": "0.00",
  "autorretencion": "0.00",
  "expense_account_suggested": "5135|5195|1435|null",
  "cost_center_suggested": "BOG-ADM|BOG-COM|null",
  "glosa_suggested": "glosa contable corta",
  "line_items": [
    {{
      "product_code": null,
      "description": "detalle",
      "unit": "UND",
      "quantity": "1.00",
      "unit_price": "0.00",
      "line_subtotal": "0.00"
    }}
  ],
  "confidence": {{
    "overall": 0.0,
    "nit": 0.0,
    "serie_numero": 0.0,
    "amounts": 0.0
  }},
  "warnings": [],
  "raw_text_summary": "resumen breve del texto leido"
}}
""".strip()

    def _default_target_fields(self, direction: Direction) -> list[str]:
        if direction == "sale":
            return ["serie", "number", "customerNit", "issueDate", "lineItems", "subtotal", "iva", "costCenter"]
        return ["serie", "number", "supplierNit", "subtotal", "iva", "expenseAccount", "costCenter"]

    def _parse_json(self, content: str) -> dict[str, Any]:
        text = content.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            decoder = json.JSONDecoder()
            start = text.find("{")
            while start >= 0:
                try:
                    parsed, _ = decoder.raw_decode(text[start:])
                    return parsed if isinstance(parsed, dict) else {}
                except json.JSONDecodeError:
                    start = text.find("{", start + 1)
        raise ValueError("Gemini no devolvio JSON valido para el comprobante.")

    def _normalize(self, data: dict[str, Any], direction: Direction) -> dict[str, Any]:
        serie = self._clean(data.get("serie") or data.get("series"))
        number = self._clean(data.get("number") or data.get("numero"))
        serie_numero = self._clean(data.get("serie_numero") or data.get("invoice_id"))
        if (not serie or not number) and serie_numero:
            match = re.search(r"([A-Z][A-Z0-9]{2,4})\s*[- ]\s*(\d{1,12})", serie_numero.upper())
            if match:
                serie = serie or match.group(1)
                number = number or match.group(2)
        if serie and number:
            serie_numero = f"{serie}-{number}"

        supplier_nit = self._nit(data.get("supplier_nit") or data.get("supplier_ruc") or data.get("nit_proveedor") or data.get("emisor_nit"))
        customer_nit = self._nit(data.get("customer_nit") or data.get("customer_ruc") or data.get("nit_cliente") or data.get("receptor_nit"))
        partner_nit = self._nit(data.get("partner_nit") or data.get("partner_ruc"))
        if not partner_nit:
            partner_nit = supplier_nit if direction == "purchase" else customer_nit
        if direction == "purchase" and not supplier_nit:
            supplier_nit = partner_nit
        if direction == "sale" and not customer_nit:
            customer_nit = partner_nit

        subtotal = self._money(data.get("subtotal") or data.get("base_imponible") or data.get("base"))
        iva = self._money(data.get("iva") or data.get("tax_amount") or data.get("impuesto"))
        total = self._money(data.get("total") or data.get("total_amount"))
        if total and not subtotal and not iva:
            subtotal = (total / Decimal("1.19")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            iva = (total - subtotal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        elif subtotal and not iva and total:
            iva = (total - subtotal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        elif subtotal and iva and not total:
            total = (subtotal + iva).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        return {
            "status": "ok",
            "direction": direction,
            "document_type": self._clean(data.get("document_type") or "factura") or "factura",
            "doc_type": self._doc_type_code(data.get("document_type")),
            "serie": serie,
            "number": number,
            "serie_numero": serie_numero,
            "issue_date": self._date(data.get("issue_date") or data.get("fecha_emision")),
            "supplier_nit": supplier_nit,
            "supplier_name": self._clean(data.get("supplier_name") or data.get("razon_social_proveedor")),
            "customer_nit": customer_nit,
            "customer_name": self._clean(data.get("customer_name") or data.get("razon_social_cliente")),
            "partner_nit": partner_nit,
            "currency": self._currency(data.get("currency")),
            "subtotal": self._money_text(subtotal),
            "iva": self._money_text(iva),
            "total": self._money_text(total),
            "expense_account_suggested": self._clean(data.get("expense_account_suggested")),
            "cost_center_suggested": self._clean(data.get("cost_center_suggested")),
            "glosa_suggested": self._clean(data.get("glosa_suggested")),
            "line_items": self._line_items(data.get("line_items")),
            "confidence": self._confidence(data.get("confidence")),
            "warnings": data.get("warnings") if isinstance(data.get("warnings"), list) else [],
            "raw_text_summary": self._clean(data.get("raw_text_summary")),
        }

    def _verify_dian(self, data: dict[str, Any]) -> dict[str, Any]:
        # Stub-compatible call; real DIAN verifier can enrich this result.
        return {
            "status": "PENDING",
            "partner_nit": data.get("partner_nit"),
            "document": {
                "type": data.get("doc_type"),
                "series": data.get("serie"),
                "number": data.get("number"),
                "issue_date": data.get("issue_date"),
                "total_amount": data.get("total"),
                "company_nit": self.company_nit,
            },
        }

    def _compliance_status(self, dian_validation: dict[str, Any]) -> dict[str, Any]:
        status = dian_validation.get("taxpayer_status") or dian_validation.get("estado")
        condition = dian_validation.get("taxpayer_condition") or dian_validation.get("condicion")
        blocked = status in {"BAJA", "BAJA DE OFICIO", "INACTIVO", "CANCELADO"} or condition in {"NO HABIDO", "NO HALLADO"}
        warnings: list[str] = []
        if blocked:
            warnings.append("Proveedor/cliente con estado DIAN no apto para persistencia automatica.")
        warnings.extend(str(item) for item in dian_validation.get("warnings", []))
        return {"blocked": blocked, "warnings": warnings}

    def _line_items(self, value: Any) -> list[dict[str, str | None]]:
        if not isinstance(value, list):
            return []
        items: list[dict[str, str | None]] = []
        for item in value[:80]:
            if not isinstance(item, dict):
                continue
            quantity = self._money(item.get("quantity") or item.get("cantidad")) or Decimal("0.00")
            unit_price = self._money(item.get("unit_price") or item.get("precio_unitario")) or Decimal("0.00")
            line_subtotal = self._money(item.get("line_subtotal") or item.get("subtotal"))
            if not line_subtotal and quantity and unit_price:
                line_subtotal = (quantity * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            items.append(
                {
                    "product_code": self._clean(item.get("product_code") or item.get("codigo")),
                    "description": self._clean(item.get("description") or item.get("descripcion")),
                    "unit": self._clean(item.get("unit") or item.get("unidad")) or "UND",
                    "quantity": self._money_text(quantity),
                    "unit_price": self._money_text(unit_price),
                    "line_subtotal": self._money_text(line_subtotal),
                }
            )
        return items

    def _confidence(self, value: Any) -> dict[str, float]:
        default = {"overall": 0.0, "nit": 0.0, "serie_numero": 0.0, "amounts": 0.0}
        if not isinstance(value, dict):
            return default
        for key in default:
            try:
                default[key] = max(0.0, min(1.0, float(value.get(key, 0.0))))
            except (TypeError, ValueError):
                default[key] = 0.0
        return default

    def _doc_type_code(self, value: Any) -> str:
        normalized = self._clean(value).upper() if value is not None else "FACTURA"
        if "CREDITO" in normalized:
            return "91"
        if "DEBITO" in normalized:
            return "92"
        return "01"

    def _currency(self, value: Any) -> str:
        text = (self._clean(value) or "").upper()
        if "USD" in text or "DOLAR" in text or "US$" in text:
            return "USD"
        return "COP"

    def _nit(self, value: Any) -> str | None:
        if value is None:
            return None
        cleaned = re.sub(r"[^\dkK]", "", str(value))
        return cleaned.upper() if 5 <= len(cleaned) <= 12 else None

    def _date(self, value: Any) -> str | None:
        text = self._clean(value)
        if not text:
            return None
        match = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", text)
        if match:
            return match.group(0)
        match = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b", text)
        if not match:
            return None
        day, month, year = match.groups()
        year = f"20{year}" if len(year) == 2 else year
        return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"

    def _money(self, value: Any) -> Decimal | None:
        if value in (None, ""):
            return None
        if isinstance(value, int | float | Decimal):
            return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        text = str(value).strip()
        text = re.sub(r"[^\d,.\-]", "", text)
        if not text:
            return None
        if "," in text and "." in text:
            if text.rfind(",") > text.rfind("."):
                text = text.replace(".", "").replace(",", ".")
            else:
                text = text.replace(",", "")
        elif "," in text:
            text = text.replace(",", ".")
        try:
            return Decimal(text).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except InvalidOperation:
            return None

    def _money_text(self, value: Decimal | None) -> str:
        return f"{(value or Decimal('0.00')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)}"

    def _clean(self, value: Any) -> str | None:
        if value is None:
            return None
        text = " ".join(str(value).strip().split())
        return text or None
