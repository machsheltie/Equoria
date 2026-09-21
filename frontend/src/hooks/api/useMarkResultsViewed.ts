/**
 * useMarkResultsViewed hook (Equoria-oey96.28)
 *
 * Tells the server that the player has now seen the results for a set of
 * shows, clearing the Hub's `check-results` next-action.
 *
 * WHY A MUTATION AND NOT A MARK-ON-FETCH SIDE EFFECT. Reading a list is a GET;
 * declaring results seen is a write with its own CSRF, rate-limit and audit
 * surface, and it has to be able to fail without taking the list down with it.
 * Keeping them separate also means a future "mark this one read" control has a
 * route to call.
 *
 * Ownership is enforced server-side (the update is scoped through the horse
 * relation), so the caller sends show ids only — never a userId.
 *
 * On success the next-actions query is invalidated so the Hub drops the
 * check-results card on the player's next visit rather than showing a nudge for
 * something they just read.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markCompetitionResultsViewed } from '@/lib/api/competitionResults';
import { nextActionsKeys } from '@/hooks/api/useNextActions';

export function useMarkResultsViewed() {
  const queryClient = useQueryClient();

  return useMutation<number, Error, number[]>({
    mutationFn: (showIds: number[]) => markCompetitionResultsViewed(showIds),
    onSuccess: (markedCount) => {
      // Nothing changed server-side when the player had already read everything,
      // so do not churn the Hub's cache for a no-op.
      if (markedCount > 0) {
        queryClient.invalidateQueries({ queryKey: nextActionsKeys.all });
      }
    },
  });
}
