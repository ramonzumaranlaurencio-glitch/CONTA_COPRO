"""
The Ledger Engine - Unit B: Compliance Agent (Legal/Tributary/Labor)
Audita documentos contra SUNAT, Código Tributario, MTPE y derecho laboral
"""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class BankingRequirementStatus(str, Enum):
    NOT_REQUIRED = "NOT_REQUIRED"
    REQUIRED = "REQUIRED"
    FAILED = "FAILED"


class CausalityStatus(str, Enum):
    VALID = "VALID"
    INVALID = "INVALID"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"


class DetraccionStatus(str, Enum):
    NO_APLICA = "NO_APLICA"
    APLICA_10 = "APLICA_10"
    APLICA_12 = "APLICA_12"
    APLICA_30 = "APLICA_30"


class LaborValidationStatus(str, Enum):
    COMPLIANT = "COMPLIANT"
    NON_COMPLIANT = "NON_COMPLIANT"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"


class BankingValidation(BaseModel):
    """Validación de bancarización según Ley de Lucha contra Evasión"""
    monto_threshold_pen: Decimal = Decimal("2000")
    monto_threshold_usd: Decimal = Decimal("500")
    monto_actual: Decimal
    requiere_bancarizacion: BankingRequirementStatus
    codigo_operacion: str | None = None
    validacion_resultado: str = ""


class CausalityValidation(BaseModel):
    """Validación del Principio de Causalidad (TUO LIR Art. 37)"""
    es_necesario_para_mantener_fuente: bool | None = None
    gasto_no_deducible: bool = False
    razon_deducibilidad: str = ""
    status: CausalityStatus


class DetraccionValidation(BaseModel):
    """Validación de Sistema de Detracciones (SPOT)"""
    status: DetraccionStatus
    tasa_porcentaje: Decimal = Decimal("0.00")
    codigo_servicio: str | None = None
    monto_detraccion: Decimal = Decimal("0.00")


class ComplianceCheckOutput(BaseModel):
    """Output Unit B: Auditoría legal, tributaria y laboral"""
    bancarizacion: BankingValidation
    causalidad: CausalityValidation
    detraccion: DetraccionValidation
    requiere_descargo: bool = False
    alerta_legal: str = "Ninguna. Cumple normativa."
    bloqueante: bool = False
    razon_bloqueo: str | None = None
    sugerencia_accion: str = ""


