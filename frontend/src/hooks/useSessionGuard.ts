/**
 * useSessionGuard Hook (Story 1-3: Session Management)
 *
 * Provides session guard functionality for route protection:
 * - Checks if user is authenticated
 * - Handles session expiration with redirect and message
 * - Supports email verification requirement
 * - Supports guest-only pages (redirect authenticated users)
 * - Preserves intended destination for post-login redirect
 *
 * @example
 * // Protected route (default)
 * const { isLoading, shouldRedirect, sessionMessage, redirectPath } = useSessionGuard();
 *
 * // Require email verification
 * const { shouldRedirect } = useSessionGuard({ requireEmailVerification: true });
 *
 * // Guest-only page (login page)
 * const { shouldRedirect, redirectPath } = useSessionGuard({
 *   requireAuth: false,
 *   redirectAuthenticated: true,
 * });
 */

import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Session guard options
 */
export interface SessionGuardOptions {
  /**
   * Require authentication to access the page.
   * When true (default), unauthenticated users will be redirected to login.
   * When false with redirectAuthenticated=true, creates a guest-only page.
   * @default true
   */
  requireAuth?: boolean;

  /**
   * Require email verification to access the page.
   * Only applies when requireAuth is true.
   * @default false
   */
  requireEmailVerification?: boolean;

  /**
   * Redirect authenticated users away from this page.
   * Useful for login/register pages that should only be accessed by guests.
   * @default false
   */
  redirectAuthenticated?: boolean;

  /**
   * Path to redirect unauthenticated users to.
   * @default '/login'
   */
  loginPath?: string;

  /**
   * Path to redirect authenticated users to (when redirectAuthenticated is true).
   * @default '/'
   */
  authenticatedRedirectPath?: string;
}

/**
 * Redirect state passed to the target page
 */
export interface RedirectState {
  /** Original path the user was trying to access */
  from?: string;
  /** Message to display (e.g., session expired) */
  message?: string;
}

/**
 * Session guard return value
 */
export interface SessionGuardResult {
  /** Whether the session check is in progress */
  isLoading: boolean;
  /** Whether the user should be redirected */
  shouldRedirect: boolean;
  /** Message to display to the user (e.g., "Your session has expired") */
  sessionMessage: string | null;
  /** Path to redirect to */
  redirectPath: string;
  /** State to pass to the redirect location */
  redirectState: RedirectState | null;
}

/**
 * Session guard hook for route protection
 *
 * @param options - Configuration options
 * @returns Session guard result with redirect information
 */
export function useSessionGuard(
  options: SessionGuardOptions = {}
): SessionGuardResult {
  const {
    requireAuth = true,
    requireEmailVerification = false,
    redirectAuthenticated = false,
    loginPath = '/login',
    authenticatedRedirectPath = '/',
  } = options;

  const { isLoading, isAuthenticated, isEmailVerified, error } = useAuth();
  const location = useLocation();

  // Compute the guard result based on auth state and options
  const result = useMemo<SessionGuardResult>(() => {
    // Still loading - no redirect decision yet
    if (isLoading) {
      return {
        isLoading: true,
        shouldRedirect: false,
        sessionMessage: null,
        redirectPath: loginPath,
        redirectState: null,
      };
    }

    // Guest-only page: redirect authenticated users
    if (!requireAuth && redirectAuthenticated && isAuthenticated) {
      return {
        isLoading: false,
        shouldRedirect: true,
        sessionMessage: null,
        redirectPath: authenticatedRedirectPath,
        redirectState: null,
      };
    }

    // Guest-only page: allow unauthenticated users
    if (!requireAuth) {
      return {
        isLoading: false,
        shouldRedirect: false,
        sessionMessage: null,
        redirectPath: loginPath,
        redirectState: null,
      };
    }

    // Protected page: user is not authenticated
    if (!isAuthenticated) {
      // Determine the message based on error type
      let sessionMessage: string | null = null;

      if (error) {
        // Check for 401 (session expired) vs other errors
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 401) {
          sessionMessage = 'Your session has expired. Please log in again.';
        } else if (statusCode === 0 || !statusCode) {
          // Network error - still redirect but with generic message
          sessionMessage = null;
        } else {
          // Server error - still redirect
          sessionMessage = null;
        }
      }

      return {
        isLoading: false,
        shouldRedirect: true,
        sessionMessage,
        redirectPath: loginPath,
        redirectState: {
          from: location.pathname,
          message: sessionMessage || undefined,
        },
      };
    }

    // Protected page with email verification requirement
    if (requireEmailVerification && !isEmailVerified) {
      return {
        isLoading: false,
        shouldRedirect: true,
        sessionMessage: 'Please verify your email to access this page.',
        redirectPath: '/verify-email',
        redirectState: {
          from: location.pathname,
          message: 'Please verify your email to access this page.',
        },
      };
    }

    // All checks passed - allow access
    return {
      isLoading: false,
      shouldRedirect: false,
      sessionMessage: null,
      redirectPath: loginPath,
      redirectState: null,
    };
  }, [
    isLoading,
    isAuthenticated,
    isEmailVerified,
    error,
    requireAuth,
    requireEmailVerification,
    redirectAuthenticated,
    loginPath,
    authenticatedRedirectPath,
    location.pathname,
  ]);

  return result;
}

export default useSessionGuard;
