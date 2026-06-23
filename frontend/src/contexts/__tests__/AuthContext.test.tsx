/**
 * AuthContext Tests (Story 1-3: Session Management)
 *
 * Tests for authentication context and session management including:
 * - Session persistence across browser sessions
 * - Session expiration handling
 * - Logout functionality
 * - Authentication state management
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (Equoria-f12xy) instead of vi.mock'ing the api-client. The AuthProvider's
 * real profile + verification-status queries and logout mutation run against
 * the stubbed fetch boundary, exercising the actual api-client (incl. the
 * 401→refresh path, which is forced to fail for unauthenticated cases so the
 * provider settles into the not-authenticated state). The user-facing login/
 * logout journeys are also covered by the auth Playwright E2E (tests/e2e/);
 * these unit tests lock the provider's derived-state + cache logic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../AuthContext';
import { server } from '../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AUTH_USER = { id: 'user-uuid-0001', username: 'testuser', email: 'test@example.com' };

/** Stub an authenticated session (profile + verification). */
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

/** Stub an unauthenticated session: profile 401 + failing refresh + verif 401. */
function stubUnauthenticated(message = 'Not authenticated') {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () =>
      HttpResponse.json({ message, status: 'error' }, { status: 401 })
    ),
    http.get(`${base}/api/v1/auth/verification-status`, () =>
      HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    ),
    http.post(`${base}/api/v1/auth/refresh-token`, () =>
      HttpResponse.json({ message: 'no session' }, { status: 401 })
    )
  );
}

/**
 * Test component that uses the auth context
 */
function TestConsumer() {
  const { user, isLoading, isAuthenticated, isEmailVerified, error, logout, isLoggingOut } =
    useAuth();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="authenticated">
        {isAuthenticated ? 'authenticated' : 'not-authenticated'}
      </div>
      <div data-testid="email-verified">{isEmailVerified ? 'verified' : 'not-verified'}</div>
      <div data-testid="user">{user ? user.username : 'no-user'}</div>
      <div data-testid="error">{error ? error.message : 'no-error'}</div>
      <div data-testid="logging-out">{isLoggingOut ? 'yes' : 'no'}</div>
      <button data-testid="logout-btn" onClick={logout}>
        Logout
      </button>
    </div>
  );
}

/**
 * Component that tries to use useAuth without provider
 */
function TestConsumerWithoutProvider() {
  try {
    useAuth();
    return <div>No error thrown</div>;
  } catch (error) {
    return <div data-testid="error-message">{(error as Error).message}</div>;
  }
}