class ComplianceAgent:
    """
    Unit B: Agente de Cumplimiento Legal/Tributario/Laboral
    
    Responsabilidades:
    1. Cruza documento con BD SUNAT y Código Tributario
    2. Bancarización: Si >$500 o >S/2,000, valida medio de pago
    3. Causalidad: Evalúa Principio de Causalidad (TUO LIR Art. 37)
    4. Laboral: Si contrato/liquidación, valida contra D. Leg. 728
    """

    def __init__(self, sunat_verifier=None):
        self.sunat_verifier = sunat_verifier

    def audit_document(
        self,
        transaction_type: str,
        amount: Decimal,
        currency: Literal["PEN", "USD"] = "PEN",
        payment_method: str | None = None,
        supplier_ruc: str | None = None,
        service_code: str | None = None,
        doc_type_code: str | None = None,
    ) -> ComplianceCheckOutput:
        """Audita documento contra normativa tributaria, laboral y legal"""

        bancarizacion = self._check_bancarizacion(
            amount=amount,
            currency=currency,
            payment_method=payment_method,
        )

        causalidad = self._check_causalidad(
            transaction_type=transaction_type,
            amount=amount,
        )

        detraccion = self._check_detraccion(
            service_code=service_code,
            amount=amount,
            doc_type_code=doc_type_code,
        )

        bloqueante = (
            bancarizacion.requiere_bancarizacion == BankingRequirementStatus.FAILED
            or causalidad.status == CausalityStatus.INVALID
        )

        alerta = "Ninguna. Cumple normativa."
        razon_bloqueo = None
        sugerencia = ""

        if bloqueante:
            alerta = "BLOQUEANTE: Revisar bancarización o causalidad"
            if bancarizacion.requiere_bancarizacion == BankingRequirementStatus.FAILED:
                razon_bloqueo = f"Monto {amount} {currency} excede límite y no valida bancarización"
            elif causalidad.status == CausalityStatus.INVALID:
                razon_bloqueo = "Gasto no deducible. No cumple Principio de Causalidad"

        if detraccion.status != DetraccionStatus.NO_APLICA:
            sugerencia = f"Registrar detracción {detraccion.tasa_porcentaje*100:.0f}% en cuenta 104 (Detracciones)"

        return ComplianceCheckOutput(
            bancarizacion=bancarizacion,
            causalidad=causalidad,
            detraccion=detraccion,
            requiere_descargo=False,
            alerta_legal=alerta,
            bloqueante=bloqueante,
            razon_bloqueo=razon_bloqueo,
            sugerencia_accion=sugerencia,
        )

    def _check_bancarizacion(
        self,
        amount: Decimal,
        currency: str,
        payment_method: str | None,
    ) -> BankingValidation:
        """
        Ley para la Lucha contra la Evasión y para la Formalización de la Economía:
        - Limite PEN: S/ 2,000
        - Límite USD: $ 500
        - Si excede, DEBE usar medio de pago bancario
        """
        threshold_pen = Decimal("2000")
        threshold_usd = Decimal("500")

        excede_limite = (
            (currency == "PEN" and amount > threshold_pen)
            or (currency == "USD" and amount > threshold_usd)
        )

        if not excede_limite:
            return BankingValidation(
                monto_actual=amount,
                requiere_bancarizacion=BankingRequirementStatus.NOT_REQUIRED,
                validacion_resultado="Monto por debajo de límite de bancarización",
            )

        # Si excede, requiere medio de pago válido
        if not payment_method:
            return BankingValidation(
                monto_actual=amount,
                requiere_bancarizacion=BankingRequirementStatus.FAILED,
                validacion_resultado=f"Monto {amount} {currency} excede límite pero NO reporta medio de pago",
            )

        valid_methods = {"TRANSFERENCIA", "CHEQUE", "EFECTIVO_BANCARIO", "TARJETA"}
        if payment_method.upper() not in valid_methods:
            return BankingValidation(
                monto_actual=amount,
                requiere_bancarizacion=BankingRequirementStatus.FAILED,
                validacion_resultado=f"Método '{payment_method}' NO es válido para monto de {amount} {currency}",
            )

        return BankingValidation(
            monto_actual=amount,
            requiere_bancarizacion=BankingRequirementStatus.REQUIRED,
            codigo_operacion=f"BAN-{int(amount)}-{payment_method[:3]}",
            validacion_resultado=f"Bancarización validada: {payment_method}",
        )

    def _check_causalidad(
        self,
        transaction_type: str,
        amount: Decimal,
    ) -> CausalityValidation:
        """
        Principio de Causalidad (TUO LIR Art. 37):
        "Son deducibles los gastos que se hayan pagado o incurrido en la obtención o mantenimiento
        de la renta."
        """

        # Gastos NO deducibles según TUO LIR
        gastos_no_deducibles = {
            "MULTAS_INFRACCIONES",
            "GASTO_PERSONAL",
            "REGALO_SIN_CONTRAPARTIDA",
            "VIAJE_TURISMO",
            "COMIDA_PERSONAL",
        }

        if transaction_type.upper() in gastos_no_deducibles:
            return CausalityValidation(
                es_necesario_para_mantener_fuente=False,
                gasto_no_deducible=True,
                razon_deducibilidad=f"Gasto tipo '{transaction_type}' no es deducible según TUO LIR",
                status=CausalityStatus.INVALID,
            )

        # Gastos típicamente deducibles
        gastos_deducibles = {
            "COMPRA_MERCADERIA",
            "MATERIA_PRIMA",
            "SERVICIO_PROFESIONAL",
            "PUBLICIDAD",
            "MANTENIMIENTO_EQUIPO",
            "HONORARIOS",
        }

        if transaction_type.upper() in gastos_deducibles:
            return CausalityValidation(
                es_necesario_para_mantener_fuente=True,
                gasto_no_deducible=False,
                razon_deducibilidad=f"Gasto deducible por mantener fuente de renta",
                status=CausalityStatus.VALID,
            )

        # Casos que requieren revisión
        return CausalityValidation(
            es_necesario_para_mantener_fuente=None,
            gasto_no_deducible=False,
            razon_deducibilidad=f"Tipo '{transaction_type}' requiere revisión manual",
            status=CausalityStatus.REQUIRES_REVIEW,
        )

    def _check_detraccion(
        self,
        service_code: str | None,
        amount: Decimal,
        doc_type_code: str | None,
    ) -> DetraccionValidation:
        """
        Sistema de Detracciones (SPOT):
        Tabla de servicios y tasas de detracción
        """

        # Tabla simplificada de detracciones por tipo de servicio
        detraccion_table = {
            "TRANSPORTE_CARGA": ("10", Decimal("0.10")),
            "TRANSPORTE_PASAJEROS": ("10", Decimal("0.10")),
            "SERVICIOS_HOTEL": ("12", Decimal("0.12")),
            "SERVICIOS_COMIDA": ("10", Decimal("0.10")),
            "REPARACION_INMUEBLE": ("30", Decimal("0.30")),
            "ALQUILER_INMUEBLE": ("30", Decimal("0.30")),
            "CONTRATO_INDEPENDIENTE": ("30", Decimal("0.30")),
        }

        if not service_code or service_code.upper() not in detraccion_table:
            return DetraccionValidation(
                status=DetraccionStatus.NO_APLICA,
                razon="Servicio no está en SPOT",
            )

        codigo, tasa = detraccion_table[service_code.upper()]
        monto_detraccion = (amount * tasa).quantize(Decimal("0.01"))

        status_map = {
            "10": DetraccionStatus.APLICA_10,
            "12": DetraccionStatus.APLICA_12,
            "30": DetraccionStatus.APLICA_30,
        }

        return DetraccionValidation(
            status=status_map.get(codigo, DetraccionStatus.NO_APLICA),
            tasa_porcentaje=tasa,
            codigo_servicio=service_code,
            monto_detraccion=monto_detraccion,
        )
