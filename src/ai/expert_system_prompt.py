from __future__ import annotations

from dataclasses import dataclass

SYSTEM_ROLE_PROMPT = """
Rol: Actuaras como un Sistema Experto de Contabilidad Automatizada con cumplimiento estricto del PCGE (Plan Contable General Empresarial) y la normativa de SUNAT vigente al 2026.

Protocolo de Procesamiento:
Fase de Extraccion: Ejecuta una lectura OCR/Estructurada del documento (foto o manual).
Fase de Clasificacion: Identifica si la transaccion es Gasto, Costo, Activo, Pasivo o Patrimonio basandote en la NIC 1 (Presentacion de Estados Financieros) y el Principio de Devengado.
Fase de Cumplimiento: Valida el documento segun el Reglamento de Comprobantes de Pago. Si es una transferencia bancaria, aplica la Ley para la Lucha contra la Evasion y para la Formalizacion de la Economia (uso de medios de pago).
Fase de Ejecucion: Genera el asiento contable de doble entrada (Debe/Haber) automatizando las cuentas de destino (Clase 6 y Clase 9).
""".strip()

CRITICAL_DEPENDENCIES = {
    "document_processing": ["layoutlmv3", "amazon_textract"],
    "rag_vector_db": ["pinecone", "chromadb", "pgvector"],
    "rag_corpus": [
        "TUO Ley del Impuesto a la Renta",
        "Codigo Tributario actualizado",
        "Manual de Consultas SUNAT",
        "Guia de Infracciones y Sanciones SUNAT",
        "D. Leg. 728",
        "D. Leg. 1057",
    ],
    "output_contract": ["pydantic"],
}

MODULE_INSTRUCTIONS = {
    "treasury_and_banks": (
        "Analiza este extracto bancario. Si el concepto es 'Pago a Cuenta', "
        "vincula el ID de la factura pendiente. Aplica automaticamente la cuenta 104 "
        "contra la 121. Si detectas una retencion o detraccion no registrada, "
        "genera la alerta de inconsistencia tributaria de inmediato."
    ),
    "legal_and_labor": (
        "Genera una respuesta a este requerimiento del Ministerio de Trabajo "
        "utilizando como base el Decreto Legislativo correspondiente. "
        "El tono debe ser formal-legal. Incluye citas de articulos especificos "
        "sobre la jornada laboral o beneficios sociales segun el contexto del trabajador."
    ),
    "documents_from_photos": (
        "Ignora el ruido visual. Extrae el numero de serie, correlativo y el codigo "
        "de barras/QR. Verifica en la base de datos de SUNAT si el comprobante esta 'Activo'. "
        "Si el estado es 'Anulado' o 'No Habido', bloquea el asiento contable y notifica "
        "error de cumplimiento."
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
        primary_function="Generacion de asientos automaticos.",
        support_docs="Plan Contable General Empresarial (PCGE).",
    ),
    IntelligenceUnit(
        name="Cumplimiento Tributario",
        primary_function="Liquidacion de IGV/Renta y detracciones.",
        support_docs="TUO del IGV, tabla de detracciones SUNAT.",
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
        primary_function="Contratos, boletas y tramites MTPE.",
        support_docs="Ley de Productividad y Competitividad Laboral.",
    ),
]


def get_module_instruction(module_name: str) -> str | None:
    return MODULE_INSTRUCTIONS.get(module_name)
