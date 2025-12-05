/**
 * ActivityFeedItem Component Tests
 *
 * Comprehensive tests for the activity feed item component including:
 * - Activity display with icon and timestamp
 * - Different activity types
 * - Loading state
 * - Click handlers
 *
 * Story 2.5: Activity Feed - AC-1, AC-2, AC-3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActivityFeedItem from '../ActivityFeedItem';
import { ActivityType, type Activity } from '../../lib/activity-utils';

describe('ActivityFeedItem', () => {
  beforeEach(() => {
    // Mock Date.now to a fixed time
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockActivity: Activity = {
    id: '1',
    type: ActivityType.TRAINING,
    timestamp: new Date('2025-01-15T11:00:00Z'), // 1 hour ago
    data: { horseName: 'Thunder', skill: 'Speed', level: 5 },
  };

  describe('Activity Display (AC-1)', () => {
    it('should render the activity item', () => {
      render(<ActivityFeedItem activity={mockActivity} />);
      expect(screen.getByTestId('activity-feed-item')).toBeInTheDocument();
    });

    it('should display the activity description', () => {
      render(<ActivityFeedItem activity={mockActivity} />);
      expect(screen.getByText(/Trained Thunder in Speed to level 5/i)).toBeInTheDocument();
    });

    it('should display the relative time', () => {
      render(<ActivityFeedItem activity={mockActivity} />);
      expect(screen.getByText('1 hour ago')).toBeInTheDocument();
    });

    it('should display the activity type label', () => {
      render(<ActivityFeedItem activity={mockActivity} />);
      expect(screen.getByText('Training')).toBeInTheDocument();
    });
  });

  describe('Activity Icons (AC-6)', () => {
    it('should display icon for BREEDING type', () => {
      const activity: Activity = {
        id: '1',
        type: ActivityType.BREEDING,
        timestamp: new Date(),
        data: { horseName: 'Storm', foalName: 'Lightning' },
      };
      render(<ActivityFeedItem activity={activity} />);
      expect(screen.getByTestId('activity-icon')).toHaveAttribute('data-icon', 'heart');
    });

    it('should display icon for TRAINING type', () => {
      render(<ActivityFeedItem activity={mockActivity} />);
      expect(screen.getByTestId('activity-icon')).toHaveAttribute('data-icon', 'dumbbell');
    });

    it('should display icon for COMPETITION type', () => {
      const activity: Activity = {
        id: '1',
        type: ActivityType.COMPETITION,
        timestamp: new Date(),
        data: { horseName: 'Blaze', competitionName: 'Derby', placement: 1 },
      };
      render(<ActivityFeedItem activity={activity} />);
      expect(screen.getByTestId('activity-icon')).toHaveAttribute('data-icon', 'trophy');
    });

    it('should display icon for PURCHASE type', () => {
      const activity: Activity = {
        id: '1',
        type: ActivityType.PURCHASE,
        timestamp: new Date(),
        data: { horseName: 'Star', price: 5000 },
      };
      render(<ActivityFeedItem activity={activity} />);
      expect(screen.getByTestId('activity-icon')).toHaveAttribute('data-icon', 'shopping-cart');
    });

    it('should display icon for ACHIEVEMENT type', () => {
      const activity: Activity = {
        id: '1',
        type: ActivityType.ACHIEVEMENT,
        timestamp: new Date(),
        data: { achievementName: 'First Win' },
      };
      render(<ActivityFeedItem activity={activity} />);
      expect(screen.getByTestId('activity-icon')).toHaveAttribute('data-icon', 'star');
    });

    it('should display icon for LEVEL_UP type', () => {
      const activity: Activity = {
        id: '1',
        type: ActivityType.LEVEL_UP,
        timestamp: new Date(),
        data: { newLevel: 10 },
      };
      render(<ActivityFeedItem activity={activity} />);
      expect(screen.getByTestId('activity-icon')).toHaveAttribute('data-icon', 'arrow-up');
    });

    it('should display icon for SALE type', () => {
      const activity: Activity = {
        id: '1',
        type: ActivityType.SALE,
        timestamp: new Date(),
        data: { horseName: 'Comet', price: 3000 },
      };
      render(<ActivityFeedItem activity={activity} />);
      expect(screen.getByTestId('activity-icon')).toHaveAttribute('data-icon', 'coins');
    });
  });

  describe('Time Display (AC-3)', () => {
    it('should display "Just now" for very recent activities', () => {
      const activity: Activity = {
        ...mockActivity,
        timestamp: new Date('2025-01-15T11:59:30Z'), // 30 seconds ago
      };
      render(<ActivityFeedItem activity={activity} />);
      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('should display minutes ago', () => {
      const activity: Activity = {
        ...mockActivity,
        timestamp: new Date('2025-01-15T11:55:00Z'), // 5 minutes ago
      };
      render(<ActivityFeedItem activity={activity} />);
      expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
    });

    it('should display hours ago', () => {
      const activity: Activity = {
        ...mockActivity,
        timestamp: new Date('2025-01-15T09:00:00Z'), // 3 hours ago
      };
      render(<ActivityFeedItem activity={activity} />);
      expect(screen.getByText('3 hours ago')).toBeInTheDocument();
    });

    it('should display "Yesterday"', () => {
      const activity: Activity = {
        ...mockActivity,
        timestamp: new Date('2025-01-14T12:00:00Z'), // 24 hours ago
      };
      render(<ActivityFeedItem activity={activity} />);
      expect(screen.getByText('Yesterday')).toBeInTheDocument();
    });

    it('should display days ago', () => {
      const activity: Activity = {
        ...mockActivity,
        timestamp: new Date('2025-01-12T12:00:00Z'), // 3 days ago
      };
      render(<ActivityFeedItem activity={activity} />);
      expect(screen.getByText('3 days ago')).toBeInTheDocument();
    });
  });

  describe('Loading State (AC-4)', () => {
    it('should display loading skeleton when isLoading is true', () => {
      render(<ActivityFeedItem activity={mockActivity} isLoading />);
      expect(screen.getByTestId('activity-item-skeleton')).toBeInTheDocument();
    });

    it('should not display description when loading', () => {
      render(<ActivityFeedItem activity={mockActivity} isLoading />);
      expect(screen.queryByText(/Trained Thunder/)).not.toBeInTheDocument();
    });

    it('should not display icon when loading', () => {
      render(<ActivityFeedItem activity={mockActivity} isLoading />);
      expect(screen.queryByTestId('activity-icon')).not.toBeInTheDocument();
    });

    it('should not display timestamp when loading', () => {
      render(<ActivityFeedItem activity={mockActivity} isLoading />);
      expect(screen.queryByText('1 hour ago')).not.toBeInTheDocument();
    });
  });

  describe('Click Handler', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<ActivityFeedItem activity={mockActivity} onClick={handleClick} />);
      fireEvent.click(screen.getByTestId('activity-feed-item'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should pass activity to onClick', () => {
      const handleClick = vi.fn();
      render(<ActivityFeedItem activity={mockActivity} onClick={handleClick} />);
      fireEvent.click(screen.getByTestId('activity-feed-item'));
      expect(handleClick).toHaveBeenCalledWith(mockActivity);
    });

    it('should have cursor-pointer when clickable', () => {
      render(<ActivityFeedItem activity={mockActivity} onClick={() => {}} />);
      const item = screen.getByTestId('activity-feed-item');
      expect(item).toHaveClass('cursor-pointer');
    });

    it('should not have cursor-pointer when not clickable', () => {
      render(<ActivityFeedItem activity={mockActivity} />);
      const item = screen.getByTestId('activity-feed-item');
      expect(item).not.toHaveClass('cursor-pointer');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible role', () => {
      render(<ActivityFeedItem activity={mockActivity} />);
      const item = screen.getByTestId('activity-feed-item');
      expect(item).toHaveAttribute('role', 'listitem');
    });

    it('should have role="button" when clickable', () => {
      render(<ActivityFeedItem activity={mockActivity} onClick={() => {}} />);
      const item = screen.getByTestId('activity-feed-item');
      expect(item).toHaveAttribute('role', 'button');
    });

    it('should be keyboard accessible when clickable', () => {
      const handleClick = vi.fn();
      render(<ActivityFeedItem activity={mockActivity} onClick={handleClick} />);
      const item = screen.getByTestId('activity-feed-item');
      expect(item).toHaveAttribute('tabIndex', '0');
    });

    it('should trigger onClick on Enter key', () => {
      const handleClick = vi.fn();
      render(<ActivityFeedItem activity={mockActivity} onClick={handleClick} />);
      const item = screen.getByTestId('activity-feed-item');
      fireEvent.keyDown(item, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should trigger onClick on Space key', () => {
      const handleClick = vi.fn();
      render(<ActivityFeedItem activity={mockActivity} onClick={handleClick} />);
      const item = screen.getByTestId('activity-feed-item');
      fireEvent.keyDown(item, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Size Variants', () => {
    it('should render with small size', () => {
      render(<ActivityFeedItem activity={mockActivity} size="sm" />);
      const item = screen.getByTestId('activity-feed-item');
      expect(item).toHaveClass('activity-item-sm');
    });

    it('should render with medium size (default)', () => {
      render(<ActivityFeedItem activity={mockActivity} />);
      const item = screen.getByTestId('activity-feed-item');
      expect(item).toHaveClass('activity-item-md');
    });

    it('should render with large size', () => {
      render(<ActivityFeedItem activity={mockActivity} size="lg" />);
      const item = screen.getByTestId('activity-feed-item');
      expect(item).toHaveClass('activity-item-lg');
    });
  });

  describe('Compact Mode', () => {
    it('should hide activity label in compact mode', () => {
      render(<ActivityFeedItem activity={mockActivity} compact />);
      expect(screen.queryByText('Training')).not.toBeInTheDocument();
    });

    it('should show activity label in non-compact mode', () => {
      render(<ActivityFeedItem activity={mockActivity} />);
      expect(screen.getByText('Training')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle activity with empty data', () => {
      const activity: Activity = {
        id: '1',
        type: ActivityType.TRAINING,
        timestamp: new Date(),
        data: {},
      };
      render(<ActivityFeedItem activity={activity} />);
      expect(screen.getByText(/Completed training activity/i)).toBeInTheDocument();
    });

    it('should handle string timestamp', () => {
      const activity = {
        ...mockActivity,
        timestamp: '2025-01-15T11:00:00Z',
      };
      render(<ActivityFeedItem activity={activity as Activity} />);
      expect(screen.getByText('1 hour ago')).toBeInTheDocument();
    });
  });
});
