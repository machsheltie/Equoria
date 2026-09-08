/**
 * The recovery address — the real browser path from Settings to a moved
 * identity (Finding 9, Equoria-6p398.11).
 *
 * Finding 5 (Equoria-6p398.5) closed both ordinary write paths to `User.email`
 * and replaced them with a staged request/confirm flow. That flow had no UI:
 * Settings still rendered an editable Email input wired to `PUT /auth/profile`
 * (now 403), and the confirmation link the backend mails pointed at
 * `/confirm-email-change`, a route the SPA did not have. A player could not
 * change her recovery address through a browser at all.
 *
 * Everything here is production behaviour:
 *  - accounts are registered and onboarded through the real UI;
 *  - MFA is enrolled through the real authenticated endpoints with real CSRF,
 *    because no enrolment surface exists yet (out of scope), and the TOTP codes
 *    are computed with the repository's own `otplib` — the same library
 *    `backend/modules/auth/services/mfaService.mjs` verifies with;
 *  - the confirmation link is read out of the real email capture sink the
 *    backend writes in non-production (`EMAIL_CAPTURE_FILE`), never fabricated;
 *  - the link is opened in a SEPARATE browser context, which is how a player
 *    actually opens it — from the mailbox of the new address;
 *  - no bypass headers, no route interception, no skipped or fixme tests.
 *
 * Profile: `playwright.beta-readiness.config.ts` (NODE_ENV=beta-readiness), the
 * documented Redis-free harness in docs/testing/BETA_PROFILE.md. Nothing about
 * auth, CSRF, ownership or persistence is relaxed.
 */

