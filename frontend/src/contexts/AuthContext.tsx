/**
 * Auth Context Provider (Story 1-6: Role-Based Access Control)
 *
 * Provides authentication state and actions throughout the app.
 * Uses React Query hooks for data fetching and caching.
 *
 * Features:
 * - Current user state
 * - Authentication status
 * - Loading states
 * - Logout action
 * - Email verification status
 * - Role-based access helpers (hasRole, hasAnyRole, isAdmin, isModerator)
 */

import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useProfile, useLogout, useVerificationStatus, User, UserRole } from '../hooks/useAuth';
import type { ApiError } from '../lib/api-client';

/** Set VITE_DEV_BYPASS_AUTH=true in .env to skip login during local review.
 *  Production guard: bypass is ONLY active in development mode to prevent
 *  accidental admin impersonation if the env var leaks into a production build. */
const DEV_BYPASS = import.meta.env.DEV === true && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

const DEV_USER: User = {
  id: 1,
  username: 'DevUser',
  email: 'dev@equoria.local',
  firstName: 'Dev',
  lastName: 'User',
  role: 'admin',
  money: 5000,
  level: 5,
  xp: 1000,
  completedOnboarding: true,
  onboardingStep: 10,
};

/**
 * Auth context value interface
 */
interface AuthContextValue {
  /** Current authenticated user or null */
  user: User | null;
  /** Whether the initial auth check is loading */
  isLoading: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether the user's email is verified */
  isEmailVerified: boolean;
  /** Error from profile fetch */
  error: ApiError | null;
  /** Logout function */
  logout: () => void;
  /** Whether logout is in progress */
  isLoggingOut: boolean;
  /** Refetch user profile (returns promise so callers can await fresh data) */
  refetchProfile: () => Promise<unknown>;

  // Role-based access helpers (Story 1-6)
  /** Current user's role (defaults to 'user' if not set) */
  userRole: UserRole;
  /** Check if user has a specific role */
  hasRole: (_role: UserRole) => boolean;
  /** Check if user has any of the given roles */
  hasAnyRole: (_roles: UserRole[]) => boolean;
  /** Convenience check for admin role */
  isAdmin: boolean;
  /** Convenience check for moderator role */
  isModerator: boolean;
}

/**
 * Default context value (used when outside provider)
 */
const defaultContextValue: AuthContextValue = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isEmailVerified: false,
  error: null,
  logout: () => {
    console.warn('AuthContext: logout called outside of AuthProvider');
  },
  isLoggingOut: false,
  refetchProfile: async () => {
    console.warn('AuthContext: refetchProfile called outside of AuthProvider');
  },
  // Role helpers (default to 'user' role)
  userRole: 'user',
  hasRole: () => false,
  hasAnyRole: () => false,
  isAdmin: false,
  isModerator: false,
};

/**
 * Auth context
 */
const AuthContext = createContext<AuthContextValue>(defaultContextValue);

/**
 * Auth Provider Props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider Component
 *
 * Wraps the app to provide authentication state.
 * Uses React Query for data fetching and caching.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  // Fetch current user profile
  const {
    data: profileData,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useProfile();

  // Fetch email verification status
  const { data: verificationData } = useVerificationStatus();

  // Logout mutation
  const { mutate: logoutMutate, isPending: isLoggingOut } = useLogout();

  // Derived state
  const user = profileData?.user ?? null;
  const isAuthenticated = !!user;
  const isEmailVerified = verificationData?.verified ?? false;

  // Role helpers (Story 1-6)
  const userRole: UserRole = user?.role ?? 'user';
  const isAdmin = userRole === 'admin';
  const isModerator = userRole === 'moderator' || userRole === 'admin';

  // Role check functions
  const hasRole = useCallback(
    (role: UserRole): boolean => {
      if (!isAuthenticated) return false;
      return userRole === role;
    },
    [isAuthenticated, userRole]
  );

  const hasAnyRole = useCallback(
    (roles: UserRole[]): boolean => {
      if (!isAuthenticated) return false;
      return roles.includes(userRole);
    },
    [isAuthenticated, userRole]
  );

  // Logout handler
  const logout = useCallback(() => {
    logoutMutate();
  }, [logoutMutate]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AuthContextValue>(() => {
    // Dev bypass: return a mock admin user so login can be skipped during local review
    if (DEV_BYPASS) {
      return {
        user: DEV_USER,
        isLoading: false,
        isAuthenticated: true,
        isEmailVerified: true,
        error: null,
        logout: () => {},
        isLoggingOut: false,
        refetchProfile: async () => {},
        userRole: 'admin' as UserRole,
        hasRole: (role: UserRole) => role === 'admin',
        hasAnyRole: (roles: UserRole[]) => roles.includes('admin'),
        isAdmin: true,
        isModerator: true,
      };
    }
    return {
      user,
      isLoading: isProfileLoading,
      isAuthenticated,
      isEmailVerified,
      error: profileError as ApiError | null,
      logout,
      isLoggingOut,
      refetchProfile: () => refetchProfile(),
      // Role helpers (Story 1-6)
      userRole,
      hasRole,
      hasAnyRole,
      isAdmin,
      isModerator,
    };
  }, [
    user,
    isProfileLoading,
    isAuthenticated,
    isEmailVerified,
    profileError,
    logout,
    isLoggingOut,
    refetchProfile,
    userRole,
    hasRole,
    hasAnyRole,
    isAdmin,
    isModerator,
  ]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 *
 * @throws Error if used outside of AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === defaultContextValue) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

/**
 * Export context for testing
 */
export { AuthContext };
export type { AuthContextValue };

// Re-export UserRole type for convenience (Story 1-6)
export type { UserRole } from '../hooks/useAuth';
