/**
 * UserRankDashboard Component Tests
 *
 * Tests for the user rank dashboard component including:
 * - Dashboard renders with all rank summary cards
 * - "Best Rankings" section displays achievements
 * - Loading state shows skeleton cards
 * - Empty state handles new players gracefully
 * - Grid layout responsive classes (3/2/1 columns)
 * - Category click propagation to parent
 * - User name display
 * - Accessibility (ARIA labels, keyboard navigation)
 *
 * Story 5-5: Leaderboards - Task 3
 * Target: 13 tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserRankDashboard from '../UserRankDashboard';
import type { CategoryRanking, BestRanking } from '../UserRankDashboard';

/**
 * Mock rankings for testing across all categories.
 */
const mockRankings: CategoryRanking[] = [
  {
    category: 'level',
    categoryLabel: 'Horse Level',
    rank: 42,
    totalEntries: 1254,
    rankChange: 5,
    primaryStat: 15,
    statLabel: 'Level',
  },
  {
    category: 'prize-money',
    categoryLabel: 'Prize Money',
    rank: 8,
    totalEntries: 980,
    rankChange: -2,
    primaryStat: 125340,
    statLabel: 'Prize Money',
  },
  {
    category: 'win-rate',
    categoryLabel: 'Win Rate',
    rank: 23,
    totalEntries: 750,
    rankChange: 0,
    primaryStat: 82.5,
    statLabel: 'Win Rate %',
  },
  {
    category: 'discipline',
    categoryLabel: 'Best Discipline',
    rank: 15,
    totalEntries: 500,
    rankChange: 3,
    primaryStat: 88,
    statLabel: 'Score',
  },
  {
    category: 'owner',
    categoryLabel: 'Owner Leaderboard',
    rank: 112,
    totalEntries: 2000,
    rankChange: -8,
    primaryStat: 45000,
    statLabel: 'Total Earnings',
  },
  {
    category: 'recent-winners',
    categoryLabel: 'Recent Winners',
    rank: 5,
    totalEntries: 300,
    rankChange: 2,
    primaryStat: 3,
    statLabel: 'Wins',
  },
];

/**
 * Mock best rankings for achievements section.
 */
const mockBestRankings: BestRanking[] = [
  {
    category: 'prize-money',
    categoryLabel: 'Prize Money',
    rank: 8,
    achievement: 'Top 10',
  },
  {
    category: 'win-rate',
    categoryLabel: 'Win Rate',
    rank: 23,
    achievement: 'Top 100',
  },
];

describe('UserRankDashboard', () => {
  describe('Dashboard Rendering', () => {
    it('renders the user name in the dashboard header', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={mockBestRankings}
        />
      );
      expect(screen.getByText("John Doe's Rankings")).toBeInTheDocument();
    });

    it('renders a Trophy icon in the dashboard header', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={mockBestRankings}
        />
      );
      expect(screen.getByTestId('dashboard-header-icon')).toBeInTheDocument();
    });

    it('renders a RankSummaryCard for each category ranking', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={mockBestRankings}
        />
      );
      const cards = screen.getAllByTestId('rank-summary-card');
      expect(cards).toHaveLength(mockRankings.length);
    });

    it('displays all category labels in the summary cards', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={mockBestRankings}
        />
      );
      expect(screen.getByText('Horse Level')).toBeInTheDocument();
      expect(screen.getByText('Prize Money')).toBeInTheDocument();
      expect(screen.getByText('Win Rate')).toBeInTheDocument();
      expect(screen.getByText('Best Discipline')).toBeInTheDocument();
      expect(screen.getByText('Owner Leaderboard')).toBeInTheDocument();
      expect(screen.getByText('Recent Winners')).toBeInTheDocument();
    });
  });

  describe('Best Rankings Section', () => {
    it('renders the "Best Rankings" section header', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={mockBestRankings}
        />
      );
      expect(screen.getByText('Best Rankings')).toBeInTheDocument();
    });

    it('displays each best ranking with category, rank, and achievement', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={mockBestRankings}
        />
      );
      const bestSection = screen.getByTestId('best-rankings-section');
      expect(within(bestSection).getByText(/Top 10 in Prize Money/)).toBeInTheDocument();
      expect(within(bestSection).getByText(/Top 100 in Win Rate/)).toBeInTheDocument();
    });

    it('shows "No achievements yet" when bestRankings is empty', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={[]}
        />
      );
      expect(screen.getByText('No achievements yet')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('renders skeleton cards when isLoading is true', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={[]}
          bestRankings={[]}
          isLoading={true}
        />
      );
      const skeletons = screen.getAllByTestId('rank-summary-card-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('does not render rank summary cards when loading', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={mockBestRankings}
          isLoading={true}
        />
      );
      expect(screen.queryByTestId('rank-summary-card')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('renders empty state message when rankings array is empty and not loading', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={[]}
          bestRankings={[]}
        />
      );
      expect(screen.getByTestId('empty-rankings-state')).toBeInTheDocument();
      expect(screen.getByText(/no rankings yet/i)).toBeInTheDocument();
    });
  });

  describe('Grid Layout', () => {
    it('applies responsive grid classes for 3/2/1 column layout', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={mockBestRankings}
        />
      );
      const grid = screen.getByTestId('rankings-grid');
      expect(grid).toHaveClass('grid');
      expect(grid).toHaveClass('grid-cols-1');
      expect(grid).toHaveClass('md:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-3');
    });
  });

  describe('Category Click Propagation', () => {
    it('calls onCategoryClick with the category when a card is clicked', async () => {
      const user = userEvent.setup();
      const handleCategoryClick = vi.fn();
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={mockBestRankings}
          onCategoryClick={handleCategoryClick}
        />
      );

      // Click the first card (Horse Level)
      const cards = screen.getAllByTestId('rank-summary-card');
      await user.click(cards[0]);
      expect(handleCategoryClick).toHaveBeenCalledWith('level');
    });

    it('calls onCategoryClick with different categories for different cards', async () => {
      const user = userEvent.setup();
      const handleCategoryClick = vi.fn();
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={mockBestRankings}
          onCategoryClick={handleCategoryClick}
        />
      );

      // Click the second card (Prize Money)
      const cards = screen.getAllByTestId('rank-summary-card');
      await user.click(cards[1]);
      expect(handleCategoryClick).toHaveBeenCalledWith('prize-money');
    });
  });

  describe('Accessibility', () => {
    it('has an accessible heading for the dashboard', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={mockBestRankings}
        />
      );
      const heading = screen.getByRole('heading', { name: /John Doe's Rankings/i });
      expect(heading).toBeInTheDocument();
    });

    it('applies custom className when provided', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={mockBestRankings}
          className="my-dashboard-class"
        />
      );
      expect(screen.getByTestId('user-rank-dashboard')).toHaveClass('my-dashboard-class');
    });

    it('has an aria-label on the dashboard container', () => {
      render(
        <UserRankDashboard
          userId="user-1"
          userName="John Doe"
          rankings={mockRankings}
          bestRankings={mockBestRankings}
        />
      );
      const dashboard = screen.getByTestId('user-rank-dashboard');
      expect(dashboard).toHaveAttribute('aria-label', "John Doe's leaderboard rankings");
    });
  });
});
