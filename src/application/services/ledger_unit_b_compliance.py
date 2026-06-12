"""
The Ledger Engine - Unit B: Compliance Agent (Legal/Tributary/Labor)
Audita documentos contra DIAN, Estatuto Tributario Colombia y normativa laboral
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


class RetefuenteStatus(str, Enum):
    NO_APLICA = "NO_APLICA"
    APLICA_25 = "APLICA_25"    # 2.5% compras generales Art. 376 ET
    APLICA_35 = "APLICA_35"    # 3.5% compras / arrendamiento bienes muebles
    APLICA_40 = "APLICA_40"    # 4% servicios en general Art. 392 ET
    APLICA_100 = "APLICA_100"  # 10% honorarios persona natural Art. 383 ET
    APLICA_110 = "APLICA_110"  # 11% honorarios persona jurídica Art. 383 ET


class LaborValidationStatus(str, Enum):
    COMPLIANT = "COMPLIANT"
    NON_COMPLIANT = "NON_COMPLIANT"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"


class BankingValidation(BaseModel):
    """Bancarización Art. 771-5 ET Colombia — pagos ≥ 100 UVT requieren medio bancario"""
    monto_threshold_cop: Decimal = Decimal("5000000")  # ~100 UVT 2025
    monto_threshold_usd: Decimal = Decimal("1500")
    monto_actual: Decimal
    requiere_bancarizacion: BankingRequirementStatus
    codigo_operacion: str | None = None
    validacion_resultado: str = ""


class CausalityValidation(BaseModel):
    """Principio de Causalidad Art. 107 ET Colombia — deducibilidad del gasto"""
    es_necesario_para_mantener_fuente: bool | None = None
    gasto_no_deducible: bool = False
    razon_deducibilidad: str = ""
    status: CausalityStatus


class RetefuenteValidation(BaseModel):
    """Retención en la Fuente Art. 371-385 ET Colombia"""
    status: RetefuenteStatus
    tasa_porcentaje: Decimal = Decimal("0.00")
    codigo_servicio: str | None = None
    monto_retefuente: Decimal = Decimal("0.00")


class ComplianceCheckOutput(BaseModel):
    """Output Unit B: Auditoría legal, tributaria y laboral Colombia"""
    bancarizacion: BankingValidation
    causalidad: CausalityValidation
    retefuente: RetefuenteValidation
    requiere_descargo: bool = False
    alerta_legal: str = "Ninguna. Cumple normativa."
    bloqueante: bool = False
    razon_bloqueo: str | None = None
    sugerencia_accion: str = ""


class ComplianceAgent:
    """
    Unit B: Agente de Cumplimiento Legal/Tributario/Laboral Colombia

    Responsabilidades:
    1. Bancarización: Si ≥ 100 UVT (~5M COP), valida medio de pago (Art. 771-5 ET)
    2. Causalidad: Evalúa deducibilidad del gasto (Art. 107 ET Colombia)
    3. ReteFuente: Verifica si aplica retención en la fuente (Art. 371-385 ET)
    """

    def __init__(self, dian_verifier=None):
        self.dian_verifier = dian_verifier

    def audit_document(
        self,
        transaction_type: str,
        amount: Decimal,
        currency: Literal["COP", "USD"] = "COP",
        payment_method: str | None = None,
        supplier_nit: str | None = None,
        service_code: str | None = None,
        doc_type_code: str | None = None,
    ) -> ComplianceCheckOutput:
        """Audita documento contra normativa tributaria, laboral y legal colombiana"""

        bancarizacion = self._check_bancarizacion(
            amount=amount,
            currency=currency,
            payment_method=payment_method,
        )

        causalidad = self._check_causalidad(
            transaction_type=transaction_type,
            amount=amount,
        )

        retefuente = self._check_retefuente(
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
                razon_bloqueo = f"Monto {amount} {currency} ≥ 100 UVT y no valida bancarización (Art. 771-5 ET)"
            elif causalidad.status == CausalityStatus.INVALID:
                razon_bloqueo = "Gasto no deducible. No cumple Art. 107 ET Colombia"

        if retefuente.status != RetefuenteStatus.NO_APLICA:
            sugerencia = (
                f"Practicar ReteFuente {float(retefuente.tasa_porcentaje)*100:.1f}% "
                f"= COP {float(retefuente.monto_retefuente):,.0f} — cuenta 236505"
            )

        return ComplianceCheckOutput(
            bancarizacion=bancarizacion,
            causalidad=causalidad,
            retefuente=retefuente,
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
        Art. 771-5 ET Colombia: pagos ≥ 100 UVT (~5M COP) deben realizarse
        mediante medio de pago bancario para que el gasto sea deducible.
        """
        threshold_cop = Decimal("5000000")  # ~100 UVT 2025
        threshold_usd = Decimal("1500")

        excede_limite = (
            (currency == "COP" and amount > threshold_cop)
            or (currency == "USD" and amount > threshold_usd)
        )

        if not excede_limite:
            return BankingValidation(
                monto_actual=amount,
                requiere_bancarizacion=BankingRequirementStatus.NOT_REQUIRED,
                validacion_resultado="Monto < 100 UVT — bancarización no obligatoria",
            )

        if not payment_method:
            return BankingValidation(
                monto_actual=amount,
                requiere_bancarizacion=BankingRequirementStatus.FAILED,
                validacion_resultado=f"Monto {amount} {currency} ≥ 100 UVT pero NO se reporta medio de pago",
            )

        valid_methods = {"TRANSFERENCIA", "CHEQUE", "EFECTIVO_BANCARIO", "TARJETA"}
        if payment_method.upper() not in valid_methods:
            return BankingValidation(
                monto_actual=amount,
                requiere_bancarizacion=BankingRequirementStatus.FAILED,
                validacion_resultado=f"Método '{payment_method}' no válido para monto ≥ 100 UVT (Art. 771-5 ET)",
            )

        return BankingValidation(
            monto_actual=amount,
            requiere_bancarizacion=BankingRequirementStatus.REQUIRED,
            codigo_operacion=f"BAN-{int(amount)}-{payment_method[:3]}",
            validacion_resultado=f"Bancarización validada: {payment_method} (Art. 771-5 ET)",
        )

    def _check_causalidad(
        self,
        transaction_type: str,
        amount: Decimal,
    ) -> CausalityValidation:
        """
        Art. 107 ET Colombia: son deducibles las expensas realizadas durante el
        año gravable en el desarrollo de cualquier actividad productora de renta.
        """

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
                razon_deducibilidad=f"Gasto '{transaction_type}' no deducible — Art. 107 ET Colombia",
                status=CausalityStatus.INVALID,
            )

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
                razon_deducibilidad="Gasto deducible — necesario para generación de renta (Art. 107 ET)",
                status=CausalityStatus.VALID,
            )

        return CausalityValidation(
            es_necesario_para_mantener_fuente=None,
            gasto_no_deducible=False,
            razon_deducibilidad=f"Tipo '{transaction_type}' requiere revisión manual",
            status=CausalityStatus.REQUIRES_REVIEW,
        )

    def _check_retefuente(
        self,
        service_code: str | None,
        amount: Decimal,
        doc_type_code: str | None,
    ) -> RetefuenteValidation:
        """
        ReteFuente Colombia (Art. 371-392 ET):
        Tabla de tarifas por tipo de servicio/bien.
        """

        retefuente_table: dict[str, tuple[RetefuenteStatus, Decimal]] = {
            "HONORARIOS_PJ": (RetefuenteStatus.APLICA_110, Decimal("0.11")),
            "HONORARIOS_PN": (RetefuenteStatus.APLICA_100, Decimal("0.10")),
            "COMPRAS": (RetefuenteStatus.APLICA_35, Decimal("0.035")),
            "COMPRAS_GENERAL": (RetefuenteStatus.APLICA_25, Decimal("0.025")),
            "SERVICIOS": (RetefuenteStatus.APLICA_40, Decimal("0.04")),
            "ARRENDAMIENTO": (RetefuenteStatus.APLICA_35, Decimal("0.035")),
        }

        if not service_code or service_code.upper() not in retefuente_table:
            return RetefuenteValidation(status=RetefuenteStatus.NO_APLICA)

        status_enum, tasa = retefuente_table[service_code.upper()]
        monto_retefuente = (amount * tasa).quantize(Decimal("0.01"))

        return RetefuenteValidation(
            status=status_enum,
            tasa_porcentaje=tasa,
            codigo_servicio=service_code,
            monto_retefuente=monto_retefuente,
        )
