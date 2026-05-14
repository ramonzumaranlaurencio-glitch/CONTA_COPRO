from __future__ import annotations

import base64
import io
import re
from datetime import date
from typing import Any

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover
    PdfReader = None

app = FastAPI(title="HR Local Server", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ContractPayload(BaseModel):
    tenant_id: str
    worker_id: str
    tipo_contrato: str = "PLAZO INDETERMINADO"
    start_date: str | None = None
    end_date: str | None = None
    pension_system: str | None = None
    include_annex_package: bool = True


def _extract_text(filename: str, content_type: str | None, raw: bytes) -> tuple[str, list[str]]:
    warnings: list[str] = []
    if filename.lower().endswith(".pdf") or (content_type or "").lower() == "application/pdf":
        if PdfReader is None:
            return "", ["pypdf no disponible para lectura PDF."]
        reader = PdfReader(io.BytesIO(raw))
        pages: list[str] = []
        for page in reader.pages:
            pages.append((page.extract_text() or "").strip())
        text = "\n[PAGE_BREAK]\n".join(pages).strip()
        if not text:
            warnings.append("PDF sin texto extraible (posible escaneo sin OCR).")
        return text, warnings

    try:
        return raw.decode("utf-8", errors="ignore"), warnings
    except Exception:
        return "", ["No se pudo extraer texto del archivo."]


def _first_match(pattern: str, text: str) -> str:
    match = re.search(pattern, text, flags=re.IGNORECASE)
    return match.group(1).strip() if match else ""


def _clean_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def _title_name(raw: str) -> str:
    if not raw:
        return ""
    return " ".join(part.capitalize() for part in _clean_spaces(raw).split(" "))


def _to_iso_date_es(raw: str) -> str:
    value = _clean_spaces(raw).lower()
    months = {
        "enero": "01",
        "febrero": "02",
        "marzo": "03",
        "abril": "04",
        "mayo": "05",
        "junio": "06",
        "julio": "07",
        "agosto": "08",
        "septiembre": "09",
        "setiembre": "09",
        "octubre": "10",
        "noviembre": "11",
        "diciembre": "12",
    }
    match = re.search(r"(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})", value)
    if not match:
        return ""
    day = match.group(1).zfill(2)
    month = months.get(match.group(2), "")
    year = match.group(3)
    if not month:
        return ""
    return f"{year}-{month}-{day}"


def _guess_name(text: str, filename: str) -> tuple[str, str]:
    line = _first_match(r"(?:nombre(?:s)?|apellidos?)\s*[:\-]\s*([^\n\r]{4,80})", text)
    if line:
        parts = _clean_spaces(line).split(" ")
    else:
        # Try to detect a full-name line near contact section.
        candidates = re.findall(r"(?:^|\n)\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+){2,4})\s*(?:\n|$)", text)
        if candidates:
            parts = _clean_spaces(candidates[0]).split(" ")
        else:
            token = re.sub(r"[^A-Za-z\s]", " ", filename.rsplit(".", 1)[0])
            parts = [p for p in token.split() if len(p) > 2]

    if not parts:
        return "", ""
    if len(parts) == 1:
        return _title_name(parts[0]), ""
    if len(parts) == 2:
        return _title_name(parts[0]), _title_name(parts[1])
    return _title_name(" ".join(parts[:2])), _title_name(" ".join(parts[2:]))


def _extract_worker(text: str, filename: str, reniec_address: str | None = None) -> dict[str, Any]:
    nombres, apellidos = _guess_name(text, filename)
    dni = _first_match(r"\b(\d{8})\b", text)
    email = _first_match(r"([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})", text)
    phone = _first_match(r"(?:telefono|tel|celular|movil|telf)\s*[:\-]?\s*\(?([0-9\-\s]{7,15})\)?", text)
    if not phone:
        phone = _first_match(r"\b([0-9]{9,11})\b", text)

    birth_date = _first_match(r"Lugar y Fecha de Nacimiento\s*[^\n\r,]*,\s*([^\n\r]+)", text)
    birth_date = _to_iso_date_es(birth_date)
    address = _first_match(r"(?:^|\n)\s*([A-Za-z0-9#\-.,\s]{8,80}(?:huila|trujillo|lima|chiclayo|peru))", text)
    address = _clean_spaces(address)

    puesto = _first_match(r"\bPUESTO\b\s*[:\-]?\s*([^\n\r]{3,120})", text)
    profesion = _first_match(r"(?:profesion|cargo)\s*[:\-]\s*([^\n\r]{3,80})", text)
    if not profesion:
        profesion = _first_match(r"RESUMEN\s+EXPERIENCIA\s+PROFESIONAL\s*\n\s*([^\n\r]{3,80})", text)
    if not profesion and puesto:
        profesion = puesto
    if not profesion:
        profesion = "Analista"

    experiencia = _first_match(r"RESUMEN\s+EXPERIENCIA\s+PROFESIONAL\s*\n([\s\S]{40,500})", text)
    if experiencia:
        experiencia = _clean_spaces(experiencia)[:260]
    else:
        experiencia = _first_match(r"(?:experiencia)\s*[:\-]\s*([^\n\r]{5,200})", text)

    skills = []
    for key in ["excel", "sap", "python", "power bi", "contabilidad", "finanzas"]:
        if re.search(rf"\b{re.escape(key)}\b", text, flags=re.IGNORECASE):
            skills.append(key.title())
    for key in ["logistica", "kardex", "inventarios", "almacen", "seguridad", "iso 9001", "ohsas"]:
        if re.search(rf"\b{re.escape(key)}\b", text, flags=re.IGNORECASE):
            skills.append(key.title())

    cleaned_profesion = _clean_spaces(profesion).strip("-:;,. ")
    _raw_puesto = _clean_spaces(puesto or cleaned_profesion).strip("-:;,. ")
    # Quitar palabras sueltas de 1-3 letras al final (ej: "De", "En", "La")
    cleaned_puesto = re.sub(r"\s+\b[A-Za-záéíóúÁÉÍÓÚ]{1,3}\b\s*$", "", _raw_puesto).strip("-:;,. ")

    return {
        "nombres": nombres,
        "apellidos": apellidos,
        "dni": dni,
        "fecha_nacimiento": birth_date,
        "direccion_domicilio": reniec_address or address,
        "telefono": re.sub(r"\s+", "", phone),
        "email": email,
        "profesion": cleaned_profesion,
        "experiencia": experiencia,
        "cargo_postulado": cleaned_puesto,
        "sueldo_pactado": "0.00",
        "habilidades_clave": sorted(set(skills)),
        "alerts": [],
    }


def _pdf_base64(worker_name: str, tipo: str) -> str:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas

        buffer = io.BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(60, 780, "Contrato Laboral (Modo Local)")
        pdf.setFont("Helvetica", 11)
        pdf.drawString(60, 750, f"Trabajador: {worker_name}")
        pdf.drawString(60, 730, f"Tipo: {tipo}")
        pdf.drawString(60, 710, f"Fecha: {date.today().isoformat()}")
        pdf.save()
        raw = buffer.getvalue()
    except Exception:
        # Minimal valid PDF fallback.
        raw = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
    return base64.b64encode(raw).decode("utf-8")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "hr-local"}


