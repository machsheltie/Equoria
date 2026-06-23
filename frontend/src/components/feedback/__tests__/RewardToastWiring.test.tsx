/**
 * RewardToast event-wiring tests (Equoria-55bo.1, Spec 11.3.10)
 *
 * Equoria-vcar wired the RewardToastProvider + queue and the XP/level-up
 * trigger (XpProgressBar). 55bo.1 extends the trigger surface to the
 * remaining meaningful-progress event sources the spec lists:
 *
 *   (a) trait discovery   — FoalDevelopmentTracker (useRevealFoalTraits success)
 *   (b) competition win   — PrizeNotificationModal (real placement result)
 *
 * Boundary conversion (Equoria-fefh2.12): the trait-discovery block no longer
 * `vi.mock('@/hooks/api/useBreeding')`. It renders the REAL
 * FoalDevelopmentTracker against the REAL useBreeding hooks (real React Query +
 * real api-client) with the network boundary stubbed by MSW. The trait toast
 * is driven by the REAL useRevealFoalTraits mutation: the test clicks the
 * "Reveal Traits" button, MSW returns the real reveal-traits envelope, and the
 * mutation's `isSuccess` edge fires the toast via the component's own effect —
 * exercising the real success path end-to-end, not a hand-set `isSuccess: true`.
 *
 * Real wire shapes (verified against backend/modules/breeding):
 *   GET  /api/v1/foals/:id              → { success, data: Foal }
 *   GET  /api/v1/foals/:id/development  → { success, data: { development: {...} } | null }
 *   GET  /api/v1/foals/:id/activities   → { success, data: FoalActivity[] }
 *   POST /api/v1/foals/:id/reveal-traits→ { success, data: { traits, revealed, hidden } }
 *     (foalController.revealFoalTraitsHandler)
 *
 * The competition-win block uses PrizeNotificationModal with pure props — it
 * touches NO data hook, so there was never a useBreeding mock to remove there.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/test/msw/server';
import { RewardToastProvider } from '../RewardToastProvider';
import FoalDevelopmentTracker from '@/components/breeding/FoalDevelopmentTracker';
import PrizeNotificationModal from '@/components/competition/PrizeNotificationModal';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const FOAL_ID = 1;

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

/**
 * Stub the foal read-boundary the FoalDevelopmentTracker container hits on
 * mount (foal, development, activities), mirroring the real envelopes. A
 * weanling-aged foal with two already-discovered traits.
 */
function stubFoalReads(traits: string[] = ['fast', 'bold']) {
  const weanlingDob = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  server.use(
    http.get(`${base}/api/v1/foals/${FOAL_ID}`, () =>
      HttpResponse.json({
        success: true,
        data: { id: FOAL_ID, name: 'Little Star', dateOfBirth: weanlingDob, traits },
      })
    ),
    http.get(`${base}/api/v1/foals/${FOAL_ID}/development`, () =>
      HttpResponse.json({
        success: true,
        data: {
          development: {
            currentDay: 2,
            maxDay: 6,
            bondingLevel: 50,
            stressLevel: 10,
            completedActivities: {},
          },
        },
      })
    ),
    http.get(`${base}/api/v1/foals/${FOAL_ID}/activities`, () =>
      HttpResponse.json({ success: true, data: [] })
    )
  );
}

describe('RewardToast event wiring (55bo.1)', () => {
  describe('(a) trait discovery', () => {
    beforeEach(() => {
      stubFoalReads();
    });

    it('fires a reward toast when a trait reveal succeeds', async () => {
      // The real reveal-traits POST returns the real envelope. The mutation's
      // isSuccess edge then fires the toast via the component effect.
      server.use(
        http.post(`${base}/api/v1/foals/${FOAL_ID}/reveal-traits`, () =>
          HttpResponse.json({
            success: true,
            data: { traits: ['fast', 'bold'], revealed: ['bold'], hidden: [] },
          })
        )
      );

      render(withProviders(<FoalDevelopmentTracker foalId={FOAL_ID} />));

      // Drive the REAL mutation through the real button → api-client → MSW path.
      fireEvent.click(await screen.findByRole('button', { name: /reveal traits/i }));

      await waitFor(() => {
        const status = document.body.querySelector('[role="status"]');
        expect(status).toBeInTheDocument();
        expect(status?.textContent).toMatch(/New Trait Discovered/i);
      });
    });

    it('does NOT fire a toast when no reveal has succeeded', async () => {
      render(withProviders(<FoalDevelopmentTracker foalId={FOAL_ID} />));

      // Wait for the container to settle (reads resolved) WITHOUT clicking
      // reveal — no mutation, so no isSuccess edge, so no toast.
      await screen.findByRole('button', { name: /reveal traits/i });

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
  // (pre-existing, allowed) to drive the real breed mutation.
});
