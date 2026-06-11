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
    <div className="h-6 bg-[rgba(37,99,235,0.2)] rounded w-3/4 mb-2" />
    <div className="h-4 bg-[rgba(37,99,235,0.2)] rounded w-1/2 mb-4" />
    <div className="space-y-2">
      <div className="h-4 bg-[rgba(37,99,235,0.2)] rounded w-2/3" />
      <div className="h-4 bg-[rgba(37,99,235,0.2)] rounded w-1/2" />
      <div className="h-4 bg-[rgba(37,99,235,0.2)] rounded w-3/5" />
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

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(id);
    }
  };

  return (
    <div
      className={`glass-panel glass-panel-interactive rounded-lg p-4 transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      data-testid="competition-card"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`View details for ${name} competition`}
    >
      {/* Header: Name and Discipline */}
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-[rgb(220,235,255)] truncate">{name}</h3>
        <p className="text-sm text-slate-400">{discipline}</p>
      </div>

      {/* Competition Details */}
      <div className="space-y-2 text-sm">
        {/* Date */}
        <div className="flex items-center" data-testid="competition-date">
          <Calendar className="h-4 w-4 text-slate-400 mr-2" aria-hidden="true" />
          <span className="text-[rgb(220,235,255)]">{formatDate(date)}</span>
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
            Entry: {entryFee === 0 ? 'Free' : <Currency amount={entryFee} />}
          </span>
        </div>

        {/* Participants */}
        {hasParticipantInfo && (
          <div className="flex items-center" data-testid="competition-participants">
            <Users className="h-4 w-4 text-blue-500 mr-2" aria-hidden="true" />
            <span className="text-[rgb(220,235,255)]">
              {currentParticipants}/{maxParticipants} participants
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitionCard;
