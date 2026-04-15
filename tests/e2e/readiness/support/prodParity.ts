import { expect, type APIResponse, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BANNED_HEADERS = [
  'x-test-skip-csrf',
  'x-test-bypass-auth',
  'x-test-bypass-rate-limit',
] as const;

export type RegisteredPlayer = {
  email: string;
  password: string;
  username: string;
  horse: Record<string, unknown>;
};

export function installProductionParityNetworkGuard(page: Page) {
  const violations: string[] = [];

  page.on('request', (request) => {
    const headers = request.headers();
    for (const header of BANNED_HEADERS) {
      if (headers[header]) {
        violations.push(`${request.method()} ${request.url()} used ${header}`);
      }
    }
  });

  return {
    assertClean() {
      expect(violations, violations.join('\n')).toEqual([]);
    },
  };
}

export async function expectOk(response: APIResponse, label: string) {
  const text = await response.text();
  expect(response.ok(), `${label} failed with ${response.status()}: ${text}`).toBe(true);
  return text ? JSON.parse(text) : {};
}

export function unwrapData<T = unknown>(json: unknown): T {
  return ((json as Record<string, unknown>)?.data ?? json) as T;
}

export async function csrfRequest(
  page: Page,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: unknown
) {
  const tokenResponse = await page.request.get('/api/auth/csrf-token');
  const tokenJson = await expectOk(tokenResponse, 'GET /api/auth/csrf-token');
  const csrfToken = tokenJson.csrfToken;
  expect(typeof csrfToken, 'CSRF token must be returned by the real token endpoint').toBe('string');
  expect(csrfToken.length, 'CSRF token must be non-empty').toBeGreaterThan(20);

  return page.request.fetch(url, {
    method,
    data,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
  });
}

export async function registerAndCompleteOnboarding(
  page: Page,
  suffix: string,
  horseName = `Readiness Horse ${suffix}`
): Promise<RegisteredPlayer> {
  const safeSuffix = suffix.replace(/[^a-zA-Z0-9_]/g, '_');
  const email = `readiness_${safeSuffix}@example.com`;
  const username = `rd_${safeSuffix}`.slice(0, 30);
  const password = 'Password123!';

  await page.goto('/register', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h2')).toContainText('Join the Realm');

  await page.fill('input[name="firstName"]', 'Beta');
  await page.fill('input[name="lastName"]', 'Readiness');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);

  const registerResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/register') && response.request().method() === 'POST'
  );
  await page.click('button[type="submit"]');
  expect((await registerResponse).status()).toBe(201);

  await page.waitForURL(/\/onboarding$/);
  await expect(page.locator('h1')).toContainText('Welcome to Equoria');
  await page.locator('[data-testid="onboarding-next"]').click();

  await expect(page.locator('h1')).toContainText('Choose Your Horse');
  const breedSelect = page.locator('[data-testid="breed-select"]');
  await breedSelect.waitFor({ state: 'visible' });
  await breedSelect.selectOption({ index: 1 });
  await page.getByRole('button', { name: /Mare/i }).click();
  await page.locator('[data-testid="horse-name-input"]').fill(horseName);
  await page.locator('[data-testid="onboarding-next"]').click();

  await expect(page.locator('h1')).toContainText("You're Ready!");
  const advanceResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/advance-onboarding') &&
      response.request().method() === 'POST'
  );
  await page.locator('[data-testid="onboarding-next"]').click();
  expect((await advanceResponse).status()).toBe(200);

  await page.waitForURL(/\/stable$/);
  await expect(page.getByText(horseName).first()).toBeVisible();

  const horsesResponse = await page.request.get('/api/horses');
  const horsesJson = await expectOk(horsesResponse, 'GET /api/horses after onboarding');
  const horses = unwrapData<Record<string, unknown>[]>(horsesJson);
  const horse = horses.find((item) => item.name === horseName);
  expect(horse, `Starter horse ${horseName} must persist in backend`).toBeTruthy();

  return { email, password, username, horse: horse! };
}

export async function loginViaUi(page: Page, player: Pick<RegisteredPlayer, 'email' | 'password'>) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h2')).toContainText('Welcome Back');
  await page.fill('input[name="email"]', player.email);
  await page.fill('input[name="password"]', player.password);

  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/login') && response.request().method() === 'POST'
  );
  await page.click('button[type="submit"]');
  expect((await loginResponse).status()).toBe(200);
  await page.waitForURL('/');
}

export async function visitLiveRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).not.toContainText('Something went wrong');
  await expect(page.locator('body')).not.toContainText('Not available in this beta');
}

export async function latestCapturedEmail(kind: string, to: string) {
  const captureFile =
    process.env.EMAIL_CAPTURE_FILE ||
    path.resolve(process.cwd(), 'test-results', 'beta-readiness-email-outbox.jsonl');

  await expect
    .poll(
      () => {
        if (!fs.existsSync(captureFile)) return null;
        const rows = fs
          .readFileSync(captureFile, 'utf-8')
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        return rows.reverse().find((row) => row.kind === kind && row.to === to) ?? null;
      },
      { timeout: 10000 }
    )
    .not.toBeNull();

  const rows = fs
    .readFileSync(captureFile, 'utf-8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return rows.reverse().find((row) => row.kind === kind && row.to === to);
}
