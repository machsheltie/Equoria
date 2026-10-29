/**
 * Confirm a freshly registered E2E player's email through the real emailed link
 * (Equoria-3juhn).
 *
 * Since Equoria-voasj (owner ruling q248: no play until the email is confirmed)
 * the server answers 403 `emailNotVerified` on every gameplay route for an
 * unconfirmed account, and the app holds a new player on /verify-email. The
 * beta-readiness gate already confirms through the real link
 * (tests/e2e/readiness/support/prodParity.ts); the general suite does the same
 * here.
 *
 * Nothing is bypassed: the backend's real sendVerificationEmail path writes the
 * link to its non-production capture sink (EMAIL_CAPTURE_FILE, set for the
 * backend web server by playwright.config.ts), and the player opens that link —
 * in the browser, or with a GET on the same public /api/v1/auth/verify-email
 * route the page calls.
 *
 * A locally REUSED backend (reuseExistingServer) started without
 * EMAIL_CAPTURE_FILE captures nothing; latestCapturedEmail then fails loudly and
 * names that cause.
 */

import fs from 'fs';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

interface CapturedEmail {
  kind: string;
  to: string;
  subject?: string;
  preview: string;
  capturedAt?: string;
}

function captureFilePath(): string {
  const file = process.env.EMAIL_CAPTURE_FILE;
  if (!file) {
    throw new Error(
      'EMAIL_CAPTURE_FILE is not set — playwright.config.ts sets it for the backend web server ' +
        'so registered players can confirm their email (Equoria-3juhn).'
    );
  }
  return file;
}

function findLatest(file: string, kind: string, to: string): CapturedEmail | null {
  if (!fs.existsSync(file)) return null;
  const rows = fs
    .readFileSync(file, 'utf-8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CapturedEmail);
  return rows.reverse().find((row) => row.kind === kind && row.to === to) ?? null;
}

/** The most recent captured email of `kind` sent to `to`; polls up to 10 s. */
export async function latestCapturedEmail(kind: string, to: string): Promise<CapturedEmail> {
  const file = captureFilePath();
  await expect
    .poll(() => findLatest(file, kind, to), {
      timeout: 10000,
      message:
        `No captured "${kind}" email for ${to} in ${file}. If the backend was reused from an ` +
        'earlier session, restart it so it runs with EMAIL_CAPTURE_FILE.',
    })
    .not.toBeNull();
  return findLatest(file, kind, to)!;
}

/** The token from the player's captured verification link. */
export async function capturedVerificationToken(email: string): Promise<string> {
  const mail = await latestCapturedEmail('verification', email);
  expect(mail.preview, 'the verification email must carry the /verify-email link').toContain(
    '/verify-email'
  );
  const token = new URL(mail.preview).searchParams.get('token');
  expect(token, 'the verification link must carry a token').toBeTruthy();
  return token!;
}

/**
 * Open the player's captured verification link over the API (for players
 * registered with `request.post('/api/v1/auth/register')`). `request` may use a
 * baseURL or not; pass `origin` when its requests use absolute URLs.
 */
export async function confirmEmailViaApi(
  request: APIRequestContext,
  email: string,
  origin = ''
): Promise<void> {
  const token = await capturedVerificationToken(email);
  const res = await request.get(
    `${origin}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`
  );
  expect(
    res.status(),
    `GET /api/v1/auth/verify-email for ${email} returned ${res.status()}: ${await res.text()}`
  ).toBe(200);
}

/**
 * Confirm a player who registered through the /register page: she is held on
 * /verify-email, opens the emailed link, and enters the realm. Afterwards the
 * page is on /onboarding (a new player) or / (an onboarded one).
 */
export async function confirmEmailInBrowser(page: Page, email: string): Promise<void> {
  await page.waitForURL(/\/verify-email$/, { timeout: 30000 });
  const mail = await latestCapturedEmail('verification', email);
  expect(mail.preview).toContain('/verify-email');
  expect(mail.preview).toContain('token=');
  const verifyResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/auth/verify-email') && response.request().method() === 'GET'
  );
  await page.goto(mail.preview, { waitUntil: 'domcontentloaded' });
  expect((await verifyResponse).status()).toBe(200);
  // React StrictMode (dev server) runs the page's verify effect twice; the
  // second call meets a used token and the page shows "Already Verified".
  await expect(page.locator('body')).toContainText(/Email Verified|Already Verified/);
  await page.getByRole('button', { name: /Enter the Realm|Continue to Home/ }).click();
  await page.waitForURL(/\/(onboarding)?$/, { timeout: 30000 });
}
