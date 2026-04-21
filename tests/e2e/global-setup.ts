import { chromium, expect, type FullConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Path where test credentials are saved for reuse in login-flow test */
export const CREDENTIALS_FILE = path.resolve(__dirname, 'test-credentials.json');

async function globalSetup(config: FullConfig) {
  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', (msg) => console.log(`BROWSER LOG: ${msg.text()}`));
  page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));

  // Unique credentials per run
  const timestamp = Date.now();
  const username = `e2e_user_${timestamp}`;
  const email = `e2e_${timestamp}@example.com`;
  const password = 'Password123!';

  try {
    // ── 1. Register test user via UI ─────────────────────────────────────────
    // Auth rate limiter uses skipSuccessfulRequests:true with max:200 failed attempts.
    // Successful registrations/logins are never counted, so no bypass needed.
    console.log('Navigating to:', baseURL + '/register');
    // Use 'load' (not 'networkidle') — Vite's HMR WebSocket keeps the page permanently
    // "active" so networkidle never fires, causing a 60-second timeout per navigation.
    await page.goto(baseURL + '/register', { waitUntil: 'load', timeout: 60000 });

    console.log('Registering user:', username);
    await page.fill('input[name="firstName"]', 'E2E');
    await page.fill('input[name="lastName"]', 'Tester');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);

    console.log('Clicking Submit...');
    await page.click('button[type="submit"]');

    // ── 2. Wait for post-registration redirect ──────────────────────────────
    // New users may land on / or /onboarding (OnboardingGuard redirects new users)
    console.log('Waiting for navigation after registration...');
    try {
      await page.waitForURL(
        new RegExp(`^${baseURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(onboarding)?$`),
        { timeout: 30000 }
      );
    } catch (e) {
      console.log('Navigation after registration failed/timed out, current URL:', page.url());
      await page.screenshot({ path: 'setup-failure.png' });
      throw e;
    }

    // If redirected to /onboarding, complete it so the user is fully set up
    if (page.url().includes('/onboarding')) {
      console.log('Completing onboarding wizard...');

      // Step 0 (Welcome) → click Continue
      await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });
      await page.locator('[data-testid="onboarding-next"]').click();

      // Step 1 (Choose Your Horse) → select breed, gender, name, then click Continue
      await expect(page.locator('h1')).toContainText('Choose Your Horse', { timeout: 10000 });
      // Wait for breed select to load (native <select data-testid="breed-select">)
      const breedSelect = page.locator('[data-testid="breed-select"]');
      await breedSelect.waitFor({ state: 'visible', timeout: 15000 });
      // index 0 is the disabled placeholder; index 1 is the first real breed
      await breedSelect.selectOption({ index: 1 });
      // Select Mare gender
      await page.locator('button', { hasText: '♀ Mare' }).click();
      // Enter horse name
      await page.locator('[data-testid="horse-name-input"]').fill(`E2E Setup Horse ${timestamp}`);
      // Continue to step 2
      await page.locator('[data-testid="onboarding-next"]').click();

      // Step 2 (Ready) -> click "Begin" to customize the starter horse via advance-onboarding.
      await expect(page.locator('h1')).toContainText("You're Ready!", { timeout: 10000 });
      await page.locator('[data-testid="onboarding-next"]').click();

      // After onboarding completes, navigate to /stable
      try {
        await page.waitForURL(
          new RegExp(`${baseURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/stable`),
          { timeout: 20000 }
        );
        console.log('Onboarding complete — landed on /stable');
      } catch {
        console.log('Post-onboarding navigation URL:', page.url());
      }
    }

    // ── 3. Save storageState (auth cookies) for all authenticated tests ──────
    await page.context().storageState({ path: storageState as string });
    console.log('Storage state saved.');

    // ── 4. Persist credentials so login-flow test can fill them ─────────────
    const creds: Record<string, string | number> = { email, password, username };
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf-8');
    console.log('Credentials saved:', CREDENTIALS_FILE);

    // ── 5. Reuse the real starter horse created by registration/onboarding ───
    console.log('Fetching starter horse created during onboarding...');
    const horsesRes = await page.request.get(`${baseURL}/api/horses`);
    if (horsesRes.ok()) {
      const horsesJson = await horsesRes.json();
      const horses = horsesJson?.data ?? horsesJson ?? [];
      const starterHorse = Array.isArray(horses) ? horses[0] : null;
      if (starterHorse?.id) {
        console.log('Starter horse id:', starterHorse.id);
        creds.testHorseId = starterHorse.id;
        fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf-8');
      }
    } else {
      console.warn('Starter horse lookup failed:', horsesRes.status(), await horsesRes.text());
    }

    console.log('Global setup complete.');
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
