/**
 * Competition Filters Component
 *
 * Filter controls for competition browser
 * - Discipline filter (24 options from training system)
 * - Date range filter (4 options)
 * - Entry fee filter (5 options)
 * - Level filter (levels 1 to 20, Equoria-i33ow)
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
 *
 * NOTE: Relocated from frontend/src/components/CompetitionFilters.tsx to this directory
 * for consistency with other competition components.
 */

import { Filter, Calendar, Coins, Award, X } from 'lucide-react';
import { DISCIPLINES } from '@/lib/utils/training-utils';
import { Select } from '@/components/ui/form';
import { type JSX, useMemo, memo } from 'react';
import type {
  DisciplineFilter,
  DateRangeFilter,
  EntryFeeFilter,
  LevelFilter,
} from '@/lib/utils/competition-filters';

// Type definitions (the rules behind them live in lib/utils/competition-filters)
export type { DisciplineFilter, DateRangeFilter, EntryFeeFilter, LevelFilter };

export interface CompetitionFiltersProps {
  disciplineFilter: DisciplineFilter;
  dateRangeFilter: DateRangeFilter;
  entryFeeFilter: EntryFeeFilter;
  onDisciplineChange: (_discipline: DisciplineFilter) => void;
  onDateRangeChange: (_range: DateRangeFilter) => void;
  onEntryFeeChange: (_fee: EntryFeeFilter) => void;
  /** The show level searched for (Equoria-i33ow); 'all' when none is chosen. */
  levelFilter?: LevelFilter;
  onLevelChange?: (_level: LevelFilter) => void;
  onClearFilters: () => void;
  className?: string;
}

// Constants
const DATE_RANGE_OPTIONS: readonly { value: DateRangeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'closing', label: 'Closing <24h' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
] as const;

// Entry fees are in coins, the game's currency (Equoria-oey96.12). The visible
// label stays short for the narrow control; `title` and the aria-label say coins.
const ENTRY_FEE_OPTIONS: readonly {
  value: EntryFeeFilter;
  label: string;
  coins: string;
}[] = [
  { value: 'all', label: 'All', coins: 'Any entry fee' },
  { value: 'free', label: 'Free', coins: 'Free entry' },
  { value: 'under100', label: 'Under 100', coins: 'Under 100 coins' },
  { value: 'range', label: '100-500', coins: '100 to 500 coins' },
  { value: 'over500', label: 'Over 500', coins: 'Over 500 coins' },
] as const;

// Horse and show levels run 1 to 20 (owner ruling 2026-10-23).
const levelOptions: readonly number[] = Array.from({ length: 20 }, (_, index) => index + 1);

// Helper function to render filter button
const FilterButton = memo(
  ({
    isActive,
    onClick,
    testId,
    spokenLabel,
    children,
  }: {
    isActive: boolean;
    onClick: () => void;
    testId: string;
    spokenLabel?: string;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className={`flex-1 px-1 py-2 rounded text-xs font-medium transition-colors ${
        isActive
          ? 'bg-[var(--celestial-primary)] text-[var(--text-primary)]'
          : 'bg-[var(--alpha-bg-midnight-50)] text-[var(--text-secondary)] hover:bg-[rgba(15,35,70,0.7)]'
      }`}
      data-testid={testId}
      aria-pressed={isActive}
      aria-label={spokenLabel}
      title={spokenLabel}
    >
      {children}
    </button>
  )
);

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
  levelFilter = 'all',
  onLevelChange,
  onClearFilters,
  className = '',
}: CompetitionFiltersProps): JSX.Element => {
  // Group disciplines by category for better UX
  const disciplinesByCategory = useMemo(() => {
    const grouped: Record<string, typeof DISCIPLINES> = {};

    DISCIPLINES.forEach((discipline) => {
      if (!grouped[discipline.category]) {
        grouped[discipline.category] = [];
      }
      grouped[discipline.category].push(discipline);
    });

    return grouped;
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(
    () =>
      disciplineFilter !== 'all' ||
      dateRangeFilter !== 'all' ||
      entryFeeFilter !== 'all' ||
      levelFilter !== 'all',
    [disciplineFilter, dateRangeFilter, entryFeeFilter, levelFilter]
  );

  return (
    <div className={`glass-panel rounded-lg p-4 ${className}`} data-testid="competition-filters">
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
        {/* Discipline Filter */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            <Filter className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Discipline
          </label>
          <Select
            value={disciplineFilter}
            onChange={(e) => onDisciplineChange(e.target.value as DisciplineFilter)}
            data-testid="filter-discipline"
            aria-label="Filter by discipline"
          >
            <option value="all">All Disciplines</option>
            {Object.entries(disciplinesByCategory).map(([category, disciplines]) => (
              <optgroup key={category} label={category}>
                {disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        {/* Date Range Filter */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            <Calendar className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Date Range
          </label>
          <div className="flex gap-1" role="group" aria-label="Date range filters">
            {DATE_RANGE_OPTIONS.map((option) => (
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
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            <Coins className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Entry Fee
          </label>
          <div className="flex gap-1" role="group" aria-label="Entry fee filters">
            {ENTRY_FEE_OPTIONS.map((option) => (
              <FilterButton
                key={option.value}
                isActive={entryFeeFilter === option.value}
                onClick={() => onEntryFeeChange(option.value)}
                testId={`filter-fee-${option.value}`}
                spokenLabel={option.coins}
              >
                {option.label}
              </FilterButton>
            ))}
          </div>
        </div>

        {/* Level Filter */}
        <div>
          <label
            htmlFor="filter-level"
            className="block text-sm font-medium text-[var(--text-secondary)] mb-2"
          >
            <Award className="inline h-4 w-4 mr-1" aria-hidden="true" />
            Level
          </label>
          <Select
            id="filter-level"
            value={levelFilter === 'all' ? 'all' : String(levelFilter)}
            onChange={(e) =>
              onLevelChange?.(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            data-testid="filter-level"
            aria-label="Filter by level"
          >
            <option value="all">All Levels</option>
            {levelOptions.map((level) => (
              <option key={level} value={level}>
                Level {level}
              </option>
            ))}
          </Select>
        </div>

        {/* Clear Filters */}
        <div className="flex items-end">
          <button
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
            className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
              hasActiveFilters
                ? 'bg-[rgba(239,68,68,0.1)] text-red-400 hover:bg-[rgba(239,68,68,0.2)] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
                : 'bg-[var(--alpha-bg-midnight-50)] text-[var(--text-secondary)] cursor-not-allowed opacity-50'
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
