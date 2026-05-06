import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
} from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_STATE_PATH = path.resolve(__dirname, '..', '..', '..', 'storageState.json');

export type AuthedSession = {
  context: BrowserContext;
  request: APIRequestContext;
  csrfToken: string;
};

// Spawn a fresh BrowserContext loaded with the global-setup storageState
// (logged-in + onboarded user) so its APIRequestContext carries auth cookies.
// The bare worker-scope `request` fixture does NOT load project storageState,
// which is why setup POSTs from `test.beforeAll(async ({ request }) => ...)`
// receive 401 'Access token is required'. Use this helper instead.
//
// Caller MUST `await session.context.close()` in afterAll to free the context.
export async function createAuthedSession(browser: Browser): Promise<AuthedSession> {
  const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
  const request = context.request;

  const tokenResponse = await request.get('/api/auth/csrf-token');
  expect(
    tokenResponse.ok(),
    `GET /api/auth/csrf-token returned ${tokenResponse.status()} — is global-setup storageState valid?`
  ).toBe(true);
  const tokenJson = (await tokenResponse.json()) as { csrfToken?: string };
  const csrfToken = tokenJson.csrfToken;
  expect(typeof csrfToken, 'csrfToken must be present in /api/auth/csrf-token response').toBe(
    'string'
  );
  expect(csrfToken!.length, 'csrfToken must be non-empty').toBeGreaterThan(20);

  return { context, request, csrfToken: csrfToken! };
}

// Issue a state-mutating request through the authed session. Attaches
// X-CSRF-Token + JSON Content-Type. Returns the raw APIResponse so callers
// can inspect status/body. Pair with createAuthedSession().
export async function csrfMutate(
  session: AuthedSession,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: unknown
) {
  return session.request.fetch(url, {
    method,
    data,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': session.csrfToken,
    },
  });
}
