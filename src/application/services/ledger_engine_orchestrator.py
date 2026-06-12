"""
The Ledger Engine - Orchestrator
Flujo completo de validación legal y contable antes de persistir
Integra Unit A (Clasificación PUC Colombia) + Unit B (Cumplimiento ET Colombia) + JSON Output
"""

from __future__ import annotations

from decimal import Decimal
from typing import Literal

from src.application.dto.ledger_engine_output import (
    AccountingLogicModel,
    ActionRequiredModel,
    ComplianceCheckModel,
    HeaderModel,
    LedgerEngineOutput,
    LineaAsientoModel,
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
    The Ledger Engine: Flujo integrado de validación Colombia

    Entrada: tipo_documento, monto, datos adicionales
    Proceso: Unit A (clasificación PUC) → Unit B (cumplimiento ET Colombia)
    Salida: JSON LedgerEngine (header + accounting + compliance + action)
    Bloqueo: Si compliance.bloqueante = True, NO se persiste
    """

    def __init__(self):
        self.unit_a = ClassificationAgent()
        self.unit_b = ComplianceAgent()

    def process_transaction(
        self,
        module_command: ModuleCommand,
        transaction_type: str,
        amount: Decimal,
        currency: Literal["COP", "USD"] = "COP",
        **kwargs
    ) -> LedgerEngineOutput:
        """
        Procesa transacción a través del Ledger Engine completo.

        Args:
            module_command: Módulo/comando que invoca (INGRESO_GASTO, TRAMITE_BANCARIO, etc)
            transaction_type: Tipo de documento (FACTURA, CUENTA_COBRO, etc)
            amount: Monto de la transacción en COP
            currency: COP o USD
            **kwargs: supplier_nit, payment_method, service_code, cost_center, etc

        Returns:
            LedgerEngineOutput con asientos PUC, compliance ET Colombia y acciones requeridas

        Raises:
            ExpertValidationException: Si hay bloqueo en validación
        """

        operacion_id = f"TRANS-{int(amount)}-{transaction_type}"

        # UNIT A: Clasificación y generación de asientos PUC Colombia
        classification = self.unit_a.classify_transaction(
            transaction_type=TransactionType(transaction_type),
            amount=amount,
            iva_included=kwargs.get("iva_included", True),
            has_cost_center=bool(kwargs.get("cost_center")),
            cost_center_code=kwargs.get("cost_center"),
        )

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
            journal_lines=[line.model_dump() for line in accounting_lines],
            summary={
                "asiento_destino": [
                    {"cuenta": dest.cuenta_origen, "debe": float(dest.monto), "haber": 0}
                    for dest in classification.asientos_destino
                ],
                "retefuente_monto": (
                    float(classification.retencion_fuente.monto_retencion)
                    if classification.retencion_fuente
                    else None
                ),
                "validaciones_puc": classification.validaciones_puc,
            },
        )

        # UNIT B: Cumplimiento legal y tributario — ET Colombia
        compliance_result = self.unit_b.audit_document(
            transaction_type=transaction_type,
            amount=amount,
            currency=currency,
            payment_method=kwargs.get("payment_method"),
            supplier_nit=kwargs.get("supplier_nit"),
            service_code=kwargs.get("service_code"),
            doc_type_code=kwargs.get("doc_type_code"),
        )

        compliance_check = ComplianceCheckModel(
            status="BLOCKED" if compliance_result.bloqueante else "OK",
            warnings=(
                [compliance_result.alerta_legal]
                if compliance_result.alerta_legal != "Ninguna. Cumple normativa."
                else []
            ),
            checks=[
                {
                    "regla": "bancarizacion",
                    "estado": compliance_result.bancarizacion.requiere_bancarizacion.value,
                    "detalle": compliance_result.bancarizacion.validacion_resultado,
                },
                {
                    "regla": "causalidad",
                    "estado": compliance_result.causalidad.status.value,
                    "detalle": compliance_result.causalidad.razon_deducibilidad,
                },
                {
                    "regla": "retefuente",
                    "estado": compliance_result.retefuente.status.value,
                    "tasa": float(compliance_result.retefuente.tasa_porcentaje),
                    "monto": float(compliance_result.retefuente.monto_retefuente),
                },
            ],
        )

        action_required = self._build_action_required(
            module_command=module_command,
            compliance=compliance_result,
            amount=amount,
            **kwargs
        )

        output = LedgerEngineOutput(
            header=HeaderModel(
                operacion_id=operacion_id,
                tipo_transaccion=transaction_type,
                moneda=currency,
            ),
            accounting_logic=accounting_logic,
            compliance_check=compliance_check,
            action_required=action_required,
            bloquea_persistencia=compliance_result.bloqueante,
            razon_bloqueo=compliance_result.razon_bloqueo,
        )

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
        """Construye acciones requeridas según el módulo — Colombia"""

        actions: list[str] = []

        if module_command == ModuleCommand.INGRESO_GASTO:
            if compliance.retefuente.status.value != "NO_APLICA":
                actions.append(
                    f"Practicar ReteFuente {float(compliance.retefuente.tasa_porcentaje)*100:.1f}% "
                    f"= COP {float(compliance.retefuente.monto_retefuente):,.0f} — cuenta 236505"
                )
            actions.append("Validar registro DIAN y soporte documental")

        elif module_command == ModuleCommand.TRAMITE_BANCARIO:
            if kwargs.get("due_date"):
                actions.append("Conciliación completada. Pago registrado.")
            actions.append("Verificar radicado DIAN y trazabilidad bancaria")

        elif module_command == ModuleCommand.DOCUMENTO_LEGAL:
            requerimiento = kwargs.get("requerimiento_type", "DIAN")
            actions.append(f"Preparar respuesta requerimiento {requerimiento}")
            if kwargs.get("response_deadline"):
                actions.append(f"Plazo vencimiento: {kwargs['response_deadline']}")

        elif module_command == ModuleCommand.ANTICIPO:
            actions.append(
                "Anticipo registrado en cuenta 1305. "
                "Pendiente factura para aplicar y completar ciclo."
            )

        elif module_command == ModuleCommand.RETENCION:
            actions.append(
                "ReteFuente registrada. Programar declaración mensual a DIAN (Formulario 350)."
            )

        elif module_command == ModuleCommand.AJUSTE_CIERRE:
            actions.append("Asientos de cierre generados. Validar balance PUC.")

        return ActionRequiredModel(actions=actions)

    def validate_and_get_output(
        self,
        module_command: ModuleCommand,
        transaction_type: str,
        amount: Decimal,
        **kwargs
    ) -> LedgerEngineOutput:
        """Wrapper con excepción en bloqueo (safe-by-default)"""
        try:
            return self.process_transaction(
                module_command=module_command,
                transaction_type=transaction_type,
                amount=amount,
                **kwargs
            )
        except ExpertValidationException:
            raise
