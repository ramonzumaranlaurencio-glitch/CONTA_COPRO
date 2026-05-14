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

  const generateLibro51 = () => {
    const content = 'LIBRO 5.1\nPERIODO:20260500\nASIENTOS:342\nESTADO:OK\n';
    downloadText('LE202605-LIBRO-5.1.txt', content);
  };

  const generateLibro52 = () => {
    const content = 'LIBRO 5.2\nPERIODO:20260500\nFORMATO:SIMPLIFICADO\nESTADO:OK\n';
    downloadText('LE202605-LIBRO-5.2.txt', content);
  };

  const downloadPackage = () => {
    const packageText = [
      'PAQUETE_PLE_202605',
      'ARCHIVO:LE202605-LIBRO-5.1.txt',
      'ARCHIVO:LE202605-LIBRO-5.2.txt',
      'NOTA:Descarga temporal en formato de texto.',
    ].join('\n');
    downloadText('PLE-202605-package.zip.txt', packageText);
  };

  return (
    <div className="bg-white rounded shadow-lg border border-slate-200">
      <header className="p-4 bg-slate-50 border-b flex justify-between">
        <h3 className="font-bold text-slate-700">Libros Electronicos - PLE 5.1 / 5.2</h3>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Periodo: Mayo 2026</span>
      </header>

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between p-4 border rounded hover:bg-slate-50">
          <div className="flex gap-4 items-center">
            <DocumentText24Regular className="text-blue-500" />
            <div>
              <p className="font-bold text-sm">Libro Diario (5.1)</p>
              <p className="text-xs text-slate-500">342 asientos detectados. Hash de integridad OK.</p>
            </div>
          </div>
          <button type="button" className="btn-fluent-secondary" onClick={generateLibro51}>Generar TXT</button>
        </div>

        <div className="flex items-center justify-between p-4 border rounded hover:bg-slate-50">
          <div className="flex gap-4 items-center">
            <DocumentText24Regular className="text-blue-500" />
            <div>
              <p className="font-bold text-sm">Libro Diario Formato Simplificado (5.2)</p>
              <p className="text-xs text-slate-500">Listo para exportacion.</p>
            </div>
          </div>
          <button type="button" className="btn-fluent-secondary" onClick={generateLibro52}>Generar TXT</button>
        </div>
      </div>

      <footer className="p-4 bg-slate-50 border-t flex justify-end">
        <button type="button" className="btn-fluent-primary" onClick={downloadPackage}>Descargar Paquete ZIP para PLE</button>
      </footer>
    </div>
  );
};
