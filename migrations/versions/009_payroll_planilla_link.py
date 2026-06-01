from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "009_payroll_planilla_link"
down_revision = "008_payroll_audit_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'planillas_calculadas',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('trabajador_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hr_workers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('periodo_mes', sa.String(7), nullable=False),
        sa.Column('boleta_path', sa.Text, nullable=True),
        sa.Column('liquidacion_path', sa.Text, nullable=True),
        sa.Column('asiento_contable_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('libro_diario.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='POSTED'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('tenant_id', 'trabajador_id', 'periodo_mes', name='uq_planilla_trabajador_periodo'),
    )
    op.create_index('idx_planillas_calculadas_trabajador', 'planillas_calculadas', ['trabajador_id'])
    op.create_index('idx_planillas_calculadas_asiento', 'planillas_calculadas', ['asiento_contable_id'])


def downgrade():
    op.drop_index('idx_planillas_calculadas_asiento', table_name='planillas_calculadas')
    op.drop_index('idx_planillas_calculadas_trabajador', table_name='planillas_calculadas')
    op.drop_table('planillas_calculadas')
