from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
import base64
import io
import re
import zipfile
from uuid import uuid4

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


CV_EXTRACTION_PROMPT = (
    "Actua como un Especialista en Seleccion de Personal. Extrae del archivo adjunto los siguientes campos: "
    "Nombres, Apellidos, DNI (valida que tenga 8 digitos), Direccion, Telefono, Correo, Profesion y Experiencia. "
    "Instruccion critica: Si encuentras discrepancias entre la direccion del CV y los datos de Reniec, genera una "
    "alerta de 'Validacion de Domicilio'. Mapea cada dato a su celda correspondiente en el formulario Registro_Personal_V1."
)


LABOR_LEGAL_LIBRARY = [
    {
        "source_id": "TUO_DL_728",
        "title": "TUO del D.L. 728 - Ley de Productividad y Competitividad Laboral",
        "url": "https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/703476-728",
    },
    {
        "source_id": "LEY_JORNADA_SOBRETIEMPO",
        "title": "Ley de Jornada de Trabajo, Horario y Trabajo en Sobretiempo",
        "url": "https://www.gob.pe/",
    },
    {
        "source_id": "DS_005_2012_TR_SST",
        "title": "Reglamento de Seguridad y Salud en el Trabajo - D.S. 005-2012-TR",
        "url": "https://www.gob.pe/institucion/presidencia/normas-legales/462577-005-2012-tr",
    },
    {
        "source_id": "LEY_29733_DATOS_PERSONALES",
        "title": "Ley 29733 - Ley de Proteccion de Datos Personales",
        "url": "https://www.gob.pe/institucion/anpd/normas-legales/2018427-29733-2011",
    },
    {
        "source_id": "MTPE_MODELOS_CONTRATO",
        "title": "Modelos de Contratos del MTPE",
        "url": "https://www.gob.pe/mtpe",
    },
]


@dataclass
class WorkerDraft:
    nombres: str = ""
    apellidos: str = ""
    dni: str = ""
    fecha_nacimiento: str | None = None
    direccion_domicilio: str = ""
    telefono: str = ""
    email: str = ""
    profesion: str = ""
    experiencia: str = ""
    cargo_postulado: str = ""
    sueldo_pactado: Decimal = Decimal("0.00")
    habilidades_clave: list[str] = field(default_factory=list)
    alerts: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "nombres": self.nombres,
            "apellidos": self.apellidos,
            "dni": self.dni,
            "fecha_nacimiento": self.fecha_nacimiento,
            "direccion_domicilio": self.direccion_domicilio,
            "telefono": self.telefono,
            "email": self.email,
            "profesion": self.profesion,
            "experiencia": self.experiencia,
            "cargo_postulado": self.cargo_postulado,
            "sueldo_pactado": str(self.sueldo_pactado),
            "habilidades_clave": self.habilidades_clave,
            "alerts": self.alerts,
        }


