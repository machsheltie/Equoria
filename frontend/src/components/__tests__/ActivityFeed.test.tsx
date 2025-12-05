/**
 * ActivityFeed Component Tests
 *
 * Comprehensive tests for the activity feed container including:
 * - List rendering
 * - Loading state
 * - Empty state
 * - Filtering
 *
 * Story 2.5: Activity Feed - AC-1, AC-4, AC-5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActivityFeed from '../ActivityFeed';
import { ActivityType, type Activity } from '../../lib/activity-utils';

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockActivities: Activity[] = [
    {
      id: '1',
      type: ActivityType.TRAINING,
      timestamp: new Date('2025-01-15T11:00:00Z'),
      data: { horseName: 'Thunder', skill: 'Speed', level: 5 },
    },
    {
      id: '2',
      type: ActivityType.BREEDING,
      timestamp: new Date('2025-01-15T10:00:00Z'),
      data: { horseName: 'Storm', foalName: 'Lightning' },
    },
    {
      id: '3',
      type: ActivityType.COMPETITION,
      timestamp: new Date('2025-01-15T09:00:00Z'),
      data: { horseName: 'Blaze', competitionName: 'Derby', placement: 1 },
    },
  ];

  describe('List Rendering (AC-1)', () => {
    it('should render the activity feed container', () => {
      render(<ActivityFeed activities={mockActivities} />);
      expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
    });

    it('should render all activities', () => {
      render(<ActivityFeed activities={mockActivities} />);
      expect(screen.getAllByTestId('activity-feed-item')).toHaveLength(3);
    });

    it('should display title when provided', () => {
      render(<ActivityFeed activities={mockActivities} title="Recent Activity" />);
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    it('should use default title when not provided', () => {
      render(<ActivityFeed activities={mockActivities} />);
      expect(screen.getByText('Activity Feed')).toBeInTheDocument();
    });

    it('should render activities in correct order (newest first)', () => {
      render(<ActivityFeed activities={mockActivities} />);
      const items = screen.getAllByTestId('activity-feed-item');
      expect(items[0]).toHaveTextContent(/Thunder/);
      expect(items[1]).toHaveTextContent(/Storm/);
      expect(items[2]).toHaveTextContent(/Blaze/);
    });
  });

  describe('Loading State (AC-4)', () => {
    it('should display loading skeletons when isLoading is true', () => {
      render(<ActivityFeed activities={[]} isLoading />);
      expect(screen.getAllByTestId('activity-item-skeleton').length).toBeGreaterThan(0);
    });

    it('should display 3 loading skeletons by default', () => {
      render(<ActivityFeed activities={[]} isLoading />);
      expect(screen.getAllByTestId('activity-item-skeleton')).toHaveLength(3);
    });

    it('should display custom number of loading skeletons', () => {
      render(<ActivityFeed activities={[]} isLoading loadingCount={5} />);
      expect(screen.getAllByTestId('activity-item-skeleton')).toHaveLength(5);
    });

    it('should not display activities when loading', () => {
      render(<ActivityFeed activities={mockActivities} isLoading />);
      expect(screen.queryAllByTestId('activity-feed-item')).toHaveLength(0);
    });
  });

  describe('Empty State (AC-5)', () => {
    it('should display empty state when no activities', () => {
      render(<ActivityFeed activities={[]} />);
      expect(screen.getByTestId('activity-feed-empty')).toBeInTheDocument();
    });

    it('should display default empty message', () => {
      render(<ActivityFeed activities={[]} />);
      expect(screen.getByText(/No recent activity/i)).toBeInTheDocument();
    });

    it('should display custom empty message', () => {
      render(<ActivityFeed activities={[]} emptyMessage="Nothing to show" />);
      expect(screen.getByText('Nothing to show')).toBeInTheDocument();
    });

    it('should not display empty state when activities exist', () => {
      render(<ActivityFeed activities={mockActivities} />);
      expect(screen.queryByTestId('activity-feed-empty')).not.toBeInTheDocument();
    });

    it('should not display empty state when loading', () => {
      render(<ActivityFeed activities={[]} isLoading />);
      expect(screen.queryByTestId('activity-feed-empty')).not.toBeInTheDocument();
    });
  });

  describe('Max Items', () => {
    it('should limit displayed activities to maxItems', () => {
      render(<ActivityFeed activities={mockActivities} maxItems={2} />);
      expect(screen.getAllByTestId('activity-feed-item')).toHaveLength(2);
    });

    it('should display all activities when maxItems exceeds total', () => {
      render(<ActivityFeed activities={mockActivities} maxItems={10} />);
      expect(screen.getAllByTestId('activity-feed-item')).toHaveLength(3);
    });

    it('should display "View All" link when activities exceed maxItems', () => {
      render(<ActivityFeed activities={mockActivities} maxItems={2} showViewAll />);
      expect(screen.getByText(/View All/i)).toBeInTheDocument();
    });

    it('should not display "View All" when all activities shown', () => {
      render(<ActivityFeed activities={mockActivities} maxItems={10} showViewAll />);
      expect(screen.queryByText(/View All/i)).not.toBeInTheDocument();
    });
  });

  describe('Filter by Type', () => {
    it('should filter activities by type', () => {
      render(<ActivityFeed activities={mockActivities} filterType={ActivityType.TRAINING} />);
      expect(screen.getAllByTestId('activity-feed-item')).toHaveLength(1);
      expect(screen.getByText(/Thunder/)).toBeInTheDocument();
    });

    it('should show empty state when filter returns no results', () => {
      render(<ActivityFeed activities={mockActivities} filterType={ActivityType.SALE} />);
      expect(screen.getByTestId('activity-feed-empty')).toBeInTheDocument();
    });

    it('should show all activities when filterType is undefined', () => {
      render(<ActivityFeed activities={mockActivities} />);
      expect(screen.getAllByTestId('activity-feed-item')).toHaveLength(3);
    });
  });

  describe('Size Variants', () => {
    it('should render with small size', () => {
      render(<ActivityFeed activities={mockActivities} size="sm" />);
      const container = screen.getByTestId('activity-feed');
      expect(container).toHaveClass('activity-feed-sm');
    });

    it('should render with medium size (default)', () => {
      render(<ActivityFeed activities={mockActivities} />);
      const container = screen.getByTestId('activity-feed');
      expect(container).toHaveClass('activity-feed-md');
    });

    it('should render with large size', () => {
      render(<ActivityFeed activities={mockActivities} size="lg" />);
      const container = screen.getByTestId('activity-feed');
      expect(container).toHaveClass('activity-feed-lg');
    });
  });

  describe('Compact Mode', () => {
    it('should pass compact prop to items', () => {
      render(<ActivityFeed activities={mockActivities} compact />);
      // In compact mode, labels should not be visible
      expect(screen.queryByText('Training')).not.toBeInTheDocument();
      expect(screen.queryByText('Breeding')).not.toBeInTheDocument();
    });
  });

  describe('Click Handler', () => {
    it('should call onItemClick when activity is clicked', () => {
      const handleClick = vi.fn();
      render(<ActivityFeed activities={mockActivities} onItemClick={handleClick} />);
      const items = screen.getAllByTestId('activity-feed-item');
      items[0].click();
      expect(handleClick).toHaveBeenCalledWith(mockActivities[0]);
    });
  });

  describe('Accessibility', () => {
    it('should have list role on container', () => {
      render(<ActivityFeed activities={mockActivities} />);
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('should have accessible title', () => {
      render(<ActivityFeed activities={mockActivities} title="Recent Activity" />);
      expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined activities gracefully', () => {
      render(<ActivityFeed activities={undefined as unknown as Activity[]} />);
      expect(screen.getByTestId('activity-feed-empty')).toBeInTheDocument();
    });

    it('should handle null activities gracefully', () => {
      render(<ActivityFeed activities={null as unknown as Activity[]} />);
      expect(screen.getByTestId('activity-feed-empty')).toBeInTheDocument();
    });

    it('should handle activities with string timestamps', () => {
      const activitiesWithStringTimestamps = [
        {
          id: '1',
          type: ActivityType.TRAINING,
          timestamp: '2025-01-15T11:00:00Z',
          data: { horseName: 'Thunder', skill: 'Speed', level: 5 },
        },
      ];
      render(<ActivityFeed activities={activitiesWithStringTimestamps as Activity[]} />);
      expect(screen.getByTestId('activity-feed-item')).toBeInTheDocument();
    });
  });
});
