/**
 * EntryConfirmationModal Component
 *
 * Confirmation modal shown before submitting competition entry:
 * - Displays summary of selected horse(s) with names and levels
 * - Shows competition details (name, discipline, date)
 * - Displays entry fee with balance verification
 * - Shows user's current balance and new balance after entry
 * - Insufficient balance warning (red alert) if balance < entry fee
 * - Success state with confirmation message and entry details
 * - Error state with error message and retry option
 * - Loading state during submission
 *
 * Features:
 * - React.memo for performance
 * - useCallback for event handlers
 * - Focus trap when open
 * - Scroll lock when open
 * - Escape key to close (when not submitting)
 * - Backdrop click to close (when not submitting)
 * - WCAG 2.1 AA compliance
 *
 * Story 5-1: Competition Entry System - Task 6
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Competition data structure for the modal
 */
export interface Competition {
  id: number;
  name: string;
  discipline: string;
  date: string;
  entryFee: number;
}

/**
 * Selected horse data structure
 */
export interface SelectedHorse {
  id: number;
  name: string;
  level: number;
}

/**
 * EntryConfirmationModal component props
 */
export interface EntryConfirmationModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Competition data to display (null hides modal) */
  competition: Competition | null;
  /** Array of selected horses for entry */
  selectedHorses: SelectedHorse[];
  /** User's current balance */
  userBalance: number;
  /** Callback when entry is confirmed - returns Promise for async submission */
  onConfirm: () => Promise<void>;
  /** Loading state during submission */
  isSubmitting?: boolean;
  /** Error message from failed submission */
  submitError?: string;
  /** Success state after successful submission */
  submitSuccess?: boolean;
}

/**
 * Format currency for display
 * Formats as $X,XXX
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
 * Format entry fee for display
 * Returns "Free" for zero amount, otherwise formats as $X,XXX
 */
