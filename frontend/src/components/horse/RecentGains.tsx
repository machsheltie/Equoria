/**
 * RecentGains Component
 *
 * Displays recent XP gains with:
 * - Grouping by date
 * - Time range selector (7/30 days)
 * - Visual indicators for gains
 * - Expandable detail view
 * - Sorting options
 * - Summary statistics
 *
 * Story 3-4: XP & Progression Display - Task 3
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ArrowUp } from 'lucide-react';
import { useHorseXPHistory } from '@/hooks/api/useHorseXP';

interface RecentGainsProps {
  horseId: number;
}

type TimeRange = '7d' | '30d';
type SortOption = 'date' | 'amount';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
};

const TIME_RANGE_LIMITS: Record<TimeRange, number> = {
  '7d': 50,
  '30d': 100,
};

interface GroupedGain {
  date: string;
  displayDate: string;
  events: Array<{
    id: number;
    amount: number;
    reason: string;
    timestamp: string;
  }>;
}

const RecentGains = ({ horseId }: RecentGainsProps) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('30d');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const {
    data: historyData,
    isLoading,
    error,
    isError,
    refetch,
  } = useHorseXPHistory(horseId, {
    limit: TIME_RANGE_LIMITS[selectedRange],
  });

  // Handle time range change
  const handleRangeChange = async (range: TimeRange) => {
    setSelectedRange(range);
    await refetch();
  };

  // Toggle expanded state for a gain event
  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Group events by date and optionally sort
  const groupedGains = useMemo(() => {
    if (!historyData || !historyData.events || historyData.events.length === 0) {
      return [];
    }

    // Sort events based on selected option
    const sortedEvents = [...historyData.events].sort((a, b) => {
      if (sortBy === 'amount') {
        return b.amount - a.amount; // Highest first
      }
      // Default: sort by date (newest first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Group by date
    const grouped = new Map<string, GroupedGain>();
    sortedEvents.forEach((event) => {
      const date = new Date(event.timestamp);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, {
          date: dateKey,
          displayDate,
          events: [],
        });
      }

      grouped.get(dateKey)!.events.push(event);
    });

    // Convert to array and sort by date descending (when sorting by date)
    const result = Array.from(grouped.values());
    if (sortBy === 'date') {
      result.sort((a, b) => b.date.localeCompare(a.date));
    }

    return result;
  }, [historyData, sortBy]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (!historyData || !historyData.events) {
      return { total: 0, count: 0, average: 0 };
    }

    const total = historyData.events.reduce((sum, event) => sum + event.amount, 0);
    const count = historyData.events.length;
    const average = count > 0 ? Math.round(total / count) : 0;

    return { total, count, average };
  }, [historyData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-6 shadow-sm">
        <div className="text-center text-sm text-[rgb(148,163,184)]">Loading recent gains...</div>
      </div>
    );
  }

  // Error state
  if (isError || !historyData) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-[rgba(239,68,68,0.1)] p-6 shadow-sm">
        <div className="text-sm text-rose-400">{error?.message || 'Failed to fetch gains'}</div>
        <button
          onClick={() => refetch()}
          className="mt-3 rounded-md bg-rose-600 px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (groupedGains.length === 0) {
    return (
      <div className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-[rgb(220,235,255)]">Recent Gains</h3>
        <div className="text-center text-sm text-[rgb(148,163,184)]">
          No XP gains in the selected time period.
          <br />
          No recent gains available.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-6 shadow-sm">
      {/* Header with controls */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[rgb(220,235,255)]">Recent Gains</h3>

        <div className="flex items-center gap-3">
          {/* Sort selector */}
          <label htmlFor="sort-select" className="text-sm text-[rgb(148,163,184)]">
            Sort by:
          </label>
          <select
            id="sort-select"
            aria-label="Sort by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-md border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.4)] px-2 py-1 text-sm text-[rgb(220,235,255)]"
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
          </select>

          {/* Time Range Selector */}
          <div className="flex gap-2">
            {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => handleRangeChange(range)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedRange === range
                    ? 'bg-emerald-600 text-[var(--text-primary)]'
                    : 'bg-[rgba(15,35,70,0.5)] text-[rgb(148,163,184)] hover:bg-[rgba(15,35,70,0.3)]'
                }`}
                aria-label={TIME_RANGE_LABELS[range]}
              >
                {TIME_RANGE_LABELS[range]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gains list grouped by date */}
      <ul role="list" className="space-y-4">
        {groupedGains.map((group) => (
          <li key={group.date} className="space-y-2">
            {/* Date header */}
            <div className="text-sm font-semibold text-[rgb(148,163,184)]">{group.displayDate}</div>

            {/* Events for this date */}
            <ul className="space-y-1.5">
              {group.events.map((event) => (
                <li
                  key={event.id}
                  className="rounded-md border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.3)] p-3"
                >
                  <button
                    onClick={() => toggleExpanded(event.id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      {/* Up arrow indicator */}
                      <ArrowUp
                        data-testid="arrow-up-icon"
                        className="h-4 w-4 text-emerald-400"
                        aria-hidden="true"
                      />

                      {/* Amount */}
                      <span className="text-lg font-semibold text-emerald-400">
                        +{event.amount}
                      </span>

                      {/* Reason */}
                      <span className="text-sm text-[rgb(220,235,255)]">{event.reason}</span>
                    </div>

                    {/* Expand/collapse icon */}
                    {expandedIds.has(event.id) ? (
                      <ChevronUp className="h-4 w-4 text-[rgb(148,163,184)]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-[rgb(148,163,184)]" />
                    )}
                  </button>

                  {/* Expanded details */}
                  {expandedIds.has(event.id) && (
                    <div className="mt-2 border-t border-[rgba(37,99,235,0.3)] pt-2 text-sm text-[rgb(148,163,184)]">
                      <p>
                        <strong>Time:</strong>{' '}
                        {new Date(event.timestamp).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p>
                        <strong>Full Date:</strong> {event.timestamp.split('T')[0]}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {/* Summary Statistics */}
      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-[rgba(37,99,235,0.3)] pt-4">
        <div className="text-center">
          <p className="text-xs text-[rgb(148,163,184)]">Total XP</p>
          <p className="text-lg font-semibold text-emerald-400">+{stats.total}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[rgb(148,163,184)]">Events</p>
          <p className="text-lg font-semibold text-[rgb(220,235,255)]">{stats.count} events</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[rgb(148,163,184)]">Avg per Event</p>
          <p className="text-lg font-semibold text-[rgb(220,235,255)]">Avg +{stats.average}</p>
        </div>
      </div>
    </div>
  );
};

export default RecentGains;