class CvExtractionService:
    def extract_text(self, filename: str, content_type: str | None, raw_bytes: bytes) -> tuple[str, list[str]]:
        warnings: list[str] = []
        text = ""
        lower_name = filename.lower()

        if (content_type or "").startswith("image/") or lower_name.endswith((".png", ".jpg", ".jpeg", ".webp")):
            text = self._extract_image_text(raw_bytes, warnings)
        elif lower_name.endswith(".pdf") or content_type == "application/pdf":
            text = self._extract_pdf_text(raw_bytes, warnings)

        if not text:
            text = self._decode_bytes(raw_bytes)
        if not text:
            warnings.append("No se pudo extraer texto OCR; complete o corrija el formulario manualmente.")
        return text, warnings

    def parse_cv(self, text: str, *, reniec_address: str | None = None) -> WorkerDraft:
        cleaned = " ".join(text.replace("\n", " ").split())
        draft = WorkerDraft()
        draft.dni = self._first_match(cleaned, r"\b(\d{8})\b")
        draft.email = self._first_match(cleaned, r"([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})")
        draft.telefono = self._first_match(cleaned, r"(?:\+?51\s*)?(\d{9})\b")
        draft.fecha_nacimiento = self._first_match(cleaned, r"(\d{1,2}[/-]\d{1,2}[/-]\d{4})") or None
        draft.sueldo_pactado = self._money(cleaned)
        draft.direccion_domicilio = self._extract_address(cleaned)
        draft.profesion = self._extract_profession(cleaned)
        draft.experiencia = self._extract_experience(cleaned)
        draft.cargo_postulado = draft.profesion or "Por definir"
        draft.habilidades_clave = self._extract_skills(cleaned)
        draft.nombres, draft.apellidos = self._extract_names(cleaned)

        if draft.dni and not re.fullmatch(r"\d{8}", draft.dni):
            draft.alerts.append("DNI invalido: debe tener 8 digitos.")
        if not draft.dni:
            draft.alerts.append("DNI no detectado en el CV.")
        if reniec_address and draft.direccion_domicilio and self._normalize_address(reniec_address) != self._normalize_address(draft.direccion_domicilio):
            draft.alerts.append("Validacion de Domicilio: la direccion del CV difiere de RENIEC.")

        return draft

    def parse_cv_batch(self, text: str, *, reniec_address: str | None = None) -> list[dict]:
        chunks = self._split_candidate_chunks(text)
        if not chunks:
            chunks = [text]

        result: list[dict] = []
        seen_dni: set[str] = set()
        for index, chunk in enumerate(chunks, start=1):
            draft = self.parse_cv(chunk, reniec_address=reniec_address)
            draft_data = draft.as_dict()
            dni = str(draft_data.get("dni") or "").strip()
            if dni and dni in seen_dni:
                continue
            if dni:
                seen_dni.add(dni)

            worker_code = new_worker_code()
            puesto_sugerido = draft_data.get("cargo_postulado") or draft_data.get("profesion") or "Por definir"
            result.append(
                {
                    "candidate_index": index,
                    "worker_code": worker_code,
                    "puesto_sugerido": puesto_sugerido,
                    "worker": draft_data,
                }
            )
        return result

    def _extract_image_text(self, raw_bytes: bytes, warnings: list[str]) -> str:
        try:
            from PIL import Image
            import pytesseract

            image = Image.open(io.BytesIO(raw_bytes))
            return pytesseract.image_to_string(image, lang="spa+eng").strip()
        except Exception as exc:
            warnings.append(f"OCR de imagen no disponible: {exc}")
            return ""

    def _extract_pdf_text(self, raw_bytes: bytes, warnings: list[str]) -> str:
        for module_name in ("pypdf", "PyPDF2"):
            try:
                module = __import__(module_name)
                reader = module.PdfReader(io.BytesIO(raw_bytes))
                page_chunks = [(page.extract_text() or "") for page in reader.pages]
                return "\n\n[PAGE_BREAK]\n\n".join(page_chunks).strip()
            except Exception:
                continue
        warnings.append("Extractor PDF no disponible; se intentara lectura textual simple.")
        return ""

    def _split_candidate_chunks(self, text: str) -> list[str]:
        normalized = (text or "").strip()
        if not normalized:
            return []

        # First pass: split by pages and aggregate pages until we detect a new DNI anchor.
        pages = [page.strip() for page in normalized.split("[PAGE_BREAK]") if page.strip()]
        if len(pages) <= 1:
            return self._split_by_dni_windows(normalized)

        chunks: list[str] = []
        current = ""
        for page in pages:
            page_has_dni = bool(re.search(r"\b\d{8}\b", page))
            if current and page_has_dni:
                chunks.append(current.strip())
                current = page
            else:
                current = f"{current}\n\n{page}".strip()
        if current:
            chunks.append(current.strip())

        # Fallback for a single merged chunk that still contains many DNIs.
        if len(chunks) == 1:
            return self._split_by_dni_windows(chunks[0])
        return chunks

    def _split_by_dni_windows(self, text: str) -> list[str]:
        positions = [match.start() for match in re.finditer(r"\b\d{8}\b", text)]
        if len(positions) <= 1:
            return [text]

        # Keep candidate anchors reasonably separated to avoid duplicates from the same CV.
        anchors: list[int] = []
        min_distance = 280
        for position in positions:
            if not anchors or (position - anchors[-1]) >= min_distance:
                anchors.append(position)

        if len(anchors) <= 1:
            return [text]

        chunks: list[str] = []
        start = 0
        for anchor in anchors[1:]:
            chunk = text[start:anchor].strip()
            if chunk:
                chunks.append(chunk)
            start = anchor
        tail = text[start:].strip()
        if tail:
            chunks.append(tail)
        return chunks

    @staticmethod
    def _decode_bytes(raw_bytes: bytes) -> str:
        for encoding in ("utf-8", "latin-1"):
            try:
                return raw_bytes.decode(encoding, errors="ignore").strip()
            except Exception:
                continue
        return ""

    @staticmethod
    def _first_match(text: str, pattern: str) -> str:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        return match.group(1).strip() if match else ""

    @staticmethod
    def _money(text: str) -> Decimal:
        match = re.search(r"(?:S/|sueldo(?:\s+pedido)?|remuneracion)\s*[:=]?\s*([0-9]+(?:[.,][0-9]{2})?)", text, flags=re.IGNORECASE)
        if not match:
            return Decimal("0.00")
        return Decimal(match.group(1).replace(",", ".")).quantize(Decimal("0.01"))

    @staticmethod
    def _extract_address(text: str) -> str:
        match = re.search(r"(?:vive en|direccion|domicilio)\s*[:=]?\s*([^.;]+)", text, flags=re.IGNORECASE)
        return match.group(1).strip() if match else ""

    @staticmethod
    def _extract_profession(text: str) -> str:
        match = re.search(r"\b(ingenier[oa]|contador[oa]|abogad[oa]|administrador[oa]|tecnico|analista|chofer|conductor|programador[oa]|asistente)[^,.;]*", text, flags=re.IGNORECASE)
        if not match:
            return ""
        raw = match.group(0)
        cleaned = re.split(r"\b(telefono|correo|email|dni|direccion|experiencia)\b", raw, maxsplit=1, flags=re.IGNORECASE)[0]
        return cleaned.strip(" ,.;:-").title()

    @staticmethod
    def _extract_experience(text: str) -> str:
        match = re.search(r"((?:\d+\s+anos|senior|junior|experiencia)[^.;]*)", text, flags=re.IGNORECASE)
        return match.group(1).strip() if match else ""

    @staticmethod
    def _extract_skills(text: str) -> list[str]:
        skills = []
        catalog = ["excel", "sap", "odoo", "niif", "tributacion", "python", "ventas", "logistica", "seguridad", "manejo"]
        lower_text = text.lower()
        for item in catalog:
            if item in lower_text:
                skills.append(item.upper())
        return skills[:8]

    @staticmethod
    def _extract_names(text: str) -> tuple[str, str]:
        match = re.search(r"(?:nombre(?:s)?|postulante)?\s*[:=]?\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+){1,3})", text)
        if not match:
            return "", ""
        parts = match.group(1).split()
        if len(parts) >= 4:
            return " ".join(parts[:2]), " ".join(parts[2:])
        return parts[0], " ".join(parts[1:])

    @staticmethod
    def _normalize_address(value: str) -> str:
        return re.sub(r"[^a-z0-9]", "", value.lower())


