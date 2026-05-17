from __future__ import annotations

from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field


class TransactionClass(str, Enum):
    GASTO = "GASTO"
    COSTO = "COSTO"
    ACTIVO = "ACTIVO"
    PASIVO = "PASIVO"
    PATRIMONIO = "PATRIMONIO"


class ProcessingPhase(str, Enum):
    EXTRACCION = "EXTRACCION"
    CLASIFICACION = "CLASIFICACION"
    CUMPLIMIENTO = "CUMPLIMIENTO"
    EJECUCION = "EJECUCION"


class AccountingLineModel(BaseModel):
    account_code: str = Field(min_length=1, max_length=20)
    debit: Decimal = Decimal("0.00")
    credit: Decimal = Decimal("0.00")
    cost_center: str | None = None


class ComplianceCheckModel(BaseModel):
    is_valid_document: bool = True
    sunat_status: str | None = None
    uses_banking_means: bool | None = None
    deductible_for_income_tax: bool | None = None


class ExpertAccountingOutput(BaseModel):
    phase: ProcessingPhase
    transaction_class: TransactionClass
    summary: str
    lines: list[AccountingLineModel] = Field(default_factory=list)
    compliance: ComplianceCheckModel = Field(default_factory=ComplianceCheckModel)
    alerts: list[str] = Field(default_factory=list)


class ValidationCheck(BaseModel):
    code: str
    passed: bool
    detail: str


class ValidationReport(BaseModel):
    accepted: bool
    checks: list[ValidationCheck]
    blocking_reasons: list[str] = Field(default_factory=list)
