import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The beta-readiness suite (tests/e2e/readiness/**) is excluded from this
// config at BOTH levels — see the note above `projects` for why the top-level
// `testIgnore` alone was not enough.
const READINESS = /[\\/]readiness[\\/]/;

// Read from backend/.env.test to get the test database URL
dotenv.config({ path: path.resolve(__dirname, 'backend', '.env.test') });

export default defineConfig({
  testDir: './tests/e2e',
  // tests/e2e/readiness/* is the beta-readiness suite which has its own
  // dedicated config (playwright.beta-readiness.config.ts) and runs in
  // its own CI gate (Beta Readiness Gate). Excluding it from the broader
  // run avoids double-execution and prevents storageState/baseURL config
  // drift between the two configs from showing as broader-suite failures.
  testIgnore: ['**/readiness/**'],
  globalSetup: './tests/e2e/global-setup.ts',
  // Equoria-oye1a: stops the shared-session keep-alive timer and FAILS the run
  // if any renewal failed — see tests/e2e/global-teardown.ts.
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // Local workers capped at 2 per the Test-Run Resource Budget (Equoria-ya5wn,
  // user directive 2026-08-18). `undefined` meant "half the logical cores" —
  // each worker is a full browser context driving the real backend, and the
  // unbounded pool is the same 16GB-laptop OOM class as the jest/vitest ones.
  workers: process.env.CI ? 1 : 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    storageState: 'storageState.json',
  },
  webServer: [
    {
      // Story 21S-3: NODE_ENV=beta — production-parity profile that loads
      // backend/env.beta (no leading dot, matches env.test naming) and enforces
      // real CSRF + real rate-limit middleware.
      // Cross-platform: Windows uses set, Unix uses inline env assignment.
      // EQUORIA_BACKEND_PORT (default 3001) lets the stack run when 3001 is
      // occupied by another local app — reuseExistingServer otherwise "reuses"
      // a foreign server whose /health happens to answer 200 and every API
      // call 404s (hit during Equoria-o5hub.1 baseline capture). The vite
      // proxy reads the same variable.
      command:
        process.platform === 'win32'
          ? `set "PORT=${process.env.EQUORIA_BACKEND_PORT ?? '3001'}" && set "NODE_ENV=beta" && node backend/server.mjs`
          : `PORT=${process.env.EQUORIA_BACKEND_PORT ?? '3001'} NODE_ENV=beta node backend/server.mjs`,
      url: `http://localhost:${process.env.EQUORIA_BACKEND_PORT ?? '3001'}/health`,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 60000,
    },
    {
      command: 'npm --prefix frontend run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 60000,
      env: {
        ...process.env,
        // Story 21S-2 (finalized): VITE_E2E_TEST removed. The frontend now
        // fetches a real CSRF token for every mutation — Playwright exercises
        // the full CSRF round trip under NODE_ENV=beta just like production.
        // Only VITE_BETA_MODE remains to scope nav to beta-live routes.
        VITE_BETA_MODE: 'true',
      },
    },
  ],
  // Equoria-c2erw: a project-level `testIgnore` REPLACES the top-level value —
  // Playwright does not merge the two. Each browser project below declares its
  // own `testIgnore` (to keep the a11y and baseline specs out), which silently
  // dropped the `**/readiness/**` exclusion above, so the beta-readiness suite
  // ran a SECOND time inside the main E2E lane: with the shared authenticated
  // storageState (so mfa-login's `expectUnauthenticated` saw 200, not 401) and
  // without NODE_ENV=beta-readiness / EMAIL_CAPTURE_FILE (so prodParity's
  // latestCapturedEmail() never found a captured mail). Those specs have their
  // own gate — playwright.beta-readiness.config.ts — which supplies both. The
  // exclusion is restated here so every project actually carries it.
  projects: [
    // Equoria-yhg0g: the automated accessibility suite
    // (tests/e2e/accessibility.spec.ts, UX spec 13.4) is its own project so
    // it can run as an independent CI gate without blocking the main E2E
    // lane initially. It is a REAL runnable suite (no test.skip) using real
    // login + real backend. Invoke directly with:
    //   npx playwright test --project=a11y
    // The default browser projects exclude the a11y spec so it does not
    // double-run there.
    {
      name: 'a11y',
      testMatch: /accessibility\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Equoria-o5hub.1: design-system baseline screenshot capture. A capture
    // TOOL (artifacts under tests/e2e/baseline/__screenshots__/), not a CI
    // gate — runs only when invoked directly:
    //   npx playwright test --project=baseline
    // Viewports are driven inside the spec (390/768/1440); the project pins
    // Chrome for rendering consistency across captures.
    {
      name: 'baseline',
      testMatch: /baseline-screenshots\.spec\.ts$/,
      // Full-page captures across 38 routes on a possibly-contended local
      // stack need more headroom than the default 30s.
      timeout: 60000,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: [READINESS, /accessibility\.spec\.ts$/, /baseline-screenshots\.spec\.ts$/],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: [READINESS, /accessibility\.spec\.ts$/, /baseline-screenshots\.spec\.ts$/],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: [READINESS, /accessibility\.spec\.ts$/, /baseline-screenshots\.spec\.ts$/],
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
