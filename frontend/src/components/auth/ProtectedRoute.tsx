/**
 * ProtectedRoute Component (Story 8.1: Authentication End-to-End)
 *
 * Wraps routes requiring authentication. Uses the existing useSessionGuard hook
 * to check session state and redirect unauthenticated users to /login.
 *
 * Shows a loading spinner while session is being verified, then either:
 * - Renders children if authenticated
 * - Redirects to /login (with session-expired message if 401) if not authenticated
 */

import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSessionGuard } from '../../hooks/useSessionGuard';

export interface ProtectedRouteProps {
  children: ReactNode;
}

const DefaultLoading: React.FC = () => (
  <div
    data-testid="protected-route-loading"
    className="min-h-screen flex items-center justify-center bg-background"
  >
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-burnished-gold border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="fantasy-body text-aged-bronze">Verifying session...</p>
    </div>
  </div>
);

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isLoading, shouldRedirect, redirectPath, redirectState } = useSessionGuard();

  if (isLoading) return <DefaultLoading />;
  if (shouldRedirect) return <Navigate to={redirectPath} replace state={redirectState} />;
  return <>{children}</>;
};

export default ProtectedRoute;
