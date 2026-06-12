"""
The Ledger Engine - Unit A: Classification & Journal Entry Agent
Core contable: Genera asientos JSON validados contra PUC Colombia
"""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class TransactionType(str, Enum):
    FACTURA = "FACTURA"
    CUENTA_COBRO = "CUENTA_COBRO"
    NOTA_CREDITO = "NOTA_CREDITO"
    NOTA_DEBITO = "NOTA_DEBITO"
    FACTURA_SIMPLIFICADA = "FACTURA_SIMPLIFICADA"
    COMPROBANTE_PAGO = "COMPROBANTE_PAGO"
    TRANSFERENCIA_BANCARIA = "TRANSFERENCIA_BANCARIA"
    CHEQUE = "CHEQUE"
    EFECTIVO = "EFECTIVO"
    CONTRATO_LABORAL = "CONTRATO_LABORAL"
    LIQUIDACION = "LIQUIDACION"


class PUCAccountClass(str, Enum):
    """Plan Unico de Cuentas Colombia - Clases principales (Decreto 2649/1993)"""
    ACTIVOS = "1"
    PASIVOS = "2"
    PATRIMONIO = "3"
    INGRESOS = "4"
    GASTOS = "5"
    COSTOS_VENTAS = "6"
    COSTOS_PRODUCCION = "7"
    CUENTAS_ORDEN_DEUDORAS = "8"
    CUENTAS_ORDEN_ACREEDORAS = "9"


class JournalLine(BaseModel):
    cuenta: str = Field(..., description="Código contable PUC Colombia")
    debe: Decimal = Field(Decimal("0.00"), ge=0)
    haber: Decimal = Field(Decimal("0.00"), ge=0)
    glosa: str = Field(default="", max_length=200)
    centro_costo: str | None = None
    nit_contraparte: str | None = None


class AsientoContable(BaseModel):
    """Asiento de destino automático para costos clase 6"""
    cuenta_origen: str = Field(..., description="Cuenta 6x del costo")
    cuenta_destino: str = Field(..., description="Cuenta 9x del centro de costo")
    monto: Decimal


class RetencionFuente(BaseModel):
    """Calculo de retención en la fuente para honorarios (Art. 383-385 ET Colombia)"""
    monto_bruto: Decimal
    tasa_retencion: Decimal = Decimal("0.11")
    monto_retencion: Decimal
    monto_neto: Decimal
    aplica: bool = Field(default=True, description="True: aplica ReteFuente desde el primer peso")


class ClassificationOutput(BaseModel):
    """Output Unit A: Clasificacion y generacion de asiento PUC Colombia"""
    transaction_id: str
    tipo_documento: TransactionType
    monto_total: Decimal
    iva_19_detectado: bool = False
    iva_monto: Decimal = Decimal("0.00")
    asiento_principal: list[JournalLine]
    asientos_destino: list[AsientoContable] = Field(default_factory=list)
    retencion_fuente: RetencionFuente | None = None
    validaciones_puc: list[str] = Field(default_factory=list)
    alertas: list[str] = Field(default_factory=list)


