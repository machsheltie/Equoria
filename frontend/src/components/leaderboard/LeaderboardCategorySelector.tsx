/**
 * LeaderboardCategorySelector Component
 *
 * Provides category tabs, time period filter, and discipline selector
 * for the leaderboards page. Supports keyboard navigation, loading states,
 * and full ARIA accessibility.
 *
 * Story 5-5: Leaderboards - Task 1
 */

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
  return (
    <div
      className={`bg-white rounded-lg shadow p-4 ${className}`}
      data-testid="leaderboard-category-selector"
    >
      {/* Category Tabs */}
      <div
        className="flex gap-2 overflow-x-auto pb-2"
        role="tablist"
        aria-label="Leaderboard categories"
      >
        {CATEGORIES.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              disabled={isLoading}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              data-testid={`category-${category}`}
              aria-pressed={isActive}
              role="tab"
              aria-selected={isActive}
            >
              {CATEGORY_LABELS[category]}
            </button>
          );
        })}
      </div>

      {/* Discipline Selector -- only visible when discipline category is active */}
      {selectedCategory === 'discipline' && (
        <div className="mt-3">
          <label htmlFor="discipline-select" className="sr-only">
            Select discipline
          </label>
          <select
            id="discipline-select"
            value={selectedDiscipline || ''}
            onChange={(e) => onDisciplineChange?.(e.target.value)}
            disabled={isLoading}
            className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
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
