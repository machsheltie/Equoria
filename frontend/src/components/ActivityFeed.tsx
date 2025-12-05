/**
 * Activity Feed Component
 *
 * Container component that displays a list of user activities.
 * Supports loading state, empty state, filtering, and pagination.
 *
 * Story 2.5: Activity Feed - AC-1, AC-4, AC-5
 */

import React from 'react';
import { Clock } from 'lucide-react';
import ActivityFeedItem from './ActivityFeedItem';
import { ActivityType, sortActivitiesByDate, type Activity } from '../lib/activity-utils';

interface ActivityFeedProps {
  /** Array of activities to display */
  activities: Activity[];
  /** Feed title */
  title?: string;
  /** Show loading state */
  isLoading?: boolean;
  /** Number of loading skeletons to show */
  loadingCount?: number;
  /** Message to show when no activities */
  emptyMessage?: string;
  /** Maximum number of items to display */
  maxItems?: number;
  /** Show "View All" link when items exceed maxItems */
  showViewAll?: boolean;
  /** Filter activities by type */
  filterType?: ActivityType;
  /** Component size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Compact mode - hides activity labels */
  compact?: boolean;
  /** Click handler for activity items */
  onItemClick?: (activity: Activity) => void;
  /** Click handler for "View All" */
  onViewAllClick?: () => void;
}

/**
 * Loading skeleton for activity items
 */
const ActivityLoadingSkeleton: React.FC<{ count: number; size: 'sm' | 'md' | 'lg' }> = ({
  count,
  size,
}) => {
  const sizeClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
  };

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          data-testid="activity-item-skeleton"
          className={`activity-item-skeleton animate-pulse rounded-lg bg-parchment-cream/50 border border-aged-bronze/20 ${sizeClasses[size]}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-aged-bronze/20" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-aged-bronze/20 rounded" />
              <div className="h-3 w-20 bg-aged-bronze/20 rounded" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

/**
 * Empty state component
 */
const ActivityEmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div
    data-testid="activity-feed-empty"
    className="flex flex-col items-center justify-center py-8 text-center"
  >
    <div className="w-12 h-12 rounded-full bg-aged-bronze/10 flex items-center justify-center mb-3">
      <Clock className="w-6 h-6 text-aged-bronze/50" />
    </div>
    <p className="fantasy-body text-aged-bronze/70 text-sm">{message}</p>
  </div>
);

/**
 * Activity Feed Component
 */
const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  title = 'Activity Feed',
  isLoading = false,
  loadingCount = 3,
  emptyMessage = 'No recent activity to show',
  maxItems,
  showViewAll = false,
  filterType,
  size = 'md',
  compact = false,
  onItemClick,
  onViewAllClick,
}) => {
  // Handle null/undefined activities
  const safeActivities = activities || [];

  // Filter activities if filterType is provided
  const filteredActivities = filterType
    ? safeActivities.filter((activity) => activity.type === filterType)
    : safeActivities;

  // Sort activities by date (newest first)
  const sortedActivities = sortActivitiesByDate(filteredActivities, 'desc');

  // Limit to maxItems if specified
  const displayActivities = maxItems
    ? sortedActivities.slice(0, maxItems)
    : sortedActivities;

  // Check if there are more items than displayed
  const hasMore = maxItems && sortedActivities.length > maxItems;

  // Size-based styling
  const sizeClasses = {
    sm: 'activity-feed-sm space-y-2',
    md: 'activity-feed-md space-y-3',
    lg: 'activity-feed-lg space-y-4',
  };

  const titleSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="activity-feed" className={`activity-feed ${sizeClasses[size]}`}>
        <h3
          className={`fantasy-body text-aged-bronze uppercase tracking-wide font-medium ${titleSizes[size]}`}
        >
          {title}
        </h3>
        <div className="space-y-2" role="list" aria-busy="true">
          <ActivityLoadingSkeleton count={loadingCount} size={size} />
        </div>
      </div>
    );
  }

  // Empty state
  if (displayActivities.length === 0) {
    return (
      <div data-testid="activity-feed" className={`activity-feed ${sizeClasses[size]}`}>
        <h3
          role="heading"
          className={`fantasy-body text-aged-bronze uppercase tracking-wide font-medium ${titleSizes[size]}`}
        >
          {title}
        </h3>
        <ActivityEmptyState message={emptyMessage} />
      </div>
    );
  }

  return (
    <div data-testid="activity-feed" className={`activity-feed ${sizeClasses[size]}`}>
      {/* Title */}
      <h3
        role="heading"
        className={`fantasy-body text-aged-bronze uppercase tracking-wide font-medium ${titleSizes[size]}`}
      >
        {title}
      </h3>

      {/* Activity List */}
      <div className="space-y-2" role="list">
        {displayActivities.map((activity) => (
          <ActivityFeedItem
            key={activity.id}
            activity={activity}
            size={size}
            compact={compact}
            onClick={onItemClick}
          />
        ))}
      </div>

      {/* View All Link */}
      {showViewAll && hasMore && (
        <button
          type="button"
          onClick={onViewAllClick}
          className="w-full text-center py-2 text-sm text-burnished-gold hover:text-burnished-gold/80 transition-colors fantasy-body"
        >
          View All ({sortedActivities.length} activities)
        </button>
      )}
    </div>
  );
};

export default ActivityFeed;