import { test, expect, type Browser, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import {
  csrfRequest,
  expectOk,
  installProductionParityNetworkGuard,
  latestCapturedEmail,
  loginViaUi,
  registerAndCompleteOnboarding,
  unwrapData,
  visitLiveRoute,
  type RegisteredPlayer,
} from './support/prodParity';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const backendRequire = createRequire(path.join(repoRoot, 'backend', 'package.json'));
const { authenticator } = backendRequire('otplib') as {
  authenticator: {
    generate(_secret: string): string;
    options: Record<string, unknown>;
    resetOptions(): void;
  };
};

const TOTP_STEP_MS = 30_000;

function totpAt(secret: string, stepOffset: number): string {
  authenticator.options = { epoch: Date.now() + stepOffset * TOTP_STEP_MS };
  const code = authenticator.generate(secret);
  authenticator.resetOptions();
  return code;
}

/** An accepted code that has not already been consumed (replay guard, Equoria-y932s). */
function freshTotp(secret: string, alreadyUsed: string[]): string {
  for (const offset of [0, 1, -1]) {
    const code = totpAt(secret, offset);
    if (!alreadyUsed.includes(code)) return code;
  }
  throw new Error('Could not derive an unused TOTP inside the accepted window');
}

/** How the backend reports a staged address on a later read (never in full). */
function maskedForm(address: string): string {
  const at = address.lastIndexOf('@');
  return `${address.slice(0, 1)}***${address.slice(at)}`;
}

/**
 * Count rows in the REAL capture sink the backend writes in non-production.
 * `latestCapturedEmail` polls until a row appears, which cannot express "and
 * nothing arrived"; this reads the file as it stands, which is what proving an
 * absence needs.
 */
function countCapturedEmails(kind: string, to: string): number {
  const captureFile =
    process.env.EMAIL_CAPTURE_FILE ||
    path.resolve(process.cwd(), 'test-results', 'beta-readiness-email-outbox.jsonl');
  if (!fs.existsSync(captureFile)) return 0;
  return fs
    .readFileSync(captureFile, 'utf-8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((row) => row.kind === kind && row.to === to).length;
}

function newAddressFor(suffix: string): string {
  return `recovery-${suffix}-${Date.now().toString(36)}@example.com`;
}

/** Open Settings → Account and wait for the recovery-address block to resolve. */
async function openRecoveryAddress(page: Page) {
  await visitLiveRoute(page, '/settings');
  await page.locator('[data-testid="settings-nav-account"]').click();
  const section = page.locator('[data-testid="settings-recovery-address"]');
  await expect(section).toBeVisible();
  // Loading must resolve to real server truth, never to a plausible default.
  await expect(section.getByText('The Way Back In')).toBeVisible();
  return section;
}

/** Fill and submit the disclosed change form. Returns the request response. */
async function submitAddressChange(
  page: Page,
  values: { email: string; password: string; code?: string }
) {
  await page.getByRole('button', { name: /different address/i }).click();
  await page.getByLabel('New Email Address').fill(values.email);
  await page.getByLabel('Current Password').fill(values.password);
  if (values.code !== undefined) {
    await page.getByLabel('Six-Digit Code').fill(values.code);
  }
  const requestResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/auth/email-change/request') &&
      response.request().method() === 'POST'
  );
  await page.locator('[data-testid="recovery-address-submit"]').click();
  return requestResponse;
}

/** The account's email as the real backend reports it right now. */
async function liveAccountEmail(page: Page): Promise<string> {
  const response = await page.request.get('/api/v1/auth/profile');
  const json = await expectOk(response, 'GET /api/v1/auth/profile');
  return unwrapData<{ user: { email: string } }>(json).user.email;
}

/** Pull the confirmation URL out of the real capture sink. */
async function confirmationUrlFor(address: string): Promise<string> {
  const captured = await latestCapturedEmail('email-change', address);
  expect(typeof captured?.preview, 'the confirmation email must carry a link').toBe('string');
  return captured.preview as string;
}

/** Open a confirmation link in a fresh context — the new mailbox, elsewhere. */
async function openLinkInFreshContext(browser: Browser, url: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const guard = installProductionParityNetworkGuard(page);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return { context, page, guard };
}

test.describe('Recovery address — Settings to a moved identity', () => {
  test('a staged change waits, the mailed link commits it, and the new address signs in', async ({
    page,
    browser,
  }) => {
    const guard = installProductionParityNetworkGuard(page);
    const player = await registerAndCompleteOnboarding(
      page,
      `${Date.now()}_move`,
      'Keeper Recmove'
    );
    const replacement = newAddressFor('move');

    const section = await openRecoveryAddress(page);
    await expect(section).toContainText(player.email);

    const staged = await submitAddressChange(page, {
      email: replacement,
      password: player.password,
    });
    expect(staged.status()).toBe(200);

    // Surface-Owned success: the section itself becomes the waiting state.
    const waiting = page.locator('[data-testid="recovery-address-waiting"]');
    await expect(waiting).toBeVisible();
    await expect(waiting).toContainText(replacement);
    await expect(waiting).toContainText(/still your way back in/i);

    // Nothing has moved yet — the confirmed identity is still the live one.
    expect(await liveAccountEmail(page)).toBe(player.email);

    // The waiting state survives a real reload; it is server truth, not React
    // state — and on that read the address comes back MASKED.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="settings-nav-account"]').click();
    const reloaded = page.locator('[data-testid="recovery-address-waiting"]');
    await expect(reloaded).toContainText(maskedForm(replacement));
    await expect(reloaded).not.toContainText(replacement);
    // Both consequences the backend really enforces are stated up front.
    await expect(reloaded).toContainText(/changing your password cancels this move/i);
    await expect(reloaded).toContainText(/need a new link/i);

    // The letter is opened from the NEW mailbox, in a different browser.
    const confirmUrl = await confirmationUrlFor(replacement);
    expect(confirmUrl, 'the link must point at the SPA route that now exists').toContain(
      '/confirm-email-change'
    );
    const mailbox = await openLinkInFreshContext(browser, confirmUrl);
    try {
      await expect(mailbox.page.getByText('Your Way Back In')).toBeVisible();
      await expect(mailbox.page.getByText(replacement, { exact: false })).toBeVisible();
      mailbox.guard.assertClean();
    } finally {
      await mailbox.context.close();
    }

    // Back in the original session: the identity really moved, and nothing waits.
    expect(await liveAccountEmail(page)).toBe(replacement);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="settings-nav-account"]').click();
    await expect(page.locator('[data-testid="settings-recovery-address"]')).toContainText(
      replacement
    );
    await expect(page.locator('[data-testid="recovery-address-waiting"]')).toHaveCount(0);

    // The point of the whole flow: password recovery follows the identity.
    // forgot-password is deliberately non-enumerating (200 either way), so the
    // real mail sink is the only honest witness.
    const oldBefore = countCapturedEmails('password-reset', player.email);
    const oldRequest = await csrfRequest(page, 'POST', '/api/v1/auth/forgot-password', {
      email: player.email,
    });
    expect(oldRequest.status()).toBe(200);
    expect(
      countCapturedEmails('password-reset', player.email),
      'the OLD address must no longer receive password recovery'
    ).toBe(oldBefore);

    const newRequest = await csrfRequest(page, 'POST', '/api/v1/auth/forgot-password', {
      email: replacement,
    });
    expect(newRequest.status()).toBe(200);
    const recovery = await latestCapturedEmail('password-reset', replacement);
    expect(recovery?.to, 'the NEW address must now receive password recovery').toBe(replacement);
    expect(countCapturedEmails('password-reset', replacement)).toBe(1);

    // `passwordController.forgotPassword` dispatches the send WITHOUT awaiting
    // it, so reading the sink the instant the 200 lands could pass simply
    // because nothing had been written yet. Re-check the old address now that a
    // LATER send has been observed all the way into the file: the sink has
    // demonstrably caught up, and the old address still has nothing.
    expect(
      countCapturedEmails('password-reset', player.email),
      'the OLD address is still silent after the sink has demonstrably caught up'
    ).toBe(oldBefore);

    // The recovery identity is what it claims to be: it signs in.
    const logout = await csrfRequest(page, 'POST', '/api/v1/auth/logout');
    expect(logout.status()).toBe(200);
    await loginViaUi(page, { email: replacement, password: player.password });
    expect(await liveAccountEmail(page)).toBe(replacement);

    guard.assertClean();
  });

  test('a wrong password is refused inline and stages nothing', async ({ page }) => {
    const guard = installProductionParityNetworkGuard(page);
    const player = await registerAndCompleteOnboarding(
      page,
      `${Date.now()}_wrong`,
      'Keeper Recwrong'
    );
    const replacement = newAddressFor('wrong');

    await openRecoveryAddress(page);
    const refused = await submitAddressChange(page, {
      email: replacement,
      password: `${player.password}-not-it`,
    });
    expect(refused.status()).toBe(401);

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/password wasn't accepted/i);
    // The backend's own wording must never reach the player.
    await expect(alert).not.toContainText('Current password is incorrect');

    await expect(page.locator('[data-testid="recovery-address-waiting"]')).toHaveCount(0);
    // What she typed is still there — nothing to re-enter but the password.
    await expect(page.getByLabel('New Email Address')).toHaveValue(replacement);

    // Nothing was staged server-side either.
    const statusResponse = await page.request.get('/api/v1/auth/email-change/status');
    const status = unwrapData<{ email: string; pending: unknown }>(
      await expectOk(statusResponse, 'GET /api/v1/auth/email-change/status')
    );
    expect(status.pending).toBeNull();
    expect(status.email).toBe(player.email);

    guard.assertClean();
  });

  test('the confirmation link works once and says so plainly the second time', async ({
    page,
    browser,
  }) => {
    const guard = installProductionParityNetworkGuard(page);
    const player = await registerAndCompleteOnboarding(
      page,
      `${Date.now()}_once`,
      'Keeper Reconce'
    );
    const replacement = newAddressFor('once');

    await openRecoveryAddress(page);
    const staged = await submitAddressChange(page, {
      email: replacement,
      password: player.password,
    });
    expect(staged.status()).toBe(200);

    const confirmUrl = await confirmationUrlFor(replacement);

    const first = await openLinkInFreshContext(browser, confirmUrl);
    try {
      await expect(first.page.getByText('Your Way Back In')).toBeVisible();
    } finally {
      await first.context.close();
    }

    const second = await openLinkInFreshContext(browser, confirmUrl);
    try {
      await expect(second.page.getByText('This Link Is Spent')).toBeVisible();
      const alert = second.page.getByRole('alert');
      await expect(alert).toContainText(/lasts 24 hours/i);
      // The generic backend refusal must not be echoed verbatim.
      await expect(alert).not.toContainText('This email change link is invalid');
      second.guard.assertClean();
    } finally {
      await second.context.close();
    }

    // The account is exactly where the FIRST confirmation left it.
    expect(await liveAccountEmail(page)).toBe(replacement);

    guard.assertClean();
  });

  test('Settings no longer offers the email field that could not work', async ({ page }) => {
    const guard = installProductionParityNetworkGuard(page);
    await registerAndCompleteOnboarding(page, `${Date.now()}_field`, 'Keeper Recfield');

    const section = await openRecoveryAddress(page);
    // The old control submitted `email` through PUT /auth/profile, which the
    // backend now answers 403.
    await expect(page.locator('[data-testid="settings-account"] input[type="email"]')).toHaveCount(
      0
    );
    await expect(section.getByRole('button', { name: /different address/i })).toBeVisible();

    guard.assertClean();
  });

  test('an account with a second factor is asked for its code, and a real code stages the change', async ({
    page,
  }) => {
    const guard = installProductionParityNetworkGuard(page);
    const player: RegisteredPlayer = await registerAndCompleteOnboarding(
      page,
      `${Date.now()}_mfa`,
      'Keeper Recmfa'
    );

    // Real enrolment through the real authenticated endpoints — there is no
    // enrolment surface yet, so the spec drives the same HTTP contract one would.
    const enrol = await csrfRequest(page, 'POST', '/api/v1/auth/mfa/enroll', {});
    const { secret } = unwrapData<{ secret: string }>(
      await expectOk(enrol, 'POST /api/v1/auth/mfa/enroll')
    );
    const enrolmentCode = totpAt(secret, 0);
    const verify = await csrfRequest(page, 'POST', '/api/v1/auth/mfa/verify-enrollment', {
      token: enrolmentCode,
    });
    await expectOk(verify, 'POST /api/v1/auth/mfa/verify-enrollment');

    const section = await openRecoveryAddress(page);
    await section.getByRole('button', { name: /different address/i }).click();
    // The field appears because the surface READ that this account needs it —
    // a refused attempt could not have told it apart from a wrong password.
    await expect(page.getByLabel('Six-Digit Code')).toBeVisible();

    // A structurally valid but wrong code is refused, and nothing is staged.
    const replacement = newAddressFor('mfa');
    await page.getByLabel('New Email Address').fill(replacement);
    await page.getByLabel('Current Password').fill(player.password);
    await page.getByLabel('Six-Digit Code').fill(totpAt(secret, 25));
    const refusedResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/email-change/request') &&
        response.request().method() === 'POST'
    );
    await page.locator('[data-testid="recovery-address-submit"]').click();
    expect((await refusedResponse).status()).toBe(401);
    await expect(page.getByRole('alert')).toContainText(/password or code wasn't accepted/i);
    await expect(page.locator('[data-testid="recovery-address-waiting"]')).toHaveCount(0);

    // The real code stages it.
    const goodCode = freshTotp(secret, [enrolmentCode]);
    await page.getByLabel('Six-Digit Code').fill(goodCode);
    const acceptedResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/email-change/request') &&
        response.request().method() === 'POST'
    );
    await page.locator('[data-testid="recovery-address-submit"]').click();
    expect((await acceptedResponse).status()).toBe(200);

    const waiting = page.locator('[data-testid="recovery-address-waiting"]');
    await expect(waiting).toBeVisible();
    await expect(waiting).toContainText(replacement);
    // Still staged, not committed.
    expect(await liveAccountEmail(page)).toBe(player.email);

    guard.assertClean();
  });
});
