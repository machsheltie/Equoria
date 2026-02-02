/**
 * TrainingDashboard Component
 *
 * Displays all user's horses organized by training eligibility:
 * - Ready to Train: Eligible horses with no cooldown
 * - On Cooldown: Horses waiting for cooldown to expire
 * - Ineligible: Horses that cannot train (too young or too old)
 *
 * Features:
 * - Fetches horses using useTrainableHorses() hook
 * - Groups horses by eligibility status with section headers
 * - Integrates EligibilityFilter for filtering display
 * - Integrates EligibilityIndicator for each horse card
 * - Quick action "Train" buttons for eligible horses
 * - Responsive grid layout (3 cols desktop, 2 tablet, 1 mobile)
 * - Loading, error, and empty states
 *
 * Story 4-2: Training Eligibility Display - Task 3
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrainableHorses } from '@/hooks/api/useTraining';
import { useProfile } from '@/hooks/useAuth';
import type { TrainableHorse } from '@/lib/api-client';
import { canTrain } from '@/lib/utils/training-utils';
import type { Horse } from '@/lib/utils/training-utils';
import EligibilityIndicator from './EligibilityIndicator';
import EligibilityFilter from './EligibilityFilter';
import type { EligibilityFilterType } from './EligibilityFilter';
import TrainingSessionModal from './TrainingSessionModal';
import TrainingHistoryPanel from './TrainingHistoryPanel';

/**
 * Props for TrainingDashboard component
 */
export interface TrainingDashboardProps {
  /**
   * Optional userId override for testing
   * If not provided, uses authenticated user from useProfile()
   */
  userId?: string;
}

/**
 * Convert TrainableHorse from API to Horse format for eligibility checking
 */
function toHorseFormat(horse: TrainableHorse): Horse {
  return {
    id: horse.id,
    name: horse.name,
    age: horse.ageYears ?? 5, // Default to eligible age if not specified
    trainingCooldown: horse.nextEligibleAt ?? null,
  };
}

/**
 * Determine eligibility category for a horse
 */
function getEligibilityCategory(horse: TrainableHorse): 'ready' | 'cooldown' | 'ineligible' {
  const horseData = toHorseFormat(horse);
  const result = canTrain(horseData);

  if (result.eligible) {
    return 'ready';
  }

  // Check if it's a cooldown issue
  if (result.reason?.toLowerCase().includes('cooldown')) {
    return 'cooldown';
  }

  // Otherwise it's ineligible (too young, too old, etc.)
  return 'ineligible';
}

/**
 * HorseCard sub-component for displaying individual horse information
 */
interface HorseCardProps {
  horse: TrainableHorse;
  onTrainClick: (horse: TrainableHorse) => void;
}

