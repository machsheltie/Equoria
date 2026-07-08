/**
 * BankPage — transaction-history four-state tests (Equoria-4hra5)
 *
 * Regression guard for the "swallow-fetch-error-as-false-empty" defect: on a
 * FAILED transaction fetch the ledger used to render the EMPTY state ("No
 * transactions yet") — a lie on a financial surface — because `isError` was
 * unhandled and `undefined?.transactions.length ?? 0 === 0` collapsed to the
 * empty branch. Per FRONTEND_ASYNC_STATE_DOCTRINE §1 the four canonical states
 * are LOADING → ERROR (visible + retry) → EMPTY (only via success) → SUCCESS.
 *
 * Boundary-level test (like PrizeHistoryPage.test.tsx / Equoria-fefh2.12): the
 * page renders against the REAL `useTransactionHistory` hook (real React Query +
 * real `bankApi.getTransactions` over the real `apiClient`) with only the HTTP
 * transport boundary stubbed by MSW (`server.use(...)`). This is NOT a
 * `vi.mock('@/hooks/api/useTransactionHistory')` — the real query-key gating,
 * the `{ success, data }` envelope unwrap, and the loading/error/empty/success
 * transitions are all exercised end-to-end. Auth comes from the REAL AuthContext
 * via `MockAuthProvider`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import BankPage from '../BankPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TRANSACTIONS_PATH = `${base}/api/v1/users/transactions`;
const CLAIM_STATUS_PATH = `${base}/api/v1/bank/claim-status`;
const USER_ID = 42;

/** Real backend wire shape for a transaction row (see bank.ts TransactionHistoryItem). */
const sampleTransactions = [
  {
    id: 1,
    type: 'credit' as const,
    amount: 5000,
    category: 'weekly_reward',
    description: 'Weekly reward',
    balanceAfter: 15000,
    metadata: {},
    timestamp: '2026-07-01T10:00:00Z',
  },
  {
    id: 2,
    type: 'debit' as const,
    amount: 200,
    category: 'feed',
    description: 'Feed purchase',
    balanceAfter: 14800,
    metadata: {},
    timestamp: '2026-07-02T10:00:00Z',
  },
];

/** The api-client unwraps `{ success, data }` to the inner TransactionHistoryResponse. */
function transactionsEnvelope(rows: typeof sampleTransactions | []) {
  return {
    success: true,
    data: { transactions: rows, total: rows.length, page: 1, pageSize: 20 },
  };
}

/**
 * BankPage's mount effect calls bankApi.getClaimStatus(). MSW runs with
 * onUnhandledRequest:'error', so the claim-status boundary must be stubbed in
 * every test even though it is not the subject under test.
 */
function stubClaimStatus() {
  server.use(
    http.get(CLAIM_STATUS_PATH, () =>
      HttpResponse.json({
        success: true,
        data: { canClaim: true, nextClaimDate: null, rewardAmount: 5000 },
      })
    )
  );
}

describe('BankPage — transaction history four-state (Equoria-4hra5)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    stubClaimStatus();
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: USER_ID, username: 'BankTester', money: 15000 }}>
          <MemoryRouter initialEntries={['/bank']}>
            <BankPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  // LOADING — the fetch is pending.
  it('renders the loading state while the transaction fetch is pending', async () => {
    server.use(
      http.get(TRANSACTIONS_PATH, async () => {
        await delay(150);
        return HttpResponse.json(transactionsEnvelope([]));
      })
    );

    renderPage();

    expect(
      await screen.findByRole('status', { name: /loading transactions/i })
    ).toBeInTheDocument();
    // While loading, the empty lie must not appear.
    expect(screen.queryByText('No transactions yet')).not.toBeInTheDocument();
  });

  // ERROR — the single most important assertion: a failed fetch renders an
  // error+retry, NEVER the false "No transactions yet" empty state.
  it('renders an error state with retry (not a false empty) when the fetch fails', async () => {
    server.use(
      http.get(TRANSACTIONS_PATH, () =>
        HttpResponse.json({ status: 'error', message: 'internal boom detail' }, { status: 500 })
      )
    );

    renderPage();

    // Visible error alert with a retry affordance.
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();

    // The empty lie must NOT be rendered on a failed fetch.
    expect(screen.queryByText('No transactions yet')).not.toBeInTheDocument();
    expect(screen.queryByTestId('empty-state-first-use')).not.toBeInTheDocument();

    // Raw server error text must never leak into the UI (doctrine §3).
    expect(screen.queryByText(/internal boom detail/i)).not.toBeInTheDocument();
  });

  // EMPTY — reachable ONLY through a successful, genuinely-empty fetch.
  it('renders the honest empty state on a successful but empty fetch', async () => {
    server.use(http.get(TRANSACTIONS_PATH, () => HttpResponse.json(transactionsEnvelope([]))));

    renderPage();

    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
    // Success-empty must not render an error.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // SUCCESS — real rows render.
  it('renders transaction rows on a successful fetch with data', async () => {
    server.use(
      http.get(TRANSACTIONS_PATH, () => HttpResponse.json(transactionsEnvelope(sampleTransactions)))
    );

    renderPage();

    expect(await screen.findByText('Weekly reward')).toBeInTheDocument();
    expect(screen.getByText('Feed purchase')).toBeInTheDocument();
    expect(screen.queryByText('No transactions yet')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // RETRY WIRING — the retry affordance must call refetch (not be a dead
  // button / a page reload). First fetch fails; clicking Try Again re-fetches
  // and the second (successful) response renders rows.
  it('retry re-fetches and renders rows (refetch is wired to the error retry)', async () => {
    let calls = 0;
    server.use(
      http.get(TRANSACTIONS_PATH, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ status: 'error', message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json(transactionsEnvelope(sampleTransactions));
      })
    );

    const user = userEvent.setup();
    renderPage();

    const retryBtn = await screen.findByRole('button', { name: /try again/i });
    await user.click(retryBtn);

    expect(await screen.findByText('Weekly reward')).toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('No transactions yet')).not.toBeInTheDocument();
  });
});
