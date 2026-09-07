/**
 * MFA login — the real browser-to-session-to-first-mutation path
 * (Finding 7, Equoria-6p398.7).
 *
 * The audit found that an MFA-enrolled account could never finish logging in
 * through the browser: `POST /auth/login` answers with
 * `{ mfaRequired: true, mfaChallengeToken }` and NO session cookie
 * (authController.login), and the frontend navigated on any successful login.
 * This spec supplies the missing real evidence.
 *
 * Everything here is production behaviour:
 *  - the account is registered and onboarded through the real UI;
 *  - MFA is enrolled through the real authenticated endpoints
 *    (POST /auth/mfa/enroll + /auth/mfa/verify-enrollment) with real CSRF —
 *    there is no frontend enrolment surface yet, so the spec drives the same
 *    HTTP contract an enrolment screen would;
 *  - the TOTP codes are computed with the repository's own `otplib`
 *    (backend/package.json — the same library backend/modules/auth/services/
 *    mfaService.mjs verifies with), resolved from the backend package so no new
 *    dependency is introduced;
 *  - no bypass headers, no route interception, no skipped or fixme tests.
 *
 * Profile: this spec runs under `playwright.beta-readiness.config.ts`
 * (NODE_ENV=beta-readiness). Per docs/testing/BETA_PROFILE.md that is the
 * documented Redis-free harness; the `beta` profile expects Redis and its
 * fail-closed auth limiter answers 503 on this machine, where no Redis is
 * running. Nothing about auth, CSRF, ownership or persistence is relaxed here.
 */

import { test, expect, type Browser, type Page } from '@playwright/test';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import {
  csrfRequest,
  expectOk,
  installProductionParityNetworkGuard,
  registerAndCompleteOnboarding,
  unwrapData,
  type RegisteredPlayer,
} from './support/prodParity';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

// Reuse the repository's existing TOTP implementation rather than adding a
// dependency: otplib is already a backend runtime dependency and is what the
// backend's MFA integration tests generate codes with.
const backendRequire = createRequire(path.join(repoRoot, 'backend', 'package.json'));
const { authenticator } = backendRequire('otplib') as {
  authenticator: {
    generate(_secret: string): string;
    options: Record<string, unknown>;
    resetOptions(): void;
  };
};

const TOTP_STEP_MS = 30_000;

/** Generate the TOTP for a time step relative to now. */
function totpAt(secret: string, stepOffset: number): string {
  authenticator.options = { epoch: Date.now() + stepOffset * TOTP_STEP_MS };
  const code = authenticator.generate(secret);
  authenticator.resetOptions();
  return code;
}

/**
 * A code the server will accept (inside its ±1-step window) that has not
 * already been consumed. The backend rejects a replayed code even while otplib
 * still matches it (Equoria-y932s), so the enrolment code cannot be reused.
 */
function freshTotp(secret: string, alreadyUsed: string[]): string {
  for (const offset of [0, 1, -1]) {
    const code = totpAt(secret, offset);
    if (!alreadyUsed.includes(code)) return code;
  }
  throw new Error('Could not derive an unused TOTP inside the accepted window');
}

/** A syntactically valid six-digit code that is outside the accepted window. */
function wrongTotp(secret: string): string {
  const accepted = [totpAt(secret, -1), totpAt(secret, 0), totpAt(secret, 1)];
  for (let offset = 20; offset < 40; offset += 1) {
    const code = totpAt(secret, offset);
    if (!accepted.includes(code)) return code;
  }
  throw new Error('Could not derive a code outside the accepted window');
}

type MfaAccount = RegisteredPlayer & { secret: string; recoveryCodes: string[] };

/**
 * Turn an already-registered, onboarded player into an MFA-enrolled account
 * through the real authenticated endpoints, then end that session.
 */
