from alembic import op

revision = "007_hr_payroll_tables"
down_revision = "006_hr_worker_extra_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(open("sql/007_hr_payroll_tables.sql", encoding="utf-8").read())


def downgrade():
    op.execute("DROP TABLE IF EXISTS provisiones_sociales CASCADE")
    op.execute("DROP TABLE IF EXISTS detalle_asiento CASCADE")
    op.execute("DROP TABLE IF EXISTS libro_diario CASCADE")
    op.execute("ALTER TABLE hr_workers DROP COLUMN IF EXISTS ruta_cv_pdf")
    op.execute("ALTER TABLE hr_workers DROP COLUMN IF EXISTS estado_laboral")
    op.execute("ALTER TABLE hr_workers DROP COLUMN IF EXISTS sistema_pensional")
    op.execute("ALTER TABLE hr_workers DROP COLUMN IF EXISTS num_cuenta_interbancaria")
    op.execute("ALTER TABLE hr_workers DROP COLUMN IF EXISTS cuenta_bancaria")
