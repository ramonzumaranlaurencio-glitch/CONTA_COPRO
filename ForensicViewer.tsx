import React from 'react';

type DetectedZone = {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  value?: string;
};

type ForensicViewerProps = {
  imageUrl: string;
  detectedZones: DetectedZone[];
};

export const ForensicViewer = ({ imageUrl, detectedZones }: ForensicViewerProps) => {
  return (
    <div className="relative border-4 border-slate-800 rounded-lg overflow-hidden shadow-2xl">
      {/* La Imagen Real de la Factura */}
      <img src={imageUrl} className="w-full h-auto opacity-90" alt="Factura Escaneada" />

      {/* Capa de Coordenadas de la IA */}
      <div className="absolute inset-0">
        {detectedZones.map((zone, index) => (
          <div
            key={index}
            className="absolute border-2 border-red-500 bg-red-500/10 transition-all duration-500 hover:border-green-400"
            style={{
              left: `${zone.x}px`,
              top: `${zone.y}px`,
              width: `${zone.w}px`,
              height: `${zone.h}px`,
            }}
          >
            {/* Tooltip con el dato detectado */}
            <span className="absolute -top-6 left-0 bg-red-600 text-white text-[10px] px-1 font-bold rounded">
              {(zone.label ?? 'DATO')}: {zone.value ?? ''}
            </span>
          </div>
        ))}
      </div>

      {/* Scanner Beam (Efecto de línea láser bajando) */}
      <div className="absolute top-0 left-0 w-full h-1 bg-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.8)] animate-scan-beam" />
    </div>
  );
};
