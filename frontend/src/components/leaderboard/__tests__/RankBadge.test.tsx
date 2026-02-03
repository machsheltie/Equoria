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
    it('renders 1st place with gold background color', () => {
      render(<RankBadge rank={1} />);
      const badge = screen.getByTestId('rank-badge-1');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveStyle({ backgroundColor: '#FFD700' });
    });

    it('renders 2nd place with silver background color', () => {
      render(<RankBadge rank={2} />);
      const badge = screen.getByTestId('rank-badge-2');
      expect(badge).toHaveStyle({ backgroundColor: '#C0C0C0' });
    });

    it('renders 3rd place with bronze background color', () => {
      render(<RankBadge rank={3} />);
      const badge = screen.getByTestId('rank-badge-3');
      expect(badge).toHaveStyle({ backgroundColor: '#CD7F32' });
    });
  });

  describe('Rank Range Styling', () => {
    it('renders ranks 4-10 with blue background color', () => {
      render(<RankBadge rank={5} />);
      const badge = screen.getByTestId('rank-badge-5');
      expect(badge).toHaveStyle({ backgroundColor: '#3B82F6' });
    });

    it('renders ranks 11+ with gray background color', () => {
      render(<RankBadge rank={25} />);
      const badge = screen.getByTestId('rank-badge-25');
      expect(badge).toHaveStyle({ backgroundColor: '#6B7280' });
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
