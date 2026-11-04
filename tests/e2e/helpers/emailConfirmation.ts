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
import { expect, type APIRequestContext, type Page, type Response } from '@playwright/test';

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
 * Open an emailed verification link in the browser and wait until the page has
 * verified it. React StrictMode (dev server) runs the page's verify effect
 * twice, so two GETs for the same token race: one verifies (200) and the other
 * meets a used token (400, the page shows "Already Verified"). Either can
 * finish first, so this waits for the token's 200 rather than the first
 * response, and checks the token verified exactly once (Equoria-r9drt).
 */
export async function openVerificationLinkInBrowser(page: Page, link: string): Promise<void> {
  const token = new URL(link).searchParams.get('token');
  expect(token, 'the emailed verification link must carry a token').toBeTruthy();
  const isThisTokensVerify = (response: Response) =>
    response.request().method() === 'GET' &&
    response.url().includes('/api/v1/auth/verify-email') &&
    new URL(response.url()).searchParams.get('token') === token;
  const statuses: number[] = [];
  const record = (response: Response) => {
    if (isThisTokensVerify(response)) {
      statuses.push(response.status());
    }
  };
  page.on('response', record);
  try {
    const verified = page.waitForResponse(
      (response) => isThisTokensVerify(response) && response.status() === 200
    );
    await page.goto(link, { waitUntil: 'domcontentloaded' });
    expect((await verified).status()).toBe(200);
    await expect(page.locator('body')).toContainText(/Email Verified|Already Verified/);
  } finally {
    page.off('response', record);
  }
  expect(
    statuses.filter((status) => status === 200),
    'the token verifies exactly once'
  ).toHaveLength(1);
  expect(
    statuses.every((status) => status === 200 || status === 400),
    `every other verify call meets the used token (got ${statuses.join(', ')})`
  ).toBe(true);
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
  await openVerificationLinkInBrowser(page, mail.preview);
  await page.getByRole('button', { name: /Enter the Realm|Continue to Home/ }).click();
  await page.waitForURL(/\/(onboarding)?$/, { timeout: 30000 });
}
