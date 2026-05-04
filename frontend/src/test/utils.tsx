/**
 * Test Utilities
 *
 * Helper functions and components for testing.
 */

import React from 'react';
import {
  BrowserRouter as RouterBrowserRouter,
  MemoryRouter as RouterMemoryRouter,
} from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '../contexts/AuthContext';
import type { User, UserRole } from '../hooks/useAuth';

// Re-export everything from react-router-dom for convenience
export * from 'react-router-dom';

/**
 * Default mock user for tests that need an authenticated state but
 * don't care about specific user properties.
 */
export const defaultMockUser: User = {
  id: 1,
  username: 'TestUser',
  email: 'test@equoria.local',
  firstName: 'Test',
  lastName: 'User',
  role: 'user',
  money: 5000,
  level: 5,
  xp: 1000,
  completedOnboarding: true,
  onboardingStep: 10,
};

/**
 * Build a mock AuthContextValue. Used by `MockAuthProvider` to inject
 * an authenticated state into tests without exercising the real
 * useProfile / useLogout hooks.
 */
export function buildMockAuthValue(overrides?: Partial<AuthContextValue>): AuthContextValue {
  const user = overrides?.user ?? defaultMockUser;
  const isAuthenticated = overrides?.isAuthenticated ?? !!user;
  const userRole: UserRole = (user?.role ?? 'user') as UserRole;
  const isAdmin = userRole === 'admin';
  const isModerator = userRole === 'moderator' || userRole === 'admin';

  return {
    user,
    isLoading: false,
    isAuthenticated,
    isEmailVerified: true,
    error: null,
    logout: () => {},
    isLoggingOut: false,
    refetchProfile: async () => {},
    userRole,
    hasRole: (role: UserRole) => isAuthenticated && userRole === role,
    hasAnyRole: (roles: UserRole[]) => isAuthenticated && roles.includes(userRole),
    isAdmin,
    isModerator,
    ...overrides,
  };
}

/**
 * MockAuthProvider — wraps children with AuthContext containing a mock
 * authenticated state. Avoids the real AuthProvider's API hooks so tests
 * don't need network mocks for the profile endpoint.
 *
 * Usage:
 *   render(
 *     <MockAuthProvider>
 *       <Component />
 *     </MockAuthProvider>
 *   );
 *
 * Override fields by passing `value` (full) or `userOverrides` (partial user):
 *   <MockAuthProvider userOverrides={{ role: 'admin' }}>...</MockAuthProvider>
 */
export const MockAuthProvider: React.FC<{
  children: React.ReactNode;
  value?: Partial<AuthContextValue>;
  userOverrides?: Partial<User>;
}> = ({ children, value, userOverrides }) => {
  const baseUser = userOverrides ? { ...defaultMockUser, ...userOverrides } : defaultMockUser;
  const contextValue = buildMockAuthValue({ user: baseUser, ...value });
  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

/**
 * BrowserRouter configured with v7 future flags
 * Use this in tests to suppress React Router v7 warnings
 *
 * This replaces the standard BrowserRouter from react-router-dom
 */
export const BrowserRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RouterBrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    {children}
  </RouterBrowserRouter>
);

/**
 * MemoryRouter configured with v7 future flags
 * Use this in tests to suppress React Router v7 warnings
 *
 * This is useful for testing routing behavior without browser navigation
 */
export const MemoryRouter: React.FC<{
  children: React.ReactNode;
  initialEntries?: string[];
  initialIndex?: number;
}> = ({ children, initialEntries, initialIndex }) => (
  <RouterMemoryRouter
    initialEntries={initialEntries}
    initialIndex={initialIndex}
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    {children}
  </RouterMemoryRouter>
);

/**
 * TestRouter - alias for BrowserRouter for backward compatibility
 * Use this in tests that reference TestRouter
 */
export const TestRouter = BrowserRouter;