# Almacenamiento en memoria para trabajadores locales
_workers_db: list[dict[str, Any]] = []


@app.get("/api/v1/hr/workers")
async def list_workers() -> list[dict[str, Any]]:
    return _workers_db


@app.post("/api/v1/hr/workers")
async def save_worker(request: Request) -> dict[str, Any]:
    body = await request.json()
    worker_id = f"TRB-LOCAL-{len(_workers_db) + 1:03d}"
    body["worker_id"] = worker_id
    # Actualizar si ya existe por DNI
    dni = body.get("dni")
    for i, w in enumerate(_workers_db):
        if dni and w.get("dni") == dni:
            _workers_db[i] = body
            return {"worker_id": worker_id, "status": "updated", "worker": body}
    _workers_db.append(body)
    return {"worker_id": worker_id, "status": "created", "worker": body}


@app.post("/api/v1/hr/legal-library/upload")
async def upload_legal(file: UploadFile = File(...)) -> dict[str, Any]:
    return {"status": "ok", "filename": file.filename, "message": "Plantilla legal indexada localmente."}


@app.post("/api/v1/hr/identity/validate")
async def validate_identity(request: Request) -> dict[str, Any]:
    body = await request.json()
    return {"status": "ok", "validated": True, "dni": body.get("dni"), "message": "Identidad validada (modo local)."}


@app.post("/api/v1/hr/cv/extract")
async def extract_cv(
    file: UploadFile = File(...),
    reniec_address: str | None = Form(default=None),
) -> dict[str, Any]:
    raw = await file.read()
    text, warnings = _extract_text(file.filename or "cv", file.content_type, raw)
    worker = _extract_worker(text, file.filename or "cv", reniec_address=reniec_address)
    return {
        "tenant_id": "local",
        "filename": file.filename,
        "text_preview": text[:900],
        "warnings": warnings,
        "worker": worker,
        "workers_batch": [{"worker_code": "TRB-LOCAL-001", "puesto_sugerido": worker.get("cargo_postulado"), "worker": worker}],
        "batch_count": 1,
    }


@app.post("/api/v1/hr/contracts/generate")
async def generate_contract(payload: ContractPayload) -> dict[str, Any]:
    pdf_b64 = _pdf_base64(payload.worker_id, payload.tipo_contrato)
    return {
        "contract_id": "LOCAL-CONTRACT-001",
        "status": "PENDING_SIGNATURE",
        "filename": "contrato-local.pdf",
        "mime_type": "application/pdf",
        "pdf_base64": pdf_b64,
        "package_filename": "paquete-contratacion-local.zip",
        "package_zip_base64": None,
        "legal_basis": {"mode": "local"},
        "signature_webhook": "/api/v1/hr/contracts/LOCAL-CONTRACT-001/signature-webhook",
        "t_registro_due": date.today().isoformat(),
        "compliance_alerts": [],
        "preview": "Contrato generado en servidor RRHH local.",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8001)
