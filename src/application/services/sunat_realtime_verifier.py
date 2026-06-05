from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
import unicodedata

import httpx


def normalize_dian_text(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    return " ".join(text.replace("_", " ").upper().split())


# Alias backward-compat
normalize_sunat_text = normalize_dian_text


def normalize_document_status(value: object | None) -> str | None:
    normalized = normalize_dian_text(value)
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
class DianDocumentReference:
    """Referencia a un documento DIAN — factura electrónica con CUFE."""
    document_type: str | None = None
    series: str | None = None
    number: str | None = None
    issue_date: str | None = None
    total_amount: str | None = None
    company_nit: str | None = None
    cufe: str | None = None

    @classmethod
    def from_payload(cls, payload: dict) -> "DianDocumentReference":
        document = payload.get("document") or payload.get("financial_document") or {}
        issue_date = document.get("issue_date") or payload.get("entry_date")
        total_amount = (
            document.get("total_amount")
            or document.get("total")
            or payload.get("total")
            or payload.get("total_amount")
        )
        nit = (
            document.get("company_nit")
            or payload.get("company_nit")
            or document.get("company_ruc")
            or payload.get("company_ruc")
        )
        return cls(
            document_type=document.get("document_type") or payload.get("doc_type"),
            series=document.get("series") or document.get("serie") or payload.get("serie"),
            number=document.get("number") or payload.get("number"),
            issue_date=issue_date.isoformat() if hasattr(issue_date, "isoformat") else issue_date,
            total_amount=str(Decimal(str(total_amount))) if total_amount is not None else None,
            company_nit=nit,
            cufe=document.get("cufe") or payload.get("cufe"),
        )

    def is_complete_for_cufe(self) -> bool:
        return bool(self.company_nit and self.document_type and self.series and self.number)


# Alias backward-compat
SunatDocumentReference = DianDocumentReference


@dataclass
class DianRealtimeResult:
    nit: str | None
    taxpayer_status: str | None = None
    taxpayer_condition: str | None = None
    document_status: str | None = None
    cufe_valid: bool | None = None
    source: str = "not_configured"
    checked_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    raw_response: dict = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "nit": self.nit,
            "taxpayer_status": self.taxpayer_status,
            "taxpayer_condition": self.taxpayer_condition,
            "document_status": self.document_status,
            "cufe_valid": self.cufe_valid,
            "source": self.source,
            "checked_at": self.checked_at,
            "raw_response": self.raw_response,
            "warnings": self.warnings,
        }


# Alias backward-compat
SunatRealtimeResult = DianRealtimeResult


class DianNitVerifier:
    """Verificador en tiempo real de NIT/CUFE contra los servicios DIAN Colombia."""

    def __init__(
        self,
        *,
        nit_lookup_url: str | None,
        cufe_validation_url: str | None = None,
        token: str | None = None,
        timeout_seconds: float = 3.0,
    ) -> None:
        self.nit_lookup_url = nit_lookup_url
        self.cufe_validation_url = cufe_validation_url
        self.token = token
        self.timeout_seconds = timeout_seconds

    def verify(self, nit: str | None, document: DianDocumentReference | None = None) -> DianRealtimeResult:
        result = DianRealtimeResult(nit=nit)
        if not nit:
            result.warnings.append("NIT no enviado para verificacion DIAN.")
            return result

        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        if not self.nit_lookup_url and not self.cufe_validation_url:
            result.warnings.append("DIAN_NIT_LOOKUP_URL/DIAN_CUFE_VALIDATION_URL no configurado.")
            return result

        try:
            with httpx.Client(timeout=self.timeout_seconds, headers=headers) as client:
                if self.nit_lookup_url:
                    nit_payload = self._get_json(client, self.nit_lookup_url, {"nit": nit, "numero": nit})
                    result.raw_response["nit"] = nit_payload
                    result.taxpayer_status = self._extract_first(
                        nit_payload,
                        "estado",
                        "status",
                        "estadoContribuyente",
                        "taxpayer_status",
                    )
                    result.taxpayer_condition = self._extract_first(
                        nit_payload,
                        "condicion",
                        "condition",
                        "condicionDomicilio",
                        "taxpayer_condition",
                    )
                    result.source = "dian_nit_lookup"

                if self.cufe_validation_url and document and document.is_complete_for_cufe():
                    cufe_params = {
                        "nit": document.company_nit,
                        "document_type": document.document_type,
                        "tipo": document.document_type,
                        "serie": document.series,
                        "numero": document.number,
                        "fecha": document.issue_date,
                        "total": document.total_amount,
                        "cufe": document.cufe or "",
                    }
                    cufe_payload = self._get_json(client, self.cufe_validation_url, cufe_params)
                    result.raw_response["cufe"] = cufe_payload
                    result.document_status = normalize_document_status(
                        self._extract_first(
                            cufe_payload,
                            "estadoCufe",
                            "estado_cufe",
                            "document_status",
                            "status",
                            "estado",
                        )
                    )
                    result.cufe_valid = result.document_status == "AUTORIZADO"
                    result.source = "dian_nit_cufe_lookup"
        except Exception as exc:
            result.source = "unavailable"
            result.warnings.append(f"No se pudo consultar DIAN en tiempo real: {exc}")

        result.taxpayer_status = normalize_dian_text(result.taxpayer_status)
        result.taxpayer_condition = normalize_dian_text(result.taxpayer_condition)
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


# Alias backward-compat — código existente que importe SunatRealtimeVerifier sigue funcionando
SunatRealtimeVerifier = DianNitVerifier
