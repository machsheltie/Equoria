/**
 * OnboardingGuard
 *
 * Redirects newly registered players to the /onboarding wizard when
 * their User.completedOnboarding flag is explicitly `false` AND they
 * haven't yet started the 10-step spotlight tour (onboardingStep === 0).
 *
 * Rules:
 *   - Only redirects if completedOnboarding === false AND onboardingStep === 0
 *   - Players mid-tour (onboardingStep >= 1) can navigate freely
 *   - Legacy accounts with undefined completedOnboarding are NOT redirected
 *   - Already on /onboarding → no redirect (avoids infinite loop)
 *   - Auth still loading → no redirect (wait for profile)
 *
 * Server state is the sole source of truth. localStorage flags are not
 * consulted — they can be stale or manipulated and must not gate
 * beta-critical routing.
 */

import React, { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';

/** Never redirected away from: the wizard itself (Equoria-bvddn.38). */
const EXEMPT_PATHS = new Set(['/onboarding']);

/**
 * Emailed-link routes are exempt only when they carry a token, so the link is
 * always consumed. Token-less /verify-email is where registration lands a new
 * player, and that visit still continues into the wizard.
 */
const TOKEN_PATHS = new Set(['/verify-email', '/reset-password', '/confirm-email-change']);

const OnboardingGuard: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  const carriesToken =
    TOKEN_PATHS.has(location.pathname) && new URLSearchParams(location.search).has('token');

  const mustOnboard =
    !isLoading &&
    !!user &&
    !EXEMPT_PATHS.has(location.pathname) &&
    !carriesToken &&
    user.completedOnboarding === false &&
    (user.onboardingStep ?? 0) === 0;

  if (mustOnboard) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

export default OnboardingGuard;
