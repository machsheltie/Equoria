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

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const OnboardingGuard: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return; // Wait for auth to resolve
    if (!user) return; // Not authenticated — ProtectedRoute handles login redirect
    if (location.pathname === '/onboarding') return; // Already on onboarding

    // Only redirect when completedOnboarding is explicitly false AND tour not yet started
    // (onboardingStep >= 1 means player is mid-tour; let them navigate freely)
    if (user.completedOnboarding === false && (user.onboardingStep ?? 0) === 0) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, isLoading, location.pathname, navigate]);

  return null;
};

export default OnboardingGuard;
