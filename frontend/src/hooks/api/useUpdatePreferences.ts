/**
 * useUpdatePreferences Hook
 *
 * Persists the authenticated user's preferences (notification + display
 * toggles) via PATCH /api/auth/profile/preferences. Applies optimistic
 * updates to the ['profile'] query cache so the UI reflects the change
 * immediately; rolls back on error.
 *
 * Story 21S-5: closes the /settings persistence gap.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, type UserPreferences } from '@/lib/api-client';
import type { User } from '@/hooks/useAuth';

type Patch = Partial<UserPreferences>;

interface PreferencesMutationContext {
  /** Only the preference keys that existed before this mutation. */
  previousPreferences?: Partial<UserPreferences>;
  /** The keys this mutation sent, so onError knows which to revert. */
  updates?: Patch;
}

/**
 * Mutation hook for updating user preferences with optimistic updates.
 *
 * @example
 * const { mutate, isPending } = useUpdatePreferences();
 * mutate({ reducedMotion: true });
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation<
    { status: string; data: { preferences: UserPreferences } },
    Error,
    Patch,
    PreferencesMutationContext
  >({
    mutationFn: (updates: Patch) => authApi.updatePreferences(updates),

    onMutate: async (updates) => {
      // Cancel any in-flight profile refetch so our optimistic write isn't clobbered
      await queryClient.cancelQueries({ queryKey: ['profile'] });

      const previousProfile = queryClient.getQueryData<{ user: User }>(['profile']);
      const previousPreferences: Partial<UserPreferences> = {};
      if (previousProfile?.user?.preferences) {
        for (const key of Object.keys(updates) as Array<keyof UserPreferences>) {
          if (key in previousProfile.user.preferences) {
            previousPreferences[key] = previousProfile.user.preferences[key];
          }
        }
      }

      if (previousProfile?.user) {
        queryClient.setQueryData<{ user: User }>(['profile'], {
          ...previousProfile,
          user: {
            ...previousProfile.user,
            preferences: {
              ...(previousProfile.user.preferences ?? {}),
              ...updates,
            },
          },
        });
      }

      return { previousPreferences, updates };
    },

    onError: (_err, _updates, context) => {
      // Roll back ONLY the keys this mutation changed, so a concurrent
      // successful mutation on different keys isn't clobbered.
      // (CodeRabbit Major, 2026-04-20.)
      if (!context?.updates) return;
      const existing = queryClient.getQueryData<{ user: User }>(['profile']);
      if (!existing?.user) return;
      const rolledBack = { ...(existing.user.preferences ?? {}) } as Partial<UserPreferences>;
      for (const key of Object.keys(context.updates) as Array<keyof UserPreferences>) {
        if (context.previousPreferences && key in context.previousPreferences) {
          rolledBack[key] = context.previousPreferences[key];
        } else {
          delete rolledBack[key];
        }
      }
      queryClient.setQueryData<{ user: User }>(['profile'], {
        ...existing,
        user: { ...existing.user, preferences: rolledBack },
      });
    },

    onSuccess: (response) => {
      // Reconcile with the server's canonical merged preferences
      const existing = queryClient.getQueryData<{ user: User }>(['profile']);
      if (existing?.user) {
        queryClient.setQueryData<{ user: User }>(['profile'], {
          ...existing,
          user: {
            ...existing.user,
            preferences: response.data.preferences,
          },
        });
      }
    },

    onSettled: () => {
      // Let the server reconcile authoritatively after every mutation.
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
