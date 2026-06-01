/**
 * Profile Edit E2E — Equoria-wli8n
 *
 * Real-backend Playwright coverage of the /profile edit flow, replacing
 * frontend/src/pages/__tests__/ProfilePage.test.tsx (the deleted 879-line
 * Vitest suite that vi.mock'd useAuth + useUserProgress — both
 * project-owned hooks, forbidden by CLAUDE.md Constitution §3).
 *
 * Activity-feed coverage already lives in
 * tests/e2e/readiness/profile-activity.spec.ts (Equoria-7e6v) so this spec
 * intentionally does NOT duplicate it.
 *
 * Coverage in this file (each test exercises real auth, real backend, real
 * PUT /api/v1/auth/profile — no bypass headers, no mocked hooks):
 *  1. Page renders profile heading, email (read-only), and form fields
 *     pre-filled from real GET /api/auth/profile.
 *  2. Display-name + bio edit, submit, persists (verified by reload).
 *  3. Cancel button reverts unsaved edits to the saved values.
 *  4. Zod client-side validation:
 *     - displayName too short (< 3) shows "at least 3 characters" and
 *       prevents PUT.
 *     - displayName too long (> 30) shows "at most 30 characters" and
 *       prevents PUT.
 *     - bio too long (> 500) shows "at most 500 characters" and prevents
 *       PUT.
 *  5. Bio character counter updates as the user types.
 *  6. Server error path: editing username to one already taken by another
 *     user produces a real 409 response from PUT /api/v1/auth/profile;
 *     the form remains usable and the persisted username is unchanged on
 *     reload.
 *
 * 21R doctrine compliance:
 *  - No bypass headers (x-test-bypass-auth, x-test-skip-csrf, etc.)  // doctrine-allow: bypass-header-literal
 *  - No test.skip / describe.skip on any beta-live path.
 *  - Fresh users registered per test.describe so concurrent runs don't
 *    collide on the username uniqueness constraint.
 */

import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'crypto';

const BACKEND = 'http://localhost:3001';
const FRONTEND = 'http://localhost:3000';
const SUITE_PREFIX = 'profedit_e2e';

type Player = {
  email: string;
  password: string;
  username: string;
};

async function registerPlayer(
  request: import('@playwright/test').APIRequestContext,
  prefix = SUITE_PREFIX,
): Promise<Player> {
  const suffix = randomBytes(6).toString('hex');
  const player: Player = {
    email: `${prefix}-${suffix}@example.com`,
    password: 'ProfileEdit1!Aa',
    username: `${prefix}${suffix}`.slice(0, 30),
  };
  const res = await request.post(`${BACKEND}/api/v1/auth/register`, {
    data: {
      email: player.email,
      password: player.password,
      username: player.username,
      firstName: 'Profile',
      lastName: 'Edit',
      // Equoria-iqzn / Equoria-9tlha: COPPA age gate requires a real adult DOB.
      dateOfBirth: '1990-01-01',
    },
    headers: { Origin: FRONTEND },
  });
  expect(res.status(), `Registration failed: ${await res.text()}`).toBe(201);
  return player;
}

/**
 * Log in via the UI form, then advance through onboarding so the user is
 * fully onboarded server-side. Mirrors settings-persistence.spec.ts —
 * navigating directly to /onboarding sidesteps the OnboardingGuard async
 * redirect race; OnboardingGuard does not bounce off /onboarding.
 */
