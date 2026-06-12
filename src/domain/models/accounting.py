from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4
from sqlalchemy import CHAR, Computed, Date, DateTime, ForeignKey, Numeric, String, Text, Boolean, Integer, CheckConstraint, UniqueConstraint, event
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    legal_name: Mapped[str] = mapped_column(Text, nullable=False)
    ruc: Mapped[str] = mapped_column(String(11), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (UniqueConstraint("tenant_id", "ruc", name="uq_company_tenant_ruc"),)
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    legal_name: Mapped[str] = mapped_column(Text, nullable=False)
    trade_name: Mapped[str | None] = mapped_column(Text)
    ruc: Mapped[str] = mapped_column(String(11), nullable=False)
    base_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="COP")
    sunat_environment: Mapped[str] = mapped_column(String(20), nullable=False, default="BETA")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class ChartAccount(Base):
    __tablename__ = "chart_accounts"
    __table_args__ = (UniqueConstraint("tenant_id", "company_id", "code", name="uq_chart_account_company_code"),)
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    account_class: Mapped[str] = mapped_column(String(2), nullable=False)
    statement: Mapped[str] = mapped_column(String(40), nullable=False)
    nature: Mapped[str] = mapped_column(String(10), nullable=False)
    accepts_cost_center: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    accepts_partner: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class CostCenter(Base):
    __tablename__ = "cost_centers"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_cost_center_tenant_code"),)
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    code: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    parent_code: Mapped[str | None] = mapped_column(String(80))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class CurrencyRate(Base):
    __tablename__ = "currency_rates"
    __table_args__ = (UniqueConstraint("tenant_id", "rate_date", "from_currency", "to_currency", name="uq_currency_rate"),)
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    rate_date: Mapped[date] = mapped_column(Date, nullable=False)
    from_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    to_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="COP")
    buy_rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    sell_rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="DIAN")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class BusinessPartner(Base):
    __tablename__ = "business_partners"
    __table_args__ = (UniqueConstraint("tenant_id", "document_type", "document_number", name="uq_partner_document"),)
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    partner_type: Mapped[str] = mapped_column(String(20), nullable=False)
    document_type: Mapped[str] = mapped_column(String(4), nullable=False, default="6")
    document_number: Mapped[str] = mapped_column(String(20), nullable=False)
    legal_name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    risk_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="ACCOUNTANT")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class OAuthClient(Base):
    __tablename__ = "oauth_clients"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    client_id: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    redirect_uri: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replaced_by_token_hash: Mapped[str | None] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class AccountingPeriod(Base):
    __tablename__ = "accounting_periods"
    __table_args__ = (UniqueConstraint("tenant_id", "year", "month", name="uq_period_tenant_year_month"),)
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="OPEN")
    is_closed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_by: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (CheckConstraint("total_debit = total_credit", name="ck_entry_balanced"),)
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    period_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("accounting_periods.id"), nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    source_module: Mapped[str] = mapped_column(String(40), nullable=False, default="ACCOUNTING")
    source_id: Mapped[str | None] = mapped_column(Text)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="COP")
    total_debit: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    total_credit: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    tipo_cambio: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("1.0000"))
    estado_asiento: Mapped[str] = mapped_column(String(20), nullable=False, default="VALIDADO")
    validar_status: Mapped[str] = mapped_column(String(30), nullable=False, default="OK")
    tipo_asiento_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    asiento_num: Mapped[str | None] = mapped_column(String(24))
    previous_hash: Mapped[str] = mapped_column(Text, nullable=False)
    row_hash: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="POSTED")
    created_by: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    lines: Mapped[list["JournalLine"]] = relationship(back_populates="entry", cascade="all, delete-orphan", lazy="selectin")

