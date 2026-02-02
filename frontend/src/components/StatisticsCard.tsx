/**
 * Statistics Card Component
 *
 * Displays game statistics with icon, trend indicator, and styling.
 * Supports different statistic types with appropriate icons.
 *
 * Story 2.4: Statistics Dashboard - AC-1, AC-2, AC-3, AC-5
 */

import React from 'react';
import { Gem, Trophy, Heart, Coins, BarChart3, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import {
  formatStatistic,
  formatPercentage,
  formatTrendLabel,
  getTrendDirection,
  StatisticType,
  TrendDirection,
} from '../lib/statistics-utils';

interface StatisticsCardProps {
  /** The statistic value to display */
  value?: number;
  /** Label describing the statistic */
  label: string;
  /** Icon to display (overrides type-based icon) */
  icon?: string;
  /** Statistic type for automatic icon selection */
  type?: StatisticType;
  /** Trend percentage (positive = increase, negative = decrease) */
  trend?: number;
  /** Show loading skeleton */
  isLoading?: boolean;
  /** Component size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Click handler for navigation */
  onClick?: () => void;
}

/**
 * Get the appropriate icon component based on type or icon prop
 */
const getIconComponent = (
  type?: StatisticType,
  icon?: string,
  iconClassName?: string
): React.ReactNode => {
  // Map icon names to icon components
  const iconMap: Record<string, React.ReactNode> = {
    horse: <Gem data-testid="stat-icon" data-icon="horse" className={iconClassName} />,
    trophy: <Trophy data-testid="stat-icon" data-icon="trophy" className={iconClassName} />,
    heart: <Heart data-testid="stat-icon" data-icon="heart" className={iconClassName} />,
    coins: <Coins data-testid="stat-icon" data-icon="coins" className={iconClassName} />,
    chart: <BarChart3 data-testid="stat-icon" data-icon="chart" className={iconClassName} />,
  };

  // If icon prop is provided, use it
  if (icon) {
    return iconMap[icon] || null;
  }

  // Otherwise, use type-based icon
  if (type) {
    switch (type) {
      case StatisticType.HORSES_OWNED:
        return iconMap.horse;
      case StatisticType.COMPETITIONS_WON:
        return iconMap.trophy;
      case StatisticType.BREEDING_COUNT:
        return iconMap.heart;
      case StatisticType.TOTAL_EARNINGS:
        return iconMap.coins;
      case StatisticType.WIN_RATE:
        return iconMap.chart;
      default:
        return null;
    }
  }

  return null;
};

/**
 * Trend indicator component
 */
const TrendIndicator: React.FC<{ trend: number }> = ({ trend }) => {
  const direction = getTrendDirection(trend);
  const formattedTrend = formatTrendLabel(trend);

  const directionClasses = {
    [TrendDirection.UP]: 'trend-positive text-emerald-600',
    [TrendDirection.DOWN]: 'trend-negative text-red-600',
    [TrendDirection.NEUTRAL]: 'trend-neutral text-gray-500',
  };

  const ArrowIcon = {
    [TrendDirection.UP]: ArrowUp,
    [TrendDirection.DOWN]: ArrowDown,
    [TrendDirection.NEUTRAL]: Minus,
  }[direction];

  return (
    <div
      data-testid="trend-indicator"
      data-direction={direction}
      className={`flex items-center gap-0.5 text-sm ${directionClasses[direction]}`}
    >
      <ArrowIcon className="w-3 h-3" />
      <span>{formattedTrend}</span>
    </div>
  );
};

/**
 * Loading skeleton for the statistics card
 */
const StatisticsCardSkeleton: React.FC<{ size: 'sm' | 'md' | 'lg' }> = ({ size }) => {
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  };

  return (
    <div
      data-testid="stat-loading-skeleton"
      className={`stat-card-skeleton animate-pulse rounded-lg bg-parchment-cream/50 border border-aged-bronze/20 ${sizeClasses[size]}`}
    >
      <div className="flex items-center gap-3">
        {/* Icon skeleton */}
        <div className="w-10 h-10 rounded-full bg-aged-bronze/20" />
        <div className="flex-1 space-y-2">
          {/* Value skeleton */}
          <div className="h-6 w-16 bg-aged-bronze/20 rounded" />
          {/* Label skeleton */}
          <div className="h-4 w-24 bg-aged-bronze/20 rounded" />
        </div>
      </div>
    </div>
  );
};

/**
 * Statistics Card Component
 */
const StatisticsCard: React.FC<StatisticsCardProps> = ({
  value = 0,
  label,
  icon,
  type,
  trend,
  isLoading = false,
  size = 'md',
  onClick,
}) => {
  // Format the value based on type
  const displayValue = (() => {
    // Handle edge cases
    const safeValue = value ?? 0;
    if (Number.isNaN(safeValue)) return '0';

    // WIN_RATE displays as percentage
    if (type === StatisticType.WIN_RATE) {
      return formatPercentage(safeValue);
    }

    return formatStatistic(safeValue);
  })();

  // Size-based styling
  const sizeClasses = {
    sm: 'stat-card-sm p-3',
    md: 'stat-card-md p-4',
    lg: 'stat-card-lg p-5',
  };

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const valueSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const labelSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconContainerSizes = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14',
  };

  // Loading state
  if (isLoading) {
    return <StatisticsCardSkeleton size={size} />;
  }

  // Determine if clickable
  const isClickable = !!onClick;
  const clickableClasses = isClickable
    ? 'stat-card-clickable cursor-pointer hover:border-aged-bronze/40 hover:shadow-md transition-all'
    : '';

  // Accessibility props
  const accessibilityProps = isClickable
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        },
      }
    : {
        role: 'region' as const,
      };

  return (
    <div
      data-testid="statistics-card"
      className={`stat-card rounded-lg bg-parchment-cream border border-aged-bronze/20 shadow-sm ${sizeClasses[size]} ${clickableClasses}`}
      aria-label={`${label}: ${displayValue}`}
      onClick={onClick}
      {...accessibilityProps}
    >
      <div className="flex items-center gap-3">
        {/* Icon Container */}
        {(icon || type) && (
          <div
            className={`${iconContainerSizes[size]} rounded-full bg-burnished-gold/10 flex items-center justify-center`}
          >
            {getIconComponent(type, icon, `${iconSizes[size]} text-burnished-gold`)}
          </div>
        )}

        {/* Value and Label */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-bold text-midnight-ink ${valueSizes[size]}`}>
              {displayValue}
            </span>
            {trend !== undefined && <TrendIndicator trend={trend} />}
          </div>
          <span className={`fantasy-body text-aged-bronze ${labelSizes[size]}`}>{label}</span>
        </div>
      </div>
    </div>
  );
};

export default StatisticsCard;
