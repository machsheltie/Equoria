/**
 * LeaderboardCategorySelector Component
 *
 * Provides category tabs, time period filter, and discipline selector
 * for the leaderboards page.
 *
 * Category tabs use the canonical Radix-backed Tabs (CanonicalTabs underline
 * variant — DECISIONS.md §6, Equoria-o5hub.11). Radix supplies the tab
 * accessibility semantics, selection state, and arrow-key navigation; the
 * component stays controlled via selectedCategory + onCategoryChange. The
 * time-period row is intentionally NOT tabs — it is a button-group filter
 * (role="group", aria-pressed).
 *
 * Story 5-5: Leaderboards - Task 1
 */

import { DISCIPLINES } from '../../lib/utils/training-utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';
import { Select } from '@/components/ui/form';

/**
 * The boards of the leaderboard redesign (Equoria-y3nia, owner rulings q10, q11,
 * q40): four player boards, four horse boards and one board per discipline.
 */
export type LeaderboardCategory =
  | 'player-xp'
  | 'player-earnings'
  | 'player-wins'
  | 'player-win-rate'
  | 'horse-points'
  | 'horse-earnings'
  | 'horse-wins'
  | 'horse-win-rate'
  | 'discipline';

/**
 * The two periods every board has: counted over the whole game, or over the
 * current game month (Eastern time).
 */
export type TimePeriod = 'overall' | 'monthly';

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
  'player-xp': 'Player XP',
  'player-earnings': 'Player Earnings',
  'player-wins': 'Player Wins',
  'player-win-rate': 'Player Win %',
  'horse-points': 'Horse Points',
  'horse-earnings': 'Horse Earnings',
  'horse-wins': 'Horse Wins',
  'horse-win-rate': 'Horse Win %',
  discipline: 'By Discipline',
};

/**
 * Ordered list of categories for rendering.
 */
const CATEGORIES: LeaderboardCategory[] = [
  'player-xp',
  'player-earnings',
  'player-wins',
  'player-win-rate',
  'horse-points',
  'horse-earnings',
  'horse-wins',
  'horse-win-rate',
  'discipline',
];

/**
 * Human-readable labels for each time period.
 */
const PERIOD_LABELS: Record<TimePeriod, string> = {
  overall: 'Overall',
  monthly: 'Monthly',
};

/**
 * Ordered list of time periods for rendering.
 */
const PERIODS: TimePeriod[] = ['overall', 'monthly'];

/**
 * LeaderboardCategorySelector displays category tabs, a time period filter,
 * and a conditional discipline dropdown when the discipline category is selected.
 *
 * Features:
 * - Nine category tabs (CanonicalTabs underline variant, controlled)
 * - Overall and Monthly period buttons
 * - Discipline dropdown (visible only for discipline category)
 * - Loading state that disables all controls
 * - Radix-provided tablist/tab semantics + arrow-key navigation
 * - Responsive horizontal scroll on mobile (CanonicalTabs overflow handling)
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
      className={`glass-panel rounded-lg p-4 ${className}`}
      data-testid="leaderboard-category-selector"
    >
      {/* Category Tabs — canonical Radix tabs, controlled by the parent page */}
      <Tabs
        value={selectedCategory}
        onValueChange={(value) => onCategoryChange(value as LeaderboardCategory)}
      >
        <TabsList aria-label="Leaderboard categories">
          {CATEGORIES.map((category) => (
            <TabsTrigger
              key={category}
              value={category}
              disabled={isLoading}
              data-testid={`category-${category}`}
            >
              {CATEGORY_LABELS[category]}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Panels — only the discipline category has in-component content
            (the discipline dropdown). The leaderboard rows for every category
            are rendered by the parent page below this selector. */}
        {CATEGORIES.map((category) => (
          <TabsContent key={category} value={category}>
            {category === 'discipline' && (
              <div>
                <label htmlFor="discipline-select" className="sr-only">
                  Select discipline
                </label>
                <Select
                  id="discipline-select"
                  value={selectedDiscipline || ''}
                  onChange={(e) => onDisciplineChange?.(e.target.value)}
                  disabled={isLoading}
                  className="md:w-64"
                  data-testid="discipline-selector"
                  aria-label="Select discipline"
                >
                  {DISCIPLINES.map((disc) => (
                    <option key={disc.id} value={disc.id}>
                      {disc.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Every board has an Overall and a Monthly reading, so the filter always filters. */}
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
                  ? 'bg-[var(--status-info)] text-[var(--text-primary)]'
                  : 'bg-[rgba(15,35,70,0.5)] text-slate-400 hover:bg-[rgba(37,99,235,0.2)]'
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
