/**
 * Activity Utilities Tests
 *
 * Tests for activity feed utility functions including:
 * - Relative time formatting
 * - Activity type helpers
 * - Activity icon mapping
 *
 * Story 2.5: Activity Feed - AC-1, AC-2, AC-3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ActivityType,
  formatRelativeTime,
  getActivityIcon,
  getActivityLabel,
  getActivityDescription,
  isRecentActivity,
  sortActivitiesByDate,
  type Activity,
} from '../activity-utils';

describe('activity-utils', () => {
  describe('ActivityType enum', () => {
    it('should have BREEDING type', () => {
      expect(ActivityType.BREEDING).toBe('breeding');
    });

    it('should have TRAINING type', () => {
      expect(ActivityType.TRAINING).toBe('training');
    });

    it('should have COMPETITION type', () => {
      expect(ActivityType.COMPETITION).toBe('competition');
    });

    it('should have PURCHASE type', () => {
      expect(ActivityType.PURCHASE).toBe('purchase');
    });

    it('should have ACHIEVEMENT type', () => {
      expect(ActivityType.ACHIEVEMENT).toBe('achievement');
    });

    it('should have LEVEL_UP type', () => {
      expect(ActivityType.LEVEL_UP).toBe('level_up');
    });

    it('should have SALE type', () => {
      expect(ActivityType.SALE).toBe('sale');
    });
  });

  describe('formatRelativeTime (AC-3)', () => {
    beforeEach(() => {
      // Mock Date.now to a fixed time: 2025-01-15 12:00:00 UTC
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should format time just now (< 1 minute)', () => {
      const date = new Date('2025-01-15T11:59:30Z'); // 30 seconds ago
      expect(formatRelativeTime(date)).toBe('Just now');
    });

    it('should format time in minutes (< 60 minutes)', () => {
      const date = new Date('2025-01-15T11:55:00Z'); // 5 minutes ago
      expect(formatRelativeTime(date)).toBe('5 minutes ago');
    });

    it('should format singular minute', () => {
      const date = new Date('2025-01-15T11:59:00Z'); // 1 minute ago
      expect(formatRelativeTime(date)).toBe('1 minute ago');
    });

    it('should format time in hours (< 24 hours)', () => {
      const date = new Date('2025-01-15T09:00:00Z'); // 3 hours ago
      expect(formatRelativeTime(date)).toBe('3 hours ago');
    });

    it('should format singular hour', () => {
      const date = new Date('2025-01-15T11:00:00Z'); // 1 hour ago
      expect(formatRelativeTime(date)).toBe('1 hour ago');
    });

    it('should format yesterday', () => {
      const date = new Date('2025-01-14T12:00:00Z'); // exactly 24 hours ago
      expect(formatRelativeTime(date)).toBe('Yesterday');
    });

    it('should format days ago (< 7 days)', () => {
      const date = new Date('2025-01-12T12:00:00Z'); // 3 days ago
      expect(formatRelativeTime(date)).toBe('3 days ago');
    });

    it('should format 2 days ago', () => {
      const date = new Date('2025-01-13T12:00:00Z'); // 2 days ago
      expect(formatRelativeTime(date)).toBe('2 days ago');
    });

    it('should format 1 week ago', () => {
      const date = new Date('2025-01-08T12:00:00Z'); // 7 days ago
      expect(formatRelativeTime(date)).toBe('1 week ago');
    });

    it('should format weeks ago (< 4 weeks)', () => {
      const date = new Date('2025-01-01T12:00:00Z'); // 14 days ago
      expect(formatRelativeTime(date)).toBe('2 weeks ago');
    });

    it('should format 1 month ago', () => {
      const date = new Date('2024-12-15T12:00:00Z'); // ~1 month ago
      expect(formatRelativeTime(date)).toBe('1 month ago');
    });

    it('should format months ago', () => {
      const date = new Date('2024-11-15T12:00:00Z'); // ~2 months ago
      expect(formatRelativeTime(date)).toBe('2 months ago');
    });

    it('should handle string date input', () => {
      const date = '2025-01-15T11:55:00Z'; // 5 minutes ago
      expect(formatRelativeTime(date)).toBe('5 minutes ago');
    });

    it('should handle timestamp number input', () => {
      const timestamp = new Date('2025-01-15T11:55:00Z').getTime();
      expect(formatRelativeTime(timestamp)).toBe('5 minutes ago');
    });

    it('should handle invalid date', () => {
      expect(formatRelativeTime('invalid')).toBe('Unknown');
    });

    it('should handle future dates', () => {
      const date = new Date('2025-01-15T13:00:00Z'); // 1 hour in future
      expect(formatRelativeTime(date)).toBe('Just now');
    });
  });

  describe('getActivityIcon (AC-6)', () => {
    it('should return heart icon for BREEDING', () => {
      expect(getActivityIcon(ActivityType.BREEDING)).toBe('heart');
    });

    it('should return dumbbell icon for TRAINING', () => {
      expect(getActivityIcon(ActivityType.TRAINING)).toBe('dumbbell');
    });

    it('should return trophy icon for COMPETITION', () => {
      expect(getActivityIcon(ActivityType.COMPETITION)).toBe('trophy');
    });

    it('should return shopping-cart icon for PURCHASE', () => {
      expect(getActivityIcon(ActivityType.PURCHASE)).toBe('shopping-cart');
    });

    it('should return star icon for ACHIEVEMENT', () => {
      expect(getActivityIcon(ActivityType.ACHIEVEMENT)).toBe('star');
    });

    it('should return arrow-up icon for LEVEL_UP', () => {
      expect(getActivityIcon(ActivityType.LEVEL_UP)).toBe('arrow-up');
    });

    it('should return coins icon for SALE', () => {
      expect(getActivityIcon(ActivityType.SALE)).toBe('coins');
    });

    it('should return default icon for unknown type', () => {
      expect(getActivityIcon('unknown' as ActivityType)).toBe('activity');
    });
  });

  describe('getActivityLabel (AC-2)', () => {
    it('should return label for BREEDING', () => {
      expect(getActivityLabel(ActivityType.BREEDING)).toBe('Breeding');
    });

    it('should return label for TRAINING', () => {
      expect(getActivityLabel(ActivityType.TRAINING)).toBe('Training');
    });

    it('should return label for COMPETITION', () => {
      expect(getActivityLabel(ActivityType.COMPETITION)).toBe('Competition');
    });

    it('should return label for PURCHASE', () => {
      expect(getActivityLabel(ActivityType.PURCHASE)).toBe('Purchase');
    });

    it('should return label for ACHIEVEMENT', () => {
      expect(getActivityLabel(ActivityType.ACHIEVEMENT)).toBe('Achievement');
    });

    it('should return label for LEVEL_UP', () => {
      expect(getActivityLabel(ActivityType.LEVEL_UP)).toBe('Level Up');
    });

    it('should return label for SALE', () => {
      expect(getActivityLabel(ActivityType.SALE)).toBe('Sale');
    });

    it('should return Activity for unknown type', () => {
      expect(getActivityLabel('unknown' as ActivityType)).toBe('Activity');
    });
  });

  describe('getActivityDescription', () => {
    it('should generate description for BREEDING', () => {
      const activity: Activity = {
        id: '1',
        type: ActivityType.BREEDING,
        timestamp: new Date(),
        data: { horseName: 'Thunder', foalName: 'Lightning' },
      };
      expect(getActivityDescription(activity)).toBe('Bred Thunder and produced Lightning');
    });

    it('should generate description for TRAINING', () => {
      const activity: Activity = {
        id: '2',
        type: ActivityType.TRAINING,
        timestamp: new Date(),
        data: { horseName: 'Storm', skill: 'Speed', level: 5 },
      };
      expect(getActivityDescription(activity)).toBe('Trained Storm in Speed to level 5');
    });

    it('should generate description for COMPETITION', () => {
      const activity: Activity = {
        id: '3',
        type: ActivityType.COMPETITION,
        timestamp: new Date(),
        data: { horseName: 'Blaze', competitionName: 'Derby Cup', placement: 1 },
      };
      expect(getActivityDescription(activity)).toBe('Blaze placed 1st in Derby Cup');
    });

    it('should generate description for PURCHASE', () => {
      const activity: Activity = {
        id: '4',
        type: ActivityType.PURCHASE,
        timestamp: new Date(),
        data: { horseName: 'Star', price: 5000 },
      };
      expect(getActivityDescription(activity)).toBe('Purchased Star for 5,000 coins');
    });

    it('should generate description for ACHIEVEMENT', () => {
      const activity: Activity = {
        id: '5',
        type: ActivityType.ACHIEVEMENT,
        timestamp: new Date(),
        data: { achievementName: 'First Win' },
      };
      expect(getActivityDescription(activity)).toBe('Unlocked achievement: First Win');
    });

    it('should generate description for LEVEL_UP', () => {
      const activity: Activity = {
        id: '6',
        type: ActivityType.LEVEL_UP,
        timestamp: new Date(),
        data: { newLevel: 10 },
      };
      expect(getActivityDescription(activity)).toBe('Reached level 10');
    });

    it('should generate description for SALE', () => {
      const activity: Activity = {
        id: '7',
        type: ActivityType.SALE,
        timestamp: new Date(),
        data: { horseName: 'Comet', price: 3000 },
      };
      expect(getActivityDescription(activity)).toBe('Sold Comet for 3,000 coins');
    });

    it('should handle missing data gracefully', () => {
      const activity: Activity = {
        id: '8',
        type: ActivityType.BREEDING,
        timestamp: new Date(),
        data: {},
      };
      expect(getActivityDescription(activity)).toBe('Completed breeding activity');
    });
  });

  describe('isRecentActivity', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for activity within 24 hours', () => {
      const activity: Activity = {
        id: '1',
        type: ActivityType.TRAINING,
        timestamp: new Date('2025-01-15T10:00:00Z'), // 2 hours ago
        data: {},
      };
      expect(isRecentActivity(activity)).toBe(true);
    });

    it('should return true for activity exactly 24 hours ago', () => {
      const activity: Activity = {
        id: '2',
        type: ActivityType.TRAINING,
        timestamp: new Date('2025-01-14T12:00:00Z'), // 24 hours ago
        data: {},
      };
      expect(isRecentActivity(activity, 24)).toBe(true);
    });

    it('should return false for activity older than threshold', () => {
      const activity: Activity = {
        id: '3',
        type: ActivityType.TRAINING,
        timestamp: new Date('2025-01-14T11:00:00Z'), // 25 hours ago
        data: {},
      };
      expect(isRecentActivity(activity, 24)).toBe(false);
    });

    it('should use custom threshold in hours', () => {
      const activity: Activity = {
        id: '4',
        type: ActivityType.TRAINING,
        timestamp: new Date('2025-01-08T12:00:00Z'), // 7 days ago
        data: {},
      };
      expect(isRecentActivity(activity, 168)).toBe(true); // 168 hours = 7 days
      expect(isRecentActivity(activity, 167)).toBe(false);
    });
  });

  describe('sortActivitiesByDate', () => {
    it('should sort activities by timestamp descending (newest first)', () => {
      const activities: Activity[] = [
        { id: '1', type: ActivityType.TRAINING, timestamp: new Date('2025-01-13'), data: {} },
        { id: '2', type: ActivityType.BREEDING, timestamp: new Date('2025-01-15'), data: {} },
        { id: '3', type: ActivityType.COMPETITION, timestamp: new Date('2025-01-14'), data: {} },
      ];
      const sorted = sortActivitiesByDate(activities);
      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });

    it('should sort activities ascending when specified', () => {
      const activities: Activity[] = [
        { id: '1', type: ActivityType.TRAINING, timestamp: new Date('2025-01-13'), data: {} },
        { id: '2', type: ActivityType.BREEDING, timestamp: new Date('2025-01-15'), data: {} },
        { id: '3', type: ActivityType.COMPETITION, timestamp: new Date('2025-01-14'), data: {} },
      ];
      const sorted = sortActivitiesByDate(activities, 'asc');
      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('2');
    });

    it('should handle empty array', () => {
      expect(sortActivitiesByDate([])).toEqual([]);
    });

    it('should handle single item', () => {
      const activities: Activity[] = [
        { id: '1', type: ActivityType.TRAINING, timestamp: new Date(), data: {} },
      ];
      expect(sortActivitiesByDate(activities)).toHaveLength(1);
    });

    it('should not mutate original array', () => {
      const activities: Activity[] = [
        { id: '1', type: ActivityType.TRAINING, timestamp: new Date('2025-01-13'), data: {} },
        { id: '2', type: ActivityType.BREEDING, timestamp: new Date('2025-01-15'), data: {} },
      ];
      const original = [...activities];
      sortActivitiesByDate(activities);
      expect(activities[0].id).toBe(original[0].id);
    });
  });

  describe('Edge Cases', () => {
    it('should handle Date object timestamps', () => {
      const activity: Activity = {
        id: '1',
        type: ActivityType.TRAINING,
        timestamp: new Date('2025-01-15T12:00:00Z'),
        data: {},
      };
      expect(activity.timestamp instanceof Date).toBe(true);
    });

    it('should handle string timestamps', () => {
      const activity = {
        id: '1',
        type: ActivityType.TRAINING,
        timestamp: '2025-01-15T12:00:00Z',
        data: {},
      };
      expect(typeof activity.timestamp).toBe('string');
    });

    it('should handle null data object', () => {
      const activity: Activity = {
        id: '1',
        type: ActivityType.TRAINING,
        timestamp: new Date(),
        data: null as unknown as Record<string, unknown>,
      };
      expect(getActivityDescription(activity)).toBe('Completed training activity');
    });

    it('should format large placement numbers', () => {
      const activity: Activity = {
        id: '1',
        type: ActivityType.COMPETITION,
        timestamp: new Date(),
        data: { horseName: 'Storm', competitionName: 'Race', placement: 23 },
      };
      expect(getActivityDescription(activity)).toBe('Storm placed 23rd in Race');
    });
  });
});
