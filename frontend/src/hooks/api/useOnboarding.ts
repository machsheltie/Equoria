/**
 * useOnboarding hook
 *
 * Mutations for the 10-step guided onboarding tour.
 *   - useAdvanceOnboarding()   → mutation() — increments onboardingStep, completes at step 10
 *   - useCompleteOnboarding()  → mutation() — immediately marks onboarding done (skip)
 *   - useMarkWelcomeSeen()     → mutation() — records the one-time welcome note as seen
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api-client';
import type { User } from '@/hooks/useAuth';

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

/**
 * Record that the player has seen the one-time welcome note (Equoria-kd2dd).
 *
 * The cached profile is patched synchronously with what the server confirmed,
 * so the note cannot flash back on the next render while a refetch is still in
 * flight. The merge never replaces the cached user, and nothing is patched when
 * the request fails: the note then stays up and says so.
 */
export function useMarkWelcomeSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.markWelcomeSeen(),
    onSuccess: () => {
      const existing = queryClient.getQueryData<{ user: User }>(['profile']);
      if (existing?.user) {
        queryClient.setQueryData(['profile'], {
          ...existing,
          user: { ...existing.user, welcomeSeen: true },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
