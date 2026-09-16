import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
} from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { readTestCredentials } from './credentials';
import { assertSharedSessionHealthy } from './sessionKeepAlive';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_STATE_PATH = path.resolve(__dirname, '..', '..', '..', 'storageState.json');

export type AuthedSession = {
  context: BrowserContext;
  request: APIRequestContext;
  csrfToken: string;
};

// Probe the restored storageState session and, if its short-lived access-token
// cookie has expired, sign in again through the real production login route so
// the context's cookie jar carries a live accessToken. Called before the CSRF
// token is fetched so the token is bound to the authenticated identity.
async function ensureLiveSession(request: APIRequestContext): Promise<void> {
  const probe = await request.get('/api/v1/auth/profile');
  if (probe.ok()) {
    return;
  }
  expect(
    probe.status(),
    `GET /api/v1/auth/profile returned ${probe.status()} for the global-setup storageState — ` +
      `expected 200 (live session) or 401 (expired access token), got ${await probe.text()}`
  ).toBe(401);

  const { email, password } = readTestCredentials();
  const login = await request.post('/api/v1/auth/login', { data: { email, password } });
  expect(
    login.ok(),
    `POST /api/v1/auth/login returned ${login.status()} while renewing the expired ` +
      `global-setup session — ${await login.text()}`
  ).toBe(true);

  const recheck = await request.get('/api/v1/auth/profile');
  expect(
    recheck.ok(),
    `GET /api/v1/auth/profile still returned ${recheck.status()} after a successful ` +
      `re-login — the login response did not set a usable accessToken cookie: ${await recheck.text()}`
  ).toBe(true);
}

// Spawn a fresh BrowserContext loaded with the global-setup storageState
// (logged-in + onboarded user) so its APIRequestContext carries auth cookies.
// The bare worker-scope `request` fixture does NOT load project storageState,
// which is why setup POSTs from `test.beforeAll(async ({ request }) => ...)`
// receive 401 'Access token is required'. Use this helper instead.
//
// Caller MUST `await session.context.close()` in afterAll to free the context.
export async function createAuthedSession(browser: Browser): Promise<AuthedSession> {
  // Fail for the REAL reason if the keep-alive is not renewing the shared
  // session: a stale storageState would otherwise surface as a generic 401 or,
  // worse, as a logged-out page. global-teardown.ts applies the same check to
  // the whole run for the specs that only use the plain page fixture.
  assertSharedSessionHealthy(STORAGE_STATE_PATH);

  const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
  const request = context.request;

  // Equoria-oye1a: the storageState accessToken cookie has a 15-minute maxAge
  // (ACCESS_TOKEN_TTL_MS, backend/utils/cookieConfig.mjs). global-setup writes
  // storageState ONCE, and the full E2E suite runs for ~22 minutes, so every
  // spec that builds an API context from that file more than 15 minutes into
  // the run received 401 'Access token is required' on its very first call
  // (CI run 34831357540: rider-dismiss, rider-trainer-unassign x2,
  // training-flow — all at T+17m or later; lethal-white-warning, the last
  // passing consumer, ran at T+12m).
  //
  // The browser `page` fixture self-heals because the frontend's 401
  // interceptor silently refreshes; a raw APIRequestContext has no such
  // interceptor. So re-establish the session HERE, through the real
  // production login route, with the real global-setup credentials. No bypass
  // header, no route interception, no mock — the same POST the login form
  // makes. Fail loud if it does not produce an authenticated context.
  await ensureLiveSession(request);

  // 21R-AUTH-7 removed /api/auth backward-compat mount; canonical path is /api/v1/auth
  const tokenResponse = await request.get('/api/v1/auth/csrf-token');
  expect(
    tokenResponse.ok(),
    `GET /api/v1/auth/csrf-token returned ${tokenResponse.status()} — is global-setup storageState valid?`
  ).toBe(true);
  const tokenJson = (await tokenResponse.json()) as { csrfToken?: string };
  const csrfToken = tokenJson.csrfToken;
  expect(typeof csrfToken, 'csrfToken must be present in /api/v1/auth/csrf-token response').toBe(
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
