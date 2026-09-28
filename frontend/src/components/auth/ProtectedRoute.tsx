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

import React, { ReactNode, useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useSessionGuard } from '../../hooks/useSessionGuard';
import { subscribeSessionEnd, type SessionEndReason } from '../../lib/sessionEnd';
import { safeRedirectTarget } from '../../lib/safeRedirect';

export interface ProtectedRouteProps {
  children: ReactNode;
}

const DefaultLoading: React.FC = () => (
  <div
    data-testid="protected-route-loading"
    className="min-h-screen flex items-center justify-center bg-[var(--bg-deep-space)]"
  >
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-[var(--gold-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="fantasy-body text-[var(--text-secondary)]">Verifying session...</p>
    </div>
  </div>
);

const SESSION_END_MESSAGES: Record<SessionEndReason, string> = {
  expired: 'Your session has expired. Please log in again.',
  'signed-out-elsewhere': 'You were signed out in another tab. Please log in again.',
};

/**
 * Equoria-bvddn.29: when the session ends (lib/sessionEnd.ts), leave the
 * protected page for /login and carry a same-origin return path. Only
 * protected routes subscribe, so /login and the other public pages never
 * redirect to themselves.
 */
function useSessionEndRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(
    () =>
      subscribeSessionEnd((reason) => {
        const { pathname, search, hash } = locationRef.current;
        navigate('/login', {
          replace: true,
          state: {
            from: safeRedirectTarget(pathname + search + hash, '/'),
            message: SESSION_END_MESSAGES[reason],
          },
        });
      }),
    [navigate]
  );
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isLoading, shouldRedirect, redirectPath, redirectState } = useSessionGuard();
  useSessionEndRedirect();

  if (isLoading) return <DefaultLoading />;
  if (shouldRedirect) return <Navigate to={redirectPath} replace state={redirectState} />;
  return <>{children}</>;
};

export default ProtectedRoute;
