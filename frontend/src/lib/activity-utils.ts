/**
 * Activity Utilities
 *
 * Utility functions for activity feed formatting and helpers.
 * Includes time formatting, activity type mapping, and sorting.
 *
 * Story 2.5: Activity Feed - AC-1, AC-2, AC-3, AC-6
 */

/**
 * Activity types representing different user actions
 */
export enum ActivityType {
  BREEDING = 'breeding',
  TRAINING = 'training',
  COMPETITION = 'competition',
  PURCHASE = 'purchase',
  ACHIEVEMENT = 'achievement',
  LEVEL_UP = 'level_up',
  SALE = 'sale',
}

/**
 * Activity data interface
 */
export interface Activity {
  id: string;
  type: ActivityType;
  timestamp: Date | string | number;
  data: Record<string, unknown>;
}

/**
 * Time constants in milliseconds
 */
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;

/**
 * Format a timestamp as a human-readable relative time string.
 * Examples: "Just now", "5 minutes ago", "Yesterday", "2 weeks ago"
 *
 * @param timestamp - Date object, ISO string, or Unix timestamp
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(timestamp: Date | string | number): string {
  let date: Date;

  try {
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return 'Unknown';
    }

    if (isNaN(date.getTime())) {
      return 'Unknown';
    }
  } catch {
    return 'Unknown';
  }

  const now = Date.now();
  const diff = now - date.getTime();

  // Handle future dates
  if (diff < 0) {
    return 'Just now';
  }

  // Less than 1 minute
  if (diff < MINUTE_MS) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diff < HOUR_MS) {
    const minutes = Math.floor(diff / MINUTE_MS);
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }

  // Less than 24 hours
  if (diff < DAY_MS) {
    const hours = Math.floor(diff / HOUR_MS);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }

  // Yesterday (24-48 hours)
  if (diff < 2 * DAY_MS) {
    return 'Yesterday';
  }

  // Less than 1 week
  if (diff < WEEK_MS) {
    const days = Math.floor(diff / DAY_MS);
    return `${days} days ago`;
  }

  // Less than 4 weeks
  if (diff < 4 * WEEK_MS) {
    const weeks = Math.floor(diff / WEEK_MS);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  // Months
  const months = Math.floor(diff / MONTH_MS);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

/**
 * Icon name mapping for each activity type
 */
const ACTIVITY_ICONS: Record<ActivityType, string> = {
  [ActivityType.BREEDING]: 'heart',
  [ActivityType.TRAINING]: 'dumbbell',
  [ActivityType.COMPETITION]: 'trophy',
  [ActivityType.PURCHASE]: 'shopping-cart',
  [ActivityType.ACHIEVEMENT]: 'star',
  [ActivityType.LEVEL_UP]: 'arrow-up',
  [ActivityType.SALE]: 'coins',
};

/**
 * Get the icon name for a given activity type.
 *
 * @param type - Activity type
 * @returns Icon name string (for lucide-react)
 */
export function getActivityIcon(type: ActivityType): string {
  return ACTIVITY_ICONS[type] || 'activity';
}

/**
 * Label mapping for each activity type
 */
const ACTIVITY_LABELS: Record<ActivityType, string> = {
  [ActivityType.BREEDING]: 'Breeding',
  [ActivityType.TRAINING]: 'Training',
  [ActivityType.COMPETITION]: 'Competition',
  [ActivityType.PURCHASE]: 'Purchase',
  [ActivityType.ACHIEVEMENT]: 'Achievement',
  [ActivityType.LEVEL_UP]: 'Level Up',
  [ActivityType.SALE]: 'Sale',
};

/**
 * Get the human-readable label for a given activity type.
 *
 * @param type - Activity type
 * @returns Human-readable label
 */
export function getActivityLabel(type: ActivityType): string {
  return ACTIVITY_LABELS[type] || 'Activity';
}

/**
 * Format ordinal numbers (1st, 2nd, 3rd, etc.)
 */
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Format a number with comma separators
 */
function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/**
 * Generate a human-readable description for an activity.
 *
 * @param activity - Activity object
 * @returns Description string
 */
export function getActivityDescription(activity: Activity): string {
  const { type, data } = activity;

  // Handle null/undefined data
  if (!data || Object.keys(data).length === 0) {
    const label = getActivityLabel(type).toLowerCase();
    return `Completed ${label} activity`;
  }

  switch (type) {
    case ActivityType.BREEDING: {
      const horseName = data.horseName as string;
      const foalName = data.foalName as string;
      if (horseName && foalName) {
        return `Bred ${horseName} and produced ${foalName}`;
      }
      return 'Completed breeding activity';
    }

    case ActivityType.TRAINING: {
      const horseName = data.horseName as string;
      const skill = data.skill as string;
      const level = data.level as number;
      if (horseName && skill && level) {
        return `Trained ${horseName} in ${skill} to level ${level}`;
      }
      return 'Completed training activity';
    }

    case ActivityType.COMPETITION: {
      const horseName = data.horseName as string;
      const competitionName = data.competitionName as string;
      const placement = data.placement as number;
      if (horseName && competitionName && placement) {
        return `${horseName} placed ${getOrdinal(placement)} in ${competitionName}`;
      }
      return 'Completed competition activity';
    }

    case ActivityType.PURCHASE: {
      const horseName = data.horseName as string;
      const price = data.price as number;
      if (horseName && price) {
        return `Purchased ${horseName} for ${formatNumber(price)} coins`;
      }
      return 'Completed purchase activity';
    }

    case ActivityType.ACHIEVEMENT: {
      const achievementName = data.achievementName as string;
      if (achievementName) {
        return `Unlocked achievement: ${achievementName}`;
      }
      return 'Completed achievement activity';
    }

    case ActivityType.LEVEL_UP: {
      const newLevel = data.newLevel as number;
      if (newLevel) {
        return `Reached level ${newLevel}`;
      }
      return 'Completed level_up activity';
    }

    case ActivityType.SALE: {
      const horseName = data.horseName as string;
      const price = data.price as number;
      if (horseName && price) {
        return `Sold ${horseName} for ${formatNumber(price)} coins`;
      }
      return 'Completed sale activity';
    }

    default:
      return 'Completed activity';
  }
}

/**
 * Check if an activity is within the recent threshold.
 *
 * @param activity - Activity to check
 * @param thresholdHours - Number of hours to consider as "recent" (default 24)
 * @returns True if activity is recent
 */
export function isRecentActivity(activity: Activity, thresholdHours: number = 24): boolean {
  const timestamp =
    activity.timestamp instanceof Date
      ? activity.timestamp.getTime()
      : new Date(activity.timestamp).getTime();

  const now = Date.now();
  const diff = now - timestamp;
  const thresholdMs = thresholdHours * HOUR_MS;

  return diff <= thresholdMs;
}

/**
 * Sort activities by timestamp.
 *
 * @param activities - Array of activities to sort
 * @param order - Sort order: 'desc' (newest first) or 'asc' (oldest first)
 * @returns New sorted array (does not mutate original)
 */
export function sortActivitiesByDate(
  activities: Activity[],
  order: 'asc' | 'desc' = 'desc'
): Activity[] {
  return [...activities].sort((a, b) => {
    const timeA =
      a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
    const timeB =
      b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();

    return order === 'desc' ? timeB - timeA : timeA - timeB;
  });
}
