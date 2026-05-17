from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field


class JournalLineRequest(BaseModel):
    account_code: str = Field(min_length=1, max_length=20)
    account_name: str | None = None
    debit: Decimal = Decimal("0.00")
    credit: Decimal = Decimal("0.00")
    cost_center: str | None = None
    project_code: str | None = None
    partner_ruc: str | None = None
    document_type: str | None = None
    document_series: str | None = None
    document_number: str | None = None


class InvoiceLineItemRequest(BaseModel):
    product_code: str = ""
    description: str = ""
    unit: str = "UND"
    quantity: Decimal = Decimal("0.00")
    unit_price: Decimal = Decimal("0.00")
    line_subtotal: Decimal = Decimal("0.00")


class PurchaseLineItemRequest(BaseModel):
    # Campos base del item/documento
    product_code: str = ""
    code: str = ""
    description: str = ""
    unit: str = "UND"
    quantity: Decimal = Decimal("0.00")
    unit_price: Decimal = Decimal("0.00")
    line_subtotal: Decimal = Decimal("0.00")

    # Clasificación contable inteligente
    account_code: str = ""
    account_name: str = ""
    cost_center: str | None = None
    tax_treatment: str | None = None
    ai_reason: str | None = None
    ai_confidence: Decimal | None = None
    requires_review: bool = False


class PurchaseAccountLineRequest(BaseModel):
    account_code: str = Field(min_length=1, max_length=20)
    account_name: str | None = None
    cost_center: str | None = None
    debit: Decimal = Decimal("0.00")
    credit: Decimal = Decimal("0.00")
    line_type: str = "EXPENSE_OR_ASSET"
    tax_treatment: str | None = None


class PurchaseAccountUpsertRequest(BaseModel):
    accountCode: str | None = None
    accountName: str | None = None
    accountClass: str | None = None
    nature: str | None = None
    taxTreatment: str | None = None
    requiresReview: bool = False

    # Versiones snake_case por compatibilidad backend
    account_code: str | None = None
    account_name: str | None = None
    account_class: str | None = None
    tax_treatment: str | None = None
    requires_review: bool = False


class PurchaseCostCenterUpsertRequest(BaseModel):
    code: str
    name: str | None = None
    source: str | None = None


class PurchaseAuditMetadataRequest(BaseModel):
    source: str | None = None
    engine: str | None = None
    supplierName: str | None = None
    issueDate: str | None = None
    warnings: list[str] = Field(default_factory=list)

    # Versiones snake_case por compatibilidad backend
    supplier_name: str | None = None
    issue_date: str | None = None


class JournalPostRequest(BaseModel):
    tenant_id: str
    company_id: str | None = None
    year: int
    month: int
    entry_date: date | None = None
    description: str
    source_module: str = "ACCOUNTING"
    source_id: str | None = None
    currency: str = "PEN"
    lines: list[JournalLineRequest] = Field(min_length=2)
    user_id: str | None = None
    trace_id: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None


class InvoicePostRequest(BaseModel):
    tenant_id: str
    company_id: str | None = None
    year: int
    month: int
    invoice_id: str
    customer_ruc: str | None = None
    doc_type: str = "01"
    serie: str
    number: str
    entry_date: date | None = None
    due_date: date | None = None
    subtotal: Decimal
    igv: Decimal
    total: Decimal
    line_items: list[InvoiceLineItemRequest] = Field(default_factory=list)
    currency: str = "PEN"
    exchange_rate: Decimal | None = None
    detraccion_amount: Decimal = Decimal("0.00")
    percepcion_amount: Decimal = Decimal("0.00")
    retencion_amount: Decimal = Decimal("0.00")
    cost_center: str | None = None
    xml_raw: str | None = None
    xml_hash: str | None = None
    sunat_validation: dict | None = None
    user_id: str | None = None
    trace_id: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None


