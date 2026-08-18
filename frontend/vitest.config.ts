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
    // Force-kill workers whose teardown hangs (the jest forceExit analog).
    // 10000 is Vitest 4's default, made explicit under the Equoria-7br8i
    // budget so it cannot silently drift.
    teardownTimeout: 10000,
    // The detectOpenHandles analog: the hanging-process reporter names
    // whatever handle keeps a worker alive, but Vitest's docs flag it as a
    // heavy diagnostic (enable only when Vitest cannot exit). Env-gated to
    // mirror the jest DETECT_OPEN_HANDLES posture — debug with
    // `VITEST_HANGING_PROCESS=true npx vitest run <file>`.
    reporters:
      process.env.VITEST_HANGING_PROCESS === 'true' ? ['default', 'hanging-process'] : ['default'],
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
          // Laptop memory budget (Equoria-7br8i, user directive 2026-08-18):
          // 2 forks max — the house-wide worker cap (CONTRIBUTING.md
          // "Frontend Vitest Test-Run Budget"). Was 4; each fork is a node
          // child process that, without a heap flag, inherits V8's default
          // old-space (~4GB on a 16GB machine), so 4 unbounded forks could
          // consume the whole laptop. Vitest 4 removed test.poolOptions —
          // fork pool options (singleFork, maxForks) are now top-level
          // (maxWorkers). See https://vitest.dev/guide/migration#pool-rework
          pool: 'forks',
          maxWorkers: 2,
          // Per-fork V8 heap ceiling (Equoria-7br8i). Mirrors the jest
          // posture: 1536MB locally (laptop budget), 4096MB in CI where the
          // runner has dedicated memory — a leaky test file OOMs its own
          // fork instead of paging the whole machine. --expose-gc mirrors
          // the global "expose GC" test rule. Vitest 4 merges project-level
          // execArgv into each fork's node arguments.
          execArgv: [`--max-old-space-size=${process.env.CI ? 4096 : 1536}`, '--expose-gc'],
          // Better isolation between test files
          isolate: true,
          // Distinct sequence.groupOrder runs the unit suite first (0) so the
          // heavier Storybook browser-mode pool starts only after the jsdom
          // forks have finished, avoiding CPU/memory contention between the
          // two pools (Equoria-60h2). Both projects now share maxWorkers: 2
          // under the Equoria-7br8i budget, so Vitest 4's distinct-groupOrder
          // requirement for differing maxWorkers no longer applies — the
          // ordering is kept for contention reasons.
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
          // Run Storybook browser-mode tests AFTER the jsdom unit suite so
          // chromium boot never contends with the unit forks-pool for
          // CPU/memory (Equoria-60h2).
          sequence: {
            groupOrder: 1,
          },
          // Laptop memory budget (Equoria-7br8i): without an explicit cap,
          // Vitest 4's browser pool defaults to min(12, cpus - 1) parallel
          // chromium page-workers (= 12 on the 24-CPU dev machine). Cap at
          // the house-wide 2. execArgv does not apply here — browser
          // workers are chromium pages, not node child processes.
          maxWorkers: 2,
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
