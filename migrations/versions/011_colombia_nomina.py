"""011_colombia_nomina — Migración Colombia: amplía cedula, agrega campos de nómina colombiana.

Revision ID: 011_colombia_nomina
Revises: 010_ledger_reinforced_schema
Create Date: 2026-06-03

Normas: CST · Ley 100/1993 · Decreto 1072/2015 · Decreto 2649/1993 (PUC)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "011_colombia_nomina"
down_revision = "010_ledger_reinforced_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Ampliar Cédula de Ciudadanía: String(8) Peru → String(12) Colombia
    op.alter_column(
        "hr_workers", "dni",
        existing_type=sa.String(8),
        type_=sa.String(12),
        existing_nullable=False,
        comment="Cédula de Ciudadanía Colombia (5-12 dígitos)",
    )

    # 2. sueldo_pactado: Numeric(18,2) → Numeric(18,0) — COP no usa centavos en nómina
    op.alter_column(
        "hr_workers", "sueldo_pactado",
        existing_type=sa.Numeric(18, 2),
        type_=sa.Numeric(18, 0),
        existing_nullable=False,
    )

    # 3. Actualizar índice único (si el constraint incluía longitud en algunos engines)
    try:
        op.drop_constraint("uq_hr_worker_dni", "hr_workers", type_="unique")
        op.create_unique_constraint("uq_hr_worker_dni", "hr_workers", ["tenant_id", "dni"])
    except Exception:
        pass

    # 4. Actualizar PUC Colombia en chart_accounts (renombrar cuentas peruanas si existen)
    #    Solo actualiza el nombre/clase, no elimina asientos existentes.
    conn = op.get_bind()

    puc_updates = [
        # (code, new_name, new_class, statement, nature)
        ("510506", "Sueldos y salarios",                   "51", "PROFIT_LOSS",   "DEBIT"),
        ("510512", "Horas extras y recargos (Art. 168 CST)", "51", "PROFIT_LOSS", "DEBIT"),
        ("510530", "Subsidio de transporte",               "51", "PROFIT_LOSS",   "DEBIT"),
        ("510518", "Gasto provisión cesantías",            "51", "PROFIT_LOSS",   "DEBIT"),
        ("510519", "Gasto intereses sobre cesantías",      "51", "PROFIT_LOSS",   "DEBIT"),
        ("510521", "Gasto provisión prima de servicios",   "51", "PROFIT_LOSS",   "DEBIT"),
        ("510527", "Gasto provisión vacaciones",           "51", "PROFIT_LOSS",   "DEBIT"),
        ("510522", "Gasto EPS empleador 8.5%",             "51", "PROFIT_LOSS",   "DEBIT"),
        ("510524", "Gasto AFP empleador 12%",              "51", "PROFIT_LOSS",   "DEBIT"),
        ("510523", "Gasto ARL (Decreto 1607/2002)",        "51", "PROFIT_LOSS",   "DEBIT"),
        ("510525", "Gasto CCF 4% (Ley 21/1982)",          "51", "PROFIT_LOSS",   "DEBIT"),
        ("510510", "Gasto SENA 2% (Ley 21/1982)",         "51", "PROFIT_LOSS",   "DEBIT"),
        ("510515", "Gasto ICBF 3% (Ley 21/1982)",         "51", "PROFIT_LOSS",   "DEBIT"),
        ("2405",   "AFP pensiones por pagar",              "24", "BALANCE_SHEET", "CREDIT"),
        ("2406",   "EPS salud por pagar",                  "24", "BALANCE_SHEET", "CREDIT"),
        ("2407",   "ARL por pagar",                        "24", "BALANCE_SHEET", "CREDIT"),
        ("2408",   "Fondo solidaridad pensional",          "24", "BALANCE_SHEET", "CREDIT"),
        ("2413",   "CCF por pagar",                        "24", "BALANCE_SHEET", "CREDIT"),
        ("2414",   "SENA por pagar",                       "24", "BALANCE_SHEET", "CREDIT"),
        ("2415",   "ICBF por pagar",                       "24", "BALANCE_SHEET", "CREDIT"),
        ("2365",   "ReteFuente rentas laborales (Art. 383 ET)", "23", "BALANCE_SHEET", "CREDIT"),
        ("2610",   "Cesantías consolidadas",               "26", "BALANCE_SHEET", "CREDIT"),
        ("2615",   "Intereses sobre cesantías por pagar",  "26", "BALANCE_SHEET", "CREDIT"),
        ("2620",   "Prima de servicios por pagar",         "26", "BALANCE_SHEET", "CREDIT"),
        ("2625",   "Vacaciones consolidadas",              "26", "BALANCE_SHEET", "CREDIT"),
        ("2370",   "Nóminas por pagar",                    "23", "BALANCE_SHEET", "CREDIT"),
        ("1110",   "Bancos",                               "11", "BALANCE_SHEET", "DEBIT"),
    ]

    for code, name, acct_class, statement, nature in puc_updates:
        conn.execute(
            sa.text(
                "INSERT INTO chart_accounts (code, name, account_class, statement, nature, accepts_cost_center, accepts_partner) "
                "VALUES (:code, :name, :class, :stmt, :nature, :cc, false) "
                "ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, account_class = EXCLUDED.account_class, "
                "statement = EXCLUDED.statement, nature = EXCLUDED.nature"
            ),
            {"code": code, "name": name, "class": acct_class, "stmt": statement, "nature": nature, "cc": acct_class in ("51",)},
        )


def downgrade() -> None:
    op.alter_column(
        "hr_workers", "dni",
        existing_type=sa.String(12),
        type_=sa.String(8),
        existing_nullable=False,
    )
    op.alter_column(
        "hr_workers", "sueldo_pactado",
        existing_type=sa.Numeric(18, 0),
        type_=sa.Numeric(18, 2),
        existing_nullable=False,
    )
