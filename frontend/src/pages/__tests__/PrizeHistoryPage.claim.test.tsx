/**
 * PrizeHistoryPage — Claim Wiring Test (Equoria-bx52)
 *
 * Boundary-level (Equoria-fefh2.12): the page renders against the REAL
 * `usePrizeHistory` + `useClaimPrizes` hooks (real React Query + real
 * `apiClient`) with the network boundary stubbed by MSW (`server.use(...)`) —
 * NOT `vi.mock('@/hooks/api/usePrizeHistory')` / `vi.mock('@/hooks/api/useClaimPrizes')`.
 * Auth comes from the REAL `AuthContext` via `MockAuthProvider`, and the page
 * renders the REAL `PrizeTransactionHistory` / `PrizeTransactionRow` children.
 *
 * This proves the end-to-end UI wiring: the Claim button surfaced on an
 * unclaimed row drives the claim mutation, and the mutation reaches the
 * wire as a real POST to /api/v1/competition/:id/claim-prizes carrying the
 * row's competitionId — observed via a recording `server.use(http.post(...))`
 * (mirroring the ClubsPage join conversion), not a spy on the hook.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import PrizeHistoryPage from '../PrizeHistoryPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const USER_ID = 1;
const PRIZE_HISTORY_PATH = `${base}/api/v1/users/${USER_ID}/prize-history`;
const CLAIM_PATH = `${base}/api/v1/competition/:competitionId/claim-prizes`;

/**
 * REAL backend prize-history row shape (Equoria-i3l23): `competitionResultId`
 * (the claim endpoint keys off this id), STRING `placement`, `runDate`. The
 * data model has no claim-state column, so the real backend never sends
 * `claimed` — but the mapper tolerates it when present and defaults it to
 * `true` (settled) when absent. This claim-wiring test explicitly sets
 * `claimed: false` to exercise the unclaimed-row → Claim-button path; the
 * mapper passes the explicit flag through, keeping the wiring assertion real.
 */
const unclaimedRow = {
  competitionResultId: 777,
  competitionName: 'TestFixture-Spring Cup',
  horseId: 1,
  horseName: 'TestFixture-Thunder',
  discipline: 'dressage',
  placement: '1st',
  prizeMoney: 2500,
  runDate: '2026-03-15T10:00:00Z',
  claimed: false,
};

/**
 * Stub the prize-history boundary with the REAL backend envelope:
 * `{ success, data: { prizeHistory, pagination } }`. The api-client unwraps
 * `.data` to the object, and `fetchPrizeHistory` maps `.prizeHistory`.
 */
function stubPrizeHistory(rows: Array<Record<string, unknown>>) {
  server.use(
    http.get(PRIZE_HISTORY_PATH, () =>
      HttpResponse.json({
        success: true,
        data: {
          prizeHistory: rows,
          pagination: { total: rows.length, limit: 20, offset: 0, hasMore: false },
        },
      })
    )
  );
}

describe('PrizeHistoryPage — Claim wiring (Equoria-bx52)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    stubPrizeHistory([unclaimedRow]);
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: USER_ID, username: 'tester' }}>
          <MemoryRouter initialEntries={['/prizes']}>
            <PrizeHistoryPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  it('renders a Claim button for unclaimed rows', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: /claim/i })).toBeInTheDocument();
  });

  it('sends a claim POST to the boundary with the competitionId when Claim is clicked', async () => {
    // Record the claim request so we observe the mutation reaching the wire,
    // rather than spying on the hook.
    let claimedCompetitionId: number | null = null;
    server.use(
      http.post(CLAIM_PATH, ({ params }) => {
        claimedCompetitionId = Number(params.competitionId);
        // REAL backend claim response (Equoria-i3l23): a single settled
        // CompetitionResult row under `data` — `competitionResultId`, STRING
        // `placement`, `runDate`; no prizesClaimed[]/newBalance. useClaimPrizes
        // does not read the body (it relies on cache invalidation), so the
        // honest real shape is what belongs on the wire.
        return HttpResponse.json({
          success: true,
          message: 'Prizes claimed successfully',
          data: {
            competitionResultId: claimedCompetitionId,
            competitionName: 'TestFixture-Spring Cup',
            horseName: 'TestFixture-Thunder',
            horseId: 1,
            placement: '1st',
            prizeMoney: 2500,
            discipline: 'dressage',
            runDate: '2026-03-15T10:00:00Z',
          },
        });
      })
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /claim/i }));

    await waitFor(() => expect(claimedCompetitionId).toBe(777));
  });

  it('does NOT render a Claim button for already-claimed rows', async () => {
    stubPrizeHistory([{ ...unclaimedRow, claimed: true, claimedAt: '2026-03-16T00:00:00Z' }]);

    renderPage();

    // The row renders (its competition name appears) but no Claim button is offered.
    await screen.findByText('TestFixture-Spring Cup');
    expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
  });
});
