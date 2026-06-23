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

const unclaimedTransaction = {
  transactionId: 'txn-unclaimed-001',
  date: '2026-03-15T10:00:00Z',
  competitionId: 777,
  competitionName: 'TestFixture-Spring Cup',
  horseId: 1,
  horseName: 'TestFixture-Thunder',
  discipline: 'dressage',
  placement: 1,
  prizeMoney: 2500,
  xpGained: 150,
  claimed: false,
};

/**
 * Stub the prize-history boundary with the canonical `{ success, data }`
 * envelope (the api-client unwraps `.data` to the array the hook consumes).
 */
function stubPrizeHistory(transactions: Array<Record<string, unknown>>) {
  server.use(
    http.get(PRIZE_HISTORY_PATH, () => HttpResponse.json({ success: true, data: transactions }))
  );
}

describe('PrizeHistoryPage — Claim wiring (Equoria-bx52)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    stubPrizeHistory([unclaimedTransaction]);
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
        return HttpResponse.json({
          success: true,
          data: {
            success: true,
            prizesClaimed: [
              {
                horseId: 1,
                horseName: 'TestFixture-Thunder',
                competitionId: claimedCompetitionId,
                competitionName: 'TestFixture-Spring Cup',
                discipline: 'dressage',
                date: '2026-03-15T10:00:00Z',
                placement: 1,
                totalParticipants: 12,
                prizeMoney: 2500,
                xpGained: 150,
                claimed: true,
                claimedAt: new Date().toISOString(),
              },
            ],
            newBalance: 10500,
            message: 'Successfully claimed 1 prize totaling $2500',
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
    stubPrizeHistory([
      { ...unclaimedTransaction, claimed: true, claimedAt: '2026-03-16T00:00:00Z' },
    ]);

    renderPage();

    // The row renders (its competition name appears) but no Claim button is offered.
    await screen.findByText('TestFixture-Spring Cup');
    expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
  });
});
