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

import { useMemo } from 'react';
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
  onFilterChange: (filter: EligibilityFilterType) => void;

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
    activeClass: 'bg-blue-600 text-white',
  },
  {
    key: 'ready',
    label: 'Ready',
    ariaLabel: 'Show horses ready to train',
    activeClass: 'bg-green-600 text-white',
  },
  {
    key: 'cooldown',
    label: 'Cooldown',
    ariaLabel: 'Show horses on cooldown',
    activeClass: 'bg-amber-600 text-white',
  },
  {
    key: 'ineligible',
    label: 'Ineligible',
    ariaLabel: 'Show ineligible horses',
    activeClass: 'bg-gray-600 text-white',
  },
];

/**
 * Base styling for inactive buttons
 */
const inactiveClass = 'bg-gray-200 text-gray-700 hover:bg-gray-300';

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
