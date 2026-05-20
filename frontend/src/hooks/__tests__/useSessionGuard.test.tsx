/**
 * useSessionGuard Hook Tests (Story 1-3: Session Management)
 *
 * Tests for session guard functionality including:
 * - Redirecting to login when session expires
 * - Showing session expired message
 * - Protecting routes that require authentication
 * - Preserving intended destination for post-login redirect
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (Equoria-f12xy) instead of vi.mock'ing the api-client. The guard composes
 * the real AuthProvider (profile + verification-status queries) against the
 * stubbed fetch boundary; unauthenticated cases force the 401→refresh path to
 * fail so the guard settles into shouldRedirect. The login-page redirect that
 * a tester actually experiences is covered by the auth Playwright E2E
 * (tests/e2e/); these unit tests lock the guard's pure redirect-decision logic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from '../../test/utils';
import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { useSessionGuard } from '../useSessionGuard';
import { server } from '../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AUTH_USER = { id: 1, username: 'testuser', email: 'test@example.com' };

/** Authenticated session (profile + verification). */
function stubAuthenticated(verified = true) {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () => HttpResponse.json({ data: { user: AUTH_USER } })),
    http.get(`${base}/api/v1/auth/verification-status`, () =>
      HttpResponse.json({
        data: {
          verified,
          email: 'test@example.com',
          verifiedAt: verified ? '2024-01-01T00:00:00Z' : null,
        },
      })
    )
  );
}

/** Unauthenticated: profile 401 + failing refresh + verification 401. */
function stubUnauthenticated() {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () =>
      HttpResponse.json(
        { message: 'Session expired. Please log in again.', status: 'error' },
        { status: 401 }
      )
    ),
    http.get(`${base}/api/v1/auth/verification-status`, () =>
      HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    ),
    http.post(`${base}/api/v1/auth/refresh-token`, () =>
      HttpResponse.json({ message: 'no session' }, { status: 401 })
    )
  );
}

/** Profile/verification that never resolve — keeps the guard in loading. */
function stubNeverResolves() {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () => new Promise<Response>(() => {})),
    http.get(`${base}/api/v1/auth/verification-status`, () => new Promise<Response>(() => {}))
  );
}

/**
 * Component to display current location
 */
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

/**
 * Protected page that uses session guard
 */
function ProtectedPage() {
  const { isLoading, shouldRedirect, sessionMessage } = useSessionGuard();
  const { isAuthenticated } = useAuth();

  if (isLoading) {
    return <div data-testid="loading">Loading...</div>;
  }

  if (shouldRedirect) {
    return (
      <div data-testid="redirect-needed">
        {sessionMessage && <div data-testid="session-message">{sessionMessage}</div>}
      </div>
    );
  }

  return (
    <div data-testid="protected-content">
      {isAuthenticated ? 'Protected Content' : 'Not Authenticated'}
    </div>
  );
}

/**
 * Page that requires email verification
 */
function VerificationRequiredPage() {
  const { isLoading, shouldRedirect, sessionMessage } = useSessionGuard({
    requireEmailVerification: true,
  });
  const { isEmailVerified } = useAuth();

  if (isLoading) {
    return <div data-testid="loading">Loading...</div>;
  }

  if (shouldRedirect) {
    return (
      <div data-testid="redirect-needed">
        {sessionMessage && <div data-testid="session-message">{sessionMessage}</div>}
      </div>
    );
  }

  return (
    <div data-testid="verified-content">
      {isEmailVerified ? 'Verified Content' : 'Not Verified'}
    </div>
  );
}

/**
 * Login page component
 */
function _LoginPage() {
  const location = useLocation();
  const state = location.state as { message?: string; from?: string } | null;

  return (
    <div data-testid="login-page">
      Login Page
      {state?.message && <div data-testid="redirect-message">{state.message}</div>}
      {state?.from && <div data-testid="redirect-from">{state.from}</div>}
    </div>
  );
}

