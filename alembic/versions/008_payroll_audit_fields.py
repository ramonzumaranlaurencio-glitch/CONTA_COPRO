from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "008_payroll_audit_fields"
down_revision = "007_hr_payroll_tables"
branch_labels = None
depends_on = None


def upgrade():
    # Agregar campos de auditoría a libro_diario
    op.add_column('libro_diario', sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('libro_diario', sa.Column('reference_document_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('libro_diario', sa.Column('reference_document_type', sa.String(50), nullable=True))
    op.add_column('libro_diario', sa.Column('status', sa.String(20), server_default='CONFIRMADO'))
    op.add_column('libro_diario', sa.Column('motivo_anulacion', sa.Text, nullable=True))
    op.add_column('libro_diario', sa.Column('centro_costo', sa.String(10), nullable=True))
    
    # Crear índices para mejor performance en auditoría
    op.create_index('idx_libro_diario_created_by', 'libro_diario', ['created_by'])
    op.create_index('idx_libro_diario_status', 'libro_diario', ['status'])
    op.create_index('idx_libro_diario_reference', 'libro_diario', ['reference_document_id'])
    op.create_index('idx_libro_diario_centro_costo', 'libro_diario', ['centro_costo'])


def downgrade():
    op.drop_index('idx_libro_diario_centro_costo', 'libro_diario')
    op.drop_index('idx_libro_diario_reference', 'libro_diario')
    op.drop_index('idx_libro_diario_status', 'libro_diario')
    op.drop_index('idx_libro_diario_created_by', 'libro_diario')
    
    op.drop_column('libro_diario', 'centro_costo')
    op.drop_column('libro_diario', 'motivo_anulacion')
    op.drop_column('libro_diario', 'status')
    op.drop_column('libro_diario', 'reference_document_type')
    op.drop_column('libro_diario', 'reference_document_id')
    op.drop_column('libro_diario', 'created_by')
