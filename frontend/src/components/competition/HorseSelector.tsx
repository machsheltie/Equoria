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
import { Loader2 } from 'lucide-react';

// Re-export Horse type for consumers
export type { Horse } from './HorseSelectionCard';

/**
 * HorseSelector component props
 */
export interface HorseSelectorProps {
  competitionId: number;
  discipline: string;
  selectedHorses: number[];
  onSelectionChange: (horseIds: number[]) => void;
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
  dressage: ['Obedience', 'Balance', 'Precision'],
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
 * Loading spinner component
 */
const LoadingSpinner = () => (
  <div
    data-testid="horse-selector-loading"
    className="flex flex-col items-center justify-center py-12"
  >
    <Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-hidden="true" />
    <p className="mt-2 text-sm text-slate-500">Loading horses...</p>
  </div>
);

/**
 * Empty state component
 */
const EmptyState = () => (
  <div
    data-testid="horse-selector-empty"
    className="flex flex-col items-center justify-center py-12 text-center"
  >
    <div className="rounded-full bg-slate-100 p-4 mb-4">
      <svg
        className="h-8 w-8 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
    </div>
    <p className="text-slate-600 font-medium">No eligible horses</p>
    <p className="text-sm text-slate-400 mt-1">
      You don't have any horses that can enter this competition.
    </p>
  </div>
);

/**
 * Error state component
 */
const ErrorState = ({ message }: { message: string }) => (
  <div
    data-testid="horse-selector-error"
    className="flex flex-col items-center justify-center py-12 text-center"
  >
    <div className="rounded-full bg-red-100 p-4 mb-4">
      <svg
        className="h-8 w-8 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    </div>
    <p className="text-red-600 font-medium">Failed to load horses</p>
    <p className="text-sm text-slate-400 mt-1">{message}</p>
  </div>
);

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

    // Fetch horses and competition entries on mount
    useEffect(() => {
      const fetchData = async () => {
        setIsLoading(true);
        setError(null);

        try {
          // Fetch user's horses
          const horsesResponse = await fetch('http://localhost:3001/api/horses/user/eligible');

          if (!horsesResponse.ok) {
            throw new Error('Failed to fetch horses');
          }

          const horsesData = await horsesResponse.json();
          setHorses(horsesData.data || []);

          // Fetch competition entries to check which horses are already entered
          const entriesResponse = await fetch(
            `http://localhost:3001/api/competitions/${competitionId}/entries`
          );

          if (entriesResponse.ok) {
            const entriesData = await entriesResponse.json();
            const enteredIds = new Set<number>(
              (entriesData.data || []).map((e: CompetitionEntry) => e.horseId)
            );
            setAlreadyEnteredIds(enteredIds);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An error occurred');
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

    // Render loading state
    if (isLoading) {
      return (
        <div data-testid="horse-selector" className={className}>
          <LoadingSpinner />
        </div>
      );
    }

    // Render error state
    if (error) {
      return (
        <div data-testid="horse-selector" className={className}>
          <ErrorState message={error} />
        </div>
      );
    }

    // Render empty state
    if (horses.length === 0) {
      return (
        <div data-testid="horse-selector" className={className}>
          <EmptyState />
        </div>
      );
    }

    return (
      <div data-testid="horse-selector" className={cn('space-y-4', className)}>
        {/* Header with title and controls */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900" role="heading" aria-level={3}>
              Select Horses
            </h3>
            <p className="text-sm text-slate-500">
              <span data-testid="eligible-count" className="font-medium">
                {eligibleHorses.length}
              </span>{' '}
              eligible of {horses.length} horses
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Selection count */}
            <div className="text-sm text-slate-600">
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
                  'bg-blue-50 text-blue-700 hover:bg-blue-100',
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
                  'bg-slate-50 text-slate-700 hover:bg-slate-100',
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
          <p className="text-sm text-amber-600 text-center">
            Maximum of {maxSelections} horses can be selected
          </p>
        )}
      </div>
    );
  }
);
HorseSelector.displayName = 'HorseSelector';

export default HorseSelector;