class JournalLine(Base):
    __tablename__ = "journal_lines"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    entry_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id"), nullable=False)
    linea_idx: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    account_code: Mapped[str] = mapped_column(String(20), nullable=False)
    account_name: Mapped[str | None] = mapped_column(Text)
    debit: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    credit: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    tipo_cambio: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("1.0000"))
    debe_mn: Mapped[Decimal] = mapped_column(Numeric(18, 4), Computed("debit * tipo_cambio", persisted=True))
    haber_mn: Mapped[Decimal] = mapped_column(Numeric(18, 4), Computed("credit * tipo_cambio", persisted=True))
    periodo_fiscal: Mapped[str] = mapped_column(String(7), nullable=False)
    modulo_origen: Mapped[str] = mapped_column(String(20), nullable=False)
    cost_center: Mapped[str | None] = mapped_column(String(80))
    project_code: Mapped[str | None] = mapped_column(String(80))
    partner_ruc: Mapped[str | None] = mapped_column(String(11))
    document_type: Mapped[str | None] = mapped_column(String(4))
    document_series: Mapped[str | None] = mapped_column(String(10))
    document_number: Mapped[str | None] = mapped_column(String(30))
    comp_tipo: Mapped[str | None] = mapped_column(CHAR(2))
    comp_fecha_emision: Mapped[date | None] = mapped_column(Date)
    comp_fecha_vencimiento: Mapped[date | None] = mapped_column(Date)
    tercero_tipo_doc: Mapped[str | None] = mapped_column(CHAR(1))
    tercero_num: Mapped[str | None] = mapped_column(String(15))
    tercero_razon_social: Mapped[str | None] = mapped_column(String(255))
    estado_asiento: Mapped[str] = mapped_column(String(20), nullable=False, default="VALIDADO")
    validar_status: Mapped[str] = mapped_column(String(30), nullable=False, default="OK")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    entry: Mapped[JournalEntry] = relationship(back_populates="lines")


@event.listens_for(JournalLine, "before_insert")
def _journal_line_fill_derived(mapper, connection, target: "JournalLine") -> None:
    """Auto-fill F2 derived fields from the parent JournalEntry so existing
    callers (LedgerPostingService, payroll) don't need to be changed.
    """
    parent = getattr(target, "entry", None)
    if parent is not None:
        if not target.periodo_fiscal and getattr(parent, "entry_date", None) is not None:
            target.periodo_fiscal = parent.entry_date.strftime("%Y-%m")
        if not target.modulo_origen and getattr(parent, "source_module", None):
            target.modulo_origen = parent.source_module
        if not target.linea_idx:
            sibling_lines = list(getattr(parent, "lines", None) or [])
            try:
                target.linea_idx = sibling_lines.index(target) + 1
            except ValueError:
                target.linea_idx = len(sibling_lines) + 1 if sibling_lines else 1

    if not target.linea_idx:
        target.linea_idx = 1
    if target.tipo_cambio is None:
        target.tipo_cambio = Decimal("1.0000")
    if not target.estado_asiento:
        target.estado_asiento = "VALIDADO"
    if not target.validar_status:
        target.validar_status = "OK"

    if not target.tercero_num and target.partner_ruc:
        target.tercero_num = target.partner_ruc
        if not target.tercero_tipo_doc:
            length = len(target.partner_ruc)
            if length == 11:
                target.tercero_tipo_doc = "6"
            elif length == 8:
                target.tercero_tipo_doc = "1"

    if not target.comp_tipo and target.document_type:
        target.comp_tipo = target.document_type[:2]


@event.listens_for(JournalEntry, "before_insert")
def _journal_entry_fill_derived(mapper, connection, target: "JournalEntry") -> None:
    if target.tipo_cambio is None:
        target.tipo_cambio = Decimal("1.0000")
    if not target.estado_asiento:
        target.estado_asiento = "VALIDADO"
    if not target.validar_status:
        target.validar_status = "OK"
    if not target.tipo_asiento_id:
        target.tipo_asiento_id = 1

class FinancialDocument(Base):
    __tablename__ = "financial_documents"
    __table_args__ = (UniqueConstraint("tenant_id", "document_type", "series", "number", "direction", name="uq_financial_document"),)
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    partner_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    document_type: Mapped[str] = mapped_column(String(4), nullable=False)
    series: Mapped[str] = mapped_column(String(10), nullable=False)
    number: Mapped[str] = mapped_column(String(30), nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="COP")
    exchange_rate: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    exempt_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    balance_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    retefuente_amount: Mapped[Decimal] = mapped_column("detraccion_amount", Numeric(18, 2), nullable=False, default=0)
    reteiva_amount: Mapped[Decimal] = mapped_column("percepcion_amount", Numeric(18, 2), nullable=False, default=0)
    retencion_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    journal_entry_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    sunat_status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    cdr_status: Mapped[str | None] = mapped_column(String(20))
    cdr_description: Mapped[str | None] = mapped_column(Text)
    xml_hash: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    @property
    def dian_status(self) -> str:
        return self.sunat_status

    @dian_status.setter
    def dian_status(self, value: str) -> None:
        self.sunat_status = value