describe('useSessionGuard Hook - Session Management (Story 1-3)', () => {
  let queryClient: QueryClient;

  const createWrapper = (initialEntries: string[] = ['/protected']) => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={initialEntries}>
            {children}
            <LocationDisplay />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Session Validation', () => {
    it('should show loading while checking session', async () => {
      stubNeverResolves();

      const Wrapper = createWrapper();
      render(<ProtectedPage />, { wrapper: Wrapper });

      expect(screen.getByTestId('loading')).toHaveTextContent('Loading...');
    });

    it('should allow access when user is authenticated', async () => {
      stubAuthenticated();

      const Wrapper = createWrapper();
      render(<ProtectedPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toHaveTextContent('Protected Content');
      });
    });

    it('should indicate redirect needed when session is expired', async () => {
      stubUnauthenticated();

      const Wrapper = createWrapper();
      render(<ProtectedPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('redirect-needed')).toBeInTheDocument();
      });
    });

    it('should provide session expired message', async () => {
      stubUnauthenticated();

      const Wrapper = createWrapper();
      render(<ProtectedPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('session-message')).toHaveTextContent(
          'Your session has expired. Please log in again.'
        );
      });
    });
  });

  describe('Email Verification Requirement', () => {
    it('should allow access when email is verified', async () => {
      stubAuthenticated(true);

      const Wrapper = createWrapper();
      render(<VerificationRequiredPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('verified-content')).toHaveTextContent('Verified Content');
      });
    });

    it('should indicate redirect when email is not verified', async () => {
      stubAuthenticated(false);

      const Wrapper = createWrapper();
      render(<VerificationRequiredPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('redirect-needed')).toBeInTheDocument();
      });
    });

    it('should show email verification message when not verified', async () => {
      stubAuthenticated(false);

      const Wrapper = createWrapper();
      render(<VerificationRequiredPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('session-message')).toHaveTextContent(
          'Please verify your email to access this page.'
        );
      });
    });
  });

  describe('Guest Access (Unauthenticated Required)', () => {
    it('should indicate redirect when authenticated user accesses guest-only page', async () => {
      stubAuthenticated();

      function GuestOnlyPage() {
        const { isLoading, shouldRedirect, redirectPath } = useSessionGuard({
          requireAuth: false, // Guest only
          redirectAuthenticated: true,
        });

        if (isLoading) {
          return <div data-testid="loading">Loading...</div>;
        }

        if (shouldRedirect) {
          return <div data-testid="redirect-needed">Redirect to: {redirectPath}</div>;
        }

        return <div data-testid="guest-content">Guest Content</div>;
      }

      const Wrapper = createWrapper(['/login']);
      render(<GuestOnlyPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('redirect-needed')).toHaveTextContent('Redirect to: /');
      });
    });

    it('should allow guest access when not authenticated', async () => {
      stubUnauthenticated();

      function GuestOnlyPage() {
        const { isLoading, shouldRedirect } = useSessionGuard({
          requireAuth: false,
          redirectAuthenticated: true,
        });

        if (isLoading) {
          return <div data-testid="loading">Loading...</div>;
        }

        if (shouldRedirect) {
          return <div data-testid="redirect-needed">Redirect needed</div>;
        }

        return <div data-testid="guest-content">Guest Content</div>;
      }

      const Wrapper = createWrapper(['/login']);
      render(<GuestOnlyPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('guest-content')).toHaveTextContent('Guest Content');
      });
    });
  });

  describe('Redirect Path Handling', () => {
    it('should provide login path as default redirect for unauthenticated users', async () => {
      stubUnauthenticated();

      function TestComponent() {
        const { shouldRedirect, redirectPath } = useSessionGuard();

        if (shouldRedirect) {
          return <div data-testid="redirect-path">Redirect to: {redirectPath}</div>;
        }

        return <div>Content</div>;
      }

      const Wrapper = createWrapper(['/protected']);
      render(<TestComponent />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('redirect-path')).toHaveTextContent('Redirect to: /login');
      });
    });

    it('should preserve current path for post-login redirect', async () => {
      stubUnauthenticated();

      function TestComponent() {
        const { shouldRedirect, redirectState } = useSessionGuard();

        if (shouldRedirect) {
          return <div data-testid="redirect-state">From: {redirectState?.from || 'none'}</div>;
        }

        return <div>Content</div>;
      }

      const Wrapper = createWrapper(['/dashboard/horses']);
      render(<TestComponent />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('redirect-state')).toHaveTextContent('From: /dashboard/horses');
      });
    });

    it('should provide custom redirect path when specified', async () => {
      stubUnauthenticated();

      function TestComponent() {
        const { shouldRedirect, redirectPath } = useSessionGuard({
          loginPath: '/auth/login',
        });

        if (shouldRedirect) {
          return <div data-testid="redirect-path">Redirect to: {redirectPath}</div>;
        }

        return <div>Content</div>;
      }

      const Wrapper = createWrapper();
      render(<TestComponent />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('redirect-path')).toHaveTextContent('Redirect to: /auth/login');
      });
    });
  });

  describe('Multiple Guard Instances', () => {
    it('should share auth state across multiple guard instances', async () => {
      let profileCalls = 0;
      server.use(
        http.get(`${base}/api/v1/auth/profile`, () => {
          profileCalls += 1;
          return HttpResponse.json({ data: { user: AUTH_USER } });
        }),
        http.get(`${base}/api/v1/auth/verification-status`, () =>
          HttpResponse.json({
            data: { verified: true, email: 'test@example.com', verifiedAt: '2024-01-01T00:00:00Z' },
          })
        )
      );

      function MultiGuardPage() {
        const guard1 = useSessionGuard();
        const guard2 = useSessionGuard();

        return (
          <div>
            <div data-testid="guard1-loading">{guard1.isLoading ? 'loading' : 'ready'}</div>
            <div data-testid="guard2-loading">{guard2.isLoading ? 'loading' : 'ready'}</div>
          </div>
        );
      }

      const Wrapper = createWrapper();
      render(<MultiGuardPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('guard1-loading')).toHaveTextContent('ready');
        expect(screen.getByTestId('guard2-loading')).toHaveTextContent('ready');
      });

      // Should only call API once due to caching (shared profile query).
      expect(profileCalls).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      server.use(
        http.get(`${base}/api/v1/auth/profile`, () => HttpResponse.error()),
        http.post(`${base}/api/v1/auth/refresh-token`, () => HttpResponse.error()),
        http.get(`${base}/api/v1/auth/verification-status`, () => HttpResponse.error())
      );

      function TestComponent() {
        const { isLoading, shouldRedirect, sessionMessage } = useSessionGuard();

        if (isLoading) {
          return <div data-testid="loading">Loading...</div>;
        }

        return (
          <div>
            <div data-testid="should-redirect">{shouldRedirect ? 'yes' : 'no'}</div>
            <div data-testid="message">{sessionMessage || 'no-message'}</div>
          </div>
        );
      }

      const Wrapper = createWrapper();
      render(<TestComponent />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('should-redirect')).toHaveTextContent('yes');
      });
    });

    it('should handle server errors (500)', async () => {
      server.use(
        http.get(`${base}/api/v1/auth/profile`, () =>
          HttpResponse.json(
            { message: 'Internal server error', status: 'error' },
            { status: 500 }
          )
        ),
        http.get(`${base}/api/v1/auth/verification-status`, () =>
          HttpResponse.json({ message: 'Internal server error' }, { status: 500 })
        )
      );

      function TestComponent() {
        const { isLoading, shouldRedirect, sessionMessage } = useSessionGuard();

        if (isLoading) {
          return <div data-testid="loading">Loading...</div>;
        }

        return (
          <div>
            <div data-testid="should-redirect">{shouldRedirect ? 'yes' : 'no'}</div>
            <div data-testid="message">{sessionMessage || 'no-message'}</div>
          </div>
        );
      }

      const Wrapper = createWrapper();
      render(<TestComponent />, { wrapper: Wrapper });

      await waitFor(() => {
        // Should still redirect on error (treated as unauthenticated)
        expect(screen.getByTestId('should-redirect')).toHaveTextContent('yes');
      });
    });
  });
});
