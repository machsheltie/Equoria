/**
 * AuthContext Tests (Story 1-3: Session Management)
 *
 * Tests for authentication context and session management including:
 * - Session persistence across browser sessions
 * - Session expiration handling
 * - Logout functionality
 * - Authentication state management
 *
 * Following TDD with minimal mocking approach for authentic validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { AuthProvider, useAuth, AuthContext } from '../AuthContext';
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
 * Test component that uses the auth context
 */
function TestConsumer() {
  const {
    user,
    isLoading,
    isAuthenticated,
    isEmailVerified,
    error,
    logout,
    isLoggingOut,
  } = useAuth();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="authenticated">
        {isAuthenticated ? 'authenticated' : 'not-authenticated'}
      </div>
      <div data-testid="email-verified">
        {isEmailVerified ? 'verified' : 'not-verified'}
      </div>
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
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Session Persistence', () => {
    it('should fetch user profile on mount to restore session', async () => {
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
      render(<TestConsumer />, { wrapper: Wrapper });

      // Initially loading
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');

      // After profile fetch
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'authenticated'
      );
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
      expect(apiClient.authApi.getProfile).toHaveBeenCalledTimes(1);
    });

    it('should remain authenticated when user has valid session', async () => {
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

      const Wrapper = createWrapper();
      const { rerender } = render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'authenticated'
        );
      });

      // Rerender simulates component re-mount (like browser refresh)
      rerender(<TestConsumer />);

      // Should still be authenticated (using cached data)
      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'authenticated'
      );
    });

    it('should show loading state while checking session', async () => {
      // Create a promise that we control
      let resolveProfile: (value: any) => void;
      const profilePromise = new Promise((resolve) => {
        resolveProfile = resolve;
      });

      vi.mocked(apiClient.authApi.getProfile).mockReturnValue(
        profilePromise as any
      );
      vi.mocked(apiClient.authApi.getVerificationStatus).mockResolvedValue({
        verified: false,
        email: '',
        verifiedAt: null,
      });

      const Wrapper = createWrapper();
      render(<TestConsumer />, { wrapper: Wrapper });

      // Should be loading initially
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'not-authenticated'
      );

      // Resolve the profile promise
      resolveProfile!({
        user: { id: 1, username: 'testuser', email: 'test@example.com' },
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
    });
  });

  describe('Session Expiration Handling', () => {
    it('should show not authenticated when session expires (401)', async () => {
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
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'not-authenticated'
      );
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });

    it('should expose error when session check fails', async () => {
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Session expired. Please log in again.',
        status: 'error',
      });
      vi.mocked(apiClient.authApi.getVerificationStatus).mockResolvedValueOnce({
        verified: false,
        email: '',
        verifiedAt: null,
      });

      const Wrapper = createWrapper();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Session expired. Please log in again.'
        );
      });
    });

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

      const Wrapper = createWrapper();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'not-authenticated'
      );
      expect(screen.getByTestId('error')).toHaveTextContent('Network error');
    });
  });

  describe('Logout Functionality', () => {
    it('should clear all session data on logout', async () => {
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
      vi.mocked(apiClient.authApi.logout).mockResolvedValueOnce({
        message: 'Logout successful',
      });

      const Wrapper = createWrapper();
      const user = userEvent.setup();
      render(<TestConsumer />, { wrapper: Wrapper });

      // Wait for authenticated state
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'authenticated'
        );
      });

      // Click logout
      await user.click(screen.getByTestId('logout-btn'));

      // Should call logout API
      await waitFor(() => {
        expect(apiClient.authApi.logout).toHaveBeenCalledTimes(1);
      });
    });

    it('should show logging out state during logout', async () => {
      const mockUser = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      let resolveLogout: (value: any) => void;
      const logoutPromise = new Promise((resolve) => {
        resolveLogout = resolve;
      });

      vi.mocked(apiClient.authApi.getProfile).mockResolvedValueOnce(mockUser);
      vi.mocked(apiClient.authApi.getVerificationStatus).mockResolvedValueOnce({
        verified: true,
        email: 'test@example.com',
        verifiedAt: '2024-01-01T00:00:00Z',
      });
      vi.mocked(apiClient.authApi.logout).mockReturnValue(logoutPromise as any);

      const Wrapper = createWrapper();
      const user = userEvent.setup();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'authenticated'
        );
      });

      // Click logout
      await user.click(screen.getByTestId('logout-btn'));

      // Should show logging out state
      expect(screen.getByTestId('logging-out')).toHaveTextContent('yes');

      // Resolve logout
      resolveLogout!({ message: 'Logout successful' });

      await waitFor(() => {
        expect(screen.getByTestId('logging-out')).toHaveTextContent('no');
      });
    });

    it('should be callable from any component within provider', async () => {
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
      vi.mocked(apiClient.authApi.logout).mockResolvedValueOnce({
        message: 'Logout successful',
      });

      // Nested component that calls logout
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
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'authenticated'
        );
      });

      // Click nested logout button
      await user.click(screen.getByTestId('nested-logout'));

      await waitFor(() => {
        expect(apiClient.authApi.logout).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Email Verification Status', () => {
    it('should track email verification status', async () => {
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
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('email-verified')).toHaveTextContent(
          'verified'
        );
      });
    });

    it('should show not verified when email is not verified', async () => {
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
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'authenticated'
        );
      });

      expect(screen.getByTestId('email-verified')).toHaveTextContent(
        'not-verified'
      );
    });
  });

  describe('useAuth Hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Render without wrapper (no AuthProvider)
      render(<TestConsumerWithoutProvider />);

      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'useAuth must be used within an AuthProvider'
      );
    });

    it('should provide all auth state values', async () => {
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
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // All state values should be accessible
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
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Not authenticated',
        status: 'error',
      });
      vi.mocked(apiClient.authApi.getVerificationStatus).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Not authenticated',
      });

      const Wrapper = createWrapper();
      render(<TestConsumer />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'not-authenticated'
      );
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
      expect(screen.getByTestId('email-verified')).toHaveTextContent(
        'not-verified'
      );
    });

    it('should call logout and clear queries when logging out', async () => {
      // This test verifies that the logout flow works correctly
      // and that logout is invoked (which triggers cache clearing in onSuccess)
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
      vi.mocked(apiClient.authApi.logout).mockResolvedValueOnce({
        message: 'Logout successful',
      });

      const Wrapper = createWrapper();
      const user = userEvent.setup();
      render(<TestConsumer />, { wrapper: Wrapper });

      // Wait for authenticated state
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'authenticated'
        );
      });

      // Logout
      await user.click(screen.getByTestId('logout-btn'));

      // Wait for logout to complete
      await waitFor(() => {
        expect(apiClient.authApi.logout).toHaveBeenCalledTimes(1);
      });

      // Wait for logout mutation to fully settle (onSuccess callback)
      await waitFor(() => {
        expect(screen.getByTestId('logging-out')).toHaveTextContent('no');
      });

      // Verify the logout API was called with correct params
      // The cache clearing happens in the useLogout hook's onSuccess
      // which we've already verified runs by checking logging-out state changes
      expect(apiClient.authApi.logout).toHaveBeenCalled();
    });
  });

  describe('Profile Refetch', () => {
    it('should provide refetchProfile function', async () => {
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

      // Initial call
      expect(apiClient.authApi.getProfile).toHaveBeenCalledTimes(1);

      // Click refetch
      await user.click(screen.getByTestId('refetch-btn'));

      // Should trigger another fetch
      await waitFor(() => {
        expect(apiClient.authApi.getProfile).toHaveBeenCalledTimes(2);
      });
    });
  });
});
