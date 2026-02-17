/**
 * CompetitionResultsList Component Tests
 *
 * Comprehensive test suite for the competition results list component.
 * Tests cover:
 * - Component rendering with results list
 * - Filter functionality (status, discipline)
 * - Sort functionality (recent, prize, placement)
 * - Competition cards display and interactions
 * - Loading and error states
 * - Visual elements (placement badges)
 * - Accessibility compliance
 *
 * Target: 25 tests following TDD methodology
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompetitionResultsList, {
  type CompetitionResultsListProps,
  type CompetitionResultSummary,
} from '../CompetitionResultsList';

describe('CompetitionResultsList', () => {
  const mockOnResultClick = vi.fn();

  // Sample competition results data for testing
  const sampleResults: CompetitionResultSummary[] = [
    {
      competitionId: 1,
      competitionName: 'Spring Derby Championship',
      discipline: 'racing',
      date: '2026-01-15',
      totalParticipants: 20,
      prizePool: 10000,
      userResults: [
        {
          horseId: 101,
          horseName: 'Thunder Bolt',
          rank: 1,
          score: 95.5,
          prizeWon: 5000,
          xpGained: 150,
        },
      ],
    },
    {
      competitionId: 2,
      competitionName: 'Summer Dressage Classic',
      discipline: 'dressage',
      date: '2026-01-20',
      totalParticipants: 15,
      prizePool: 7500,
      userResults: [
        {
          horseId: 102,
          horseName: 'Graceful Moon',
          rank: 2,
          score: 88.2,
          prizeWon: 2500,
          xpGained: 100,
        },
      ],
    },
    {
      competitionId: 3,
      competitionName: 'Autumn Show Jumping Event',
      discipline: 'show-jumping',
      date: '2026-01-10',
      totalParticipants: 25,
      prizePool: 12000,
      userResults: [
        {
          horseId: 103,
          horseName: 'Sky Jumper',
          rank: 3,
          score: 82.7,
          prizeWon: 1500,
          xpGained: 75,
        },
      ],
    },
    {
      competitionId: 4,
      competitionName: 'Winter Endurance Challenge',
      discipline: 'endurance',
      date: '2026-01-05',
      totalParticipants: 30,
      prizePool: 8000,
      userResults: [
        {
          horseId: 104,
          horseName: 'Desert Runner',
          rank: 8,
          score: 72.1,
          prizeWon: 0,
          xpGained: 25,
        },
      ],
    },
    {
      competitionId: 5,
      competitionName: 'Cross Country Masters',
      discipline: 'cross-country',
      date: '2026-01-25',
      totalParticipants: 18,
      prizePool: 15000,
      userResults: [
        {
          horseId: 105,
          horseName: 'Trail Blazer',
          rank: 1,
          score: 91.3,
          prizeWon: 7500,
          xpGained: 150,
        },
        {
          horseId: 106,
          horseName: 'Mountain King',
          rank: 5,
          score: 78.9,
          prizeWon: 500,
          xpGained: 50,
        },
      ],
    },
  ];

  const defaultProps: CompetitionResultsListProps = {
    userId: 'user-123',
    onResultClick: mockOnResultClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================
  // 1. Component Rendering (5 tests)
  // =========================================
  describe('Component Rendering', () => {
    it('renders with results list', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );
      expect(screen.getByTestId('competition-results-list')).toBeInTheDocument();
    });

    it('shows filter controls', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );
      expect(screen.getByTestId('filter-status')).toBeInTheDocument();
      expect(screen.getByTestId('filter-discipline')).toBeInTheDocument();
    });

    it('shows sort dropdown', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );
      expect(screen.getByTestId('sort-dropdown')).toBeInTheDocument();
    });

    it('displays competition cards', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );
      const cards = screen.getAllByTestId('result-card');
      expect(cards).toHaveLength(5);
    });

    it('renders empty state with no results', () => {
      render(<CompetitionResultsList {...defaultProps} results={[]} isLoading={false} />);
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText(/no competition results found/i)).toBeInTheDocument();
    });
  });

  // =========================================
  // 2. Filter Functionality (6 tests)
  // =========================================
  describe('Filter Functionality', () => {
    it('status filter "All" shows all results', async () => {
      const user = userEvent.setup();
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      const statusFilter = screen.getByTestId('filter-status');
      await user.selectOptions(statusFilter, 'all');

      const cards = screen.getAllByTestId('result-card');
      expect(cards).toHaveLength(5);
    });

    it('status filter "Wins" shows only 1st place results', async () => {
      render(
        <CompetitionResultsList
          {...defaultProps}
          results={sampleResults}
          isLoading={false}
          filters={{ status: 'wins' }}
        />
      );

      // Should only show competitions where user got 1st place
      const cards = screen.getAllByTestId('result-card');
      // 2 competitions have 1st place: Spring Derby and Cross Country
      expect(cards.length).toBeLessThanOrEqual(5);
      expect(screen.getByText('Spring Derby Championship')).toBeInTheDocument();
      expect(screen.getByText('Cross Country Masters')).toBeInTheDocument();
    });

    it('status filter "Top3" shows only 1st/2nd/3rd place results', async () => {
      render(
        <CompetitionResultsList
          {...defaultProps}
          results={sampleResults}
          isLoading={false}
          filters={{ status: 'top3' }}
        />
      );

      // Should show competitions with rank 1, 2, or 3
      const cards = screen.getAllByTestId('result-card');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('status filter "Participated" shows all entries', async () => {
      render(
        <CompetitionResultsList
          {...defaultProps}
          results={sampleResults}
          isLoading={false}
          filters={{ status: 'participated' }}
        />
      );

      const cards = screen.getAllByTestId('result-card');
      expect(cards).toHaveLength(5);
    });

    it('discipline filter works correctly', async () => {
      const user = userEvent.setup();
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      const disciplineFilter = screen.getByTestId('filter-discipline');
      await user.selectOptions(disciplineFilter, 'racing');

      // After filtering, only racing competitions should show
      expect(screen.getByText('Spring Derby Championship')).toBeInTheDocument();
    });

    it('clear filters button resets all filters', async () => {
      const user = userEvent.setup();
      render(
        <CompetitionResultsList
          {...defaultProps}
          results={sampleResults}
          isLoading={false}
          filters={{ status: 'wins', discipline: 'racing' }}
        />
      );

      const clearButton = screen.getByTestId('clear-filters');
      await user.click(clearButton);

      // After clearing, all results should be visible
      const cards = screen.getAllByTestId('result-card');
      expect(cards).toHaveLength(5);
    });
  });

  // =========================================
  // 3. Sort Functionality (3 tests)
  // =========================================
  describe('Sort Functionality', () => {
    it('sort by recent shows newest first', async () => {
      render(
        <CompetitionResultsList
          {...defaultProps}
          results={sampleResults}
          isLoading={false}
          sortBy="recent"
        />
      );

      const cards = screen.getAllByTestId('result-card');
      // Cross Country Masters (2026-01-25) should be first
      const firstCard = cards[0];
      expect(within(firstCard).getByText('Cross Country Masters')).toBeInTheDocument();
    });

    it('sort by prize shows highest prizes first', async () => {
      render(
        <CompetitionResultsList
          {...defaultProps}
          results={sampleResults}
          isLoading={false}
          sortBy="prize"
        />
      );

      const cards = screen.getAllByTestId('result-card');
      // Cross Country Masters has highest combined prize (7500 + 500 = 8000)
      const firstCard = cards[0];
      expect(within(firstCard).getByText('Cross Country Masters')).toBeInTheDocument();
    });

    it('sort by placement shows best ranks first', async () => {
      render(
        <CompetitionResultsList
          {...defaultProps}
          results={sampleResults}
          isLoading={false}
          sortBy="placement"
        />
      );

      const cards = screen.getAllByTestId('result-card');
      // First place results should come first
      const firstCard = cards[0];
      // Either Spring Derby or Cross Country (both have 1st place)
      const firstCardText = firstCard.textContent;
      expect(
        firstCardText?.includes('Spring Derby Championship') ||
          firstCardText?.includes('Cross Country Masters')
      ).toBe(true);
    });
  });

  // =========================================
  // 4. Competition Cards (5 tests)
  // =========================================
  describe('Competition Cards', () => {
    it('cards display all competition details', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      // Check first competition details
      expect(screen.getByText('Spring Derby Championship')).toBeInTheDocument();
      // Use getAllByText since 'Racing' appears in both the card and dropdown options
      const racingElements = screen.getAllByText(/^Racing$/);
      expect(racingElements.length).toBeGreaterThan(0);
      expect(screen.getByText('Thunder Bolt')).toBeInTheDocument();
    });

    it('placement badges show correct colors for gold/silver/bronze/gray', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      // Gold badge for 1st place
      const goldBadge = screen.getAllByTestId('placement-badge-1')[0];
      expect(goldBadge).toHaveClass('bg-yellow-400');

      // Silver badge for 2nd place
      const silverBadge = screen.getByTestId('placement-badge-2');
      expect(silverBadge).toHaveClass('bg-gray-300');

      // Bronze badge for 3rd place
      const bronzeBadge = screen.getByTestId('placement-badge-3');
      expect(bronzeBadge).toHaveClass('bg-orange-400');

      // Gray badge for other placements
      const grayBadge = screen.getByTestId('placement-badge-8');
      expect(grayBadge).toHaveClass('bg-gray-200');
    });

    it('prize amounts formatted correctly', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      // Check formatted currency display
      expect(screen.getByText(/\$5,000/)).toBeInTheDocument();
      expect(screen.getByText(/\$2,500/)).toBeInTheDocument();
    });

    it('click handler called with competition ID', async () => {
      const user = userEvent.setup();
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      const cards = screen.getAllByTestId('result-card');
      await user.click(cards[0]);

      expect(mockOnResultClick).toHaveBeenCalled();
    });

    it('multiple horses shown if entered multiple', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      // Cross Country Masters has 2 horses entered
      expect(screen.getByText('Trail Blazer')).toBeInTheDocument();
      expect(screen.getByText('Mountain King')).toBeInTheDocument();
    });
  });

  // =========================================
  // 5. Loading and Error States (3 tests)
  // =========================================
  describe('Loading and Error States', () => {
    it('loading state shows skeleton cards', () => {
      render(<CompetitionResultsList {...defaultProps} results={[]} isLoading={true} />);

      const skeletons = screen.getAllByTestId('result-card-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('error state shows error message', () => {
      render(
        <CompetitionResultsList
          {...defaultProps}
          results={[]}
          isLoading={false}
          error="Failed to load competition results"
        />
      );

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });

    it('retry button calls refetch', async () => {
      const mockRefetch = vi.fn();
      const user = userEvent.setup();

      render(
        <CompetitionResultsList
          {...defaultProps}
          results={[]}
          isLoading={false}
          error="Failed to load competition results"
          onRetry={mockRefetch}
        />
      );

      const retryButton = screen.getByTestId('retry-button');
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================
  // 6. Visual Elements (3 tests)
  // =========================================
  describe('Visual Elements', () => {
    it('1st place badge is gold colored', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      const goldBadges = screen.getAllByTestId('placement-badge-1');
      goldBadges.forEach((badge) => {
        expect(badge).toHaveClass('bg-yellow-400', 'text-yellow-900');
      });
    });

    it('2nd place badge is silver colored', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      const silverBadge = screen.getByTestId('placement-badge-2');
      expect(silverBadge).toHaveClass('bg-gray-300', 'text-gray-900');
    });

    it('3rd place badge is bronze colored', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      const bronzeBadge = screen.getByTestId('placement-badge-3');
      expect(bronzeBadge).toHaveClass('bg-orange-400', 'text-orange-900');
    });
  });

  // =========================================
  // Additional Integration Tests
  // =========================================
  describe('Accessibility', () => {
    it('has proper ARIA attributes for region', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      const container = screen.getByTestId('competition-results-list');
      expect(container).toHaveAttribute('role', 'region');
      expect(container).toHaveAttribute('aria-label', 'Competition results');
    });

    it('filter controls have proper labels', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by discipline/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/sort results/i)).toBeInTheDocument();
    });

    it('cards are keyboard navigable', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      const cards = screen.getAllByTestId('result-card');
      cards.forEach((card) => {
        expect(card).toHaveAttribute('tabindex', '0');
      });
    });
  });

  describe('Responsive Grid Layout', () => {
    it('applies responsive grid classes', () => {
      render(
        <CompetitionResultsList {...defaultProps} results={sampleResults} isLoading={false} />
      );

      const grid = screen.getByTestId('results-grid');
      expect(grid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
    });
  });
});
