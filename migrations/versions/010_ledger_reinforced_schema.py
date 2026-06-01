"""Reinforced ledger schema: NUMERIC(18,4), tipo_cambio, debe_mn/haber_mn,
comprobante fields, tercero fields, validator state, composite indexes.

Implements F2 of the Enterprise Ledger Platform spec.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "010_ledger_reinforced_schema"
down_revision = "009_payroll_planilla_link"
branch_labels = None
depends_on = None


def upgrade():
    # ---- journal_entries: precision + validator + tipo_cambio ----
    op.execute("ALTER TABLE journal_entries ALTER COLUMN total_debit TYPE NUMERIC(18, 4)")
    op.execute("ALTER TABLE journal_entries ALTER COLUMN total_credit TYPE NUMERIC(18, 4)")

    op.add_column(
        "journal_entries",
        sa.Column("tipo_cambio", sa.Numeric(6, 4), nullable=False, server_default=sa.text("1.0000")),
    )
    op.add_column(
        "journal_entries",
        sa.Column("estado_asiento", sa.String(20), nullable=False, server_default=sa.text("'VALIDADO'")),
    )
    op.add_column(
        "journal_entries",
        sa.Column("validar_status", sa.String(30), nullable=False, server_default=sa.text("'OK'")),
    )
    op.add_column(
        "journal_entries",
        sa.Column("tipo_asiento_id", sa.Integer, nullable=False, server_default=sa.text("1")),
    )
    op.add_column(
        "journal_entries",
        sa.Column("asiento_num", sa.String(24), nullable=True),
    )

    # Temporarily disable immutability triggers so the backfill UPDATEs can run.
    # We only UPDATE freshly-added columns; hash chain stays untouched.
    op.execute("ALTER TABLE journal_entries DISABLE TRIGGER trg_no_update_journal_entries")
    op.execute("ALTER TABLE journal_lines  DISABLE TRIGGER trg_no_update_journal_lines")

    # Backfill asiento_num for historical entries using a deterministic correlative.
    op.execute(
        """
        WITH numbered AS (
            SELECT id,
                   to_char(entry_date, 'YYYY-MM') AS yyyymm,
                   ROW_NUMBER() OVER (
                       PARTITION BY tenant_id, to_char(entry_date, 'YYYY-MM')
                       ORDER BY entry_date, created_at, id
                   ) AS rn,
                   source_module
            FROM journal_entries
            WHERE asiento_num IS NULL
        )
        UPDATE journal_entries je
        SET asiento_num = 'JE-' || numbered.yyyymm || '-'
                         || LPAD(LEFT(COALESCE(numbered.source_module, 'GEN'), 2), 2, 'X')
                         || '-' || LPAD(numbered.rn::text, 6, '0')
        FROM numbered
        WHERE je.id = numbered.id;
        """
    )

    # ---- journal_lines: precision + tipo_cambio + computed MN + comp/tercero/validator ----
    op.execute("ALTER TABLE journal_lines ALTER COLUMN debit TYPE NUMERIC(18, 4)")
    op.execute("ALTER TABLE journal_lines ALTER COLUMN credit TYPE NUMERIC(18, 4)")

    op.add_column(
        "journal_lines",
        sa.Column("tipo_cambio", sa.Numeric(6, 4), nullable=False, server_default=sa.text("1.0000")),
    )

    # debe_mn / haber_mn as STORED generated columns (computed in DB)
    op.execute(
        "ALTER TABLE journal_lines ADD COLUMN debe_mn NUMERIC(18, 4) "
        "GENERATED ALWAYS AS (debit * tipo_cambio) STORED"
    )
    op.execute(
        "ALTER TABLE journal_lines ADD COLUMN haber_mn NUMERIC(18, 4) "
        "GENERATED ALWAYS AS (credit * tipo_cambio) STORED"
    )

    op.add_column("journal_lines", sa.Column("periodo_fiscal", sa.String(7), nullable=True))
    op.add_column("journal_lines", sa.Column("modulo_origen", sa.String(20), nullable=True))
    op.add_column("journal_lines", sa.Column("linea_idx", sa.Integer, nullable=True))

    # Comprobante de Pago (Tabla 10 SUNAT)
    op.add_column("journal_lines", sa.Column("comp_tipo", sa.CHAR(2), nullable=True))
    op.add_column("journal_lines", sa.Column("comp_fecha_emision", sa.Date, nullable=True))
    op.add_column("journal_lines", sa.Column("comp_fecha_vencimiento", sa.Date, nullable=True))

    # Tercero (Tabla 2 SUNAT)
    op.add_column("journal_lines", sa.Column("tercero_tipo_doc", sa.CHAR(1), nullable=True))
    op.add_column("journal_lines", sa.Column("tercero_num", sa.String(15), nullable=True))
    op.add_column("journal_lines", sa.Column("tercero_razon_social", sa.String(255), nullable=True))

    # Validator state
    op.add_column(
        "journal_lines",
        sa.Column("estado_asiento", sa.String(20), nullable=False, server_default=sa.text("'VALIDADO'")),
    )
    op.add_column(
        "journal_lines",
        sa.Column("validar_status", sa.String(30), nullable=False, server_default=sa.text("'OK'")),
    )

    # Backfill periodo_fiscal + modulo_origen from parent entry + linea_idx
    op.execute(
        """
        UPDATE journal_lines jl
        SET periodo_fiscal = to_char(je.entry_date, 'YYYY-MM'),
            modulo_origen  = je.source_module
        FROM journal_entries je
        WHERE jl.entry_id = je.id;
        """
    )
    op.execute(
        """
        WITH ranked AS (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY entry_id ORDER BY created_at, id) AS rn
            FROM journal_lines
            WHERE linea_idx IS NULL
        )
        UPDATE journal_lines jl
        SET linea_idx = ranked.rn
        FROM ranked
        WHERE jl.id = ranked.id;
        """
    )

    # Backfill tercero_num / tercero_tipo_doc from partner_ruc when length permits
    op.execute(
        """
        UPDATE journal_lines
        SET tercero_num      = partner_ruc,
            tercero_tipo_doc = CASE
                WHEN partner_ruc IS NULL THEN NULL
                WHEN length(partner_ruc) = 11 THEN '6'
                WHEN length(partner_ruc) = 8  THEN '1'
                ELSE NULL
            END
        WHERE partner_ruc IS NOT NULL AND tercero_num IS NULL;
        """
    )

    # Backfill comp_tipo / comp serie/numero from existing document_* fields
    op.execute(
        """
        UPDATE journal_lines
        SET comp_tipo = document_type
        WHERE document_type IS NOT NULL AND comp_tipo IS NULL;
        """
    )

    # Re-enable immutability triggers — only the backfill needed them off.
    op.execute("ALTER TABLE journal_lines  ENABLE TRIGGER trg_no_update_journal_lines")
    op.execute("ALTER TABLE journal_entries ENABLE TRIGGER trg_no_update_journal_entries")

    # Now that backfill is complete, enforce NOT NULL on derived columns
    op.alter_column("journal_lines", "periodo_fiscal", nullable=False)
    op.alter_column("journal_lines", "modulo_origen", nullable=False)
    op.alter_column("journal_lines", "linea_idx", nullable=False)

    # Composite indexes for high-traffic ledger queries
    op.create_index(
        "ix_jl_periodo_modulo_cuenta",
        "journal_lines",
        ["periodo_fiscal", "modulo_origen", "account_code"],
    )
    op.create_index(
        "ix_jl_estado_validar",
        "journal_lines",
        ["estado_asiento", "validar_status"],
    )
    op.create_index(
        "ix_jl_tenant_periodo",
        "journal_lines",
        ["tenant_id", "periodo_fiscal"],
    )
    op.create_index(
        "ix_jl_tercero",
        "journal_lines",
        ["tenant_id", "tercero_num"],
    )
    op.create_index(
        "ix_jl_comprobante",
        "journal_lines",
        ["tenant_id", "comp_tipo", "document_series", "document_number"],
    )
    op.create_index(
        "ix_je_tenant_periodo_modulo",
        "journal_entries",
        ["tenant_id", "entry_date", "source_module"],
    )
    op.create_index(
        "ix_je_asiento_num",
        "journal_entries",
        ["tenant_id", "asiento_num"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_je_asiento_num", table_name="journal_entries")
    op.drop_index("ix_je_tenant_periodo_modulo", table_name="journal_entries")
    op.drop_index("ix_jl_comprobante", table_name="journal_lines")
    op.drop_index("ix_jl_tercero", table_name="journal_lines")
    op.drop_index("ix_jl_tenant_periodo", table_name="journal_lines")
    op.drop_index("ix_jl_estado_validar", table_name="journal_lines")
    op.drop_index("ix_jl_periodo_modulo_cuenta", table_name="journal_lines")

    op.drop_column("journal_lines", "validar_status")
    op.drop_column("journal_lines", "estado_asiento")
    op.drop_column("journal_lines", "tercero_razon_social")
    op.drop_column("journal_lines", "tercero_num")
    op.drop_column("journal_lines", "tercero_tipo_doc")
    op.drop_column("journal_lines", "comp_fecha_vencimiento")
    op.drop_column("journal_lines", "comp_fecha_emision")
    op.drop_column("journal_lines", "comp_tipo")
    op.drop_column("journal_lines", "linea_idx")
    op.drop_column("journal_lines", "modulo_origen")
    op.drop_column("journal_lines", "periodo_fiscal")
    op.execute("ALTER TABLE journal_lines DROP COLUMN IF EXISTS haber_mn")
    op.execute("ALTER TABLE journal_lines DROP COLUMN IF EXISTS debe_mn")
    op.drop_column("journal_lines", "tipo_cambio")
    op.execute("ALTER TABLE journal_lines ALTER COLUMN debit TYPE NUMERIC(18, 2)")
    op.execute("ALTER TABLE journal_lines ALTER COLUMN credit TYPE NUMERIC(18, 2)")

    op.drop_column("journal_entries", "asiento_num")
    op.drop_column("journal_entries", "tipo_asiento_id")
    op.drop_column("journal_entries", "validar_status")
    op.drop_column("journal_entries", "estado_asiento")
    op.drop_column("journal_entries", "tipo_cambio")
    op.execute("ALTER TABLE journal_entries ALTER COLUMN total_debit TYPE NUMERIC(18, 2)")
    op.execute("ALTER TABLE journal_entries ALTER COLUMN total_credit TYPE NUMERIC(18, 2)")