class TreasuryAccount(Base):
    __tablename__ = "treasury_accounts"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    bank_code: Mapped[str] = mapped_column(String(20), nullable=False)
    account_number: Mapped[str] = mapped_column(String(40), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="COP")
    ledger_account_code: Mapped[str] = mapped_column(String(20), nullable=False)
    current_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class TreasuryMovement(Base):
    __tablename__ = "treasury_movements"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    treasury_account_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    movement_date: Mapped[date] = mapped_column(Date, nullable=False)
    movement_type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="COP")
    reference: Mapped[str | None] = mapped_column(Text)
    partner_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    financial_document_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    journal_entry_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    reconciliation_status: Mapped[str] = mapped_column(String(20), nullable=False, default="OPEN")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class FixedAsset(Base):
    __tablename__ = "fixed_assets"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    asset_class: Mapped[str] = mapped_column(String(40), nullable=False)
    acquisition_date: Mapped[date] = mapped_column(Date, nullable=False)
    acquisition_cost: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    residual_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    useful_life_months: Mapped[int] = mapped_column(Integer, nullable=False)
    depreciation_method: Mapped[str] = mapped_column(String(30), nullable=False, default="STRAIGHT_LINE")
    accumulated_depreciation: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    ledger_asset_account: Mapped[str] = mapped_column(String(20), nullable=False, default="33")
    ledger_depreciation_account: Mapped[str] = mapped_column(String(20), nullable=False, default="391")
    ledger_expense_account: Mapped[str] = mapped_column(String(20), nullable=False, default="681")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class DepreciationRun(Base):
    __tablename__ = "depreciation_runs"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    journal_entry_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="POSTED")
    created_by: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class Provision(Base):
    __tablename__ = "provisions"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    provision_type: Mapped[str] = mapped_column(String(40), nullable=False)
    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    debit_account: Mapped[str] = mapped_column(String(20), nullable=False)
    credit_account: Mapped[str] = mapped_column(String(20), nullable=False)
    journal_entry_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="POSTED")
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class AnnualClosingRun(Base):
    __tablename__ = "annual_closing_runs"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    class_8_9_result: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    generated_entries: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    audit_summary: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_by: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class TaxDetermination(Base):
    __tablename__ = "tax_determinations"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    sales_base: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    purchase_base: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    output_iva: Mapped[Decimal] = mapped_column("output_igv", Numeric(18, 2), nullable=False, default=0)
    input_iva: Mapped[Decimal] = mapped_column("input_igv", Numeric(18, 2), nullable=False, default=0)
    iva_payable: Mapped[Decimal] = mapped_column("igv_payable", Numeric(18, 2), nullable=False, default=0)
    retefuente: Mapped[Decimal] = mapped_column("detracciones", Numeric(18, 2), nullable=False, default=0)
    reteiva: Mapped[Decimal] = mapped_column("percepciones", Numeric(18, 2), nullable=False, default=0)
    retenciones: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="CALCULATED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class DianSubmission(Base):
    __tablename__ = "dian_submissions"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    financial_document_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    submission_type: Mapped[str] = mapped_column(String(30), nullable=False)
    endpoint_type: Mapped[str] = mapped_column(String(20), nullable=False, default="DIAN")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    ticket: Mapped[str | None] = mapped_column(Text)
    xml_hash: Mapped[str | None] = mapped_column(Text)
    cud_code: Mapped[str | None] = mapped_column(Text)
    response_description: Mapped[str | None] = mapped_column(Text)
    raw_response: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


# Alias para compatibilidad con código legado
SunatSubmission = DianSubmission

class IntegrationConnector(Base):
    __tablename__ = "integration_connectors"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    connector_type: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="CONFIG_REQUIRED")
    base_url: Mapped[str | None] = mapped_column(Text)
    secret_ref: Mapped[str | None] = mapped_column(Text)
    capabilities: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    last_healthcheck_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class IntegrationMessage(Base):
    __tablename__ = "integration_messages"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    connector_provider: Mapped[str] = mapped_column(String(40), nullable=False)
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    trace_id: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    before_state: Mapped[dict | None] = mapped_column(JSONB)
    after_state: Mapped[dict | None] = mapped_column(JSONB)
    actor_user_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class OutboxEvent(Base):
    __tablename__ = "outbox_events"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    aggregate_type: Mapped[str] = mapped_column(Text, nullable=False)
    aggregate_id: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