class LaborContractGenerator:
    UIT_REFERENCE = Decimal("5150.00")

    def generate_contract_text(
        self,
        worker: dict,
        tipo_contrato: str,
        *,
        legal_context: list[dict] | None = None,
        contract_terms: dict | None = None,
    ) -> str:
        full_name = f"{worker.get('nombres', '')} {worker.get('apellidos', '')}".strip()
        cargo = worker.get("cargo_postulado") or worker.get("profesion") or "trabajador"
        sueldo = worker.get("sueldo_pactado") or "0.00"
        clauses = self._dynamic_clauses(cargo)
        legal_notes = self._legal_notes(legal_context or [])
        contract_terms = contract_terms or {}
        contract_window = self._contract_window(contract_terms)
        extra_clauses = self._extra_clause_rules(cargo, sueldo)
        return f"""
CONTRATO DE TRABAJO - {tipo_contrato.upper()}

Conste por el presente documento el contrato de trabajo que celebran LA EMPRESA y {full_name}, identificado(a) con DNI {worker.get('dni', '')}, con domicilio en {worker.get('direccion_domicilio', '')}.

VIGENCIA.
{contract_window}

PRIMERA: PUESTO Y REMUNERACION.
EL TRABAJADOR prestara servicios como {cargo}, percibiendo una remuneracion mensual de S/ {sueldo}, sujeta a los descuentos y aportes de ley.

SEGUNDA: SUBORDINACION Y FACULTAD DIRECTRIZ.
Las partes reconocen que la prestacion se realiza bajo subordinacion conforme al articulo 9 del D.L. 728, quedando EL EMPLEADOR facultado a normar, fiscalizar y sancionar razonablemente la labor.

TERCERA: PERIODO DE PRUEBA.
Se pacta periodo de prueba conforme al articulo 10 del D.L. 728, salvo que por ley o convenio corresponda un plazo distinto.

CUARTA: JORNADA Y SOBRETIEMPO.
La jornada ordinaria no excedera los maximos legales aplicables. El sobretiempo requerira autorizacion y sera compensado o pagado conforme a la Ley de Jornada de Trabajo, Horario y Trabajo en Sobretiempo.

QUINTA: SEGURIDAD Y SALUD EN EL TRABAJO.
EL TRABAJADOR se obliga a cumplir el Reglamento Interno de Seguridad y Salud en el Trabajo, capacitaciones, controles y medidas preventivas aplicables.

SEXTA: PROTECCION DE DATOS PERSONALES.
EL TRABAJADOR autoriza el tratamiento de sus datos personales estrictamente para fines laborales, previsionales, tributarios y de gestion interna, conforme a la Ley 29733.

SEPTIMA: CLAUSULAS ESPECIFICAS DEL CARGO.
{clauses}

OCTAVA: FIRMA DIGITAL.
Las partes podran firmar digitalmente el presente documento, conservando evidencia de identidad, consentimiento e integridad documental.

NOVENA: CLAUSULAS DE CUMPLIMIENTO ADICIONALES.
{extra_clauses}

DECIMA: CONTEXTO LEGAL RAG CONSULTADO.
{legal_notes}
"""

    def generate_pdf_base64(self, worker: dict, tipo_contrato: str) -> str:
        text = self.generate_contract_text(worker, tipo_contrato)
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=1.7 * cm, leftMargin=1.7 * cm, topMargin=1.6 * cm, bottomMargin=1.4 * cm)
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="LegalTitle", parent=styles["Title"], textColor=colors.HexColor("#123a5f"), fontSize=15, leading=18, spaceAfter=12))
        styles.add(ParagraphStyle(name="LegalBody", parent=styles["BodyText"], fontSize=9.5, leading=13, alignment=4))
        story = [
            Paragraph("CONTRATO LABORAL - CONTA_PRO ENTERPRISE", styles["LegalTitle"]),
            Table(
                [["Base legal", "D.L. 728, Ley de Jornada, SST, Ley 29733"], ["Fecha", date.today().isoformat()]],
                colWidths=[4 * cm, 11 * cm],
                style=TableStyle([
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#b7c7d9")),
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eaf4ff")),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]),
            ),
            Spacer(1, 10),
        ]
        for block in text.split("\n\n"):
            if block.strip():
                story.append(Paragraph(block.strip().replace("\n", "<br/>"), styles["LegalBody"]))
                story.append(Spacer(1, 7))
        story.extend([
            Spacer(1, 18),
            Table(
                [["Firma del empleador", "Firma del trabajador"], ["", ""]],
                colWidths=[7.2 * cm, 7.2 * cm],
                rowHeights=[0.8 * cm, 1.8 * cm],
                style=TableStyle([
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#8ea9c1")),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f8ff")),
                ]),
            ),
            Spacer(1, 8),
            Paragraph("Pie de pagina: Documento generado con soporte legal RAG y sujeto a revision/firma final de RRHH.", styles["Italic"]),
        ])
        doc.build(story)
        return base64.b64encode(buffer.getvalue()).decode("ascii")

    def generate_annex_zip_base64(
        self,
        *,
        worker: dict,
        tipo_contrato: str,
        contract_pdf_base64: str,
        contract_text: str,
        contract_terms: dict | None = None,
        legal_context: list[dict] | None = None,
    ) -> tuple[str, str]:
        full_name = f"{worker.get('nombres', '')} {worker.get('apellidos', '')}".strip().strip() or "trabajador"
        dni = str(worker.get("dni") or "sin-dni")
        legal_context = legal_context or []
        contract_terms = contract_terms or {}
        due_text = self._accounting_alerts_text(worker, tipo_contrato, contract_terms)

        files: dict[str, bytes] = {
            f"Contrato_{dni}.pdf": base64.b64decode(contract_pdf_base64.encode("ascii")),
            "01_Cargo_Entrega_RIT.pdf": self._annex_pdf(
                "Cargo de Entrega del Reglamento Interno de Trabajo",
                [
                    f"Trabajador: {full_name}",
                    f"DNI: {dni}",
                    "Se deja constancia de la entrega del Reglamento Interno de Trabajo (RIT).",
                    "El trabajador declara haber recibido, leido y comprendido el documento.",
                ],
            ),
            "02_Cargo_Entrega_SST.pdf": self._annex_pdf(
                "Cargo de Entrega del Reglamento de Seguridad y Salud en el Trabajo",
                [
                    f"Trabajador: {full_name}",
                    "Se deja constancia de la entrega del Reglamento de Seguridad y Salud en el Trabajo (SST).",
                    "El trabajador se compromete al cumplimiento estricto de protocolos de prevencion.",
                ],
            ),
            "03_Boletin_Sistema_Pensionario.pdf": self._annex_pdf(
                "Boletin Informativo Sistema Pensionario (AFP/ONP)",
                [
                    f"Trabajador: {full_name}",
                    f"DNI: {dni}",
                    "Se informa al trabajador sobre los sistemas pensionarios AFP y ONP.",
                    "El trabajador declara haber sido orientado sobre plazos y procedimiento de afiliacion.",
                ],
            ),
            "04_Alertas_Contador.txt": due_text.encode("utf-8"),
            "05_Contexto_Legal_Citado.txt": self._legal_notes(legal_context).encode("utf-8"),
            "06_Contrato_Texto.txt": contract_text.encode("utf-8"),
        }

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for filename, content in files.items():
                archive.writestr(filename, content)

        return f"paquete-contratacion-{dni}.zip", base64.b64encode(zip_buffer.getvalue()).decode("ascii")

    @staticmethod
    def _dynamic_clauses(cargo: str) -> str:
        normalized = cargo.lower()
        if any(term in normalized for term in ["chofer", "conductor", "driver"]):
            return "Por la naturaleza del cargo, se incluyen obligaciones de conduccion segura, respeto estricto de normas de transito, control de papeletas, custodia de unidad y reporte inmediato de incidentes."
        if any(term in normalized for term in ["contador", "finanzas", "tesorer", "account"]):
            return "Por acceso a informacion economica, tributaria y bancaria, se incluye confidencialidad reforzada, custodia documental, prohibicion de divulgacion y trazabilidad de operaciones."
        if any(term in normalized for term in ["seguridad", "vigilancia"]):
            return "Por funciones de vigilancia, se incluyen obligaciones de control de accesos, reporte de ocurrencias, reserva de informacion y cumplimiento de protocolos de seguridad."
        return "Se aplican las obligaciones generales del cargo, el Reglamento Interno de Trabajo, codigo de conducta, confidencialidad y cuidado de activos de LA EMPRESA."

    def _extra_clause_rules(self, cargo: str, sueldo: str) -> str:
        clauses: list[str] = []
        normalized = (cargo or "").lower()
        try:
            sueldo_value = Decimal(str(sueldo).replace(",", "."))
        except Exception:
            sueldo_value = Decimal("0.00")

        if "confianza" in normalized:
            clauses.append(
                "Por tratarse de cargo de confianza, se incorpora clausula de exoneracion de jornada maxima conforme al marco legal aplicable."
            )
        if sueldo_value > self.UIT_REFERENCE * Decimal("2"):
            clauses.append(
                "Al superar 2 UIT de remuneracion mensual, se incorpora clausula de responsabilidad solidaria y deber reforzado de cumplimiento."
            )
        if not clauses:
            clauses.append("No se activaron clausulas condicionales especiales para este perfil.")
        return "\n".join(f"- {item}" for item in clauses)

    @staticmethod
    def _contract_window(contract_terms: dict) -> str:
        start = contract_terms.get("start_date")
        end = contract_terms.get("end_date")
        if start and end:
            return f"El contrato rige desde {start} hasta {end}."
        if start and not end:
            return f"El contrato rige desde {start} a plazo indeterminado."
        return "El contrato rige desde la fecha de suscripcion conforme a su modalidad."

    @staticmethod
    def _legal_notes(legal_context: list[dict]) -> str:
        if not legal_context:
            return "No se encontraron citas RAG en este ciclo; se aplico biblioteca legal base del sistema."
        lines = []
        for idx, row in enumerate(legal_context[:6], start=1):
            metadata = row.get("metadata_json") or {}
            source = metadata.get("source_id") or row.get("entity_id") or "fuente"
            title = metadata.get("title") or "Documento legal"
            snippet = str(row.get("content") or "").strip().replace("\n", " ")[:220]
            lines.append(f"{idx}. [{source}] {title}: {snippet}")
        return "\n".join(lines)

    @staticmethod
    def _annex_pdf(title: str, body_lines: list[str]) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=1.7 * cm, leftMargin=1.7 * cm, topMargin=1.6 * cm, bottomMargin=1.4 * cm)
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="AnnexTitle", parent=styles["Title"], textColor=colors.HexColor("#123a5f"), fontSize=14, leading=17, spaceAfter=10))
        styles.add(ParagraphStyle(name="AnnexBody", parent=styles["BodyText"], fontSize=10, leading=14))
        story = [Paragraph(title, styles["AnnexTitle"]), Spacer(1, 8)]
        for line in body_lines:
            story.append(Paragraph(line, styles["AnnexBody"]))
            story.append(Spacer(1, 6))
        story.append(Spacer(1, 20))
        story.append(Paragraph("Firma trabajador: __________________________", styles["AnnexBody"]))
        story.append(Paragraph("Firma empleador: __________________________", styles["AnnexBody"]))
        doc.build(story)
        return buffer.getvalue()

    @staticmethod
    def _accounting_alerts_text(worker: dict, tipo_contrato: str, contract_terms: dict) -> str:
        dni = worker.get("dni") or "SIN-DNI"
        name = f"{worker.get('nombres', '')} {worker.get('apellidos', '')}".strip() or "TRABAJADOR"
        start = contract_terms.get("start_date") or "NO DEFINIDA"
        end = contract_terms.get("end_date") or "INDETERMINADO"
        due = contract_terms.get("t_registro_due") or "24h posterior a firma"
        return (
            "ALERTAS PARA CONTABILIDAD Y PLANILLAS\n"
            f"Trabajador: {name}\n"
            f"DNI: {dni}\n"
            f"Tipo contrato: {tipo_contrato}\n"
            f"Inicio: {start}\n"
            f"Fin: {end}\n"
            f"Alerta T-Registro: registrar alta en SUNAT antes de {due}.\n"
            "Alerta vencimiento: programar revision 15 dias antes del vencimiento si es plazo fijo.\n"
        )


def new_worker_code() -> str:
    return f"TRB-{datetime.utcnow().strftime('%Y%m')}-{str(uuid4())[:8].upper()}"
