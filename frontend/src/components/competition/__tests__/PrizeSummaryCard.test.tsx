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

  // Sample horse prize data for testing
  const samplePrizes: HorsePrize[] = [
    {
      horseId: 101,
      horseName: 'Thunder Bolt',
      placement: 1,
      prizeMoney: 5000,
    },
    {
      horseId: 102,
      horseName: 'Lightning Flash',
      placement: 2,
      prizeMoney: 2500,
    },
    {
      horseId: 103,
      horseName: 'Storm Chaser',
      placement: 3,
      prizeMoney: 1000,
    },
    {
      horseId: 104,
      horseName: 'Wind Runner',
      placement: 8,
      prizeMoney: 0,
    },
  ];

  // Default props with 1st place finish
  const defaultProps: PrizeSummaryCardProps = {
    competitionId: 1,
    competitionName: 'Spring Derby Championship',
    date: '2026-01-25',
    prizes: samplePrizes,
    onToggleExpand: mockOnToggleExpand,
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
      },
      {
        horseId: 103,
        horseName: 'Storm Chaser',
        placement: 5,
        prizeMoney: 500,
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
      },
      {
        horseId: 104,
        horseName: 'Wind Runner',
        placement: 6,
        prizeMoney: 200,
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
      },
      {
        horseId: 105,
        horseName: 'Cloud Dancer',
        placement: 12,
        prizeMoney: 0,
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

    // Old contract (controller ruling, fix round 1, 2026-10-15): with the XP tile
    // removed (R7), two tiles filled the stats row. Owner ruling 2026-10-23
    // (Equoria-m3yq1): the third slot shows the Horse Points earned.
    it('lays three summary tiles across the stats row: prize, placed, Horse Points', () => {
      render(<PrizeSummaryCard {...defaultProps} />);

      const row = screen.getByTestId('placed-count').closest('.grid');
      expect(row).toHaveClass('grid-cols-3');
      expect(row?.children).toHaveLength(3);
      expect(row).toContainElement(screen.getByTestId('total-horse-points'));
    });

    it('shows the Horse Points the placings recorded, summed', () => {
      render(
        <PrizeSummaryCard
          {...defaultProps}
          prizes={[
            {
              horseId: 101,
              horseName: 'Thunder Bolt',
              placement: 1,
              prizeMoney: 5000,
              horsePointsAwarded: 10,
            },
            {
              horseId: 102,
              horseName: 'Lightning Flash',
              placement: 2,
              prizeMoney: 2500,
              horsePointsAwarded: 5,
            },
            {
              horseId: 103,
              horseName: 'Storm Chaser',
              placement: 3,
              prizeMoney: 1000,
              horsePointsAwarded: 3,
            },
          ]}
        />
      );

      const tile = screen.getByTestId('total-horse-points').closest('div.text-center');
      expect(tile).toHaveTextContent('Horse Points');
      expect(screen.getByTestId('total-horse-points')).toHaveTextContent(/^18$/);
    });

    it('shows an em dash, never a partial sum, when a placing recorded no Horse Points', () => {
      render(
        <PrizeSummaryCard
          {...defaultProps}
          prizes={[
            {
              horseId: 101,
              horseName: 'Thunder Bolt',
              placement: 1,
              prizeMoney: 5000,
              horsePointsAwarded: 10,
            },
            {
              horseId: 102,
              horseName: 'Lightning Flash',
              placement: 2,
              prizeMoney: 2500,
              horsePointsAwarded: null,
            },
          ]}
        />
      );

      expect(screen.getByTestId('total-horse-points')).toHaveTextContent(/^—$/);
    });

    it('shows total prize money with currency formatting', () => {
      render(<PrizeSummaryCard {...defaultProps} />);

      // Total: 5000 + 2500 + 1000 + 0 = 8500
      expect(screen.getByTestId('total-prize-money')).toHaveTextContent('8,500');
      expect(screen.getByTestId('total-prize-money')).not.toHaveTextContent('$');
    });

    // Owner ruling R7 (2026-10-15, Equoria-q4uem.10): the "XP" here was
    // invented (prize ÷ 10). Old contract: a total-XP tile reading 350.
    it('shows no XP total or per-horse XP figure', () => {
      render(<PrizeSummaryCard {...expandedProps} />);

      expect(screen.queryByTestId('total-xp')).not.toBeInTheDocument();
      expect(screen.queryByText(/\bXP\b/)).not.toBeInTheDocument();
      // Thunder's entry shows its 5,000 prize and nothing else numeric.
      expect(screen.getAllByTestId('horse-prize-entry')[0]).toHaveTextContent(/^.*Thunder.*5,000$/);
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
      // Gold styling uses gold-primary tokenized colors
      expect(card).toHaveClass('bg-[var(--alpha-gold-primary-10)]');
      expect(card).toHaveClass('border-[var(--alpha-gold-primary-50)]');
    });

    it('has silver styling when best placement is 2nd', () => {
      render(<PrizeSummaryCard {...secondPlaceProps} />);

      const card = screen.getByTestId('prize-summary-card');
      // Silver styling uses slate-tinted background per design tokens
      expect(card).toHaveClass('bg-slate-400/10');
      expect(card).toHaveClass('border-slate-400/40');
    });

    it('has bronze styling when best placement is 3rd', () => {
      render(<PrizeSummaryCard {...thirdPlaceProps} />);

      const card = screen.getByTestId('prize-summary-card');
      // Bronze styling uses orange-tinted tokens
      expect(card).toHaveClass('bg-[rgba(180,83,9,0.1)]');
      expect(card).toHaveClass('border-orange-500/40');
    });

    it('has default styling when no placements (participation only)', () => {
      render(<PrizeSummaryCard {...participationOnlyProps} />);

      const card = screen.getByTestId('prize-summary-card');
      // Default (participation-only) styling uses translucent blue tokens
      expect(card).toHaveClass('bg-[rgba(37,99,235,0.1)]');
      expect(card).toHaveClass('border-[rgba(37,99,235,0.3)]');
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
      expect(within(firstEntry).getByText(/5,000/)).toBeInTheDocument();
    });

    // Owner ruling R5 (2026-10-15, Equoria-q4uem.10): no score breakdown, so the
    // "view performance" action is deleted. Old contract: entries were buttons
    // that called onViewPerformance(horseId).
    it('horse entries are plain rows with no performance action', () => {
      render(<PrizeSummaryCard {...expandedProps} />);

      for (const entry of screen.getAllByTestId('horse-prize-entry')) {
        expect(entry).not.toHaveAttribute('role', 'button');
        expect(entry).not.toHaveAttribute('tabindex');
      }
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
      expect(screen.getByTestId('total-prize-money')).toHaveTextContent('0');
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

      expect(screen.getByTestId('total-prize-money')).toHaveTextContent('1,500,000');
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
