"""
The Ledger Engine - Command Routing by Module
Mapeo de triggers (botones/eventos) con instrucciones expertas
"""

from __future__ import annotations

from enum import Enum
from typing import Callable

from pydantic import BaseModel


class ModuleCommand(str, Enum):
    """Comandos disponibles por módulo"""
    INGRESO_GASTO = "ingreso_gasto"
    TRAMITE_BANCARIO = "tramite_bancario"
    DOCUMENTO_LEGAL = "documento_legal"
    ANTICIPO = "anticipo"
    DEVOLUCION = "devolucion"
    RETENCION = "retencion"
    AJUSTE_CIERRE = "ajuste_cierre"


class CommandDescriptor(BaseModel):
    """Descriptor de comando con instrucción y documentación base"""
    comando: ModuleCommand
    label_ui: str
    instruccion_ai: str
    documentos_base: list[str]
    validaciones_requeridas: list[str]
    cuenta_por_defecto: str | None = None


MODULE_COMMANDS_REGISTRY: dict[ModuleCommand, CommandDescriptor] = {
    ModuleCommand.INGRESO_GASTO: CommandDescriptor(
        comando=ModuleCommand.INGRESO_GASTO,
        label_ui="Ingreso de Gasto",
        instruccion_ai=(
            "Analiza documento (PDF/XML/Foto). "
            "1. Valida estructura XML si aplica. "
            "2. Detecta IVA al 19% si es factura. "
            "3. Extrae NIT proveedor y verifica en DIAN. "
            "4. Clasifica tipo de gasto (clase 5) y asigna centro de costo. "
            "5. Genera asiento doble entrada (Gasto | IVA | CxP). "
            "6. Verifica bancarización Art. 771-5 ET si pago supera 100 UVT (~$5.000.000 COP). "
            "7. Valida Principio de Causalidad (Estatuto Tributario Colombia Art. 107). "
            "Output: JSON LedgerEngine con asientos, destinos y compliance check."
        ),
        documentos_base=[
            "Estatuto Tributario Colombia (ET)",
            "Plan Unico de Cuentas Colombia (PUC — Decreto 2649/1993)",
            "NIC 2 (Inventarios)",
            "Reglamento Facturacion Electronica DIAN",
        ],
        validaciones_requeridas=[
            "iva_19_percent_detectado",
            "proveedor_nit_verificado_dian",
            "centro_costo_asignado",
            "causalidad_principio_cumple",
            "double_entry_balanceado",
        ],
        cuenta_por_defecto="5175",
    ),
    ModuleCommand.TRAMITE_BANCARIO: CommandDescriptor(
        comando=ModuleCommand.TRAMITE_BANCARIO,
        label_ui="Trámite Bancario",
        instruccion_ai=(
            "Procesa comprobante de pago bancario. "
            "1. Extrae datos del voucher/comprobante (referencia, monto, fecha). "
            "2. Busca factura pendiente (CxP) que coincida con referencia y monto. "
            "3. Valida bancarización: si monto >100 UVT (~$5.000.000 COP), requiere medio de pago (Art. 771-5 ET). "
            "4. Verifica código de operación y trazabilidad bancaria. "
            "5. Genera asiento de pago: Banco (1110) contra CxP (220505). "
            "6. Si hay ReteFuente o ReteIVA, registra en cuenta correspondiente (236505, 236515). "
            "Output: JSON LedgerEngine con líneas de pago conciliadas y alertas de inconsistencia."
        ),
        documentos_base=[
            "Art. 771-5 ET Colombia (bancarización > 100 UVT)",
            "Decreto 1092 de 1996 - GMF 4x1000",
            "Circular DIAN - Medios de Pago Electrónico",
        ],
        validaciones_requeridas=[
            "bancarizacion_validada",
            "voucher_extraido_correctamente",
            "factura_pendiente_identificada",
            "codigo_operacion_verificado",
            "no_reconciliacion_mismatch",
        ],
        cuenta_por_defecto="1110",
    ),
    ModuleCommand.DOCUMENTO_LEGAL: CommandDescriptor(
        comando=ModuleCommand.DOCUMENTO_LEGAL,
        label_ui="Documento Legal",
        instruccion_ai=(
            "Analiza requerimiento de autoridad (DIAN, MinTrabajo, municipal). "
            "1. Identifica tipo de requerimiento (auditoría, sanción, liquidación, etc). "
            "2. Extrae plazo de respuesta y requisitos legales. "
            "3. Consulta base de conocimiento legal (ET Colombia, CST, CPACA). "
            "4. Redacta carta de respuesta formal con citas de artículos y plazos. "
            "5. Sugiere documentación a adjuntar. "
            "Output: JSON con draft de carta descargo, plazos y recomendaciones."
        ),
        documentos_base=[
            "Estatuto Tributario (ET) — Procedimiento Tributario Art. 683+",
            "CPACA — Ley 1437/2011 Procedimiento Administrativo",
            "Código Sustantivo del Trabajo (CST) Colombia",
            "Régimen Sancionatorio DIAN (Art. 641+ ET Colombia)",
        ],
        validaciones_requeridas=[
            "requerimiento_tipo_identificado",
            "plazo_respuesta_extraido",
            "base_legal_aplicable_identificada",
            "carta_con_citas_articulos",
        ],
        cuenta_por_defecto=None,
    ),
    ModuleCommand.ANTICIPO: CommandDescriptor(
        comando=ModuleCommand.ANTICIPO,
        label_ui="Anticipo",
        instruccion_ai=(
            "Registra adelanto de pago sin factura aún. "
            "1. IMPORTANTE: NO registrar en gasto (clase 5/6). "
            "2. Registrar en cuenta de Anticipo (1335 si es entregado, 2385 si es recibido). "
            "3. Crear control de seguimiento para facturas futuras. "
            "4. Cuando llegue la factura, descontar del anticipo y completar el ciclo. "
            "5. Validar que el monto total de anticipos no supere umbral de provisión. "
            "Output: JSON con asiento en cuenta 1335/2385 y nota de trazabilidad."
        ),
        documentos_base=[
            "NIC 1 (Presentación de Estados Financieros)",
            "PUC Colombia — Anticipos y Avances (1335 activo / 2385 pasivo)",
            "NIIF 15 (Ingresos de Actividades Ordinarias)",
        ],
        validaciones_requeridas=[
            "no_registrado_como_gasto",
            "anticipo_en_cuenta_1335_o_2385",
            "control_factura_futura_creado",
            "double_entry_balanceado",
        ],
        cuenta_por_defecto="1335",
    ),
    ModuleCommand.DEVOLUCION: CommandDescriptor(
        comando=ModuleCommand.DEVOLUCION,
        label_ui="Devolución",
        instruccion_ai=(
            "Procesa devolución de mercadería o cancelación de compra. "
            "1. Identifica factura o documento original. "
            "2. Genera Nota de Crédito (NC) o Nota de Débito (ND) según corresponda. "
            "3. Revierte asiento original manteniendo trazabilidad. "
            "4. Si hay impuestos (IVA), aplica reversión correcta. "
            "5. Actualiza stock si aplica (cuentas 1435/1405 inventarios). "
            "Output: JSON con asiento de reversión y NC/ND generada."
        ),
        documentos_base=[
            "NIC 18 / NIIF 15 (Ingresos)",
            "PUC Colombia — Notas Crédito/Débito",
            "Reglamento Facturación Electrónica DIAN",
        ],
        validaciones_requeridas=[
            "documento_original_identificado",
            "nota_credito_debito_tipo_correcto",
            "revercion_mantiene_trazabilidad",
            "iva_reversado_correctamente",
        ],
        cuenta_por_defecto=None,
    ),
    ModuleCommand.RETENCION: CommandDescriptor(
        comando=ModuleCommand.RETENCION,
        label_ui="Retención",
        instruccion_ai=(
            "Registra retención de IVA, renta u honorarios (ReteFuente/ReteIVA/ReteICA). "
            "1. Identifica tipo de retención (ReteIVA, ReteFuente, ReteICA). "
            "2. Si es ReteIVA: 15% del IVA de la factura, cuenta 236515. "
            "3. Si es ReteFuente renta: aplica tarifa según concepto, registra cuenta 236505. "
            "4. Si es honorarios: 11% persona jurídica / 10% persona natural (Art. 383 ET). "
            "5. Genera orden de pago/declaración a DIAN (Formulario 350). "
            "Output: JSON con asiento de retención y calendario de pago a DIAN."
        ),
        documentos_base=[
            "Estatuto Tributario Colombia — ReteFuente (Art. 371-392 ET)",
            "Estatuto Tributario Colombia — IVA (Art. 420-513 ET)",
            "PUC Colombia — Retenciones cuenta 2365",
        ],
        validaciones_requeridas=[
            "tipo_retencion_identificado",
            "tasa_correcta_aplicada",
            "cuenta_retencion_correcta",
            "orden_pago_dian_programada",
        ],
        cuenta_por_defecto="236505",
    ),
    ModuleCommand.AJUSTE_CIERRE: CommandDescriptor(
        comando=ModuleCommand.AJUSTE_CIERRE,
        label_ui="Ajuste de Cierre",
        instruccion_ai=(
            "Genera asientos de ajuste para cierre de período (mes/año). "
            "1. Diferencia en cambio (USD): calcula y registra en cuentas 5305/4245 (ET Art. 32). "
            "2. Deterioro cartera (CxC): provisiona en cuenta 5170 (provisiones - cartera). "
            "3. Depreciación activos fijos: gasto 5160, contra depreciación acumulada (159905/168005). "
            "4. Provisión prestaciones: Vacaciones 2610, Cesantías 2605, Prima de servicios 2615 (CST). "
            "5. Cierre de cuentas de resultado (clase 4/5/6/7) contra utilidad del ejercicio (3605). "
            "6. Valida que Activo = Pasivo + Patrimonio en balance de comprobación. "
            "Output: JSON con todos los asientos de ajuste y balance verificado."
        ),
        documentos_base=[
            "NIC 1 (Presentación)",
            "NIC 16 (Propiedad, Planta y Equipo)",
            "NIC 37 (Provisiones)",
            "PUC Colombia — Ajustes de Cierre (Decreto 2649/1993)",
        ],
        validaciones_requeridas=[
            "diferencia_cambio_calculada",
            "cobranza_dudosa_provisionada",
            "depreciacion_actualizada",
            "provisiones_laborales_incluidas",
            "balance_comprobacion_cuadra",
        ],
        cuenta_por_defecto=None,
    ),
}


def get_command_descriptor(cmd: ModuleCommand) -> CommandDescriptor:
    """Obtiene descriptor de comando"""
    return MODULE_COMMANDS_REGISTRY.get(cmd)


def get_all_commands() -> dict[str, CommandDescriptor]:
    """Retorna todos los comandos disponibles formateados para UI"""
    return {
        cmd.value: descriptor
        for cmd, descriptor in MODULE_COMMANDS_REGISTRY.items()
    }
