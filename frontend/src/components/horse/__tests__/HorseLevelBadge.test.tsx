/**
 * HorseLevelBadge Component Tests
 *
 * Comprehensive tests for the Horse Level Badge component including:
 * - Badge rendering with level number
 * - Tier-based color coding (Bronze, Silver, Gold, Platinum, Diamond)
 * - Size variants (small, medium, large)
 * - Icon display and positioning
 * - Tooltip with tier information
 * - Edge cases (level 0, negative, very large)
 * - Accessibility (ARIA labels, keyboard focus)
 *
 * Story 5-4: Horse Level Badge - Task 4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HorseLevelBadge from '../HorseLevelBadge';
import { getLevelTier } from '../HorseLevelBadge';

describe('HorseLevelBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Rendering Tests (~4 tests)
  // =========================================================================
  describe('Rendering', () => {
    it('should display the level number', () => {
      render(<HorseLevelBadge level={5} />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render with default props', () => {
      render(<HorseLevelBadge level={1} />);
      const badge = screen.getByTestId('horse-level-badge');
      expect(badge).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<HorseLevelBadge level={3} className="my-custom-class" />);
      const badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('my-custom-class');
    });

    it('should update display when level changes', () => {
      const { rerender } = render(<HorseLevelBadge level={3} />);
      expect(screen.getByText('3')).toBeInTheDocument();

      rerender(<HorseLevelBadge level={12} />);
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Tier Color Tests (~5 tests)
  // =========================================================================
  describe('Tier Color Coding', () => {
    it('should apply Bronze tier colors for levels 1-5', () => {
      const { rerender } = render(<HorseLevelBadge level={1} />);
      let badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-amber-700');
      expect(badge).toHaveClass('text-amber-100');
      expect(badge).toHaveClass('border-amber-600');

      rerender(<HorseLevelBadge level={3} />);
      badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-amber-700');

      rerender(<HorseLevelBadge level={5} />);
      badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-amber-700');
    });

    it('should apply Silver tier colors for levels 6-10', () => {
      const { rerender } = render(<HorseLevelBadge level={6} />);
      let badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-slate-400');
      expect(badge).toHaveClass('text-slate-900');
      expect(badge).toHaveClass('border-slate-500');

      rerender(<HorseLevelBadge level={10} />);
      badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-slate-400');
    });

    it('should apply Gold tier colors for levels 11-15', () => {
      const { rerender } = render(<HorseLevelBadge level={11} />);
      let badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-yellow-500');
      expect(badge).toHaveClass('text-yellow-900');
      expect(badge).toHaveClass('border-yellow-600');

      rerender(<HorseLevelBadge level={15} />);
      badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-yellow-500');
    });

    it('should apply Platinum tier colors for levels 16-20', () => {
      const { rerender } = render(<HorseLevelBadge level={16} />);
      let badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-cyan-400');
      expect(badge).toHaveClass('text-cyan-900');
      expect(badge).toHaveClass('border-cyan-500');

      rerender(<HorseLevelBadge level={20} />);
      badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-cyan-400');
    });

    it('should apply Diamond tier colors for levels 21+', () => {
      const { rerender } = render(<HorseLevelBadge level={21} />);
      let badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-purple-500');
      expect(badge).toHaveClass('text-purple-100');
      expect(badge).toHaveClass('border-purple-600');

      rerender(<HorseLevelBadge level={25} />);
      badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-purple-500');

      rerender(<HorseLevelBadge level={100} />);
      badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-purple-500');
    });
  });

  // =========================================================================
  // Size Variant Tests (~3 tests)
  // =========================================================================
  describe('Size Variants', () => {
    it('should apply small size classes', () => {
      render(<HorseLevelBadge level={5} size="small" />);
      const badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('h-5');
      expect(badge).toHaveClass('text-xs');
    });

    it('should apply medium size classes by default', () => {
      render(<HorseLevelBadge level={5} />);
      const badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('h-6');
      expect(badge).toHaveClass('text-sm');
    });

    it('should apply large size classes', () => {
      render(<HorseLevelBadge level={5} size="large" />);
      const badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('h-8');
      expect(badge).toHaveClass('text-base');
    });
  });

  // =========================================================================
  // Icon Tests (~3 tests)
  // =========================================================================
  describe('Icon Display', () => {
    it('should render icon when showIcon is true', () => {
      render(<HorseLevelBadge level={5} showIcon={true} />);
      const icon = screen.getByTestId('level-badge-icon');
      expect(icon).toBeInTheDocument();
    });

    it('should not render icon by default (showIcon=false)', () => {
      render(<HorseLevelBadge level={5} />);
      expect(screen.queryByTestId('level-badge-icon')).not.toBeInTheDocument();
    });

    it('should position icon on left by default and right when specified', () => {
      const { rerender } = render(
        <HorseLevelBadge level={5} showIcon={true} iconPosition="left" />
      );
      const badgeContent = screen.getByTestId('badge-content');
      const children = Array.from(badgeContent.children);
      // Icon should be before the level number
      expect(children[0]).toHaveAttribute('data-testid', 'level-badge-icon');

      rerender(<HorseLevelBadge level={5} showIcon={true} iconPosition="right" />);
      const badgeContentRight = screen.getByTestId('badge-content');
      const childrenRight = Array.from(badgeContentRight.children);
      // Icon should be after the level number
      expect(childrenRight[childrenRight.length - 1]).toHaveAttribute(
        'data-testid',
        'level-badge-icon'
      );
    });
  });

  // =========================================================================
  // Tooltip Tests (~3 tests)
  // =========================================================================
  describe('Tooltip', () => {
    it('should not show tooltip by default', () => {
      render(<HorseLevelBadge level={5} />);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      expect(screen.queryByTestId('level-tooltip')).not.toBeInTheDocument();
    });

    it('should show tooltip on hover when showTooltip is true', async () => {
      const user = userEvent.setup();
      render(<HorseLevelBadge level={5} showTooltip={true} />);

      const badge = screen.getByTestId('horse-level-badge');
      await user.hover(badge);

      await waitFor(() => {
        const tooltip = screen.getByTestId('level-tooltip');
        expect(tooltip).toBeInTheDocument();
      });
    });

    it('should display tier name and level info in tooltip', async () => {
      const user = userEvent.setup();
      render(<HorseLevelBadge level={5} showTooltip={true} />);

      const badge = screen.getByTestId('horse-level-badge');
      await user.hover(badge);

      await waitFor(() => {
        expect(screen.getByText(/bronze/i)).toBeInTheDocument();
        expect(screen.getByText(/level 5/i)).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Edge Case Tests (~2 tests)
  // =========================================================================
  describe('Edge Cases', () => {
    it('should handle level 0 or negative by falling back to level 1 Bronze tier', () => {
      const { rerender } = render(<HorseLevelBadge level={0} />);
      let badge = screen.getByTestId('horse-level-badge');
      // Should fallback to Bronze tier
      expect(badge).toHaveClass('bg-amber-700');
      expect(screen.getByText('1')).toBeInTheDocument();

      rerender(<HorseLevelBadge level={-5} />);
      badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-amber-700');
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should handle very large level numbers (>1000)', () => {
      render(<HorseLevelBadge level={1500} />);
      const badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveClass('bg-purple-500');
      expect(screen.getByText('1500')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Accessibility Tests (~2 tests)
  // =========================================================================
  describe('Accessibility', () => {
    it('should have ARIA label describing level and tier', () => {
      render(<HorseLevelBadge level={12} />);
      const badge = screen.getByTestId('horse-level-badge');
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Level 12'));
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Gold'));
    });

    it('should be keyboard focusable when tooltip is enabled', async () => {
      const user = userEvent.setup();
      render(<HorseLevelBadge level={8} showTooltip={true} />);

      const badge = screen.getByTestId('horse-level-badge');
      // Badge should have tabIndex when tooltip is enabled
      expect(badge).toHaveAttribute('tabindex', '0');

      await user.tab();
      expect(badge).toHaveFocus();

      // Tooltip should show on focus
      await waitFor(() => {
        const tooltip = screen.getByTestId('level-tooltip');
        expect(tooltip).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // getLevelTier Helper Function Tests
  // =========================================================================
  describe('getLevelTier helper', () => {
    it('should return Bronze tier for levels 1-5', () => {
      const result = getLevelTier(3);
      expect(result.tier).toBe('bronze');
      expect(result.tierName).toBe('Bronze');
      expect(result.colorClasses).toContain('bg-amber-700');
      expect(result.nextTierLevel).toBe(6);
      expect(result.nextTierName).toBe('Silver');
    });

    it('should return Silver tier for levels 6-10', () => {
      const result = getLevelTier(8);
      expect(result.tier).toBe('silver');
      expect(result.tierName).toBe('Silver');
      expect(result.colorClasses).toContain('bg-slate-400');
      expect(result.nextTierLevel).toBe(11);
      expect(result.nextTierName).toBe('Gold');
    });

    it('should return Gold tier for levels 11-15', () => {
      const result = getLevelTier(13);
      expect(result.tier).toBe('gold');
      expect(result.tierName).toBe('Gold');
      expect(result.colorClasses).toContain('bg-yellow-500');
      expect(result.nextTierLevel).toBe(16);
      expect(result.nextTierName).toBe('Platinum');
    });

    it('should return Platinum tier for levels 16-20', () => {
      const result = getLevelTier(18);
      expect(result.tier).toBe('platinum');
      expect(result.tierName).toBe('Platinum');
      expect(result.colorClasses).toContain('bg-cyan-400');
      expect(result.nextTierLevel).toBe(21);
      expect(result.nextTierName).toBe('Diamond');
    });

    it('should return Diamond tier for levels 21+ with no next tier', () => {
      const result = getLevelTier(25);
      expect(result.tier).toBe('diamond');
      expect(result.tierName).toBe('Diamond');
      expect(result.colorClasses).toContain('bg-purple-500');
      expect(result.nextTierLevel).toBeUndefined();
      expect(result.nextTierName).toBeUndefined();
    });
  });
});
