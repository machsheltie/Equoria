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

import { Calendar, Trophy, DollarSign, Users } from 'lucide-react';

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
  onClick: (competitionId: number) => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Format currency for display
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

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
    className={`bg-white rounded-lg shadow p-4 animate-pulse ${className}`}
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

  const hasParticipantInfo =
    maxParticipants !== undefined && currentParticipants !== undefined;

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
      className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      data-testid="competition-card"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`View details for ${name} competition`}
    >
      {/* Header: Name and Discipline */}
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-slate-900 truncate">{name}</h3>
        <p className="text-sm text-slate-600">{discipline}</p>
      </div>

      {/* Competition Details */}
      <div className="space-y-2 text-sm">
        {/* Date */}
        <div className="flex items-center" data-testid="competition-date">
          <Calendar className="h-4 w-4 text-slate-400 mr-2" aria-hidden="true" />
          <span className="text-slate-700">{formatDate(date)}</span>
        </div>

        {/* Prize Pool */}
        <div className="flex items-center" data-testid="competition-prize">
          <Trophy className="h-4 w-4 text-amber-500 mr-2" aria-hidden="true" />
          <span className="text-slate-700">Prize: {formatCurrency(prizePool)}</span>
        </div>

        {/* Entry Fee */}
        <div className="flex items-center" data-testid="competition-fee">
          <DollarSign className="h-4 w-4 text-green-500 mr-2" aria-hidden="true" />
          <span className="text-slate-700">
            Entry: {entryFee === 0 ? 'Free' : formatCurrency(entryFee)}
          </span>
        </div>

        {/* Participants */}
        {hasParticipantInfo && (
          <div className="flex items-center" data-testid="competition-participants">
            <Users className="h-4 w-4 text-blue-500 mr-2" aria-hidden="true" />
            <span className="text-slate-700">
              {currentParticipants}/{maxParticipants} participants
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitionCard;
