/**
 * ProtectedRoute Component Tests (Story 8.1: Authentication End-to-End)
 *
 * Tests the auth-only route protection component:
 * - Shows loading state while session is being verified
 * - Renders children when user is authenticated
 * - Redirects unauthenticated users to /login with from state
 * - Redirects with session-expired message on 401 error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from '../../../test/utils';
import { ProtectedRoute } from '../ProtectedRoute';
import { useAuth } from '../../../contexts/AuthContext';

// Mock the AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

// Helper to capture redirect state
const RedirectCapture: React.FC<{ testId: string }> = ({ testId }) => {
  const location = useLocation();
  return (
    <div data-testid={testId}>
      <span data-testid="redirect-from">
        {(location.state as { from?: string })?.from || 'none'}
      </span>
      <span data-testid="redirect-message">
        {(location.state as { message?: string })?.message || 'none'}
      </span>
    </div>
  );
};

const ProtectedContent: React.FC = () => (
  <div data-testid="protected-content">Protected Content</div>
);

interface TestWrapperProps {
  initialRoute?: string;
}

const TestWrapper: React.FC<TestWrapperProps> = ({ initialRoute = '/protected' }) => (
  <MemoryRouter initialEntries={[initialRoute]}>
    <Routes>
      <Route
        path="/protected"
        element={
          <ProtectedRoute>
            <ProtectedContent />
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<RedirectCapture testId="login-page" />} />
    </Routes>
  </MemoryRouter>
);

describe('ProtectedRoute (Story 8.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('shows loading spinner while auth is being checked', () => {
      mockUseAuth.mockReturnValue({
        isLoading: true,
        isAuthenticated: false,
        user: null,
        isEmailVerified: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        hasRole: vi.fn(),
        isAdmin: false,
        isModerator: false,
      });

      render(<TestWrapper />);
      expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
    });

    it('does not render protected content while loading', () => {
      mockUseAuth.mockReturnValue({
        isLoading: true,
        isAuthenticated: false,
        user: null,
        isEmailVerified: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        hasRole: vi.fn(),
        isAdmin: false,
        isModerator: false,
      });

      render(<TestWrapper />);
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('shows "Verifying session..." text while loading', () => {
      mockUseAuth.mockReturnValue({
        isLoading: true,
        isAuthenticated: false,
        user: null,
        isEmailVerified: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        hasRole: vi.fn(),
        isAdmin: false,
        isModerator: false,
      });

      render(<TestWrapper />);
      expect(screen.getByText('Verifying session...')).toBeInTheDocument();
    });
  });

  describe('Authenticated access', () => {
    it('renders children when user is authenticated', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'testuser', email: 'test@example.com', role: 'user' },
        isEmailVerified: true,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        hasRole: vi.fn(),
        isAdmin: false,
        isModerator: false,
      });

      render(<TestWrapper />);
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('does not show loading spinner when authenticated', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'testuser', email: 'test@example.com', role: 'user' },
        isEmailVerified: true,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        hasRole: vi.fn(),
        isAdmin: false,
        isModerator: false,
      });

      render(<TestWrapper />);
      expect(screen.queryByTestId('protected-route-loading')).not.toBeInTheDocument();
    });

    it('does not redirect when authenticated', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'testuser', email: 'test@example.com', role: 'user' },
        isEmailVerified: true,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        hasRole: vi.fn(),
        isAdmin: false,
        isModerator: false,
      });

      render(<TestWrapper />);
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });
  });

  describe('Unauthenticated redirect', () => {
    it('redirects to /login when not authenticated', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        isEmailVerified: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        hasRole: vi.fn(),
        isAdmin: false,
        isModerator: false,
      });

      render(<TestWrapper />);
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('does not render protected content when unauthenticated', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        isEmailVerified: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        hasRole: vi.fn(),
        isAdmin: false,
        isModerator: false,
      });

      render(<TestWrapper />);
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('preserves from path in redirect state', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        isEmailVerified: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        hasRole: vi.fn(),
        isAdmin: false,
        isModerator: false,
      });

      render(<TestWrapper initialRoute="/protected" />);
      expect(screen.getByTestId('redirect-from').textContent).toBe('/protected');
    });
  });

  describe('Session expired (401) redirect', () => {
    it('redirects to /login with session-expired message on 401', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        isEmailVerified: false,
        error: { statusCode: 401, message: 'Unauthorized' } as {
          statusCode: number;
          message: string;
        },
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        hasRole: vi.fn(),
        isAdmin: false,
        isModerator: false,
      });

      render(<TestWrapper />);
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('includes session-expired message in redirect state on 401', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        isEmailVerified: false,
        error: { statusCode: 401, message: 'Unauthorized' } as {
          statusCode: number;
          message: string;
        },
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        hasRole: vi.fn(),
        isAdmin: false,
        isModerator: false,
      });

      render(<TestWrapper />);
      expect(screen.getByTestId('redirect-message').textContent).toBe(
        'Your session has expired. Please log in again.'
      );
    });

    it('does not show session-expired message for non-401 errors', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        isEmailVerified: false,
        error: { statusCode: 500, message: 'Server Error' } as {
          statusCode: number;
          message: string;
        },
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        hasRole: vi.fn(),
        isAdmin: false,
        isModerator: false,
      });

      render(<TestWrapper />);
      // Should still redirect but without the session-expired message
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(screen.getByTestId('redirect-message').textContent).toBe('none');
    });

    it('does not show session-expired message when no error', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        isEmailVerified: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        hasRole: vi.fn(),
        isAdmin: false,
        isModerator: false,
      });

      render(<TestWrapper />);
      expect(screen.getByTestId('redirect-message').textContent).toBe('none');
    });
  });
});
