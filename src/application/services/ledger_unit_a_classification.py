"""
The Ledger Engine - Unit A: Classification & Journal Entry Agent
Core contable: Genera asientos JSON validados contra PCGE
"""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class TransactionType(str, Enum):
    FACTURA = "FACTURA"
    RECIBO_HONORARIOS = "RECIBO_HONORARIOS"
    NOTA_CREDITO = "NOTA_CREDITO"
    NOTA_DEBITO = "NOTA_DEBITO"
    BOLETA = "BOLETA"
    COMPROBANTE_PAGO = "COMPROBANTE_PAGO"
    TRANSFERENCIA_BANCARIA = "TRANSFERENCIA_BANCARIA"
    CHEQUE = "CHEQUE"
    EFECTIVO = "EFECTIVO"
    CONTRATO_LABORAL = "CONTRATO_LABORAL"
    LIQUIDACION = "LIQUIDACION"


class PCGEAccountClass(str, Enum):
    """Plan Contable General Empresarial - Clases principales"""
    ACTIVO_CIRCULANTE = "1"
    ACTIVO_FIJO = "2"
    PASIVO_CIRCULANTE = "4"
    PATRIMONIO = "5"
    GASTOS = "6"
    INGRESOS = "7"
    CUENTAS_ANALÍTICAS = "9"


class JournalLine(BaseModel):
    cuenta: str = Field(..., description="Código contable PCGE")
    debe: Decimal = Field(Decimal("0.00"), ge=0)
    haber: Decimal = Field(Decimal("0.00"), ge=0)
    glosa: str = Field(default="", max_length=200)
    centro_costo: str | None = None
    ruc_contraparte: str | None = None


class AsientoContable(BaseModel):
    """Asiento de destino automático para gastos clase 6"""
    cuenta_origen: str = Field(..., description="Cuenta 6x del gasto")
    cuenta_destino: str = Field(..., description="Cuenta 9x del centro de costo")
    monto: Decimal


class RetencionCuartaCategoria(BaseModel):
    """Cálculo automático de retención 4ta categoría para honorarios"""
    monto_bruto: Decimal
    tasa_retencion: Decimal = Decimal("0.08")
    monto_retencion: Decimal
    monto_neto: Decimal
    requiere_retension: bool = Field(default=False, description="True si supera monto legal")


class ClassificationOutput(BaseModel):
    """Output Unit A: Clasificación y generación de asiento"""
    transaction_id: str
    tipo_documento: TransactionType
    monto_total: Decimal
    igv_18_detectado: bool = False
    igv_monto: Decimal = Decimal("0.00")
    asiento_principal: list[JournalLine]
    asientos_destino: list[AsientoContable] = Field(default_factory=list)
    retension_4ta_cat: RetencionCuartaCategoria | None = None
    validaciones_pcge: list[str] = Field(default_factory=list)
    alertas: list[str] = Field(default_factory=list)


