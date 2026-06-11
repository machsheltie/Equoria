/**
 * HorseSelector Component
 *
 * Container component for managing horse selection in competition entry:
 * - Fetches and displays user's horses filtered by eligibility
 * - Manages single/multiple horse selection state
 * - Provides Select All / Deselect All functionality
 * - Shows loading, empty, and error states
 * - Enforces maximum selection limits
 *
 * Story 5-1: Competition Entry System - Task 5
 */

import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import HorseSelectionCard, {
  type Horse,
  type EligibilityStatus,
  type RelevantStat,
} from './HorseSelectionCard';
import { Footprints } from 'lucide-react';
import { competitionsApi } from '@/lib/api-client';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';

// Re-export Horse type for consumers
export type { Horse } from './HorseSelectionCard';

/**
 * HorseSelector component props
 */
export interface HorseSelectorProps {
  competitionId: number;
  discipline: string;
  selectedHorses: number[];
  onSelectionChange: (_horseIds: number[]) => void;
  maxSelections?: number;
  className?: string;
}

/**
 * Competition entry data from API
 */
interface CompetitionEntry {
  horseId: number;
  horseName: string;
}

/**
 * Horse with computed eligibility data
 */
interface HorseWithEligibility extends Horse {
  eligibilityStatus: EligibilityStatus;
  ineligibilityReason?: string;
  relevantStats: RelevantStat[];
  expectedPerformance?: number;
}

/**
 * Discipline stat mapping for determining relevant stats
 */
const disciplineStatMapping: Record<string, string[]> = {
  racing: ['Speed', 'Stamina', 'Agility'],
  showJumping: ['Precision', 'Agility', 'Boldness'],
  dressage: ['Precision', 'Focus', 'Obedience'],
  eventing: ['Stamina', 'Boldness', 'Speed'],
  crossCountry: ['Stamina', 'Speed', 'Boldness'],
  default: ['Speed', 'Stamina', 'Agility'],
};

/**
 * Calculates eligibility status for a horse
 */
function calculateEligibility(
  horse: Horse,
  alreadyEnteredIds: Set<number>
): { status: EligibilityStatus; reason?: string } {
  // Check if already entered
  if (alreadyEnteredIds.has(horse.id)) {
    return {
      status: 'already-entered',
      reason: 'This horse is already entered in this competition',
    };
  }

  // Check health status
  if (horse.health === 'injured') {
    return { status: 'injured', reason: 'Horse must be healthy to compete' };
  }

  // Check age - too young (under 3)
  if (horse.age < 3) {
    return { status: 'too-young', reason: 'Horse must be at least 3 years old' };
  }

  // Check age - too old (over 20)
  if (horse.age > 20) {
    return { status: 'too-old', reason: 'Horse must be under 20 years old' };
  }

  // Horse is eligible
  return { status: 'eligible' };
}

/**
 * Get relevant stats for a discipline
 */
function getRelevantStats(horse: Horse, discipline: string): RelevantStat[] {
  const statNames = disciplineStatMapping[discipline] || disciplineStatMapping.default;

  // Generate stat values based on horse disciplines and level
  // In real implementation, these would come from the horse object
  return statNames.map((name) => ({
    name,
    value: Math.min(100, Math.floor((horse.disciplines[discipline] || 50) + Math.random() * 20)),
  }));
}

/**
 * Calculate expected performance score
 */
function calculateExpectedPerformance(
  horse: Horse,
  discipline: string,
  relevantStats: RelevantStat[]
): number {
  const disciplineScore = horse.disciplines[discipline] || 50;
  const avgStat = relevantStats.reduce((sum, s) => sum + s.value, 0) / (relevantStats.length || 1);
  const levelBonus = horse.level * 2;

  return Math.min(100, Math.floor((disciplineScore + avgStat + levelBonus) / 3));
}

/**
 * HorseSelector Component
 *
 * Manages horse selection for competition entry with filtering and validation.
 */
