/**
 * PrizeHistoryPage — Claim Wiring Test (Equoria-bx52)
 *
 * Verifies the Claim button surfaced on unclaimed rows in
 * PrizeHistoryPage invokes the useClaimPrizes mutation. Together
 * with PrizeTransactionRow.claim.test.tsx (which covers row-level
 * rendering + onClaim) this proves the end-to-end UI wiring.
 *
 * Mocks the auth context, usePrizeHistory, and useClaimPrizes
 * hooks — same pattern as the existing PrizeHistoryPage test
 * suite.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PrizeHistoryPage from '../PrizeHistoryPage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 1, username: 'tester' } })),
}));

vi.mock('@/hooks/api/usePrizeHistory', () => ({
  usePrizeHistory: vi.fn(),
  prizeHistoryQueryKeys: { all: ['prize-history'] },
}));

vi.mock('@/hooks/api/useClaimPrizes', () => ({
  useClaimPrizes: vi.fn(),
}));

const { usePrizeHistory } = await import('@/hooks/api/usePrizeHistory');
const { useClaimPrizes } = await import('@/hooks/api/useClaimPrizes');

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

describe('PrizeHistoryPage — Claim wiring (Equoria-bx52)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    vi.mocked(usePrizeHistory).mockReturnValue({
      data: [unclaimedTransaction],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useClaimPrizes).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
      data: null,
    } as any);
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/prizes']}>
          <PrizeHistoryPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders a Claim button for unclaimed rows', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /claim/i })).toBeInTheDocument();
  });

  it('invokes useClaimPrizes.mutate with the competitionId when Claim is clicked', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    vi.mocked(useClaimPrizes).mockReturnValue({
      mutate,
      isPending: false,
      error: null,
      data: null,
    } as any);

    renderPage();

    await user.click(screen.getByRole('button', { name: /claim/i }));
    expect(mutate).toHaveBeenCalledWith({ competitionId: 777 });
  });

  it('does NOT render a Claim button for already-claimed rows', () => {
    vi.mocked(usePrizeHistory).mockReturnValue({
      data: [{ ...unclaimedTransaction, claimed: true, claimedAt: '2026-03-16T00:00:00Z' }],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderPage();
    expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
  });
});
