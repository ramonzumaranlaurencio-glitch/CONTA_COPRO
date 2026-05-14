from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
import unicodedata

import httpx


def normalize_sunat_text(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    return " ".join(text.replace("_", " ").upper().split())


def normalize_document_status(value: object | None) -> str | None:
    normalized = normalize_sunat_text(value)
    if normalized is None:
        return None
    code_map = {
        "0": "ACTIVO",
        "1": "ANULADO",
        "2": "NO EXISTE",
        "3": "AUTORIZADO",
        "4": "NO AUTORIZADO",
    }
    return code_map.get(normalized, normalized)


@dataclass(frozen=True)
class SunatDocumentReference:
    document_type: str | None = None
    series: str | None = None
    number: str | None = None
    issue_date: str | None = None
    total_amount: str | None = None
    company_ruc: str | None = None

    @classmethod
    def from_payload(cls, payload: dict) -> "SunatDocumentReference":
        document = payload.get("document") or payload.get("financial_document") or {}
        issue_date = document.get("issue_date") or payload.get("entry_date")
        total_amount = (
            document.get("total_amount")
            or document.get("total")
            or payload.get("total")
            or payload.get("total_amount")
        )
        return cls(
            document_type=document.get("document_type") or payload.get("doc_type"),
            series=document.get("series") or document.get("serie") or payload.get("serie"),
            number=document.get("number") or payload.get("number"),
            issue_date=issue_date.isoformat() if hasattr(issue_date, "isoformat") else issue_date,
            total_amount=str(Decimal(str(total_amount))) if total_amount is not None else None,
            company_ruc=document.get("company_ruc") or payload.get("company_ruc") or payload.get("sunat_ruc"),
        )

    def is_complete_for_cpe(self) -> bool:
        return bool(self.company_ruc and self.document_type and self.series and self.number)


@dataclass
class SunatRealtimeResult:
    ruc: str | None
    taxpayer_status: str | None = None
    taxpayer_condition: str | None = None
    document_status: str | None = None
    source: str = "not_configured"
    checked_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    raw_response: dict = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "ruc": self.ruc,
            "taxpayer_status": self.taxpayer_status,
            "taxpayer_condition": self.taxpayer_condition,
            "document_status": self.document_status,
            "source": self.source,
            "checked_at": self.checked_at,
            "raw_response": self.raw_response,
            "warnings": self.warnings,
        }


class SunatRealtimeVerifier:
    """Configurable real-time SUNAT/RUC/CPE lookup used by the expert guard."""

    def __init__(
        self,
        *,
        ruc_lookup_url: str | None,
        cpe_lookup_url: str | None = None,
        token: str | None = None,
        timeout_seconds: float = 3.0,
    ) -> None:
        self.ruc_lookup_url = ruc_lookup_url
        self.cpe_lookup_url = cpe_lookup_url
        self.token = token
        self.timeout_seconds = timeout_seconds

    def verify(self, ruc: str | None, document: SunatDocumentReference | None = None) -> SunatRealtimeResult:
        result = SunatRealtimeResult(ruc=ruc)
        if not ruc:
            result.warnings.append("RUC no enviado para verificacion SUNAT.")
            return result

        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        if not self.ruc_lookup_url and not self.cpe_lookup_url:
            result.warnings.append("SUNAT_RUC_LOOKUP_URL/SUNAT_CPE_LOOKUP_URL no configurado.")
            return result

        try:
            with httpx.Client(timeout=self.timeout_seconds, headers=headers) as client:
                if self.ruc_lookup_url:
                    ruc_payload = self._get_json(client, self.ruc_lookup_url, {"numero": ruc, "ruc": ruc})
                    result.raw_response["ruc"] = ruc_payload
                    result.taxpayer_status = self._extract_first(
                        ruc_payload,
                        "estado",
                        "status",
                        "estadoContribuyente",
                        "taxpayer_status",
                    )
                    result.taxpayer_condition = self._extract_first(
                        ruc_payload,
                        "condicion",
                        "condition",
                        "condicionDomicilio",
                        "taxpayer_condition",
                    )
                    result.source = "sunat_ruc_lookup"

                if self.cpe_lookup_url and document and document.is_complete_for_cpe():
                    cpe_params = {
                        "ruc": document.company_ruc,
                        "document_type": document.document_type,
                        "tipo": document.document_type,
                        "serie": document.series,
                        "series": document.series,
                        "numero": document.number,
                        "number": document.number,
                        "fecha": document.issue_date,
                        "issue_date": document.issue_date,
                        "total": document.total_amount,
                    }
                    cpe_payload = self._get_json(client, self.cpe_lookup_url, cpe_params)
                    result.raw_response["cpe"] = cpe_payload
                    result.document_status = normalize_document_status(
                        self._extract_first(
                            cpe_payload,
                            "estadoCp",
                            "estado_cpe",
                            "document_status",
                            "status",
                            "estado",
                        )
                    )
                    result.source = "sunat_ruc_cpe_lookup"
        except Exception as exc:
            result.source = "unavailable"
            result.warnings.append(f"No se pudo consultar SUNAT en tiempo real: {exc}")

        result.taxpayer_status = normalize_sunat_text(result.taxpayer_status)
        result.taxpayer_condition = normalize_sunat_text(result.taxpayer_condition)
        return result

    def _get_json(self, client: httpx.Client, url: str, params: dict) -> dict:
        formatted_url = url.format(**{key: value or "" for key, value in params.items()})
        if "{" in url and "}" in url:
            response = client.get(formatted_url)
        else:
            clean_params = {key: value for key, value in params.items() if value not in (None, "")}
            response = client.get(formatted_url, params=clean_params)
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, dict) else {"payload": payload}

    def _extract_first(self, payload: dict, *keys: str) -> object | None:
        for key in keys:
            if key in payload:
                return payload[key]
        for value in payload.values():
            if isinstance(value, dict):
                nested = self._extract_first(value, *keys)
                if nested is not None:
                    return nested
        return None
