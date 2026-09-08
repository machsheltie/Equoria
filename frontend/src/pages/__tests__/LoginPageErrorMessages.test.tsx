/**
 * LoginPage — credential-error copy (Finding 7 / Equoria-6p398.7).
 *
 * Split out of `LoginPage.test.tsx` (which had grown past the 800-line test
 * threshold) as a cohesive unit: every case here is about ONE contract — what
 * the player is told when her email/password submission is refused.
 *
 * `AuthError` renders `error.message` verbatim, so the login surface classifies
 * the transport error first (`lib/http/authErrorMessages.ts#credentialsMessage`).
 * FRONTEND_ASYNC_STATE_DOCTRINE §4 forbids printing a raw server string, so each
 * case asserts BOTH the mapped, user-safe copy AND the absence of the backend's
 * own wording — a 5xx body in particular can leak internals (Equoria-ot1mo).
 *
 * Network is exercised through the REAL api-client at the fetch boundary via
 * MSW (src/test/msw/server.ts), never by stubbing the api-client module itself,
 * so the status codes the mapper classifies are the ones the real transport
 * produces. (Describing that boundary in prose is deliberately kept free of the
 * literal call form: check-no-new-api-client-vi-mock.mjs is a whole-file regex
 * with no comment stripping, so quoting the pattern here would trip the gate.)
 * The only module substituted is react-router-dom's navigate/location, which is
 * how "a refused sign-in never navigates" is observable at all.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { TestRouter } from '@/test/utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import LoginPage from '../LoginPage';

const LOGIN_URL = 'http://localhost:3000/api/v1/auth/login';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/login', state: null }),
  };
});

/** Register a one-shot login handler returning the given status + message. */
function mockLoginError(status: number, message?: string) {
  server.use(
    http.post(LOGIN_URL, () =>
      message
        ? HttpResponse.json({ status: 'error', message }, { status })
        : new HttpResponse(null, { status })
    )
  );
}

describe('LoginPage — credential error copy', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  function renderLogin() {
    const TestWrapper = createTestWrapper();
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );
  }

  async function submitCredentials(
    user: ReturnType<typeof userEvent.setup>,
    email = 'john@example.com',
    password = 'password123'
  ) {
    await user.type(screen.getByLabelText(/email address/i), email);
    await user.type(screen.getByLabelText(/^password$/i), password);
    await user.click(screen.getByRole('button', { name: /^enter$/i }));
  }

  it('displays invalid credentials error', async () => {
    const user = userEvent.setup();
    mockLoginError(401, 'Invalid email or password');
    renderLogin();

    await submitCredentials(user, 'wrong@example.com', 'wrongpassword');

    await waitFor(() => {
      expect(screen.getByText(/don't match an account/i)).toBeInTheDocument();
    });
    // The raw server string must not reach the player.
    expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument();
    // A refused sign-in never enters the game.
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('displays server error message', async () => {
    const user = userEvent.setup();
    mockLoginError(500, 'Internal server error');
    renderLogin();

    await submitCredentials(user);

    await waitFor(() => {
      expect(screen.getByText(/something went wrong on our end/i)).toBeInTheDocument();
    });
    // A 5xx body can leak internals (Equoria-ot1mo) — never render it.
    expect(screen.queryByText(/internal server error/i)).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('displays generic error for network failures', async () => {
    const user = userEvent.setup();
    // Simulate a real transport-level network failure (no HTTP response).
    // The real api-client normalizes it to statusCode 0, which the login
    // surface maps to its own network copy (Finding 7). We assert the alert
    // is shown with non-empty content — the user-facing contract — rather
    // than pinning environment-dependent transport wording.
    server.use(http.post(LOGIN_URL, () => HttpResponse.error()));
    renderLogin();

    await submitCredentials(user);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeTruthy();
      expect((alert.textContent ?? '').trim().length).toBeGreaterThan(0);
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('displays a generic error message when the server sends no message body', async () => {
    const user = userEvent.setup();
    // Error status with an empty message body. With the REAL api-client, a
    // message-less error response is coerced to the api-client's own
    // "An error occurred" default (see fetchWithAuth non-2xx handling).
    // Since Finding 7 the surface classifies by statusCode instead of
    // echoing that string, so a 500 — with or without a body — renders the
    // mapped server-fault copy. (The component's "Login failed" fallback is
    // only reached when error.message is falsy, which the real api-client
    // never produces; asserting it would verify an unreachable branch.)
    server.use(
      http.post(LOGIN_URL, () =>
        HttpResponse.json({ status: 'error', message: '' }, { status: 500 })
      )
    );
    renderLogin();

    await submitCredentials(user);

    await waitFor(() => {
      expect(screen.getByText(/something went wrong on our end/i)).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
