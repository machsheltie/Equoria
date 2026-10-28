/**
 * EmailVerificationGuard (Equoria-voasj, owner ruling q248 2026-10-28)
 *
 * No play until the player's email is confirmed. A signed-in player whose
 * profile says `emailVerified === false` is sent to /verify-email, where she can
 * ask for a new link or sign out. The server refuses every gameplay route for
 * that account (403 emailNotVerified); this guard only keeps the screens from
 * offering what the server will refuse.
 *
 * Rules:
 *   - Only an explicit `false` redirects; a profile without the field does not.
 *   - Auth still loading, or nobody signed in → no redirect.
 *   - The verify page itself and the signed-out pages (login, register,
 *     password recovery, email-change confirmation) are never redirected away
 *     from, so the emailed links always work.
 */

import React, { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';

const openPaths = new Set([
  '/verify-email',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/confirm-email-change',
]);

const EmailVerificationGuard: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  const mustConfirm =
    !isLoading && !!user && user.emailVerified === false && !openPaths.has(location.pathname);

  if (mustConfirm) return <Navigate to="/verify-email" replace />;
  return <>{children}</>;
};

export default EmailVerificationGuard;
