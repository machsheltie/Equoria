/**
 * useOnboarding hook
 *
 * Mutations for the 10-step guided onboarding tour.
 *   - useAdvanceOnboarding()   → mutation() — increments onboardingStep, completes at step 10
 *   - useCompleteOnboarding()  → mutation() — immediately marks onboarding done (skip)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api-client';

/** Advance to the next onboarding step. Sets completedOnboarding: true at step 10. */
export function useAdvanceOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.advanceOnboarding(),
    onSuccess: () => {
      // Refresh profile so OnboardingSpotlight re-reads onboardingStep / completedOnboarding
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

/** Immediately mark onboarding as complete (used for "Skip tutorial" action). */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.completeOnboarding(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
