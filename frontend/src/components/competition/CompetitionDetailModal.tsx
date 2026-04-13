/**
 * CompetitionDetailModal Component
 *
 * A modal dialog for displaying detailed competition information:
 * - Competition name, discipline, and description
 * - Event date with calendar icon
 * - Prize pool with breakdown (1st: 50%, 2nd: 30%, 3rd: 20%)
 * - Entry fee display
 * - Entry requirements list
 * - Beta-readonly notice for competition entry (entry is excluded from beta)
 *
 * Features:
 * - Uses BaseModal for portal, focus trap, scroll lock, escape key, backdrop click
 * - Responsive design (mobile/tablet/desktop)
 * - WCAG 2.1 AA compliance
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 * (Replaced horse-selector-placeholder with honest beta-excluded entry notice)
 * Story 5-1: Competition Entry System - Task 4
 */

import React, { memo } from 'react';
import { Calendar, DollarSign, Trophy, Users, AlertCircle } from 'lucide-react';
import BaseModal from '@/components/common/BaseModal';
import { isBetaMode } from '@/config/betaRouteScope';

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
  /** Loading state (kept for interface compatibility; entry is beta-excluded) */
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
 * Displays detailed competition information with beta-readonly entry notice.
 * Delegates portal, focus trap, scroll lock, and keyboard handling to BaseModal.
 */
const CompetitionDetailModal = memo(function CompetitionDetailModal({
  isOpen,
  onClose,
  competition,
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

  const footerContent = (
    <button
      type="button"
      onClick={onClose}
      disabled={isSubmitting}
      className="px-4 py-2 border border-[rgba(37,99,235,0.3)] rounded-lg text-[rgb(220,235,255)] hover:bg-[rgba(37,99,235,0.1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Close
    </button>
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
            className="inline-block px-3 py-1 bg-[rgba(37,99,235,0.1)] text-blue-400 text-sm font-medium rounded-full border border-blue-500/30"
            data-testid="competition-discipline"
          >
            {competition.discipline}
          </span>

          {/* Description */}
          {competition.description && (
            <p
              id="competition-modal-description"
              className="text-[rgb(148,163,184)]"
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
              className="flex items-center space-x-3 p-3 bg-[rgba(15,35,70,0.5)] rounded-lg"
              data-testid="competition-date"
            >
              <Calendar className="h-5 w-5 text-[rgb(148,163,184)]" aria-hidden="true" />
              <div>
                <p className="text-xs text-[rgb(148,163,184)] uppercase tracking-wider">
                  Event Date
                </p>
                <p className="text-[rgb(220,235,255)] font-medium">
                  {formatDate(competition.date)}
                </p>
              </div>
            </div>

            {/* Location */}
            {competition.location && (
              <div className="flex items-center space-x-3 p-3 bg-[rgba(15,35,70,0.5)] rounded-lg">
                <Users className="h-5 w-5 text-[rgb(148,163,184)]" aria-hidden="true" />
                <div>
                  <p className="text-xs text-[rgb(148,163,184)] uppercase tracking-wider">
                    Location
                  </p>
                  <p className="text-[rgb(220,235,255)] font-medium">{competition.location}</p>
                </div>
              </div>
            )}

            {/* Prize Pool */}
            <div
              className="flex items-center space-x-3 p-3 bg-[rgba(212,168,67,0.1)] rounded-lg"
              data-testid="competition-prize-pool"
            >
              <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
              <div>
                <p className="text-xs text-amber-400 uppercase tracking-wider">Total Prize Pool</p>
                <p className="text-[rgb(220,235,255)] font-bold text-lg">
                  {formatCurrency(competition.prizePool)}
                </p>
              </div>
            </div>

            {/* Entry Fee */}
            <div
              className="flex items-center space-x-3 p-3 bg-[rgba(16,185,129,0.1)] rounded-lg"
              data-testid="competition-entry-fee"
            >
              <DollarSign className="h-5 w-5 text-green-500" aria-hidden="true" />
              <div>
                <p className="text-xs text-emerald-400 uppercase tracking-wider">Entry Fee</p>
                <p className="text-[rgb(220,235,255)] font-bold text-lg">
                  {formatCurrency(competition.entryFee)}
                </p>
              </div>
            </div>
          </div>

          {/* Prize Distribution */}
          {prizeDistribution && (
            <div
              className="bg-[rgba(212,168,67,0.1)] border border-amber-500/30 rounded-lg p-4"
              data-testid="prize-distribution"
            >
              <h3 className="text-sm font-semibold text-[rgb(220,235,255)] mb-3 flex items-center">
                <Trophy className="h-4 w-4 text-amber-500 mr-2" aria-hidden="true" />
                Prize Distribution
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center" data-testid="prize-1st">
                  <div className="text-2xl mb-1">1st</div>
                  <div className="text-amber-400 font-bold">
                    {formatCurrency(prizeDistribution.first)}
                  </div>
                  <div className="text-xs text-[rgb(148,163,184)]">50%</div>
                </div>
                <div className="text-center" data-testid="prize-2nd">
                  <div className="text-2xl mb-1">2nd</div>
                  <div className="text-[rgb(148,163,184)] font-bold">
                    {formatCurrency(prizeDistribution.second)}
                  </div>
                  <div className="text-xs text-[rgb(148,163,184)]">30%</div>
                </div>
                <div className="text-center" data-testid="prize-3rd">
                  <div className="text-2xl mb-1">3rd</div>
                  <div className="text-orange-600 font-bold">
                    {formatCurrency(prizeDistribution.third)}
                  </div>
                  <div className="text-xs text-[rgb(148,163,184)]">20%</div>
                </div>
              </div>
            </div>
          )}

          {/* Entry Requirements */}
          <div data-testid="entry-requirements">
            <h3 className="text-sm font-semibold text-[rgb(220,235,255)] mb-2">
              Entry Requirements
            </h3>
            {hasRequirements ? (
              <ul className="space-y-2">
                {competition.entryRequirements!.map((requirement, index) => (
                  <li key={index} className="flex items-start text-sm text-[rgb(148,163,184)]">
                    <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                    {requirement}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[rgb(148,163,184)]">
                No specific requirements for this competition.
              </p>
            )}
          </div>

          {/* Participants Info */}
          {competition.maxParticipants !== undefined && (
            <div className="flex items-center justify-between p-3 bg-[rgba(15,35,70,0.5)] rounded-lg">
              <span className="text-sm text-[rgb(148,163,184)]">Current Participants</span>
              <span className="font-medium text-[rgb(220,235,255)]">
                {competition.currentParticipants ?? 0} / {competition.maxParticipants}
              </span>
            </div>
          )}

          {/* Competition entry — beta-readonly: notice only shown in beta mode */}
          {isBetaMode && (
            <div
              className="rounded-lg border border-[var(--glass-border)] bg-[rgba(10,14,26,0.6)] p-6 text-center"
              data-testid="competition-entry-beta-notice"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[rgba(200,168,78,0.1)] mb-3">
                <span className="text-xl" aria-hidden="true">
                  🔒
                </span>
              </div>
              <p className="text-[rgb(220,235,255)] font-medium text-sm">
                Competition entry is not available in this beta.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              className="flex items-center space-x-2 p-3 bg-[rgba(239,68,68,0.1)] border border-red-500/30 rounded-lg"
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
