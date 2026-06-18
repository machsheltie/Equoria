import { expect, type APIResponse, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BANNED_HEADERS = [
  'x-test-skip-csrf', // doctrine-allow: bypass-header-literal
  'x-test-bypass-auth', // doctrine-allow: bypass-header-literal
  'x-test-bypass-rate-limit', // doctrine-allow: bypass-header-literal
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
  // 21R-AUTH-7 removed /api/auth backward-compat mount; canonical path is /api/v1/auth
  const tokenResponse = await page.request.get('/api/v1/auth/csrf-token');
  const tokenJson = await expectOk(tokenResponse, 'GET /api/v1/auth/csrf-token');
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
  // Equoria-iqzn / Equoria-9tlha: COPPA age gate requires a valid adult DOB.
  await page.fill('input[name="dateOfBirth"]', '1990-01-01');
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);

  const registerResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/auth/register') && response.request().method() === 'POST'
  );
  await page.click('button[type="submit"]');
  expect((await registerResponse).status()).toBe(201);

  await page.waitForURL(/\/onboarding$/);
  await expect(page.locator('h1')).toContainText('Welcome to Equoria');
  await page.locator('[data-testid="onboarding-next"]').click();

  await expect(page.locator('h1')).toContainText('Choose Your Horse');
  // Equoria-zanq / Spec 11.3.4: the onboarding breed picker was redesigned from
  // a plain <select data-testid="breed-select"> into a WAI-ARIA radiogroup
  // (BreedSelector — grid of button[role="radio"] cards, each tagged with
  // data-breed-option="<breedId>"). Drive the real radiogroup UI: select the
  // first breed option, capture its real backend breed id for the
  // post-onboarding persistence assertions, then gender + name.
  const breedSelector = page.locator('[data-testid="breed-selector"]');
  await breedSelector.waitFor({ state: 'visible' });
  const breedRadioGroup = breedSelector.locator('[role="radiogroup"][aria-label="Horse breeds"]');
  const firstBreedOption = breedRadioGroup.locator('[role="radio"][data-breed-option]').first();
  await firstBreedOption.waitFor({ state: 'visible' });
  const breedOptionAttr = await firstBreedOption.getAttribute('data-breed-option');
  expect(
    breedOptionAttr,
    'First breed option must expose a numeric data-breed-option'
  ).toBeTruthy();
  const expectedBreedId = Number(breedOptionAttr);
  expect(
    Number.isFinite(expectedBreedId) && expectedBreedId > 0,
    `data-breed-option must be a positive breed id, got "${breedOptionAttr}"`
  ).toBe(true);
  await firstBreedOption.click();
  await expect(firstBreedOption).toHaveAttribute('aria-checked', 'true');
  // Gender + name live inside the same BreedSelector. The Mare button renders
  // as "♀ Mare"; accessible name still matches /Mare/i. Scope to the selector
  // so we never pick up an unrelated control.
  await breedSelector.getByRole('button', { name: /Mare/i }).click();
  await page.locator('[data-testid="horse-name-input"]').fill(horseName);
  // Step 1's Next is disabled until breed+gender+name are all set (see
  // OnboardingPage isStep1Complete). Wait for it to enable before clicking so
  // the click can't race the React state update.
  const step1Next = page.locator('[data-testid="onboarding-next"]');
  await expect(step1Next).toBeEnabled();
  await step1Next.click();

  await expect(page.locator('h1')).toContainText("You're Ready!");
  const advanceResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/auth/advance-onboarding') &&
      response.request().method() === 'POST'
  );
  await page.locator('[data-testid="onboarding-next"]').click();
  expect((await advanceResponse).status()).toBe(200);

  await page.waitForURL(/\/stable$/);
  await expect(page.getByText(horseName).first()).toBeVisible();

  const horsesResponse = await page.request.get('/api/v1/horses');
  const horsesJson = await expectOk(horsesResponse, 'GET /api/horses after onboarding');
  const horses = unwrapData<Record<string, unknown>[]>(horsesJson);
  const horse = horses.find((item) => item.name === horseName);
  expect(horse, `Starter horse ${horseName} must persist in backend`).toBeTruthy();

  // Assert breedId and sex/gender were persisted correctly by advance-onboarding (Equoria-fse0)
  const persistedBreedId = horse!.breedId as number | undefined;
  expect(
    persistedBreedId,
    `Starter horse breedId must be persisted: expected ${expectedBreedId}, got ${persistedBreedId}`
  ).toBe(expectedBreedId);

  const persistedSex = (horse!.sex ?? horse!.gender) as string | undefined;
  expect(persistedSex, `Starter horse sex must be persisted as 'Mare', got '${persistedSex}'`).toBe(
    'Mare'
  );

  return { email, password, username, horse: horse! };
}

export async function loginViaUi(page: Page, player: Pick<RegisteredPlayer, 'email' | 'password'>) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h2')).toContainText('Welcome Back');
  await page.fill('input[name="email"]', player.email);
  await page.fill('input[name="password"]', player.password);

  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST'
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
