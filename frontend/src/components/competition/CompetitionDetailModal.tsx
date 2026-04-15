/**
 * CompetitionDetailModal Component
 *
 * A modal dialog for displaying detailed competition information:
 * - Competition name, discipline, and description
 * - Event date with calendar icon
 * - Prize pool with breakdown (1st: 50%, 2nd: 30%, 3rd: 20%)
 * - Entry fee display
 * - Entry requirements list
 *
 * Features:
 * - Uses BaseModal for portal, focus trap, scroll lock, escape key, backdrop click
 * - Responsive design (mobile/tablet/desktop)
 * - WCAG 2.1 AA compliance
 *
 * Story 5-1: Competition Entry System - Task 4
 */

import React, { memo } from 'react';
import { Calendar, DollarSign, Trophy, Users, AlertCircle } from 'lucide-react';
import BaseModal from '@/components/common/BaseModal';

/**
 * Competition data structure for the modal
 */
export interface Competition {
  id: number;
  name: string;
  discipline: string;
  date: string;
  prizePool: number;
  entryFee: number;
  description?: string;
  maxParticipants?: number;
  currentParticipants?: number;
  entryRequirements?: string[];
  location?: string;
}

/**
 * CompetitionDetailModal component props
 */
export interface CompetitionDetailModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Competition data to display (null hides modal) */
  competition: Competition | null;
  /** Called with competitionId when user clicks Enter Competition */
  onEnter?: (_competitionId: number) => void;
  /** User-owned horses eligible for entry selection */
  entryHorses?: Array<{ id: number; name: string }>;
  /** Selected horse id for the entry form */
  selectedHorseId?: number | '';
  /** Called when the selected horse changes */
  onSelectedHorseIdChange?: (_horseId: number) => void;
  /** Loading state for entry submission */
  isSubmitting?: boolean;
  /** Error message to display */
  error?: string;
}

/**
 * Format currency for display
 */
