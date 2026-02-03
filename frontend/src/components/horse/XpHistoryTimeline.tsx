/**
 * XpHistoryTimeline Component
 *
 * Timeline container that displays a chronological history of XP gains
 * for a horse. Renders XpHistoryEntry components in a vertical timeline
 * layout with date filtering, empty/loading/error states, and accessibility.
 *
 * Features:
 * - Header with horse name and "XP History" title
 * - Date filter dropdown (All, Last 7 days, Last 30 days, Last 90 days)
 * - Vertical timeline visualization with connector lines
 * - Chronological order (newest first)
 * - Empty state with friendly icon and message
 * - Loading state with skeleton timeline entries
 * - Error state with error message display
 * - WCAG 2.1 AA accessible
 *
 * Story 5-4: XP History Timeline - Task 5
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { Trophy, Calendar, AlertCircle } from 'lucide-react';
import XpHistoryEntry from './XpHistoryEntry';
import type { XpGain } from './XpHistoryEntry';

/**
 * Date filter options type
 */
export type DateFilter = 'all' | '7days' | '30days' | '90days';

/**
 * Props for the XpHistoryTimeline component
 */
export interface XpHistoryTimelineProps {
  /** The horse ID */
  horseId: number;
  /** The horse name displayed in the header */
  horseName: string;
  /** Array of XP gain entries to display */
  entries: XpGain[];
  /** Controlled date filter value */
  dateFilter?: DateFilter;
  /** Callback when the date filter changes */
  onDateFilterChange?: (filter: DateFilter) => void;
  /** Whether the data is currently loading */
  isLoading?: boolean;
  /** Error object if data fetching failed */
  error?: Error | null;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Filter entries by date range.
 * Returns entries within the specified time window from now.
 */
function filterEntriesByDate(
  entries: XpGain[],
  filter: DateFilter
): XpGain[] {
  if (filter === 'all') return entries;

  const now = new Date();
  const cutoffDays = filter === '7days' ? 7 : filter === '30days' ? 30 : 90;
  const cutoffDate = new Date(now.getTime() - cutoffDays * 24 * 60 * 60 * 1000);

  return entries.filter((entry) => new Date(entry.timestamp) >= cutoffDate);
}

/**
 * Sort entries by timestamp in descending order (newest first).
 */
function sortEntriesNewestFirst(entries: XpGain[]): XpGain[] {
  return [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Skeleton loading component for a single timeline entry
 */
const TimelineSkeleton = memo(() => (
  <div data-testid="timeline-skeleton" className="relative flex gap-4 animate-pulse">
    {/* Timeline connector column */}
    <div className="relative flex flex-col items-center" aria-hidden="true">
      <div className="w-0.5 flex-1 bg-slate-200" />
      <div className="w-3 h-3 rounded-full bg-slate-300 z-10" />
      <div className="w-0.5 flex-1 bg-slate-200" />
    </div>
    {/* Skeleton card */}
    <div className="flex-1 mb-3 bg-white border border-slate-200 rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="h-4 bg-slate-200 rounded w-32" />
        <div className="h-5 bg-slate-200 rounded-full w-20" />
      </div>
      <div className="h-4 bg-slate-200 rounded w-48 mb-2" />
      <div className="flex items-center justify-between">
        <div className="h-6 bg-slate-200 rounded w-16" />
        <div className="h-4 bg-slate-200 rounded w-20" />
      </div>
    </div>
  </div>
));

TimelineSkeleton.displayName = 'TimelineSkeleton';

/**
 * XpHistoryTimeline - Displays a chronological timeline of XP gain events
 */
const XpHistoryTimeline: React.FC<XpHistoryTimelineProps> = memo(
  ({
    horseId,
    horseName,
    entries,
    dateFilter: controlledDateFilter,
    onDateFilterChange,
    isLoading = false,
    error = null,
    className = '',
  }) => {
    // Internal date filter state for uncontrolled mode
    const [internalDateFilter, setInternalDateFilter] = useState<DateFilter>('all');

    // Use controlled or internal date filter
    const dateFilter = controlledDateFilter ?? internalDateFilter;

    // Handle date filter change
    const handleDateFilterChange = useCallback(
      (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newFilter = event.target.value as DateFilter;

        if (onDateFilterChange) {
          onDateFilterChange(newFilter);
        } else {
          setInternalDateFilter(newFilter);
        }
      },
      [onDateFilterChange]
    );

    // Filter and sort entries
    const processedEntries = useMemo(() => {
      const filtered = filterEntriesByDate(entries, dateFilter);
      return sortEntriesNewestFirst(filtered);
    }, [entries, dateFilter]);

    // Render loading state
    if (isLoading) {
      return (
        <div
          data-testid="xp-history-timeline"
          role="region"
          aria-label={`${horseName} XP History`}
          className={`bg-white rounded-lg shadow-sm border border-slate-200 p-6 ${className}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {horseName} - XP History
            </h2>
          </div>

          {/* Skeleton entries */}
          <div className="space-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <TimelineSkeleton key={`skeleton-${i}`} />
            ))}
          </div>
        </div>
      );
    }

    // Render error state
    if (error) {
      return (
        <div
          data-testid="xp-history-timeline"
          role="region"
          aria-label={`${horseName} XP History`}
          className={`bg-white rounded-lg shadow-sm border border-slate-200 p-6 ${className}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {horseName} - XP History
            </h2>
          </div>

          {/* Error display */}
          <div data-testid="error-state" className="py-8 text-center">
            <AlertCircle
              className="mx-auto h-12 w-12 text-red-400 mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-red-600 font-medium mb-1">
              {error.message}
            </p>
            <p className="text-xs text-slate-500">
              Please try again later.
            </p>
          </div>
        </div>
      );
    }

    // Render empty state
    if (processedEntries.length === 0) {
      return (
        <div
          data-testid="xp-history-timeline"
          role="region"
          aria-label={`${horseName} XP History`}
          className={`bg-white rounded-lg shadow-sm border border-slate-200 p-6 ${className}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {horseName} - XP History
            </h2>
            {/* Date filter - show only when there could be entries */}
            {entries.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor={`date-filter-${horseId}`} className="sr-only">
                  Filter by date range
                </label>
                <Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <select
                  id={`date-filter-${horseId}`}
                  data-testid="date-filter"
                  value={dateFilter}
                  onChange={handleDateFilterChange}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Filter by date range"
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="90days">Last 90 Days</option>
                </select>
              </div>
            )}
          </div>

          {/* Empty state */}
          <div data-testid="empty-state" className="py-12 text-center">
            <div data-testid="empty-state-icon">
              <Trophy
                className="mx-auto h-16 w-16 text-slate-300 mb-4"
                aria-hidden="true"
              />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              No XP gains yet
            </h3>
            <p className="text-sm text-slate-600 max-w-sm mx-auto">
              Train and compete to start earning XP. Your history will appear here.
            </p>
          </div>
        </div>
      );
    }

    // Render timeline with entries
    return (
      <div
        data-testid="xp-history-timeline"
        role="region"
        aria-label={`${horseName} XP History`}
        className={`bg-white rounded-lg shadow-sm border border-slate-200 p-6 ${className}`}
      >
        {/* Header with filter */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {horseName} - XP History
          </h2>

          {/* Date filter dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor={`date-filter-${horseId}`} className="sr-only">
              Filter by date range
            </label>
            <Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <select
              id={`date-filter-${horseId}`}
              data-testid="date-filter"
              value={dateFilter}
              onChange={handleDateFilterChange}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter by date range"
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
            </select>
          </div>
        </div>

        {/* Timeline entries */}
        <div className="space-y-0" role="list" aria-label="XP gain entries">
          {processedEntries.map((entry, index) => (
            <XpHistoryEntry
              key={entry.xpGainId}
              entry={entry}
              isLevelUp={entry.leveledUp}
              isFirst={index === 0}
              isLast={index === processedEntries.length - 1}
            />
          ))}
        </div>
      </div>
    );
  }
);

XpHistoryTimeline.displayName = 'XpHistoryTimeline';

export default XpHistoryTimeline;
