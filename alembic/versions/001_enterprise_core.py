from alembic import op
from sqlalchemy import text

revision = "001_enterprise_core"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.execute(open("sql/001_enterprise_core.sql", encoding="utf-8").read())
    bind = op.get_bind()
    has_vector = bind.execute(text("SELECT 1 FROM pg_available_extensions WHERE name = 'vector' LIMIT 1")).scalar()
    if has_vector:
        op.execute('CREATE EXTENSION IF NOT EXISTS vector')
        op.execute('ALTER TABLE accounting_embeddings ADD COLUMN IF NOT EXISTS embedding vector(768)')

def downgrade():
    op.execute("DROP TABLE IF EXISTS accounting_embeddings CASCADE")
    op.execute("DROP TABLE IF EXISTS integrity_alerts CASCADE")
    op.execute("DROP TABLE IF EXISTS dead_letter_events CASCADE")
    op.execute("DROP TABLE IF EXISTS outbox_events CASCADE")
    op.execute("DROP TABLE IF EXISTS audit_logs CASCADE")
    op.execute("DROP TABLE IF EXISTS journal_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS journal_entries CASCADE")
    op.execute("DROP TABLE IF EXISTS accounting_periods CASCADE")
    op.execute("DROP TABLE IF EXISTS refresh_tokens CASCADE")
    op.execute("DROP TABLE IF EXISTS oauth_clients CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
    op.execute("DROP TABLE IF EXISTS tenants CASCADE")
