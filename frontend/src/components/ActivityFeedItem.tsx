/**
 * Activity Feed Item Component
 *
 * Displays a single activity item with icon, description, and timestamp.
 * Supports different activity types with appropriate icons and styling.
 *
 * Story 2.5: Activity Feed - AC-1, AC-2, AC-3, AC-6
 */

import React from 'react';
import {
  Heart,
  Dumbbell,
  Trophy,
  ShoppingCart,
  Star,
  ArrowUp,
  Coins,
  Activity,
} from 'lucide-react';
import {
  ActivityType,
  formatRelativeTime,
  getActivityIcon,
  getActivityLabel,
  getActivityDescription,
  type Activity as ActivityData,
} from '../lib/activity-utils';

interface ActivityFeedItemProps {
  /** Activity data to display */
  activity: ActivityData;
  /** Show loading skeleton */
  isLoading?: boolean;
  /** Click handler */
  onClick?: (activity: ActivityData) => void;
  /** Component size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Compact mode - hides activity label */
  compact?: boolean;
}

/**
 * Icon mapping for activity types
 */
const IconComponents: Record<
  string,
  React.FC<{ className?: string; 'data-testid'?: string; 'data-icon'?: string }>
> = {
  heart: Heart,
  dumbbell: Dumbbell,
  trophy: Trophy,
  'shopping-cart': ShoppingCart,
  star: Star,
  'arrow-up': ArrowUp,
  coins: Coins,
  activity: Activity,
};

/**
 * Get the icon component for an activity type
 */
const getIconComponent = (type: ActivityType, iconClassName: string): React.ReactNode => {
  const iconName = getActivityIcon(type);
  const IconComponent = IconComponents[iconName] || Activity;
  return (
    <IconComponent data-testid="activity-icon" data-icon={iconName} className={iconClassName} />
  );
};

/**
 * Loading skeleton for the activity item
 */
const ActivityItemSkeleton: React.FC<{ size: 'sm' | 'md' | 'lg' }> = ({ size }) => {
  const sizeClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
  };

  return (
    <div
      data-testid="activity-item-skeleton"
      className={`activity-item-skeleton animate-pulse rounded-lg bg-parchment-cream/50 border border-aged-bronze/20 ${sizeClasses[size]}`}
    >
      <div className="flex items-center gap-3">
        {/* Icon skeleton */}
        <div className="w-8 h-8 rounded-full bg-aged-bronze/20" />
        <div className="flex-1 space-y-2">
          {/* Description skeleton */}
          <div className="h-4 w-3/4 bg-aged-bronze/20 rounded" />
          {/* Time skeleton */}
          <div className="h-3 w-20 bg-aged-bronze/20 rounded" />
        </div>
      </div>
    </div>
  );
};

/**
 * Activity Feed Item Component
 */
const ActivityFeedItem: React.FC<ActivityFeedItemProps> = ({
  activity,
  isLoading = false,
  onClick,
  size = 'md',
  compact = false,
}) => {
  // Size-based styling
  const sizeClasses = {
    sm: 'activity-item-sm p-2',
    md: 'activity-item-md p-3',
    lg: 'activity-item-lg p-4',
  };

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const iconContainerSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const timeSizes = {
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm',
  };

  // Loading state
  if (isLoading) {
    return <ActivityItemSkeleton size={size} />;
  }

  // Get activity details
  const description = getActivityDescription(activity);
  const relativeTime = formatRelativeTime(activity.timestamp);
  const label = getActivityLabel(activity.type);

  // Determine if clickable
  const isClickable = !!onClick;
  const clickableClasses = isClickable
    ? 'cursor-pointer hover:bg-aged-bronze/5 transition-colors'
    : '';

  // Accessibility props
  const accessibilityProps = isClickable
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.(activity);
          }
        },
      }
    : {
        role: 'listitem' as const,
      };

  const handleClick = () => {
    if (onClick) {
      onClick(activity);
    }
  };

  return (
    <div
      data-testid="activity-feed-item"
      className={`activity-item rounded-lg bg-parchment-cream/30 border border-aged-bronze/10 ${sizeClasses[size]} ${clickableClasses}`}
      onClick={handleClick}
      {...accessibilityProps}
    >
      <div className="flex items-start gap-3">
        {/* Icon Container */}
        <div
          className={`${iconContainerSizes[size]} rounded-full bg-burnished-gold/10 flex items-center justify-center flex-shrink-0`}
        >
          {getIconComponent(activity.type, `${iconSizes[size]} text-burnished-gold`)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Activity Label (unless compact) */}
          {!compact && (
            <span className="text-xs text-aged-bronze uppercase tracking-wide font-medium">
              {label}
            </span>
          )}

          {/* Description */}
          <p className={`fantasy-body text-midnight-ink ${textSizes[size]} leading-snug`}>
            {description}
          </p>

          {/* Relative Time */}
          <span className={`fantasy-body text-aged-bronze/70 ${timeSizes[size]}`}>
            {relativeTime}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ActivityFeedItem;
