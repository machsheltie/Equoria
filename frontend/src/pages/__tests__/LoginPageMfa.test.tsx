/**
 * LoginPage — second factor before entering the game (Finding 7 / Equoria-6p398.7).
 *
 * The backend answers POST /api/v1/auth/login for an MFA-enrolled account with
 * `{ mfaRequired: true, mfaChallengeToken }` and deliberately issues NO session
 * (authController.login). Before this work the page navigated on any successful
 * mutation and the hook invalidated the profile query, so an enrolled player was
 * dropped into the app with no session and could never finish logging in.
 *
 * Network is exercised through the REAL api-client at the fetch boundary via
 * MSW (src/test/msw/server.ts) — the same boundary LoginPage.test.tsx already
 * uses. The api-client, the auth hooks, and the page are all real here; only the
 * HTTP boundary and react-router's navigate are substituted.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { TestRouter } from '@/test/utils';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/test/msw/server';
import authSessionState from '@/lib/authSessionState';
import LoginPage from '../LoginPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const LOGIN_URL = `${base}/api/v1/auth/login`;
const CHALLENGE_URL = `${base}/api/v1/auth/mfa/challenge`;
const REFRESH_URL = `${base}/api/v1/auth/refresh-token`;

const mockNavigate = vi.fn();
const mockUseLocation = vi.fn(
  () =>
    ({ pathname: '/login', state: null }) as {
      pathname: string;
      state: unknown;
    }
);
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockUseLocation(),
  };
});

let loginCalls = 0;
let challengeCalls = 0;
let refreshCalls = 0;
let challengeBodies: Record<string, unknown>[] = [];
let issuedChallengeTokens: string[] = [];

beforeEach(() => {
  loginCalls = 0;
  challengeCalls = 0;
  refreshCalls = 0;
  challengeBodies = [];
  issuedChallengeTokens = [];
  authSessionState.clear();
  mockUseLocation.mockReturnValue({ pathname: '/login', state: null });
});

/** Login answers with a fresh MFA challenge and no session. */
function stubLoginRequiresSecondFactor() {
  server.use(
    http.post(LOGIN_URL, () => {
      loginCalls += 1;
      const token = `challenge-token-${loginCalls}`;
      issuedChallengeTokens.push(token);
      return HttpResponse.json({
        success: true,
        message: 'MFA verification required',
        data: { mfaRequired: true, mfaChallengeToken: token },
      });
    })
  );
}

/** Login answers with a completed session (an account without MFA). */
function stubLoginCompletesSession() {
  server.use(
    http.post(LOGIN_URL, () => {
      loginCalls += 1;
      return HttpResponse.json({
        success: true,
        message: 'Login successful',
        data: {
          user: { id: 'user-1', username: 'moonflower', email: 'rider@example.com' },
          csrfToken: 'csrf-from-login',
        },
      });
    })
  );
}

function stubChallengeAccepted() {
  server.use(
    http.post(CHALLENGE_URL, async ({ request }) => {
      challengeCalls += 1;
      challengeBodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({
        success: true,
        message: 'Login successful',
        data: {
          user: { id: 'user-1', username: 'moonflower', email: 'rider@example.com' },
          csrfToken: 'csrf-from-mfa-challenge',
        },
      });
    })
  );
}

function stubChallengeRejected(status = 401, message = 'Invalid MFA credentials') {
  server.use(
    http.post(REFRESH_URL, () => {
      refreshCalls += 1;
      return HttpResponse.json(
        { success: false, message: 'Invalid refresh token' },
        { status: 401 }
      );
    }),
    http.post(CHALLENGE_URL, async ({ request }) => {
      challengeCalls += 1;
      challengeBodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ success: false, message }, { status });
    })
  );
}

