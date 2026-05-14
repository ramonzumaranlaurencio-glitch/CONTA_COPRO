from alembic import op

revision = "005_hr_recruitment_ai"
down_revision = "004_rag_sunat_treasury_indexes"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(open("sql/005_hr_recruitment_ai.sql", encoding="utf-8").read())


def downgrade():
    op.execute("DROP TABLE IF EXISTS hr_contracts CASCADE")
    op.execute("DROP TABLE IF EXISTS hr_workers CASCADE")