async function enrolMfa(page: Page, player: RegisteredPlayer): Promise<MfaAccount> {
  const enrolResponse = await csrfRequest(page, 'POST', '/api/v1/auth/mfa/enroll', {});
  const enrolJson = await expectOk(enrolResponse, 'POST /api/v1/auth/mfa/enroll');
  const { secret } = unwrapData<{ secret: string; otpauthUrl: string }>(enrolJson);
  expect(typeof secret, 'enrolment must return a base32 TOTP secret').toBe('string');

  const enrolmentCode = totpAt(secret, 0);
  const verifyResponse = await csrfRequest(page, 'POST', '/api/v1/auth/mfa/verify-enrollment', {
    token: enrolmentCode,
  });
  const verifyJson = await expectOk(verifyResponse, 'POST /api/v1/auth/mfa/verify-enrollment');
  const { recoveryCodes } = unwrapData<{ recoveryCodes: string[] }>(verifyJson);
  expect(recoveryCodes.length, 'enrolment must return single-use recovery codes').toBeGreaterThan(
    0
  );

  const logoutResponse = await csrfRequest(page, 'POST', '/api/v1/auth/logout');
  expect(logoutResponse.status()).toBe(200);

  return { ...player, secret, recoveryCodes: [...recoveryCodes] };
}

/** Register, onboard, and enrol MFA for one disposable account. */
async function createMfaPlayer(browser: Browser, suffix: string): Promise<MfaAccount> {
  const setupPage = await browser.newPage();
  const guard = installProductionParityNetworkGuard(setupPage);
  try {
    const player = await registerAndCompleteOnboarding(setupPage, suffix, `Keeper ${suffix}`);
    const account = await enrolMfa(setupPage, player);
    guard.assertClean();
    return account;
  } finally {
    await setupPage.close();
  }
}

/** Fill and submit the credentials step; returns the login response status. */
async function submitCredentials(page: Page, account: { email: string; password: string }) {
  await expect(page.locator('h2')).toContainText('Welcome Back');
  await page.fill('input[name="email"]', account.email);
  await page.fill('input[name="password"]', account.password);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /^Enter$/ }).click();
  return loginResponse;
}

/** Assert the browser session is not authenticated against the real backend. */
async function expectUnauthenticated(page: Page, label: string) {
  const profile = await page.request.get('/api/v1/auth/profile');
  expect(profile.status(), `${label}: the session must not be authenticated yet`).toBe(401);
}

test('an MFA-enrolled account completes the second factor and enters the game with a working session', async ({
  browser,
}) => {
  const suffix = `${Date.now()}_mfa`;
  const account = await createMfaPlayer(browser, suffix);
  const usedCodes = [totpAt(account.secret, 0), totpAt(account.secret, -1)];

  const context = await browser.newContext();
  const page = await context.newPage();
  const guard = installProductionParityNetworkGuard(page);

  try {
    // ── Credentials alone must not produce a session ────────────────────────
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const firstLogin = await submitCredentials(page, account);
    expect(firstLogin.status()).toBe(200);
    const firstLoginBody = await firstLogin.json();
    expect(
      firstLoginBody?.data?.mfaRequired,
      'the backend must withhold the session for an enrolled account'
    ).toBe(true);

    // The second-factor step appears on the login surface; nothing navigated.
    await expect(page.locator('h2')).toContainText('One More Key');
    await expect(page.getByLabel('Six-Digit Code')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/login');
    await expectUnauthenticated(page, 'challenge issued');

    // ── Abandoning the challenge must not authenticate anyone ───────────────
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('h2')).toContainText('Welcome Back');
    await expect(page.getByLabel('Six-Digit Code')).toHaveCount(0);
    await expectUnauthenticated(page, 'after reloading an incomplete challenge');

    // ── Complete the second factor with a real authenticator code ───────────
    const secondLogin = await submitCredentials(page, account);
    expect(secondLogin.status()).toBe(200);
    await expect(page.getByLabel('Six-Digit Code')).toBeVisible();

    const code = freshTotp(account.secret, usedCodes);
    usedCodes.push(code);
    await page.getByLabel('Six-Digit Code').fill(code);

    const challengeResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/mfa/challenge') &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /^Enter$/ }).click();
    const challenge = await challengeResponse;
    expect(challenge.status(), `MFA challenge failed: ${await challenge.text()}`).toBe(200);
    const challengeBody = await challenge.json();
    const seededCsrfToken: string = challengeBody?.data?.csrfToken;
    expect(typeof seededCsrfToken, 'the challenge must return the user-bound CSRF token').toBe(
      'string'
    );
    expect(challengeBody?.data?.user?.email).toBe(account.email);

    // ── The player reaches her destination with a live session ──────────────
    await page.waitForURL((url) => !url.pathname.includes('/login'));
    const profile = await page.request.get('/api/v1/auth/profile');
    const profileJson = await expectOk(profile, 'GET /api/v1/auth/profile after MFA login');
    expect(unwrapData<{ user: { email: string } }>(profileJson).user.email).toBe(account.email);

    // ── The FIRST authenticated mutation works, using the seeded CSRF token ─
    // Reached by in-app navigation (no reload) so the token exercised is the
    // one the MFA challenge seeded, not one re-fetched after a page load.
    await page.locator('[data-testid="user-avatar"]').click();
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible();
    await page.locator('[data-testid="settings-nav-notifications"]').click();
    await expect(page.locator('[data-testid="settings-notifications"]')).toBeVisible();

    const toggle = page
      .locator('[data-testid="notif-email-competition"]')
      .locator('button[role="switch"]');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    const preferencesRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/v1/auth/profile/preferences') && request.method() === 'PATCH'
    );
    const preferencesResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/profile/preferences') &&
        response.request().method() === 'PATCH'
    );
    await toggle.click();
    const sentRequest = await preferencesRequest;
    expect(
      sentRequest.headers()['x-csrf-token'],
      'the first mutation must send the CSRF token the MFA challenge seeded'
    ).toBe(seededCsrfToken);
    expect((await preferencesResponse).status()).toBe(200);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    guard.assertClean();
  } finally {
    await context.close();
  }
});

