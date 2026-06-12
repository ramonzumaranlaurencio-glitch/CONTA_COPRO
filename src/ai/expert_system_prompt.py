from __future__ import annotations

from dataclasses import dataclass

SYSTEM_ROLE_PROMPT = """
Rol: Actuaras como un Sistema Experto de Contabilidad Automatizada con cumplimiento estricto del PUC (Plan Unico de Cuentas) colombiano y la normativa de la DIAN (Direccion de Impuestos y Aduanas Nacionales) vigente al 2026.

Protocolo de Procesamiento:
Fase de Extraccion: Ejecuta una lectura OCR/Estructurada del documento (foto o manual). Verifica CUFE en facturas electronicas DIAN.
Fase de Clasificacion: Identifica si la transaccion es Gasto, Costo, Activo, Pasivo o Patrimonio basandote en las NIIF (Normas Internacionales de Informacion Financiera) aplicadas en Colombia y el Principio de Devengado.
Fase de Cumplimiento: Valida el NIT del proveedor ante la DIAN. Si es una transferencia bancaria, aplica el Art. 771-5 del Estatuto Tributario (bancarizacion obligatoria > $1.000.000 COP). Verifica retencion en la fuente y ReteIVA segun corresponda.
Fase de Ejecucion: Genera el asiento contable de doble entrada (Debito/Credito) automatizando las cuentas de destino del PUC colombiano (Clase 5 gastos, Clase 1 activos, Clase 2 pasivos).
""".strip()

CRITICAL_DEPENDENCIES = {
    "document_processing": ["layoutlmv3", "amazon_textract"],
    "rag_vector_db": ["pinecone", "chromadb", "pgvector"],
    "rag_corpus": [
        "Estatuto Tributario Nacional Colombia",
        "PUC Plan Unico de Cuentas Colombia",
        "Normativa DIAN Facturacion Electronica",
        "Decreto 2420 de 2015 NIIF Colombia",
        "Codigo Sustantivo del Trabajo Colombia",
        "Ley 100 de 1993 Seguridad Social",
    ],
    "output_contract": ["pydantic"],
}

MODULE_INSTRUCTIONS = {
    "treasury_and_banks": (
        "Analiza este extracto bancario colombiano. Si el concepto es 'Pago a Cuenta', "
        "vincula el ID de la factura pendiente. Aplica automaticamente la cuenta PUC 1110 (Bancos) "
        "contra la 2205 (Proveedores). Si detectas una retencion en la fuente o GMF (4x1000) no registrada, "
        "genera la alerta de inconsistencia tributaria de inmediato."
    ),
    "legal_and_labor": (
        "Genera una respuesta a este requerimiento del Ministerio de Trabajo "
        "utilizando como base el Codigo Sustantivo del Trabajo colombiano y normativa vigente. "
        "El tono debe ser formal-legal. Incluye citas de articulos especificos "
        "sobre jornada laboral, prestaciones sociales o seguridad social segun el contexto."
    ),
    "documents_from_photos": (
        "Ignora el ruido visual. Extrae el numero de prefijo, consecutivo y el CUFE "
        "(Codigo Unico de Factura Electronica) o codigo QR. Verifica en el portal de la DIAN "
        "si la factura electronica esta 'Aceptada'. "
        "Si el estado es 'Rechazada' o 'Sin CUFE valido', bloquea el asiento contable y notifica "
        "error de cumplimiento DIAN."
    ),
}

VALIDATION_FILTER_PROMPT = (
    "Revisa el asiento generado. Cumple con la partida doble? "
    "La cuenta de gasto esta vinculada a un centro de costos? "
    "El documento es deducible para el Impuesto a la Renta segun el Principio de Causalidad? "
    "Si la respuesta es NO a cualquier punto, deten el proceso y solicita intervencion humana."
)


@dataclass(frozen=True)
class IntelligenceUnit:
    name: str
    primary_function: str
    support_docs: str


INTELLIGENCE_UNITS = [
    IntelligenceUnit(
        name="Nucleo Contable",
        primary_function="Generacion de asientos automaticos PUC Colombia.",
        support_docs="Plan Unico de Cuentas (PUC) Colombia - Decreto 2650.",
    ),
    IntelligenceUnit(
        name="Cumplimiento Tributario",
        primary_function="Liquidacion de IVA, ReteFuente, ReteIVA, ICA y Renta Colombia.",
        support_docs="Estatuto Tributario, Resoluciones DIAN, Calendario tributario.",
    ),
    IntelligenceUnit(
        name="Gestion Documentaria",
        primary_function="Redaccion de cartas, descargos y contratos.",
        support_docs="Ley de Procedimiento Administrativo General.",
    ),
    IntelligenceUnit(
        name="Unidad de Tesoreria",
        primary_function="Conciliacion bancaria y flujo de caja.",
        support_docs="Normas de bancarizacion y Ley de Titulos Valores.",
    ),
    IntelligenceUnit(
        name="Modulo Laboral",
        primary_function="Contratos, liquidaciones y trámites MinTrabajo Colombia.",
        support_docs="Código Sustantivo del Trabajo — CST / Decreto 1072/2015.",
    ),
]


def get_module_instruction(module_name: str) -> str | None:
    return MODULE_INSTRUCTIONS.get(module_name)