class ClassificationAgent:
    """
    Unit A: Agente de Clasificacion y Asiento — PUC Colombia

    Regla de cuadre: Suma Debitos == Suma Creditos
    Factura de compra → verifica IVA 19% (Art. 468 ET)
    Cuenta de cobro → calcula ReteFuente honorarios 11% persona juridica (Art. 383 ET)
    Cuentas clase 5 → naturaleza debito; clase 4 → naturaleza credito
    """

    def classify_transaction(
        self,
        transaction_type: TransactionType,
        amount: Decimal,
        iva_included: bool = True,
        has_cost_center: bool = False,
        cost_center_code: str | None = None,
    ) -> ClassificationOutput:
        """Clasifica transaccion y genera asiento automatico PUC Colombia"""

        iva_monto = Decimal("0.00")
        iva_detectado = False

        if transaction_type == TransactionType.FACTURA and iva_included:
            iva_detectado = True
            # IVA descontable = Total × 19/119 (extrae el 19% incluido en el total)
            iva_monto = (amount * Decimal("0.1597")).quantize(Decimal("0.01"))

        asiento_principal = self._generate_primary_entry(
            transaction_type=transaction_type,
            amount=amount,
            iva_monto=iva_monto,
            cost_center=cost_center_code,
        )

        asientos_destino: list[AsientoContable] = []
        if transaction_type in {TransactionType.FACTURA, TransactionType.FACTURA_SIMPLIFICADA}:
            asientos_destino = self._generate_cost_destination_entries(
                amount=amount,
                cost_center=cost_center_code or "BOG-ADM",
            )

        retencion = None
        if transaction_type == TransactionType.CUENTA_COBRO:
            retencion = self._calculate_retefuente_honorarios(amount)

        validaciones = self._validate_against_puc(asiento_principal)
        alertas = []
        if not has_cost_center and any(
            line.cuenta.startswith("5") or line.cuenta.startswith("6")
            for line in asiento_principal
        ):
            alertas.append("Gasto/costo registrado sin centro de costo asignado")

        return ClassificationOutput(
            transaction_id="",
            tipo_documento=transaction_type,
            monto_total=amount,
            iva_19_detectado=iva_detectado,
            iva_monto=iva_monto,
            asiento_principal=asiento_principal,
            asientos_destino=asientos_destino,
            retencion_fuente=retencion,
            validaciones_puc=validaciones,
            alertas=alertas,
        )

    def _generate_primary_entry(
        self,
        transaction_type: TransactionType,
        amount: Decimal,
        iva_monto: Decimal,
        cost_center: str | None,
    ) -> list[JournalLine]:
        """Genera lineas del asiento principal segun tipo de transaccion PUC Colombia"""

        if transaction_type == TransactionType.FACTURA:
            subtotal = amount - iva_monto if iva_monto else amount
            return [
                JournalLine(
                    cuenta="1435",
                    debe=subtotal,
                    haber=Decimal("0.00"),
                    glosa="Compra mercancia no fabricada",
                    centro_costo=cost_center,
                ),
                JournalLine(
                    cuenta="2408",
                    debe=iva_monto,
                    haber=Decimal("0.00"),
                    glosa="IVA descontable Art. 485 ET",
                ),
                JournalLine(
                    cuenta="220505",
                    debe=Decimal("0.00"),
                    haber=amount,
                    glosa="Proveedores nacionales por pagar",
                ),
            ]

        elif transaction_type == TransactionType.CUENTA_COBRO:
            retefuente = (amount * Decimal("0.11")).quantize(Decimal("0.01"))
            neto = amount - retefuente
            return [
                JournalLine(
                    cuenta="513035",
                    debe=amount,
                    haber=Decimal("0.00"),
                    glosa="Honorarios y consultoria",
                    centro_costo=cost_center or "BOG-ADM",
                ),
                JournalLine(
                    cuenta="236505",
                    debe=Decimal("0.00"),
                    haber=retefuente,
                    glosa="ReteFuente honorarios 11% Art. 383 ET",
                ),
                JournalLine(
                    cuenta="231010",
                    debe=Decimal("0.00"),
                    haber=neto,
                    glosa="Honorarios por pagar neto",
                ),
            ]

        else:
            return [
                JournalLine(
                    cuenta="519095",
                    debe=amount,
                    haber=Decimal("0.00"),
                    glosa=f"Transaccion {transaction_type.value}",
                    centro_costo=cost_center,
                ),
                JournalLine(
                    cuenta="220505",
                    debe=Decimal("0.00"),
                    haber=amount,
                    glosa="Obligacion con proveedor",
                ),
            ]

    def _generate_cost_destination_entries(
        self,
        amount: Decimal,
        cost_center: str,
    ) -> list[AsientoContable]:
        """Centro de costo destino para costos de ventas clase 6"""
        return [
            AsientoContable(
                cuenta_origen="6912",
                cuenta_destino="9140",
                monto=amount,
            ),
        ]

    def _calculate_retefuente_honorarios(
        self,
        gross_amount: Decimal,
    ) -> RetencionFuente:
        """ReteFuente honorarios 11% persona juridica (Art. 383 ET Colombia)"""
        tasa = Decimal("0.11")
        retencion = (gross_amount * tasa).quantize(Decimal("0.01"))
        neto = gross_amount - retencion
        return RetencionFuente(
            monto_bruto=gross_amount,
            tasa_retencion=tasa,
            monto_retencion=retencion,
            monto_neto=neto,
            aplica=True,
        )

    def _validate_against_puc(self, lines: list[JournalLine]) -> list[str]:
        """Valida asiento contra PUC Colombia — Debe == Haber"""
        validaciones = []
        total_debe = sum(line.debe for line in lines)
        total_haber = sum(line.haber for line in lines)

        if total_debe != total_haber:
            validaciones.append(
                f"ALERTA: Desbalance Debe={total_debe} vs Haber={total_haber}"
            )

        cost_lines = [
            line for line in lines
            if line.cuenta.startswith("5") or line.cuenta.startswith("6")
        ]
        if cost_lines and not any(line.centro_costo for line in cost_lines):
            validaciones.append("ALERTA: Gastos/costos sin centro de costo (requerido PUC clase 5/6)")

        return validaciones