const HorseSelector = memo(
  ({
    competitionId,
    discipline,
    selectedHorses,
    onSelectionChange,
    maxSelections,
    className = '',
  }: HorseSelectorProps) => {
    // State for fetched data
    const [horses, setHorses] = useState<Horse[]>([]);
    const [alreadyEnteredIds, setAlreadyEnteredIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch horses and competition entries on mount.
    // Uses the canonical apiClient (via competitionsApi) so VITE_API_URL /
    // relative URL routing, CSRF, and auth cookie handling all match the
    // rest of the app. Equoria-8jka migration: removed hardcoded
    // http://localhost:3001 raw fetch() calls.
    useEffect(() => {
      const fetchData = async () => {
        setIsLoading(true);
        setError(null);

        try {
          // Fetch user's eligible horses. apiClient unwraps {success, data}
          // and returns the inner array directly.
          const horsesData = await competitionsApi.getEligibleUserHorses();
          setHorses((horsesData as Horse[]) || []);

          // Fetch competition entries to check which horses are already entered.
          // Wrapped in its own try so a failure here doesn't blank out the
          // horse list (mirrors prior behavior: entries failure was silently
          // ignored by the old raw-fetch implementation).
          try {
            const entriesData = await competitionsApi.getEntries(competitionId);
            const enteredIds = new Set<number>(
              (entriesData || []).map((e: CompetitionEntry) => e.horseId)
            );
            setAlreadyEnteredIds(enteredIds);
          } catch {
            // Entries fetch is non-critical — UI degrades to "no horses already entered"
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch horses');
        } finally {
          setIsLoading(false);
        }
      };

      fetchData();
    }, [competitionId]);

    // Process horses with eligibility data
    const processedHorses = useMemo((): HorseWithEligibility[] => {
      return horses.map((horse) => {
        const { status, reason } = calculateEligibility(horse, alreadyEnteredIds);
        const relevantStats = getRelevantStats(horse, discipline);
        const expectedPerformance =
          status === 'eligible'
            ? calculateExpectedPerformance(horse, discipline, relevantStats)
            : undefined;

        return {
          ...horse,
          eligibilityStatus: status,
          ineligibilityReason: reason,
          relevantStats,
          expectedPerformance,
        };
      });
    }, [horses, alreadyEnteredIds, discipline]);

    // Sort horses: eligible first, then by name
    const sortedHorses = useMemo(() => {
      return [...processedHorses].sort((a, b) => {
        // Eligible horses first
        if (a.eligibilityStatus === 'eligible' && b.eligibilityStatus !== 'eligible') {
          return -1;
        }
        if (a.eligibilityStatus !== 'eligible' && b.eligibilityStatus === 'eligible') {
          return 1;
        }
        // Then sort by name
        return a.name.localeCompare(b.name);
      });
    }, [processedHorses]);

    // Get eligible horses
    const eligibleHorses = useMemo(() => {
      return sortedHorses.filter((h) => h.eligibilityStatus === 'eligible');
    }, [sortedHorses]);

    // Check if max selections reached
    const isMaxSelectionsReached =
      maxSelections !== undefined && selectedHorses.length >= maxSelections;

    // Handle horse toggle
    const handleToggle = useCallback(
      (horseId: number) => {
        const isSelected = selectedHorses.includes(horseId);

        if (isSelected) {
          // Deselect
          onSelectionChange(selectedHorses.filter((id) => id !== horseId));
        } else {
          // Select (check max selections)
          if (!isMaxSelectionsReached) {
            onSelectionChange([...selectedHorses, horseId]);
          }
        }
      },
      [selectedHorses, onSelectionChange, isMaxSelectionsReached]
    );

    // Handle select all eligible
    const handleSelectAll = useCallback(() => {
      const eligibleIds = eligibleHorses.map((h) => h.id);

      if (maxSelections !== undefined) {
        // Limit to max selections
        onSelectionChange(eligibleIds.slice(0, maxSelections));
      } else {
        onSelectionChange(eligibleIds);
      }
    }, [eligibleHorses, maxSelections, onSelectionChange]);

    // Handle deselect all
    const handleDeselectAll = useCallback(() => {
      onSelectionChange([]);
    }, [onSelectionChange]);

    // Check if a horse should be disabled
    const isHorseDisabled = useCallback(
      (horse: HorseWithEligibility) => {
        if (horse.eligibilityStatus !== 'eligible') {
          return true;
        }
        // Disable if max selections reached and not already selected
        if (isMaxSelectionsReached && !selectedHorses.includes(horse.id)) {
          return true;
        }
        return false;
      },
      [isMaxSelectionsReached, selectedHorses]
    );

    // Render loading state — canonical SectionLoading (D-15 / §15); the
    // wrapper preserves the test-pinned `horse-selector-loading` testid.
    if (isLoading) {
      return (
        <div data-testid="horse-selector" className={className}>
          <div data-testid="horse-selector-loading">
            <SectionLoading label="Loading horses" minHeight="160px" />
          </div>
        </div>
      );
    }

    // Render error state — canonical ErrorState (D-16 / §15). No retry action
    // existed on the local error display, so none is added (behavior parity).
    if (error) {
      return (
        <div data-testid="horse-selector" className={className}>
          <div data-testid="horse-selector-error">
            <ErrorState title="Failed to load horses" message={error} />
          </div>
        </div>
      );
    }

    // Render empty state — canonical EmptyState (D-17 / §15)
    if (horses.length === 0) {
      return (
        <div data-testid="horse-selector" className={className}>
          <div data-testid="horse-selector-empty">
            <EmptyState
              variant="unavailable"
              icon={<Footprints className="h-8 w-8" aria-hidden="true" />}
              title="No eligible horses"
              description="You don't have any horses that can enter this competition."
            />
          </div>
        </div>
      );
    }

    return (
      <div data-testid="horse-selector" className={cn('space-y-4', className)}>
        {/* Header with title and controls */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-role-primary" role="heading" aria-level={3}>
              Select Horses
            </h3>
            <p className="text-sm text-role-secondary">
              <span data-testid="eligible-count" className="font-medium">
                {eligibleHorses.length}
              </span>{' '}
              eligible of {horses.length} horses
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Selection count */}
            <div className="text-sm text-role-secondary">
              <span data-testid="selected-count" className="font-medium">
                {selectedHorses.length}
              </span>
              {maxSelections !== undefined && ` / ${maxSelections}`} selected
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                data-testid="select-all-button"
                type="button"
                onClick={handleSelectAll}
                disabled={eligibleHorses.length === 0}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  'bg-[var(--role-info-bg)] text-[var(--role-info-text)] hover:bg-[rgba(37,99,235,0.2)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Select All Eligible
              </button>
              <button
                data-testid="deselect-all-button"
                type="button"
                onClick={handleDeselectAll}
                disabled={selectedHorses.length === 0}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  'bg-[var(--role-neutral-bg)] text-role-secondary hover:bg-[rgba(15,35,70,0.7)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Deselect All
              </button>
            </div>
          </div>
        </div>

        {/* Live region for screen reader announcements */}
        <div role="status" aria-live="polite" className="sr-only">
          {selectedHorses.length} horses selected
        </div>

        {/* Horse grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedHorses.map((horse) => (
            <HorseSelectionCard
              key={horse.id}
              horse={horse}
              isSelected={selectedHorses.includes(horse.id)}
              onToggle={handleToggle}
              eligibilityStatus={horse.eligibilityStatus}
              ineligibilityReason={horse.ineligibilityReason}
              relevantStats={horse.relevantStats}
              expectedPerformance={horse.expectedPerformance}
              disabled={isHorseDisabled(horse)}
            />
          ))}
        </div>

        {/* Max selections info */}
        {maxSelections !== undefined && isMaxSelectionsReached && (
          <p className="text-sm text-[var(--role-warning-text)] text-center">
            Maximum of {maxSelections} horses can be selected
          </p>
        )}
      </div>
    );
  }
);
HorseSelector.displayName = 'HorseSelector';

export default HorseSelector;
