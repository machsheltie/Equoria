import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, 'backend', '.env.test') });

const emailCaptureFile = path.resolve(
  __dirname,
  'test-results',
  'beta-readiness-email-outbox.jsonl'
);

// Export to the Playwright test process as well so latestCapturedEmail() in
// support/prodParity.ts reads the same path the backend writes to, regardless
// of cwd or OS path quoting.
process.env.EMAIL_CAPTURE_FILE = emailCaptureFile;

export default defineConfig({
  testDir: './tests/e2e/readiness',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/beta-readiness', open: 'never' }],
    ['junit', { outputFile: 'test-results/beta-readiness/results.xml' }],
  ],
  outputDir: 'test-results/beta-readiness',
  // Route-families registers 3 players, makes 30+ mutations, and visits 27
  // beta-live routes. Production-parity rate limits (even at the beta-readiness
  // 1000 req/15 min cap) plus real backend round-trips put a realistic run
  // around 2-3 minutes. 5 min gives headroom without masking a hang.
  timeout: 300000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node backend/server.mjs',
      url: 'http://localhost:3001/health',
      // Always start fresh so EMAIL_CAPTURE_FILE reflects the current run.
      // Stale backends from earlier sessions can hold the old env and silently
      // drop email capture, causing latestCapturedEmail() to hang.
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 90000,
      env: {
        ...process.env,
        PORT: '3001',
        NODE_ENV: 'beta-readiness',
        EMAIL_CAPTURE_FILE: emailCaptureFile,
      },
    },
    {
      command: 'npm --prefix frontend run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 90000,
      env: {
        ...process.env,
        VITE_BETA_MODE: 'true',
      },
    },
  ],
  projects: [
    {
      name: 'beta-readiness-prod-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
