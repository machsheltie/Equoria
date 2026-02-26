/**
 * OnboardingGuard
 *
 * Redirects newly registered players to the /onboarding wizard when
 * their User.completedOnboarding flag is explicitly `false`.
 *
 * Rules:
 *   - Only redirects if user.completedOnboarding === false (explicit false)
 *   - Legacy accounts with undefined completedOnboarding are NOT redirected
 *   - Already on /onboarding → no redirect (avoids infinite loop)
 *   - Auth still loading → no redirect (wait for profile)
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

    // Only redirect when completedOnboarding is explicitly false
    if (user.completedOnboarding === false) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, isLoading, location.pathname, navigate]);

  return null;
};

export default OnboardingGuard;