class PurchasePostRequest(BaseModel):
    tenant_id: str
    company_id: str | None = None
    year: int
    month: int
    purchase_id: str
    supplier_ruc: str | None = None
    supplier_name: str | None = None
    doc_type: str = "01"
    serie: str
    number: str
    entry_date: date | None = None
    issue_date: date | None = None
    due_date: date | None = None
    subtotal: Decimal
    igv: Decimal
    total: Decimal

    # Compatibilidad con versión anterior
    line_items: list[PurchaseLineItemRequest] = Field(default_factory=list)

    # Nuevo payload inteligente desde PurchaseFormEnterprise
    items: list[PurchaseLineItemRequest] = Field(default_factory=list)
    account_lines: list[PurchaseAccountLineRequest] = Field(default_factory=list)
    accounts_to_upsert: list[PurchaseAccountUpsertRequest] = Field(default_factory=list)
    cost_centers_to_upsert: list[PurchaseCostCenterUpsertRequest] = Field(default_factory=list)
    audit_metadata: PurchaseAuditMetadataRequest | None = None

    detraccion_amount: Decimal = Decimal("0.00")
    percepcion_amount: Decimal = Decimal("0.00")
    retencion_amount: Decimal = Decimal("0.00")
    currency: str = "PEN"
    exchange_rate: Decimal | None = None
    expense_account: str = "6011"
    cost_center: str | None = None
    sunat_validation: dict | None = None
    user_id: str | None = None
    trace_id: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None


class JournalEntryResponse(BaseModel):
    id: str
    row_hash: str
    previous_hash: str
    total_debit: str
    total_credit: str


class JournalEntryListItem(BaseModel):
    id: str
    entry_date: str
    period: str
    description: str
    source_module: str
    currency: str
    total_debit: str
    total_credit: str
    row_hash: str
    previous_hash: str
    sunat_status: str = "PENDING"


class ReportQuery(BaseModel):
    year: int
    month: int | None = None
    company_id: str | None = None

# --- FIX COMPATIBILIDAD LEDGER ENGINE ---
from typing import Any
from pydantic import BaseModel, Field


class LedgerEngineHeader(BaseModel):
    operacion_id: str = ""
    modulo: str = ""
    tipo_transaccion: str = ""
    moneda: str = "PEN"


class LedgerEngineAccountingLogic(BaseModel):
    entries: list[dict[str, Any]] = Field(default_factory=list)
    summary: dict[str, Any] = Field(default_factory=dict)


class LedgerEngineComplianceCheck(BaseModel):
    checks: list[dict[str, Any]] = Field(default_factory=list)
    status: str = "OK"


class LedgerEngineActionRequired(BaseModel):
    actions: list[str] = Field(default_factory=list)
    requires_review: bool = False


class LedgerEngineOutput(BaseModel):
    header: LedgerEngineHeader = Field(default_factory=LedgerEngineHeader)
    accounting_logic: LedgerEngineAccountingLogic = Field(default_factory=LedgerEngineAccountingLogic)
    compliance_check: LedgerEngineComplianceCheck = Field(default_factory=LedgerEngineComplianceCheck)
    action_required: LedgerEngineActionRequired = Field(default_factory=LedgerEngineActionRequired)
    bloquea_persistencia: bool = False
    razon_bloqueo: str | None = None

# --- FIN FIX COMPATIBILIDAD LEDGER ENGINE ---

# --- FIX COMPATIBILIDAD MODELOS LEDGER ENGINE ---
from typing import Any
from pydantic import BaseModel, Field


class HeaderModel(BaseModel):
    operacion_id: str = ""
    modulo: str = ""
    tipo_transaccion: str = ""
    moneda: str = "PEN"
    metadata: dict[str, Any] = Field(default_factory=dict)


class AccountingLogicModel(BaseModel):
    entries: list[dict[str, Any]] = Field(default_factory=list)
    summary: dict[str, Any] = Field(default_factory=dict)
    journal_lines: list[dict[str, Any]] = Field(default_factory=list)


class ComplianceCheckModel(BaseModel):
    checks: list[dict[str, Any]] = Field(default_factory=list)
    status: str = "OK"
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class ActionRequiredModel(BaseModel):
    actions: list[str] = Field(default_factory=list)
    requires_review: bool = False
    requires_approval: bool = False


