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

/**
 * Local-dev auth bypass — isolated + statically tree-shaken from production
 * (Equoria-c3n0u).
 *
 * Local developer workflow (RETAINED, opt-in): set `VITE_DEV_BYPASS_AUTH=true`
 * in a local `.env`/`.env.local` while running `vite dev` to skip the login
 * flow during UI review. The mock session below is returned in place of the
 * real profile/verification queries. This is a convenience for local review
 * ONLY — it is never available to testers or production users.
 *
 * Why production can never be bypassed (structural, not just conventional):
 *   - `import.meta.env.DEV` is a Vite *build-time constant*. In any production
 *     build (`vite build`, `import.meta.env.PROD === true`) it is statically
 *     replaced with the literal `false`. The leading conjunct below therefore
 *     becomes `false === true` → `false`, the whole `&&` short-circuits to the
 *     literal `false`, and Vite's dead-code elimination *removes the entire
 *     `if (DEV_BYPASS)` branch from the production bundle*. Even if a production
 *     `.env` accidentally carries `VITE_DEV_BYPASS_AUTH=true`, the second
 *     conjunct is never evaluated — the bypass cannot reactivate.
 *   - The leading `import.meta.env.DEV === true` conjunct MUST stay first and
 *     literal for this static elimination to hold. The sibling sentinel test
 *     `AuthContext.devBypass.sentinel.test.tsx` FAILS if this guard is removed,
 *     reordered, or otherwise made reachable in production mode.
 *
 * Defense-in-depth (Equoria-o7c0x L6): the bypass user is 'user' role, not
 * 'admin', so a misconfigured dev build cannot grant admin UI surfaces.
 *
 * NOTE: the gate predicate is duplicated as the exported pure helper
 * `isDevBypassActive()` below for behavioral unit-testing. The inline
 * `import.meta.env.DEV === true && ...` form at THIS call site is what Vite
 * tree-shakes; routing the call-site value through a function would defeat the
 * static elimination, so the inline form is intentionally retained here.
 */
const DEV_BYPASS = import.meta.env.DEV === true && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

/**
 * Pure, side-effect-free mirror of the {@link DEV_BYPASS} gate predicate,
 * exported for sentinel testing (Equoria-c3n0u). Given an environment object,
 * returns true ONLY when the build is in development mode AND the opt-in flag
 * is the string `'true'`.
 *
 * This makes the production-safety property assertable in a test: passing a
 * production-shaped env (`{ DEV: false, PROD: true, VITE_DEV_BYPASS_AUTH:
 * 'true' }`) MUST return false — i.e. the bypass cannot be active in
 * production even when the flag is set. It mirrors the inline call-site logic
 * exactly so the sentinel detects divergence.
 */
export function isDevBypassActive(
  env: { DEV?: boolean; VITE_DEV_BYPASS_AUTH?: string } = import.meta.env
): boolean {
  return env.DEV === true && env.VITE_DEV_BYPASS_AUTH === 'true';
}

const DEV_USER: User = {
  id: 1,
  username: 'DevUser',
  email: 'dev@equoria.local',
  firstName: 'Dev',
  lastName: 'User',
  role: 'user',
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
    // Dev bypass: return a mock user so login can be skipped during local review.
    // Role is 'user' (not 'admin') for defense-in-depth (Equoria-o7c0x L6).
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
        userRole: 'user' as UserRole,
        hasRole: (role: UserRole) => role === 'user',
        hasAnyRole: (roles: UserRole[]) => roles.includes('user'),
        isAdmin: false,
        isModerator: false,
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
