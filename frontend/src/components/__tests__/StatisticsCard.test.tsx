/**
 * StatisticsCard Component Tests
 *
 * Comprehensive tests for the statistics card component including:
 * - Statistic value rendering
 * - Trend indicators
 * - Loading state
 * - Size variants
 * - Icon display
 *
 * Story 2.4: Statistics Dashboard - AC-1, AC-2, AC-3, AC-5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatisticsCard from '../StatisticsCard';
import { StatisticType, TrendDirection } from '../../lib/statistics-utils';

describe('StatisticsCard', () => {
  describe('Value Display (AC-1)', () => {
    it('should display the statistic value', () => {
      render(<StatisticsCard value={42} label="Horses Owned" />);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should display 0 when value is 0', () => {
      render(<StatisticsCard value={0} label="Competitions Won" />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should format large values with separators', () => {
      render(<StatisticsCard value={1234} label="Total Earnings" />);
      expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('should handle undefined value by showing 0', () => {
      render(<StatisticsCard value={undefined} label="Breeding Count" />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should display the label', () => {
      render(<StatisticsCard value={10} label="Horses Owned" />);
      expect(screen.getByText('Horses Owned')).toBeInTheDocument();
    });
  });

  describe('Icon Display', () => {
    it('should display icon when provided', () => {
      render(<StatisticsCard value={5} label="Horses" icon="horse" />);
      expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
    });

    it('should display horse icon for HORSES_OWNED type', () => {
      render(<StatisticsCard value={5} label="Horses Owned" type={StatisticType.HORSES_OWNED} />);
      const icon = screen.getByTestId('stat-icon');
      expect(icon).toHaveAttribute('data-icon', 'horse');
    });

    it('should display trophy icon for COMPETITIONS_WON type', () => {
      render(
        <StatisticsCard value={10} label="Competitions Won" type={StatisticType.COMPETITIONS_WON} />
      );
      const icon = screen.getByTestId('stat-icon');
      expect(icon).toHaveAttribute('data-icon', 'trophy');
    });

    it('should display heart icon for BREEDING_COUNT type', () => {
      render(
        <StatisticsCard value={3} label="Breeding Count" type={StatisticType.BREEDING_COUNT} />
      );
      const icon = screen.getByTestId('stat-icon');
      expect(icon).toHaveAttribute('data-icon', 'heart');
    });

    it('should display coin icon for TOTAL_EARNINGS type', () => {
      render(
        <StatisticsCard value={5000} label="Total Earnings" type={StatisticType.TOTAL_EARNINGS} />
      );
      const icon = screen.getByTestId('stat-icon');
      expect(icon).toHaveAttribute('data-icon', 'coins');
    });

    it('should display chart icon for WIN_RATE type', () => {
      render(<StatisticsCard value={75} label="Win Rate" type={StatisticType.WIN_RATE} />);
      const icon = screen.getByTestId('stat-icon');
      expect(icon).toHaveAttribute('data-icon', 'chart');
    });
  });

  describe('Trend Display (AC-3)', () => {
    it('should display trend indicator when trend is provided', () => {
      render(<StatisticsCard value={50} label="Horses" trend={10} />);
      expect(screen.getByTestId('trend-indicator')).toBeInTheDocument();
    });

    it('should display positive trend with + sign', () => {
      render(<StatisticsCard value={50} label="Horses" trend={25} />);
      expect(screen.getByText('+25%')).toBeInTheDocument();
    });

    it('should display negative trend with - sign', () => {
      render(<StatisticsCard value={50} label="Horses" trend={-15} />);
      expect(screen.getByText('-15%')).toBeInTheDocument();
    });

    it('should display 0% for zero trend', () => {
      render(<StatisticsCard value={50} label="Horses" trend={0} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should have up arrow for positive trend', () => {
      render(<StatisticsCard value={50} label="Horses" trend={10} />);
      const indicator = screen.getByTestId('trend-indicator');
      expect(indicator).toHaveAttribute('data-direction', 'up');
    });

    it('should have down arrow for negative trend', () => {
      render(<StatisticsCard value={50} label="Horses" trend={-10} />);
      const indicator = screen.getByTestId('trend-indicator');
      expect(indicator).toHaveAttribute('data-direction', 'down');
    });

    it('should have neutral indicator for very small trend', () => {
      render(<StatisticsCard value={50} label="Horses" trend={0.05} />);
      const indicator = screen.getByTestId('trend-indicator');
      expect(indicator).toHaveAttribute('data-direction', 'neutral');
    });

    it('should not display trend indicator when trend is not provided', () => {
      render(<StatisticsCard value={50} label="Horses" />);
      expect(screen.queryByTestId('trend-indicator')).not.toBeInTheDocument();
    });

    it('should display green color for positive trend', () => {
      render(<StatisticsCard value={50} label="Horses" trend={10} />);
      const indicator = screen.getByTestId('trend-indicator');
      expect(indicator).toHaveClass('trend-positive');
    });

    it('should display red color for negative trend', () => {
      render(<StatisticsCard value={50} label="Horses" trend={-10} />);
      const indicator = screen.getByTestId('trend-indicator');
      expect(indicator).toHaveClass('trend-negative');
    });

    it('should display gray color for neutral trend', () => {
      render(<StatisticsCard value={50} label="Horses" trend={0} />);
      const indicator = screen.getByTestId('trend-indicator');
      expect(indicator).toHaveClass('trend-neutral');
    });
  });

  describe('Loading State (AC-5)', () => {
    it('should display loading skeleton when isLoading is true', () => {
      render(<StatisticsCard isLoading label="Horses" />);
      expect(screen.getByTestId('stat-loading-skeleton')).toBeInTheDocument();
    });

    it('should not display value when loading', () => {
      render(<StatisticsCard value={100} label="Horses" isLoading />);
      expect(screen.queryByText('100')).not.toBeInTheDocument();
    });

    it('should not display icon when loading', () => {
      render(<StatisticsCard value={100} label="Horses" icon="horse" isLoading />);
      expect(screen.queryByTestId('stat-icon')).not.toBeInTheDocument();
    });

    it('should not display trend when loading', () => {
      render(<StatisticsCard value={100} label="Horses" trend={10} isLoading />);
      expect(screen.queryByTestId('trend-indicator')).not.toBeInTheDocument();
    });

    it('should display skeleton in card shape', () => {
      render(<StatisticsCard isLoading label="Horses" />);
      const skeleton = screen.getByTestId('stat-loading-skeleton');
      expect(skeleton).toHaveClass('stat-card-skeleton');
    });
  });

  describe('Size Variants', () => {
    it('should render with small size', () => {
      render(<StatisticsCard value={10} label="Horses" size="sm" />);
      const container = screen.getByTestId('statistics-card');
      expect(container).toHaveClass('stat-card-sm');
    });

    it('should render with medium size (default)', () => {
      render(<StatisticsCard value={10} label="Horses" />);
      const container = screen.getByTestId('statistics-card');
      expect(container).toHaveClass('stat-card-md');
    });

    it('should render with large size', () => {
      render(<StatisticsCard value={10} label="Horses" size="lg" />);
      const container = screen.getByTestId('statistics-card');
      expect(container).toHaveClass('stat-card-lg');
    });
  });

  describe('Click Handler', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<StatisticsCard value={10} label="Horses" onClick={handleClick} />);
      fireEvent.click(screen.getByTestId('statistics-card'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not have clickable styling when no onClick', () => {
      render(<StatisticsCard value={10} label="Horses" />);
      const container = screen.getByTestId('statistics-card');
      expect(container).not.toHaveClass('stat-card-clickable');
    });

    it('should have clickable styling when onClick is provided', () => {
      render(<StatisticsCard value={10} label="Horses" onClick={() => {}} />);
      const container = screen.getByTestId('statistics-card');
      expect(container).toHaveClass('stat-card-clickable');
    });

    it('should have cursor-pointer when clickable', () => {
      render(<StatisticsCard value={10} label="Horses" onClick={() => {}} />);
      const container = screen.getByTestId('statistics-card');
      expect(container).toHaveClass('cursor-pointer');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label', () => {
      render(<StatisticsCard value={42} label="Horses Owned" />);
      const container = screen.getByTestId('statistics-card');
      expect(container).toHaveAttribute('aria-label');
    });

    it('should announce value and label correctly', () => {
      render(<StatisticsCard value={42} label="Horses Owned" />);
      const container = screen.getByTestId('statistics-card');
      expect(container.getAttribute('aria-label')).toContain('42');
      expect(container.getAttribute('aria-label')).toContain('Horses Owned');
    });

    it('should have role="region" for grouping', () => {
      render(<StatisticsCard value={42} label="Horses Owned" />);
      const container = screen.getByTestId('statistics-card');
      expect(container).toHaveAttribute('role', 'region');
    });

    it('should have button role when clickable', () => {
      render(<StatisticsCard value={42} label="Horses" onClick={() => {}} />);
      const container = screen.getByTestId('statistics-card');
      expect(container).toHaveAttribute('role', 'button');
    });

    it('should be keyboard accessible when clickable', () => {
      const handleClick = vi.fn();
      render(<StatisticsCard value={10} label="Horses" onClick={handleClick} />);
      const container = screen.getByTestId('statistics-card');
      expect(container).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Visual Styling', () => {
    it('should render with card styling', () => {
      render(<StatisticsCard value={10} label="Horses" />);
      const container = screen.getByTestId('statistics-card');
      expect(container.className).toMatch(/stat-card/);
    });

    it('should render label below value', () => {
      render(<StatisticsCard value={10} label="Horses" />);
      const container = screen.getByTestId('statistics-card');
      expect(container.textContent).toMatch(/10.*Horses/);
    });

    it('should render trend to the side of value', () => {
      render(<StatisticsCard value={10} label="Horses" trend={5} />);
      expect(screen.getByTestId('trend-indicator')).toBeInTheDocument();
    });
  });

  describe('Percentage Display (WIN_RATE)', () => {
    it('should display value as percentage for WIN_RATE type', () => {
      render(<StatisticsCard value={75} label="Win Rate" type={StatisticType.WIN_RATE} />);
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should format decimal percentages', () => {
      render(<StatisticsCard value={33.3} label="Win Rate" type={StatisticType.WIN_RATE} />);
      expect(screen.getByText('33.3%')).toBeInTheDocument();
    });

    it('should display 0% for zero win rate', () => {
      render(<StatisticsCard value={0} label="Win Rate" type={StatisticType.WIN_RATE} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large values', () => {
      render(<StatisticsCard value={999999999} label="Total" />);
      expect(screen.getByText('999,999,999')).toBeInTheDocument();
    });

    it('should handle negative values', () => {
      render(<StatisticsCard value={-100} label="Deficit" />);
      expect(screen.getByText('-100')).toBeInTheDocument();
    });

    it('should handle decimal values by truncating', () => {
      render(<StatisticsCard value={42.99} label="Horses" />);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should handle NaN value by showing 0', () => {
      render(<StatisticsCard value={NaN} label="Unknown" />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle null value by showing 0', () => {
      render(<StatisticsCard value={null as unknown as number} label="Empty" />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle large positive trend', () => {
      render(<StatisticsCard value={100} label="Horses" trend={500} />);
      expect(screen.getByText('+500%')).toBeInTheDocument();
    });

    it('should handle large negative trend', () => {
      render(<StatisticsCard value={100} label="Horses" trend={-90} />);
      expect(screen.getByText('-90%')).toBeInTheDocument();
    });
  });
});
