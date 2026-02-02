/**
 * RoleProtectedRoute Component Tests (Story 1-6: Role-Based Access Control)
 *
 * Tests the role-based route protection component:
 * - Renders children when user has required role
 * - Shows loading state during auth check
 * - Redirects unauthenticated users to login
 * - Redirects unauthorized users to appropriate page
 * - Supports role hierarchy
 * - Preserves redirect state for post-login navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RoleProtectedRoute } from '../RoleProtectedRoute';
import { useAuth } from '../../../contexts/AuthContext';

// Mock the AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

// Helper component to capture redirect state
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

// Helper component to render protected content
const ProtectedContent: React.FC = () => (
  <div data-testid="protected-content">Protected Content</div>
);

// Wrapper for testing with routes
interface TestWrapperProps {
  children: React.ReactNode;
  initialRoute?: string;
}

const TestWrapper: React.FC<TestWrapperProps> = ({ children, initialRoute = '/protected' }) => (
  <MemoryRouter initialEntries={[initialRoute]}>
    <Routes>
      <Route path="/protected" element={children} />
      <Route path="/login" element={<RedirectCapture testId="login-page" />} />
      <Route path="/unauthorized" element={<RedirectCapture testId="unauthorized-page" />} />
      <Route
        path="/custom-unauthorized"
        element={<RedirectCapture testId="custom-unauthorized" />}
      />
    </Routes>
  </MemoryRouter>
);

describe('RoleProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Loading State
  // ===========================================================================
  describe('Loading State', () => {
    it('renders loading indicator while auth state is loading', () => {
      mockUseAuth.mockReturnValue({
        isLoading: true,
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: false,
        error: null,
      });

      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['admin']}>
            <ProtectedContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('role-guard-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('shows custom loading component when provided', () => {
      mockUseAuth.mockReturnValue({
        isLoading: true,
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: false,
        error: null,
      });

      const CustomLoading = () => <div data-testid="custom-loading">Custom Loading...</div>;

      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['admin']} loadingComponent={<CustomLoading />}>
            <ProtectedContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('custom-loading')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Unauthenticated Users
  // ===========================================================================
  describe('Unauthenticated Users', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: false,
        error: null,
      });
    });

    it('redirects unauthenticated users to login page', () => {
      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['admin']}>
            <ProtectedContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('preserves redirect location in state', () => {
      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['admin']}>
            <ProtectedContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('redirect-from').textContent).toBe('/protected');
    });
  });

  // ===========================================================================
  // Role Validation - Single Role
  // ===========================================================================
  describe('Role Validation - Single Role', () => {
    it('renders children when user has the required role', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' },
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: true,
        error: null,
      });

      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['admin']}>
            <ProtectedContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('redirects when user does not have required role', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'user', email: 'user@test.com', role: 'user' },
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: true,
        error: null,
      });

      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['admin']}>
            <ProtectedContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Role Validation - Multiple Roles
  // ===========================================================================
  describe('Role Validation - Multiple Roles', () => {
    it('grants access when user has one of multiple allowed roles', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'mod', email: 'mod@test.com', role: 'moderator' },
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: true,
        error: null,
      });

      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['admin', 'moderator']}>
            <ProtectedContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Role Hierarchy
  // ===========================================================================
  describe('Role Hierarchy', () => {
    it('grants admin access to moderator-only routes when hierarchy is enabled', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' },
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: true,
        error: null,
      });

      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['moderator']} enableRoleHierarchy>
            <ProtectedContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('denies admin access to moderator-only routes when hierarchy is disabled', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' },
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: true,
        error: null,
      });

      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['moderator']}>
            <ProtectedContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
    });

    it('grants moderator access to user-only routes when hierarchy is enabled', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'mod', email: 'mod@test.com', role: 'moderator' },
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: true,
        error: null,
      });

      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['user']} enableRoleHierarchy>
            <ProtectedContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Custom Configuration
  // ===========================================================================
  describe('Custom Configuration', () => {
    it('uses custom unauthorized redirect path', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'user', email: 'user@test.com', role: 'user' },
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: true,
        error: null,
      });

      render(
        <TestWrapper>
          <RoleProtectedRoute
            allowedRoles={['admin']}
            unauthorizedRedirectPath="/custom-unauthorized"
          >
            <ProtectedContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('custom-unauthorized')).toBeInTheDocument();
    });

    it('passes access denied message in redirect state', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'user', email: 'user@test.com', role: 'user' },
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: true,
        error: null,
      });

      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['admin']} accessDeniedMessage="Admin access required">
            <ProtectedContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('redirect-message').textContent).toBe('Admin access required');
    });
  });

  // ===========================================================================
  // Default Role Handling
  // ===========================================================================
  describe('Default Role Handling', () => {
    it('treats user without role as having default "user" role', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'test', email: 'test@test.com' }, // No role property
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: true,
        error: null,
      });

      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['user']}>
            <ProtectedContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Children Rendering
  // ===========================================================================
  describe('Children Rendering', () => {
    it('renders multiple children correctly', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' },
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: true,
        error: null,
      });

      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['admin']}>
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">Child 2</div>
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });

    it('renders function as children with user role', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' },
        login: vi.fn(),
        logout: vi.fn(),
        isEmailVerified: true,
        error: null,
      });

      render(
        <TestWrapper>
          <RoleProtectedRoute allowedRoles={['admin']}>
            {(userRole) => <div data-testid="role-display">Current role: {userRole}</div>}
          </RoleProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('role-display').textContent).toBe('Current role: admin');
    });
  });
});
