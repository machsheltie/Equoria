/**
 * RankSummaryCard Component Tests
 *
 * Tests for the rank summary card component including:
 * - Card display with all data (category, rank, stat)
 * - Rank change indicators (up green, down red, no change gray)
 * - Achievement badges for top 10 and top 100
 * - Click callback handling
 * - Loading state (skeleton)
 * - Hover styles (clickable vs non-clickable)
 * - Accessibility (aria-label, role)
 *
 * Story 5-5: Leaderboards - Task 3
 * Target: 12 tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RankSummaryCard from '../RankSummaryCard';
import type { CategoryRanking } from '../RankSummaryCard';

/**
 * Factory function to create a test ranking with sensible defaults.
 */
const createRanking = (overrides: Partial<CategoryRanking> = {}): CategoryRanking => ({
  category: 'level',
  categoryLabel: 'Horse Level',
  rank: 42,
  totalEntries: 1254,
  rankChange: 5,
  primaryStat: 15,
  statLabel: 'Level',
  ...overrides,
});

describe('RankSummaryCard', () => {
  describe('Card Display', () => {
    it('renders the category label', () => {
      const ranking = createRanking({ categoryLabel: 'Horse Level' });
      render(<RankSummaryCard ranking={ranking} />);
      expect(screen.getByText('Horse Level')).toBeInTheDocument();
    });

    it('renders the rank as "#42 of 1,254"', () => {
      const ranking = createRanking({ rank: 42, totalEntries: 1254 });
      render(<RankSummaryCard ranking={ranking} />);
      expect(screen.getByText('#42')).toBeInTheDocument();
      expect(screen.getByText(/of 1,254/)).toBeInTheDocument();
    });

    it('renders the primary stat with label', () => {
      const ranking = createRanking({ primaryStat: 15, statLabel: 'Level' });
      render(<RankSummaryCard ranking={ranking} />);
      expect(screen.getByText('Level 15')).toBeInTheDocument();
    });

    it('formats prize money stat with dollar sign and commas', () => {
      const ranking = createRanking({
        category: 'prize-money',
        categoryLabel: 'Prize Money',
        primaryStat: 125340,
        statLabel: 'Prize Money',
      });
      render(<RankSummaryCard ranking={ranking} />);
      expect(screen.getByText('$125,340')).toBeInTheDocument();
    });

    it('formats win rate stat with percent sign', () => {
      const ranking = createRanking({
        category: 'win-rate',
        categoryLabel: 'Win Rate',
        primaryStat: 82.5,
        statLabel: 'Win Rate %',
      });
      render(<RankSummaryCard ranking={ranking} />);
      expect(screen.getByText('82.5%')).toBeInTheDocument();
    });
  });

  describe('Rank Change Indicators', () => {
    it('shows green up indicator with "+5" for positive rank change', () => {
      const ranking = createRanking({ rankChange: 5 });
      render(<RankSummaryCard ranking={ranking} />);
      const indicator = screen.getByTestId('rank-change-indicator');
      expect(indicator).toHaveTextContent('+5');
      expect(indicator).toHaveStyle({ backgroundColor: expect.stringContaining('') });
      // Verify green styling is present
      expect(indicator.className).toMatch(/green|emerald/i);
    });

    it('shows red down indicator with "-3" for negative rank change', () => {
      const ranking = createRanking({ rankChange: -3 });
      render(<RankSummaryCard ranking={ranking} />);
      const indicator = screen.getByTestId('rank-change-indicator');
      expect(indicator).toHaveTextContent('-3');
      expect(indicator.className).toMatch(/red/i);
    });

    it('shows gray dash indicator for no rank change', () => {
      const ranking = createRanking({ rankChange: 0 });
      render(<RankSummaryCard ranking={ranking} />);
      const indicator = screen.getByTestId('rank-change-indicator');
      expect(indicator).toHaveTextContent('\u2014');
      expect(indicator.className).toMatch(/gray/i);
    });
  });

  describe('Achievement Badges', () => {
    it('displays gold achievement badge for rank in top 10', () => {
      const ranking = createRanking({ rank: 8, totalEntries: 980 });
      render(<RankSummaryCard ranking={ranking} />);
      const badge = screen.getByTestId('achievement-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Top 10');
    });

    it('displays silver achievement badge for rank in top 100', () => {
      const ranking = createRanking({ rank: 45, totalEntries: 980 });
      render(<RankSummaryCard ranking={ranking} />);
      const badge = screen.getByTestId('achievement-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Top 100');
    });

    it('does not display achievement badge for rank above 100', () => {
      const ranking = createRanking({ rank: 150, totalEntries: 980 });
      render(<RankSummaryCard ranking={ranking} />);
      expect(screen.queryByTestId('achievement-badge')).not.toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when the card is clicked and isClickable is true', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const ranking = createRanking();
      render(<RankSummaryCard ranking={ranking} onClick={handleClick} isClickable={true} />);

      await user.click(screen.getByTestId('rank-summary-card'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when isClickable is false', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const ranking = createRanking();
      render(<RankSummaryCard ranking={ranking} onClick={handleClick} isClickable={false} />);

      await user.click(screen.getByTestId('rank-summary-card'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('renders skeleton placeholders when ranking is not provided (loading)', () => {
      render(<RankSummaryCard ranking={null as unknown as CategoryRanking} isLoading={true} />);
      const skeletons = screen.getAllByTestId('skeleton-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Hover and Clickable Styles', () => {
    it('applies cursor-pointer class when isClickable is true', () => {
      const ranking = createRanking();
      render(<RankSummaryCard ranking={ranking} isClickable={true} onClick={vi.fn()} />);
      expect(screen.getByTestId('rank-summary-card')).toHaveClass('cursor-pointer');
    });

    it('does not apply cursor-pointer class when isClickable is false', () => {
      const ranking = createRanking();
      render(<RankSummaryCard ranking={ranking} isClickable={false} />);
      expect(screen.getByTestId('rank-summary-card')).not.toHaveClass('cursor-pointer');
    });
  });

  describe('Accessibility', () => {
    it('has an accessible aria-label describing the rank summary', () => {
      const ranking = createRanking({ categoryLabel: 'Horse Level', rank: 42 });
      render(<RankSummaryCard ranking={ranking} />);
      const card = screen.getByTestId('rank-summary-card');
      expect(card).toHaveAttribute('aria-label', 'Horse Level ranking: #42');
    });

    it('supports keyboard activation when clickable', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const ranking = createRanking();
      render(<RankSummaryCard ranking={ranking} onClick={handleClick} isClickable={true} />);

      const card = screen.getByTestId('rank-summary-card');
      card.focus();
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('applies custom className when provided', () => {
      const ranking = createRanking();
      render(<RankSummaryCard ranking={ranking} className="my-custom-class" />);
      expect(screen.getByTestId('rank-summary-card')).toHaveClass('my-custom-class');
    });
  });
});
