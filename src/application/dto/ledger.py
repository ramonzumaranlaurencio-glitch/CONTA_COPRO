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
    doc_type: str = "01"
    serie: str
    number: str
    entry_date: date | None = None
    due_date: date | None = None
    subtotal: Decimal
    igv: Decimal
    total: Decimal
    line_items: list[InvoiceLineItemRequest] = Field(default_factory=list)
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
