/**
 * CompetitionHistory Component Tests
 *
 * Comprehensive test suite for the competition history component.
 * Tests cover:
 * - Component rendering with statistics and list
 * - Statistics display and formatting
 * - Filter functionality (discipline, date range, placement)
 * - Competition entries display
 * - Loading, empty, and error states
 * - Accessibility compliance
 *
 * Target: 20 tests following TDD methodology
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompetitionHistory, {
  type CompetitionHistoryProps,
  type CompetitionHistoryData,
  type CompetitionEntry,
} from '../CompetitionHistory';

describe('CompetitionHistory', () => {
  const mockOnViewResults = vi.fn();
  const mockOnViewPerformance = vi.fn();
  const mockOnRetry = vi.fn();

  // Sample competition entries data for testing
  const sampleCompetitions: CompetitionEntry[] = [
    {
      competitionId: 1,
      competitionName: 'Spring Derby Championship',
      discipline: 'racing',
      date: '2026-01-25',
      rank: 1,
      totalParticipants: 20,
      score: 95.5,
      prizeWon: 5000,
      xpGained: 150,
    },
    {
      competitionId: 2,
      competitionName: 'Summer Dressage Classic',
      discipline: 'dressage',
      date: '2026-01-20',
      rank: 2,
      totalParticipants: 15,
      score: 88.2,
      prizeWon: 2500,
      xpGained: 100,
    },
    {
      competitionId: 3,
      competitionName: 'Autumn Show Jumping Event',
      discipline: 'show-jumping',
      date: '2026-01-15',
      rank: 3,
      totalParticipants: 25,
      score: 82.7,
      prizeWon: 1500,
      xpGained: 75,
    },
    {
      competitionId: 4,
      competitionName: 'Winter Endurance Challenge',
      discipline: 'endurance',
      date: '2026-01-10',
      rank: 8,
      totalParticipants: 30,
      score: 72.1,
      prizeWon: 0,
      xpGained: 25,
    },
    {
      competitionId: 5,
      competitionName: 'Cross Country Masters',
      discipline: 'cross-country',
      date: '2026-01-05',
      rank: 1,
      totalParticipants: 18,
      score: 91.3,
      prizeWon: 7500,
      xpGained: 150,
    },
    {
      competitionId: 6,
      competitionName: 'New Year Racing Classic',
      discipline: 'racing',
      date: '2025-12-01',
      rank: 5,
      totalParticipants: 22,
      score: 78.4,
      prizeWon: 500,
      xpGained: 50,
    },
  ];

  // Sample statistics data
  const sampleStatistics = {
    totalCompetitions: 6,
    wins: 2,
    top3Finishes: 3,
    winRate: 33.33,
    totalPrizeMoney: 17000,
    averagePlacement: 3.3,
    bestPlacement: 1,
  };

  // Full sample data
  const sampleData: CompetitionHistoryData = {
    horseId: 101,
    horseName: 'Thunder Bolt',
    statistics: sampleStatistics,
    competitions: sampleCompetitions,
  };

  const defaultProps: CompetitionHistoryProps = {
    horseId: 101,
    horseName: 'Thunder Bolt',
    onViewResults: mockOnViewResults,
    onViewPerformance: mockOnViewPerformance,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================
  // 1. Component Rendering (4 tests)
  // =========================================
  describe('Component Rendering', () => {
    it('renders with horse name header', () => {
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      expect(screen.getByTestId('competition-history')).toBeInTheDocument();
      expect(screen.getByText('Thunder Bolt')).toBeInTheDocument();
      expect(screen.getByText(/competition history/i)).toBeInTheDocument();
    });

    it('displays statistics summary card', () => {
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      expect(screen.getByTestId('statistics-card')).toBeInTheDocument();
    });

    it('shows filter controls', () => {
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      expect(screen.getByTestId('filter-discipline')).toBeInTheDocument();
      expect(screen.getByTestId('filter-date-range')).toBeInTheDocument();
      expect(screen.getByTestId('filter-placement')).toBeInTheDocument();
    });

    it('renders competition history list', () => {
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      expect(screen.getByTestId('competition-list')).toBeInTheDocument();
      const entries = screen.getAllByTestId('competition-entry');
      expect(entries).toHaveLength(6);
    });
  });

  // =========================================
  // 2. Statistics Display (4 tests)
  // =========================================
  describe('Statistics Display', () => {
    it('displays all statistics correctly', () => {
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      // Total Competitions
      expect(screen.getByTestId('stat-total-competitions')).toHaveTextContent('6');

      // Wins
      expect(screen.getByTestId('stat-wins')).toHaveTextContent('2');

      // Top 3 Finishes
      expect(screen.getByTestId('stat-top3')).toHaveTextContent('3');

      // Best Placement
      expect(screen.getByTestId('stat-best-placement')).toHaveTextContent('1');
    });

    it('formats win rate as percentage', () => {
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      const winRateStat = screen.getByTestId('stat-win-rate');
      expect(winRateStat).toHaveTextContent('33.3%');
    });

    it('formats total prize money as currency', () => {
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      const prizeStat = screen.getByTestId('stat-total-prize');
      expect(prizeStat).toHaveTextContent('$17,000');
    });

    it('shows average placement with 1 decimal place', () => {
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      const avgStat = screen.getByTestId('stat-avg-placement');
      expect(avgStat).toHaveTextContent('3.3');
    });
  });

  // =========================================
  // 3. Filter Functionality (5 tests)
  // =========================================
  describe('Filter Functionality', () => {
    it('discipline filter works correctly', async () => {
      const user = userEvent.setup();
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      const disciplineFilter = screen.getByTestId('filter-discipline');
      await user.selectOptions(disciplineFilter, 'racing');

      // Should only show racing competitions (2 entries)
      const entries = screen.getAllByTestId('competition-entry');
      expect(entries).toHaveLength(2);
      expect(screen.getByText('Spring Derby Championship')).toBeInTheDocument();
      expect(screen.getByText('New Year Racing Classic')).toBeInTheDocument();
    });

    it('date range filter works correctly', async () => {
      const user = userEvent.setup();
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      const dateFilter = screen.getByTestId('filter-date-range');
      await user.selectOptions(dateFilter, 'last-month');

      // Should filter to competitions within last month
      // All entries from 2026-01 should show (5 entries), excluding 2025-12 (1 entry)
      const entries = screen.getAllByTestId('competition-entry');
      expect(entries.length).toBeLessThan(6);
    });

    it('placement filter works correctly', async () => {
      const user = userEvent.setup();
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      const placementFilter = screen.getByTestId('filter-placement');
      await user.selectOptions(placementFilter, 'wins');

      // Should only show 1st place finishes (2 entries)
      const entries = screen.getAllByTestId('competition-entry');
      expect(entries).toHaveLength(2);
    });

    it('multiple filters work together', async () => {
      const user = userEvent.setup();
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      // Apply placement filter first
      const placementFilter = screen.getByTestId('filter-placement');
      await user.selectOptions(placementFilter, 'top3');

      // Then apply discipline filter
      const disciplineFilter = screen.getByTestId('filter-discipline');
      await user.selectOptions(disciplineFilter, 'racing');

      // Should only show racing competitions with top 3 finishes (1 entry - 1st place racing)
      const entries = screen.getAllByTestId('competition-entry');
      expect(entries).toHaveLength(1);
      expect(screen.getByText('Spring Derby Championship')).toBeInTheDocument();
    });

    it('clear filters resets all', async () => {
      const user = userEvent.setup();
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      // Apply some filters
      const disciplineFilter = screen.getByTestId('filter-discipline');
      await user.selectOptions(disciplineFilter, 'racing');

      const placementFilter = screen.getByTestId('filter-placement');
      await user.selectOptions(placementFilter, 'wins');

      // Clear filters
      const clearButton = screen.getByTestId('clear-filters');
      await user.click(clearButton);

      // All entries should be visible again
      const entries = screen.getAllByTestId('competition-entry');
      expect(entries).toHaveLength(6);
    });
  });

  // =========================================
  // 4. Competition Entries (3 tests)
  // =========================================
  describe('Competition Entries', () => {
    it('displays entries in chronological order (recent first)', () => {
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      const entries = screen.getAllByTestId('competition-entry');

      // First entry should be most recent (2026-01-25)
      const firstEntry = entries[0];
      expect(within(firstEntry).getByText('Spring Derby Championship')).toBeInTheDocument();

      // Last entry should be oldest (2025-12-01)
      const lastEntry = entries[entries.length - 1];
      expect(within(lastEntry).getByText('New Year Racing Classic')).toBeInTheDocument();
    });

    it('placement badges match ranks correctly', () => {
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      // Gold badge for 1st place
      const goldBadges = screen.getAllByTestId('placement-badge-1');
      expect(goldBadges.length).toBeGreaterThan(0);
      goldBadges.forEach((badge) => {
        expect(badge).toHaveClass('bg-yellow-400');
      });

      // Silver badge for 2nd place
      const silverBadge = screen.getByTestId('placement-badge-2');
      expect(silverBadge).toHaveClass('bg-gray-300');

      // Bronze badge for 3rd place
      const bronzeBadge = screen.getByTestId('placement-badge-3');
      expect(bronzeBadge).toHaveClass('bg-orange-400');
    });

    it('click on entry calls onViewResults callback', async () => {
      const user = userEvent.setup();
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      const entries = screen.getAllByTestId('competition-entry');
      await user.click(entries[0]);

      expect(mockOnViewResults).toHaveBeenCalledWith(1); // competitionId of first entry
    });

    it('view performance button calls onViewPerformance callback', async () => {
      const user = userEvent.setup();
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      const performanceButtons = screen.getAllByTestId('view-performance-btn');
      await user.click(performanceButtons[0]);

      expect(mockOnViewPerformance).toHaveBeenCalledWith(1, 101); // competitionId, horseId
    });
  });

  // =========================================
  // 5. States (4 tests)
  // =========================================
  describe('States', () => {
    it('loading state shows skeletons', () => {
      render(<CompetitionHistory {...defaultProps} isLoading={true} />);

      const skeletons = screen.getAllByTestId('entry-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('empty state shows encouraging message', () => {
      const emptyData: CompetitionHistoryData = {
        horseId: 101,
        horseName: 'Thunder Bolt',
        statistics: {
          totalCompetitions: 0,
          wins: 0,
          top3Finishes: 0,
          winRate: 0,
          totalPrizeMoney: 0,
          averagePlacement: 0,
          bestPlacement: 0,
        },
        competitions: [],
      };

      render(<CompetitionHistory {...defaultProps} data={emptyData} isLoading={false} />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText(/no competition history yet/i)).toBeInTheDocument();
      // Should have encouraging message
      expect(screen.getByText(/enter.*first competition/i)).toBeInTheDocument();
    });

    it('filtered empty state shows different message', async () => {
      const user = userEvent.setup();
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      // Apply a filter that will result in no matches
      const disciplineFilter = screen.getByTestId('filter-discipline');
      await user.selectOptions(disciplineFilter, 'polo'); // No polo competitions

      expect(screen.getByTestId('filtered-empty-state')).toBeInTheDocument();
      expect(screen.getByText(/no competitions match your filters/i)).toBeInTheDocument();
    });

    it('error state shows retry button', async () => {
      const user = userEvent.setup();
      render(
        <CompetitionHistory
          {...defaultProps}
          isLoading={false}
          error="Failed to load competition history"
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();

      const retryButton = screen.getByTestId('retry-button');
      await user.click(retryButton);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================
  // Additional Tests
  // =========================================
  describe('Accessibility', () => {
    it('has proper ARIA attributes for main container', () => {
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      const container = screen.getByTestId('competition-history');
      expect(container).toHaveAttribute('role', 'region');
      expect(container).toHaveAttribute('aria-label', 'Competition history');
    });

    it('filter controls have proper labels', () => {
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      expect(screen.getByLabelText(/filter by discipline/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by date range/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by placement/i)).toBeInTheDocument();
    });
  });

  describe('Entry Details Display', () => {
    it('displays all entry information correctly', () => {
      render(<CompetitionHistory {...defaultProps} data={sampleData} isLoading={false} />);

      const entries = screen.getAllByTestId('competition-entry');
      const firstEntry = entries[0];

      // Competition name
      expect(within(firstEntry).getByText('Spring Derby Championship')).toBeInTheDocument();

      // Discipline badge
      expect(within(firstEntry).getByTestId('discipline-badge')).toBeInTheDocument();

      // Score
      expect(within(firstEntry).getByText(/95\.5/)).toBeInTheDocument();

      // Prize won
      expect(within(firstEntry).getByText(/\$5,000/)).toBeInTheDocument();

      // XP gained
      expect(within(firstEntry).getByText(/150/)).toBeInTheDocument();
      expect(within(firstEntry).getByText(/XP/i)).toBeInTheDocument();
    });
  });
});