const HorseCard = ({ horse, onTrainClick }: HorseCardProps): JSX.Element => {
  const horseData = toHorseFormat(horse);
  const category = getEligibilityCategory(horse);

  return (
    <div
      data-testid={`horse-card-${horse.id}`}
      className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      {/* Horse Header */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-lg font-semibold text-slate-900">{horse.name}</h4>
            <p className="text-sm text-slate-600">Age: {horse.ageYears ?? 'Unknown'} years</p>
          </div>
          {horse.level !== undefined && (
            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              Level {horse.level}
            </span>
          )}
        </div>

        {/* Breed Info */}
        {horse.breed && <p className="mt-1 text-sm text-slate-500">{horse.breed}</p>}

        {/* Best Disciplines */}
        {horse.bestDisciplines && horse.bestDisciplines.length > 0 && (
          <p className="mt-1 text-xs text-slate-400">Best: {horse.bestDisciplines.join(', ')}</p>
        )}
      </div>

      {/* Eligibility Indicator */}
      <div className="mt-3">
        <EligibilityIndicator horse={horseData} variant="full" />
      </div>

      {/* Train Button (only for eligible horses) */}
      {category === 'ready' && (
        <button
          type="button"
          data-testid={`train-button-${horse.id}`}
          onClick={() => onTrainClick(horse)}
          className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Train
        </button>
      )}
    </div>
  );
};

/**
 * TrainingDashboard Component
 *
 * Main dashboard for training horses with eligibility filtering and grouping
 */
const TrainingDashboard = ({ userId: userIdProp }: TrainingDashboardProps): JSX.Element => {
  // Get authenticated user's ID if not provided as prop
  const { data: profileData } = useProfile();
  const userId = userIdProp ?? profileData?.user?.id?.toString();

  // State for filter and modal
  const [selectedFilter, setSelectedFilter] = useState<EligibilityFilterType>('all');
  const [selectedHorse, setSelectedHorse] = useState<TrainableHorse | null>(null);

  // Navigation for training page
  const navigate = useNavigate();

  // Fetch horses
  const { data: horses, isLoading, isError, error, refetch } = useTrainableHorses(userId ?? '');

  // Convert horses to Horse format for EligibilityFilter
  const horsesForFilter = useMemo((): Horse[] => {
    if (!horses) return [];
    return horses.map(toHorseFormat);
  }, [horses]);

  // Group horses by eligibility status
  const { ready, cooldown, ineligible } = useMemo(() => {
    if (!horses) {
      return { ready: [], cooldown: [], ineligible: [] };
    }

    const grouped = {
      ready: [] as TrainableHorse[],
      cooldown: [] as TrainableHorse[],
      ineligible: [] as TrainableHorse[],
    };

    for (const horse of horses) {
      const category = getEligibilityCategory(horse);
      grouped[category].push(horse);
    }

    return grouped;
  }, [horses]);

  // Filter horses based on selected filter
  const displayedHorses = useMemo((): TrainableHorse[] => {
    if (!horses) return [];
    if (selectedFilter === 'all') return horses;
    if (selectedFilter === 'ready') return ready;
    if (selectedFilter === 'cooldown') return cooldown;
    return ineligible;
  }, [horses, selectedFilter, ready, cooldown, ineligible]);

  // Handle train button click - opens modal or navigates
  const handleTrainClick = (horse: TrainableHorse) => {
    setSelectedHorse(horse);
    // Note: TrainingSessionModal handles the actual training
    // For direct navigation: navigate(`/horses/${horse.id}/training`);
  };

  // Handle filter change
  const handleFilterChange = (filter: EligibilityFilterType) => {
    setSelectedFilter(filter);
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        data-testid="loading-state"
        className="text-center py-12 text-slate-600"
        role="status"
        aria-label="Loading horses"
      >
        Loading trainable horses...
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div data-testid="error-state" className="text-center py-12 text-red-600" role="alert">
        Error loading horses: {error?.message || 'Unknown error'}
      </div>
    );
  }

  // Empty state (no horses at all)
  if (!horses || horses.length === 0) {
    return (
      <div data-testid="empty-state" className="text-center py-12 text-slate-600">
        No trainable horses found. Add horses to start training.
      </div>
    );
  }

  // Render grouped sections (for "all" filter)
  const renderGroupedSections = () => (
    <>
      {/* Ready to Train Section */}
      {ready.length > 0 && (
        <section data-testid="section-ready" className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Ready to Train ({ready.length})</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ready.map((horse) => (
              <HorseCard key={horse.id} horse={horse} onTrainClick={handleTrainClick} />
            ))}
          </div>
        </section>
      )}

      {/* On Cooldown Section */}
      {cooldown.length > 0 && (
        <section data-testid="section-cooldown" className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">On Cooldown ({cooldown.length})</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cooldown.map((horse) => (
              <HorseCard key={horse.id} horse={horse} onTrainClick={handleTrainClick} />
            ))}
          </div>
        </section>
      )}

      {/* Ineligible Section */}
      {ineligible.length > 0 && (
        <section data-testid="section-ineligible" className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Ineligible ({ineligible.length})</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ineligible.map((horse) => (
              <HorseCard key={horse.id} horse={horse} onTrainClick={handleTrainClick} />
            ))}
          </div>
        </section>
      )}
    </>
  );

  // Render filtered list (for specific filter)
  const renderFilteredList = () => {
    // Empty filtered state
    if (displayedHorses.length === 0) {
      const filterLabels: Record<EligibilityFilterType, string> = {
        all: '',
        ready: 'ready',
        cooldown: 'cooldown',
        ineligible: 'ineligible',
      };

      return (
        <div
          data-testid="empty-filtered-state"
          className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-600"
        >
          No {filterLabels[selectedFilter]} horses found.
        </div>
      );
    }

    return (
      <div
        data-testid="filtered-grid"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {displayedHorses.map((horse) => (
          <HorseCard key={horse.id} horse={horse} onTrainClick={handleTrainClick} />
        ))}
      </div>
    );
  };

  return (
    <div data-testid="training-dashboard" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Training Dashboard</h2>
          <p className="text-sm text-slate-600">
            Track readiness, start sessions, and review training progress.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        >
          Refresh
        </button>
      </div>

      {/* Eligibility Filter */}
      <EligibilityFilter
        horses={horsesForFilter}
        selectedFilter={selectedFilter}
        onFilterChange={handleFilterChange}
        showCounts={true}
      />

      {/* Horse Display - Grouped or Filtered */}
      {selectedFilter === 'all' ? renderGroupedSections() : renderFilteredList()}

      {/* Training History Panel */}
      <TrainingHistoryPanel horseId={selectedHorse?.id} />

      {/* Training Session Modal */}
      {selectedHorse && (
        <TrainingSessionModal
          horse={selectedHorse}
          onClose={() => setSelectedHorse(null)}
          onCompleted={() => {
            setSelectedHorse(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default TrainingDashboard;
