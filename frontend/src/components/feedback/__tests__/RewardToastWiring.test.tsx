/**
 * RewardToast event-wiring tests (Equoria-55bo.1, Spec 11.3.10)
 *
 * Equoria-vcar wired the RewardToastProvider + queue and the XP/level-up
 * trigger (XpProgressBar). 55bo.1 extends the trigger surface to the three
 * remaining meaningful-progress event sources the spec lists:
 *
 *   (a) trait discovery   — FoalDevelopmentTracker (useRevealFoalTraits success)
 *   (b) competition win   — PrizeNotificationModal (real placement result)
 *   (c) breeding milestone — BreedingPairSelection onSuccess (real breed result)
 *
 * Each test renders the real component inside a real RewardToastProvider
 * (no provider mock) and asserts a role=status toast surfaces. Hooks are
 * mocked (NOT api-client) to drive the real success state — same pattern as
 * the existing FoalDevelopmentTracker suite.
 */

import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RewardToastProvider } from '../RewardToastProvider';
import FoalDevelopmentTracker from '@/components/breeding/FoalDevelopmentTracker';
import PrizeNotificationModal from '@/components/competition/PrizeNotificationModal';
import * as useBreedingHooks from '@/hooks/api/useBreeding';

vi.mock('@/hooks/api/useBreeding');

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
  describe('(a) trait discovery', () => {
    beforeEach(() => {
      const weanlingDob = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      vi.mocked(useBreedingHooks.useFoal).mockReturnValue({
        data: { id: 1, name: 'Little Star', dateOfBirth: weanlingDob, traits: ['fast', 'bold'] },
        isLoading: false,
      } as any);
      vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
        data: { bonding: 50 },
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useBreedingHooks.useFoalActivities).mockReturnValue({ data: [] } as any);
      vi.mocked(useBreedingHooks.useLogFoalActivity).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      } as any);
      vi.mocked(useBreedingHooks.useEnrichFoal).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      } as any);
      vi.mocked(useBreedingHooks.useDevelopFoal).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      } as any);
      vi.mocked(useBreedingHooks.useGraduateFoal).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isSuccess: false,
        data: null,
      } as any);
    });

    it('fires a reward toast when a trait reveal succeeds', () => {
      vi.mocked(useBreedingHooks.useRevealFoalTraits).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isSuccess: true,
        data: { traits: ['bold'] },
      } as any);

      render(withProviders(<FoalDevelopmentTracker foalId={1} />));

      const status = document.body.querySelector('[role="status"]');
      expect(status).toBeInTheDocument();
      expect(status?.textContent).toMatch(/New Trait Discovered/i);
    });

    it('does NOT fire a toast when no reveal has succeeded', () => {
      vi.mocked(useBreedingHooks.useRevealFoalTraits).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isSuccess: false,
        data: null,
      } as any);

      render(withProviders(<FoalDevelopmentTracker foalId={1} />));

      const status = document.body.querySelector('[role="status"]');
      expect(status).not.toBeInTheDocument();
    });
  });

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
  // (pre-existing, allowed) to drive the real breed mutation; adding a new
  // api-client mock here would violate the no-new-vi.mock-of-api-client rule.
});
