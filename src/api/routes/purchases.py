from __future__ import annotations

import base64
import json
import mimetypes

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from src.api.dependencies import get_current_context
from src.config import settings

router = APIRouter(prefix="/purchases", tags=["Purchases IA"])


def _json_schema_instruction() -> str:
    return """
Devuelve SOLO JSON válido, sin markdown, con esta estructura:
{
  "serie": "F001",
  "number": "12345",
  "issue_date": "YYYY-MM-DD",
  "supplier_ruc": "20123456789",
  "supplier_name": "RAZON SOCIAL",
  "subtotal": 100.00,
  "igv": 18.00,
  "total": 118.00,
  "cost_center": "LIM-ADM",
  "expense_account": "636101",
  "items": [
    {
      "code": "",
      "description": "descripcion",
      "unit": "UND",
      "quantity": 1,
      "unit_price": 100.00,
      "line_subtotal": 100.00,
      "account_code": "636101",
      "account_name": "Servicios basicos",
      "cost_center": "LIM-ADM",
      "tax_treatment": "IGV credito fiscal si cumple requisitos formales y causalidad",
      "ai_reason": "motivo de clasificacion",
      "ai_confidence": 0.95
    }
  ],
  "warnings": []
}

Reglas contables peruanas iniciales:
- agua, luz, gas, internet, telefonia, alcantarillado: 636101 Servicios basicos.
- asesoria, consultoria, servicios profesionales: 632101 Asesoria y consultoria.
- transporte, flete, courier, delivery: 624101 Transportes y fletes.
- mantenimiento, reparacion, soporte tecnico: 634101 Mantenimiento y reparaciones.
- utiles, suministros, limpieza, oficina: 656101 Suministros diversos.
- publicidad, marketing, anuncios: 637101 Publicidad y marketing.
- alquiler, arrendamiento: 635101 Alquileres.
- laptop, computadora, maquinaria, equipo, mobiliario, vehiculo: 336101 Activo fijo.
- mercaderia, inventario, productos para venta: 601101 Compras de mercaderias.
- si no hay confianza suficiente: 659101 Otros gastos de gestion y warning.

No inventes proveedor. Si no se ve razon social, deja supplier_name vacío y agrega warning.
Si no se ve centro de costo, usa LIM-ADM.
"""


@router.post("/process-ia")
async def process_purchase_with_gemini(
    file: UploadFile = File(...),
    ctx=Depends(get_current_context),
):
    if not settings.gemini_api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY no configurado")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Archivo vacío")

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
Eres un motor experto de lectura de comprobantes, contabilidad peruana, registro de compras, IGV, centro de costos y plan contable.
Analiza el archivo pixel por pixel si es imagen o PDF.
Extrae información de factura/boleta/recibo y clasifica cada item.
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
                "temperature": 0.1,
                "response_mime_type": "application/json",
            },
        )

        text = result.text or "{}"
        data = json.loads(text)

        if not isinstance(data, dict):
            raise ValueError("Gemini no devolvió un objeto JSON")

        data.setdefault("warnings", [])
        data.setdefault("items", [])
        return data

    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini devolvió JSON inválido: {str(exc)}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error Gemini: {str(exc)}") from exc
