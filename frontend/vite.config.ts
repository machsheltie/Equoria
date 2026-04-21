import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { visualizer } from 'rollup-plugin-visualizer';

/**
 * Subresource Integrity plugin — injects `integrity="sha384-..."` on every
 * <script src="/assets/*"> and <link rel="stylesheet|modulepreload" href="/assets/*">
 * emitted into dist/index.html.
 *
 * Fixes ZAP passive-scan rule 90003 ("Sub Resource Integrity Attribute Missing",
 * issues #68-#71). Runs at `writeBundle` time so the hashes match the final
 * bytes on disk. Font preloads are intentionally skipped — SRI on fonts
 * provides no meaningful protection (they are opaque to JS) and is not flagged.
 */
function subresourceIntegrityPlugin(): Plugin {
  return {
    name: 'equoria-sri',
    apply: 'build',
    enforce: 'post',
    writeBundle(options, bundle) {
      const outDir = options.dir ?? 'dist';
      const htmlPath = path.join(outDir, 'index.html');
      let html: string;
      try {
        html = readFileSync(htmlPath, 'utf-8');
      } catch {
        return; // no index.html produced (library mode etc.)
      }

      const hashFor = (fileName: string): string | null => {
        const entry = bundle[fileName];
        if (!entry) return null;
        const source = entry.type === 'chunk' ? entry.code : entry.source;
        const buf =
          typeof source === 'string'
            ? Buffer.from(source, 'utf-8')
            : Buffer.from(source as Uint8Array);
        return `sha384-${createHash('sha384').update(buf).digest('base64')}`;
      };

      const patched = html.replace(/<(script|link)\b[^>]*>/g, (tag) => {
        if (/\sintegrity=/.test(tag)) return tag;

        let assetPath: string | null = null;
        if (tag.startsWith('<script')) {
          assetPath = /\ssrc="\/([^"]+)"/.exec(tag)?.[1] ?? null;
        } else {
          const rel = /\srel="([^"]+)"/.exec(tag)?.[1];
          if (rel !== 'stylesheet' && rel !== 'modulepreload') return tag;
          assetPath = /\shref="\/([^"]+)"/.exec(tag)?.[1] ?? null;
        }
        if (!assetPath) return tag;
        const hash = hashFor(assetPath);
        if (!hash) return tag;
        return tag.replace(/\s*>$/, ` integrity="${hash}">`);
      });

      if (patched !== html) {
        writeFileSync(htmlPath, patched, 'utf-8');
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Generates dist/bundle-stats.html after every build for size inspection
    visualizer({ open: false, filename: 'dist/bundle-stats.html', gzipSize: true }),
    // Inject SRI hashes into index.html (ZAP rule 90003)
    subresourceIntegrityPlugin(),
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
