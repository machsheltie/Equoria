/**
 * useSessionGuard Hook Tests (Story 1-3: Session Management)
 *
 * Tests for session guard functionality including:
 * - Redirecting to login when session expires
 * - Showing session expired message
 * - Protecting routes that require authentication
 * - Preserving intended destination for post-login redirect
 *
 * Following TDD with minimal mocking approach for authentic validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { useSessionGuard } from '../useSessionGuard';
import * as apiClient from '../../lib/api-client';

// Mock the API client
vi.mock('../../lib/api-client', () => ({
  authApi: {
    getProfile: vi.fn(),
    logout: vi.fn(),
    getVerificationStatus: vi.fn(),
  },
}));

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
function LoginPage() {
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
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Session Validation', () => {
    it('should show loading while checking session', async () => {
      // Never resolve to keep loading state
      vi.mocked(apiClient.authApi.getProfile).mockReturnValue(new Promise(() => {}));
      vi.mocked(apiClient.authApi.getVerificationStatus).mockReturnValue(new Promise(() => {}));

      const Wrapper = createWrapper();
      render(<ProtectedPage />, { wrapper: Wrapper });

      expect(screen.getByTestId('loading')).toHaveTextContent('Loading...');
    });

    it('should allow access when user is authenticated', async () => {
      const mockUser = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      vi.mocked(apiClient.authApi.getProfile).mockResolvedValueOnce(mockUser);
      vi.mocked(apiClient.authApi.getVerificationStatus).mockResolvedValueOnce({
        verified: true,
        email: 'test@example.com',
        verifiedAt: '2024-01-01T00:00:00Z',
      });

      const Wrapper = createWrapper();
      render(<ProtectedPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toHaveTextContent('Protected Content');
      });
    });

    it('should indicate redirect needed when session is expired', async () => {
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Session expired. Please log in again.',
        status: 'error',
      });
      vi.mocked(apiClient.authApi.getVerificationStatus).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Unauthorized',
      });

      const Wrapper = createWrapper();
      render(<ProtectedPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('redirect-needed')).toBeInTheDocument();
      });
    });

    it('should provide session expired message', async () => {
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Session expired. Please log in again.',
        status: 'error',
      });
      vi.mocked(apiClient.authApi.getVerificationStatus).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Unauthorized',
      });

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
      const mockUser = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      vi.mocked(apiClient.authApi.getProfile).mockResolvedValueOnce(mockUser);
      vi.mocked(apiClient.authApi.getVerificationStatus).mockResolvedValueOnce({
        verified: true,
        email: 'test@example.com',
        verifiedAt: '2024-01-01T00:00:00Z',
      });

      const Wrapper = createWrapper();
      render(<VerificationRequiredPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('verified-content')).toHaveTextContent('Verified Content');
      });
    });

    it('should indicate redirect when email is not verified', async () => {
      const mockUser = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      vi.mocked(apiClient.authApi.getProfile).mockResolvedValueOnce(mockUser);
      vi.mocked(apiClient.authApi.getVerificationStatus).mockResolvedValueOnce({
        verified: false,
        email: 'test@example.com',
        verifiedAt: null,
      });

      const Wrapper = createWrapper();
      render(<VerificationRequiredPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('redirect-needed')).toBeInTheDocument();
      });
    });

    it('should show email verification message when not verified', async () => {
      const mockUser = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      vi.mocked(apiClient.authApi.getProfile).mockResolvedValueOnce(mockUser);
      vi.mocked(apiClient.authApi.getVerificationStatus).mockResolvedValueOnce({
        verified: false,
        email: 'test@example.com',
        verifiedAt: null,
      });

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
      const mockUser = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      vi.mocked(apiClient.authApi.getProfile).mockResolvedValueOnce(mockUser);
      vi.mocked(apiClient.authApi.getVerificationStatus).mockResolvedValueOnce({
        verified: true,
        email: 'test@example.com',
        verifiedAt: '2024-01-01T00:00:00Z',
      });

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
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Not authenticated',
      });
      vi.mocked(apiClient.authApi.getVerificationStatus).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Not authenticated',
      });

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
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Not authenticated',
      });
      vi.mocked(apiClient.authApi.getVerificationStatus).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Not authenticated',
      });

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
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Not authenticated',
      });
      vi.mocked(apiClient.authApi.getVerificationStatus).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Not authenticated',
      });

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
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Not authenticated',
      });
      vi.mocked(apiClient.authApi.getVerificationStatus).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Not authenticated',
      });

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
      const mockUser = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      vi.mocked(apiClient.authApi.getProfile).mockResolvedValue(mockUser);
      vi.mocked(apiClient.authApi.getVerificationStatus).mockResolvedValue({
        verified: true,
        email: 'test@example.com',
        verifiedAt: '2024-01-01T00:00:00Z',
      });

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

      // Should only call API once due to caching
      expect(apiClient.authApi.getProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValueOnce({
        statusCode: 0,
        message: 'Network error',
        status: 'error',
      });
      vi.mocked(apiClient.authApi.getVerificationStatus).mockRejectedValueOnce({
        statusCode: 0,
        message: 'Network error',
      });

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
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValueOnce({
        statusCode: 500,
        message: 'Internal server error',
        status: 'error',
      });
      vi.mocked(apiClient.authApi.getVerificationStatus).mockRejectedValueOnce({
        statusCode: 500,
        message: 'Internal server error',
      });

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