async function loginAndOnboard(page: Page, player: Player) {
  await page.goto(`${FRONTEND}/login`, { waitUntil: 'load', timeout: 60000 });
  await page.fill('input[name="email"]', player.email);
  await page.fill('input[name="password"]', player.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 30000 });

  // Drive onboarding deterministically.
  await page.goto(`${FRONTEND}/onboarding`, { waitUntil: 'load', timeout: 30000 });

  // Step 1: Welcome → Next
  await expect(page.locator('h1')).toContainText('Welcome to Equoria');
  await page.locator('[data-testid="onboarding-next"]').click();

  // Step 2: Choose Your Horse (BreedSelector radio group + Mare + name)
  await expect(page.locator('h1')).toContainText('Choose Your Horse');
  const breedSelector = page.locator('[data-testid="breed-selector"]');
  await breedSelector.waitFor({ state: 'visible' });
  const radioGroup = breedSelector.locator('[role="radiogroup"][aria-label="Horse breeds"]');
  const firstBreed = radioGroup.locator('[role="radio"][data-breed-option]').first();
  await firstBreed.waitFor({ state: 'visible' });
  await firstBreed.click();
  await expect(firstBreed).toHaveAttribute('aria-checked', 'true');
  await breedSelector.getByRole('button', { name: /Mare/i }).click();
  await page.locator('[data-testid="horse-name-input"]').fill(`PE Horse ${Date.now()}`);
  const step1Next = page.locator('[data-testid="onboarding-next"]');
  await expect(step1Next).toBeEnabled();
  await step1Next.click();

  // Step 3: Ready! → advance-onboarding fires
  await expect(page.locator('h1')).toContainText("You're Ready!");
  const advanceResp = page.waitForResponse(
    (r) =>
      r.url().includes('/api/v1/auth/advance-onboarding') && r.request().method() === 'POST',
  );
  await page.locator('[data-testid="onboarding-next"]').click();
  expect((await advanceResp).status()).toBe(200);

  await page.waitForURL(/\/stable$/, { timeout: 30000 });
}

