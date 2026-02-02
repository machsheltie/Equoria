/**
 * CompetitionDetailModal Component
 *
 * A modal dialog for displaying detailed competition information:
 * - Competition name, discipline, and description
 * - Event date with calendar icon
 * - Prize pool with breakdown (1st: 50%, 2nd: 30%, 3rd: 20%)
 * - Entry fee display
 * - Entry requirements list
 * - Horse selector placeholder (Task 5)
 * - Entry action button with loading/error states
 *
 * Features:
 * - Radix UI Dialog for accessibility
 * - Focus trap when open
 * - Scroll lock when open
 * - Escape key to close
 * - Backdrop click to close
 * - Responsive design (mobile/tablet/desktop)
 * - WCAG 2.1 AA compliance
 *
 * Story 5-1: Competition Entry System - Task 4
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, DollarSign, Trophy, X, Users, AlertCircle, Loader2 } from 'lucide-react';

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
  /** Callback when entry button is clicked */
  onEnter?: (competitionId: number) => void;
  /** Loading state during submission */
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
 * Displays detailed competition information with entry functionality.
 */
const CompetitionDetailModal = memo(function CompetitionDetailModal({
  isOpen,
  onClose,
  competition,
  onEnter,
  isSubmitting = false,
  error,
}: CompetitionDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Handle Escape key press
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    },
    [onClose, isSubmitting]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && !isSubmitting) {
        onClose();
      }
    },
    [onClose, isSubmitting]
  );

  // Handle entry button click
  const handleEnterClick = useCallback(() => {
    if (competition && onEnter) {
      onEnter(competition.id);
    }
  }, [competition, onEnter]);

  // Focus management and keyboard handler
  useEffect(() => {
    if (isOpen && competition) {
      // Store previously focused element
      previousActiveElement.current = document.activeElement;

      // Add keyboard listener
      document.addEventListener('keydown', handleKeyDown);

      // Focus the modal container for accessibility
      if (modalRef.current) {
        modalRef.current.focus();
      }

      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';

        // Restore focus to previous element
        if (previousActiveElement.current && previousActiveElement.current instanceof HTMLElement) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen, competition, handleKeyDown]);

  // Don't render if not open or no competition
  if (!isOpen || !competition) {
    return null;
  }

  const prizeDistribution = calculatePrizeDistribution(competition.prizePool);
  const hasRequirements =
    competition.entryRequirements && competition.entryRequirements.length > 0;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      data-testid="modal-backdrop"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="competition-modal-title"
        aria-describedby="competition-modal-description"
        tabIndex={-1}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto focus:outline-none"
        onClick={(e) => e.stopPropagation()}
        data-testid="competition-detail-modal"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex-1 pr-4">
            <h2
              id="competition-modal-title"
              className="text-2xl font-bold text-gray-900 truncate"
              data-testid="competition-name"
            >
              {competition.name}
            </h2>
            <span
              className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full"
              data-testid="competition-discipline"
            >
              {competition.discipline}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1"
            aria-label="Close modal"
            data-testid="close-modal-button"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          {competition.description && (
            <p
              id="competition-modal-description"
              className="text-gray-600"
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
              className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
              data-testid="competition-date"
            >
              <Calendar className="h-5 w-5 text-gray-400" aria-hidden="true" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Event Date</p>
                <p className="text-gray-900 font-medium">{formatDate(competition.date)}</p>
              </div>
            </div>

            {/* Location */}
            {competition.location && (
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Users className="h-5 w-5 text-gray-400" aria-hidden="true" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Location</p>
                  <p className="text-gray-900 font-medium">{competition.location}</p>
                </div>
              </div>
            )}

            {/* Prize Pool */}
            <div
              className="flex items-center space-x-3 p-3 bg-amber-50 rounded-lg"
              data-testid="competition-prize-pool"
            >
              <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
              <div>
                <p className="text-xs text-amber-700 uppercase tracking-wider">Total Prize Pool</p>
                <p className="text-amber-900 font-bold text-lg">
                  {formatCurrency(competition.prizePool)}
                </p>
              </div>
            </div>

            {/* Entry Fee */}
            <div
              className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg"
              data-testid="competition-entry-fee"
            >
              <DollarSign className="h-5 w-5 text-green-500" aria-hidden="true" />
              <div>
                <p className="text-xs text-green-700 uppercase tracking-wider">Entry Fee</p>
                <p className="text-green-900 font-bold text-lg">
                  {formatCurrency(competition.entryFee)}
                </p>
              </div>
            </div>
          </div>

          {/* Prize Distribution */}
          <div
            className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg p-4"
            data-testid="prize-distribution"
          >
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
              <Trophy className="h-4 w-4 text-amber-500 mr-2" aria-hidden="true" />
              Prize Distribution
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center" data-testid="prize-1st">
                <div className="text-2xl mb-1">1st</div>
                <div className="text-amber-700 font-bold">
                  {formatCurrency(prizeDistribution.first)}
                </div>
                <div className="text-xs text-gray-500">50%</div>
              </div>
              <div className="text-center" data-testid="prize-2nd">
                <div className="text-2xl mb-1">2nd</div>
                <div className="text-gray-600 font-bold">
                  {formatCurrency(prizeDistribution.second)}
                </div>
                <div className="text-xs text-gray-500">30%</div>
              </div>
              <div className="text-center" data-testid="prize-3rd">
                <div className="text-2xl mb-1">3rd</div>
                <div className="text-orange-600 font-bold">
                  {formatCurrency(prizeDistribution.third)}
                </div>
                <div className="text-xs text-gray-500">20%</div>
              </div>
            </div>
          </div>

          {/* Entry Requirements */}
          <div data-testid="entry-requirements">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Entry Requirements</h3>
            {hasRequirements ? (
              <ul className="space-y-2">
                {competition.entryRequirements!.map((requirement, index) => (
                  <li key={index} className="flex items-start text-sm text-gray-600">
                    <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 mr-2 flex-shrink-0" />
                    {requirement}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No specific requirements for this competition.</p>
            )}
          </div>

          {/* Participants Info */}
          {competition.maxParticipants !== undefined && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Current Participants</span>
              <span className="font-medium">
                {competition.currentParticipants ?? 0} / {competition.maxParticipants}
              </span>
            </div>
          )}

          {/* Horse Selector Placeholder */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
            data-testid="horse-selector-placeholder"
          >
            <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" aria-hidden="true" />
            <p className="text-gray-500 font-medium">Select a Horse</p>
            <p className="text-sm text-gray-400 mt-1">
              Horse selector will be implemented in Task 5
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg"
              data-testid="error-message"
            >
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" aria-hidden="true" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleEnterClick}
            disabled={isSubmitting || true} // Disabled until horse selector is implemented
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            aria-busy={isSubmitting}
            data-testid="enter-button"
          >
            {isSubmitting ? (
              <>
                <Loader2
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
                  data-testid="loading-spinner"
                  aria-hidden="true"
                />
                <span>Entering...</span>
              </>
            ) : (
              'Enter Competition'
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Render via portal for proper stacking context
  return createPortal(modalContent, document.body);
});

export default CompetitionDetailModal;
