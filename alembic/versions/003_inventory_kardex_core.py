from alembic import op

revision = "003_inventory_kardex_core"
down_revision = "002_enterprise_expansion"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(open("sql/004_inventory_kardex_core.sql", encoding="utf-8").read())


def downgrade():
    op.execute("DROP TABLE IF EXISTS inventory_balances CASCADE")
    op.execute("DROP TABLE IF EXISTS kardex_movements CASCADE")
    op.execute("DROP TABLE IF EXISTS warehouses CASCADE")
    op.execute("DROP TABLE IF EXISTS products CASCADE")
