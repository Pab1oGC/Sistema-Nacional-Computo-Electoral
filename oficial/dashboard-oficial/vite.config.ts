import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En dev: vite proxy redirige /api/* y /health a localhost:8001 (donde
// expone oficial_api). En prod: nginx hace el proxy según nginx.conf.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id: string): string | undefined => {
          if (id.indexOf('node_modules') === -1) return undefined;
          if (
            id.indexOf('recharts') !== -1 ||
            id.indexOf('/d3-') !== -1 ||
            id.indexOf('victory-vendor') !== -1
          ) {
            return 'recharts';
          }
          if (
            id.indexOf('/react/') !== -1 ||
            id.indexOf('/react-dom/') !== -1 ||
            id.indexOf('/scheduler/') !== -1
          ) {
            return 'react';
          }
          if (id.indexOf('@tanstack/react-query') !== -1) {
            return 'query';
          }
          return undefined;
        },
      },
    },
  },
});
