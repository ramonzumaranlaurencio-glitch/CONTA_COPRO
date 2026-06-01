import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const backendUrl =
    process.env.VITE_API_URL ||
    process.env.BACKEND_BASE_URL ||
    'http://localhost:8000';
  const isProd = mode === 'production';

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },

    server: isProd
      ? {}
      : {
          host: '0.0.0.0',
          port: 5173,
          proxy: {
            '/api':    { target: backendUrl, changeOrigin: true, secure: false },
            '/health': { target: backendUrl, changeOrigin: true, secure: false },
          },
        },

    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        // Suprimir warnings de módulos no resueltos en dependencias de terceros
        onwarn(warning, defaultHandler) {
          if (
            warning.code === 'UNRESOLVED_IMPORT' ||
            (warning.message && warning.message.includes('scheduler'))
          ) {
            return; // silenciar — scheduler es interno de React
          }
          defaultHandler(warning);
        },
        output: {
          manualChunks(id) {
            // ── node_modules ──────────────────────────────────────────
            if (id.includes('node_modules')) {
              if (id.includes('/react-dom/') || id.includes('/react/index') || id.includes('/scheduler/')) return 'vendor';
              if (id.includes('@fluentui')) return 'fluent';
              if (id.includes('recharts') || id.includes('chart.js') || id.includes('react-chartjs-2')) return 'charts';
              if (id.includes('lucide-react')) return 'icons';
              // resto de node_modules va al chunk principal (rollup decide)
            }
            // ── código de la app por módulo ────────────────────────────
            if (id.includes('/features/accounting/')) return 'feat-accounting';
            if (id.includes('/features/sunat/'))      return 'feat-sunat';
            if (id.includes('/features/inventory/'))  return 'feat-inventory';
            if (id.includes('/features/reports/'))    return 'feat-reports';
            if (id.includes('/features/payroll/'))    return 'feat-payroll';
            if (id.includes('/features/assets/'))     return 'feat-assets';
            if (id.includes('/features/billing/'))    return 'feat-billing';
            if (id.includes('/features/settings/'))   return 'feat-settings';
            if (id.includes('/features/auth/'))       return 'feat-auth';
            if (id.includes('/features/') || id.includes('/components/')) return 'shared';
          },
        },
      },
    },
  };
});
