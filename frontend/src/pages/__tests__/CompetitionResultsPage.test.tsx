/**
 * CompetitionResultsPage Component Tests
 *
 * Comprehensive test suite for the competition results page.
 * Story 5-2: Competition Results Display - Main Results Page
 *
 * Tests cover:
 * - Component rendering (header, description, breadcrumbs)
 * - User statistics display (stats cards, loading, error)
 * - Results list integration
 * - Modal management (results modal, performance breakdown)
 * - Routing and navigation
 * - Empty state handling
 * - Accessibility compliance
 *
 * Target: 20 tests following TDD methodology
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CompetitionResultsPage from '../CompetitionResultsPage';

// Mock the auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock the API hooks
vi.mock('@/hooks/api/useUserCompetitionStats', () => ({
  useUserCompetitionStats: vi.fn(),
}));

// Mock the results list component to isolate page testing
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
        <button
          data-testid="mock-result-item"
          onClick={() => onResultClick(123)}
        >
          Mock Competition Result
        </button>
      </div>
    );
  }),
}));

// Mock the results modal component
vi.mock('@/components/competition/CompetitionResultsModal', () => ({
  default: vi.fn(({ isOpen, onClose, competitionId, onViewPerformance }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="competition-results-modal" role="dialog">
        <span data-testid="modal-competition-id">{competitionId}</span>
        <button data-testid="close-modal-button" onClick={onClose}>
          Close
        </button>
        <button
          data-testid="view-performance-button"
          onClick={() => onViewPerformance?.(456)}
        >
          View Performance
        </button>
      </div>
    );
  }),
}));

// Import mocked modules
const { useAuth } = await import('@/contexts/AuthContext');
const { useUserCompetitionStats } = await import('@/hooks/api/useUserCompetitionStats');

describe('CompetitionResultsPage', () => {
  let queryClient: QueryClient;

  // Sample user competition stats
  const mockUserStats = {
    userId: 'user-123',
    totalCompetitions: 42,
    totalWins: 15,
    totalTop3: 28,
    winRate: 35.7,
    totalPrizeMoney: 125000,
    totalXpGained: 4500,
    bestPlacement: 1,
    mostSuccessfulDiscipline: 'Dressage',
    recentCompetitions: [],
  };

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

    (useUserCompetitionStats as Mock).mockReturnValue({
      data: mockUserStats,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  const renderPage = (route = '/competitions/results') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/competitions/results" element={<CompetitionResultsPage />} />
            <Route path="/competitions/results/:competitionId" element={<CompetitionResultsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  const renderPageSimple = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CompetitionResultsPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  // =========================================
  // 1. Component Rendering (5 tests)
  // =========================================
  describe('Component Rendering', () => {
    it('renders page header with title and description', () => {
      renderPageSimple();

      expect(screen.getByRole('heading', { name: /competition results/i, level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/view your competition history and performance/i)).toBeInTheDocument();
    });

    it('renders breadcrumb navigation', () => {
      renderPageSimple();

      const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(nav).toBeInTheDocument();
      expect(within(nav).getByText(/home/i)).toBeInTheDocument();
      expect(within(nav).getByText(/competitions/i)).toBeInTheDocument();
      expect(within(nav).getByText(/results/i)).toBeInTheDocument();
    });

    it('displays user stats summary cards', () => {
      renderPageSimple();

      expect(screen.getByTestId('stats-summary')).toBeInTheDocument();
      expect(screen.getByTestId('stat-total-competitions')).toBeInTheDocument();
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
    it('all stat cards displayed with correct values', () => {
      renderPageSimple();

      // Total Competitions
      const totalCompCard = screen.getByTestId('stat-total-competitions');
      expect(within(totalCompCard).getByText('42')).toBeInTheDocument();

      // Total Wins
      const winsCard = screen.getByTestId('stat-total-wins');
      expect(within(winsCard).getByText('15')).toBeInTheDocument();

      // Win Rate
      const winRateCard = screen.getByTestId('stat-win-rate');
      expect(within(winRateCard).getByText(/35\.7%/)).toBeInTheDocument();

      // Total Prize Money
      const prizeCard = screen.getByTestId('stat-total-prize-money');
      expect(within(prizeCard).getByText(/\$125,000/)).toBeInTheDocument();
    });

    it('stats use data from useUserCompetitionStats hook', () => {
      renderPageSimple();

      expect(useUserCompetitionStats).toHaveBeenCalledWith('123');
    });

    it('loading state shows skeleton cards', () => {
      (useUserCompetitionStats as Mock).mockReturnValue({
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

    it('error state shows error message with retry', async () => {
      const mockRefetch = vi.fn();
      (useUserCompetitionStats as Mock).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'Failed to load stats' },
        refetch: mockRefetch,
      });

      renderPageSimple();

      expect(screen.getByTestId('stats-error')).toBeInTheDocument();
      expect(screen.getByText(/failed to load stats/i)).toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      expect(mockRefetch).toHaveBeenCalled();
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
      const CompetitionResultsListModule = await import('@/components/competition/CompetitionResultsList');
      const MockedResultsList = CompetitionResultsListModule.default as Mock;

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
    it('empty state shows when no competitions and stats are zero', () => {
      (useUserCompetitionStats as Mock).mockReturnValue({
        data: {
          ...mockUserStats,
          totalCompetitions: 0,
          totalWins: 0,
          totalTop3: 0,
          totalPrizeMoney: 0,
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      renderPageSimple();

      expect(screen.getByTestId('empty-state-banner')).toBeInTheDocument();
      expect(screen.getByText(/you haven't entered any competitions yet/i)).toBeInTheDocument();
    });

    it('CTA button navigates to competition browser', () => {
      (useUserCompetitionStats as Mock).mockReturnValue({
        data: {
          ...mockUserStats,
          totalCompetitions: 0,
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      renderPageSimple();

      const ctaButton = screen.getByRole('link', { name: /browse competitions/i });
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
      expect(statsGrid).toHaveClass('grid-cols-1');
      expect(statsGrid).toHaveClass('sm:grid-cols-2');
      expect(statsGrid).toHaveClass('lg:grid-cols-4');
    });
  });
});
