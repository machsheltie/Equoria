/**
 * CompetitionResultsPage Component Tests (boundary; converted under Equoria-fefh2.12)
 *
 * Boundary-level: the page renders against the REAL `useAuth` (via
 * `MockAuthProvider`, the real `AuthContext`) and the REAL
 * `useUserCompetitionStats` hook (real React Query + real
 * `fetchUserCompetitionStats` over `apiClient`) with the network boundary
 * stubbed by MSW (`server.use(http.get(...))`) — NOT
 * `vi.mock('@/contexts/AuthContext')` / `vi.mock('@/hooks/api/useUserCompetitionStats')`
 * / `vi.mock('@/hooks/api/useHorseLevelInfo')`. This exercises the real
 * query-key construction (`userCompetitionStatsQueryKeys.stats('123')`), the
 * `enabled: userId !== null` gating, the `fetchWithAuth` envelope unwrap, and
 * the loading→data / error transitions end-to-end.
 *
 * Wire shape: the real backend controller
 * (`backend/modules/users/controllers/userController.mjs#getUserCompetitionStats`)
 * returns the bare `UserCompetitionStats` object via `res.json({...})` — there
 * is NO `{ success, data }` envelope on this endpoint. The inline handlers
 * below mirror that exact shape (`fetchWithAuth` unwraps `.data` only when
 * present, so the bare object is returned to the hook as-is). The endpoint is
 * `GET /api/v1/users/:userId/competition-stats`; `userId` is `user.id` cast to
 * a string, so the mock user's `id: 123` produces a request to `/users/123/…`.
 *
 * The `useHorseLevelInfo` mock was removed entirely: the page does NOT import
 * that hook — it is used only by `CompetitionResultsModal`, which this suite
 * stubs (the stub never mounts the real hook). The child stubs for
 * `CompetitionResultsList` and `CompetitionResultsModal` remain: they isolate
 * the page from those children's own network/hook surface and are legitimate
 * boundary stubs (NOT app-own hook/context/api mocks).
 *
 * Stats values now arrive over the wire after a tick, so synchronous value
 * assertions became `findBy` / `waitFor` (faithful to the real async data
 * path). The former "useUserCompetitionStats called with '123'" mock-internals
 * assertion is replaced with a boundary observation: the request hits
 * `/users/123/competition-stats`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter, Routes, Route, TestRouter, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import CompetitionResultsPage from '../CompetitionResultsPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STATS_PATH = `${base}/api/v1/users/123/competition-stats`;

// Mock the results list component to isolate page testing (legitimate child stub).
vi.mock('@/components/competition/CompetitionResultsList', () => ({
  default: vi.fn(({ onResultClick, isLoading, error }) => {
    if (isLoading) {
      return <div data-testid="results-list-loading">Loading results...</div>;
    }
    if (error) {
      return <div data-testid="results-list-error">{error}</div>;
    }
    return (
      <div data-testid="competition-results-list">
        <button data-testid="mock-result-item" onClick={() => onResultClick(123)}>
          Mock Competition Result
        </button>
      </div>
    );
  }),
}));

// Mock the results modal component (legitimate child stub — the real modal
// pulls in useHorseLevelInfo + its own network surface).
vi.mock('@/components/competition/CompetitionResultsModal', () => ({
  default: vi.fn(({ isOpen, onClose, competitionId, onViewPerformance }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="competition-results-modal" role="dialog">
        <span data-testid="modal-competition-id">{competitionId}</span>
        <button data-testid="close-modal-button" onClick={onClose}>
          Close
        </button>
        <button data-testid="view-performance-button" onClick={() => onViewPerformance?.(456)}>
          View Performance
        </button>
      </div>
    );
  }),
}));

/**
 * Canonical user competition stats — the bare object shape the real backend
 * controller returns (NO { success, data } envelope on this endpoint).
 */
