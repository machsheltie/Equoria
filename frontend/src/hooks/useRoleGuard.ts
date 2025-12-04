/**
 * useRoleGuard Hook (Story 1-6: Role-Based Access Control)
 *
 * Provides role-based route protection functionality:
 * - Checks if user has required role(s)
 * - Handles role hierarchy (admin > moderator > user)
 * - Redirects unauthorized users to appropriate pages
 * - Preserves intended destination for post-login redirect
 *
 * @example
 * // Admin-only route
 * const { hasRequiredRole, shouldRedirect, redirectPath } = useRoleGuard({
 *   allowedRoles: ['admin'],
 * });
 *
 * // Admin or moderator access
 * const { hasRequiredRole } = useRoleGuard({
 *   allowedRoles: ['admin', 'moderator'],
 * });
 *
 * // With role hierarchy (admin can access moderator pages)
 * const { hasRequiredRole } = useRoleGuard({
 *   allowedRoles: ['moderator'],
 *   enableRoleHierarchy: true,
 * });
 */

import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Available user roles in the system.
 * Hierarchy: admin > moderator > user
 */
export type UserRole = 'user' | 'admin' | 'moderator';

/**
 * Role hierarchy levels (higher number = more access)
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  moderator: 2,
  admin: 3,
};

/**
 * Role guard options
 */
export interface RoleGuardOptions {
  /**
   * List of roles allowed to access the route.
   * User must have at least one of these roles.
   */
  allowedRoles: UserRole[];

  /**
   * Enable role hierarchy so higher roles can access lower role pages.
   * When true: admin can access moderator pages, moderator can access user pages.
   * @default false
   */
  enableRoleHierarchy?: boolean;

  /**
   * Path to redirect unauthenticated users to.
   * @default '/login'
   */
  loginPath?: string;

  /**
   * Path to redirect users without required role to.
   * @default '/unauthorized'
   */
  unauthorizedRedirectPath?: string;

  /**
   * Custom message to show when access is denied.
   * @default 'You do not have permission to access this page.'
   */
  accessDeniedMessage?: string;
}

/**
 * Redirect state passed to the target page
 */
export interface RoleRedirectState {
  /** Original path the user was trying to access */
  from?: string;
  /** Message to display (e.g., access denied) */
  message?: string;
}

/**
 * Role guard return value
 */
export interface RoleGuardResult {
  /** Whether the auth/role check is in progress */
  isLoading: boolean;
  /** Whether the user should be redirected */
  shouldRedirect: boolean;
  /** Whether the user has a required role */
  hasRequiredRole: boolean;
  /** Path to redirect to */
  redirectPath: string;
  /** State to pass to the redirect location */
  redirectState: RoleRedirectState | null;
  /** Access denied message (null if access granted) */
  accessDeniedMessage: string | null;
  /** Current user's role (null if not authenticated) */
  userRole: UserRole | null;
}

/**
 * Get user's effective role from user object.
 * Defaults to 'user' if role is not set.
 */
function getUserRole(user: { role?: string } | null): UserRole | null {
  if (!user) return null;
  const role = user.role as UserRole;
  // If role is not set, default to 'user'
  if (!role || !['user', 'admin', 'moderator'].includes(role)) {
    return 'user';
  }
  return role;
}

/**
 * Check if user's role meets the required role(s).
 * Supports role hierarchy when enabled.
 */
function checkRoleAccess(
  userRole: UserRole,
  allowedRoles: UserRole[],
  enableHierarchy: boolean
): boolean {
  // Direct match - user has one of the allowed roles
  if (allowedRoles.includes(userRole)) {
    return true;
  }

  // Check hierarchy if enabled
  if (enableHierarchy) {
    const userLevel = ROLE_HIERARCHY[userRole];
    // User can access if their level is >= any of the allowed role levels
    const minRequiredLevel = Math.min(...allowedRoles.map((r) => ROLE_HIERARCHY[r]));
    return userLevel >= minRequiredLevel;
  }

  return false;
}

/**
 * Role guard hook for role-based route protection
 *
 * @param options - Configuration options
 * @returns Role guard result with redirect information
 */
export function useRoleGuard(options: RoleGuardOptions): RoleGuardResult {
  const {
    allowedRoles,
    enableRoleHierarchy = false,
    loginPath = '/login',
    unauthorizedRedirectPath = '/unauthorized',
    accessDeniedMessage = 'You do not have permission to access this page.',
  } = options;

  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Compute the guard result based on auth state and role
  const result = useMemo<RoleGuardResult>(() => {
    // Get user's role (null if not authenticated)
    const userRole = getUserRole(user);

    // Still loading - no redirect decision yet
    if (isLoading) {
      return {
        isLoading: true,
        shouldRedirect: false,
        hasRequiredRole: false,
        redirectPath: loginPath,
        redirectState: null,
        accessDeniedMessage: null,
        userRole,
      };
    }

    // User is not authenticated - redirect to login
    if (!isAuthenticated || !user) {
      return {
        isLoading: false,
        shouldRedirect: true,
        hasRequiredRole: false,
        redirectPath: loginPath,
        redirectState: {
          from: location.pathname,
          message: undefined,
        },
        accessDeniedMessage: null,
        userRole: null,
      };
    }

    // User is authenticated - check role
    const effectiveRole = userRole || 'user';
    const hasRequiredRole = checkRoleAccess(effectiveRole, allowedRoles, enableRoleHierarchy);

    if (!hasRequiredRole) {
      return {
        isLoading: false,
        shouldRedirect: true,
        hasRequiredRole: false,
        redirectPath: unauthorizedRedirectPath,
        redirectState: {
          from: location.pathname,
          message: accessDeniedMessage,
        },
        accessDeniedMessage,
        userRole: effectiveRole,
      };
    }

    // All checks passed - allow access
    return {
      isLoading: false,
      shouldRedirect: false,
      hasRequiredRole: true,
      redirectPath: loginPath,
      redirectState: null,
      accessDeniedMessage: null,
      userRole: effectiveRole,
    };
  }, [
    isLoading,
    isAuthenticated,
    user,
    allowedRoles,
    enableRoleHierarchy,
    loginPath,
    unauthorizedRedirectPath,
    accessDeniedMessage,
    location.pathname,
  ]);

  return result;
}

export default useRoleGuard;
