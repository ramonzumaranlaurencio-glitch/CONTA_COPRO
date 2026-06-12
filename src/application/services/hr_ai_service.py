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
    "Actua como un Especialista en Seleccion de Personal Colombia. Extrae del archivo adjunto los siguientes campos: "
    "Nombres, Apellidos, Cedula de Ciudadania o Extranjeria (valida entre 5 y 12 digitos), Fecha de nacimiento, "
    "Direccion, Telefono, Correo, Profesion, Estudios, Experiencia, Fondo de pension (Colpensiones - SPP o AFP Privada), EPS, ARL, CCF, "
    "cuenta bancaria y evidencias documentarias. "
    "Instruccion critica: Si encuentras discrepancias entre la direccion del CV y los datos del RNEC/RUNT, genera una "
    "alerta de 'Validacion de Domicilio'. Mapea cada dato a su celda correspondiente en el formulario Registro_Personal_V1 "
    "y llena la base de requisitos: Cedula, foto, ficha personal, hoja de vida documentada, estudios, certificados laborales, "
    "antecedentes judiciales (Policia Nacional), declaracion de domicilio, afiliacion Sistema Pensional (Colpensiones o SPP)/EPS/ARL/CCF y cuenta bancaria."
)


# ─── BIBLIOTECA LEGAL LABORAL COLOMBIA ───────────────────────────────────────
# Ministerio del Trabajo · UGPP · DIAN · Supersociedades · Corte Suprema
LABOR_LEGAL_LIBRARY = [
    {
        "source_id": "CST_CODIGO_SUSTANTIVO_TRABAJO",
        "title": "Código Sustantivo del Trabajo — CST (Decreto-Ley 2663/1950)",
        "url": "https://www.mintrabajo.gov.co/normatividad/leyes-y-decretos-ley/codigo-sustantivo-del-trabajo",
        "temas": "contratos, jornada, salario, prestaciones, despido, periodo de prueba, fuero sindical",
    },
    {
        "source_id": "LEY_100_1993_SEGURIDAD_SOCIAL",
        "title": "Ley 100 de 1993 — Sistema de Seguridad Social Integral",
        "url": "https://www.minsalud.gov.co/Normatividad_Nuevo/LEY%200100%20DE%201993.pdf",
        "temas": "AFP 4%+12%, EPS 4%+8.5%, fondo solidaridad, pensión, salud, riesgos laborales",
    },
    {
        "source_id": "DECRETO_1072_2015_DECRETO_UNICO_LABORAL",
        "title": "Decreto Único Reglamentario del Trabajo — Decreto 1072/2015",
        "url": "https://www.mintrabajo.gov.co/normatividad/decreto-unico-reglamentario",
        "temas": "reglamentación CST, jornada, horas extras, SST, contratistas, trabajo en casa",
    },
    {
        "source_id": "LEY_21_1982_PARAFISCALES",
        "title": "Ley 21 de 1982 — CCF, SENA e ICBF",
        "url": "https://www.sena.edu.co/normatividad/ley-21-1982",
        "temas": "CCF 4%, SENA 2%, ICBF 3%, exoneración Ley 1607/2012 si salario < 10 SMMLV",
    },
    {
        "source_id": "LEY_1607_2012_EXONERACION_PARAFISCAL",
        "title": "Ley 1607 de 2012 — Reforma Tributaria (Art. 65 exoneración parafiscal)",
        "url": "https://www.dian.gov.co/normatividad/Normas/Ley_1607_2012.pdf",
        "temas": "exoneración SENA, ICBF y EPS empleador para trabajadores con salario < 10 SMMLV",
    },
    {
        "source_id": "LEY_50_1990_CESANTIAS",
        "title": "Ley 50 de 1990 — Reforma Laboral (fondos de cesantías)",
        "url": "https://www.mintrabajo.gov.co/normatividad/leyes/1990/ley-50-de-1990",
        "temas": "consignación cesantías al fondo antes del 14 de febrero, intereses 12% anual, retroactivo",
    },
    {
        "source_id": "DECRETO_2361_2024_SMMLV_2025",
        "title": "Decreto 2361 de 2024 — SMMLV 2025: $1.423.500 — Auxilio Transporte $200.000",
        "url": "https://www.mintrabajo.gov.co/normatividad/decretos/2024/decreto-2361-2024",
        "temas": "salario mínimo 2025, auxilio de transporte, reajuste anual",
    },
    {
        "source_id": "DECRETO_1607_2002_ARL_CLASES_RIESGO",
        "title": "Decreto 1607 de 2002 — Tabla de Clasificación de Actividades Económicas ARL",
        "url": "https://www.mintrabajo.gov.co/normatividad/decreto-1607-2002",
        "temas": "ARL clases I-V: 0.348%-8.70%, clasificación por actividad económica",
    },
    {
        "source_id": "ET_ART383_RETEFUENTE_LABORAL",
        "title": "Estatuto Tributario Art. 383 — ReteFuente sobre rentas laborales",
        "url": "https://www.dian.gov.co/normatividad/Normatividad/Estatuto%20Tributario.pdf",
        "temas": "tabla marginal ReteFuente, renta exenta 25%, deducción dependientes 10%, UVT 2026 $47.065",
    },
    {
        "source_id": "DECRETO_2649_1993_PUC_COLOMBIA",
        "title": "Decreto 2649 de 1993 — Reglamento General de Contabilidad — PUC Colombia",
        "url": "https://www.supersociedades.gov.co/normatividad/decreto-2649-1993",
        "temas": "PUC cuentas 51 gastos personal, 23-26 pasivos laborales, libro diario, libro mayor",
    },
    {
        "source_id": "MINTRABAJO_MODELOS_CONTRATO",
        "title": "Ministerio del Trabajo — Modelos de Contratos Laborales Colombia",
        "url": "https://www.mintrabajo.gov.co/empleo-y-pensiones/empleo/subdireccion-de-formalizacion-y-proteccion-del-empleo/contratos-de-trabajo",
        "temas": "contrato término indefinido, término fijo, obra o labor, aprendizaje SENA",
    },
    {
        "source_id": "LEY_1562_2012_RIESGOS_LABORALES",
        "title": "Ley 1562 de 2012 — Sistema General de Riesgos Laborales (ARL)",
        "url": "https://www.mintrabajo.gov.co/normatividad/leyes/2012/ley-1562-de-2012",
        "temas": "ARL, accidentes de trabajo, enfermedades laborales, cotización por clase de riesgo",
    },
    {
        "source_id": "LEY_1581_2012_DATOS_PERSONALES",
        "title": "Ley 1581 de 2012 — Protección de Datos Personales — Colombia",
        "url": "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981",
        "temas": "habeas data, tratamiento datos empleados, autorización, responsable del tratamiento",
    },
    {
        "source_id": "UGPP_PILA_PLANILLA_INTEGRADA",
        "title": "UGPP — Planilla Integrada de Liquidación de Aportes (PILA)",
        "url": "https://www.ugpp.gov.co/aportes/planilla-integrada-de-liquidacion-de-aportes-pila",
        "temas": "PILA, liquidación aportes seguridad social, fecha límite día 21, operadores autorizados",
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
    estudios_realizados: str = ""
    cargo_postulado: str = ""
    sueldo_pactado: Decimal = Decimal("0.00")
    pension_system: str = ""
    cuenta_bancaria: str = ""
    num_cuenta_interbancaria: str = ""
    habilidades_clave: list[str] = field(default_factory=list)
    requirements: list[dict] = field(default_factory=list)
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
            "estudios_realizados": self.estudios_realizados,
            "cargo_postulado": self.cargo_postulado,
            "sueldo_pactado": str(self.sueldo_pactado),
            "pension_system": self.pension_system,
            "cuenta_bancaria": self.cuenta_bancaria,
            "num_cuenta_interbancaria": self.num_cuenta_interbancaria,
            "habilidades_clave": self.habilidades_clave,
            "requirements": self.requirements,
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

    def parse_cv(
        self,
        text: str,
        *,
        rnec_address: str | None = None,
        reniec_address: str | None = None,
    ) -> WorkerDraft:
        rnec_address = rnec_address or reniec_address
        cleaned = " ".join(text.replace("\n", " ").split())
        draft = WorkerDraft()
        draft.dni = self._first_match(cleaned, r"\b(\d{5,12})\b")
        draft.email = self._first_match(cleaned, r"([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})")
        draft.telefono = self._first_match(cleaned, r"(?:\+?57\s*)?(\d{7,10})\b")
        draft.fecha_nacimiento = self._normalize_date(self._first_match(cleaned, r"(\d{1,2}[/-]\d{1,2}[/-]\d{4})")) or None
        draft.sueldo_pactado = self._money(cleaned)
        draft.direccion_domicilio = self._extract_address(cleaned)
        draft.profesion = self._extract_profession(cleaned)
        draft.experiencia = self._extract_experience(cleaned)
        draft.estudios_realizados = self._extract_studies(cleaned)
        draft.cargo_postulado = draft.profesion or "Por definir"
        draft.pension_system = self._extract_pension_system(cleaned)
        draft.cuenta_bancaria, draft.num_cuenta_interbancaria = self._extract_bank_data(cleaned)
        draft.habilidades_clave = self._extract_skills(cleaned)
        draft.nombres, draft.apellidos = self._extract_names(cleaned)

        if draft.dni and not re.fullmatch(r"\d{5,12}", draft.dni):
            draft.alerts.append("Cedula invalida: debe tener entre 5 y 12 digitos.")
        if not draft.dni:
            draft.alerts.append("Cedula no detectada en el CV.")
        if rnec_address and draft.direccion_domicilio and self._normalize_address(rnec_address) != self._normalize_address(draft.direccion_domicilio):
            draft.alerts.append("Validacion de Domicilio: la direccion del CV difiere de RNEC.")

        draft.requirements = self._build_requirements(cleaned, draft)
        return draft

    def parse_cv_batch(
        self,
        text: str,
        *,
        rnec_address: str | None = None,
        reniec_address: str | None = None,
    ) -> list[dict]:
        rnec_address = rnec_address or reniec_address
        chunks = self._split_candidate_chunks(text)
        if not chunks:
            chunks = [text]

        result: list[dict] = []
        seen_dni: set[str] = set()
        for index, chunk in enumerate(chunks, start=1):
            draft = self.parse_cv(chunk, rnec_address=rnec_address)
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

        # First pass: split by pages and aggregate pages until we detect a new cedula anchor.
        pages = [page.strip() for page in normalized.split("[PAGE_BREAK]") if page.strip()]
        if len(pages) <= 1:
            return self._split_by_dni_windows(normalized)

        chunks: list[str] = []
        current = ""
        for page in pages:
            page_has_dni = bool(re.search(r"\b\d{5,12}\b", page))
            if current and page_has_dni:
                chunks.append(current.strip())
                current = page
            else:
                current = f"{current}\n\n{page}".strip()
        if current:
            chunks.append(current.strip())

        # Fallback for a single merged chunk that still contains many cedulas.
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
    def _normalize_date(raw: str) -> str:
        if not raw:
            return ""
        for separator in ("/", "-"):
            parts = raw.split(separator)
            if len(parts) != 3:
                continue
            day, month, year = parts
            try:
                return date(int(year), int(month), int(day)).isoformat()
            except Exception:
                return raw
        return raw

    @staticmethod
    def _money(text: str) -> Decimal:
        match = re.search(r"(?:S/|sueldo(?:\s+pedido)?|remuneracion)\s*[:=]?\s*([0-9]+(?:[.,][0-9]{2})?)", text, flags=re.IGNORECASE)
        if not match:
            return Decimal("0.00")
        return Decimal(match.group(1).replace(",", ".")).quantize(Decimal("0.01"))

    @staticmethod
    def _extract_address(text: str) -> str:
        match = re.search(
            r"(?:vive en|direccion|domicilio)\s*[:=]?\s*(.+?)(?=\s+(?:telefono|celular|correo|email|dni|cedula|documento|estudios|formacion|educacion|experiencia|afp|colpensiones|cuenta|habilidades)\b|[.;]|$)",
            text,
            flags=re.IGNORECASE,
        )
        return match.group(1).strip() if match else ""

    @staticmethod
    def _extract_profession(text: str) -> str:
        match = re.search(r"\b(ingenier[oa]|contador[oa]|abogad[oa]|administrador[oa]|tecnico|analista|chofer|conductor|programador[oa]|asistente)[^,.;]*", text, flags=re.IGNORECASE)
        if not match:
            return ""
        raw = match.group(0)
        cleaned = re.split(r"\b(telefono|correo|email|dni|cedula|documento|direccion|experiencia)\b", raw, maxsplit=1, flags=re.IGNORECASE)[0]
        return cleaned.strip(" ,.;:-").title()

    @staticmethod
    def _extract_experience(text: str) -> str:
        match = re.search(
            r"((?:\d+\s+anos|senior|junior|experiencia).+?)(?=\s+(?:estudios|formacion|educacion|afp|colpensiones|cuenta|telefono|correo|email|dni|cedula|documento|direccion|domicilio)\b|[.;]|$)",
            text,
            flags=re.IGNORECASE,
        )
        return match.group(1).strip() if match else ""

    @staticmethod
    def _extract_studies(text: str) -> str:
        patterns = [
            r"(?:estudios|formacion academica|educacion)\s*[:=]?\s*(.+?)(?=\s+(?:experiencia|telefono|correo|email|dni|cedula|documento|direccion|domicilio|afp|colpensiones|cuenta|habilidades)\b|[.;]|$)",
            r"\b(universidad|instituto|bachiller|titulado|licenciado|tecnico|diploma|certificado)\b[^.;]*",
        ]
        first = re.search(patterns[0], text, flags=re.IGNORECASE)
        if first:
            return first.group(1).strip(" ,.;:-").title()
        second = re.search(patterns[1], text, flags=re.IGNORECASE)
        if second:
            raw = re.split(
                r"\b(experiencia|telefono|correo|email|dni|cedula|documento|direccion|domicilio|afp|colpensiones|cuenta|habilidades)\b",
                second.group(0),
                maxsplit=1,
                flags=re.IGNORECASE,
            )[0]
            return raw.strip(" ,.;:-").title()
        return ""

    @staticmethod
    def _extract_pension_system(text: str) -> str:
        # Search for Colombian pension systems: Colpensiones (public), or SPP (private pension funds)
        colpensiones_match = re.search(r"\b(Colpensiones|SPP|RPM|Regimen Pensional)\b", text, flags=re.IGNORECASE)
        if colpensiones_match:
            return "Colpensiones" if "Colpensiones" in colpensiones_match.group(1) else "SPP"
        # Fallback: search for any AFP mention (user might have copied from other countries)
        afp_match = re.search(r"\b(AFP|SPP|Regimen Pensional|Sistema Pensional)\b", text, flags=re.IGNORECASE)
        if afp_match:
            return "SPP"  # Default to Colombian private pension system
        return ""

    @staticmethod
    def _extract_bank_data(text: str) -> tuple[str, str]:
        cci = CvExtractionService._first_match(text, r"\bCCI\s*[:=]?\s*(\d{20})\b")
        account = CvExtractionService._first_match(text, r"(?:cuenta(?:\s+sueldo|\s+bancaria)?|haberes)\s*[:=]?\s*(\d{10,20})\b")
        if cci and not account:
            account = cci[:14]
        return account, cci

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
        anchored = re.search(
            r"(?:nombre(?:s)?(?:\s+y\s+apellidos)?|postulante)\s*[:=]?\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+){1,4})",
            text,
        )
        match = anchored or re.search(r"\b([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+){2,3})\b", text)
        if not match:
            return "", ""
        raw_name = re.split(
            r"\b(Cedula|Documento|Telefono|Celular|Correo|Email|Direccion|Domicilio)\b",
            match.group(1),
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0]
        parts = raw_name.split()
        if len(parts) >= 4:
            return " ".join(parts[:2]), " ".join(parts[2:])
        return parts[0], " ".join(parts[1:])

    @staticmethod
    def _normalize_address(value: str) -> str:
        return re.sub(r"[^a-z0-9]", "", value.lower())

    @staticmethod
    def _has_any(text: str, words: list[str]) -> bool:
        lower_text = text.lower()
        return any(word.lower() in lower_text for word in words)

    def _build_requirements(self, text: str, draft: WorkerDraft) -> list[dict]:
        full_name = f"{draft.nombres} {draft.apellidos}".strip()

        def item(requirement_id: str, status: str, evidence: str) -> dict:
            return {
                "id": requirement_id,
                "status": status,
                "evidence": evidence,
                "source": "IA_CV",
            }

        return [
            item(
                "copia_cedula_vigente",
                "OBSERVADO" if draft.dni else "PENDIENTE",
                f"Cedula detectada en CV: {draft.dni}" if draft.dni else "No se detecto numero de cedula en el CV.",
            ),
            item(
                "foto_tamano_carne",
                "OBSERVADO" if self._has_any(text, ["foto", "fotografia", "tamano carne", "tamaño carne"]) else "PENDIENTE",
                "El texto menciona fotografia/foto tamano carne." if self._has_any(text, ["foto", "fotografia", "tamano carne", "tamaño carne"]) else "Adjuntar foto tamano carne.",
            ),
            item(
                "ficha_datos_personales",
                "APROBADO" if full_name and draft.dni and (draft.telefono or draft.email) else "OBSERVADO",
                f"Datos detectados: {full_name or 'sin nombre'}, cedula {draft.dni or 'sin cedula'}, telefono/correo {draft.telefono or draft.email or 'pendiente'}.",
            ),
            item(
                "hoja_vida_documentada",
                "APROBADO" if draft.experiencia or draft.profesion or draft.habilidades_clave else "OBSERVADO",
                f"Perfil CV: {draft.profesion or 'cargo pendiente'}; experiencia: {draft.experiencia or 'pendiente'}.",
            ),
            item(
                "constancia_diploma_estudios",
                "OBSERVADO" if draft.estudios_realizados else "PENDIENTE",
                draft.estudios_realizados or "No se detectaron constancias o diplomas en el CV.",
            ),
            item(
                "certificados_laborales_anteriores",
                "OBSERVADO" if draft.experiencia else "PENDIENTE",
                draft.experiencia or "No se detectaron certificados laborales anteriores.",
            ),
            item(
                "antecedentes_policiales",
                "OBSERVADO" if self._has_any(text, ["antecedentes policiales", "certificado policial"]) else "PENDIENTE",
                "El CV menciona antecedente policial." if self._has_any(text, ["antecedentes policiales", "certificado policial"]) else "Adjuntar certificado de antecedentes policiales.",
            ),
            item(
                "antecedentes_penales",
                "OBSERVADO" if self._has_any(text, ["antecedentes penales", "certificado penal"]) else "PENDIENTE",
                "El CV menciona antecedente penal." if self._has_any(text, ["antecedentes penales", "certificado penal"]) else "Adjuntar certificado de antecedentes penales.",
            ),
            item(
                "antecedentes_judiciales",
                "OBSERVADO" if self._has_any(text, ["antecedentes judiciales", "certificado judicial"]) else "PENDIENTE",
                "El CV menciona antecedente judicial." if self._has_any(text, ["antecedentes judiciales", "certificado judicial"]) else "Adjuntar certificado de antecedentes judiciales.",
            ),
            item(
                "declaracion_jurada_domicilio",
                "OBSERVADO" if draft.direccion_domicilio else "PENDIENTE",
                draft.direccion_domicilio or "No se detecto domicilio para declaracion jurada.",
            ),
            item(
                "ficha_sistema_pensional",
                "OBSERVADO" if draft.pension_system else "PENDIENTE",
                f"Sistema pensional detectado: {draft.pension_system}" if draft.pension_system else "No se detecto Colpensiones/AFP.",
            ),
            item(
                "cuenta_bancaria_haberes",
                "OBSERVADO" if draft.cuenta_bancaria or draft.num_cuenta_interbancaria else "PENDIENTE",
                f"Cuenta bancaria detectada: {draft.num_cuenta_interbancaria or draft.cuenta_bancaria}" if draft.cuenta_bancaria or draft.num_cuenta_interbancaria else "No se detecto cuenta bancaria de haberes.",
            ),
        ]


class LaborContractGenerator:
    UVT_REFERENCE = Decimal("47065.00")

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
        requirements_text = self._requirements_text(contract_terms.get("requirements", []), contract_terms.get("requirement_summary", {}))
        return f"""
CONTRATO DE TRABAJO - {tipo_contrato.upper()}

Conste por el presente documento el contrato de trabajo que celebran LA EMPRESA y {full_name}, identificado(a) con cedula {worker.get('dni', '')}, con domicilio en {worker.get('direccion_domicilio', '')}.

VIGENCIA.
{contract_window}

PRIMERA: PUESTO Y REMUNERACION.
EL TRABAJADOR prestara servicios como {cargo}, percibiendo una remuneracion mensual de $ {sueldo} COP, sujeta a los descuentos y aportes de ley.

SEGUNDA: SUBORDINACION Y FACULTAD DIRECTRIZ.
Las partes reconocen que la prestacion se realiza bajo subordinacion conforme al articulo 23 del Codigo Sustantivo del Trabajo (CST), quedando EL EMPLEADOR facultado a normar, fiscalizar y sancionar razonablemente la labor.

TERCERA: PERIODO DE PRUEBA.
Se pacta periodo de prueba conforme al articulo 78 del CST (maximo 2 meses para contratos a termino indefinido), salvo que por ley o convenio colectivo corresponda un plazo distinto.

CUARTA: JORNADA Y SOBRETIEMPO.
La jornada ordinaria no excedera los maximos legales aplicables. El sobretiempo requerira autorizacion y sera compensado o pagado conforme a la Ley de Jornada de Trabajo, Horario y Trabajo en Sobretiempo.

QUINTA: SEGURIDAD Y SALUD EN EL TRABAJO.
EL TRABAJADOR se obliga a cumplir el Reglamento Interno de Seguridad y Salud en el Trabajo, capacitaciones, controles y medidas preventivas aplicables.

SEXTA: PROTECCION DE DATOS PERSONALES.
EL TRABAJADOR autoriza el tratamiento de sus datos personales estrictamente para fines laborales, previsionales, tributarios y de gestion interna, conforme a la Ley 1581/2012 (Habeas Data Colombia) y Decreto 1377/2013.

SEPTIMA: CLAUSULAS ESPECIFICAS DEL CARGO.
{clauses}

OCTAVA: FIRMA DIGITAL.
Las partes podran firmar digitalmente el presente documento, conservando evidencia de identidad, consentimiento e integridad documental.

NOVENA: CLAUSULAS DE CUMPLIMIENTO ADICIONALES.
{extra_clauses}

DECIMA: EXPEDIENTE DOCUMENTARIO DE CONTRATACION.
{requirements_text}

DECIMA PRIMERA: CONTEXTO LEGAL RAG CONSULTADO.
{legal_notes}
"""

    def generate_pdf_base64(
        self,
        worker: dict,
        tipo_contrato: str,
        *,
        legal_context: list[dict] | None = None,
        contract_terms: dict | None = None,
    ) -> str:
        text = self.generate_contract_text(
            worker,
            tipo_contrato,
            legal_context=legal_context,
            contract_terms=contract_terms,
        )
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=1.7 * cm, leftMargin=1.7 * cm, topMargin=1.6 * cm, bottomMargin=1.4 * cm)
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="LegalTitle", parent=styles["Title"], textColor=colors.HexColor("#123a5f"), fontSize=15, leading=18, spaceAfter=12))
        styles.add(ParagraphStyle(name="LegalBody", parent=styles["BodyText"], fontSize=9.5, leading=13, alignment=4))
        story = [
            Paragraph("CONTRATO LABORAL - CONTA_PRO ENTERPRISE", styles["LegalTitle"]),
            Table(
                [["Base legal", "CST, Ley 100/1993, Decreto 1072/2015, Ley 1581/2012"], ["Fecha", date.today().isoformat()]],
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
                    f"Cedula: {dni}",
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
                "Boletin Informativo Sistema Pensional (Colpensiones/AFP)",
                [
                    f"Trabajador: {full_name}",
                    f"Cedula: {dni}",
                    "Se informa al trabajador sobre el sistema pensional colombiano: Colpensiones y fondos privados.",
                    "El trabajador declara haber sido orientado sobre plazos y procedimiento de afiliacion.",
                ],
            ),
            "04_Alertas_Contador.txt": due_text.encode("utf-8"),
            "05_Contexto_Legal_Citado.txt": self._legal_notes(legal_context).encode("utf-8"),
            "06_Contrato_Texto.txt": contract_text.encode("utf-8"),
            "07_Requisitos_Contratacion.txt": self._requirements_text(
                contract_terms.get("requirements", []),
                contract_terms.get("requirement_summary", {}),
            ).encode("utf-8"),
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
        if sueldo_value > self.UVT_REFERENCE * Decimal("2"):
            clauses.append(
                "Al superar 2 UVT de remuneracion mensual, se incorpora clausula de responsabilidad solidaria y deber reforzado de cumplimiento."
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
    def _requirements_text(requirements: list[dict], summary: dict | None = None) -> str:
        summary = summary or {}
        if not requirements:
            return "Expediente documentario no informado; RRHH debe completar checklist antes de la firma."

        lines = [
            (
                "Resumen: "
                f"total={summary.get('total', len(requirements))}, "
                f"aprobados={summary.get('approved', 0)}, "
                f"observados={summary.get('observed', 0)}, "
                f"pendientes={summary.get('pending', 0)}."
            )
        ]
        for index, item in enumerate(requirements, start=1):
            category = item.get("category") or "General"
            name = item.get("name") or item.get("id") or "Requisito"
            status = item.get("status") or "PENDIENTE"
            required = "obligatorio" if item.get("required") else "opcional"
            evidence = str(item.get("evidence") or "").strip() or "Sin evidencia registrada."
            lines.append(f"{index}. [{category}] {name} - {status} ({required}). Evidencia: {evidence}")
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
        dni = worker.get("dni") or "SIN-CEDULA"
        name = f"{worker.get('nombres', '')} {worker.get('apellidos', '')}".strip() or "TRABAJADOR"
        start = contract_terms.get("start_date") or "NO DEFINIDA"
        end = contract_terms.get("end_date") or "INDETERMINADO"
        due = contract_terms.get("t_registro_due") or "24h posterior a firma"
        return (
            "ALERTAS PARA CONTABILIDAD Y PLANILLAS\n"
            f"Trabajador: {name}\n"
            f"Cedula: {dni}\n"
            f"Tipo contrato: {tipo_contrato}\n"
            f"Inicio: {start}\n"
            f"Fin: {end}\n"
            f"Alerta PILA: afiliar al trabajador en EPS/AFP/CCF/ARL antes del primer día de trabajo (Ley 100/1993).\n"
            f"Alerta UGPP: liquidar aportes vía PILA antes del día 21 del mes siguiente.\n"
            f"Inicio contrato: {due}.\n"
            "Alerta vencimiento: programar revision 15 dias antes del vencimiento si es termino fijo.\n"
        )


def new_worker_code() -> str:
    return f"TRB-{datetime.utcnow().strftime('%Y%m')}-{str(uuid4())[:8].upper()}"