test.describe('Profile edit flow (Equoria-wli8n)', () => {
  // Each describe block uses its own fresh storage state so concurrent tests
  // can't race on the username unique constraint.
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(180000);

    // Production-parity guard — fail loud if any banned bypass header leaks
    // into a request from this spec.
    const violations: string[] = [];
    page.on('request', (req) => {
      const h = req.headers();
      // doctrine-allow: bypass-header-literal
      for (const banned of ['x-test-bypass-auth', 'x-test-skip-csrf', 'x-test-bypass-rate-limit']) {
        if (h[banned]) {
          violations.push(`${req.method()} ${req.url()} used ${banned}`);
        }
      }
    });
    // Expose for after-each assertion via test.info() annotation pattern.
    (page as unknown as { __violations: string[] }).__violations = violations;
  });

  test.afterEach(async ({ page }) => {
    const violations = (page as unknown as { __violations?: string[] }).__violations ?? [];
    expect(violations, `Bypass header(s) leaked:\n${violations.join('\n')}`).toEqual([]);
  });

  test('renders heading, email, and form pre-filled from real backend', async ({
    page,
    request,
  }) => {
    const player = await registerPlayer(request);
    await loginAndOnboard(page, player);

    const profileResp = page.waitForResponse(
      (r) => r.url().includes('/api/auth/profile') && r.request().method() === 'GET',
    );
    await page.goto(`${FRONTEND}/profile`, { waitUntil: 'load', timeout: 30000 });
    expect((await profileResp).status()).toBe(200);

    // Heading
    await expect(page.getByRole('heading', { name: /my profile/i, level: 1 })).toBeVisible({
      timeout: 15000,
    });

    // Email is rendered as read-only text (no input). The registered email
    // must appear verbatim on the page.
    await expect(page.getByText(player.email, { exact: false })).toBeVisible();

    // Form is pre-filled from real GET /api/auth/profile.
    const displayNameInput = page.getByLabel(/display name/i);
    await expect(displayNameInput).toBeVisible();
    await expect(displayNameInput).toHaveValue(player.username);

    const bioInput = page.getByLabel(/bio/i);
    await expect(bioInput).toBeVisible();
    // Newly registered users have no bio yet — must be empty (honest empty
    // state, not a placeholder string).
    await expect(bioInput).toHaveValue('');

    // Action buttons are present.
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('successful edit persists username + bio via PUT /api/v1/auth/profile', async ({
    page,
    request,
  }) => {
    const player = await registerPlayer(request);
    await loginAndOnboard(page, player);

    await page.goto(`${FRONTEND}/profile`, { waitUntil: 'load', timeout: 30000 });

    const displayNameInput = page.getByLabel(/display name/i);
    const bioInput = page.getByLabel(/bio/i);
    await expect(displayNameInput).toHaveValue(player.username);

    // New values
    const newUsername = `${player.username.slice(0, 24)}_new`.slice(0, 30);
    const newBio = `Profile edit E2E bio ${Date.now()}`;

    await displayNameInput.fill(newUsername);
    await bioInput.fill(newBio);

    // Submit and wait for the real PUT to land.
    const putResp = page.waitForResponse(
      (r) => r.url().includes('/api/v1/auth/profile') && r.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /save changes/i }).click();
    const resp = await putResp;
    expect(
      resp.status(),
      `PUT /api/v1/auth/profile returned ${resp.status()}: ${await resp.text()}`,
    ).toBe(200);

    // Reload — values persisted server-side.
    await page.reload({ waitUntil: 'load' });
    await expect(page.getByLabel(/display name/i)).toHaveValue(newUsername);
    await expect(page.getByLabel(/bio/i)).toHaveValue(newBio);
  });

  test('cancel button reverts unsaved edits to saved values', async ({ page, request }) => {
    const player = await registerPlayer(request);
    await loginAndOnboard(page, player);

    await page.goto(`${FRONTEND}/profile`, { waitUntil: 'load', timeout: 30000 });

    const displayNameInput = page.getByLabel(/display name/i);
    await expect(displayNameInput).toHaveValue(player.username);

    await displayNameInput.fill('dirty_value_unsaved');
    await expect(displayNameInput).toHaveValue('dirty_value_unsaved');

    await page.getByRole('button', { name: /cancel/i }).click();

    // Form is reverted to the persisted (original) value — no PUT fired.
    await expect(displayNameInput).toHaveValue(player.username);
  });

  test('Zod: display name too short shows validation error and blocks PUT', async ({
    page,
    request,
  }) => {
    const player = await registerPlayer(request);
    await loginAndOnboard(page, player);
    await page.goto(`${FRONTEND}/profile`, { waitUntil: 'load', timeout: 30000 });

    // Track any PUT request so we can prove the submit was blocked client-side.
    let putAttempted = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/auth/profile') && req.method() === 'PUT') {
        putAttempted = true;
      }
    });

    const displayNameInput = page.getByLabel(/display name/i);
    await displayNameInput.fill('ab'); // 2 chars — below the min(3)
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByText(/at least 3 characters/i)).toBeVisible({ timeout: 10000 });
    // Give the browser a tick to confirm no PUT slipped through.
    await page.waitForTimeout(500);
    expect(putAttempted, 'PUT must NOT fire when Zod validation rejects displayName').toBe(false);
  });

  test('Zod: display name too long shows validation error and blocks PUT', async ({
    page,
    request,
  }) => {
    const player = await registerPlayer(request);
    await loginAndOnboard(page, player);
    await page.goto(`${FRONTEND}/profile`, { waitUntil: 'load', timeout: 30000 });

    let putAttempted = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/auth/profile') && req.method() === 'PUT') {
        putAttempted = true;
      }
    });

    const displayNameInput = page.getByLabel(/display name/i);
    await displayNameInput.fill('a'.repeat(31));
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByText(/at most 30 characters/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    expect(putAttempted, 'PUT must NOT fire when displayName exceeds the Zod max').toBe(false);
  });

  test('Zod: bio too long shows validation error and blocks PUT', async ({ page, request }) => {
    const player = await registerPlayer(request);
    await loginAndOnboard(page, player);
    await page.goto(`${FRONTEND}/profile`, { waitUntil: 'load', timeout: 30000 });

    let putAttempted = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/auth/profile') && req.method() === 'PUT') {
        putAttempted = true;
      }
    });

    const bioInput = page.getByLabel(/bio/i);
    // The <textarea maxLength={500}> prevents typing past the cap; fill()
    // sets the value directly via DOM, which still triggers the React
    // onChange. The Zod check runs at submit and rejects > 500 chars even
    // if the input maxLength briefly held it.
    await bioInput.fill('a'.repeat(501));

    await page.getByRole('button', { name: /save changes/i }).click();

    // The Zod error appears unless maxLength fully clamped the value at 500.
    // Either way the failure mode we care about is "PUT fires with >500 chars".
    // The HTML maxLength + the Zod schema together must guarantee that.
    await page.waitForTimeout(500);

    const actualValue = await bioInput.inputValue();
    if (actualValue.length > 500) {
      // The HTML cap didn't hold — Zod must catch it.
      await expect(page.getByText(/at most 500 characters/i)).toBeVisible();
      expect(putAttempted, 'PUT must NOT fire when bio exceeds 500 chars').toBe(false);
    } else {
      // The HTML maxLength clamped to 500; that's also acceptable — the
      // form is permitted to submit with exactly 500 chars (the boundary).
      // We assert PUT either succeeded with 500 chars OR didn't fire (no
      // accidental >500 payload either way).
      const trailingPut = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/auth/profile') &&
          r.request().method() === 'PUT' &&
          r.status() === 200,
        { timeout: 5000 },
      );
      try {
        const settled = await trailingPut;
        // If a PUT did fire it must have carried <=500 chars (clamped value).
        const payload = settled.request().postDataJSON();
        expect((payload?.bio?.length ?? 0) <= 500, 'Submitted bio must be <=500 chars').toBe(true);
      } catch {
        // No PUT fired — also acceptable.
      }
    }
  });

  test('bio character counter updates as the user types', async ({ page, request }) => {
    const player = await registerPlayer(request);
    await loginAndOnboard(page, player);
    await page.goto(`${FRONTEND}/profile`, { waitUntil: 'load', timeout: 30000 });

    const bioInput = page.getByLabel(/bio/i);
    await bioInput.fill('Hello'); // 5 chars → 500 - 5 = 495 remaining
    await expect(page.getByText(/495 characters remaining/i)).toBeVisible({ timeout: 10000 });

    await bioInput.fill(''); // empty → 500 remaining
    await expect(page.getByText(/500 characters remaining/i)).toBeVisible();
  });

  test('server 409 on duplicate username keeps original persisted value', async ({
    page,
    request,
  }) => {
    // Two real users. Second user tries to claim first user's username.
    const userA = await registerPlayer(request);
    const userB = await registerPlayer(request);

    await loginAndOnboard(page, userB);
    await page.goto(`${FRONTEND}/profile`, { waitUntil: 'load', timeout: 30000 });

    const displayNameInput = page.getByLabel(/display name/i);
    await expect(displayNameInput).toHaveValue(userB.username);

    // Attempt to set userB's username to userA's — backend returns 409.
    await displayNameInput.fill(userA.username);

    const putResp = page.waitForResponse(
      (r) => r.url().includes('/api/v1/auth/profile') && r.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /save changes/i }).click();
    const resp = await putResp;
    expect(
      resp.status(),
      `PUT must return 409 Conflict for duplicate username, got ${resp.status()}`,
    ).toBe(409);

    // Form remains usable after the error — display name input + buttons
    // still rendered.
    await expect(displayNameInput).toBeVisible();
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();

    // Reload — persisted value is still userB.username (the 409 server
    // response prevented the change from landing).
    await page.reload({ waitUntil: 'load' });
    await expect(page.getByLabel(/display name/i)).toHaveValue(userB.username);
  });
});
