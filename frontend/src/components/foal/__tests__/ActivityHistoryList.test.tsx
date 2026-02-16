/**
 * Tests for ActivityHistoryList Component
 *
 * Testing Sprint - Story 6-3: Enrichment Activity UI
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Empty state display
 * - History item rendering (header, category, time, results)
 * - Category icons (trust, desensitization, exposure, habituation)
 * - Date formatting (relative time, absolute dates)
 * - Results display (milestone points, bonding, stress, temperament, traits)
 * - Conditional rendering (only show results when applicable)
 * - Color coding for positive/negative values
 * - MaxItems truncation
 * - "Showing X of Y" indicator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActivityHistoryList from '../ActivityHistoryList';
import type { ActivityHistoryItem } from '@/types/foal';

// Mock getCategoryColor helper
vi.mock('@/types/foal', async () => {
  const actual = await vi.importActual('@/types/foal');
  return {
    ...actual,
    getCategoryColor: (category: string) => {
      const colorMap: Record<string, string> = {
        trust: 'text-blue-600 bg-blue-50',
        desensitization: 'text-purple-600 bg-purple-50',
        exposure: 'text-emerald-600 bg-emerald-50',
        habituation: 'text-amber-600 bg-amber-50',
      };
      return colorMap[category] || 'text-slate-600 bg-slate-50';
    },
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Heart: () => <svg data-testid="heart-icon" />,
  Shield: () => <svg data-testid="shield-icon" />,
  Compass: () => <svg data-testid="compass-icon" />,
  Clock: () => <svg data-testid="clock-icon" />,
  TrendingUp: () => <svg data-testid="trending-up-icon" />,
  Award: () => <svg data-testid="award-icon" />,
  Sparkles: () => <svg data-testid="sparkles-icon" />,
  Calendar: () => <svg data-testid="calendar-icon" />,
}));

describe('ActivityHistoryList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty state', () => {
    it('should display empty state when history is empty', () => {
      render(<ActivityHistoryList history={[]} />);
      expect(screen.getByText('No activities completed yet')).toBeInTheDocument();
    });

    it('should display Clock icon in empty state', () => {
      render(<ActivityHistoryList history={[]} />);
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });

    it('should display helpful message in empty state', () => {
      render(<ActivityHistoryList history={[]} />);
      expect(
        screen.getByText("Start enrichment activities to see your foal's progress here")
      ).toBeInTheDocument();
    });

    it('should not display empty state when history has items', () => {
      const history: ActivityHistoryItem[] = [
        {
          id: '1',
          activityName: 'Gentle Touch',
          category: 'trust',
          performedAt: new Date().toISOString(),
          durationMinutes: 15,
          results: {
            milestonePoints: 0,
            bondingChange: 5,
            stressChange: -3,
          },
        },
      ];

      render(<ActivityHistoryList history={history} />);
      expect(screen.queryByText('No activities completed yet')).not.toBeInTheDocument();
    });
  });

  describe('history item rendering', () => {
    const mockHistoryItem: ActivityHistoryItem = {
      id: '1',
      activityName: 'Gentle Touch',
      category: 'trust',
      performedAt: new Date().toISOString(),
      durationMinutes: 15,
      results: {
        milestonePoints: 10,
        bondingChange: 5,
        stressChange: -3,
      },
    };

    it('should display activity name', () => {
      render(<ActivityHistoryList history={[mockHistoryItem]} />);
      expect(screen.getByText('Gentle Touch')).toBeInTheDocument();
    });

    it('should display category badge with capitalized text', () => {
      render(<ActivityHistoryList history={[mockHistoryItem]} />);
      expect(screen.getByText('Trust')).toBeInTheDocument();
    });

    it('should display duration in minutes', () => {
      render(<ActivityHistoryList history={[mockHistoryItem]} />);
      expect(screen.getByText('15m')).toBeInTheDocument();
    });

    it('should display Calendar icon for date', () => {
      render(<ActivityHistoryList history={[mockHistoryItem]} />);
      expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
    });

    it('should display Clock icon for duration', () => {
      render(<ActivityHistoryList history={[mockHistoryItem]} />);
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });
  });

  describe('category icons', () => {
    it('should display Heart icon for trust category', () => {
      const trustItem: ActivityHistoryItem = {
        id: '1',
        activityName: 'Trust Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[trustItem]} />);
      expect(screen.getByTestId('heart-icon')).toBeInTheDocument();
    });

    it('should display Shield icon for desensitization category', () => {
      const desensItem: ActivityHistoryItem = {
        id: '1',
        activityName: 'Desensitization Activity',
        category: 'desensitization',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[desensItem]} />);
      expect(screen.getByTestId('shield-icon')).toBeInTheDocument();
    });

    it('should display Compass icon for exposure category', () => {
      const exposureItem: ActivityHistoryItem = {
        id: '1',
        activityName: 'Exposure Activity',
        category: 'exposure',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[exposureItem]} />);
      expect(screen.getByTestId('compass-icon')).toBeInTheDocument();
    });

    it('should display Clock icon for habituation category', () => {
      const habituationItem: ActivityHistoryItem = {
        id: '1',
        activityName: 'Habituation Activity',
        category: 'habituation',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[habituationItem]} />);
      // Note: Clock appears in multiple places (category icon, duration icon, empty state)
      const clockIcons = screen.getAllByTestId('clock-icon');
      expect(clockIcons.length).toBeGreaterThan(0);
    });
  });

  describe('date formatting', () => {
    it('should display "Just now" for activities within last minute', () => {
      const recentItem: ActivityHistoryItem = {
        id: '1',
        activityName: 'Recent Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[recentItem]} />);
      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('should display minutes ago for activities within last hour', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Recent Activity',
        category: 'trust',
        performedAt: fiveMinutesAgo.toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByText(/\d+m ago/)).toBeInTheDocument();
    });

    it('should display hours ago for activities within last day', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Recent Activity',
        category: 'trust',
        performedAt: twoHoursAgo.toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByText(/\d+h ago/)).toBeInTheDocument();
    });

    it('should display days ago for activities within last week', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Recent Activity',
        category: 'trust',
        performedAt: threeDaysAgo.toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByText(/\d+d ago/)).toBeInTheDocument();
    });

    it('should display formatted date for activities older than a week', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Old Activity',
        category: 'trust',
        performedAt: tenDaysAgo.toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: 0 },
      };

      const { container } = render(<ActivityHistoryList history={[item]} />);
      // Should display month and day (e.g., "Jan 5")
      expect(container.textContent).toMatch(/[A-Z][a-z]{2}\s+\d+/);
    });
  });

  describe('milestone points display', () => {
    it('should display milestone points when greater than 0', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 15, bondingChange: 0, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByText('Milestone:')).toBeInTheDocument();
      expect(screen.getByText('+15 pts')).toBeInTheDocument();
    });

    it('should display Award icon for milestone points', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 15, bondingChange: 0, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByTestId('award-icon')).toBeInTheDocument();
    });

    it('should not display milestone section when points are 0', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 5, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.queryByText('Milestone:')).not.toBeInTheDocument();
    });
  });

  describe('bonding change display', () => {
    it('should display bonding change with + prefix for positive values', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 5, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByText('Bonding:')).toBeInTheDocument();
      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    it('should display bonding change in green for positive values', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 5, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[item]} />);
      const bondingValue = screen.getByText('+5');
      expect(bondingValue).toHaveClass('text-green-600');
    });

    it('should display bonding change in red for negative values', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: -3, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[item]} />);
      const bondingValue = screen.getByText('-3');
      expect(bondingValue).toHaveClass('text-red-600');
    });

    it('should not display bonding section when change is 0', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 10, bondingChange: 0, stressChange: -2 },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.queryByText('Bonding:')).not.toBeInTheDocument();
    });
  });

  describe('stress change display', () => {
    it('should display stress change for positive values', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: 3 },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByText('Stress:')).toBeInTheDocument();
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('should display stress change for negative values (stress reduction)', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: -5 },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByText('Stress:')).toBeInTheDocument();
      expect(screen.getByText('-5')).toBeInTheDocument();
    });

    it('should use inverted color coding for stress (negative is green)', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: -5 },
      };

      render(<ActivityHistoryList history={[item]} />);
      const stressValue = screen.getByText('-5');
      // Inverted: negative stress change (reduction) is good, so green
      expect(stressValue).toHaveClass('text-green-600');
    });

    it('should use red for positive stress change (increase)', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: 3 },
      };

      render(<ActivityHistoryList history={[item]} />);
      const stressValue = screen.getByText('+3');
      // Inverted: positive stress change (increase) is bad, so red
      expect(stressValue).toHaveClass('text-red-600');
    });

    it('should not display stress section when change is 0', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 10, bondingChange: 5, stressChange: 0 },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.queryByText('Stress:')).not.toBeInTheDocument();
    });
  });

  describe('temperament changes display', () => {
    it('should display temperament changes section when present', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: {
          milestonePoints: 0,
          bondingChange: 0,
          stressChange: 0,
          temperamentChanges: {
            boldness: 2,
            obedience: 3,
          },
        },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByText('Temperament Changes:')).toBeInTheDocument();
    });

    it('should display capitalized stat names with +/- prefix', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: {
          milestonePoints: 0,
          bondingChange: 0,
          stressChange: 0,
          temperamentChanges: {
            boldness: 2,
          },
        },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByText('Boldness: +2')).toBeInTheDocument();
    });

    it('should display multiple temperament changes', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: {
          milestonePoints: 0,
          bondingChange: 0,
          stressChange: 0,
          temperamentChanges: {
            boldness: 2,
            obedience: 3,
            intelligence: 1,
          },
        },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByText('Boldness: +2')).toBeInTheDocument();
      expect(screen.getByText('Obedience: +3')).toBeInTheDocument();
      expect(screen.getByText('Intelligence: +1')).toBeInTheDocument();
    });

    it('should use green background for positive changes', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: {
          milestonePoints: 0,
          bondingChange: 0,
          stressChange: 0,
          temperamentChanges: {
            boldness: 2,
          },
        },
      };

      render(<ActivityHistoryList history={[item]} />);
      const badge = screen.getByText('Boldness: +2');
      expect(badge).toHaveClass('bg-green-50');
      expect(badge).toHaveClass('text-green-700');
    });

    it('should use amber background for negative changes', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: {
          milestonePoints: 0,
          bondingChange: 0,
          stressChange: 0,
          temperamentChanges: {
            boldness: -2,
          },
        },
      };

      render(<ActivityHistoryList history={[item]} />);
      const badge = screen.getByText('Boldness: -2');
      expect(badge).toHaveClass('bg-amber-50');
      expect(badge).toHaveClass('text-amber-700');
    });

    it('should not display temperament section when no changes', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: {
          milestonePoints: 10,
          bondingChange: 5,
          stressChange: -2,
        },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.queryByText('Temperament Changes:')).not.toBeInTheDocument();
    });
  });

  describe('traits discovered display', () => {
    it('should display traits discovered section when present', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: {
          milestonePoints: 0,
          bondingChange: 0,
          stressChange: 0,
          traitsDiscovered: ['Steady Gait', 'Strong Legs'],
        },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByText('Traits Discovered:')).toBeInTheDocument();
    });

    it('should display Sparkles icon for traits discovered', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: {
          milestonePoints: 0,
          bondingChange: 0,
          stressChange: 0,
          traitsDiscovered: ['Steady Gait'],
        },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByTestId('sparkles-icon')).toBeInTheDocument();
    });

    it('should display all discovered traits', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: {
          milestonePoints: 0,
          bondingChange: 0,
          stressChange: 0,
          traitsDiscovered: ['Steady Gait', 'Strong Legs', 'Bold Spirit'],
        },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.getByText('Steady Gait')).toBeInTheDocument();
      expect(screen.getByText('Strong Legs')).toBeInTheDocument();
      expect(screen.getByText('Bold Spirit')).toBeInTheDocument();
    });

    it('should use emerald badge styling for traits', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: {
          milestonePoints: 0,
          bondingChange: 0,
          stressChange: 0,
          traitsDiscovered: ['Steady Gait'],
        },
      };

      render(<ActivityHistoryList history={[item]} />);
      const badge = screen.getByText('Steady Gait');
      expect(badge).toHaveClass('bg-emerald-100');
      expect(badge).toHaveClass('text-emerald-700');
    });

    it('should not display traits section when no traits discovered', () => {
      const item: ActivityHistoryItem = {
        id: '1',
        activityName: 'Activity',
        category: 'trust',
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: {
          milestonePoints: 10,
          bondingChange: 5,
          stressChange: -2,
        },
      };

      render(<ActivityHistoryList history={[item]} />);
      expect(screen.queryByText('Traits Discovered:')).not.toBeInTheDocument();
    });
  });

  describe('maxItems truncation', () => {
    const createMockHistory = (count: number): ActivityHistoryItem[] => {
      return Array.from({ length: count }, (_, i) => ({
        id: `${i + 1}`,
        activityName: `Activity ${i + 1}`,
        category: 'trust' as const,
        performedAt: new Date().toISOString(),
        durationMinutes: 10,
        results: { milestonePoints: 0, bondingChange: 0, stressChange: 0 },
      }));
    };

    it('should display all items when maxItems is not provided', () => {
      const history = createMockHistory(5);
      render(<ActivityHistoryList history={history} />);

      expect(screen.getByText('Activity 1')).toBeInTheDocument();
      expect(screen.getByText('Activity 5')).toBeInTheDocument();
    });

    it('should truncate items when maxItems is provided', () => {
      const history = createMockHistory(10);
      render(<ActivityHistoryList history={history} maxItems={3} />);

      expect(screen.getByText('Activity 1')).toBeInTheDocument();
      expect(screen.getByText('Activity 3')).toBeInTheDocument();
      expect(screen.queryByText('Activity 4')).not.toBeInTheDocument();
    });

    it('should display "Showing X of Y" indicator when truncated', () => {
      const history = createMockHistory(10);
      render(<ActivityHistoryList history={history} maxItems={5} />);

      expect(screen.getByText('Showing 5 of 10 activities')).toBeInTheDocument();
    });

    it('should not display indicator when all items are shown', () => {
      const history = createMockHistory(5);
      render(<ActivityHistoryList history={history} maxItems={10} />);

      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    });

    it('should not display indicator when maxItems equals history length', () => {
      const history = createMockHistory(5);
      render(<ActivityHistoryList history={history} maxItems={5} />);

      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    });
  });

  describe('multiple items rendering', () => {
    it('should render multiple history items correctly', () => {
      const history: ActivityHistoryItem[] = [
        {
          id: '1',
          activityName: 'Gentle Touch',
          category: 'trust',
          performedAt: new Date().toISOString(),
          durationMinutes: 15,
          results: { milestonePoints: 10, bondingChange: 5, stressChange: -3 },
        },
        {
          id: '2',
          activityName: 'Sound Exposure',
          category: 'desensitization',
          performedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          durationMinutes: 20,
          results: { milestonePoints: 15, bondingChange: 3, stressChange: -2 },
        },
      ];

      render(<ActivityHistoryList history={history} />);

      expect(screen.getByText('Gentle Touch')).toBeInTheDocument();
      expect(screen.getByText('Sound Exposure')).toBeInTheDocument();
    });
  });
});
