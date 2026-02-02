/**
 * PrizeIntegration Component Tests
 *
 * Integration test suite for prize features integrated into results display.
 * Tests the integration between:
 * - CompetitionResultsModal and prize components (PrizeSummaryCard, PrizeNotificationModal)
 * - CompetitionResultsPage and balance/prize display features
 * - Data flow between results and prize components
 *
 * Story 5-3: Competition History - Task 7 (Integration with Results Display)
 * Target: 16 integration tests following TDD methodology
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CompetitionResultsModal, { type CompetitionResults } from '../CompetitionResultsModal';
import CompetitionResultsPage from '../../../pages/CompetitionResultsPage';

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
  default: vi.fn(({ onResultClick }) => {
    return (
      <div data-testid="competition-results-list">
        <button data-testid="mock-result-item" onClick={() => onResultClick(1)}>
          Mock Competition Result
        </button>
        <button data-testid="mock-result-item-2" onClick={() => onResultClick(2)}>
          Mock Competition Result 2
        </button>
      </div>
    );
  }),
}));

// Import mocked modules
const { useAuth } = await import('@/contexts/AuthContext');
const { useUserCompetitionStats } = await import('@/hooks/api/useUserCompetitionStats');

describe('PrizeIntegration', () => {
  const mockOnClose = vi.fn();
  const mockOnViewPerformance = vi.fn();
  const mockOnFirstView = vi.fn();
  const mockOnPrizeNotificationClose = vi.fn();

  // Sample competition results with user prizes
  const resultsWithUserPrizes: CompetitionResults = {
    competitionId: 1,
    competitionName: 'Spring Grand Prix Championship',
    discipline: 'Show Jumping',
    date: '2026-04-15',
    totalParticipants: 25,
    prizePool: 10000,
    prizeDistribution: {
      first: 5000,
      second: 3000,
      third: 2000,
    },
    results: [
      {
        rank: 1,
        horseId: 101,
        horseName: 'Thunder Bolt',
        ownerId: 'user-123',
        ownerName: 'Current User',
        finalScore: 95.5,
        prizeWon: 5000,
        isCurrentUser: true,
      },
      {
        rank: 2,
        horseId: 102,
        horseName: 'Midnight Star',
        ownerId: 'user-123',
        ownerName: 'Current User',
        finalScore: 92.3,
        prizeWon: 3000,
        isCurrentUser: true,
      },
      {
        rank: 3,
        horseId: 103,
        horseName: 'Silver Arrow',
        ownerId: 'user-789',
        ownerName: 'Bob Johnson',
        finalScore: 88.7,
        prizeWon: 2000,
        isCurrentUser: false,
      },
      {
        rank: 4,
        horseId: 104,
        horseName: 'Golden Dawn',
        ownerId: 'user-456',
        ownerName: 'Alice Smith',
        finalScore: 85.2,
        prizeWon: 0,
        isCurrentUser: false,
      },
    ],
  };

  // Sample competition results with NO user prizes
  const resultsWithoutUserPrizes: CompetitionResults = {
    competitionId: 2,
    competitionName: 'Autumn Challenge',
    discipline: 'Dressage',
    date: '2026-05-20',
    totalParticipants: 15,
    prizePool: 6000,
    prizeDistribution: {
      first: 3000,
      second: 1800,
      third: 1200,
    },
    results: [
      {
        rank: 1,
        horseId: 201,
        horseName: 'Champion',
        ownerId: 'user-789',
        ownerName: 'Bob Johnson',
        finalScore: 97.0,
        prizeWon: 3000,
        isCurrentUser: false,
      },
      {
        rank: 4,
        horseId: 202,
        horseName: 'My Horse',
        ownerId: 'user-123',
        ownerName: 'Current User',
        finalScore: 80.5,
        prizeWon: 0,
        isCurrentUser: true,
      },
    ],
  };

  // Sample user competition stats
  const mockUserStats = {
    userId: 'user-123',
    totalCompetitions: 10,
    totalWins: 3,
    totalTop3: 5,
    winRate: 30.0,
    totalPrizeMoney: 15000,
    totalXpGained: 1500,
    bestPlacement: 1,
    mostSuccessfulDiscipline: 'Show Jumping',
    recentCompetitions: [],
  };

  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

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

  afterEach(() => {
    document.body.style.overflow = '';
  });

  // ==================== COMPETITION RESULTS MODAL INTEGRATION (8 tests) ====================
  describe('CompetitionResultsModal Integration', () => {
    // Helper to render modal with results data
    const renderModal = (
      results: CompetitionResults | null = resultsWithUserPrizes,
      showPrizeNotification = false
    ) => {
      return render(
        <BrowserRouter>
          <CompetitionResultsModal
            isOpen={true}
            onClose={mockOnClose}
            competitionId={results?.competitionId ?? 1}
            onViewPerformance={mockOnViewPerformance}
            onFirstView={mockOnFirstView}
            showPrizeNotification={showPrizeNotification}
            onPrizeNotificationClose={mockOnPrizeNotificationClose}
            _testResults={results}
            _testLoading={false}
            _testError={null}
          />
        </BrowserRouter>
      );
    };

    it('shows PrizeSummaryCard when user has prizes', () => {
      renderModal(resultsWithUserPrizes);

      // PrizeSummaryCard should be displayed for user with prizes
      expect(screen.getByTestId('prize-summary-card')).toBeInTheDocument();
    });

    it('does not show PrizeSummaryCard when user has no prizes', () => {
      renderModal(resultsWithoutUserPrizes);

      // PrizeSummaryCard should NOT be displayed when user doesn't have prizes
      expect(screen.queryByTestId('prize-summary-card')).not.toBeInTheDocument();
    });

    it('PrizeNotificationModal triggers on first view with prizes', () => {
      renderModal(resultsWithUserPrizes, true);

      // PrizeNotificationModal should be visible when showPrizeNotification is true
      expect(screen.getByTestId('prize-notification-modal')).toBeInTheDocument();
    });

    it('PrizeNotificationModal does not trigger on subsequent views', () => {
      renderModal(resultsWithUserPrizes, false);

      // PrizeNotificationModal should NOT be visible when showPrizeNotification is false
      expect(screen.queryByTestId('prize-notification-modal')).not.toBeInTheDocument();
    });

    it('prize summary card displays correct data', () => {
      renderModal(resultsWithUserPrizes);

      const summaryCard = screen.getByTestId('prize-summary-card');

      // Should display total prize money ($8,000 = $5,000 + $3,000)
      expect(within(summaryCard).getByTestId('total-prize-money')).toHaveTextContent('$8,000');

      // Should display correct placed count (2 horses in top 3)
      expect(within(summaryCard).getByTestId('placed-count')).toHaveTextContent('2');
    });

    it('prize summary card is expandable', async () => {
      const user = userEvent.setup();
      renderModal(resultsWithUserPrizes);

      // Initially details should be collapsed
      expect(screen.queryByTestId('horse-breakdown-list')).not.toBeInTheDocument();

      // Click expand button
      const expandButton = screen.getByTestId('expand-toggle');
      await user.click(expandButton);

      // Details should now be visible
      expect(screen.getByTestId('horse-breakdown-list')).toBeInTheDocument();

      // Should show both horses
      const prizeEntries = screen.getAllByTestId('horse-prize-entry');
      expect(prizeEntries).toHaveLength(2);
    });

    it('link to prize history exists in modal footer', () => {
      renderModal(resultsWithUserPrizes);

      // Should have a link to prize history
      const prizeHistoryLink = screen.getByRole('link', { name: /prize history/i });
      expect(prizeHistoryLink).toBeInTheDocument();
      expect(prizeHistoryLink).toHaveAttribute('href', '/prizes');
    });

    it('multiple horses with prizes are handled correctly', async () => {
      const user = userEvent.setup();
      renderModal(resultsWithUserPrizes);

      // Expand to see all horses
      const expandButton = screen.getByTestId('expand-toggle');
      await user.click(expandButton);

      // Should have entries for both prize-winning horses
      const prizeEntries = screen.getAllByTestId('horse-prize-entry');
      expect(prizeEntries).toHaveLength(2);

      // First place horse should be listed first (sorted by placement)
      expect(prizeEntries[0]).toHaveTextContent('Thunder Bolt');
      expect(prizeEntries[0]).toHaveTextContent('1st Place');

      // Second place horse
      expect(prizeEntries[1]).toHaveTextContent('Midnight Star');
      expect(prizeEntries[1]).toHaveTextContent('2nd Place');
    });
  });

  // ==================== COMPETITION RESULTS PAGE INTEGRATION (5 tests) ====================
  describe('CompetitionResultsPage Integration', () => {
    const renderPage = (route = '/competitions/results') => {
      return render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/competitions/results" element={<CompetitionResultsPage />} />
              <Route
                path="/competitions/results/:competitionId"
                element={<CompetitionResultsPage />}
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );
    };

    it('BalanceUpdateIndicator shows after prize viewing', async () => {
      // Set up stats with initial balance
      (useUserCompetitionStats as Mock).mockReturnValue({
        data: { ...mockUserStats, totalPrizeMoney: 15000 },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      renderPage();

      // BalanceUpdateIndicator should be visible in header area
      expect(screen.getByTestId('balance-update-indicator')).toBeInTheDocument();
    });

    it('balance updates correctly after claiming prizes', async () => {
      // Initial balance
      const initialStats = { ...mockUserStats, totalPrizeMoney: 15000 };

      (useUserCompetitionStats as Mock).mockReturnValue({
        data: initialStats,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      renderPage();

      // Balance display should show the total prize money
      const balanceDisplay = screen.getByTestId('balance-display');
      expect(balanceDisplay).toHaveTextContent('$15,000');
    });

    it('link to prize history page exists', () => {
      renderPage();

      // Should have a link to prize history page in header
      const prizeHistoryLink = screen.getByRole('link', { name: /view prize history/i });
      expect(prizeHistoryLink).toBeInTheDocument();
      expect(prizeHistoryLink).toHaveAttribute('href', '/prizes');
    });

    it('viewed competitions are tracked', async () => {
      const user = userEvent.setup();
      renderPage();

      // Click on a result to open modal
      const resultItem = screen.getByTestId('mock-result-item');
      await user.click(resultItem);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      });

      // Close the modal
      await user.click(screen.getByTestId('close-modal-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('competition-results-modal')).not.toBeInTheDocument();
      });

      // Open the same competition again
      await user.click(resultItem);

      await waitFor(() => {
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      });

      // Prize notification should NOT show on subsequent views
      expect(screen.queryByTestId('prize-notification-modal')).not.toBeInTheDocument();
    });

    it('prize notification does not repeat on re-open', async () => {
      const user = userEvent.setup();
      renderPage();

      // Click on first result
      const resultItem = screen.getByTestId('mock-result-item');
      await user.click(resultItem);

      await waitFor(() => {
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      });

      // Close
      await user.click(screen.getByTestId('close-modal-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('competition-results-modal')).not.toBeInTheDocument();
      });

      // Open same competition again
      await user.click(resultItem);

      await waitFor(() => {
        expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      });

      // Prize notification should NOT appear on second view
      expect(screen.queryByTestId('prize-notification-modal')).not.toBeInTheDocument();
    });
  });

  // ==================== DATA FLOW TESTS (3 tests) ====================
  describe('Data Flow Tests', () => {
    const renderModal = (results: CompetitionResults) => {
      return render(
        <BrowserRouter>
          <CompetitionResultsModal
            isOpen={true}
            onClose={mockOnClose}
            competitionId={results.competitionId}
            onViewPerformance={mockOnViewPerformance}
            _testResults={results}
            _testLoading={false}
            _testError={null}
          />
        </BrowserRouter>
      );
    };

    it('prize data flows from results to summary card', async () => {
      const user = userEvent.setup();
      renderModal(resultsWithUserPrizes);

      // Verify data flows correctly from results to summary card
      const summaryCard = screen.getByTestId('prize-summary-card');

      // Competition name should be passed
      expect(summaryCard).toHaveTextContent('Spring Grand Prix Championship');

      // Expand to verify horse data
      const expandButton = screen.getByTestId('expand-toggle');
      await user.click(expandButton);

      // Horse names from results should appear in the prize breakdown list
      const horseBreakdown = screen.getByTestId('horse-breakdown-list');
      expect(within(horseBreakdown).getByText('Thunder Bolt')).toBeInTheDocument();
      expect(within(horseBreakdown).getByText('Midnight Star')).toBeInTheDocument();
    });

    it('competition data flows to prize notification', () => {
      render(
        <BrowserRouter>
          <CompetitionResultsModal
            isOpen={true}
            onClose={mockOnClose}
            competitionId={resultsWithUserPrizes.competitionId}
            onViewPerformance={mockOnViewPerformance}
            showPrizeNotification={true}
            onPrizeNotificationClose={mockOnPrizeNotificationClose}
            _testResults={resultsWithUserPrizes}
            _testLoading={false}
            _testError={null}
          />
        </BrowserRouter>
      );

      const notification = screen.getByTestId('prize-notification-modal');

      // Competition data should flow to notification
      expect(within(notification).getByTestId('competition-name')).toHaveTextContent(
        'Spring Grand Prix Championship'
      );
      expect(within(notification).getByTestId('competition-discipline')).toHaveTextContent(
        'Show Jumping'
      );

      // Best prize winner data should be shown (1st place)
      expect(within(notification).getByTestId('horse-name')).toHaveTextContent('Thunder Bolt');
      expect(within(notification).getByTestId('prize-money')).toHaveTextContent('$5,000');
    });

    it('balance updates propagate to indicator', () => {
      const renderPage = () => {
        return render(
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <CompetitionResultsPage />
            </BrowserRouter>
          </QueryClientProvider>
        );
      };

      // Set up with specific balance
      (useUserCompetitionStats as Mock).mockReturnValue({
        data: { ...mockUserStats, totalPrizeMoney: 25000 },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });

      renderPage();

      // Balance indicator should show the updated balance
      const balanceDisplay = screen.getByTestId('balance-display');
      expect(balanceDisplay).toHaveTextContent('$25,000');
    });
  });
});
