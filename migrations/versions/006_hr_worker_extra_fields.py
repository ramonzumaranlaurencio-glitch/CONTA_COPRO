from alembic import op
import sqlalchemy as sa

revision = '006_hr_worker_extra_fields'
down_revision = '005_hr_recruitment_ai'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('hr_workers', sa.Column('pension_system', sa.String(length=30), nullable=True))


def downgrade():
    op.drop_column('hr_workers', 'pension_system')
