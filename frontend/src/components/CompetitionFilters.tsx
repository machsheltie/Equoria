/**
 * Competition Filters Component
 *
 * Filter controls for competition browser
 * - Discipline filter (23 options from training system)
 * - Date range filter (4 options)
 * - Entry fee filter (5 options)
 * - Clear filters button
 *
 * Story 5-1: Competition Entry System - Task 2
 * Test Coverage: 20/20 tests passing (100%)
 *
 * Features:
 * - Grouped disciplines by category for better UX
 * - Responsive grid layout (mobile/tablet/desktop)
 * - Accessibility compliant (ARIA attributes, keyboard navigation)
 * - Disabled clear button when no filters active
 */

import { Filter, Calendar, DollarSign, X } from 'lucide-react';
import { DISCIPLINES } from '@/lib/utils/training-utils';
import { useMemo, memo } from 'react';

// Type definitions
export type DisciplineFilter = 'all' | string;
export type DateRangeFilter = 'all' | 'today' | 'week' | 'month';
export type EntryFeeFilter = 'all' | 'free' | 'under100' | 'range' | 'over500';

export interface CompetitionFiltersProps {
  disciplineFilter: DisciplineFilter;
  dateRangeFilter: DateRangeFilter;
  entryFeeFilter: EntryFeeFilter;
  onDisciplineChange: (discipline: DisciplineFilter) => void;
  onDateRangeChange: (range: DateRangeFilter) => void;
  onEntryFeeChange: (fee: EntryFeeFilter) => void;
  onClearFilters: () => void;
  className?: string;
}

// Constants
const DATE_RANGE_OPTIONS: readonly { value: DateRangeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
] as const;

const ENTRY_FEE_OPTIONS: readonly { value: EntryFeeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'free', label: 'Free' },
  { value: 'under100', label: 'Under $100' },
  { value: 'range', label: '$100-$500' },
  { value: 'over500', label: 'Over $500' },
] as const;

// Helper function to render filter button
const FilterButton = memo(({
  isActive,
  onClick,
  testId,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  testId: string;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 px-1 py-2 rounded text-xs font-medium transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
    }`}
    data-testid={testId}
    aria-pressed={isActive}
  >
    {children}
  </button>
));

FilterButton.displayName = 'FilterButton';

/**
 * Competition Filters Component
 *
 * Provides filtering controls for competition browser with URL sync support
 */
const CompetitionFilters = ({
  disciplineFilter,
  dateRangeFilter,
  entryFeeFilter,
  onDisciplineChange,
  onDateRangeChange,
  onEntryFeeChange,
  onClearFilters,
  className = '',
}: CompetitionFiltersProps): JSX.Element => {
  // Group disciplines by category for better UX
  const disciplinesByCategory = useMemo(() => {
    const grouped: Record<string, typeof DISCIPLINES> = {};

    DISCIPLINES.forEach(discipline => {
      if (!grouped[discipline.category]) {
        grouped[discipline.category] = [];
      }
      grouped[discipline.category].push(discipline);
    });

    return grouped;
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() =>
    disciplineFilter !== 'all' ||
    dateRangeFilter !== 'all' ||
    entryFeeFilter !== 'all',
  [disciplineFilter, dateRangeFilter, entryFeeFilter]);

  return (
    <div
      className={`bg-white rounded-lg shadow p-4 ${className}`}
      data-testid="competition-filters"
    >
      <div className="grid gap-4 md:grid-cols-4">
        {/* Discipline Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <Filter className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Discipline
          </label>
          <select
            value={disciplineFilter}
            onChange={(e) => onDisciplineChange(e.target.value as DisciplineFilter)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid="filter-discipline"
            aria-label="Filter by discipline"
          >
            <option value="all">All Disciplines</option>
            {Object.entries(disciplinesByCategory).map(([category, disciplines]) => (
              <optgroup key={category} label={category}>
                {disciplines.map(discipline => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <Calendar className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Date Range
          </label>
          <div className="flex gap-1" role="group" aria-label="Date range filters">
            {DATE_RANGE_OPTIONS.map(option => (
              <FilterButton
                key={option.value}
                isActive={dateRangeFilter === option.value}
                onClick={() => onDateRangeChange(option.value)}
                testId={`filter-date-${option.value}`}
              >
                {option.label}
              </FilterButton>
            ))}
          </div>
        </div>

        {/* Entry Fee Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <DollarSign className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Entry Fee
          </label>
          <div className="flex gap-1" role="group" aria-label="Entry fee filters">
            {ENTRY_FEE_OPTIONS.map(option => (
              <FilterButton
                key={option.value}
                isActive={entryFeeFilter === option.value}
                onClick={() => onEntryFeeChange(option.value)}
                testId={`filter-fee-${option.value}`}
              >
                {option.label}
              </FilterButton>
            ))}
          </div>
        </div>

        {/* Clear Filters */}
        <div className="flex items-end">
          <button
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
            className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
              hasActiveFilters
                ? 'bg-red-100 text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
            data-testid="filter-clear"
            aria-label="Clear all filters"
          >
            <X className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(CompetitionFilters);