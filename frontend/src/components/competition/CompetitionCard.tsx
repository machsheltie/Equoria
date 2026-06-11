/**
 * CompetitionCard Component
 *
 * Displays individual competition information in a card format:
 * - Competition name and discipline
 * - Date, prize pool, and entry fee
 * - Participant counts (current/max)
 * - Loading skeleton state
 * - Click handler for opening detail modal
 *
 * Story 5-1: Competition Entry System - Task 3
 */

import { Calendar, Trophy, Coins, Users } from 'lucide-react';
import Currency from '@/components/ui/Currency';
import { Surface } from '@/components/ui/Surface';
import { Skeleton } from '@/components/ui/state';

/**
 * Competition data structure
 */
export interface Competition {
  id: number;
  name: string;
  discipline: string;
  date: string;
  prizePool: number;
  entryFee: number;
  maxParticipants?: number;
  currentParticipants?: number;
}

/**
 * CompetitionCard component props
 */
export interface CompetitionCardProps {
  competition: Competition;
  onClick: (_competitionId: number) => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Format date for display
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Loading skeleton component for CompetitionCard
 */
const CompetitionCardSkeleton = ({ className = '' }: { className?: string }) => (
  <div
    className={`glass-panel rounded-lg p-4 animate-pulse ${className}`}
    data-testid="competition-card-skeleton"
  >
    <Skeleton.Rect className="h-6 w-3/4 mb-2" />
    <Skeleton.Rect className="h-4 w-1/2 mb-4" />
    <div className="space-y-2">
      <Skeleton.Rect className="h-4 w-2/3" />
      <Skeleton.Rect className="h-4 w-1/2" />
      <Skeleton.Rect className="h-4 w-3/5" />
    </div>
  </div>
);

/**
 * CompetitionCard component
 *
 * Displays competition information with click handler and accessibility support.
 */
const CompetitionCard = ({
  competition,
  onClick,
  isLoading = false,
  className = '',
}: CompetitionCardProps) => {
  // Handle loading state
  if (isLoading) {
    return <CompetitionCardSkeleton className={className} />;
  }

  const { id, name, discipline, date, prizePool, entryFee, maxParticipants, currentParticipants } =
    competition;

  const hasParticipantInfo = maxParticipants !== undefined && currentParticipants !== undefined;

  const handleClick = () => {
    onClick(id);
  };

  /* Equoria-o5hub ratchet (c): real <button> semantics via Surface(interactive).
   * Native button gives Enter/Space activation for free (no manual onKeyDown),
   * and glass-panel-interactive owns the token focus-visible ring + hover lift
   * (D-05) — the old hand-rolled blue focus ring is gone. The e2e-pinned
   * `competition-card` testid and aria-label are preserved exactly. */
  return (
    <Surface
      variant="interactive"
      as="button"
      type="button"
      className={`block w-full text-left rounded-lg p-4 ${className}`}
      data-testid="competition-card"
      onClick={handleClick}
      aria-label={`View details for ${name} competition`}
    >
      {/* Header: Name and Discipline */}
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-role-primary truncate">{name}</h3>
        <p className="text-sm text-role-secondary">{discipline}</p>
      </div>

      {/* Competition Details */}
      <div className="space-y-2 text-sm">
        {/* Date */}
        <div className="flex items-center" data-testid="competition-date">
          <Calendar className="h-4 w-4 text-role-secondary mr-2" aria-hidden="true" />
          <span className="text-role-primary">{formatDate(date)}</span>
        </div>

        {/* Prize Pool — coin rendering via canonical Currency (DECISIONS §9) */}
        <div className="flex items-center" data-testid="competition-prize">
          <Trophy className="h-4 w-4 text-[var(--gold-light)] mr-2" aria-hidden="true" />
          <span className="text-[var(--text-primary)]">
            Prize: <Currency amount={prizePool} />
          </span>
        </div>

        {/* Entry Fee */}
        <div className="flex items-center" data-testid="competition-fee">
          <Coins className="h-4 w-4 text-[var(--gold-light)] mr-2" aria-hidden="true" />
          <span className="text-[var(--text-primary)]">
            Entry: <Currency amount={entryFee} zeroLabel="Free" />
          </span>
        </div>

        {/* Participants */}
        {hasParticipantInfo && (
          <div className="flex items-center" data-testid="competition-participants">
            <Users className="h-4 w-4 text-[var(--role-info-text)] mr-2" aria-hidden="true" />
            <span className="text-role-primary">
              {currentParticipants}/{maxParticipants} participants
            </span>
          </div>
        )}
      </div>
    </Surface>
  );
};

export default CompetitionCard;
