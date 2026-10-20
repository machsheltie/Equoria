/**
 * RewardToast event-wiring tests (Equoria-55bo.1, Spec 11.3.10)
 *
 * Equoria-vcar wired the RewardToastProvider + queue and the XP/level-up
 * trigger (XpProgressBar). 55bo.1 extended the trigger surface to the
 * remaining meaningful-progress event sources the spec lists:
 *
 *   (b) competition win   — PrizeNotificationModal (real placement result)
 *
 * The former (a) trait-discovery cases drove the FoalDevelopmentTracker
 * "Reveal Traits" button (POST /api/v1/foals/:id/reveal-traits). That button,
 * its route and the toast it fired were removed by Equoria-gu8jk (owner ruling
 * 2026-10-20: players never reveal traits), so the cases went with them.
 *
 * The competition-win block uses PrizeNotificationModal with pure props — it
 * touches NO data hook.
 */

import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { RewardToastProvider } from '../RewardToastProvider';
import PrizeNotificationModal from '@/components/competition/PrizeNotificationModal';

function withProviders(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <RewardToastProvider>{ui}</RewardToastProvider>
    </QueryClientProvider>
  );
}

describe('RewardToast event wiring (55bo.1)', () => {
  describe('(b) competition win', () => {
    it('fires a reward toast when the prize modal opens with a podium result', () => {
      render(
        withProviders(
          <PrizeNotificationModal
            isOpen
            onClose={() => {}}
            autoDismiss={false}
            prizeData={{
              horseName: 'Comet',
              competitionName: 'Dressage Classic',
              discipline: 'Dressage',
              date: '2026-05-18',
              placement: 1,
              prizeMoney: 500,
              xpGained: 20,
            }}
          />
        )
      );

      const status = document.body.querySelector('[role="status"]');
      expect(status).toBeInTheDocument();
      expect(status?.textContent).toMatch(/Dressage Classic/i);
    });
  });

  // (c) breeding milestone is covered end-to-end (real component + real
  // onSuccess path through RewardToastProvider) in
  // pages/breeding/__tests__/BreedingPairSelection.story-6-1.test.tsx
  // ("should call breeding API when confirmed" — asserts role=status toast).
  // It is not duplicated here because that suite already mocks api-client
  // (pre-existing, allowed) to drive the real breed mutation.
});