class DeadLetterEvent(Base):
    __tablename__ = "dead_letter_events"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    source_event_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    aggregate_id: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    ai_diagnosis: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class IntegrityAlert(Base):
    __tablename__ = "integrity_alerts"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    entry_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    expected_hash: Mapped[str | None] = mapped_column(Text)
    actual_hash: Mapped[str | None] = mapped_column(Text)
    trace_id: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class AccountingEmbedding(Base):
    __tablename__ = "accounting_embeddings"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class HrWorker(Base):
    """Empleado — Colombia (CST / Ley 100/1993 / Decreto 1072/2015)."""
    __tablename__ = "hr_workers"
    __table_args__ = (UniqueConstraint("tenant_id", "dni", name="uq_hr_worker_dni"),)
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    worker_code: Mapped[str] = mapped_column(String(40), nullable=False)
    nombres: Mapped[str] = mapped_column(Text, nullable=False)
    apellidos: Mapped[str] = mapped_column(Text, nullable=False)
    # dni = Cédula de Ciudadanía Colombia (5-12 dígitos)
    dni: Mapped[str] = mapped_column(String(12), nullable=False)
    fecha_nacimiento: Mapped[date | None] = mapped_column(Date)
    fecha_inicio_contrato: Mapped[date | None] = mapped_column(Date)
    fecha_fin_contrato: Mapped[date | None] = mapped_column(Date)
    direccion_domicilio: Mapped[str | None] = mapped_column(Text)
    # direccion_reniec → reutilizado como departamento/ciudad Colombia
    direccion_reniec: Mapped[str | None] = mapped_column(Text)
    telefono: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(Text)
    profesion: Mapped[str | None] = mapped_column(Text)
    experiencia: Mapped[str | None] = mapped_column(Text)
    estudios_realizados: Mapped[str | None] = mapped_column(Text)
    cargo_postulado: Mapped[str] = mapped_column(Text, nullable=False)
    sueldo_pactado: Mapped[Decimal] = mapped_column(Numeric(18, 0), nullable=False, default=0)  # COP sin centavos
    # pension_system: AFP_PORVENIR | AFP_PROTECCION | AFP_COLFONDOS | AFP_OLD_MUTUAL | RPM_COLPENSIONES
    pension_system: Mapped[str | None] = mapped_column(Text)
    # Campos colombianos adicionales — almacenados en cv_metadata JSONB
    habilidades_clave: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    cv_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    compliance_status: Mapped[str] = mapped_column(String(20), nullable=False, default="REVIEW")
    created_by: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Propiedades calculadas para el motor de nómina
    @property
    def tipo_salario(self) -> str:
        meta = self.cv_metadata or {}
        return str(meta.get("tipo_salario", "ORDINARIO"))

    @property
    def clase_riesgo_arl(self) -> str:
        meta = self.cv_metadata or {}
        return str(meta.get("clase_riesgo_arl", "I"))


class HrContract(Base):
    __tablename__ = "hr_contracts"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    worker_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    contract_type: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="DRAFT")
    legal_basis: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    contract_text: Mapped[str] = mapped_column(Text, nullable=False)
    pdf_base64: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


# ─── Modelos de Nómina Colombia ───────────────────────────────────────────────

class PayrollJournalEntry(Base):
    """Asiento contable de nómina Colombia — PUC Decreto 2649/1993"""
    __tablename__ = "payroll_journal_entries"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    fecha_asiento: Mapped[date] = mapped_column(Date, nullable=False)
    glosa: Mapped[str] = mapped_column(Text, nullable=False)
    total_debe: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    total_haber: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    tipo_asiento: Mapped[str] = mapped_column(String(40), nullable=False, default="NOMINA_COLOMBIA")
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="POSTED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    lines: Mapped[list["PayrollJournalLine"]] = relationship(back_populates="entry", cascade="all, delete-orphan")


class PayrollJournalLine(Base):
    """Línea de asiento nómina — débito/crédito por cuenta PUC"""
    __tablename__ = "payroll_journal_lines"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    asiento_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_journal_entries.id"), nullable=False)
    cuenta_contable: Mapped[str] = mapped_column(String(20), nullable=False)
    denominacion: Mapped[str | None] = mapped_column(Text)
    monto: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    tipo_movimiento: Mapped[str] = mapped_column(CHAR(1), nullable=False)  # D=Débito H=Haber
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    entry: Mapped["PayrollJournalEntry"] = relationship(back_populates="lines")


class PayrollProvision(Base):
    """Provisiones de prestaciones sociales Colombia — CST Arts. 249, 306; Ley 50/1990"""
    __tablename__ = "payroll_provisions"
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    company_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True))
    trabajador_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    periodo_mes: Mapped[str] = mapped_column(String(7), nullable=False)   # YYYY-MM
    monto_cts: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)         # Cesantías 8.33%
    monto_gratificacion: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)  # Prima 8.33%
    monto_vacaciones: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)  # Vacaciones 4.17%
    estado_pago: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDIENTE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
