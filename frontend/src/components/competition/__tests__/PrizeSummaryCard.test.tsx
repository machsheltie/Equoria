/**
 * PrizeSummaryCard Component Tests
 *
 * Comprehensive test suite for the prize summary card component.
 * Tests cover:
 * - Component rendering with all summary elements
 * - Color-coded design based on best placement
 * - Expand/collapse functionality
 * - Per-horse breakdown display
 * - Visual elements (icons and badges)
 * - Edge cases and accessibility
 *
 * Target: 22 tests following TDD methodology
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrizeSummaryCard, { type PrizeSummaryCardProps, type HorsePrize } from '../PrizeSummaryCard';

describe('PrizeSummaryCard', () => {
  const mockOnToggleExpand = vi.fn();
  const mockOnViewPerformance = vi.fn();

  // Sample horse prize data for testing
  const samplePrizes: HorsePrize[] = [
    {
      horseId: 101,
      horseName: 'Thunder Bolt',
      placement: 1,
      prizeMoney: 5000,
      xpGained: 150,
    },
    {
      horseId: 102,
      horseName: 'Lightning Flash',
      placement: 2,
      prizeMoney: 2500,
      xpGained: 100,
    },
    {
      horseId: 103,
      horseName: 'Storm Chaser',
      placement: 3,
      prizeMoney: 1000,
      xpGained: 75,
    },
    {
      horseId: 104,
      horseName: 'Wind Runner',
      placement: 8,
      prizeMoney: 0,
      xpGained: 25,
    },
  ];

  // Default props with 1st place finish
  const defaultProps: PrizeSummaryCardProps = {
    competitionId: 1,
    competitionName: 'Spring Derby Championship',
    date: '2026-01-25',
    prizes: samplePrizes,
    onToggleExpand: mockOnToggleExpand,
    onViewPerformance: mockOnViewPerformance,
  };

  // Props with only 2nd place as best
  const secondPlaceProps: PrizeSummaryCardProps = {
    ...defaultProps,
    prizes: [
      {
        horseId: 102,
        horseName: 'Lightning Flash',
        placement: 2,
        prizeMoney: 2500,
        xpGained: 100,
      },
      {
        horseId: 103,
        horseName: 'Storm Chaser',
        placement: 5,
        prizeMoney: 500,
        xpGained: 50,
      },
    ],
  };

  // Props with only 3rd place as best
  const thirdPlaceProps: PrizeSummaryCardProps = {
    ...defaultProps,
    prizes: [
      {
        horseId: 103,
        horseName: 'Storm Chaser',
        placement: 3,
        prizeMoney: 1000,
        xpGained: 75,
      },
      {
        horseId: 104,
        horseName: 'Wind Runner',
        placement: 6,
        prizeMoney: 200,
        xpGained: 30,
      },
    ],
  };

  // Props with no placements (participation only)
  const participationOnlyProps: PrizeSummaryCardProps = {
    ...defaultProps,
    prizes: [
      {
        horseId: 104,
        horseName: 'Wind Runner',
        placement: 8,
        prizeMoney: 0,
        xpGained: 25,
      },
      {
        horseId: 105,
        horseName: 'Cloud Dancer',
        placement: 12,
        prizeMoney: 0,
        xpGained: 15,
      },
    ],
  };

  // Props with empty prizes array
  const emptyPrizesProps: PrizeSummaryCardProps = {
    ...defaultProps,
    prizes: [],
  };

  // Props with large amounts
  const largePrizesProps: PrizeSummaryCardProps = {
    ...defaultProps,
    prizes: [
      {
        horseId: 101,
        horseName: 'Million Dollar Horse',
        placement: 1,
        prizeMoney: 1500000,
        xpGained: 5000,
      },
    ],
  };

  // Props in expanded state
  const expandedProps: PrizeSummaryCardProps = {
    ...defaultProps,
    isExpanded: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================
  // 1. Rendering Tests (6 tests)
  // =========================================
  describe('Rendering Tests', () => {
    it('renders card with competition name', () => {
      render(<PrizeSummaryCard {...defaultProps} />);

      expect(screen.getByTestId('prize-summary-card')).toBeInTheDocument();
      expect(screen.getByText('Spring Derby Championship')).toBeInTheDocument();
    });

    it('displays formatted date', () => {
      render(<PrizeSummaryCard {...defaultProps} />);

      // Should format date as "Jan 2X, 2026" (timezone may vary)
      // Accept Jan 24 or Jan 25 due to timezone differences
      expect(screen.getByText(/Jan 2[45], 2026/)).toBeInTheDocument();
    });

    it('shows total prize money with currency formatting', () => {
      render(<PrizeSummaryCard {...defaultProps} />);

      // Total: 5000 + 2500 + 1000 + 0 = 8500
      expect(screen.getByTestId('total-prize-money')).toHaveTextContent('$8,500');
    });

    it('shows total XP with proper formatting', () => {
      render(<PrizeSummaryCard {...defaultProps} />);

      // Total: 150 + 100 + 75 + 25 = 350
      expect(screen.getByTestId('total-xp')).toHaveTextContent('350');
      expect(screen.getByText(/XP/)).toBeInTheDocument();
    });

    it('shows number of placed horses', () => {
      render(<PrizeSummaryCard {...defaultProps} />);

      // 3 horses placed (1st, 2nd, 3rd)
      expect(screen.getByTestId('placed-count')).toHaveTextContent('3');
    });

    it('shows best placement text', () => {
      render(<PrizeSummaryCard {...defaultProps} />);

      // Best placement is 1st
      expect(screen.getByTestId('best-placement')).toHaveTextContent(/1st/);
    });
  });

  // =========================================
  // 2. Color Coding Tests (4 tests)
  // =========================================
  describe('Color Coding Tests', () => {
    it('has gold styling when any horse placed 1st', () => {
      render(<PrizeSummaryCard {...defaultProps} />);

      const card = screen.getByTestId('prize-summary-card');
      expect(card).toHaveClass('bg-yellow-50');
      expect(card).toHaveClass('border-yellow-300');
    });

    it('has silver styling when best placement is 2nd', () => {
      render(<PrizeSummaryCard {...secondPlaceProps} />);

      const card = screen.getByTestId('prize-summary-card');
      expect(card).toHaveClass('bg-gray-50');
      expect(card).toHaveClass('border-gray-300');
    });

    it('has bronze styling when best placement is 3rd', () => {
      render(<PrizeSummaryCard {...thirdPlaceProps} />);

      const card = screen.getByTestId('prize-summary-card');
      expect(card).toHaveClass('bg-orange-50');
      expect(card).toHaveClass('border-orange-300');
    });

    it('has default styling when no placements (participation only)', () => {
      render(<PrizeSummaryCard {...participationOnlyProps} />);

      const card = screen.getByTestId('prize-summary-card');
      expect(card).toHaveClass('bg-blue-50');
      expect(card).toHaveClass('border-blue-300');
    });
  });

  // =========================================
  // 3. Expand/Collapse Tests (4 tests)
  // =========================================
  describe('Expand/Collapse Tests', () => {
    it('starts in collapsed state by default', () => {
      render(<PrizeSummaryCard {...defaultProps} />);

      // Horse breakdown should not be visible in collapsed state
      expect(screen.queryByTestId('horse-breakdown-list')).not.toBeInTheDocument();
    });

    it('toggle button shows ChevronDown when collapsed', () => {
      render(<PrizeSummaryCard {...defaultProps} isExpanded={false} />);

      const toggleButton = screen.getByTestId('expand-toggle');
      expect(toggleButton).toBeInTheDocument();
      expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
    });

    it('toggle button shows ChevronUp when expanded', () => {
      render(<PrizeSummaryCard {...expandedProps} />);

      const toggleButton = screen.getByTestId('expand-toggle');
      expect(toggleButton).toBeInTheDocument();
      expect(screen.getByTestId('chevron-up-icon')).toBeInTheDocument();
    });

    it('clicking toggle button calls onToggleExpand', async () => {
      const user = userEvent.setup();
      render(<PrizeSummaryCard {...defaultProps} />);

      const toggleButton = screen.getByTestId('expand-toggle');
      await user.click(toggleButton);

      expect(mockOnToggleExpand).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================
  // 4. Horse Breakdown Tests (3 tests)
  // =========================================
  describe('Horse Breakdown Tests', () => {
    it('expanded state shows all horses', () => {
      render(<PrizeSummaryCard {...expandedProps} />);

      const breakdownList = screen.getByTestId('horse-breakdown-list');
      expect(breakdownList).toBeInTheDocument();

      const horseEntries = screen.getAllByTestId('horse-prize-entry');
      expect(horseEntries).toHaveLength(4); // 4 horses in samplePrizes
    });

    it('each horse entry displays correct data', () => {
      render(<PrizeSummaryCard {...expandedProps} />);

      const horseEntries = screen.getAllByTestId('horse-prize-entry');
      const firstEntry = horseEntries[0];

      // Check first horse (Thunder Bolt - 1st place)
      expect(within(firstEntry).getByText('Thunder Bolt')).toBeInTheDocument();
      expect(within(firstEntry).getByText(/1st/)).toBeInTheDocument();
      expect(within(firstEntry).getByText(/\$5,000/)).toBeInTheDocument();
      expect(within(firstEntry).getByText(/150/)).toBeInTheDocument();
    });

    it('horse entries are clickable when onViewPerformance provided', async () => {
      const user = userEvent.setup();
      render(<PrizeSummaryCard {...expandedProps} />);

      const horseEntries = screen.getAllByTestId('horse-prize-entry');
      await user.click(horseEntries[0]);

      expect(mockOnViewPerformance).toHaveBeenCalledWith(101); // horseId of Thunder Bolt
    });
  });

  // =========================================
  // 5. Visual Elements Tests (2 tests)
  // =========================================
  describe('Visual Elements Tests', () => {
    it('shows trophy icon for 1st place horses', () => {
      render(<PrizeSummaryCard {...expandedProps} />);

      // Find trophy icons in expanded state
      const trophyIcons = screen.getAllByTestId('trophy-icon');
      expect(trophyIcons.length).toBeGreaterThanOrEqual(1);
    });

    it('shows medal icons for 2nd/3rd place horses', () => {
      render(<PrizeSummaryCard {...expandedProps} />);

      // Find medal icons for 2nd and 3rd place
      const medalIcons = screen.getAllByTestId('medal-icon');
      expect(medalIcons.length).toBe(2); // 2nd and 3rd place
    });
  });

  // =========================================
  // 6. Edge Cases Tests (3 tests)
  // =========================================
  describe('Edge Cases Tests', () => {
    it('handles empty prizes array gracefully', () => {
      render(<PrizeSummaryCard {...emptyPrizesProps} />);

      expect(screen.getByTestId('prize-summary-card')).toBeInTheDocument();
      expect(screen.getByTestId('total-prize-money')).toHaveTextContent('$0');
      expect(screen.getByTestId('total-xp')).toHaveTextContent('0');
      expect(screen.getByTestId('placed-count')).toHaveTextContent('0');
      expect(screen.getByTestId('best-placement')).toHaveTextContent('-');
    });

    it('handles missing onToggleExpand (uncontrolled mode)', async () => {
      const user = userEvent.setup();
      // Render without onToggleExpand - should manage state internally
      render(
        <PrizeSummaryCard
          competitionId={1}
          competitionName="Test Competition"
          date="2026-01-25"
          prizes={samplePrizes}
        />
      );

      const toggleButton = screen.getByTestId('expand-toggle');

      // Click to expand
      await user.click(toggleButton);

      // Should show horse breakdown without callback
      expect(screen.getByTestId('horse-breakdown-list')).toBeInTheDocument();
    });

    it('handles large prize amounts correctly', () => {
      render(<PrizeSummaryCard {...largePrizesProps} />);

      expect(screen.getByTestId('total-prize-money')).toHaveTextContent('$1,500,000');
      expect(screen.getByTestId('total-xp')).toHaveTextContent('5,000');
    });
  });

  // =========================================
  // Additional Tests
  // =========================================
  describe('Accessibility', () => {
    it('has proper ARIA attributes for main container', () => {
      render(<PrizeSummaryCard {...defaultProps} />);

      const container = screen.getByTestId('prize-summary-card');
      expect(container).toHaveAttribute('role', 'region');
      expect(container).toHaveAttribute('aria-label', 'Prize summary');
    });

    it('expand toggle button has accessible label', () => {
      render(<PrizeSummaryCard {...defaultProps} />);

      const toggleButton = screen.getByTestId('expand-toggle');
      expect(toggleButton).toHaveAttribute('aria-label');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
