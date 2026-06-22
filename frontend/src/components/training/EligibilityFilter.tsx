/**
 * EligibilityFilter Component
 *
 * Provides filter buttons for training eligibility status:
 * - All Horses: Shows total count
 * - Ready to Train: Shows count of horses that can train (canTrain = true)
 * - On Cooldown: Shows count of horses with active cooldown
 * - Ineligible: Shows count of horses that cannot train (too young/old)
 *
 * Features:
 * - Four filter buttons with optional count display
 * - Active state styling for selected filter
 * - Calculates counts using canTrain() utility
 * - Keyboard accessible with proper button elements
 * - ARIA labels for screen readers
 *
 * Story 4-2: Training Eligibility Display - Task 2
 */

import { type JSX, useMemo } from 'react';
import { canTrain } from '../../lib/utils/training-utils';
import type { Horse } from '../../lib/utils/training-utils';

/**
 * Filter type for eligibility filtering
 */
export type EligibilityFilterType = 'all' | 'ready' | 'cooldown' | 'ineligible';

/**
 * Props for EligibilityFilter component
 */
export interface EligibilityFilterProps {
  /**
   * Array of horses to calculate counts from
   */
  horses: Horse[];

  /**
   * Currently selected filter
   */
  selectedFilter: EligibilityFilterType;

  /**
   * Callback when filter changes
   */
  onFilterChange: (_filter: EligibilityFilterType) => void;

  /**
   * Whether to show count badges on buttons
   * @default true
   */
  showCounts?: boolean;
}

/**
 * Filter configuration with styling
 */
interface FilterConfig {
  key: EligibilityFilterType;
  label: string;
  ariaLabel: string;
  activeClass: string;
}

/**
 * Configuration for each filter button
 */
const filterConfigs: FilterConfig[] = [
  {
    key: 'all',
    label: 'All',
    ariaLabel: 'Show all horses',
    // Equoria-40baz: --celestial-primary (electric-blue-500 #3a6fdd) under
    // --text-primary (#e2e8f0) is only 3.79:1 — fails WCAG AA (4.5:1) for the
    // active filter. The darker --electric-blue-700 (#2a5cb8) is 5.11:1 and
    // stays in the celestial blue family. (celestial-primary is documented in
    // tokens.css as an accent/focus-ring token, NOT a text-bearing button bg.)
    activeClass: 'bg-[var(--electric-blue-700)] text-[var(--text-primary)]',
  },
  {
    key: 'ready',
    label: 'Ready',
    ariaLabel: 'Show horses ready to train',
    activeClass: 'bg-[var(--status-success)] text-[var(--text-primary)]',
  },
  {
    key: 'cooldown',
    label: 'Cooldown',
    ariaLabel: 'Show horses on cooldown',
    activeClass: 'bg-[var(--status-warning)] text-[var(--text-primary)]',
  },
  {
    key: 'ineligible',
    label: 'Ineligible',
    ariaLabel: 'Show ineligible horses',
    activeClass: 'bg-[var(--glass-bg)] text-[var(--text-primary)]',
  },
];

/**
 * Base styling for inactive buttons
 */
const inactiveClass =
  'bg-[var(--role-neutral-bg)] text-[var(--text-primary)] hover:bg-[var(--glass-glow)]';

/**
 * Calculate eligibility counts for horses
 *
 * @param horses - Array of horses to analyze
 * @returns Object with counts for each filter category
 */
function calculateCounts(horses: Horse[]): Record<EligibilityFilterType, number> {
  const counts: Record<EligibilityFilterType, number> = {
    all: horses.length,
    ready: 0,
    cooldown: 0,
    ineligible: 0,
  };

  for (const horse of horses) {
    const result = canTrain(horse);

    if (result.eligible) {
      counts.ready++;
    } else if (result.reason?.toLowerCase().includes('cooldown')) {
      counts.cooldown++;
    } else {
      // Too young, too old, or other ineligible reasons
      counts.ineligible++;
    }
  }

  return counts;
}

/**
 * EligibilityFilter Component
 *
 * Renders filter buttons for horse training eligibility filtering.
 * Calculates and displays counts for each eligibility category.
 */
const EligibilityFilter = ({
  horses,
  selectedFilter,
  onFilterChange,
  showCounts = true,
}: EligibilityFilterProps): JSX.Element => {
  // Calculate counts using useMemo for performance optimization
  const counts = useMemo(() => calculateCounts(horses), [horses]);

  return (
    <div
      data-testid="eligibility-filter"
      role="group"
      aria-label="Filter horses by training eligibility"
      className="flex gap-2 flex-wrap"
    >
      {filterConfigs.map((config) => {
        const isSelected = selectedFilter === config.key;
        const buttonClass = isSelected ? config.activeClass : inactiveClass;
        const count = counts[config.key];

        return (
          <button
            key={config.key}
            type="button"
            data-testid={`filter-${config.key}`}
            className={`px-4 py-2 rounded transition-colors ${buttonClass}`}
            onClick={() => onFilterChange(config.key)}
            aria-label={config.ariaLabel}
            aria-pressed={isSelected}
          >
            {config.label}
            {showCounts && (
              <span data-testid={`count-${config.key}`} className="ml-1">
                ({count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default EligibilityFilter;