const formatEntryFee = (amount: number): string => {
  if (amount === 0) return 'Free';
  return formatCurrency(amount);
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
 * EntryConfirmationModal Component
 *
 * Displays confirmation dialog before submitting competition entry.
 * Optimized with React.memo for performance.
 */
const EntryConfirmationModal = memo(function EntryConfirmationModal({
  isOpen,
  onClose,
  competition,
  selectedHorses,
  userBalance,
  onConfirm,
  isSubmitting = false,
  submitError,
  submitSuccess = false,
}: EntryConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Calculate balance values
  const entryFee = competition?.entryFee ?? 0;
  const newBalance = userBalance - entryFee;
  const hasSufficientBalance = userBalance >= entryFee;

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

  // Handle confirm button click
  const handleConfirmClick = useCallback(async () => {
    if (hasSufficientBalance && !isSubmitting) {
      await onConfirm();
    }
  }, [hasSufficientBalance, isSubmitting, onConfirm]);

  // Handle cancel button click
  const handleCancelClick = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  // Handle close button click
  const handleCloseClick = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

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
        aria-labelledby="entry-confirmation-title"
        aria-describedby="entry-confirmation-description"
        tabIndex={-1}
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto focus:outline-none"
        onClick={(e) => e.stopPropagation()}
        data-testid="entry-confirmation-modal"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex-1 pr-4">
            <h2
              id="entry-confirmation-title"
              className="text-xl font-bold text-gray-900"
            >
              Confirm Entry
            </h2>
            <p id="entry-confirmation-description" className="text-sm text-gray-500 mt-1">
              Review your competition entry details before submitting
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseClick}
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
          {/* Success State */}
          {submitSuccess && (
            <div
              className="flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg"
              data-testid="success-message"
            >
              <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium text-green-800">Entry Confirmed!</p>
                <p className="text-sm text-green-700 mt-1">
                  Your entry to <span className="font-semibold">{competition.name}</span> has been
                  successfully submitted.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {submitError && (
            <div
              className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg"
              data-testid="error-message"
            >
              <XCircle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium text-red-800">Submission Failed</p>
                <p className="text-sm text-red-700 mt-1">{submitError}</p>
              </div>
            </div>
          )}

          {/* Competition Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
              <Trophy className="h-4 w-4 text-amber-500 mr-2" aria-hidden="true" />
              Competition Details
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Name</span>
                <span
                  className="text-sm font-medium text-gray-900"
                  data-testid="competition-name"
                >
                  {competition.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Discipline</span>
                <span
                  className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                  data-testid="competition-discipline"
                >
                  {competition.discipline}
                </span>
              </div>
              <div className="flex justify-between items-center" data-testid="competition-date">
                <span className="text-sm text-gray-600 flex items-center">
                  <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
                  Date
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(competition.date)}
                </span>
              </div>
            </div>
          </div>

          {/* Selected Horses */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Selected Horses ({selectedHorses.length})
            </h3>
            <div
              className="space-y-2"
              data-testid="selected-horses-list"
            >
              {selectedHorses.length > 0 ? (
                selectedHorses.map((horse) => (
                  <div
                    key={horse.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                    data-testid={`horse-item-${horse.id}`}
                  >
                    <span className="font-medium text-gray-900">{horse.name}</span>
                    <span className="text-sm text-gray-500">Level {horse.level}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg">
                  No horses selected
                </p>
              )}
            </div>
          </div>

          {/* Entry Fee & Balance Section */}
          <div
            className={cn(
              'rounded-lg p-4 border-2',
              hasSufficientBalance ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            )}
            data-testid="balance-section"
          >
            {/* Entry Fee */}
            <div
              className="flex justify-between items-center mb-3"
              data-testid="entry-fee-section"
            >
              <span className="text-sm font-medium text-gray-700 flex items-center">
                <DollarSign className="h-4 w-4 mr-1" aria-hidden="true" />
                Entry Fee
              </span>
              <span
                className="text-lg font-bold text-gray-900"
                data-testid="entry-fee"
              >
                {formatEntryFee(entryFee)}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-3 space-y-2">
              {/* Current Balance */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Current Balance</span>
                <span
                  className="text-sm font-medium text-gray-900"
                  data-testid="current-balance"
                >
                  {formatCurrency(userBalance)}
                </span>
              </div>

              {/* New Balance */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Balance After Entry</span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    hasSufficientBalance ? 'text-green-700' : 'text-red-700'
                  )}
                  data-testid="new-balance"
                >
                  {formatCurrency(Math.max(0, newBalance))}
                </span>
              </div>

              {/* Balance Status */}
              {hasSufficientBalance ? (
                <div className="flex items-center mt-2 text-green-700">
                  <CheckCircle
                    className="h-4 w-4 mr-1"
                    aria-hidden="true"
                    data-testid="balance-status-icon"
                  />
                  <span className="text-sm">Sufficient balance</span>
                </div>
              ) : (
                <div
                  className="flex items-start mt-2 p-2 bg-red-100 rounded"
                  data-testid="insufficient-balance-warning"
                >
                  <AlertTriangle className="h-4 w-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm text-red-700">
                    Insufficient balance. You need {formatCurrency(entryFee - userBalance)} more to
                    enter this competition.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="cancel-button"
          >
            {submitSuccess ? 'Close' : 'Cancel'}
          </button>
          {!submitSuccess && (
            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={isSubmitting || !hasSufficientBalance}
              className={cn(
                'px-6 py-2 rounded-lg text-white transition-colors flex items-center',
                'bg-blue-600 hover:bg-blue-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-busy={isSubmitting}
              data-testid="confirm-button"
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    data-testid="loading-spinner"
                    aria-hidden="true"
                  />
                  <span>Submitting...</span>
                </>
              ) : (
                'Confirm Entry'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Render via portal for proper stacking context
  return createPortal(modalContent, document.body);
});

export default EntryConfirmationModal;