describe('AuthContext - Session Management (Story 1-3)', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
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

  describe('Session Persistence', () => {
    it('should fetch user profile on mount to restore session', async () => {
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

      const Wrapper = createWrapper();
      render(<TestConsumer />, { wrapper: Wrapper });

      // Initially loading
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
      expect(profileCalls).toBe(1);
    });

    it('should remain authenticated when user has valid session', async () => {
      stubAuthenticated();

      const Wrapper = createWrapper();
      const { rerender } = render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      });

      // Rerender simulates component re-mount (like browser refresh)
      rerender(<TestConsumer />);

      // Should still be authenticated (using cached data)
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
    });

    it('should show loading state while checking session', async () => {
      let resolveProfile: (value: Response) => void;
      const profilePromise = new Promise<Response>((resolve) => {
        resolveProfile = resolve;
      });

      server.use(
        http.get(`${base}/api/v1/auth/profile`, () => profilePromise),
        http.get(`${base}/api/v1/auth/verification-status`, () =>
          HttpResponse.json({ data: { verified: false, email: '', verifiedAt: null } })
        )
      );

      const Wrapper = createWrapper();
      render(<TestConsumer />, { wrapper: Wrapper });

      // Should be loading initially
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');

      // Resolve the profile request
      resolveProfile!(HttpResponse.json({ data: { user: AUTH_USER } }));

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
    });
  });

  describe('Session Expiration Handling', () => {
    it('should show not authenticated when session expires (401)', async () => {
      stubUnauthenticated('Session expired. Please log in again.');

      const Wrapper = createWrapper();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });

    it('should expose error when session check fails', async () => {
      server.use(
        http.get(`${base}/api/v1/auth/profile`, () =>
          HttpResponse.json(
            { message: 'Session expired. Please log in again.', status: 'error' },
            { status: 401 }
          )
        ),
        http.post(`${base}/api/v1/auth/refresh-token`, () =>
          HttpResponse.json({ message: 'no session' }, { status: 401 })
        ),
        http.get(`${base}/api/v1/auth/verification-status`, () =>
          HttpResponse.json({ data: { verified: false, email: '', verifiedAt: null } })
        )
      );

      const Wrapper = createWrapper();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Session expired. Please log in again.'
        );
      });
    });

    it('should handle network errors gracefully', async () => {
      server.use(
        http.get(`${base}/api/v1/auth/profile`, () => HttpResponse.error()),
        http.post(`${base}/api/v1/auth/refresh-token`, () => HttpResponse.error()),
        http.get(`${base}/api/v1/auth/verification-status`, () => HttpResponse.error())
      );

      const Wrapper = createWrapper();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('error')).not.toHaveTextContent('no-error');
    });
  });

  describe('Logout Functionality', () => {
    it('should clear all session data on logout', async () => {
      stubAuthenticated();
      server.use(
        http.post(`${base}/api/v1/auth/logout`, () =>
          HttpResponse.json({ data: { message: 'Logout successful' } })
        )
      );

      const Wrapper = createWrapper();
      const user = userEvent.setup();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      });

      await user.click(screen.getByTestId('logout-btn'));

      // logging-out flips back to 'no' once the mutation settles.
      await waitFor(() => {
        expect(screen.getByTestId('logging-out')).toHaveTextContent('no');
      });
    });

    it('should show logging out state during logout', async () => {
      stubAuthenticated();

      let resolveLogout: (value: Response) => void;
      const logoutPromise = new Promise<Response>((resolve) => {
        resolveLogout = resolve;
      });
      server.use(http.post(`${base}/api/v1/auth/logout`, () => logoutPromise));

      const Wrapper = createWrapper();
      const user = userEvent.setup();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      });

      await user.click(screen.getByTestId('logout-btn'));

      // Should show logging out state
      await waitFor(() => {
        expect(screen.getByTestId('logging-out')).toHaveTextContent('yes');
      });

      resolveLogout!(HttpResponse.json({ data: { message: 'Logout successful' } }));

      await waitFor(() => {
        expect(screen.getByTestId('logging-out')).toHaveTextContent('no');
      });
    });

    it('should be callable from any component within provider', async () => {
      stubAuthenticated();
      let logoutCalls = 0;
      server.use(
        http.post(`${base}/api/v1/auth/logout`, () => {
          logoutCalls += 1;
          return HttpResponse.json({ data: { message: 'Logout successful' } });
        })
      );

      function NestedLogoutButton() {
        const { logout } = useAuth();
        return (
          <button data-testid="nested-logout" onClick={logout}>
            Nested Logout
          </button>
        );
      }

      const Wrapper = createWrapper();
      const user = userEvent.setup();
      render(
        <>
          <TestConsumer />
          <NestedLogoutButton />
        </>,
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      });

      await user.click(screen.getByTestId('nested-logout'));

      await waitFor(() => {
        expect(logoutCalls).toBe(1);
      });
    });
  });

  describe('Email Verification Status', () => {
    it('should track email verification status', async () => {
      stubAuthenticated(true);

      const Wrapper = createWrapper();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('email-verified')).toHaveTextContent('verified');
      });
    });

    it('should show not verified when email is not verified', async () => {
      stubAuthenticated(false);

      const Wrapper = createWrapper();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      });

      expect(screen.getByTestId('email-verified')).toHaveTextContent('not-verified');
    });
  });

  describe('useAuth Hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      render(<TestConsumerWithoutProvider />);

      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'useAuth must be used within an AuthProvider'
      );
    });

    it('should provide all auth state values', async () => {
      stubAuthenticated();

      const Wrapper = createWrapper();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('authenticated')).toBeInTheDocument();
      expect(screen.getByTestId('email-verified')).toBeInTheDocument();
      expect(screen.getByTestId('user')).toBeInTheDocument();
      expect(screen.getByTestId('error')).toBeInTheDocument();
      expect(screen.getByTestId('logging-out')).toBeInTheDocument();
      expect(screen.getByTestId('logout-btn')).toBeInTheDocument();
    });
  });

  describe('Unauthenticated State', () => {
    it('should show unauthenticated when no valid session exists', async () => {
      stubUnauthenticated();

      const Wrapper = createWrapper();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
      expect(screen.getByTestId('email-verified')).toHaveTextContent('not-verified');
    });

    it('should call logout and clear queries when logging out', async () => {
      stubAuthenticated();
      let logoutCalls = 0;
      server.use(
        http.post(`${base}/api/v1/auth/logout`, () => {
          logoutCalls += 1;
          return HttpResponse.json({ data: { message: 'Logout successful' } });
        })
      );

      const Wrapper = createWrapper();
      const user = userEvent.setup();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      });

      await user.click(screen.getByTestId('logout-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('logging-out')).toHaveTextContent('no');
      });

      expect(logoutCalls).toBe(1);
    });
  });

  describe('Profile Refetch', () => {
    it('should provide refetchProfile function', async () => {
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

      function RefetchTestComponent() {
        const { refetchProfile, user } = useAuth();
        return (
          <div>
            <span data-testid="username">{user?.username}</span>
            <button data-testid="refetch-btn" onClick={refetchProfile}>
              Refetch
            </button>
          </div>
        );
      }

      const Wrapper = createWrapper();
      const user = userEvent.setup();
      render(<RefetchTestComponent />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('username')).toHaveTextContent('testuser');
      });

      expect(profileCalls).toBe(1);

      await user.click(screen.getByTestId('refetch-btn'));

      await waitFor(() => {
        expect(profileCalls).toBe(2);
      });
    });
  });
});
