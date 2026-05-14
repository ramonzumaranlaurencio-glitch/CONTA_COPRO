"""
The Ledger Engine - Orchestrator
Flujo completo de validación legal y contable antes de persistir
Integra Unit A (Clasificación) + Unit B (Cumplimiento) + JSON Output
"""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from typing import Literal

from src.application.dto.ledger_engine_output import (
    AccountingLogicModel,
    ActionRequiredModel,
    BancarizacionModel,
    ComplianceCheckModel,
    LedgerEngineOutput,
    LineaAsientoModel,
    build_ledger_engine_output,
)
from src.application.services.ledger_command_registry import ModuleCommand
from src.application.services.ledger_unit_a_classification import (
    ClassificationAgent,
    TransactionType,
)
from src.application.services.ledger_unit_b_compliance import ComplianceAgent
from src.domain.exceptions import ExpertValidationException


class LedgerEngineOrchestrator:
    """
    The Ledger Engine: Flujo integrado de validación
    
    Entrada: tipo_documento, monto, datos adicionales
    Proceso: Unit A (clasificación) → Unit B (cumplimiento)
    Salida: JSON LedgerEngine (header + accounting + compliance + action)
    Bloqueo: Si compliance.bloqueante = True, NO se persistiiza
    """

    def __init__(self):
        self.unit_a = ClassificationAgent()
        self.unit_b = ComplianceAgent()

    def process_transaction(
        self,
        module_command: ModuleCommand,
        transaction_type: str,
        amount: Decimal,
        currency: Literal["PEN", "USD"] = "PEN",
        **kwargs
    ) -> LedgerEngineOutput:
        """
        Procesa transacción a través del Ledger Engine completo.
        
        Args:
            module_command: Qué módulo/comando invoca (INGRESO_GASTO, TRAMITE_BANCARIO, etc)
            transaction_type: Tipo de documento (FACTURA, RECIBO, etc)
            amount: Monto de la transacción
            currency: PEN o USD
            **kwargs: supplier_ruc, customer_ruc, payment_method, service_code, etc
        
        Returns:
            LedgerEngineOutput con asientos, compliance checks y acciones requeridas
        
        Raises:
            ExpertValidationException: Si hay bloqueo en validación
        """

        operacion_id = f"TRANS-{int(amount)}-{transaction_type}"

        # UNIT A: Clasificación y generación de asientos
        classification = self.unit_a.classify_transaction(
            transaction_type=TransactionType(transaction_type),
            amount=amount,
            igv_included=kwargs.get("igv_included", True),
            has_cost_center=bool(kwargs.get("cost_center")),
            cost_center_code=kwargs.get("cost_center"),
        )

        # Convertir salida Unit A al formato de output
        accounting_lines = [
            LineaAsientoModel(
                cuenta=line.cuenta,
                debe=line.debe,
                haber=line.haber,
                glosa=line.glosa,
                centro_costo=line.centro_costo,
            )
            for line in classification.asiento_principal
        ]

        accounting_logic = AccountingLogicModel(
            asiento_diario=accounting_lines,
            asiento_destino=[
                {"cuenta": dest.cuenta_origen, "debe": dest.monto, "haber": Decimal("0")}
                for dest in classification.asientos_destino
            ],
            retension_4ta_categoria=(
                classification.retension_4ta_cat.monto_retencion
                if classification.retension_4ta_cat
                else None
            ),
            validaciones_pcge=classification.validaciones_pcge,
        )

        # UNIT B: Cumplimiento legal y tributario
        compliance_result = self.unit_b.audit_document(
            transaction_type=transaction_type,
            amount=amount,
            currency=currency,
            payment_method=kwargs.get("payment_method"),
            supplier_ruc=kwargs.get("supplier_ruc"),
            service_code=kwargs.get("service_code"),
            doc_type_code=kwargs.get("doc_type_code"),
        )

        # Construir compliance check output
        compliance_check = ComplianceCheckModel(
            bancarizacion_requerida=compliance_result.bancarizacion.requiere_bancarizacion.value != "NOT_REQUIRED",
            bancarizacion_validada=(
                BancarizacionModel(
                    requerida=compliance_result.bancarizacion.requiere_bancarizacion.value != "NOT_REQUIRED",
                    monto_actual=compliance_result.bancarizacion.monto_actual,
                    medio_pago_validado=(
                        compliance_result.bancarizacion.requiere_bancarizacion.value
                        != "FAILED"
                    ),
                )
                if compliance_result.bancarizacion.requiere_bancarizacion.value != "NOT_REQUIRED"
                else None
            ),
            causalidad_cumplida=compliance_result.causalidad.status.value != "INVALID",
            detraccion_aplica=compliance_result.detraccion.status.value != "NO_APLICA",
            detraccion_tasa=compliance_result.detraccion.tasa_porcentaje,
            detraccion_monto=compliance_result.detraccion.monto_detraccion,
            alerta_legal=compliance_result.alerta_legal,
            bloqueante=compliance_result.bloqueante,
        )

        # Acciones requeridas según módulo
        action_required = self._build_action_required(
            module_command=module_command,
            compliance=compliance_result,
            amount=amount,
            **kwargs
        )

        # Construir output final del Ledger Engine
        output = build_ledger_engine_output(
            operacion_id=operacion_id,
            tipo_documento=transaction_type,
            entidad="SUNAT" if compliance_check.bancarizacion_requerida else "INTERNO",
            accounting=accounting_logic,
            compliance=compliance_check,
            action_required=action_required,
        )

        # Si hay bloqueo, lanzar excepción
        if output.bloquea_persistencia:
            raise ExpertValidationException(
                message=f"Bloqueo en Ledger Engine: {output.razon_bloqueo}",
                checks=[
                    {
                        "code": "LEDGER_ENGINE_BLOCKED",
                        "detail": output.razon_bloqueo,
                    }
                ],
            )

        return output

    def _build_action_required(
        self,
        module_command: ModuleCommand,
        compliance,
        amount: Decimal,
        **kwargs
    ) -> ActionRequiredModel:
        """Construye acciones requeridas según el módulo"""

        action = ActionRequiredModel()

        if module_command == ModuleCommand.INGRESO_GASTO:
            if compliance.detraccion.status.value != "NO_APLICA":
                action.notificar_tesoreria = (
                    f"Registrar detracción {compliance.detraccion.tasa_porcentaje*100:.0f}% "
                    f"por S/ {compliance.detraccion.monto_detraccion} en cuenta 104"
                )
            action.registro_sunat_listo = True

        elif module_command == ModuleCommand.TRAMITE_BANCARIO:
            vencimiento = kwargs.get("due_date")
            if vencimiento:
                action.notificar_tesoreria = f"Conciliación completada. Pago registrado."
            action.registro_sunat_listo = True

        elif module_command == ModuleCommand.DOCUMENTO_LEGAL:
            action.generar_carta_descargo = True
            action.requerimiento_tipo = kwargs.get("requerimiento_type", "SUNAT")
            action.fecha_vencimiento_respuesta = kwargs.get("response_deadline")

        elif module_command == ModuleCommand.ANTICIPO:
            action.notificar_tesoreria = (
                "Anticipo registrado en cuenta 122. "
                "Pendiente factura para descontar y completar ciclo."
            )

        elif module_command == ModuleCommand.RETENCION:
            action.notificar_tesoreria = (
                f"Retención registrada. Programar declaración a SUNAT."
            )

        elif module_command == ModuleCommand.AJUSTE_CIERRE:
            action.notificar_tesoreria = "Asientos de cierre generados. Validar balance."
            action.registro_sunat_listo = True

        return action

    def validate_and_get_output(
        self,
        module_command: ModuleCommand,
        transaction_type: str,
        amount: Decimal,
        **kwargs
    ) -> LedgerEngineOutput:
        """
        Wrapper que procesa la transacción y retorna output,
        lanzando excepción si hay bloqueo (safe-by-default)
        """
        try:
            return self.process_transaction(
                module_command=module_command,
                transaction_type=transaction_type,
                amount=amount,
                **kwargs
            )
        except ExpertValidationException:
            raise
