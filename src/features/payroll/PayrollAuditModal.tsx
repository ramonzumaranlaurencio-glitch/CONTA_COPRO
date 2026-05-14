import { useEffect, useState } from 'react';

interface PayrollAuditModalProps {
  planillaId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface AsientoDetalle {
  id: string;
  cuenta_contable: string;
  denominacion: string | null;
  monto: number;
  tipo_movimiento: string;
}

interface PayrollAuditData {
  planilla_id: string;
  periodo_mes: string;
  status: string;
  boleta_path: string | null;
  liquidacion_path: string | null;
  asiento_contable_id: string | null;
  asiento: {
    glosa: string | null;
    total_debe: number | null;
    total_haber: number | null;
    status: string | null;
    reference_document_id: string | null;
    reference_document_type: string | null;
    centro_costo: string | null;
    lineas: AsientoDetalle[];
  } | null;
}

const PayrollAuditModal = ({ planillaId, isOpen, onClose }: PayrollAuditModalProps) => {
  const [auditData, setAuditData] = useState<PayrollAuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !planillaId) return;

    const fetchAudit = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/hr/payroll/${planillaId}/asiento`);
        if (!response.ok) {
          throw new Error('No se pudo obtener la información del asiento.');
        }
        const data: PayrollAuditData = await response.json();
        setAuditData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchAudit();
  }, [isOpen, planillaId]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>
          Cerrar
        </button>

        <h2>Detalle del Asiento de Planilla</h2>

        {loading && <p>Cargando...</p>}
        {error && <p className="error">{error}</p>}

        {auditData && (
          <div>
            <div className="section">
              <strong>Planilla:</strong> {auditData.planilla_id}
            </div>
            <div className="section">
              <strong>Periodo:</strong> {auditData.periodo_mes}
            </div>
            <div className="section">
              <strong>Status:</strong> {auditData.status}
            </div>
            <div className="section">
              <strong>Asiento:</strong> {auditData.asiento?.glosa || 'Sin asiento registrado'}
            </div>
            <div className="section">
              <strong>Centro de costo:</strong> {auditData.asiento?.centro_costo || 'N/A'}
            </div>
            <div className="section">
              <strong>Documento de referencia:</strong> {auditData.asiento?.reference_document_id || 'N/A'}
            </div>
            <div className="section">
              <strong>Tipo de referencia:</strong> {auditData.asiento?.reference_document_type || 'N/A'}
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {auditData.asiento?.lineas.map((line) => (
                  <tr key={line.id}>
                    <td>{line.cuenta_contable}</td>
                    <td>{line.denominacion}</td>
                    <td>{line.monto.toFixed(2)}</td>
                    <td>{line.tipo_movimiento}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="section">
              <strong>Boleta:</strong> {auditData.boleta_path ?? 'No disponible'}
            </div>
            <div className="section">
              <strong>Liquidación:</strong> {auditData.liquidacion_path ?? 'No disponible'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayrollAuditModal;
