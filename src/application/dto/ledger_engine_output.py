"""
The Ledger Engine - Structured JSON Output Contract
JSON Pro: Header + Accounting Logic + Compliance Check + Action Required
"""

from __future__ import annotations

from decimal import Decimal
from datetime import datetime

from pydantic import BaseModel, Field


class HeaderModel(BaseModel):
    """Metadata del asiento procesado"""
    operacion_id: str = Field(..., description="ID único de la operación")
    tipo_documento: str = Field(..., description="Tipo: Factura, Recibo, Transferencia, etc")
    entidad: str = Field(..., description="SUNAT, Bancos, MTPE, etc")
    fecha_procesamiento: datetime = Field(default_factory=datetime.utcnow)
    version_pcge: str = "Actualizado 2026"


class LineaAsientoModel(BaseModel):
    """Línea individual del asiento contable"""
    cuenta: str = Field(..., description="Código contable PCGE")
    debe: Decimal = Field(Decimal("0.00"), ge=0)
    haber: Decimal = Field(Decimal("0.00"), ge=0)
    glosa: str = Field(default="")
    centro_costo: str | None = None


class AsientoDestinoModel(BaseModel):
    """Asiento de destino automático (Regla de Oro: Gasto clase 6 → Clase 9/79)"""
    cuenta: str
    debe: Decimal = Decimal("0.00")
    haber: Decimal = Decimal("0.00")


class AccountingLogicModel(BaseModel):
    """Unit A Output: Asientos contables principales y destinos"""
    asiento_diario: list[LineaAsientoModel] = Field(
        ..., description="Asiento principal con Debe/Haber balanceado"
    )
    asiento_destino: list[AsientoDestinoModel] = Field(
        default_factory=list, description="Destino automático si es gasto clase 6"
    )
    retension_4ta_categoria: Decimal | None = Field(
        None, description="Retención 8% si es Recibo Honorarios y supera UIT"
    )
    validaciones_pcge: list[str] = Field(
        default_factory=list, description="Checks contra Plan Contable"
    )


class BancarizacionModel(BaseModel):
    """Detalle de validación de bancarización"""
    requerida: bool
    monto_limite_pen: Decimal = Decimal("2000")
    monto_limite_usd: Decimal = Decimal("500")
    monto_actual: Decimal
    medio_pago_validado: bool


class ComplianceCheckModel(BaseModel):
    """Unit B Output: Auditoría legal, tributaria y laboral"""
    bancarizacion_requerida: bool = Field(
        ..., description="Si monto >2000 PEN o >500 USD, requiere validación"
    )
    bancarizacion_validada: BancarizacionModel | None = None
    causalidad_cumplida: bool = Field(
        ..., description="Cumple Principio de Causalidad (TUO LIR Art. 37)"
    )
    detraccion_aplica: bool
    detraccion_tasa: Decimal = Decimal("0.00")
    detraccion_monto: Decimal = Decimal("0.00")
    alerta_legal: str = Field(default="Ninguna. Cumple normativa.")
    bloqueante: bool = Field(False, description="True si BLOQUEA el asiento")


class ActionRequiredModel(BaseModel):
    """Acciones automáticas o manuales requeridas"""
    notificar_tesoreria: str | None = Field(
        None, description="Ej: 'Programar pago para 2026-05-30'"
    )
    generar_carta_descargo: bool = Field(
        False, description="Requiere respuesta a requerimiento"
    )
    requerimiento_tipo: str | None = Field(
        None, description="SUNAT, MTPE, etc"
    )
    fecha_vencimiento_respuesta: datetime | None = None
    registro_sunat_listo: bool = Field(
        False, description="Listo para PLE/SIRE si aplica"
    )


class LedgerEngineOutput(BaseModel):
    """
    The Ledger Engine Output:
    Flujo completo de validación legal y contable antes de persistir
    """
    header: HeaderModel
    accounting_logic: AccountingLogicModel
    compliance_check: ComplianceCheckModel
    action_required: ActionRequiredModel
    bloquea_persistencia: bool = Field(
        False, description="True si hay bloqueante - requiere intervención humana"
    )
    razon_bloqueo: str | None = None


def build_ledger_engine_output(
    operacion_id: str,
    tipo_documento: str,
    entidad: str,
    accounting: AccountingLogicModel,
    compliance: ComplianceCheckModel,
    action_required: ActionRequiredModel,
) -> LedgerEngineOutput:
    """Factory para crear output completo del Ledger Engine"""
    return LedgerEngineOutput(
        header=HeaderModel(
            operacion_id=operacion_id,
            tipo_documento=tipo_documento,
            entidad=entidad,
        ),
        accounting_logic=accounting,
        compliance_check=compliance,
        action_required=action_required,
        bloquea_persistencia=compliance.bloqueante,
        razon_bloqueo=(
            compliance.alerta_legal if compliance.bloqueante else None
        ),
    )
