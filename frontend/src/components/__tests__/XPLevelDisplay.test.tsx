/**
 * XPLevelDisplay Component Tests
 *
 * Comprehensive tests for the XP and Level display component including:
 * - Level badge rendering
 * - XP progress bar display
 * - Loading state
 * - Edge cases
 *
 * Story 2.2: XP & Level Display - AC-1 through AC-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import XPLevelDisplay from '../XPLevelDisplay';

describe('XPLevelDisplay', () => {
  describe('Level Badge (AC-1)', () => {
    it('should display level 1 for user with 0 XP', () => {
      render(<XPLevelDisplay xp={0} />);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText(/level/i)).toBeInTheDocument();
    });

    it('should display level 2 for user with 100 XP', () => {
      render(<XPLevelDisplay xp={100} />);
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should display level 10 for user with 900 XP', () => {
      render(<XPLevelDisplay xp={900} />);
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('should display level badge with fantasy styling', () => {
      render(<XPLevelDisplay xp={50} />);
      const levelBadge = screen.getByTestId('level-badge');
      expect(levelBadge).toBeInTheDocument();
    });

    it('should hide level badge when showLevelBadge is false', () => {
      render(<XPLevelDisplay xp={50} showLevelBadge={false} />);
      expect(screen.queryByTestId('level-badge')).not.toBeInTheDocument();
    });
  });

  describe('XP Progress Bar (AC-2)', () => {
    it('should display progress bar', () => {
      render(<XPLevelDisplay xp={50} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should show 0% progress for 0 XP', () => {
      render(<XPLevelDisplay xp={0} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('should show 50% progress for 50 XP (level 1)', () => {
      render(<XPLevelDisplay xp={50} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });

    it('should show 0% progress for 100 XP (just leveled up)', () => {
      render(<XPLevelDisplay xp={100} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('should show 75% progress for 175 XP (level 2)', () => {
      render(<XPLevelDisplay xp={175} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    });

    it('should have min=0 and max=100 on progress bar', () => {
      render(<XPLevelDisplay xp={50} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  describe('XP Text Display', () => {
    it('should display current XP / total XP format', () => {
      render(<XPLevelDisplay xp={50} />);
      expect(screen.getByText(/50 \/ 100 XP/i)).toBeInTheDocument();
    });

    it('should display 0 / 100 XP for level 1 start', () => {
      render(<XPLevelDisplay xp={0} />);
      expect(screen.getByText(/0 \/ 100 XP/i)).toBeInTheDocument();
    });

    it('should display 0 / 100 XP when just leveled up', () => {
      render(<XPLevelDisplay xp={100} />);
      expect(screen.getByText(/0 \/ 100 XP/i)).toBeInTheDocument();
    });

    it('should hide progress text when showProgressText is false', () => {
      render(<XPLevelDisplay xp={50} showProgressText={false} />);
      expect(screen.queryByText(/\/ 100 XP/i)).not.toBeInTheDocument();
    });
  });

  describe('Loading State (AC-5)', () => {
    it('should display loading skeleton when isLoading is true', () => {
      render(<XPLevelDisplay isLoading={true} />);
      expect(screen.getByTestId('xp-loading-skeleton')).toBeInTheDocument();
    });

    it('should not display level badge when loading', () => {
      render(<XPLevelDisplay isLoading={true} />);
      expect(screen.queryByTestId('level-badge')).not.toBeInTheDocument();
    });

    it('should not display progress bar when loading', () => {
      render(<XPLevelDisplay isLoading={true} />);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined xp by showing level 1', () => {
      render(<XPLevelDisplay xp={undefined} />);
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should handle level prop override', () => {
      render(<XPLevelDisplay level={5} xp={50} />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should calculate level from xp when no level prop provided', () => {
      render(<XPLevelDisplay xp={350} />);
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('should handle very large XP values', () => {
      render(<XPLevelDisplay xp={9999} />);
      expect(screen.getByText('100')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('should render with small size', () => {
      render(<XPLevelDisplay xp={50} size="sm" />);
      const container = screen.getByTestId('xp-level-display');
      expect(container).toHaveClass('xp-display-sm');
    });

    it('should render with medium size (default)', () => {
      render(<XPLevelDisplay xp={50} />);
      const container = screen.getByTestId('xp-level-display');
      expect(container).toHaveClass('xp-display-md');
    });

    it('should render with large size', () => {
      render(<XPLevelDisplay xp={50} size="lg" />);
      const container = screen.getByTestId('xp-level-display');
      expect(container).toHaveClass('xp-display-lg');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label on progress bar', () => {
      render(<XPLevelDisplay xp={50} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label');
    });

    it('should announce level information', () => {
      render(<XPLevelDisplay xp={150} />);
      // Level 2 with 50 XP progress
      expect(screen.getByText(/level/i)).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Visual Elements', () => {
    it('should render progress bar fill with correct width style', () => {
      render(<XPLevelDisplay xp={75} />);
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '75%' });
    });

    it('should render star icon in level badge', () => {
      render(<XPLevelDisplay xp={50} />);
      const starIcon = screen.getByTestId('level-star-icon');
      expect(starIcon).toBeInTheDocument();
    });
  });
});
