import { chromium, type FullConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup(config: FullConfig) {
  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', (msg) => console.log(`BROWSER LOG: ${msg.text()}`));
  page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));

  try {
    // 1. Navigate to register
    console.log('Navigating to:', baseURL + '/register');
    await page.goto(baseURL + '/register', { waitUntil: 'networkidle', timeout: 60000 });

    // 2. Register a unique test user for this session
    const timestamp = Date.now();
    const username = `e2e_user_${timestamp}`;
    const email = `e2e_${timestamp}@example.com`;

    console.log('Registering user:', username);
    await page.fill('input[name="firstName"]', 'E2E');
    await page.fill('input[name="lastName"]', 'Tester');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'Password123!');
    await page.fill('input[name="confirmPassword"]', 'Password123!');

    console.log('Clicking Submit...');
    await page.click('button[type="submit"]');

    // 3. Wait for navigation to home/dashboard
    console.log('Waiting for navigation to home...');
    try {
      await page.waitForURL(baseURL + '/', { timeout: 30000 });
    } catch (e) {
      console.log('Navigation to home failed/timed out');
      await page.screenshot({ path: 'setup-failure.png' });
      throw e;
    }

    // 4. Save storage state
    await page.context().storageState({ path: storageState as string });
    console.log('Global setup complete. Storage state saved.');
  } catch (error) {
    console.error('Global setup failed:', error);
  } finally {
    await browser.close();
  }
}

export default globalSetup;
