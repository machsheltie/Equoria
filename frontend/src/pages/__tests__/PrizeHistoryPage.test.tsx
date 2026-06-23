/**
 * PrizeHistoryPage Component Tests
 *
 * Story 5-3: Competition History Display - Task 6: Prize History Page
 *
 * Boundary-level tests (Equoria-fefh2.12): the page renders against the REAL
 * `usePrizeHistory` hook (real React Query + real `fetchPrizeHistory` over
 * `apiClient`) with the network boundary stubbed by MSW (`server.use(...)`) —
 * NOT a `vi.mock('@/hooks/api/usePrizeHistory')`. Auth state comes from the
 * REAL `AuthContext` via `MockAuthProvider` (a real provider, not a module
 * mock), and the page renders the REAL `PrizeTransactionHistory` /
 * `PrizeTransactionRow` children rather than a stubbed double. This exercises
 * the real query-key construction, the `enabled` gating on userId, the
 * `{ success, data }` envelope unwrap performed by the api-client transport,
 * the URL→filter→re-query loop, and the loading/error transitions end-to-end.
 *
 * Tests cover:
 * - Component rendering (header, breadcrumbs, stat cards)
 * - Summary statistics display (total prize money, XP, competitions, win rate)
 * - Navigation and routing (breadcrumb links, URL params)
 * - Filter integration with URL params (real Select drives the boundary query)
 * - PrizeTransactionHistory integration (real component, real rows)
 * - Loading and error states
 * - Edge cases (empty data, API errors)
 * - Accessibility compliance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter, Routes, Route, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import PrizeHistoryPage from '../PrizeHistoryPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// The MockAuthProvider injects this user; userId '123' drives the
// /users/123/prize-history boundary request the page issues.
const USER_ID = 123;
const PRIZE_HISTORY_PATH = `${base}/api/v1/users/${USER_ID}/prize-history`;

/**
 * Canonical prize-history rows — the REAL backend wire shape (Equoria-i3l23).
 * The route serializes raw `CompetitionResult` rows, so each row uses
 * `competitionResultId` (not transactionId/competitionId), a STRING
 * `placement` ("1st"/"2nd"), `runDate` (not date), and has NO xpGained/claimed/
 * claimedAt columns. The api-client unwraps the outer `{ success, data }`
 * envelope to the inner OBJECT `{ prizeHistory, pagination }`, and
 * `fetchPrizeHistory` maps `.prizeHistory` rows into the UI `PrizeTransaction`
 * shape (see frontend/src/lib/api/prizes.ts).
 *
 * Totals after mapping: prize 7000, xp 0 (no XP in the data model), 4 comps,
 * placements 1/2/3/1 → 2 firsts → 50% win rate.
 */
const mockRows = [
  {
    competitionResultId: 1,
    competitionName: 'Spring Dressage Championship',
    horseId: 1,
    horseName: 'Thunder',
    discipline: 'dressage',
    placement: '1st',
    prizeMoney: 2500,
    runDate: '2026-03-15T10:00:00Z',
  },
  {
    competitionResultId: 2,
    competitionName: 'Winter Jumping Series',
    horseId: 2,
    horseName: 'Storm',
    discipline: 'jumping',
    placement: '2nd',
    prizeMoney: 1500,
    runDate: '2026-02-10T14:00:00Z',
  },
  {
    competitionResultId: 3,
    competitionName: 'Regional Eventing Finals',
    horseId: 1,
    horseName: 'Thunder',
    discipline: 'eventing',
    placement: '3rd',
    prizeMoney: 1000,
    runDate: '2026-01-25T09:00:00Z',
  },
  {
    competitionResultId: 4,
    competitionName: 'Holiday Dressage Cup',
    horseId: 1,
    horseName: 'Thunder',
    discipline: 'dressage',
    placement: '1st',
    prizeMoney: 2000,
    runDate: '2025-12-20T10:00:00Z',
  },
];

/**
 * Stub the prize-history boundary with the REAL backend envelope:
 * `{ success, data: { prizeHistory, pagination } }`. The api-client unwraps
 * `.data` to the object, and `fetchPrizeHistory` maps `.prizeHistory`. Honors
 * the same dateRange/horseId/discipline filtering the real route applies, so
 * the URL→filter→re-query loop is exercised against real query params.
 */
/**
 * Build the real backend prize-history envelope from a set of rows. Used by the
 * inline `server.use` overrides so every stub emits the same real wire shape
 * (`{ success, data: { prizeHistory, pagination } }`) the route really returns.
 */
function prizeHistoryEnvelope(rows = mockRows) {
  return {
    success: true,
    data: {
      prizeHistory: rows,
      pagination: { total: rows.length, limit: 20, offset: 0, hasMore: false },
    },
  };
}

