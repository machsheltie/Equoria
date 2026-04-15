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
  timeout: 120000,
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
      command:
        process.platform === 'win32'
          ? "powershell -NoProfile -Command \"$env:PORT=3001; $env:NODE_ENV='test'; $env:EMAIL_CAPTURE_FILE='" +
            emailCaptureFile.replace(/\\/g, '\\\\') +
            '\'; node backend/server.mjs"'
          : `PORT=3001 NODE_ENV=test EMAIL_CAPTURE_FILE="${emailCaptureFile}" node backend/server.mjs`,
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 90000,
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
