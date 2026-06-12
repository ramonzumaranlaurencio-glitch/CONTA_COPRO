from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from src.api.dependencies import get_current_context
from src.application.services.invoice_gemini_extractor import InvoiceGeminiExtractor
from src.application.services.dian_realtime_verifier import DianRealtimeVerifier
from src.config import settings
from src.infrastructure.adapters.ai.vision_provider import get_vision_client, is_vision_available

router = APIRouter(prefix="/sales", tags=["Sales IA"])


def _build_extractor() -> InvoiceGeminiExtractor:
    return InvoiceGeminiExtractor(
        get_vision_client(),
        DianRealtimeVerifier(
            nit_lookup_url=settings.dian_nit_lookup_url,
            cufe_validation_url=settings.dian_cufe_validation_url,
            token=settings.sunat_lookup_token,
            timeout_seconds=settings.dian_realtime_timeout_seconds,
        ),
        company_nit=settings.dian_nit,
    )


@router.post("/process-ia")
async def process_sale_with_ai(
    file: UploadFile | None = File(default=None),
    ctx=Depends(get_current_context),
):
    if not is_vision_available():
        raise HTTPException(status_code=500, detail="Configura CLAUDE_API_KEY o GEMINI_API_KEY para activar lectura IA de facturas.")
    if file is None:
        raise HTTPException(status_code=400, detail="Adjunta una imagen o PDF de factura de venta para procesar con IA")

    mime_type = file.content_type or "application/octet-stream"
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Archivo vacío")

    try:
        result = await _build_extractor().extract(
            file_bytes=raw,
            mime_type=mime_type,
            filename=file.filename,
            direction="sale",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error IA vision: {exc}") from exc

    if result.get("status") == "configuration_required":
        raise HTTPException(status_code=500, detail="Configura CLAUDE_API_KEY o GEMINI_API_KEY para activar lectura IA.")

    return {
        **result,
        "cost_center": result.get("cost_center_suggested"),
        "revenue_account": result.get("expense_account_suggested") or "4135",
    }
