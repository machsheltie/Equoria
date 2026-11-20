import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { isCommittedTestSecret } from './backend/utils/runtimeSecretPolicy.mjs';
import { assertE2eTestDatabase, resolveE2eBackendPort } from './tests/e2e/helpers/e2eTestStack.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The beta-readiness suite (tests/e2e/readiness/**) is excluded from this
// config at BOTH levels — see the note above `projects` for why the top-level
// `testIgnore` alone was not enough.
const READINESS = /[\\/]readiness[\\/]/;

// Read from backend/.env.test to get the test database URL
// The NODE_ENV=beta backend below inherits this process's env, which its own
// env.beta cannot override, and .env.test also carries committed test-only
// secrets that a beta backend must never run with. So every variable this load
// adds whose value the backend's own policy (isCommittedTestSecret) classes as
// a committed test secret is removed again: one list, shared with the policy,
// so a pattern it adds later is covered here too. Variables already set before
// the load (CI's workflow secrets) are untouched; locally the backend takes its
// secrets from the gitignored backend/env.beta. No E2E code reads them itself.
const presetEnvKeys = new Set(Object.keys(process.env));
const { parsed: envTest = {} } = dotenv.config({
  path: path.resolve(__dirname, 'backend', '.env.test'),
});
for (const [key, value] of Object.entries(envTest)) {
  if (!presetEnvKeys.has(key) && isCommittedTestSecret(value)) delete process.env[key];
}

// Equoria-8w3ax.2: the owner's dev backend (backend/.env) listens on 3001 and
// uses her game database. Refuse to run unless DATABASE_URL is a local test
// database (tests/e2e/helpers/e2eTestStack.mjs). This runs in the runner and
// in every worker; the backend started below inherits this same DATABASE_URL,
// which its env.beta cannot override.
assertE2eTestDatabase(process.env);

// Equoria-8w3ax.2: the E2E backend's port — 3101 on a laptop, so it never
// collides with (or is mistaken for) the dev backend on 3001; 3001 in CI as
// before; EQUORIA_BACKEND_PORT overrides both. Set on process.env so the Vite
// proxy (frontend/vite.config.ts), every worker and the specs that call the
// backend directly (e2eBackendUrl) all use the same port.
process.env.EQUORIA_BACKEND_PORT = resolveE2eBackendPort(process.env);
const backendPort = process.env.EQUORIA_BACKEND_PORT;

// Equoria-jz9v2 calibration, applied locally as in CI: the e2e-tests job in
// .github/workflows/test.yml sets E2E_RATE_LIMIT_MAX=100000 so one client
// running the whole suite stays under every limiter's ceiling (a finite ceiling,
// honoured only outside production — resolveE2eRateLimitMax). Without it a
// local run enforces e.g. the 30/min profile limit and fast runs fail on 429s
// CI never sees. CI's own value, when set, wins.
process.env.E2E_RATE_LIMIT_MAX ??= '100000';

// Equoria-3juhn: since Equoria-voasj (owner ruling q248) an unconfirmed player
// is refused every gameplay route, so each player this suite registers confirms
// through the real emailed link (tests/e2e/helpers/emailConfirmation.ts). The
// backend's non-production capture sink writes that link to this file. Set on
// process.env so the backend web server (which inherits this env) and every test
// worker (which re-evaluates this config) read the same path. It lives in the
// OS temp directory, not test-results/ (this config's outputDir, which
// Playwright empties at the start of a run). Not deleted here: workers
// re-evaluate the config mid-run, and each player's email is unique, so rows
// left from earlier runs are never picked up.
process.env.EMAIL_CAPTURE_FILE ??= path.join(os.tmpdir(), 'equoria-e2e-email-outbox.jsonl');

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
      // The port is backendPort (above): 3101 locally, 3001 in CI, or
      // EQUORIA_BACKEND_PORT. The vite proxy reads the same variable.
      command:
        process.platform === 'win32'
          ? `set "PORT=${backendPort}" && set "NODE_ENV=beta" && node backend/server.mjs`
          : `PORT=${backendPort} NODE_ENV=beta node backend/server.mjs`,
      url: `http://localhost:${backendPort}/health`,
      // Never reuse (Equoria-8w3ax.2): a server Playwright did not start may be
      // the dev backend on the game database, or a foreign app whose /health
      // answers 200 (Equoria-o5hub.1). If the port is taken Playwright stops
      // with "already used" instead of testing against it.
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 60000,
    },
    {
      command: 'npm --prefix frontend run dev',
      url: 'http://localhost:3000',
      // Never reuse (Equoria-8w3ax.2): a dev frontend already on 3000 proxies
      // /api to the dev backend on 3001 and the game database. Stop it first.
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 60000,
      env: {
        ...process.env,
        // Equoria-8w3ax.2: every API call goes through the Vite proxy to the
        // E2E backend, even if frontend/.env names another API origin.
        VITE_API_URL: '',
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
