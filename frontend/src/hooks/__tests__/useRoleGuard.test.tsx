/**
 * useRoleGuard Hook Tests (Story 1-6: Role-Based Access Control)
 *
 * Tests for the useRoleGuard hook that provides role-based route protection.
 * Supports user roles: user, admin, moderator
 *
 * @vitest-environment jsdom
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import { useRoleGuard, UserRole } from '../useRoleGuard';
import * as AuthContext from '../../contexts/AuthContext';

// Mock the AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(AuthContext.useAuth);

/**
 * Wrapper component for testing hooks with router context
 */
function createWrapper(initialEntries: string[] = ['/admin']) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    );
  };
}

/**
 * Mock user factory
 */
function createMockUser(role: UserRole = 'user') {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    role,
  };
}

describe('useRoleGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Role Type Exports', () => {
    test('exports UserRole type with expected values', () => {
      // Type assertion test - if these compile, the types exist
      const userRole: UserRole = 'user';
      const adminRole: UserRole = 'admin';
      const moderatorRole: UserRole = 'moderator';

      expect(userRole).toBe('user');
      expect(adminRole).toBe('admin');
      expect(moderatorRole).toBe('moderator');
    });
  });

  describe('Loading State', () => {
    test('returns isLoading true while auth is loading', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        isEmailVerified: false,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.shouldRedirect).toBe(false);
    });

    test('does not make redirect decision while loading', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        isEmailVerified: false,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.hasRequiredRole).toBe(false);
    });
  });

  describe('Unauthenticated User', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        isEmailVerified: false,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });
    });

    test('redirects unauthenticated users to login', () => {
      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.shouldRedirect).toBe(true);
      expect(result.current.redirectPath).toBe('/login');
    });

    test('does not have required role when unauthenticated', () => {
      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['user'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.hasRequiredRole).toBe(false);
    });

    test('preserves intended destination in redirect state', () => {
      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin'] }),
        { wrapper: createWrapper(['/admin/dashboard']) }
      );

      expect(result.current.redirectState?.from).toBe('/admin/dashboard');
    });
  });

  describe('Role Validation - Single Role', () => {
    test('allows access when user has required admin role', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('admin'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.shouldRedirect).toBe(false);
      expect(result.current.hasRequiredRole).toBe(true);
    });

    test('allows access when user has required moderator role', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('moderator'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['moderator'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.shouldRedirect).toBe(false);
      expect(result.current.hasRequiredRole).toBe(true);
    });

    test('allows access when user has required user role', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('user'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['user'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.shouldRedirect).toBe(false);
      expect(result.current.hasRequiredRole).toBe(true);
    });

    test('denies access when user does not have required role', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('user'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.shouldRedirect).toBe(true);
      expect(result.current.hasRequiredRole).toBe(false);
    });
  });

  describe('Role Validation - Multiple Roles', () => {
    test('allows access when user role is in allowed list', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('moderator'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin', 'moderator'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.shouldRedirect).toBe(false);
      expect(result.current.hasRequiredRole).toBe(true);
    });

    test('denies access when user role not in allowed list', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('user'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin', 'moderator'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.shouldRedirect).toBe(true);
      expect(result.current.hasRequiredRole).toBe(false);
    });

    test('allows any authenticated user when all roles specified', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('user'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['user', 'admin', 'moderator'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.shouldRedirect).toBe(false);
      expect(result.current.hasRequiredRole).toBe(true);
    });
  });

  describe('Redirect Configuration', () => {
    test('redirects to custom path when specified', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('user'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({
          allowedRoles: ['admin'],
          unauthorizedRedirectPath: '/forbidden',
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.redirectPath).toBe('/forbidden');
    });

    test('uses default unauthorized path when role check fails', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('user'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.redirectPath).toBe('/unauthorized');
    });

    test('uses login path when unauthenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        isEmailVerified: false,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({
          allowedRoles: ['admin'],
          loginPath: '/signin',
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.redirectPath).toBe('/signin');
    });
  });

  describe('Access Denied Message', () => {
    test('provides access denied message when role check fails', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('user'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.accessDeniedMessage).toBe(
        'You do not have permission to access this page.'
      );
    });

    test('no access denied message when access is granted', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('admin'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.accessDeniedMessage).toBeNull();
    });

    test('uses custom access denied message when provided', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('user'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({
          allowedRoles: ['admin'],
          accessDeniedMessage: 'Admins only!',
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.accessDeniedMessage).toBe('Admins only!');
    });
  });

  describe('User Role Exposure', () => {
    test('exposes current user role', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('moderator'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.userRole).toBe('moderator');
    });

    test('returns null for user role when not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        isEmailVerified: false,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.userRole).toBeNull();
    });
  });

  describe('Role Hierarchy (Admin Access)', () => {
    test('admin can access moderator-only pages when hierarchy enabled', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('admin'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({
          allowedRoles: ['moderator'],
          enableRoleHierarchy: true,
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.shouldRedirect).toBe(false);
      expect(result.current.hasRequiredRole).toBe(true);
    });

    test('admin can access user-only pages when hierarchy enabled', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('admin'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({
          allowedRoles: ['user'],
          enableRoleHierarchy: true,
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.shouldRedirect).toBe(false);
      expect(result.current.hasRequiredRole).toBe(true);
    });

    test('moderator can access user-only pages when hierarchy enabled', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('moderator'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({
          allowedRoles: ['user'],
          enableRoleHierarchy: true,
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.shouldRedirect).toBe(false);
      expect(result.current.hasRequiredRole).toBe(true);
    });

    test('user cannot access admin pages even with hierarchy', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('user'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({
          allowedRoles: ['admin'],
          enableRoleHierarchy: true,
        }),
        { wrapper: createWrapper() }
      );

      expect(result.current.shouldRedirect).toBe(true);
      expect(result.current.hasRequiredRole).toBe(false);
    });

    test('hierarchy is disabled by default', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser('admin'),
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['moderator'] }),
        { wrapper: createWrapper() }
      );

      // Without hierarchy, admin cannot access moderator-only
      expect(result.current.shouldRedirect).toBe(true);
      expect(result.current.hasRequiredRole).toBe(false);
    });
  });

  describe('Default Role Handling', () => {
    test('treats missing role as "user" role', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 1, username: 'test', email: 'test@example.com' }, // No role field
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['user'] }),
        { wrapper: createWrapper() }
      );

      expect(result.current.shouldRedirect).toBe(false);
      expect(result.current.hasRequiredRole).toBe(true);
      expect(result.current.userRole).toBe('user');
    });
  });

  describe('Integration with Session Guard', () => {
    test('checks authentication before role', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        isEmailVerified: false,
        error: null,
        logout: vi.fn(),
        isLoggingOut: false,
        refetchProfile: vi.fn(),
      });

      const { result } = renderHook(
        () => useRoleGuard({ allowedRoles: ['admin'] }),
        { wrapper: createWrapper() }
      );

      // Should redirect to login, not unauthorized
      expect(result.current.redirectPath).toBe('/login');
    });
  });
});