class LedgerEngineOutput(BaseModel):
    header: HeaderModel = Field(default_factory=HeaderModel)
    accounting_logic: AccountingLogicModel = Field(default_factory=AccountingLogicModel)
    compliance_check: ComplianceCheckModel = Field(default_factory=ComplianceCheckModel)
    action_required: ActionRequiredModel = Field(default_factory=ActionRequiredModel)
    bloquea_persistencia: bool = False
    razon_bloqueo: str | None = None

# --- FIN FIX COMPATIBILIDAD MODELOS LEDGER ENGINE ---

# --- FIX COMPATIBILIDAD BANCARIZACION / SUNAT / TRIBUTARIO ---
from typing import Any
from pydantic import BaseModel, Field


class BancarizacionModel(BaseModel):
    aplica: bool = False
    obligado: bool = False
    monto_minimo_superado: bool = False
    medio_pago: str | None = None
    estado: str = "OK"
    observaciones: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class DetraccionModel(BaseModel):
    aplica: bool = False
    porcentaje: float | None = None
    monto: float | None = None
    codigo_servicio: str | None = None
    estado: str = "NO_APLICA"
    observaciones: list[str] = Field(default_factory=list)


class RetencionModel(BaseModel):
    aplica: bool = False
    porcentaje: float | None = None
    monto: float | None = None
    estado: str = "NO_APLICA"
    observaciones: list[str] = Field(default_factory=list)


class PercepcionModel(BaseModel):
    aplica: bool = False
    porcentaje: float | None = None
    monto: float | None = None
    estado: str = "NO_APLICA"
    observaciones: list[str] = Field(default_factory=list)


class SunatValidationModel(BaseModel):
    validado: bool = False
    estado: str = "PENDIENTE"
    cdr_status: str | None = None
    observaciones: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TaxTreatmentModel(BaseModel):
    tratamiento: str = ""
    igv_credito_fiscal: bool = False
    gasto_deducible: bool = False
    requiere_revision: bool = False
    fundamento: str | None = None
    observaciones: list[str] = Field(default_factory=list)


class ComplianceRuleModel(BaseModel):
    codigo: str = ""
    descripcion: str = ""
    estado: str = "OK"
    bloqueante: bool = False
    observaciones: list[str] = Field(default_factory=list)


class RiskModel(BaseModel):
    nivel: str = "BAJO"
    razones: list[str] = Field(default_factory=list)
    score: float = 0.0


# --- FIN FIX COMPATIBILIDAD BANCARIZACION / SUNAT / TRIBUTARIO ---


# --- FIX AUTOMATICO COMPATIBILIDAD LEDGER ENGINE ---
from typing import Any
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict


class _CompatLedgerEngineModel(BaseModel):
    model_config = ConfigDict(extra="allow", arbitrary_types_allowed=True)

    id: str | None = None
    codigo: str | None = None
    nombre: str | None = None
    descripcion: str | None = None
    glosa: str | None = None

    account_code: str | None = None
    account_name: str | None = None
    cuenta: str | None = None
    cuenta_nombre: str | None = None

    debit: Decimal = Decimal("0.00")
    credit: Decimal = Decimal("0.00")
    debe: Decimal = Decimal("0.00")
    haber: Decimal = Decimal("0.00")
    monto: Decimal = Decimal("0.00")
    importe: Decimal = Decimal("0.00")

    cost_center: str | None = None
    centro_costo: str | None = None
    project_code: str | None = None

    estado: str = "OK"
    status: str = "OK"
    aplica: bool = False
    bloqueante: bool = False
    requiere_revision: bool = False

    observaciones: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)



class LineaAsientoModel(_CompatLedgerEngineModel):
    pass


class build_ledger_engine_output(_CompatLedgerEngineModel):
    pass


# --- FIN FIX AUTOMATICO COMPATIBILIDAD LEDGER ENGINE ---
