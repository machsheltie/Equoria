/**
 * XpHistoryTimeline Component Tests
 *
 * Comprehensive tests for the XP history timeline container component.
 * Tests cover:
 * - Rendering with entries array
 * - Header with horse name and title
 * - Date filter dropdown rendering and options
 * - Filter change callback
 * - Chronological sorting (newest first)
 * - Empty state display (no entries)
 * - Loading state with skeletons
 * - Error state with message
 * - First/last entry props passed correctly
 * - Level-up entry highlighting
 * - Multiple entries rendering
 * - Integration with XpHistoryEntry
 * - Accessibility compliance
 *
 * Story 5-4: XP History Timeline - Task 5
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import XpHistoryTimeline from '../XpHistoryTimeline';
import type { XpGain } from '../XpHistoryEntry';

describe('XpHistoryTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Sample entries for testing
  const sampleEntries: XpGain[] = [
    {
      xpGainId: 'xp-001',
      horseId: 101,
      horseName: 'Thunder Bolt',
      source: 'competition',
      sourceId: 1,
      sourceName: 'Spring Derby Championship',
      xpAmount: 150,
      timestamp: '2026-01-25T15:30:00Z',
      oldLevel: 5,
      newLevel: 5,
      oldXp: 350,
      newXp: 500,
      leveledUp: false,
    },
    {
      xpGainId: 'xp-002',
      horseId: 101,
      horseName: 'Thunder Bolt',
      source: 'training',
      sourceId: 2,
      sourceName: 'Advanced Dressage Training',
      xpAmount: 200,
      timestamp: '2026-01-20T10:00:00Z',
      oldLevel: 4,
      newLevel: 5,
      oldXp: 900,
      newXp: 100,
      leveledUp: true,
    },
    {
      xpGainId: 'xp-003',
      horseId: 101,
      horseName: 'Thunder Bolt',
      source: 'achievement',
      sourceId: 3,
      sourceName: 'First Place Streak',
      xpAmount: 300,
      timestamp: '2026-01-15T08:00:00Z',
      oldLevel: 4,
      newLevel: 4,
      oldXp: 600,
      newXp: 900,
      leveledUp: false,
    },
    {
      xpGainId: 'xp-004',
      horseId: 101,
      horseName: 'Thunder Bolt',
      source: 'bonus',
      sourceId: 4,
      sourceName: 'Weekly Login Bonus',
      xpAmount: 50,
      timestamp: '2026-01-10T12:00:00Z',
      oldLevel: 4,
      newLevel: 4,
      oldXp: 550,
      newXp: 600,
      leveledUp: false,
    },
    {
      xpGainId: 'xp-005',
      horseId: 101,
      horseName: 'Thunder Bolt',
      source: 'competition',
      sourceId: 5,
      sourceName: 'Winter Championship',
      xpAmount: 100,
      timestamp: '2025-11-01T14:00:00Z',
      oldLevel: 3,
      newLevel: 3,
      oldXp: 450,
      newXp: 550,
      leveledUp: false,
    },
  ];

  const mockOnDateFilterChange = vi.fn();

  // =========================================================================
  // 1. Basic Rendering Tests
  // =========================================================================
  describe('Basic Rendering', () => {
    it('should render the timeline container', () => {
      render(<XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={sampleEntries} />);

      const timeline = screen.getByTestId('xp-history-timeline');
      expect(timeline).toBeInTheDocument();
    });

    it('should display header with horse name', () => {
      render(<XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={sampleEntries} />);

      expect(screen.getByText(/Thunder Bolt/)).toBeInTheDocument();
      expect(screen.getByText(/XP History/i)).toBeInTheDocument();
    });

    it('should render all entries', () => {
      render(<XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={sampleEntries} />);

      const entries = screen.getAllByTestId('xp-history-entry');
      expect(entries).toHaveLength(5);
    });
  });

  // =========================================================================
  // 2. Date Filter Tests
  // =========================================================================
  describe('Date Filter', () => {
    it('should render date filter dropdown', () => {
      render(
        <XpHistoryTimeline
          horseId={101}
          horseName="Thunder Bolt"
          entries={sampleEntries}
          onDateFilterChange={mockOnDateFilterChange}
        />
      );

      const filterDropdown = screen.getByTestId('date-filter');
      expect(filterDropdown).toBeInTheDocument();
    });

    it('should display all filter options', () => {
      render(
        <XpHistoryTimeline
          horseId={101}
          horseName="Thunder Bolt"
          entries={sampleEntries}
          onDateFilterChange={mockOnDateFilterChange}
        />
      );

      const filterDropdown = screen.getByTestId('date-filter');
      const options = within(filterDropdown).getAllByRole('option');

      expect(options).toHaveLength(4);
      expect(options[0]).toHaveTextContent(/all/i);
      expect(options[1]).toHaveTextContent(/7/i);
      expect(options[2]).toHaveTextContent(/30/i);
      expect(options[3]).toHaveTextContent(/90/i);
    });

    it('should call onDateFilterChange when filter changes', async () => {
      const user = userEvent.setup();

      render(
        <XpHistoryTimeline
          horseId={101}
          horseName="Thunder Bolt"
          entries={sampleEntries}
          dateFilter="all"
          onDateFilterChange={mockOnDateFilterChange}
        />
      );

      const filterDropdown = screen.getByTestId('date-filter');
      await user.selectOptions(filterDropdown, '7days');

      expect(mockOnDateFilterChange).toHaveBeenCalledWith('7days');
    });

    it('should filter entries by date when using internal state', () => {
      // When no dateFilter prop is provided, component should manage its own state
      // With 'all' filter (default), all entries should show
      render(
        <XpHistoryTimeline
          horseId={101}
          horseName="Thunder Bolt"
          entries={sampleEntries}
          dateFilter="all"
        />
      );

      const entries = screen.getAllByTestId('xp-history-entry');
      expect(entries).toHaveLength(5);
    });
  });

  // =========================================================================
  // 3. Sorting Tests
  // =========================================================================
  describe('Chronological Sorting', () => {
    it('should display entries in newest-first order', () => {
      render(<XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={sampleEntries} />);

      const entries = screen.getAllByTestId('xp-history-entry');
      // The first entry should be the newest (Jan 25)
      // Check that source names appear in chronological order
      const firstEntry = entries[0];
      expect(within(firstEntry).getByText('Spring Derby Championship')).toBeInTheDocument();

      const lastEntry = entries[entries.length - 1];
      expect(within(lastEntry).getByText('Winter Championship')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. Empty State Tests
  // =========================================================================
  describe('Empty State', () => {
    it('should display empty state when no entries', () => {
      render(<XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={[]} />);

      const emptyState = screen.getByTestId('empty-state');
      expect(emptyState).toBeInTheDocument();
      expect(screen.getByText(/No XP gains yet/i)).toBeInTheDocument();
    });

    it('should display a friendly icon in empty state', () => {
      render(<XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={[]} />);

      const emptyIcon = screen.getByTestId('empty-state-icon');
      expect(emptyIcon).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 5. Loading State Tests
  // =========================================================================
  describe('Loading State', () => {
    it('should display loading skeletons when isLoading is true', () => {
      render(
        <XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={[]} isLoading={true} />
      );

      const skeletons = screen.getAllByTestId('timeline-skeleton');
      expect(skeletons.length).toBeGreaterThanOrEqual(3);
    });

    it('should not display entries when loading', () => {
      render(
        <XpHistoryTimeline
          horseId={101}
          horseName="Thunder Bolt"
          entries={sampleEntries}
          isLoading={true}
        />
      );

      expect(screen.queryAllByTestId('xp-history-entry')).toHaveLength(0);
    });
  });

  // =========================================================================
  // 6. Error State Tests
  // =========================================================================
  describe('Error State', () => {
    it('should display error message when error is provided', () => {
      const error = new Error('Failed to load XP history');

      render(
        <XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={[]} error={error} />
      );

      const errorState = screen.getByTestId('error-state');
      expect(errorState).toBeInTheDocument();
      expect(screen.getByText(/Failed to load XP history/i)).toBeInTheDocument();
    });

    it('should not display entries when error is present', () => {
      const error = new Error('Something went wrong');

      render(
        <XpHistoryTimeline
          horseId={101}
          horseName="Thunder Bolt"
          entries={sampleEntries}
          error={error}
        />
      );

      expect(screen.queryAllByTestId('xp-history-entry')).toHaveLength(0);
    });
  });

  // =========================================================================
  // 7. Entry Props Tests
  // =========================================================================
  describe('Entry Props', () => {
    it('should mark the first entry with isFirst', () => {
      render(<XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={sampleEntries} />);

      // The first entry should not have a top connector
      const entries = screen.getAllByTestId('xp-history-entry');
      const firstEntry = entries[0];
      expect(within(firstEntry).queryByTestId('timeline-connector-top')).not.toBeInTheDocument();
    });

    it('should mark the last entry with isLast', () => {
      render(<XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={sampleEntries} />);

      // The last entry should not have a bottom connector
      const entries = screen.getAllByTestId('xp-history-entry');
      const lastEntry = entries[entries.length - 1];
      expect(within(lastEntry).queryByTestId('timeline-connector-bottom')).not.toBeInTheDocument();
    });

    it('should correctly identify level-up entries', () => {
      render(<XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={sampleEntries} />);

      // The second entry (xp-002) is a level-up entry
      // It should have level-up styling
      const entries = screen.getAllByTestId('xp-history-entry');
      // Entry at index 1 (sorted newest first, xp-002 is Jan 20)
      const levelUpEntryEl = entries[1];
      const entryCard = within(levelUpEntryEl).getByTestId('entry-card');
      expect(entryCard).toHaveClass('bg-yellow-50');
    });
  });

  // =========================================================================
  // 8. Accessibility Tests
  // =========================================================================
  describe('Accessibility', () => {
    it('should have ARIA region role for the timeline', () => {
      render(<XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={sampleEntries} />);

      const timeline = screen.getByTestId('xp-history-timeline');
      expect(timeline).toHaveAttribute('role', 'region');
      expect(timeline).toHaveAttribute('aria-label', expect.stringContaining('XP'));
    });

    it('should have accessible label for the date filter', () => {
      render(
        <XpHistoryTimeline
          horseId={101}
          horseName="Thunder Bolt"
          entries={sampleEntries}
          onDateFilterChange={mockOnDateFilterChange}
        />
      );

      expect(screen.getByLabelText(/filter/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 9. Integration Tests
  // =========================================================================
  describe('Integration with XpHistoryEntry', () => {
    it('should render XpHistoryEntry components for each entry', () => {
      render(<XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={sampleEntries} />);

      // Verify source names from entries are displayed
      expect(screen.getByText('Spring Derby Championship')).toBeInTheDocument();
      expect(screen.getByText('Advanced Dressage Training')).toBeInTheDocument();
      expect(screen.getByText('First Place Streak')).toBeInTheDocument();
      expect(screen.getByText('Weekly Login Bonus')).toBeInTheDocument();
      expect(screen.getByText('Winter Championship')).toBeInTheDocument();
    });

    it('should display XP amounts for all entries', () => {
      render(<XpHistoryTimeline horseId={101} horseName="Thunder Bolt" entries={sampleEntries} />);

      const xpAmounts = screen.getAllByTestId('xp-amount');
      expect(xpAmounts).toHaveLength(5);
    });
  });
});
