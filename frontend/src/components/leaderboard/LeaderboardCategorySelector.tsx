/**
 * LeaderboardCategorySelector Component
 *
 * Provides category tabs, time period filter, and discipline selector
 * for the leaderboards page. Supports keyboard navigation, loading states,
 * and full ARIA accessibility.
 *
 * Story 5-5: Leaderboards - Task 1
 */

import { useRef, useCallback } from 'react';
import { DISCIPLINES } from '../../lib/utils/training-utils';

/**
 * Available leaderboard categories matching backend API values.
 */
export type LeaderboardCategory =
  | 'level'
  | 'prize-money'
  | 'win-rate'
  | 'discipline'
  | 'owner'
  | 'recent-winners';

/**
 * Time period filter options for leaderboard data.
 */
export type TimePeriod = 'all-time' | 'monthly' | 'weekly' | 'daily';

/**
 * Props for the LeaderboardCategorySelector component.
 */
export interface LeaderboardCategorySelectorProps {
  selectedCategory: LeaderboardCategory;
  selectedPeriod: TimePeriod;
  selectedDiscipline?: string;
  onCategoryChange: (_category: LeaderboardCategory) => void;
  onPeriodChange: (_period: TimePeriod) => void;
  onDisciplineChange?: (_discipline: string) => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Human-readable labels for each leaderboard category.
 */
const CATEGORY_LABELS: Record<LeaderboardCategory, string> = {
  level: 'Horse Level',
  'prize-money': 'Prize Money',
  'win-rate': 'Win Rate',
  discipline: 'Discipline',
  owner: 'Owner',
  'recent-winners': 'Recent Winners',
};

/**
 * Ordered list of categories for rendering.
 */
const CATEGORIES: LeaderboardCategory[] = [
  'level',
  'prize-money',
  'win-rate',
  'discipline',
  'owner',
  'recent-winners',
];

/**
 * Human-readable labels for each time period.
 */
const PERIOD_LABELS: Record<TimePeriod, string> = {
  'all-time': 'All-Time',
  monthly: 'Monthly',
  weekly: 'Weekly',
  daily: 'Daily',
};

/**
 * Ordered list of time periods for rendering.
 */
const PERIODS: TimePeriod[] = ['all-time', 'monthly', 'weekly', 'daily'];

/**
 * LeaderboardCategorySelector displays category tabs, a time period filter,
 * and a conditional discipline dropdown when the discipline category is selected.
 *
 * Features:
 * - Six category buttons with active/inactive styling
 * - Four time period buttons
 * - Discipline dropdown (visible only for discipline category)
 * - Loading state that disables all controls
 * - Full ARIA accessibility with tablist role and aria-pressed
 * - Responsive horizontal scroll on mobile
 */
const LeaderboardCategorySelector = ({
  selectedCategory,
  selectedPeriod,
  selectedDiscipline,
  onCategoryChange,
  onPeriodChange,
  onDisciplineChange,
  isLoading = false,
  className = '',
}: LeaderboardCategorySelectorProps) => {
  // Refs to each tab button for keyboard focus management
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * Handle Left/Right arrow key navigation between tabs.
   */
  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const nextIndex = (index + 1) % CATEGORIES.length;
        tabRefs.current[nextIndex]?.focus();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const prevIndex = (index - 1 + CATEGORIES.length) % CATEGORIES.length;
        tabRefs.current[prevIndex]?.focus();
      }
    },
    []
  );

  return (
    <div
      className={`glass-panel rounded-lg p-4 ${className}`}
      data-testid="leaderboard-category-selector"
    >
      {/* Category Tabs */}
      <div
        className="flex gap-2 overflow-x-auto pb-2"
        role="tablist"
        aria-label="Leaderboard categories"
      >
        {CATEGORIES.map((category, index) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              onClick={() => onCategoryChange(category)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              disabled={isLoading}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-500 text-[var(--text-primary)]'
                  : 'bg-[rgba(15,35,70,0.5)] text-[rgb(148,163,184)] hover:bg-[rgba(37,99,235,0.2)]'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              data-testid={`category-${category}`}
              role="tab"
              aria-selected={isActive}
              aria-controls="leaderboard-panel"
              id={`tab-${category}`}
            >
              {CATEGORY_LABELS[category]}
            </button>
          );
        })}
      </div>

      {/* Tabpanel region for the active category content */}
      <div
        role="tabpanel"
        id="leaderboard-panel"
        aria-labelledby={`tab-${selectedCategory}`}
        className="mt-3"
      >
        {/* Discipline Selector -- only visible when discipline category is active */}
        {selectedCategory === 'discipline' && (
          <div>
            <label htmlFor="discipline-select" className="sr-only">
              Select discipline
            </label>
            <select
              id="discipline-select"
              value={selectedDiscipline || ''}
              onChange={(e) => onDisciplineChange?.(e.target.value)}
              disabled={isLoading}
              className="celestial-input w-full md:w-64"
              data-testid="discipline-selector"
              aria-label="Select discipline"
            >
              {DISCIPLINES.map((disc) => (
                <option key={disc.id} value={disc.id}>
                  {disc.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Time Period Filter */}
      <div className="flex gap-2 mt-3" role="group" aria-label="Time period filter">
        {PERIODS.map((period) => {
          const isActive = selectedPeriod === period;
          return (
            <button
              key={period}
              onClick={() => onPeriodChange(period)}
              disabled={isLoading}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-500 text-[var(--text-primary)]'
                  : 'bg-[rgba(15,35,70,0.5)] text-[rgb(148,163,184)] hover:bg-[rgba(37,99,235,0.2)]'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              data-testid={`period-${period}`}
              aria-pressed={isActive}
            >
              {PERIOD_LABELS[period]}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LeaderboardCategorySelector;
