/**
 * Auth Context Provider
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
 */

import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useProfile, useLogout, useVerificationStatus, User } from '../hooks/useAuth';
import type { ApiError } from '../lib/api-client';

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
  /** Refetch user profile */
  refetchProfile: () => void;
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
  refetchProfile: () => {
    console.warn('AuthContext: refetchProfile called outside of AuthProvider');
  },
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

  // Logout handler
  const logout = useCallback(() => {
    logoutMutate();
  }, [logoutMutate]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading: isProfileLoading,
      isAuthenticated,
      isEmailVerified,
      error: profileError as ApiError | null,
      logout,
      isLoggingOut,
      refetchProfile: () => refetchProfile(),
    }),
    [
      user,
      isProfileLoading,
      isAuthenticated,
      isEmailVerified,
      profileError,
      logout,
      isLoggingOut,
      refetchProfile,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
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