test('a recovery code completes login once and is refused on reuse', async ({ browser }) => {
  const suffix = `${Date.now()}_rec`;
  const account = await createMfaPlayer(browser, suffix);
  const recoveryCode = account.recoveryCodes[0];

  const firstContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  const firstGuard = installProductionParityNetworkGuard(firstPage);
  try {
    await firstPage.goto('/login', { waitUntil: 'domcontentloaded' });
    expect((await submitCredentials(firstPage, account)).status()).toBe(200);
    await firstPage.getByRole('button', { name: /Use a recovery code instead/ }).click();
    await firstPage.getByLabel('Recovery Code').fill(recoveryCode);

    const accepted = firstPage.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/mfa/challenge') &&
        response.request().method() === 'POST'
    );
    await firstPage.getByRole('button', { name: /^Enter$/ }).click();
    expect((await accepted).status()).toBe(200);
    await firstPage.waitForURL((url) => !url.pathname.includes('/login'));

    const profile = await firstPage.request.get('/api/v1/auth/profile');
    expect(profile.status()).toBe(200);
    firstGuard.assertClean();
  } finally {
    await firstContext.close();
  }

  // A second, entirely fresh session cannot spend the same recovery code.
  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  const secondGuard = installProductionParityNetworkGuard(secondPage);
  try {
    await secondPage.goto('/login', { waitUntil: 'domcontentloaded' });
    expect((await submitCredentials(secondPage, account)).status()).toBe(200);
    await secondPage.getByRole('button', { name: /Use a recovery code instead/ }).click();
    await secondPage.getByLabel('Recovery Code').fill(recoveryCode);

    const refused = secondPage.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/mfa/challenge') &&
        response.request().method() === 'POST'
    );
    await secondPage.getByRole('button', { name: /^Enter$/ }).click();
    expect((await refused).status(), 'a spent recovery code must not authenticate').toBe(401);

    await expect(secondPage.getByRole('alert')).toContainText(/wasn't accepted/);
    expect(new URL(secondPage.url()).pathname).toBe('/login');
    await expectUnauthenticated(secondPage, 'after reusing a recovery code');

    // Its sibling code still works, so the refusal was single-use enforcement.
    await secondPage.getByLabel('Recovery Code').fill(account.recoveryCodes[1]);
    const secondAccepted = secondPage.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/mfa/challenge') &&
        response.request().method() === 'POST'
    );
    await secondPage.getByRole('button', { name: /^Enter$/ }).click();
    expect((await secondAccepted).status()).toBe(200);
    await secondPage.waitForURL((url) => !url.pathname.includes('/login'));
    secondGuard.assertClean();
  } finally {
    await secondContext.close();
  }
});