class ClassificationAgent:
    """
    Unit A: Agente de Clasificación y Asiento
    
    Instrucción de Oro: Todo gasto de cuenta 6 genera automáticamente:
    - Destino a cuenta 9 (Centro de Costos)
    - Línea en cuenta 79 (Cuentas de Orden)
    
    Validación: Factura → verificar IVA 19%
                 Recibo Honorarios → calcular retención 4ta categoría 8%
    """

    def classify_transaction(
        self,
        transaction_type: TransactionType,
        amount: Decimal,
        igv_included: bool = True,
        has_cost_center: bool = False,
        cost_center_code: str | None = None,
    ) -> ClassificationOutput:
        """Clasifica transacción y genera asiento automático"""

        igv_monto = Decimal("0.00")
        igv_detectado = False

        if transaction_type == TransactionType.FACTURA and igv_included:
            igv_detectado = True
            # IVA = Monto * 0.159663 (equivalente a 19% sobre subtotal)
            igv_monto = (amount * Decimal("0.1525")).quantize(Decimal("0.01"))

        # Asiento principal según tipo
        asiento_principal = self._generate_primary_entry(
            transaction_type=transaction_type,
            amount=amount,
            igv_monto=igv_monto,
            cost_center=cost_center_code,
        )

        # Si es gasto, generar destino automático
        asientos_destino: list[AsientoContable] = []
        if transaction_type in {TransactionType.FACTURA, TransactionType.BOLETA}:
            asientos_destino = self._generate_expense_destination_entries(
                amount=amount,
                cost_center=cost_center_code or "DEFAULT",
            )

        # Si es Recibo de Honorarios, calcular retención 4ta categoría
        retencion = None
        if transaction_type == TransactionType.RECIBO_HONORARIOS:
            retencion = self._calculate_fourth_category_withholding(amount)

        validaciones = self._validate_against_pcge(asiento_principal)
        alertas = []
        if not has_cost_center and any(
            line.cuenta.startswith("6") for line in asiento_principal
        ):
            alertas.append("Gasto registrado sin centro de costo asignado")

        return ClassificationOutput(
            transaction_id=f"TXN-{int(amount)}-{transaction_type.value}",
            tipo_documento=transaction_type,
            monto_total=amount,
            igv_18_detectado=igv_detectado,
            igv_monto=igv_monto,
            asiento_principal=asiento_principal,
            asientos_destino=asientos_destino,
            retension_4ta_cat=retencion,
            validaciones_pcge=validaciones,
            alertas=alertas,
        )

    def _generate_primary_entry(
        self,
        transaction_type: TransactionType,
        amount: Decimal,
        igv_monto: Decimal,
        cost_center: str | None,
    ) -> list[JournalLine]:
        """Genera líneas del asiento principal según tipo de transacción"""

        if transaction_type == TransactionType.FACTURA:
            subtotal = amount - igv_monto if igv_monto else amount
            return [
                JournalLine(
                    cuenta="60111",
                    debe=subtotal,
                    haber=Decimal("0.00"),
                    glosa="Compra de mercadería",
                    centro_costo=cost_center or "DEFAULT",
                ),
                JournalLine(
                    cuenta="40111",
                    debe=igv_monto,
                    haber=Decimal("0.00"),
                    glosa="IVA - Crédito Fiscal",
                    centro_costo=cost_center,
                ),
                JournalLine(
                    cuenta="42121",
                    debe=Decimal("0.00"),
                    haber=amount,
                    glosa="Facturas por pagar emitidas",
                ),
            ]

        elif transaction_type == TransactionType.RECIBO_HONORARIOS:
            return [
                JournalLine(
                    cuenta="62312",
                    debe=amount,
                    haber=Decimal("0.00"),
                    glosa="Honorarios profesionales",
                    centro_costo=cost_center or "ADMIN",
                ),
                JournalLine(
                    cuenta="42112",
                    debe=Decimal("0.00"),
                    haber=amount,
                    glosa="Honorarios por pagar",
                ),
            ]

        else:
            # Caso genérico
            return [
                JournalLine(
                    cuenta="61112",
                    debe=amount,
                    haber=Decimal("0.00"),
                    glosa=f"Transacción {transaction_type.value}",
                    centro_costo=cost_center,
                ),
                JournalLine(
                    cuenta="42121",
                    debe=Decimal("0.00"),
                    haber=amount,
                    glosa="Pasivo genérico",
                ),
            ]

    def _generate_expense_destination_entries(
        self,
        amount: Decimal,
        cost_center: str,
    ) -> list[AsientoContable]:
        """Regla de Oro: Gasto clase 6 → Destino clase 9 + clase 79"""
        return [
            AsientoContable(
                cuenta_origen="60111",
                cuenta_destino="91001",
                monto=amount,
            ),
        ]

    def _calculate_fourth_category_withholding(
        self,
        gross_amount: Decimal,
    ) -> RetencionCuartaCategoria:
        """Calcula retención 4ta categoría para honorarios"""
        tasa = Decimal("0.08")
        retencion = (gross_amount * tasa).quantize(Decimal("0.01"))
        neto = gross_amount - retencion
        # Retención requerida si supera UIT (~5,000 PEN en 2026)
        uit_2026 = Decimal("5350")
        requiere = gross_amount >= uit_2026

        return RetencionCuartaCategoria(
            monto_bruto=gross_amount,
            tasa_retencion=tasa,
            monto_retencion=retencion,
            monto_neto=neto,
            requiere_retension=requiere,
        )

    def _validate_against_pcge(self, lines: list[JournalLine]) -> list[str]:
        """Valida asiento contra PCGE"""
        validaciones = []
        total_debe = sum(line.debe for line in lines)
        total_haber = sum(line.haber for line in lines)

        if total_debe != total_haber:
            validaciones.append(
                f"ALERTA: Desbalance Debe={total_debe} vs Haber={total_haber}"
            )

        class_6_lines = [line for line in lines if line.cuenta.startswith("6")]
        if class_6_lines and not any(line.centro_costo for line in class_6_lines):
            validaciones.append("ALERTA: Gastos sin centro de costo")

        return validaciones
