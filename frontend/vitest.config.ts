/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/shim.ts', './src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Increase timeout for full suite runs to prevent false failures.
    // 10s was insufficient under jsdom + 4-fork contention —
    // LeaderboardsIntegration intermittently timed out at 10s during
    // full-suite runs while passing in ~8s in isolation. 20s provides
    // headroom without masking real hangs; genuinely-stuck tests still
    // fail well under 20s of patience.
    testTimeout: 20000,
    // Limit concurrency to reduce resource contention
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 4,
      },
    },
    // Better isolation between test files
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.d.ts', '**/*.config.*', '**/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
