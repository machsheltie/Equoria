/**
 * RoleProtectedRoute Component (Story 1-6: Role-Based Access Control)
 *
 * A route wrapper component that protects routes based on user roles.
 * Uses the useRoleGuard hook for role validation and redirects.
 *
 * Features:
 * - Renders children only when user has required role(s)
 * - Shows loading state during auth check
 * - Redirects unauthenticated users to login
 * - Redirects unauthorized users to configurable path
 * - Supports role hierarchy (admin > moderator > user)
 * - Preserves redirect state for post-login navigation
 * - Supports render prop pattern for accessing user role
 *
 * @example
 * // Admin-only route
 * <RoleProtectedRoute allowedRoles={['admin']}>
 *   <AdminDashboard />
 * </RoleProtectedRoute>
 *
 * // Admin or moderator access
 * <RoleProtectedRoute allowedRoles={['admin', 'moderator']}>
 *   <ModeratorTools />
 * </RoleProtectedRoute>
 *
 * // With role hierarchy enabled (admin can access moderator pages)
 * <RoleProtectedRoute allowedRoles={['moderator']} enableRoleHierarchy>
 *   <ContentModeration />
 * </RoleProtectedRoute>
 *
 * // With render prop to access user role
 * <RoleProtectedRoute allowedRoles={['user']}>
 *   {(userRole) => <UserPanel role={userRole} />}
 * </RoleProtectedRoute>
 */

import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useRoleGuard, UserRole, RoleRedirectState } from '../../hooks/useRoleGuard';

// =============================================================================
// Types
// =============================================================================

/**
 * Children can be either ReactNode or a render function that receives user role
 */
type RoleProtectedChildren = ReactNode | ((userRole: UserRole) => ReactNode);

/**
 * Props for RoleProtectedRoute component
 */
export interface RoleProtectedRouteProps {
  /**
   * Content to render when access is granted.
   * Can be ReactNode or a function that receives the user's role.
   */
  children: RoleProtectedChildren;

  /**
   * List of roles allowed to access this route.
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

  /**
   * Custom loading component to show while checking auth state.
   * If not provided, shows a default loading indicator.
   */
  loadingComponent?: ReactNode;
}

// =============================================================================
// Default Loading Component
// =============================================================================

/**
 * Default loading indicator shown during auth check
 */
const DefaultLoading: React.FC = () => (
  <div
    data-testid="role-guard-loading"
    className="min-h-screen flex items-center justify-center bg-background"
  >
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-burnished-gold border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="fantasy-body text-aged-bronze">Verifying access...</p>
    </div>
  </div>
);

// =============================================================================
// Component Implementation
// =============================================================================

/**
 * Role-based route protection component
 *
 * Wraps route content and checks if the current user has the required role(s)
 * before rendering. Handles loading states and redirects appropriately.
 */
export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({
  children,
  allowedRoles,
  enableRoleHierarchy = false,
  loginPath = '/login',
  unauthorizedRedirectPath = '/unauthorized',
  accessDeniedMessage = 'You do not have permission to access this page.',
  loadingComponent,
}) => {
  const location = useLocation();

  // Use the role guard hook to determine access
  const {
    isLoading,
    shouldRedirect,
    hasRequiredRole,
    redirectPath,
    redirectState,
    userRole,
  } = useRoleGuard({
    allowedRoles,
    enableRoleHierarchy,
    loginPath,
    unauthorizedRedirectPath,
    accessDeniedMessage,
  });

  // Show loading state while checking auth
  if (isLoading) {
    return loadingComponent ? <>{loadingComponent}</> : <DefaultLoading />;
  }

  // Redirect if not authorized
  if (shouldRedirect) {
    return (
      <Navigate
        to={redirectPath}
        replace
        state={redirectState as RoleRedirectState}
      />
    );
  }

  // Access granted - render children
  if (hasRequiredRole && userRole) {
    // Support render prop pattern
    if (typeof children === 'function') {
      return <>{children(userRole)}</>;
    }
    return <>{children}</>;
  }

  // Fallback (should not reach here normally)
  return null;
};

// =============================================================================
// Exports
// =============================================================================

export default RoleProtectedRoute;

// Re-export types for convenience
export type { UserRole } from '../../hooks/useRoleGuard';
