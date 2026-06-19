/**
 * RankBadge Component Tests
 *
 * Tests for the rank badge component including:
 * - Gold/Silver/Bronze styling for top 3
 * - Blue styling for ranks 4-10
 * - Gray styling for ranks 11+
 * - Crown and Medal icons for top 3
 * - Size variants (small, medium, large)
 * - Custom className support
 * - Accessibility (aria-label)
 *
 * Story 5-5: Leaderboards - Task 2
 * Target: 10 tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RankBadge from '../RankBadge';

describe('RankBadge', () => {
  describe('Top 3 Special Styling', () => {
    // o5hub.44: inline hex tiers migrated to first-class --tier-* tokens.
    // Assertions preserve intent (rank -> correct podium tier) against the token.
    it('renders 1st place with gold tier token background', () => {
      render(<RankBadge rank={1} />);
      const badge = screen.getByTestId('rank-badge-1');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveStyle({ backgroundColor: 'var(--tier-gold)' });
    });

    it('renders 2nd place with silver tier token background', () => {
      render(<RankBadge rank={2} />);
      const badge = screen.getByTestId('rank-badge-2');
      expect(badge).toHaveStyle({ backgroundColor: 'var(--tier-silver)' });
    });

    it('renders 3rd place with bronze tier token background', () => {
      render(<RankBadge rank={3} />);
      const badge = screen.getByTestId('rank-badge-3');
      expect(badge).toHaveStyle({ backgroundColor: 'var(--tier-bronze)' });
    });
  });

  describe('Rank Range Styling', () => {
    it('renders ranks 4-10 with info (blue) token background', () => {
      render(<RankBadge rank={5} />);
      const badge = screen.getByTestId('rank-badge-5');
      expect(badge).toHaveStyle({ backgroundColor: 'var(--status-info)' });
    });

    it('renders ranks 11+ with muted (neutral) token background', () => {
      render(<RankBadge rank={25} />);
      const badge = screen.getByTestId('rank-badge-25');
      expect(badge).toHaveStyle({ backgroundColor: 'var(--text-muted)' });
    });
  });

  describe('Icons', () => {
    it('renders a crown icon for 1st place', () => {
      render(<RankBadge rank={1} />);
      expect(screen.getByTestId('rank-icon-crown')).toBeInTheDocument();
    });

    it('renders a medal icon for 2nd place', () => {
      render(<RankBadge rank={2} />);
      expect(screen.getByTestId('rank-icon-medal')).toBeInTheDocument();
    });

    it('renders a medal icon for 3rd place', () => {
      render(<RankBadge rank={3} />);
      expect(screen.getByTestId('rank-icon-medal')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('renders small size variant with correct dimensions', () => {
      render(<RankBadge rank={1} size="small" />);
      const badge = screen.getByTestId('rank-badge-1');
      expect(badge).toHaveClass('rank-badge-small');
    });

    it('renders medium size variant by default', () => {
      render(<RankBadge rank={1} />);
      const badge = screen.getByTestId('rank-badge-1');
      expect(badge).toHaveClass('rank-badge-medium');
    });

    it('renders large size variant with correct dimensions', () => {
      render(<RankBadge rank={1} size="large" />);
      const badge = screen.getByTestId('rank-badge-1');
      expect(badge).toHaveClass('rank-badge-large');
    });
  });

  describe('Display and Accessibility', () => {
    it('displays the rank number', () => {
      render(<RankBadge rank={42} />);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<RankBadge rank={1} className="my-custom-badge" />);
      const badge = screen.getByTestId('rank-badge-1');
      expect(badge).toHaveClass('my-custom-badge');
    });

    it('has an accessible aria-label describing the rank', () => {
      render(<RankBadge rank={1} />);
      const badge = screen.getByTestId('rank-badge-1');
      expect(badge).toHaveAttribute('aria-label', 'Rank 1');
    });
  });
});
