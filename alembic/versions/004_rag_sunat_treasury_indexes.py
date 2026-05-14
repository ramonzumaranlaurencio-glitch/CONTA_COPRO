from alembic import op
from sqlalchemy import text

revision = "004_rag_sunat_treasury_indexes"
down_revision = "003_inventory_kardex_core"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE INDEX IF NOT EXISTS idx_accounting_embeddings_entity ON accounting_embeddings(tenant_id, entity_type, entity_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_treasury_movements_doc ON treasury_movements(tenant_id, financial_document_id, reconciliation_status)")
    bind = op.get_bind()
    has_embedding = bind.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'accounting_embeddings'
              AND column_name = 'embedding'
            LIMIT 1
            """
        )
    ).scalar()
    if has_embedding:
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_accounting_embeddings_vector "
            "ON accounting_embeddings USING ivfflat (embedding vector_l2_ops) WITH (lists = 100)"
        )


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_accounting_embeddings_vector")
    op.execute("DROP INDEX IF EXISTS idx_treasury_movements_doc")
    op.execute("DROP INDEX IF EXISTS idx_accounting_embeddings_entity")