function stubPrizeHistory(rows = mockRows) {
  server.use(
    http.get(PRIZE_HISTORY_PATH, ({ request }) => {
      const url = new URL(request.url);
      const dateRange = url.searchParams.get('dateRange');
      const horseId = url.searchParams.get('horseId');
      const discipline = url.searchParams.get('discipline');

      let filtered = [...rows];
      if (horseId) {
        filtered = filtered.filter((t) => t.horseId === Number(horseId));
      }
      if (discipline) {
        filtered = filtered.filter((t) => t.discipline === discipline);
      }
      if (dateRange && dateRange !== 'all') {
        const now = new Date('2026-03-20');
        const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90;
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        filtered = filtered.filter((t) => new Date(t.runDate) >= cutoff);
      }

      return HttpResponse.json({
        success: true,
        data: {
          prizeHistory: filtered,
          pagination: { total: filtered.length, limit: 20, offset: 0, hasMore: false },
        },
      });
    })
  );
}

describe('PrizeHistoryPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    stubPrizeHistory();
  });

  const renderPage = (route = '/prizes') =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: USER_ID, username: 'TestUser' }}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/prizes" element={<PrizeHistoryPage />} />
              <Route path="/profile/prizes" element={<PrizeHistoryPage />} />
            </Routes>
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  // =========================================
  // 1. Rendering Tests (6 tests)
  // =========================================
  describe('Rendering Tests', () => {
    it('renders page title correctly', () => {
      renderPage();

      expect(screen.getByRole('heading', { name: /prize history/i, level: 1 })).toBeInTheDocument();
    });

    it('displays breadcrumb navigation', () => {
      renderPage();

      const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(nav).toBeInTheDocument();
      expect(within(nav).getByText(/home/i)).toBeInTheDocument();
      expect(within(nav).getByText(/profile/i)).toBeInTheDocument();
      expect(within(nav).getByText(/prize history/i)).toBeInTheDocument();
    });

    it('shows 4 summary stat cards', async () => {
      renderPage();

      // Stats render once the boundary resolves (loading shows skeletons first).
      expect(await screen.findByTestId('stat-total-prize-money')).toBeInTheDocument();
      expect(screen.getByTestId('stat-total-xp')).toBeInTheDocument();
      expect(screen.getByTestId('stat-total-competitions')).toBeInTheDocument();
      expect(screen.getByTestId('stat-win-rate')).toBeInTheDocument();
    });

    it('renders PrizeTransactionHistory component', async () => {
      renderPage();

      expect(await screen.findByTestId('prize-transaction-history')).toBeInTheDocument();
    });

    it('loading state shows skeleton cards', async () => {
      // Delay the boundary so the loading state is observable.
      server.use(
        http.get(PRIZE_HISTORY_PATH, async () => {
          await delay(100);
          return HttpResponse.json(prizeHistoryEnvelope());
        })
      );

      renderPage();

      const skeletons = await screen.findAllByTestId('stat-card-skeleton');
      expect(skeletons.length).toBe(4);
    });

    it('error state shows error message', async () => {
      server.use(
        http.get(PRIZE_HISTORY_PATH, () =>
          HttpResponse.json(
            { status: 'error', message: 'Failed to load prize history' },
            { status: 500 }
          )
        )
      );

      renderPage();

      expect(await screen.findByTestId('stats-error')).toBeInTheDocument();
      expect(screen.getByText(/failed to load prize history/i)).toBeInTheDocument();
    });
  });

  // =========================================
  // 2. Summary Statistics Tests (4 tests)
  // =========================================
  describe('Summary Statistics Tests', () => {
    it('total prize money displays correctly with formatting', async () => {
      renderPage();

      const prizeCard = await screen.findByTestId('stat-total-prize-money');
      // Total: 2500 + 1500 + 1000 + 2000 = 7000 — rendered by the canonical
      // Currency component (coin icon + grouped digits; game currency is
      // coins, not USD — DECISIONS.md §9).
      expect(within(prizeCard).getByText('7,000')).toBeInTheDocument();
      expect(within(prizeCard).getByLabelText('7,000 coins')).toBeInTheDocument();
    });

    it('total XP displays correctly', async () => {
      renderPage();

      const xpCard = await screen.findByTestId('stat-total-xp');
      // The CompetitionResult data model has NO XP column (Equoria-i3l23), so
      // the backend omits xpGained and the mapper defaults it to 0. Total XP
      // across the four real rows is therefore 0 — an honest reflection of the
      // data model, not a fabricated number.
      expect(within(xpCard).getByText('0')).toBeInTheDocument();
    });

    it('total competitions count is correct', async () => {
      renderPage();

      const compCard = await screen.findByTestId('stat-total-competitions');
      // Total: 4 transactions
      expect(within(compCard).getByText('4')).toBeInTheDocument();
    });

    it('win rate calculates and displays as percentage', async () => {
      renderPage();

      const winRateCard = await screen.findByTestId('stat-win-rate');
      // First places: 2 out of 4 = 50%
      expect(within(winRateCard).getByText(/50\.0%/)).toBeInTheDocument();
    });
  });

  // =========================================
  // 3. Navigation Tests (3 tests)
  // =========================================
  describe('Navigation Tests', () => {
    it('breadcrumb links navigate correctly', () => {
      renderPage();

      const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
      const homeLink = within(nav).getByRole('link', { name: /home/i });
      const profileLink = within(nav).getByRole('link', { name: /profile/i });

      expect(homeLink).toHaveAttribute('href', '/');
      expect(profileLink).toHaveAttribute('href', '/profile');
    });

    it('route is accessible from URL', () => {
      renderPage('/prizes');

      expect(screen.getByRole('heading', { name: /prize history/i, level: 1 })).toBeInTheDocument();
    });

    it('back navigation works via breadcrumb', () => {
      renderPage();

      const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
      const profileLink = within(nav).getByRole('link', { name: /profile/i });

      expect(profileLink).toBeInTheDocument();
      expect(profileLink).toHaveAttribute('href', '/profile');
    });
  });

  // =========================================
  // 4. Filter Integration Tests (3 tests)
  // =========================================
  describe('Filter Integration Tests', () => {
    it('changing the date-range filter re-queries the boundary with the filter', async () => {
      // Record every prize-history request the boundary sees, so we can assert
      // the date-range change drives a real re-query carrying the param.
      const seenDateRanges: Array<string | null> = [];
      server.use(
        http.get(PRIZE_HISTORY_PATH, ({ request }) => {
          const url = new URL(request.url);
          seenDateRanges.push(url.searchParams.get('dateRange'));
          return HttpResponse.json(prizeHistoryEnvelope());
        })
      );

      const user = userEvent.setup();
      renderPage('/prizes');

      // Wait for the real PrizeTransactionHistory (with its date-range Select).
      const dateRangeSelect = await screen.findByTestId('filter-date-range');
      await user.selectOptions(dateRangeSelect, '30days');

      // The page syncs the filter into the URL, which re-runs usePrizeHistory
      // with the new query key → a fresh boundary request carrying dateRange.
      await waitFor(() => expect(seenDateRanges).toContain('30days'));
    });

    it('URL params are parsed on load and reflected in the filter control', async () => {
      // Record the params the very first boundary request carries.
      let firstRequestUrl: URL | null = null;
      server.use(
        http.get(PRIZE_HISTORY_PATH, ({ request }) => {
          if (!firstRequestUrl) firstRequestUrl = new URL(request.url);
          return HttpResponse.json(prizeHistoryEnvelope());
        })
      );

      renderPage('/prizes?dateRange=7days&horseId=2&discipline=jumping');

      // The real date-range Select reflects the URL value.
      const dateRangeSelect = (await screen.findByTestId('filter-date-range')) as HTMLSelectElement;
      expect(dateRangeSelect.value).toBe('7days');

      // And the initial boundary request carried the URL-derived params.
      await waitFor(() => expect(firstRequestUrl).not.toBeNull());
      expect(firstRequestUrl!.searchParams.get('dateRange')).toBe('7days');
      expect(firstRequestUrl!.searchParams.get('horseId')).toBe('2');
      expect(firstRequestUrl!.searchParams.get('discipline')).toBe('jumping');
    });

    it('a URL discipline filter narrows the rendered rows to matching transactions', async () => {
      // The page forwards the URL `discipline` param to the prize-history
      // boundary; the stub filters server-side, so only matching rows render.
      // (The discipline <Select> only lists options the page passes via the
      // `disciplines` prop — which this page does not supply — so the
      // user-facing narrowing path for discipline is the URL param, exercised
      // here end-to-end through the real hook → real api-client → boundary.)
      renderPage('/prizes?discipline=jumping');

      // Only the jumping transaction comes back from the filtered boundary.
      expect(await screen.findByText('Winter Jumping Series')).toBeInTheDocument();
      expect(screen.queryByText('Spring Dressage Championship')).not.toBeInTheDocument();
      expect(screen.queryByText('Regional Eventing Finals')).not.toBeInTheDocument();
    });
  });

  // =========================================
  // 5. Integration Tests (2 tests)
  // =========================================
  describe('Integration Tests', () => {
    it('issues the prize-history request for the authenticated user id', async () => {
      let requestedPath: string | null = null;
      server.use(
        http.get(PRIZE_HISTORY_PATH, ({ request }) => {
          requestedPath = new URL(request.url).pathname;
          return HttpResponse.json(prizeHistoryEnvelope());
        })
      );

      renderPage();

      await waitFor(() => expect(requestedPath).toBe(`/api/v1/users/${USER_ID}/prize-history`));
    });

    it('carries URL filters through to the prize-history boundary request', async () => {
      let requestUrl: URL | null = null;
      server.use(
        http.get(PRIZE_HISTORY_PATH, ({ request }) => {
          requestUrl = new URL(request.url);
          return HttpResponse.json(prizeHistoryEnvelope());
        })
      );

      renderPage('/prizes?dateRange=30days');

      await waitFor(() => expect(requestUrl).not.toBeNull());
      expect(requestUrl!.searchParams.get('dateRange')).toBe('30days');
    });
  });

  // =========================================
  // 6. Edge Cases (2 tests)
  // =========================================
  describe('Edge Cases', () => {
    it('handles no transaction data gracefully', async () => {
      stubPrizeHistory([]);

      renderPage();

      // Stats should show zeros (Currency renders "0" with the coin icon).
      const prizeCard = await screen.findByTestId('stat-total-prize-money');
      expect(within(prizeCard).getByText('0')).toBeInTheDocument();
      expect(within(prizeCard).getByLabelText('0 coins')).toBeInTheDocument();

      const xpCard = screen.getByTestId('stat-total-xp');
      expect(within(xpCard).getByText('0')).toBeInTheDocument();

      const compCard = screen.getByTestId('stat-total-competitions');
      expect(within(compCard).getByText('0')).toBeInTheDocument();

      const winRateCard = screen.getByTestId('stat-win-rate');
      expect(within(winRateCard).getByText(/0\.0%/)).toBeInTheDocument();
    });

    it('handles API error with retry button', async () => {
      // First load fails; the retry button re-runs the query, which succeeds.
      let calls = 0;
      server.use(
        http.get(PRIZE_HISTORY_PATH, () => {
          calls += 1;
          if (calls === 1) {
            return HttpResponse.json(
              { status: 'error', message: 'Failed to load prize history' },
              { status: 500 }
            );
          }
          return HttpResponse.json(prizeHistoryEnvelope());
        })
      );

      const user = userEvent.setup();
      renderPage();

      // Error state should show first.
      expect(await screen.findByTestId('stats-error')).toBeInTheDocument();

      // Click retry (canonical ErrorState renders "Try Again").
      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      // Retry re-queries the boundary and the stats render.
      expect(await screen.findByTestId('stat-total-prize-money')).toBeInTheDocument();
      expect(calls).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================
  // 7. Accessibility Tests (4 tests)
  // =========================================
  describe('Accessibility', () => {
    it('has main landmark role', () => {
      renderPage();

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('page title is accessible heading', () => {
      renderPage();

      const heading = screen.getByRole('heading', { name: /prize history/i, level: 1 });
      expect(heading.tagName).toBe('H1');
    });

    it('stats section has proper ARIA label', () => {
      renderPage();

      const statsSection = screen.getByTestId('stats-summary');
      expect(statsSection).toHaveAttribute('aria-label', 'Prize statistics summary');
    });

    it('icons have aria-hidden attribute', async () => {
      renderPage();

      // Wait for the resolved (non-skeleton) stat cards before inspecting icons.
      await screen.findByTestId('stat-total-prize-money');
      const statCards = screen.getAllByTestId(/^stat-/);
      statCards.forEach((card) => {
        const icon = card.querySelector('svg');
        if (icon) {
          expect(icon).toHaveAttribute('aria-hidden', 'true');
        }
      });
    });
  });

  // =========================================
  // 8. Responsive Design (2 tests)
  // =========================================
  describe('Responsive Design', () => {
    it('constrains content via PageContainer (no page-local gutters)', () => {
      renderPage();

      // DECISIONS.md §1: the page must not own horizontal gutters (px-*) —
      // those belong to the DashboardLayout shell. Content measure comes from
      // the wide PageContainer variant.
      const main = screen.getByRole('main');
      expect(main.className).toContain('max-w-6xl');
      expect(main.className).toContain('mx-auto');
      expect(main.className).not.toMatch(/(^|\s)px-/);
    });

    it('stats grid is responsive', () => {
      renderPage();

      const statsGrid = screen.getByTestId('stats-grid');
      expect(statsGrid).toHaveClass('grid-cols-2');
      expect(statsGrid).toHaveClass('md:grid-cols-4');
    });
  });
});
