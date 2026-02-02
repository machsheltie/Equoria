/**
 * CompetitionList Component
 *
 * Displays a responsive grid of competition cards:
 * - 1 column on mobile
 * - 2 columns on tablet
 * - 3 columns on desktop
 * - Loading skeleton state
 * - Empty state handling
 * - Competition count display
 *
 * Story 5-1: Competition Entry System - Task 3
 */

import { Trophy } from 'lucide-react';
import CompetitionCard, { type Competition } from './CompetitionCard';

/**
 * CompetitionList component props
 */
export interface CompetitionListProps {
  competitions: Competition[];
  onCompetitionClick: (competitionId: number) => void;
  isLoading?: boolean;
  className?: string;
  title?: string;
}

/**
 * Loading skeleton grid component
 */
const LoadingSkeletons = () => (
  <>
    {Array.from({ length: 6 }).map((_, index) => (
      <div
        key={`skeleton-${index}`}
        className="bg-white rounded-lg shadow p-4 animate-pulse"
        data-testid="competition-card-skeleton"
      >
        <div className="h-6 bg-slate-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded w-2/3" />
          <div className="h-4 bg-slate-200 rounded w-1/2" />
          <div className="h-4 bg-slate-200 rounded w-3/5" />
        </div>
      </div>
    ))}
  </>
);

/**
 * Empty state component
 */
const EmptyState = () => (
  <div className="py-12 text-center" data-testid="empty-state">
    <Trophy className="mx-auto h-12 w-12 text-slate-400 mb-4" aria-hidden="true" />
    <h3 className="text-lg font-medium text-slate-900 mb-2">No competitions found</h3>
    <p className="text-sm text-slate-600">
      Check back later for upcoming competitions to enter.
    </p>
  </div>
);

/**
 * CompetitionList component
 *
 * Displays a grid of competition cards with loading and empty states.
 */
const CompetitionList = ({
  competitions,
  onCompetitionClick,
  isLoading = false,
  className = '',
  title,
}: CompetitionListProps) => {
  const competitionCount = competitions.length;
  const displayTitle = title || 'Competitions';

  return (
    <div
      className={`bg-white rounded-lg shadow ${className}`}
      data-testid="competition-list"
      role="region"
      aria-label="Competition listings"
    >
      <div className="p-6">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{displayTitle}</h2>
          {!isLoading && (
            <p className="text-sm text-slate-600">
              {competitionCount} {competitionCount === 1 ? 'competition' : 'competitions'} available
            </p>
          )}
          {isLoading && (
            <p className="text-sm text-slate-600">Loading competitions...</p>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            data-testid="competition-grid"
          >
            <LoadingSkeletons />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && competitionCount === 0 && <EmptyState />}

        {/* Competition Grid */}
        {!isLoading && competitionCount > 0 && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            data-testid="competition-grid"
          >
            {competitions.map((competition) => (
              <CompetitionCard
                key={competition.id}
                competition={competition}
                onClick={onCompetitionClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitionList;