describe('LoginPage — MFA second factor', () => {
  let queryClient: QueryClient;

  const createTestWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <TestRouter>{children}</TestRouter>
      </QueryClientProvider>
    );
  };

  afterEach(() => {
    queryClient?.clear();
  });

  async function submitCredentials(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/email address/i), 'rider@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /^enter$/i }));
  }

  function renderLogin() {
    const TestWrapper = createTestWrapper();
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );
  }

  it('does not navigate into the game when login answers with a challenge', async () => {
    stubLoginRequiresSecondFactor();
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);

    await waitFor(() => expect(loginCalls).toBe(1));
    await screen.findByLabelText(/six-digit code/i);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not mark the cached profile authenticated when login answers with a challenge', async () => {
    stubLoginRequiresSecondFactor();
    const user = userEvent.setup();
    renderLogin();
    queryClient.setQueryData(['profile'], { user: { id: 'stale', username: 'stale' } });

    await submitCredentials(user);

    await screen.findByLabelText(/six-digit code/i);
    expect(queryClient.getQueryState(['profile'])?.isInvalidated).not.toBe(true);
  });

  it('never puts the challenge token in storage or the visible page', async () => {
    stubLoginRequiresSecondFactor();
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);
    await screen.findByLabelText(/six-digit code/i);

    const issued = issuedChallengeTokens[0];
    expect(issued).toBeTruthy();
    expect(window.localStorage.getItem('mfaChallengeToken')).toBeNull();
    expect(JSON.stringify(window.localStorage)).not.toContain(issued);
    expect(JSON.stringify(window.sessionStorage)).not.toContain(issued);
    expect(document.body.textContent ?? '').not.toContain(issued);
  });

  it('submits the code as a string so a leading zero survives', async () => {
    stubLoginRequiresSecondFactor();
    stubChallengeAccepted();
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);
    const codeField = await screen.findByLabelText(/six-digit code/i);
    await user.type(codeField, '012345');
    await user.click(screen.getByRole('button', { name: /^enter$/i }));

    await waitFor(() => expect(challengeCalls).toBe(1));
    expect(challengeBodies[0]).toEqual({
      mfaChallengeToken: issuedChallengeTokens[0],
      token: '012345',
    });
  });

  it('navigates to the safe destination once the second factor is accepted', async () => {
    mockUseLocation.mockReturnValue({ pathname: '/login', state: { from: '/stable' } });
    stubLoginRequiresSecondFactor();
    stubChallengeAccepted();
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);
    await user.type(await screen.findByLabelText(/six-digit code/i), '123456');
    await user.click(screen.getByRole('button', { name: /^enter$/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/stable', { replace: true }));
    expect(authSessionState.csrfToken).toBe('csrf-from-mfa-challenge');
    expect(queryClient.getQueryState(['profile'])?.isInvalidated).not.toBe(false);
  });

  it('falls back to the safe default when the redirect target is hostile', async () => {
    mockUseLocation.mockReturnValue({ pathname: '/login', state: { from: '//evil.example.com' } });
    stubLoginRequiresSecondFactor();
    stubChallengeAccepted();
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);
    await user.type(await screen.findByLabelText(/six-digit code/i), '123456');
    await user.click(screen.getByRole('button', { name: /^enter$/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
  });

  it('sends a recovery code instead of a TOTP when the player switches to it', async () => {
    stubLoginRequiresSecondFactor();
    stubChallengeAccepted();
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);
    await screen.findByLabelText(/six-digit code/i);
    await user.click(screen.getByRole('button', { name: /recovery code/i }));

    await user.type(await screen.findByLabelText(/recovery code/i), 'a1b2c3d4e5');
    await user.click(screen.getByRole('button', { name: /^enter$/i }));

    await waitFor(() => expect(challengeCalls).toBe(1));
    expect(challengeBodies[0]).toEqual({
      mfaChallengeToken: issuedChallengeTokens[0],
      recoveryCode: 'a1b2c3d4e5',
    });
  });

  it('reports a rejected code inline, stays unauthenticated, and keeps one attempt per submit', async () => {
    stubLoginRequiresSecondFactor();
    stubChallengeRejected();
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);
    await user.type(await screen.findByLabelText(/six-digit code/i), '000000');
    await user.click(screen.getByRole('button', { name: /^enter$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent ?? '').toMatch(/wasn't accepted|didn't match|not accepted/i);
    expect(alert.textContent ?? '').not.toMatch(/session expired/i);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(challengeCalls, 'one submit must cost exactly one MFA attempt').toBe(1);
    expect(refreshCalls, 'there is no session to refresh mid-login').toBe(0);
    // The player stays on the second-factor step and can try again.
    expect(screen.getByLabelText(/six-digit code/i)).toBeInTheDocument();
  });

  it('returns to the credentials step and drops the challenge when a lockout revokes it', async () => {
    stubLoginRequiresSecondFactor();
    stubChallengeRejected(429, 'Too many failed MFA attempts.');
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);
    await user.type(await screen.findByLabelText(/six-digit code/i), '000000');
    await user.click(screen.getByRole('button', { name: /^enter$/i }));

    await waitFor(() => expect(screen.getByLabelText(/email address/i)).toBeInTheDocument());
    expect(screen.queryByLabelText(/six-digit code/i)).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect((await screen.findByRole('alert')).textContent ?? '').toMatch(/too many|wait/i);
  });

  it('drops the previous challenge when the player goes back to sign in as someone else', async () => {
    stubLoginRequiresSecondFactor();
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);
    await screen.findByLabelText(/six-digit code/i);
    await user.click(screen.getByRole('button', { name: /back to sign in/i }));

    expect(screen.queryByLabelText(/six-digit code/i)).not.toBeInTheDocument();
    const emailField = await screen.findByLabelText(/email address/i);
    expect(emailField).toBeInTheDocument();

    // A second account without MFA can now sign in normally — no stale challenge.
    stubLoginCompletesSession();
    await user.clear(emailField);
    await user.type(emailField, 'other@example.com');
    await user.clear(screen.getByLabelText(/^password$/i));
    await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /^enter$/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
    expect(challengeCalls).toBe(0);
  });

  it('does not submit the second factor twice while a submission is in flight', async () => {
    stubLoginRequiresSecondFactor();
    server.use(
      http.post(CHALLENGE_URL, async ({ request }) => {
        challengeCalls += 1;
        challengeBodies.push((await request.json()) as Record<string, unknown>);
        await delay('infinite');
        return HttpResponse.json({ success: true, data: {} });
      })
    );
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);
    await user.type(await screen.findByLabelText(/six-digit code/i), '123456');
    const submit = screen.getByRole('button', { name: /^enter|entering/i });
    await user.click(submit);
    await waitFor(() => expect(challengeCalls).toBe(1));
    await user.click(submit).catch(() => undefined);

    await waitFor(() => expect(challengeCalls).toBe(1));
  });

  it('leaves a non-MFA login working exactly as before', async () => {
    stubLoginCompletesSession();
    const user = userEvent.setup();
    renderLogin();

    await submitCredentials(user);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
    expect(screen.queryByLabelText(/six-digit code/i)).not.toBeInTheDocument();
    expect(authSessionState.csrfToken).toBe('csrf-from-login');
  });
});
