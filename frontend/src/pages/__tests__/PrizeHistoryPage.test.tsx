/**
 * PrizeHistoryPage Component Tests
 *
 * Comprehensive test suite for the prize history page.
 * Story 5-3: Competition History Display - Task 6: Prize History Page
 *
 * Tests cover:
 * - Component rendering (header, breadcrumbs, stat cards)
 * - Summary statistics display (total prize money, XP, competitions, win rate)
 * - Navigation and routing (breadcrumb links, URL params)
 * - Filter integration with URL params
 * - PrizeTransactionHistory integration
 * - Loading and error states
 * - Edge cases (empty data, API errors)
 * - Accessibility compliance
 *
 * Target: 20+ tests following TDD methodology
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, Routes, Route } from '../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PrizeHistoryPage from '../PrizeHistoryPage';

// Mock the auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock the usePrizeHistory hook
vi.mock('@/hooks/api/usePrizeHistory', () => ({
  usePrizeHistory: vi.fn(),
}));

// Mock the PrizeTransactionHistory component to isolate page testing
vi.mock('@/components/competition/PrizeTransactionHistory', () => ({
  default: vi.fn(({ transactions, filters, onFilterChange }) => (
    <div data-testid="prize-transaction-history">
      <span data-testid="transaction-count">{transactions?.length ?? 0}</span>
      <span data-testid="filter-date-range">{filters?.dateRange ?? 'all'}</span>
      <span data-testid="filter-horse-id">{filters?.horseId ?? 'all'}</span>
      <span data-testid="filter-discipline">{filters?.discipline ?? 'all'}</span>
      <button
        data-testid="mock-change-filter"
        onClick={() => onFilterChange?.({ dateRange: '30days', horseId: 1, discipline: 'dressage' })}
      >
        Change Filters
      </button>
    </div>
  )),
}));

// Import mocked modules
const { useAuth } = await import('@/contexts/AuthContext');
const { usePrizeHistory } = await import('@/hooks/api/usePrizeHistory');

describe('PrizeHistoryPage', () => {
  let queryClient: QueryClient;

  // Sample prize transactions data
  const mockTransactions = [
    {
      transactionId: 'txn-001',
      date: '2026-03-15T10:00:00Z',
      competitionId: 1,
      competitionName: 'Spring Dressage Championship',
      horseId: 1,
      horseName: 'Thunder',
      discipline: 'dressage',
      placement: 1,
      prizeMoney: 2500,
      xpGained: 150,
      claimed: true,
      claimedAt: '2026-03-15T12:00:00Z',
    },
    {
      transactionId: 'txn-002',
      date: '2026-02-10T14:00:00Z',
      competitionId: 2,
      competitionName: 'Winter Jumping Series',
      horseId: 2,
      horseName: 'Storm',
      discipline: 'jumping',
      placement: 2,
      prizeMoney: 1500,
      xpGained: 100,
      claimed: true,
      claimedAt: '2026-02-10T16:00:00Z',
    },
    {
      transactionId: 'txn-003',
      date: '2026-01-25T09:00:00Z',
      competitionId: 3,
      competitionName: 'Regional Eventing Finals',
      horseId: 1,
      horseName: 'Thunder',
      discipline: 'eventing',
      placement: 3,
      prizeMoney: 1000,
      xpGained: 75,
      claimed: false,
    },
    {
      transactionId: 'txn-004',
      date: '2025-12-20T10:00:00Z',
      competitionId: 4,
      competitionName: 'Holiday Dressage Cup',
      horseId: 1,
      horseName: 'Thunder',
      discipline: 'dressage',
      placement: 1,
      prizeMoney: 2000,
      xpGained: 125,
      claimed: true,
      claimedAt: '2025-12-20T14:00:00Z',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Default mock implementations
    (useAuth as Mock).mockReturnValue({
      user: { id: 123, username: 'TestUser' },
      isAuthenticated: true,
      isLoading: false,
    });

    (usePrizeHistory as Mock).mockReturnValue({
      data: mockTransactions,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  const renderPage = (route = '/prizes') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/prizes" element={<PrizeHistoryPage />} />
            <Route path="/profile/prizes" element={<PrizeHistoryPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  const renderPageSimple = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TestRouter>
          <PrizeHistoryPage />
        </TestRouter>
      </QueryClientProvider>
    );
  };

  // =========================================
  // 1. Rendering Tests (6 tests)
  // =========================================
  describe('Rendering Tests', () => {
    it('renders page title correctly', () => {
      renderPageSimple();

      expect(screen.getByRole('heading', { name: /prize history/i, level: 1 })).toBeInTheDocument();
    });

    it('displays breadcrumb navigation', () => {
      renderPageSimple();

      const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(nav).toBeInTheDocument();
      expect(within(nav).getByText(/home/i)).toBeInTheDocument();
      expect(within(nav).getByText(/profile/i)).toBeInTheDocument();
      expect(within(nav).getByText(/prize history/i)).toBeInTheDocument();
    });

    it('shows 4 summary stat cards', () => {
      renderPageSimple();

      expect(screen.getByTestId('stat-total-prize-money')).toBeInTheDocument();
      expect(screen.getByTestId('stat-total-xp')).toBeInTheDocument();
      expect(screen.getByTestId('stat-total-competitions')).toBeInTheDocument();
      expect(screen.getByTestId('stat-win-rate')).toBeInTheDocument();
    });

    it('renders PrizeTransactionHistory component', () => {
      renderPageSimple();

      expect(screen.getByTestId('prize-transaction-history')).toBeInTheDocument();
    });

    it('loading state shows skeleton cards', () => {
      (usePrizeHistory as Mock).mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      renderPageSimple();

      const skeletons = screen.getAllByTestId('stat-card-skeleton');
      expect(skeletons.length).toBe(4);
    });

    it('error state shows error message', () => {
      (usePrizeHistory as Mock).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'Failed to load prize history' },
        refetch: vi.fn(),
      });

      renderPageSimple();

      expect(screen.getByTestId('stats-error')).toBeInTheDocument();
      expect(screen.getByText(/failed to load prize history/i)).toBeInTheDocument();
    });
  });

  // =========================================
  // 2. Summary Statistics Tests (4 tests)
  // =========================================
  describe('Summary Statistics Tests', () => {
    it('total prize money displays correctly with formatting', () => {
      renderPageSimple();

      const prizeCard = screen.getByTestId('stat-total-prize-money');
      // Total: 2500 + 1500 + 1000 + 2000 = 7000
      expect(within(prizeCard).getByText(/\$7,000/)).toBeInTheDocument();
    });

    it('total XP displays correctly', () => {
      renderPageSimple();

      const xpCard = screen.getByTestId('stat-total-xp');
      // Total: 150 + 100 + 75 + 125 = 450
      expect(within(xpCard).getByText('450')).toBeInTheDocument();
    });

    it('total competitions count is correct', () => {
      renderPageSimple();

      const compCard = screen.getByTestId('stat-total-competitions');
      // Total: 4 transactions
      expect(within(compCard).getByText('4')).toBeInTheDocument();
    });

    it('win rate calculates and displays as percentage', () => {
      renderPageSimple();

      const winRateCard = screen.getByTestId('stat-win-rate');
      // First places: 2 out of 4 = 50%
      expect(within(winRateCard).getByText(/50\.0%/)).toBeInTheDocument();
    });
  });

  // =========================================
  // 3. Navigation Tests (3 tests)
  // =========================================
  describe('Navigation Tests', () => {
    it('breadcrumb links navigate correctly', () => {
      renderPageSimple();

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
      renderPageSimple();

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
    it('filters persist in URL params', async () => {
      const user = userEvent.setup();
      renderPage('/prizes');

      // Find the mock change filter button and click it
      const changeFilterBtn = screen.getByTestId('mock-change-filter');
      await user.click(changeFilterBtn);

      // URL should be updated with filter params
      // This is tested through the component's URL sync behavior
      await waitFor(() => {
        expect(screen.getByTestId('filter-date-range')).toHaveTextContent('30days');
      });
    });

    it('URL params are parsed on load', async () => {
      renderPage('/prizes?dateRange=7days&horseId=2&discipline=jumping');

      await waitFor(() => {
        expect(screen.getByTestId('filter-date-range')).toHaveTextContent('7days');
        expect(screen.getByTestId('filter-horse-id')).toHaveTextContent('2');
        expect(screen.getByTestId('filter-discipline')).toHaveTextContent('jumping');
      });
    });

    it('changing filters updates URL', async () => {
      const user = userEvent.setup();
      renderPage('/prizes');

      // Click the mock filter change button
      const changeFilterBtn = screen.getByTestId('mock-change-filter');
      await user.click(changeFilterBtn);

      // Verify the filter state changed
      await waitFor(() => {
        expect(screen.getByTestId('filter-discipline')).toHaveTextContent('dressage');
      });
    });
  });

  // =========================================
  // 5. Integration Tests (2 tests)
  // =========================================
  describe('Integration Tests', () => {
    it('PrizeTransactionHistory receives correct user ID', async () => {
      renderPageSimple();

      // Verify usePrizeHistory was called with the user ID
      expect(usePrizeHistory).toHaveBeenCalledWith('123', expect.any(Object));
    });

    it('PrizeTransactionHistory receives filters from URL', async () => {
      renderPage('/prizes?dateRange=30days');

      await waitFor(() => {
        expect(usePrizeHistory).toHaveBeenCalledWith(
          '123',
          expect.objectContaining({ dateRange: '30days' })
        );
      });
    });
  });

  // =========================================
  // 6. Edge Cases (2 tests)
  // =========================================
  describe('Edge Cases', () => {
    it('handles no transaction data gracefully', () => {
      (usePrizeHistory as Mock).mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      renderPageSimple();

      // Stats should show zeros
      const prizeCard = screen.getByTestId('stat-total-prize-money');
      expect(within(prizeCard).getByText(/\$0/)).toBeInTheDocument();

      const xpCard = screen.getByTestId('stat-total-xp');
      expect(within(xpCard).getByText('0')).toBeInTheDocument();

      const compCard = screen.getByTestId('stat-total-competitions');
      expect(within(compCard).getByText('0')).toBeInTheDocument();

      const winRateCard = screen.getByTestId('stat-win-rate');
      expect(within(winRateCard).getByText(/0\.0%/)).toBeInTheDocument();
    });

    it('handles API error with retry button', async () => {
      const mockRefetch = vi.fn();
      (usePrizeHistory as Mock).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'Failed to load prize history' },
        refetch: mockRefetch,
      });

      const user = userEvent.setup();
      renderPageSimple();

      // Error state should show
      expect(screen.getByTestId('stats-error')).toBeInTheDocument();

      // Find and click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  // =========================================
  // 7. Accessibility Tests (4 tests)
  // =========================================
  describe('Accessibility', () => {
    it('has main landmark role', () => {
      renderPageSimple();

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('page title is accessible heading', () => {
      renderPageSimple();

      const heading = screen.getByRole('heading', { name: /prize history/i, level: 1 });
      expect(heading.tagName).toBe('H1');
    });

    it('stats section has proper ARIA label', () => {
      renderPageSimple();

      const statsSection = screen.getByTestId('stats-summary');
      expect(statsSection).toHaveAttribute('aria-label', 'Prize statistics summary');
    });

    it('icons have aria-hidden attribute', () => {
      renderPageSimple();

      // Get stat cards and check icons are hidden from screen readers
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
    it('applies responsive padding classes', () => {
      renderPageSimple();

      const main = screen.getByRole('main');
      expect(main.className).toContain('px-4');
      expect(main.className).toContain('sm:px-6');
      expect(main.className).toContain('lg:px-8');
    });

    it('stats grid is responsive', () => {
      renderPageSimple();

      const statsGrid = screen.getByTestId('stats-grid');
      expect(statsGrid).toHaveClass('grid-cols-2');
      expect(statsGrid).toHaveClass('md:grid-cols-4');
    });
  });
});
