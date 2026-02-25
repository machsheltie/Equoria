import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Generates dist/bundle-stats.html after every build for size inspection
    visualizer({ open: false, filename: 'dist/bundle-stats.html', gzipSize: true }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split large vendor libraries into cacheable separate chunks
        manualChunks: {
          // Core React runtime — smallest possible initial chunk
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data fetching / server state
          'vendor-query': ['@tanstack/react-query'],
          // Data visualization — recharts is large (~400KB), lazy routes keep it out of initial
          'vendor-charts': ['recharts'],
          // Radix UI primitives — shared across many components (only installed packages)
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-progress',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
          // Icon library
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