test('an incorrect code keeps the player out with honest inline feedback', async ({ browser }) => {
  const suffix = `${Date.now()}_bad`;
  const account = await createMfaPlayer(browser, suffix);

  const context = await browser.newContext();
  const page = await context.newPage();
  const guard = installProductionParityNetworkGuard(page);
  let challengeAttempts = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/auth/mfa/challenge') && request.method() === 'POST') {
      challengeAttempts += 1;
    }
  });

  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect((await submitCredentials(page, account)).status()).toBe(200);
    await page.getByLabel('Six-Digit Code').fill(wrongTotp(account.secret));

    const refused = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/mfa/challenge') &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /^Enter$/ }).click();
    expect((await refused).status()).toBe(401);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(/wasn't accepted/);
    await expect(alert).not.toContainText(/Session expired/i);
    expect(new URL(page.url()).pathname).toBe('/login');
    await expect(page.getByLabel('Six-Digit Code')).toBeVisible();
    await expectUnauthenticated(page, 'after an incorrect second factor');

    // One submit must cost exactly one attempt against the backend's per-user
    // MFA lockout — the transport must not replay the rejected code.
    expect(challengeAttempts).toBe(1);

    // The correct code still gets her in on the next try.
    const code = freshTotp(account.secret, [totpAt(account.secret, 0)]);
    await page.getByLabel('Six-Digit Code').fill(code);
    const accepted = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/mfa/challenge') &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /^Enter$/ }).click();
    expect((await accepted).status(), 'a valid code after a typo must still work').toBe(200);
    await page.waitForURL((url) => !url.pathname.includes('/login'));

    guard.assertClean();
  } finally {
    await context.close();
  }
});

test('a hostile redirect target seeded before login falls back to the safe default', async ({
  browser,
}) => {
  const suffix = `${Date.now()}_red`;
  const account = await createMfaPlayer(browser, suffix);

  const context = await browser.newContext();
  const page = await context.newPage();
  const guard = installProductionParityNetworkGuard(page);

  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    // CWE-601 threat model (Equoria-rxkna): an attacker seeds the router's
    // history state before the victim signs in. React Router reads `usr` from
    // window.history.state when it initialises, so seed it and reload.
    await page.evaluate(() => {
      window.history.replaceState(
        { usr: { from: '//evil.example.com/steal' }, key: 'seeded', idx: 0 },
        '',
        '/login'
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Fail loudly if the seed did not survive — otherwise this test would pass
    // for the wrong reason (no hostile target present at all).
    expect(
      await page.evaluate(
        () => (window.history.state as { usr?: { from?: string } } | null)?.usr?.from
      ),
      'the hostile redirect target must actually be seeded in router state'
    ).toBe('//evil.example.com/steal');

    expect((await submitCredentials(page, account)).status()).toBe(200);
    await page
      .getByLabel('Six-Digit Code')
      .fill(freshTotp(account.secret, [totpAt(account.secret, 0)]));
    const accepted = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/mfa/challenge') &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /^Enter$/ }).click();
    expect((await accepted).status()).toBe(200);

    await page.waitForURL((url) => !url.pathname.includes('/login'));
    const landed = new URL(page.url());
    expect(landed.host, 'login must never leave the application origin').toBe('localhost:3000');
    expect(landed.pathname).not.toContain('evil.example.com');

    guard.assertClean();
  } finally {
    await context.close();
  }
});

test('an account without MFA still signs in with its password alone', async ({ browser }) => {
  const suffix = `${Date.now()}_plain`;
  const page = await browser.newPage();
  const guard = installProductionParityNetworkGuard(page);

  try {
    const player = await registerAndCompleteOnboarding(page, suffix, `Plainkeeper ${suffix}`);
    await csrfRequest(page, 'POST', '/api/v1/auth/logout');

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const login = await submitCredentials(page, player);
    expect(login.status()).toBe(200);
    const body = await login.json();
    expect(body?.data?.mfaRequired).toBeFalsy();
    expect(body?.data?.user?.email).toBe(player.email);

    await page.waitForURL((url) => !url.pathname.includes('/login'));
    await expect(page.getByLabel('Six-Digit Code')).toHaveCount(0);
    expect((await page.request.get('/api/v1/auth/profile')).status()).toBe(200);

    guard.assertClean();
  } finally {
    await page.close();
  }
});
