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
        // Story 21S-2: VITE_E2E_TEST removed — frontend now fetches real CSRF
        // tokens like beta/production. Only VITE_BETA_MODE remains for nav scope.
        VITE_BETA_MODE: 'true',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