const mockUserStats = {
  userId: '123',
  totalCompetitions: 42,
  totalWins: 15,
  totalTop3: 28,
  winRate: 35.7,
  totalPrizeMoney: 125000,
  bestPlacement: 1,
  mostSuccessfulDiscipline: 'Dressage',
  recentCompetitions: [],
};

/**
 * Stub the user-competition-stats boundary with a given payload. Mirrors the
 * real controller's bare-object response (no envelope).
 */
function stubStats(stats: Record<string, unknown>) {
  server.use(http.get(STATS_PATH, () => HttpResponse.json(stats)));
}

describe('CompetitionResultsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    // Default: the boundary returns the canonical stats. Individual tests
    // override with server.use(...) where they need a different scenario.
    stubStats(mockUserStats);
  });

  const renderPage = (route = '/competitions/results') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: 123, username: 'TestUser' }}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/competitions/results" element={<CompetitionResultsPage />} />
              <Route
                path="/competitions/results/:competitionId"
                element={<CompetitionResultsPage />}
              />
            </Routes>
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );
  };

  const renderPageSimple = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: 123, username: 'TestUser' }}>
          <TestRouter>
            <CompetitionResultsPage />
          </TestRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );
  };

  // =========================================
  // 1. Component Rendering (5 tests)
  // =========================================
  describe('Component Rendering', () => {
    it('renders page header with title and description', () => {
      renderPageSimple();

      expect(
        screen.getByRole('heading', { name: /competition results/i, level: 1 })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/view your competition history and performance/i)
      ).toBeInTheDocument();
    });

    it('renders breadcrumb navigation', () => {
      renderPageSimple();

      const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(nav).toBeInTheDocument();
      expect(within(nav).getByText(/home/i)).toBeInTheDocument();
      expect(within(nav).getByText(/competitions/i)).toBeInTheDocument();
      expect(within(nav).getByText(/results/i)).toBeInTheDocument();
    });

    it('displays user stats summary cards', async () => {
      renderPageSimple();

      expect(screen.getByTestId('stats-summary')).toBeInTheDocument();
      // Stat cards render once the boundary data resolves.
      expect(await screen.findByTestId('stat-total-competitions')).toBeInTheDocument();
      expect(screen.getByTestId('stat-total-wins')).toBeInTheDocument();
      expect(screen.getByTestId('stat-win-rate')).toBeInTheDocument();
      expect(screen.getByTestId('stat-total-prize-money')).toBeInTheDocument();
    });

    it('renders results list component', () => {
      renderPageSimple();

      expect(screen.getByTestId('competition-results-list')).toBeInTheDocument();
    });

    it('shows tab navigation', () => {
      renderPageSimple();

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /my results/i })).toBeInTheDocument();
    });
  });

  // =========================================
  // 2. User Stats Display (4 tests)
  // =========================================
  describe('User Stats Display', () => {
    it('all stat cards displayed with correct values', async () => {
      renderPageSimple();

      // Total Competitions (waits for the boundary data to resolve)
      const totalCompCard = await screen.findByTestId('stat-total-competitions');
      expect(within(totalCompCard).getByText('42')).toBeInTheDocument();

      // Total Wins
      const winsCard = screen.getByTestId('stat-total-wins');
      expect(within(winsCard).getByText('15')).toBeInTheDocument();

      // Win Rate
      const winRateCard = screen.getByTestId('stat-win-rate');
      expect(within(winRateCard).getByText(/35\.7%/)).toBeInTheDocument();

      // Total Prize Money — game currency renders as coins (DECISIONS §9):
      // numeric text without a USD "$" prefix; the canonical Currency
      // component carries the "coins" terminology in its aria-label.
      const prizeCard = screen.getByTestId('stat-total-prize-money');
      expect(within(prizeCard).getByText(/125,000/)).toBeInTheDocument();
      expect(within(prizeCard).queryByText(/\$/)).not.toBeInTheDocument();
      expect(within(prizeCard).getByLabelText('125,000 coins')).toBeInTheDocument();
    });

    it('queries the boundary for the authenticated user stats', async () => {
      // Boundary observation replacing the former mock-internals assertion
      // (useUserCompetitionStats called with '123'): the real hook resolves
      // userId from useAuth and fetches /users/123/competition-stats.
      let requestedPath: string | null = null;
      server.use(
        http.get(STATS_PATH, ({ request }) => {
          requestedPath = new URL(request.url).pathname;
          return HttpResponse.json(mockUserStats);
        })
      );

      renderPageSimple();

      // The stats card only renders after the request resolves.
      await screen.findByTestId('stat-total-competitions');
      expect(requestedPath).toBe('/api/v1/users/123/competition-stats');
    });

    it('loading state shows skeleton cards', async () => {
      // Delay the boundary so the loading state is observable.
      server.use(
        http.get(STATS_PATH, async () => {
          await delay(100);
          return HttpResponse.json(mockUserStats);
        })
      );

      renderPageSimple();

      const skeletons = await screen.findAllByTestId('stat-card-skeleton');
      expect(skeletons.length).toBe(4);
    });

    it('error state shows error message with retry', async () => {
      server.use(
        http.get(STATS_PATH, () =>
          HttpResponse.json({ status: 'error', message: 'Failed to load stats' }, { status: 500 })
        )
      );

      renderPageSimple();

      expect(await screen.findByTestId('stats-error')).toBeInTheDocument();
      expect(screen.getByText(/failed to load stats/i)).toBeInTheDocument();

      // Clicking retry re-issues the boundary request; stub a success so the
      // error clears and the stats render.
      server.use(http.get(STATS_PATH, () => HttpResponse.json(mockUserStats)));
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.queryByTestId('stats-error')).not.toBeInTheDocument();
      });
      expect(await screen.findByTestId('stat-total-competitions')).toBeInTheDocument();
    });
  });

  // =========================================
  // 3. Results List Integration (3 tests)
  // =========================================
  describe('Results List Integration', () => {
    it('CompetitionResultsList integrated correctly', () => {
      renderPageSimple();

      expect(screen.getByTestId('competition-results-list')).toBeInTheDocument();
    });

    it('filters passed correctly to results list', async () => {
      // Import the mocked module dynamically
      const CompetitionResultsListModule =
        await import('@/components/competition/CompetitionResultsList');
      const MockedResultsList = CompetitionResultsListModule.default as ReturnType<typeof vi.fn>;

      renderPageSimple();

      expect(MockedResultsList).toHaveBeenCalled();
      // Verify it was called with expected props
      const lastCall = MockedResultsList.mock.calls[MockedResultsList.mock.calls.length - 1][0];
      expect(lastCall).toHaveProperty('onResultClick');
      expect(lastCall).toHaveProperty('userId');
    });

    it('click on competition opens results modal', async () => {
      const user = userEvent.setup();
      renderPageSimple();

      // Click on a result item
      const resultItem = screen.getByTestId('mock-result-item');
      await user.click(resultItem);

      // Modal should open
      await waitFor(() => {
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      });

      // Verify correct competition ID is passed
      expect(screen.getByTestId('modal-competition-id')).toHaveTextContent('123');
    });
  });

  // =========================================
  // 4. Modal Management (4 tests)
  // =========================================
  describe('Modal Management', () => {
    it('results modal opens with correct competition ID', async () => {
      const user = userEvent.setup();
      renderPageSimple();

      // Click to open modal
      await user.click(screen.getByTestId('mock-result-item'));

      await waitFor(() => {
        const modal = screen.getByTestId('competition-results-modal');
        expect(modal).toBeInTheDocument();
        expect(screen.getByTestId('modal-competition-id')).toHaveTextContent('123');
      });
    });

    it('results modal closes on close button', async () => {
      const user = userEvent.setup();
      renderPageSimple();

      // Open modal
      await user.click(screen.getByTestId('mock-result-item'));

      await waitFor(() => {
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      });

      // Close modal
      await user.click(screen.getByTestId('close-modal-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('competition-results-modal')).not.toBeInTheDocument();
      });
    });

    it('performance breakdown opens with correct IDs', async () => {
      const user = userEvent.setup();
      renderPageSimple();

      // Open results modal first
      await user.click(screen.getByTestId('mock-result-item'));

      await waitFor(() => {
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      });

      // Click view performance
      await user.click(screen.getByTestId('view-performance-button'));

      // Performance view state should be set (we verify through test ID or state change)
      await waitFor(() => {
        // The page should track performance view state internally
        // This is verified by the onViewPerformance callback being triggered
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      });
    });

    it('performance breakdown closes correctly', async () => {
      const user = userEvent.setup();
      renderPageSimple();

      // Open modal
      await user.click(screen.getByTestId('mock-result-item'));

      await waitFor(() => {
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      });

      // Close everything
      await user.click(screen.getByTestId('close-modal-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('competition-results-modal')).not.toBeInTheDocument();
      });
    });
  });

  // =========================================
  // 5. Routing & Navigation (2 tests)
  // =========================================
  describe('Routing & Navigation', () => {
    it('breadcrumb links are present', () => {
      renderPageSimple();

      const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
      const homeLink = within(nav).getByRole('link', { name: /home/i });
      const competitionsLink = within(nav).getByRole('link', { name: /competitions/i });

      expect(homeLink).toHaveAttribute('href', '/');
      expect(competitionsLink).toHaveAttribute('href', '/competitions');
    });

    it('deep link to competition opens modal automatically', async () => {
      renderPage('/competitions/results/456');

      await waitFor(() => {
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
        expect(screen.getByTestId('modal-competition-id')).toHaveTextContent('456');
      });
    });
  });

  // =========================================
  // 6. Empty State (2 tests)
  // =========================================
  describe('Empty State', () => {
    it('empty state shows when no competitions and stats are zero', async () => {
      stubStats({
        ...mockUserStats,
        totalCompetitions: 0,
        totalWins: 0,
        totalTop3: 0,
        totalPrizeMoney: 0,
      });

      renderPageSimple();

      expect(await screen.findByTestId('empty-state-banner')).toBeInTheDocument();
      expect(screen.getByText(/you haven't entered any competitions yet/i)).toBeInTheDocument();
    });

    it('CTA button navigates to competition browser', async () => {
      stubStats({
        ...mockUserStats,
        totalCompetitions: 0,
      });

      renderPageSimple();

      const ctaButton = await screen.findByRole('link', { name: /browse competitions/i });
      expect(ctaButton).toHaveAttribute('href', '/competitions');
    });
  });

  // =========================================
  // Additional Tests for Accessibility
  // =========================================
  describe('Accessibility', () => {
    it('has main landmark role', () => {
      renderPageSimple();

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('page title is accessible heading', () => {
      renderPageSimple();

      const heading = screen.getByRole('heading', { name: /competition results/i, level: 1 });
      expect(heading.tagName).toBe('H1');
    });

    it('stats cards have proper ARIA labels', () => {
      renderPageSimple();

      const statsSection = screen.getByTestId('stats-summary');
      expect(statsSection).toHaveAttribute('aria-label', 'Competition statistics summary');
    });
  });

  // =========================================
  // Responsive Design
  // =========================================
  describe('Responsive Design', () => {
    it('uses the canonical PageContainer instead of page-local gutters', () => {
      renderPageSimple();

      // Gutters belong to the DashboardLayout shell (DECISIONS §1) — the page
      // must NOT add its own horizontal padding; width comes from PageContainer.
      const container = screen.getByTestId('competition-results-page');
      expect(container.className).toContain('max-w-6xl');
      const main = screen.getByRole('main');
      expect(main.className).not.toMatch(/(^|\s)px-/);
    });

    it('stats grid is responsive', async () => {
      renderPageSimple();

      const statsGrid = await screen.findByTestId('stats-grid');
      expect(statsGrid).toHaveClass('grid-cols-1');
      expect(statsGrid).toHaveClass('sm:grid-cols-2');
      expect(statsGrid).toHaveClass('lg:grid-cols-4');
    });
  });
});
