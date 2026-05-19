import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
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
      command:
        process.platform === 'win32'
          ? 'set "PORT=3001" && set "NODE_ENV=beta" && node backend/server.mjs'
          : 'PORT=3001 NODE_ENV=beta node backend/server.mjs',
      url: 'http://localhost:3001/health',
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
    {
      name: 'chromium',
      testIgnore: /accessibility\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: /accessibility\.spec\.ts$/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: /accessibility\.spec\.ts$/,
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
