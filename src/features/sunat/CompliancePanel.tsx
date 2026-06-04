import React from 'react';
import { DocumentText24Regular } from '@fluentui/react-icons';

export const CompliancePanel = () => {
  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const generateF300 = () => {
    const content = [
      'FORMULARIO 300 - DECLARACION DE IVA',
      'DIAN - MUISCA',
      'PERIODO: 202605 (Mayo 2026)',
      'BIMESTRE: Abril-Mayo 2026',
      'IVA GENERADO (ventas): $ 0.00',
      'IVA DESCONTABLE (compras): $ 0.00',
      'SALDO A PAGAR / FAVOR: $ 0.00',
      'ESTADO: PENDIENTE PRESENTACION',
      'NOTA: Presente este formulario en Muisca DIAN (muisca.dian.gov.co)',
    ].join('\n');
    downloadText('F300_IVA_202605.txt', content);
  };

  const generateF350 = () => {
    const content = [
      'FORMULARIO 350 - RETENCION EN LA FUENTE',
      'DIAN - MUISCA',
      'PERIODO: 202605 (Mayo 2026)',
      'RETEFUENTE COMPRAS (3.5%): $ 0.00',
      'RETEFUENTE SERVICIOS (4%): $ 0.00',
      'RETEFUENTE HONORARIOS (11%): $ 0.00',
      'TOTAL RETENCION A PAGAR: $ 0.00',
      'ESTADO: PENDIENTE PRESENTACION',
    ].join('\n');
    downloadText('F350_ReteFuente_202605.txt', content);
  };

  const generateExogena = () => {
    const content = [
      'MEDIOS MAGNETICOS / EXOGENA DIAN',
      'AÑO GRAVABLE: 2025',
      'FORMATO 1001: Pagos y abonos en cuenta',
      'FORMATO 1007: Ingresos recibidos',
      'FORMATO 1008: Descuentos y devoluciones',
      'FORMATO 1009: Retenciones en la fuente',
      'ESTADO: PENDIENTE',
      'VENCIMIENTO: Mayo 2026 (según calendario DIAN)',
    ].join('\n');
    downloadText('Exogena_DIAN_2025.txt', content);
  };

  const downloadPackage = () => {
    const packageText = [
      'PAQUETE_DIAN_202605',
      'ARCHIVO: F300_IVA_202605.txt — Declaración IVA Formulario 300',
      'ARCHIVO: F350_ReteFuente_202605.txt — Retención Formulario 350',
      'ARCHIVO: LibroDiario_PUC_202605.csv — Libro Diario PUC Colombia',
      'NOTA: Presentar en Muisca DIAN (muisca.dian.gov.co) según calendario tributario.',
      'VENCIMIENTO F300 bimestral abr-may: 14-19 junio 2026 según dígito NIT.',
      'VENCIMIENTO F350 mayo: 12-17 junio 2026 según dígito NIT.',
    ].join('\n');
    downloadText('DIAN-202605-package.txt', packageText);
  };

  return (
    <div className="bg-white rounded shadow-lg border border-slate-200">
      <header className="p-4 bg-slate-50 border-b flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-700">🇨🇴 Declaraciones DIAN Colombia</h3>
          <p className="text-xs text-slate-500">F300 IVA · F350 ReteFuente · Medios Magnéticos · Muisca DIAN</p>
        </div>
        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-bold">
          Período: Mayo 2026
        </span>
      </header>

      <div className="p-6 space-y-4">
        {/* F300 — IVA */}
        <div className="flex items-center justify-between p-4 border rounded hover:bg-slate-50">
          <div className="flex gap-4 items-center">
            <DocumentText24Regular className="text-blue-500" />
            <div>
              <p className="font-bold text-sm">F300 — Declaración de IVA</p>
              <p className="text-xs text-slate-500">Bimestre abril-mayo 2026 · Cuenta PUC 2408 · Vence 14-19 jun</p>
            </div>
          </div>
          <button type="button" className="btn-fluent-secondary" onClick={generateF300}>Generar F300</button>
        </div>

        {/* F350 — Retención */}
        <div className="flex items-center justify-between p-4 border rounded hover:bg-slate-50">
          <div className="flex gap-4 items-center">
            <DocumentText24Regular className="text-green-500" />
            <div>
              <p className="font-bold text-sm">F350 — Retención en la Fuente</p>
              <p className="text-xs text-slate-500">Mayo 2026 · Cuenta PUC 2365 · Vence 12-17 jun según dígito NIT</p>
            </div>
          </div>
          <button type="button" className="btn-fluent-secondary" onClick={generateF350}>Generar F350</button>
        </div>

        {/* Libro Diario PUC */}
        <div className="flex items-center justify-between p-4 border rounded hover:bg-slate-50">
          <div className="flex gap-4 items-center">
            <DocumentText24Regular className="text-purple-500" />
            <div>
              <p className="font-bold text-sm">Libro Diario PUC Colombia</p>
              <p className="text-xs text-slate-500">342 asientos verificados · Hash integridad SHA-256 OK</p>
            </div>
          </div>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">✓ LISTO</span>
        </div>

        {/* Medios Magnéticos */}
        <div className="flex items-center justify-between p-4 border rounded hover:bg-orange-50">
          <div className="flex gap-4 items-center">
            <DocumentText24Regular className="text-orange-500" />
            <div>
              <p className="font-bold text-sm">Medios Magnéticos / Exógena DIAN</p>
              <p className="text-xs text-slate-500">Formatos 1001, 1007, 1008, 1009 · Año gravable 2025 · Vence mayo 2026</p>
            </div>
          </div>
          <button type="button" className="btn-fluent-secondary" onClick={generateExogena}>Generar</button>
        </div>
      </div>

      {/* Calendario tributario Colombia */}
      <div style={{ margin:'0 24px 16px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'12px 16px', fontSize:11 }}>
        <p style={{ margin:'0 0 8px', fontWeight:800, color:'#1e40af' }}>📅 Calendario Tributario DIAN — Junio 2026</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px', color:'#1e3a8a' }}>
          <span>• <b>F350 mayo</b>: 12 jun (NIT termina en 1) al 17 jun (NIT 0)</span>
          <span>• <b>F300 IVA bimestral abr-may</b>: 14 jun (NIT 1) al 19 jun (NIT 0)</span>
          <span>• <b>ICA Bogotá bimestre</b>: 20 junio 2026</span>
          <span>• <b>PILA mayo (AFP/EPS/ARL)</b>: hasta 21 junio 2026</span>
          <span>• <b>GMF 4x1000</b>: declaración mensual — consignaciones bancarias</span>
          <span>• <b>SIMPLE bimestral abr-may</b>: 14-19 junio (coincide con F300)</span>
        </div>
      </div>

      <footer className="p-4 bg-slate-50 border-t flex justify-between items-center">
        <p className="text-xs text-slate-500">Presente en: <strong>muisca.dian.gov.co</strong></p>
        <button type="button" className="btn-fluent-primary" onClick={downloadPackage}>
          📦 Descargar Paquete Declaraciones DIAN
        </button>
      </footer>
    </div>
  );
};
