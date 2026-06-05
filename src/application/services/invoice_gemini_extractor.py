from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import json
import re
from typing import Any, Literal

from src.application.services.sunat_realtime_verifier import (
    SunatDocumentReference,
    SunatRealtimeVerifier,
    normalize_sunat_text,
)
from src.infrastructure.adapters.ai.gemini import GeminiClient


Direction = Literal["purchase", "sale"]


class InvoiceGeminiExtractor:
    """Extracts Peruvian invoice fields from images/PDFs using Gemini vision."""

    def __init__(
        self,
        gemini_client: GeminiClient,
        sunat_verifier: SunatRealtimeVerifier,
        *,
        company_ruc: str | None = None,
    ) -> None:
        self.gemini_client = gemini_client
        self.sunat_verifier = sunat_verifier
        self.company_ruc = company_ruc

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
        sunat_validation = self._verify_sunat(normalized)
        normalized["sunat_validation"] = sunat_validation
        normalized["compliance"] = self._compliance_status(sunat_validation)
        normalized["provider"] = "gemini"
        normalized["model"] = self.gemini_client.model
        normalized["checked_at"] = datetime.now(UTC).isoformat()
        return normalized

    def _prompt(self, direction: Direction, filename: str | None, mime_type: str, target_fields: list[str] | None) -> str:
        partner_role = "proveedor/emisor" if direction == "purchase" else "cliente/receptor"
        fields = ", ".join(target_fields or self._default_target_fields(direction))
        return f"""
Eres el motor OCR fiscal de CONTA_PRO Enterprise para Peru.
Lee la imagen PIXEL POR PIXEL y por layout visual. Analiza cada pixel del archivo adjunto. Puede ser JPG, PNG, WEBP o PDF.
Extrae solo datos visibles del comprobante. No inventes datos; si no estas seguro usa null y baja la confianza.

Contexto del flujo: {direction}. El RUC partner debe ser el RUC del {partner_role}.
Campos que se van a llenar en el formulario actual: {fields}.
Archivo: {filename or "sin_nombre"} ({mime_type}).

Devuelve exclusivamente JSON valido con esta forma:
{{
  "document_type": "factura|boleta|nota_credito|nota_debito|otro",
  "serie": "F001",
  "number": "12345",
  "serie_numero": "F001-12345",
  "issue_date": "YYYY-MM-DD",
  "supplier_ruc": "20123456789",
  "supplier_name": "RAZON SOCIAL EMISOR",
  "customer_ruc": "20987654321",
  "customer_name": "RAZON SOCIAL RECEPTOR",
  "partner_ruc": "RUC usado por el flujo",
  "currency": "PEN|USD",
  "subtotal": "0.00",
  "igv": "0.00",
  "total": "0.00",
  "percepcion": "0.00",
  "detraccion": "0.00",
  "expense_account_suggested": "6311|6011|6343|null",
  "cost_center_suggested": "LIM-ADM|LIM-COM|null",
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
    "ruc": 0.0,
    "serie_numero": 0.0,
    "amounts": 0.0
  }},
  "warnings": [],
  "raw_text_summary": "resumen breve del texto leido"
}}
""".strip()

    def _default_target_fields(self, direction: Direction) -> list[str]:
        if direction == "sale":
            return ["serie", "number", "customerRuc", "issueDate", "lineItems", "subtotal", "igv", "percepcion", "detraccion", "costCenter"]
        return ["serie", "number", "supplierRuc", "subtotal", "igv", "expenseAccount", "costCenter"]

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

        supplier_ruc = self._ruc(data.get("supplier_ruc") or data.get("ruc_proveedor") or data.get("emisor_ruc"))
        customer_ruc = self._ruc(data.get("customer_ruc") or data.get("ruc_cliente") or data.get("receptor_ruc"))
        partner_ruc = self._ruc(data.get("partner_ruc"))
        if not partner_ruc:
            partner_ruc = supplier_ruc if direction == "purchase" else customer_ruc
        if direction == "purchase" and not supplier_ruc:
            supplier_ruc = partner_ruc
        if direction == "sale" and not customer_ruc:
            customer_ruc = partner_ruc

        subtotal = self._money(data.get("subtotal") or data.get("base_imponible"))
        igv = self._money(data.get("igv") or data.get("tax_amount"))
        total = self._money(data.get("total") or data.get("total_amount"))
        if total and not subtotal and not igv:
            subtotal = (total / Decimal("1.18")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            igv = (total - subtotal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        elif subtotal and not igv and total:
            igv = (total - subtotal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        elif subtotal and igv and not total:
            total = (subtotal + igv).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        return {
            "status": "ok",
            "direction": direction,
            "document_type": self._clean(data.get("document_type") or "factura") or "factura",
            "doc_type": self._doc_type_code(data.get("document_type")),
            "serie": serie,
            "number": number,
            "serie_numero": serie_numero,
            "issue_date": self._date(data.get("issue_date") or data.get("fecha_emision")),
            "supplier_ruc": supplier_ruc,
            "supplier_name": self._clean(data.get("supplier_name") or data.get("razon_social_proveedor")),
            "customer_ruc": customer_ruc,
            "customer_name": self._clean(data.get("customer_name") or data.get("razon_social_cliente")),
            "partner_ruc": partner_ruc,
            "currency": self._currency(data.get("currency")),
            "subtotal": self._money_text(subtotal),
            "igv": self._money_text(igv),
            "total": self._money_text(total),
            "percepcion": self._money_text(self._money(data.get("percepcion"))),
            "detraccion": self._money_text(self._money(data.get("detraccion"))),
            "expense_account_suggested": self._clean(data.get("expense_account_suggested")),
            "cost_center_suggested": self._clean(data.get("cost_center_suggested")),
            "glosa_suggested": self._clean(data.get("glosa_suggested")),
            "line_items": self._line_items(data.get("line_items")),
            "confidence": self._confidence(data.get("confidence")),
            "warnings": data.get("warnings") if isinstance(data.get("warnings"), list) else [],
            "raw_text_summary": self._clean(data.get("raw_text_summary")),
        }

    def _verify_sunat(self, data: dict[str, Any]) -> dict[str, Any]:
        document = SunatDocumentReference(
            document_type=data.get("doc_type"),
            series=data.get("serie"),
            number=data.get("number"),
            issue_date=data.get("issue_date"),
            total_amount=data.get("total"),
            company_ruc=self.company_ruc,
        )
        return self.sunat_verifier.verify(data.get("partner_ruc"), document).as_dict()

    def _compliance_status(self, sunat_validation: dict[str, Any]) -> dict[str, Any]:
        status = normalize_sunat_text(sunat_validation.get("taxpayer_status"))
        condition = normalize_sunat_text(sunat_validation.get("taxpayer_condition"))
        blocked = status in {"BAJA", "BAJA DE OFICIO", "INACTIVO"} or condition in {"NO HABIDO", "NO HALLADO"}
        warnings: list[str] = []
        if blocked:
            warnings.append("Proveedor/cliente con estado SUNAT no apto para persistencia automatica.")
        warnings.extend(str(item) for item in sunat_validation.get("warnings", []))
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
        default = {"overall": 0.0, "ruc": 0.0, "serie_numero": 0.0, "amounts": 0.0}
        if not isinstance(value, dict):
            return default
        for key in default:
            try:
                default[key] = max(0.0, min(1.0, float(value.get(key, 0.0))))
            except (TypeError, ValueError):
                default[key] = 0.0
        return default

    def _doc_type_code(self, value: Any) -> str:
        normalized = normalize_sunat_text(value) or "FACTURA"
        if "BOLETA" in normalized:
            return "03"
        if "CREDITO" in normalized:
            return "07"
        if "DEBITO" in normalized:
            return "08"
        return "01"

    def _currency(self, value: Any) -> str:
        text = (self._clean(value) or "").upper()
        if "USD" in text or "DOLAR" in text or "US$" in text:
            return "USD"
        return "COP"

    def _ruc(self, value: Any) -> str | None:
        if value is None:
            return None
        match = re.search(r"\b(10|15|17|20)\d{9}\b", str(value).replace(" ", ""))
        return match.group(0) if match else None

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
