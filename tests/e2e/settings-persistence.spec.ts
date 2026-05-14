/**
 * Settings Persistence E2E — Story 21S-5 (Equoria-9vat)
 *
 * Verifies end-to-end that the /settings Notifications and Display preference
 * toggles persist across full page reloads. The test exercises the real
 * PATCH /api/v1/auth/profile/preferences endpoint and confirms the value is
 * hydrated from the server on reload — not from localStorage.
 *
 * Pattern: register + login via API (same style as session-lifetime.spec.ts),
 * then drive the browser through the UI.
 *
 * 21R doctrine compliant:
 * - No bypass headers (x-test-bypass-auth, x-test-skip-csrf, x-test-user, …)
 * - No test.skip on any step including the reload-verify step
 * - Real authenticated session (register/login via API)
 * - Backend at http://localhost:3001, frontend at http://localhost:3000
 */

import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';

const BACKEND = 'http://localhost:3001';
const FRONTEND = 'http://localhost:3000';
const SUITE_PREFIX = 'setpref_e2e';

test.describe('Settings preferences persistence (21S-5)', () => {
  // Fresh session — no storageState from global-setup user
  test.use({ storageState: { cookies: [], origins: [] } });

  let userEmail: string;
  let userPassword: string;
  let username: string;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120000);

    const suffix = randomBytes(6).toString('hex');
    userEmail = `${SUITE_PREFIX}-${suffix}@example.com`;
    userPassword = 'SetPrefE2e1!Aa';
    username = `${SUITE_PREFIX}${suffix}`;

    const reg = await request.post(`${BACKEND}/api/auth/register`, {
      data: {
        email: userEmail,
        password: userPassword,
        username,
        firstName: 'SetPref',
        lastName: 'E2e',
      },
      headers: { Origin: FRONTEND },
    });
    expect(reg.status(), `Registration failed: ${await reg.text()}`).toBe(201);
  });

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup — log in to get token then log out.
    // Non-fatal if it fails (user was never created or already cleaned up).
    try {
      const loginRes = await request.post(`${BACKEND}/api/auth/login`, {
        data: { email: userEmail, password: userPassword },
        headers: { Origin: FRONTEND },
      });
      if (loginRes.status() === 200) {
        const { data } = await loginRes.json();
        const csrfToken = data?.csrfToken ?? '';
        const loginCookies = loginRes.headers()['set-cookie'] ?? '';
        await request.post(`${BACKEND}/api/auth/logout`, {
          headers: {
            Origin: FRONTEND,
            Cookie: loginCookies,
            'X-CSRF-Token': csrfToken,
          },
        });
      }
    } catch {
      // non-fatal
    }
  });

  /**
   * Helper: log in via the UI login form and wait until authentication
   * cookies are set and the user lands past the login page.
   * Handles the onboarding redirect that new users see after first login.
   */
  async function loginViaUI(page: import('@playwright/test').Page) {
    await page.goto(FRONTEND + '/login', { waitUntil: 'load', timeout: 60000 });
    await page.fill('input[name="email"]', userEmail);
    await page.fill('input[name="password"]', userPassword);
    await page.click('button[type="submit"]');

    // Wait for post-login navigation — new users land on /onboarding or /
    await page.waitForURL(new RegExp(`${FRONTEND}/(onboarding|$)`), {
      timeout: 30000,
    });

    // Complete the onboarding wizard if redirected there
    if (page.url().includes('/onboarding')) {
      // Step 1 (Welcome) → click Continue
      await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });
      await page.locator('[data-testid="onboarding-next"]').click();

      // Step 2 (Choose Your Horse) → select first breed, pick Mare, name horse
      await expect(page.locator('h1')).toContainText('Choose Your Horse', { timeout: 10000 });
      const breedSelect = page.locator('[data-testid="breed-select"]');
      await breedSelect.waitFor({ state: 'visible', timeout: 15000 });
      await breedSelect.selectOption({ index: 1 });
      await page.locator('button', { hasText: '♀ Mare' }).click();
      await page
        .locator('[data-testid="horse-name-input"]')
        .fill(`SetPref Test Horse ${Date.now()}`);
      await page.locator('[data-testid="onboarding-next"]').click();

      // Step 3 (Ready) → click Begin / Continue
      await expect(page.locator('h1')).toContainText("You're Ready!", { timeout: 10000 });
      await page.locator('[data-testid="onboarding-next"]').click();

      // Wait for redirect out of /onboarding
      await page.waitForURL((url) => !url.href.includes('/onboarding'), { timeout: 20000 });
    }
  }

  // ---------------------------------------------------------------------------
  // Test 1: emailCompetition preference — toggle off, reload, verify persisted
  // ---------------------------------------------------------------------------
  test('toggling emailCompetition off persists after full page reload', async ({ page }) => {
    test.setTimeout(120000);

    await loginViaUI(page);

    // Navigate to /settings
    await page.goto(FRONTEND + '/settings', { waitUntil: 'load', timeout: 30000 });
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible({ timeout: 15000 });

    // Click the Notifications nav tab
    await page.locator('[data-testid="settings-nav-notifications"]').click();
    await expect(page.locator('[data-testid="settings-notifications"]')).toBeVisible({
      timeout: 10000,
    });

    // Find the emailCompetition toggle (role=switch inside the Toggle wrapper)
    const emailCompetitionToggle = page
      .locator('[data-testid="notif-email-competition"]')
      .locator('button[role="switch"]');

    // emailCompetition defaults to true — verify it's currently on
    await expect(emailCompetitionToggle).toHaveAttribute('aria-checked', 'true', { timeout: 5000 });

    // Intercept PATCH to assert the payload — 21R compliant (assertion only, no route override)
    const patchPromise = page.waitForRequest(
      (req) => req.url().includes('/api/v1/auth/profile/preferences') && req.method() === 'PATCH',
      { timeout: 15000 }
    );

    // Click the toggle to turn emailCompetition OFF
    await emailCompetitionToggle.click();

    // Wait for the PATCH to fire and assert it contains { emailCompetition: false }
    const patchRequest = await patchPromise;
    const patchBody = patchRequest.postDataJSON() as Record<string, unknown>;
    expect(patchBody).toMatchObject({ emailCompetition: false });

    // Wait for the PATCH response to complete before reloading
    await page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/auth/profile/preferences') &&
        res.request().method() === 'PATCH',
      { timeout: 15000 }
    );

    // ── Reload and verify the preference was persisted on the server ──────────
    await page.goto(FRONTEND + '/settings', { waitUntil: 'load', timeout: 30000 });
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible({ timeout: 15000 });

    // Navigate back to notifications tab after reload
    await page.locator('[data-testid="settings-nav-notifications"]').click();
    await expect(page.locator('[data-testid="settings-notifications"]')).toBeVisible({
      timeout: 10000,
    });

    // The toggle must still be OFF — hydrated from server, not localStorage
    const toggleAfterReload = page
      .locator('[data-testid="notif-email-competition"]')
      .locator('button[role="switch"]');
    await expect(toggleAfterReload).toHaveAttribute('aria-checked', 'false', { timeout: 10000 });
  });

  // ---------------------------------------------------------------------------
  // Test 2: reducedMotion preference — toggle on, reload, verify persisted
  // ---------------------------------------------------------------------------
  test('toggling reducedMotion on persists after full page reload', async ({ page }) => {
    test.setTimeout(120000);

    await loginViaUI(page);

    // Navigate to /settings
    await page.goto(FRONTEND + '/settings', { waitUntil: 'load', timeout: 30000 });
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible({ timeout: 15000 });

    // Click the Display nav tab
    await page.locator('[data-testid="settings-nav-display"]').click();
    await expect(page.locator('[data-testid="settings-display"]')).toBeVisible({ timeout: 10000 });

    // Find the reducedMotion toggle
    const reducedMotionToggle = page
      .locator('[data-testid="display-reduced-motion"]')
      .locator('button[role="switch"]');

    // reducedMotion defaults to false — verify it's currently off
    await expect(reducedMotionToggle).toHaveAttribute('aria-checked', 'false', { timeout: 5000 });

    // Intercept PATCH to assert the payload
    const patchPromise = page.waitForRequest(
      (req) => req.url().includes('/api/v1/auth/profile/preferences') && req.method() === 'PATCH',
      { timeout: 15000 }
    );

    // Click the toggle to turn reducedMotion ON
    await reducedMotionToggle.click();

    // Assert the PATCH contains { reducedMotion: true }
    const patchRequest = await patchPromise;
    const patchBody = patchRequest.postDataJSON() as Record<string, unknown>;
    expect(patchBody).toMatchObject({ reducedMotion: true });

    // Wait for the PATCH response to complete before reloading
    await page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/auth/profile/preferences') &&
        res.request().method() === 'PATCH',
      { timeout: 15000 }
    );

    // ── Reload and verify the preference was persisted on the server ──────────
    await page.goto(FRONTEND + '/settings', { waitUntil: 'load', timeout: 30000 });
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible({ timeout: 15000 });

    // Navigate back to display tab after reload
    await page.locator('[data-testid="settings-nav-display"]').click();
    await expect(page.locator('[data-testid="settings-display"]')).toBeVisible({ timeout: 10000 });

    // The toggle must still be ON — hydrated from server, not localStorage
    const toggleAfterReload = page
      .locator('[data-testid="display-reduced-motion"]')
      .locator('button[role="switch"]');
    await expect(toggleAfterReload).toHaveAttribute('aria-checked', 'true', { timeout: 10000 });
  });
});
