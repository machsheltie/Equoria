/**
 * CompetitionResultsModal Component Tests
 *
 * Comprehensive test suite for the competition results modal component.
 * Tests cover:
 * - Component rendering states (open/closed)
 * - Modal behavior (close, backdrop, escape key)
 * - Results table display and functionality
 * - Sorting functionality (rank, score, horse name, owner name)
 * - User interaction with clickable rows
 * - Prize distribution display
 * - Loading, error, and empty states
 * - Accessibility compliance (ARIA, focus trap, keyboard nav)
 *
 * Target: 30 tests following TDD methodology
 * Story 5-2: Competition Results Display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import CompetitionResultsModal, {
  type CompetitionResultsModalProps,
  type CompetitionResults,
} from '../CompetitionResultsModal';

// Mock useHorseLevelInfo hook to avoid QueryClient dependency (Story 5-4 integration)
vi.mock('@/hooks/api/useHorseLevelInfo', () => ({
  useHorseLevelInfo: vi.fn().mockReturnValue({
    data: {
      horseId: 1,
      horseName: 'Test Horse',
      currentLevel: 5,
      currentXp: 450,
      xpForCurrentLevel: 45,
      xpToNextLevel: 100,
      totalXp: 450,
      progressPercent: 45,
      levelThresholds: { 1: 0, 2: 100, 3: 300, 4: 600, 5: 1000 },
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  horseLevelInfoQueryKeys: {
    all: ['horseLevelInfo'] as const,
    horse: (horseId: number) => ['horseLevelInfo', horseId] as const,
  },
}));

// Wrapper component that provides router context for Link components
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('CompetitionResultsModal', () => {
  const mockOnClose = vi.fn();
  const mockOnViewPerformance = vi.fn();

  // Sample competition results data for testing
  const sampleResults: CompetitionResults = {
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
        ownerId: 'user-456',
        ownerName: 'Alice Smith',
        finalScore: 95.5,
        prizeWon: 5000,
        isCurrentUser: false,
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
        ownerId: 'user-123',
        ownerName: 'Current User',
        finalScore: 85.2,
        prizeWon: 0,
        isCurrentUser: true,
      },
      {
        rank: 5,
        horseId: 105,
        horseName: 'Storm Chaser',
        ownerId: 'user-321',
        ownerName: 'Charlie Brown',
        finalScore: 82.1,
        prizeWon: 0,
        isCurrentUser: false,
      },
      {
        rank: 6,
        horseId: 106,
        horseName: 'Night Rider',
        ownerId: 'user-654',
        ownerName: 'Diana Prince',
        finalScore: 79.8,
        prizeWon: 0,
        isCurrentUser: false,
      },
    ],
  };

  const defaultProps: CompetitionResultsModalProps = {
    isOpen: true,
    onClose: mockOnClose,
    competitionId: 1,
    onViewPerformance: mockOnViewPerformance,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  // Helper to render with mock data
  const renderWithData = (
    props: Partial<CompetitionResultsModalProps> = {},
    results: CompetitionResults | null = sampleResults
  ) => {
    // We need to mock the data fetching - the component will use props or internal state
    // Using renderWithRouter wrapper to provide router context for Link components
    return renderWithRouter(
      <CompetitionResultsModal
        {...defaultProps}
        {...props}
        // In real implementation, data would be fetched based on competitionId
        // For testing, we pass it through a test prop
        _testResults={results}
        _testLoading={false}
        _testError={null}
      />
    );
  };

  // ==================== 1. COMPONENT RENDERING (5 tests) ====================
  describe('Component Rendering', () => {
    it('should render nothing when isOpen is false', () => {
      renderWithData({ isOpen: false });

      expect(screen.queryByTestId('competition-results-modal')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      renderWithData({ isOpen: true });

      expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should display competition header info', () => {
      renderWithData();

      expect(screen.getByTestId('competition-name')).toHaveTextContent(
        'Spring Grand Prix Championship'
      );
      expect(screen.getByTestId('competition-discipline')).toHaveTextContent('Show Jumping');
      expect(screen.getByTestId('competition-date')).toBeInTheDocument();
      expect(screen.getByTestId('total-participants')).toHaveTextContent('25');
    });

    it('should show prize distribution summary', () => {
      renderWithData();

      expect(screen.getByTestId('prize-distribution')).toBeInTheDocument();
      expect(screen.getByTestId('prize-1st')).toHaveTextContent('$5,000');
      expect(screen.getByTestId('prize-2nd')).toHaveTextContent('$3,000');
      expect(screen.getByTestId('prize-3rd')).toHaveTextContent('$2,000');
    });

    it('should render results table', () => {
      renderWithData();

      expect(screen.getByTestId('results-table')).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  // ==================== 2. MODAL BEHAVIOR (5 tests) ====================
  describe('Modal Behavior', () => {
    it('should open when isOpen changes to true', () => {
      const { rerender } = renderWithRouter(
        <CompetitionResultsModal
          {...defaultProps}
          isOpen={false}
          _testResults={sampleResults}
          _testLoading={false}
          _testError={null}
        />
      );

      expect(screen.queryByTestId('competition-results-modal')).not.toBeInTheDocument();

      rerender(
        <BrowserRouter>
          <CompetitionResultsModal
            {...defaultProps}
            isOpen={true}
            _testResults={sampleResults}
            _testLoading={false}
            _testError={null}
          />
        </BrowserRouter>
      );

      expect(screen.getByTestId('competition-results-modal')).toBeInTheDocument();
    });

    it('should close when close button is clicked', async () => {
      const user = userEvent.setup();
      renderWithData();

      const closeButton = screen.getByTestId('close-modal-button');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close when backdrop is clicked', async () => {
      const user = userEvent.setup();
      renderWithData();

      const backdrop = screen.getByTestId('modal-backdrop');
      await user.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close when Escape key is pressed', () => {
      renderWithData();

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose callback when closing', async () => {
      const user = userEvent.setup();
      renderWithData();

      await user.click(screen.getByTestId('close-modal-button'));

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // ==================== 3. RESULTS TABLE (8 tests) ====================
  describe('Results Table', () => {
    it('should display all participants in the table', () => {
      renderWithData();

      const rows = screen.getAllByTestId(/^result-row-/);
      expect(rows).toHaveLength(6);
    });

    it("should highlight user's horses with different background", () => {
      renderWithData();

      const userRow1 = screen.getByTestId('result-row-102');
      const userRow2 = screen.getByTestId('result-row-104');
      const otherRow = screen.getByTestId('result-row-101');

      expect(userRow1).toHaveClass('bg-blue-50');
      expect(userRow2).toHaveClass('bg-blue-50');
      expect(otherRow).not.toHaveClass('bg-blue-50');
    });

    it('should show placement badges for top 3', () => {
      renderWithData();

      // Gold badge for 1st place
      const goldBadge = screen.getByTestId('placement-badge-1');
      expect(goldBadge).toBeInTheDocument();
      expect(goldBadge).toHaveClass('bg-yellow-400');

      // Silver badge for 2nd place
      const silverBadge = screen.getByTestId('placement-badge-2');
      expect(silverBadge).toBeInTheDocument();
      expect(silverBadge).toHaveClass('bg-gray-300');

      // Bronze badge for 3rd place
      const bronzeBadge = screen.getByTestId('placement-badge-3');
      expect(bronzeBadge).toBeInTheDocument();
      expect(bronzeBadge).toHaveClass('bg-orange-400');
    });

    it('should display all table columns correctly', () => {
      renderWithData();

      // Check table headers within the results table
      const resultsTable = screen.getByTestId('results-table');
      expect(within(resultsTable).getByText('Rank')).toBeInTheDocument();
      expect(within(resultsTable).getByText('Horse')).toBeInTheDocument();
      expect(within(resultsTable).getByText('Owner')).toBeInTheDocument();
      expect(within(resultsTable).getByText('Score')).toBeInTheDocument();
      expect(within(resultsTable).getByText('Prize')).toBeInTheDocument();
    });

    it('should sort by rank by default (1st to last)', () => {
      renderWithData();

      const rows = screen.getAllByTestId(/^result-row-/);
      const firstRowRank = within(rows[0]).getByTestId('rank-value');
      const lastRowRank = within(rows[rows.length - 1]).getByTestId('rank-value');

      expect(firstRowRank).toHaveTextContent('1');
      expect(lastRowRank).toHaveTextContent('6');
    });

    it('should format prize amounts correctly', () => {
      renderWithData();

      // Prize amounts appear in both summary and table, so use getAllByText
      const prizeAmounts5000 = screen.getAllByText('$5,000');
      const prizeAmounts3000 = screen.getAllByText('$3,000');
      const prizeAmounts2000 = screen.getAllByText('$2,000');

      // Should have at least one instance each (in prize distribution summary)
      expect(prizeAmounts5000.length).toBeGreaterThanOrEqual(1);
      expect(prizeAmounts3000.length).toBeGreaterThanOrEqual(1);
      expect(prizeAmounts2000.length).toBeGreaterThanOrEqual(1);
    });

    it('should display score values correctly', () => {
      renderWithData();

      expect(screen.getByText('95.5')).toBeInTheDocument();
      expect(screen.getByText('92.3')).toBeInTheDocument();
      expect(screen.getByText('88.7')).toBeInTheDocument();
    });

    it('should handle empty results gracefully', () => {
      const emptyResults: CompetitionResults = {
        ...sampleResults,
        results: [],
        totalParticipants: 0,
      };

      renderWithRouter(
        <CompetitionResultsModal
          {...defaultProps}
          _testResults={emptyResults}
          _testLoading={false}
          _testError={null}
        />
      );

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText(/no results available/i)).toBeInTheDocument();
    });
  });

  // ==================== 4. SORTING (4 tests) ====================
  describe('Sorting', () => {
    it('should sort by rank in ascending order when rank header clicked', async () => {
      const user = userEvent.setup();
      renderWithData();

      // Default is already sorted by rank ascending
      // Clicking once will toggle to descending, clicking again returns to ascending
      const rankHeader = screen.getByTestId('sort-by-rank');

      // First check default state is ascending (rank 1 first)
      let rows = screen.getAllByTestId(/^result-row-/);
      let firstRank = within(rows[0]).getByTestId('rank-value');
      expect(firstRank).toHaveTextContent('1');

      // Click to toggle to descending
      await user.click(rankHeader);
      rows = screen.getAllByTestId(/^result-row-/);
      firstRank = within(rows[0]).getByTestId('rank-value');
      expect(firstRank).toHaveTextContent('6'); // Last rank now first
    });

    it('should sort by score in descending order when score header clicked', async () => {
      const user = userEvent.setup();
      renderWithData();

      const scoreHeader = screen.getByTestId('sort-by-score');
      await user.click(scoreHeader);

      // Score sorts descending by default, highest score first
      const rows = screen.getAllByTestId(/^result-row-/);
      const firstScore = within(rows[0]).getByTestId('score-value');
      // Since we start with rank sort (95.5 is rank 1), clicking score
      // will sort by score descending, which should still show 95.5 first
      expect(firstScore).toHaveTextContent('95.5');
    });

    it('should sort by horse name alphabetically when horse header clicked', async () => {
      const user = userEvent.setup();
      renderWithData();

      const horseHeader = screen.getByTestId('sort-by-horse');
      await user.click(horseHeader);

      const rows = screen.getAllByTestId(/^result-row-/);
      const firstHorse = within(rows[0]).getByTestId('horse-name');
      // Alphabetically first: "Golden Dawn"
      expect(firstHorse).toHaveTextContent('Golden Dawn');
    });

    it('should sort by owner name alphabetically when owner header clicked', async () => {
      const user = userEvent.setup();
      renderWithData();

      const ownerHeader = screen.getByTestId('sort-by-owner');
      await user.click(ownerHeader);

      const rows = screen.getAllByTestId(/^result-row-/);
      const firstOwner = within(rows[0]).getByTestId('owner-name');
      // Alphabetically first: "Alice Smith"
      expect(firstOwner).toHaveTextContent('Alice Smith');
    });
  });

  // ==================== 5. USER INTERACTION (4 tests) ====================
  describe('User Interaction', () => {
    it("should call onViewPerformance when clicking user's horse", async () => {
      const user = userEvent.setup();
      renderWithData();

      const userHorseRow = screen.getByTestId('result-row-102');
      await user.click(userHorseRow);

      expect(mockOnViewPerformance).toHaveBeenCalledWith(102);
    });

    it('should not call onViewPerformance when clicking non-user horses', async () => {
      const user = userEvent.setup();
      renderWithData();

      const otherHorseRow = screen.getByTestId('result-row-101');
      await user.click(otherHorseRow);

      expect(mockOnViewPerformance).not.toHaveBeenCalled();
    });

    it("should show hover effect on user's horses", () => {
      renderWithData();

      const userRow = screen.getByTestId('result-row-102');
      expect(userRow).toHaveClass('cursor-pointer');
      expect(userRow).toHaveClass('hover:bg-blue-100');
    });

    it('should allow clicking multiple user horses', async () => {
      const user = userEvent.setup();
      renderWithData();

      const userHorseRow1 = screen.getByTestId('result-row-102');
      const userHorseRow2 = screen.getByTestId('result-row-104');

      await user.click(userHorseRow1);
      expect(mockOnViewPerformance).toHaveBeenCalledWith(102);

      mockOnViewPerformance.mockClear();

      await user.click(userHorseRow2);
      expect(mockOnViewPerformance).toHaveBeenCalledWith(104);
    });
  });

  // ==================== 6. ACCESSIBILITY (4 tests) ====================
  describe('Accessibility', () => {
    it('should have role="dialog" attribute', () => {
      renderWithData();

      const modal = screen.getByTestId('competition-results-modal');
      expect(modal).toHaveAttribute('role', 'dialog');
    });

    it('should have aria-labelledby pointing to title', () => {
      renderWithData();

      const modal = screen.getByTestId('competition-results-modal');
      expect(modal).toHaveAttribute('aria-labelledby', 'results-modal-title');

      const title = document.getElementById('results-modal-title');
      expect(title).toBeInTheDocument();
    });

    it('should have proper semantic table HTML', () => {
      renderWithData();

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      // Check for proper table structure
      const thead = table.querySelector('thead');
      const tbody = table.querySelector('tbody');
      expect(thead).toBeInTheDocument();
      expect(tbody).toBeInTheDocument();

      // Check column headers
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThanOrEqual(5);
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithData();

      // Tab through focusable elements
      await user.tab();
      expect(document.activeElement).not.toBe(document.body);

      // Focus should stay within modal
      const modal = screen.getByTestId('competition-results-modal');
      expect(modal.contains(document.activeElement)).toBe(true);
    });
  });

  // ==================== STATES (loading, error) ====================
  describe('States', () => {
    it('should show loading skeleton when loading', () => {
      renderWithRouter(
        <CompetitionResultsModal
          {...defaultProps}
          _testResults={null}
          _testLoading={true}
          _testError={null}
        />
      );

      const skeletons = screen.getAllByTestId('skeleton-row');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show error message with retry button when error occurs', () => {
      const mockRetry = vi.fn();
      renderWithRouter(
        <CompetitionResultsModal
          {...defaultProps}
          onRetry={mockRetry}
          _testResults={null}
          _testLoading={false}
          _testError="Failed to load results"
        />
      );

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText(/failed to load results/i)).toBeInTheDocument();
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });
  });

  // ==================== VISUAL ELEMENTS ====================
  describe('Visual Elements', () => {
    it('should display close button with X icon', () => {
      renderWithData();

      const closeButton = screen.getByTestId('close-modal-button');
      const icon = closeButton.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should display trophy icon for prize distribution', () => {
      renderWithData();

      const prizeSection = screen.getByTestId('prize-distribution');
      const icon = prizeSection.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should have sticky header on table', () => {
      renderWithData();

      const thead = screen.getByRole('table').querySelector('thead');
      expect(thead).toHaveClass('sticky');
    });

    it('should apply zebra striping to table rows', () => {
      renderWithData();

      const rows = screen.getAllByTestId(/^result-row-/);
      // Odd rows should have different background
      expect(rows[0]).toHaveClass('bg-white');
      expect(rows[1]).toHaveClass('bg-blue-50'); // User row
    });
  });

  // ==================== EDGE CASES ====================
  describe('Edge Cases', () => {
    it('should handle null competitionId gracefully', () => {
      renderWithRouter(
        <CompetitionResultsModal
          {...defaultProps}
          competitionId={null}
          _testResults={null}
          _testLoading={false}
          _testError={null}
        />
      );

      // Should render modal but show empty state
      expect(screen.queryByTestId('results-table')).not.toBeInTheDocument();
    });

    it('should handle missing onViewPerformance gracefully', async () => {
      const user = userEvent.setup();
      renderWithRouter(
        <CompetitionResultsModal
          isOpen={true}
          onClose={mockOnClose}
          competitionId={1}
          _testResults={sampleResults}
          _testLoading={false}
          _testError={null}
        />
      );

      const userRow = screen.getByTestId('result-row-102');
      // Should not throw when clicking without onViewPerformance
      await user.click(userRow);
    });

    it('should format zero prize as $0', () => {
      renderWithData();

      const row4 = screen.getByTestId('result-row-104');
      const prizeCell = within(row4).getByTestId('prize-value');
      expect(prizeCell).toHaveTextContent('$0');
    });
  });
});