const formatCurrency = (amount: number): string => {
  if (amount === 0) return 'Free';
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
 * Calculate prize distribution (50%/30%/20%)
 */
const calculatePrizeDistribution = (
  prizePool: number
): { first: number; second: number; third: number } => {
  return {
    first: Math.floor(prizePool * 0.5),
    second: Math.floor(prizePool * 0.3),
    third: Math.floor(prizePool * 0.2),
  };
};

/**
 * CompetitionDetailModal Component
 *
 * Displays detailed competition information and entry actions.
 * Delegates portal, focus trap, scroll lock, and keyboard handling to BaseModal.
 */
const CompetitionDetailModal = memo(function CompetitionDetailModal({
  isOpen,
  onClose,
  competition,
  onEnter,
  entryHorses = [],
  selectedHorseId = '',
  onSelectedHorseIdChange,
  isSubmitting = false,
  error,
}: CompetitionDetailModalProps) {
  // Don't render if no competition
  if (!competition && isOpen) {
    return null;
  }

  const prizeDistribution = competition ? calculatePrizeDistribution(competition.prizePool) : null;
  const hasRequirements =
    competition?.entryRequirements && competition.entryRequirements.length > 0;

  const canEnter = onEnter != null && competition != null;

  const footerContent = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="px-4 py-2 border border-forest-green/30 rounded-lg text-midnight-ink hover:bg-forest-green/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Close
      </button>
      {canEnter && (
        <button
          type="button"
          data-testid="enter-competition-button"
          onClick={() => onEnter!(competition!.id)}
          disabled={isSubmitting || entryHorses.length === 0 || !selectedHorseId}
          className="px-4 py-2 bg-forest-green/20 border border-forest-green/40 rounded-lg text-midnight-ink font-medium hover:bg-forest-green/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Entering…' : 'Enter Competition'}
        </button>
      )}
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={competition?.name ?? ''}
      size="lg"
      isSubmitting={isSubmitting}
      footer={footerContent}
      data-testid="competition-detail-modal"
      aria-describedby={competition?.description ? 'competition-modal-description' : undefined}
    >
      {competition && (
        <div className="space-y-6">
          {/* Discipline badge */}
          <span
            className="inline-block px-3 py-1 bg-forest-green/10 text-blue-400 text-sm font-medium rounded-full border border-blue-500/30"
            data-testid="competition-discipline"
          >
            {competition.discipline}
          </span>

          {/* Description */}
          {competition.description && (
            <p
              id="competition-modal-description"
              className="text-mystic-silver"
              data-testid="competition-description"
            >
              {competition.description}
            </p>
          )}
          {!competition.description && (
            <p id="competition-modal-description" className="sr-only">
              Competition details for {competition.name}
            </p>
          )}

          {/* Event Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date */}
            <div
              className="flex items-center space-x-3 p-3 bg-saddle-leather/50 rounded-lg"
              data-testid="competition-date"
            >
              <Calendar className="h-5 w-5 text-mystic-silver" aria-hidden="true" />
              <div>
                <p className="text-xs text-mystic-silver uppercase tracking-wider">Event Date</p>
                <p className="text-midnight-ink font-medium">{formatDate(competition.date)}</p>
              </div>
            </div>

            {/* Location */}
            {competition.location && (
              <div className="flex items-center space-x-3 p-3 bg-saddle-leather/50 rounded-lg">
                <Users className="h-5 w-5 text-mystic-silver" aria-hidden="true" />
                <div>
                  <p className="text-xs text-mystic-silver uppercase tracking-wider">Location</p>
                  <p className="text-midnight-ink font-medium">{competition.location}</p>
                </div>
              </div>
            )}

            {/* Prize Pool */}
            <div
              className="flex items-center space-x-3 p-3 bg-burnished-gold/10 rounded-lg"
              data-testid="competition-prize-pool"
            >
              <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
              <div>
                <p className="text-xs text-amber-400 uppercase tracking-wider">Total Prize Pool</p>
                <p className="text-midnight-ink font-bold text-lg">
                  {formatCurrency(competition.prizePool)}
                </p>
              </div>
            </div>

            {/* Entry Fee */}
            <div
              className="flex items-center space-x-3 p-3 bg-emerald-500/10 rounded-lg"
              data-testid="competition-entry-fee"
            >
              <DollarSign className="h-5 w-5 text-green-500" aria-hidden="true" />
              <div>
                <p className="text-xs text-emerald-400 uppercase tracking-wider">Entry Fee</p>
                <p className="text-midnight-ink font-bold text-lg">
                  {formatCurrency(competition.entryFee)}
                </p>
              </div>
            </div>
          </div>

          {/* Prize Distribution */}
          {prizeDistribution && (
            <div
              className="bg-burnished-gold/10 border border-amber-500/30 rounded-lg p-4"
              data-testid="prize-distribution"
            >
              <h3 className="text-sm font-semibold text-midnight-ink mb-3 flex items-center">
                <Trophy className="h-4 w-4 text-amber-500 mr-2" aria-hidden="true" />
                Prize Distribution
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center" data-testid="prize-1st">
                  <div className="text-2xl mb-1">1st</div>
                  <div className="text-amber-400 font-bold">
                    {formatCurrency(prizeDistribution.first)}
                  </div>
                  <div className="text-xs text-mystic-silver">50%</div>
                </div>
                <div className="text-center" data-testid="prize-2nd">
                  <div className="text-2xl mb-1">2nd</div>
                  <div className="text-mystic-silver font-bold">
                    {formatCurrency(prizeDistribution.second)}
                  </div>
                  <div className="text-xs text-mystic-silver">30%</div>
                </div>
                <div className="text-center" data-testid="prize-3rd">
                  <div className="text-2xl mb-1">3rd</div>
                  <div className="text-orange-600 font-bold">
                    {formatCurrency(prizeDistribution.third)}
                  </div>
                  <div className="text-xs text-mystic-silver">20%</div>
                </div>
              </div>
            </div>
          )}

          {/* Entry Requirements */}
          <div data-testid="entry-requirements">
            <h3 className="text-sm font-semibold text-midnight-ink mb-2">Entry Requirements</h3>
            {hasRequirements ? (
              <ul className="space-y-2">
                {competition.entryRequirements!.map((requirement, index) => (
                  <li key={index} className="flex items-start text-sm text-mystic-silver">
                    <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                    {requirement}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mystic-silver">
                No specific requirements for this competition.
              </p>
            )}
          </div>

          {canEnter && (
            <div
              className="bg-forest-green/10 border border-forest-green/30 rounded-lg p-4"
              data-testid="competition-entry-form"
            >
              <label
                htmlFor="competition-entry-horse"
                className="text-sm font-semibold text-midnight-ink mb-2 block"
              >
                Select horse to enter
              </label>
              {entryHorses.length > 0 ? (
                <select
                  id="competition-entry-horse"
                  data-testid="competition-entry-horse-select"
                  value={selectedHorseId}
                  onChange={(event) =>
                    onSelectedHorseIdChange?.(Number.parseInt(event.target.value, 10))
                  }
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-forest-green/30 bg-white/80 px-3 py-2 text-sm text-midnight-ink"
                >
                  <option value="">Choose a horse</option>
                  {entryHorses.map((horse) => (
                    <option key={horse.id} value={horse.id}>
                      {horse.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-mystic-silver">
                  Add a horse to your stable before entering competitions.
                </p>
              )}
            </div>
          )}

          {/* Participants Info */}
          {competition.maxParticipants !== undefined && (
            <div className="flex items-center justify-between p-3 bg-saddle-leather/50 rounded-lg">
              <span className="text-sm text-mystic-silver">Current Participants</span>
              <span className="font-medium text-midnight-ink">
                {competition.currentParticipants ?? 0} / {competition.maxParticipants}
              </span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
              data-testid="error-message"
            >
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" aria-hidden="true" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>
      )}
    </BaseModal>
  );
});

export default CompetitionDetailModal;
