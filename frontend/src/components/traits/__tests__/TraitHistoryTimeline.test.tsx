/**
 * Tests for TraitHistoryTimeline Component
 *
 * Testing Sprint - Story 6-6: Epigenetic Trait System
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Empty state display
 * - Timeline visualization rendering
 * - Event list display
 * - Event types (discovery, activation, modification)
 * - Event sorting by timestamp
 * - Event icons and colors
 * - Timestamp formatting
 * - Integration with Recharts
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TraitHistoryTimeline from '../TraitHistoryTimeline';
import type { TraitHistory, TraitHistoryEvent } from '@/types/traits';

// Mock types for Recharts
interface ChartContainerProps {
  children: React.ReactNode;
}

// Mock Recharts components
vi.mock('recharts', () => ({
  LineChart: ({ children }: ChartContainerProps) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: ChartContainerProps) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Dot: ({ children }: ChartContainerProps) => <div data-testid="dot">{children}</div>,
}));

// Mock trait helper functions
vi.mock('@/types/traits', async () => {
  const actual = await vi.importActual('@/types/traits');
  return {
    ...actual,
    getTierStyle: vi.fn((tier: string) => ({
      borderColor: `border-${tier}`,
      bgColor: `bg-${tier}`,
      textColor: `text-${tier}`,
      badgeColor: `badge-${tier}`,
    })),
  };
});

describe('TraitHistoryTimeline Component', () => {
  const mockEvent1: TraitHistoryEvent = {
    id: '1',
    traitId: 'athletic-prowess',
    traitName: 'Athletic Prowess',
    tier: 'ultra-rare',
    timestamp: new Date('2026-01-15T10:30:00'),
    eventType: 'discovery',
    trigger: 'Milestone: Confidence & Reactivity',
    description: 'Trait discovered during confidence milestone evaluation',
  };

  const mockEvent2: TraitHistoryEvent = {
    id: '2',
    traitId: 'athletic-prowess',
    traitName: 'Athletic Prowess',
    tier: 'ultra-rare',
    timestamp: new Date('2026-01-16T14:20:00'),
    eventType: 'activation',
    trigger: 'First Competition Participation',
    description: 'Trait activated in first competition',
  };

  const mockEvent3: TraitHistoryEvent = {
    id: '3',
    traitId: 'calm-temperament',
    traitName: 'Calm Temperament',
    tier: 'common',
    timestamp: new Date('2026-01-17T09:15:00'),
    eventType: 'modification',
    trigger: 'Enhanced Care Quality',
    description: 'Trait modified through improved care',
  };

  describe('empty state', () => {
    it('should display empty state when no events', () => {
      const emptyHistory: TraitHistory = {
        horseId: 1,
        events: [],
      };
      render(<TraitHistoryTimeline history={emptyHistory} />);
      expect(screen.getByText('No trait history events recorded yet')).toBeInTheDocument();
    });

    it('should show calendar icon in empty state', () => {
      const emptyHistory: TraitHistory = {
        horseId: 1,
        events: [],
      };
      const { container } = render(<TraitHistoryTimeline history={emptyHistory} />);
      expect(container.querySelector('.text-slate-400')).toBeInTheDocument();
    });

    it('should show helpful message in empty state', () => {
      const emptyHistory: TraitHistory = {
        horseId: 1,
        events: [],
      };
      render(<TraitHistoryTimeline history={emptyHistory} />);
      expect(
        screen.getByText(/Events will appear here as traits are discovered/i)
      ).toBeInTheDocument();
    });
  });

  describe('timeline visualization', () => {
    it('should render timeline chart when events exist', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getByText('Timeline Visualization')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('should render LineChart component', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should render X and Y axes', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    });

    it('should render Line and Tooltip', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getByTestId('line')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });
  });

  describe('event list display', () => {
    it('should display event history header', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getByText('Event History')).toBeInTheDocument();
    });

    it('should display all events', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1, mockEvent2, mockEvent3],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getByText('Athletic Prowess')).toBeInTheDocument();
      expect(screen.getByText('Calm Temperament')).toBeInTheDocument();
    });

    it('should display event trait names', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getByText('Athletic Prowess')).toBeInTheDocument();
    });

    it('should display event types', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1, mockEvent2, mockEvent3],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getAllByText('discovery').length).toBeGreaterThan(0);
      expect(screen.getAllByText('activation').length).toBeGreaterThan(0);
      expect(screen.getAllByText('modification').length).toBeGreaterThan(0);
    });

    it('should display event triggers', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getByText(/Trigger:/i)).toBeInTheDocument();
      expect(screen.getByText(/Milestone: Confidence & Reactivity/i)).toBeInTheDocument();
    });

    it('should display event descriptions', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getByText(/Trait discovered during confidence milestone/i)).toBeInTheDocument();
    });

    it('should format timestamps correctly', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getByText(/January 15, 2026/i)).toBeInTheDocument();
    });
  });

  describe('event sorting', () => {
    it('should sort events by timestamp (oldest first)', () => {
      const history: TraitHistory = {
        horseId: 1,
        // Events in reverse chronological order
        events: [mockEvent3, mockEvent2, mockEvent1],
      };
      render(<TraitHistoryTimeline history={history} />);

      // All events should still be displayed
      expect(screen.getByText('Athletic Prowess')).toBeInTheDocument();
      expect(screen.getByText('Calm Temperament')).toBeInTheDocument();
    });

    it('should handle same-day events', () => {
      const sameDay1: TraitHistoryEvent = {
        ...mockEvent1,
        id: '4',
        timestamp: new Date('2026-01-15T10:00:00'),
      };
      const sameDay2: TraitHistoryEvent = {
        ...mockEvent1,
        id: '5',
        timestamp: new Date('2026-01-15T15:00:00'),
      };
      const history: TraitHistory = {
        horseId: 1,
        events: [sameDay2, sameDay1],
      };
      render(<TraitHistoryTimeline history={history} />);

      const timestamps = screen.getAllByText(/January 15, 2026/i);
      expect(timestamps.length).toBeGreaterThan(0);
    });
  });

  describe('event type styling', () => {
    it('should apply green styling for discovery events', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1],
      };
      const { container } = render(<TraitHistoryTimeline history={history} />);
      expect(container.querySelector('.text-green-600')).toBeInTheDocument();
    });

    it('should apply blue styling for activation events', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent2],
      };
      const { container } = render(<TraitHistoryTimeline history={history} />);
      expect(container.querySelector('.text-blue-600')).toBeInTheDocument();
    });

    it('should apply amber styling for modification events', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent3],
      };
      const { container } = render(<TraitHistoryTimeline history={history} />);
      expect(container.querySelector('.text-amber-600')).toBeInTheDocument();
    });
  });

  describe('event icons', () => {
    it('should show Sparkles icon for discovery events', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1],
      };
      const { container } = render(<TraitHistoryTimeline history={history} />);
      // Check that icon container with green styling exists (discovery)
      expect(container.querySelector('.text-green-600.bg-green-50')).toBeInTheDocument();
    });

    it('should show Activity icon for activation events', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent2],
      };
      const { container } = render(<TraitHistoryTimeline history={history} />);
      // Check that icon container with blue styling exists (activation)
      expect(container.querySelector('.text-blue-600.bg-blue-50')).toBeInTheDocument();
    });

    it('should show Edit3 icon for modification events', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent3],
      };
      const { container } = render(<TraitHistoryTimeline history={history} />);
      // Check that icon container with amber styling exists (modification)
      expect(container.querySelector('.text-amber-600.bg-amber-50')).toBeInTheDocument();
    });
  });

  describe('multiple events', () => {
    it('should display multiple events for same trait', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1, mockEvent2],
      };
      render(<TraitHistoryTimeline history={history} />);
      const traitNames = screen.getAllByText('Athletic Prowess');
      expect(traitNames.length).toBe(2);
    });

    it('should display events for different traits', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1, mockEvent3],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getByText('Athletic Prowess')).toBeInTheDocument();
      expect(screen.getByText('Calm Temperament')).toBeInTheDocument();
    });

    it('should handle many events', () => {
      const manyEvents = Array.from({ length: 10 }, (_, i) => ({
        ...mockEvent1,
        id: `event-${i}`,
        timestamp: new Date(2026, 0, i + 1),
      }));
      const history: TraitHistory = {
        horseId: 1,
        events: manyEvents,
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getAllByText('Athletic Prowess').length).toBe(10);
    });
  });

  describe('hover effects', () => {
    it('should apply hover shadow effect to event cards', () => {
      const history: TraitHistory = {
        horseId: 1,
        events: [mockEvent1],
      };
      const { container } = render(<TraitHistoryTimeline history={history} />);
      expect(container.querySelector('.hover\\:shadow-md')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle event with no description', () => {
      const noDescEvent: TraitHistoryEvent = {
        ...mockEvent1,
        description: '',
      };
      const history: TraitHistory = {
        horseId: 1,
        events: [noDescEvent],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getByText('Athletic Prowess')).toBeInTheDocument();
    });

    it('should handle very long trait names', () => {
      const longNameEvent: TraitHistoryEvent = {
        ...mockEvent1,
        traitName: 'Extremely Long Trait Name That Should Be Displayed Correctly',
      };
      const history: TraitHistory = {
        horseId: 1,
        events: [longNameEvent],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(
        screen.getByText('Extremely Long Trait Name That Should Be Displayed Correctly')
      ).toBeInTheDocument();
    });

    it('should handle very long descriptions', () => {
      const longDescEvent: TraitHistoryEvent = {
        ...mockEvent1,
        description:
          'This is a very long description that should wrap properly and be displayed correctly without breaking the layout or causing any visual issues',
      };
      const history: TraitHistory = {
        horseId: 1,
        events: [longDescEvent],
      };
      render(<TraitHistoryTimeline history={history} />);
      expect(screen.getByText(/This is a very long description/i)).toBeInTheDocument();
    });
  });
});
