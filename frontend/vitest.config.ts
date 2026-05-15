/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.d.ts', '**/*.config.*', '**/index.ts'],
    },
    projects: [
      {
        extends: true,
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
          // Limit concurrency to reduce resource contention.
          // Vitest 4 removed test.poolOptions — fork pool options
          // (singleFork, maxForks) are now top-level (maxWorkers).
          // See https://vitest.dev/guide/migration#pool-rework
          pool: 'forks',
          maxWorkers: 4,
          // Better isolation between test files
          isolate: true,
          // Vitest 4 requires unique sequence.groupOrder between projects with
          // different maxWorkers, otherwise it throws at startup before any
          // test runs ("Projects '0' and 'storybook (chromium)' have different
          // 'maxWorkers' but same 'sequence.groupOrder'"). Run the unit suite
          // first (0) so the heavier Storybook browser-mode pool starts after
          // the cheap jsdom forks have already warmed (Equoria-60h2).
          sequence: {
            groupOrder: 0,
          },
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          // Run Storybook browser-mode tests AFTER the jsdom unit suite to
          // satisfy Vitest 4's distinct-groupOrder requirement when projects
          // declare different maxWorkers, and to avoid contending with the
          // unit forks-pool for CPU during chromium boot (Equoria-60h2).
          sequence: {
            groupOrder: 1,
          },
          // Storybook browser-mode tests boot a Playwright/chromium browser
          // per worker. Cold-start under CI parallel load can exceed the
          // default 5s test timeout AND the default 60s server-connect
          // timeout, producing 'Test timed out in 15000ms' on
          // GameBadge/GameCollapsible/GameDialog stories and cascading
          // 'Cannot connect to the server in 60 seconds' unhandled
          // rejections that then starve the forks-pool of workers for
          // CompetitionHistory / EntryConfirmationModal / HorseDetailView
          // (Equoria-p6hj, Equoria-kjyz).
          testTimeout: 30000,
          hookTimeout: 30000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
        },
      },
    ],
  },
});
