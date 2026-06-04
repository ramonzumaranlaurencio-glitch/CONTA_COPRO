import React from 'react';
import { LockClosed24Regular } from '@fluentui/react-icons';

export const PeriodCloseAction = () => {
  const onClosePeriod = () => {
    const confirmed = window.confirm(
      'Esta acción bloqueará el período contable y firmará digitalmente el Libro Diario PUC.\n\n' +
      'Antes de continuar verifique:\n' +
      '• Declaración IVA F300 presentada en Muisca DIAN\n' +
      '• Retención en la Fuente F350 presentada\n' +
      '• Medios Magnéticos actualizados\n\n' +
      '¿Desea continuar? Esta acción es IRREVERSIBLE.'
    );
    if (confirmed) {
      window.alert('Cierre de período programado. Firma digital del Libro Diario PUC en proceso (demo).');
    }
  };

  return (
    <div className="p-6 bg-white border-2 border-red-100 rounded-lg shadow-inner">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-red-600 rounded-full text-white">
          <LockClosed24Regular />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Cierre de Período: Mayo 2026</h3>
          <p className="text-xs text-slate-500">
            Esta acción es irreversible y firmará digitalmente el Libro Diario PUC Colombia.
          </p>
        </div>
      </div>

      <ul className="text-xs space-y-2 mb-4">
        <li className="flex items-center gap-2">✅ 452 asientos PUC verificados (Débito = Crédito)</li>
        <li className="flex items-center gap-2">✅ Diferencia en cambio USD/COP calculada (TRM Banco de la República)</li>
        <li className="flex items-center gap-2">✅ IVA período calculado — cuenta 2408 conciliada</li>
        <li className="flex items-center gap-2">✅ Retención en la Fuente calculada — cuenta 2365</li>
        <li className="flex items-center gap-2">✅ Declaración F300 IVA lista para Muisca DIAN</li>
        <li className="flex items-center gap-2">✅ Declaración F350 ReteFuente lista para Muisca DIAN</li>
      </ul>

      {/* Calendario de vencimientos DIAN */}
      <div style={{ background:'#fef3c7', border:'1px solid #d97706', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:11 }}>
        <p style={{ margin:'0 0 6px', fontWeight:800, color:'#92400e' }}>📅 Vencimientos DIAN — Junio 2026</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, color:'#78350f' }}>
          <span>• F350 ReteFuente mayo: 12 jun (dígito 1-5) / 15 jun (6-0)</span>
          <span>• F300 IVA bimestre abr-may: 14-19 jun según dígito NIT</span>
          <span>• ICA Bogotá bimestre: 20 jun</span>
          <span>• PILA aportes parafiscales mayo: 21 jun</span>
        </div>
      </div>

      <button type="button" className="btn-fluent-primary bg-red-700 border-red-900 w-full" onClick={onClosePeriod}>
        🔒 Firmar y Bloquear Contabilidad — Período Mayo 2026
      </button>
    </div>
  );
};
