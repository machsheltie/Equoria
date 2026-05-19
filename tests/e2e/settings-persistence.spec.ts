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
 * - No bypass headers (x-test-bypass-auth, x-test-skip-csrf, x-test-user, …) // doctrine-allow: bypass-header-literal
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

    const reg = await request.post(`${BACKEND}/api/v1/auth/register`, {
      data: {
        email: userEmail,
        password: userPassword,
        username,
        firstName: 'SetPref',
        lastName: 'E2e',
        // Equoria-iqzn / Equoria-9tlha: COPPA age gate requires a valid adult DOB.
        dateOfBirth: '1990-01-01',
      },
      headers: { Origin: FRONTEND },
    });
    expect(reg.status(), `Registration failed: ${await reg.text()}`).toBe(201);
  });

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup — log in to get token then log out.
    // Non-fatal if it fails (user was never created or already cleaned up).
    try {
      const loginRes = await request.post(`${BACKEND}/api/v1/auth/login`, {
        data: { email: userEmail, password: userPassword },
        headers: { Origin: FRONTEND },
      });
      if (loginRes.status() === 200) {
        const { data } = await loginRes.json();
        const csrfToken = data?.csrfToken ?? '';
        const loginCookies = loginRes.headers()['set-cookie'] ?? '';
        await request.post(`${BACKEND}/api/v1/auth/logout`, {
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
   * Helper: log in via the UI login form, then deterministically complete the
   * onboarding wizard so the user is fully onboarded server-side.
   *
   * This suite registers the user via the API in beforeAll (no browser), so
   * the user is authenticated but un-onboarded (completedOnboarding === false,
   * onboardingStep === 0). LoginPage navigates to `from` (default `/`), NOT
   * `/onboarding`. OnboardingGuard then redirects `/` → `/onboarding`, but that
   * redirect runs only AFTER an async profile fetch resolves. The previous
   * `waitForURL(/(onboarding|$)/)` + `if (url.includes('/onboarding'))` raced
   * that async redirect: post-login the URL is `/` (login's own navigation), so
   * the `if` was false, the wizard was skipped, the user stayed un-onboarded,
   * and the subsequent goto('/settings') was redirected back to /onboarding —
   * the :164/:238 settings-page-not-visible failure.
   *
   * Fix: don't race the guard. After login completes, drive explicitly to
   * /onboarding (OnboardingGuard does not redirect away from /onboarding —
   * OnboardingGuard.tsx:32 — the wizard renders for any authenticated
   * un-onboarded user) and complete it, observing the REAL Epic-20
   * /api/v1/auth/advance-onboarding response (the public auth router is mounted
   * ONLY at /api/v1/auth — backend/app.mjs:177 — there is no /api/auth legacy
   * alias) before returning.
   */
  async function loginViaUI(page: import('@playwright/test').Page) {
    await page.goto(FRONTEND + '/login', { waitUntil: 'load', timeout: 60000 });
    await page.fill('input[name="email"]', userEmail);
    await page.fill('input[name="password"]', userPassword);
    await page.click('button[type="submit"]');

    // Wait for the login form to navigate away (auth cookies set, SPA routed
    // off /login). The exact landing route (`/` then guard-redirected, or
    // `/onboarding`) is irrelevant — we drive to /onboarding explicitly next.
    await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 30000 });

    // Deterministically complete onboarding. Navigating straight to
    // /onboarding sidesteps the OnboardingGuard async-redirect race entirely.
    await page.goto(FRONTEND + '/onboarding', { waitUntil: 'load', timeout: 30000 });
    {
      // Step 1 (Welcome) → click Continue
      await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });
      await page.locator('[data-testid="onboarding-next"]').click();

      // Step 2 (Choose Your Horse) → select first breed, pick Mare, name horse.
      // Equoria-zanq / Spec 11.3.4: the breed picker is now a WAI-ARIA
      // radiogroup (BreedSelector — button[role="radio"][data-breed-option]
      // cards), not a native <select data-testid="breed-select">.
      await expect(page.locator('h1')).toContainText('Choose Your Horse', { timeout: 10000 });
      const breedSelector = page.locator('[data-testid="breed-selector"]');
      await breedSelector.waitFor({ state: 'visible', timeout: 15000 });
      const firstBreedOption = breedSelector
        .locator('[role="radiogroup"][aria-label="Horse breeds"] [role="radio"][data-breed-option]')
        .first();
      await firstBreedOption.waitFor({ state: 'visible', timeout: 15000 });
      await firstBreedOption.click();
      await expect(firstBreedOption).toHaveAttribute('aria-checked', 'true');
      await breedSelector.getByRole('button', { name: /Mare/i }).click();
      await page
        .locator('[data-testid="horse-name-input"]')
        .fill(`SetPref Test Horse ${Date.now()}`);
      const step1Next = page.locator('[data-testid="onboarding-next"]');
      await expect(step1Next).toBeEnabled();
      await step1Next.click();

      // Step 3 (Ready) → click Begin / Continue.
      // The Ready step's button fires POST /api/v1/auth/advance-onboarding
      // which is what flips completedOnboarding server-side. Epic-20 migrated
      // all auth endpoints to the /api/v1/ prefix and the public auth router
      // is mounted ONLY at /api/v1/auth (backend/app.mjs:177) — there is no
      // /api/auth legacy alias for it. We must observe the REAL v1 response
      // (not just the client-side redirect) before driving on to /settings,
      // otherwise the subsequent goto can race the persistence write and
      // OnboardingGuard redirects /settings → /onboarding (the :164/:238
      // failure this fixes).
      await expect(page.locator('h1')).toContainText("You're Ready!", { timeout: 10000 });
      const advanceOnboardingPromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/auth/advance-onboarding') &&
          res.request().method() === 'POST',
        { timeout: 30000 }
      );
      await page.locator('[data-testid="onboarding-next"]').click();
      const advanceOnboardingResponse = await advanceOnboardingPromise;
      expect(advanceOnboardingResponse.status()).toBe(200);

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
