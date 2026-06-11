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
 * - Migrated from BaseModal → GameDialog (Equoria-o5hub.13, DECISIONS.md §8)
 * - Focus trap, scroll-lock, Escape close, and focus restoration from Radix Dialog
 * - WCAG 2.1 AA compliance
 *
 * Story 5-1: Competition Entry System - Task 6
 */

import React, { memo, useCallback } from 'react';
import { Coins, Calendar, CheckCircle, XCircle, AlertTriangle, Trophy } from 'lucide-react';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';

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
 * Entry fee renderer — game currency uses the canonical Currency component
 * (DECISIONS.md §9; no USD formatting). Zero renders as "Free".
 */
const EntryFee = ({ amount }: { amount: number }) =>
  amount === 0 ? <>Free</> : <Currency amount={amount} />;

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
 * Portal, focus trap, scroll lock, and keyboard handling come from Radix Dialog.
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
  // Calculate balance values
  const entryFee = competition?.entryFee ?? 0;
  const newBalance = userBalance - entryFee;
  const hasSufficientBalance = userBalance >= entryFee;

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

  // Don't render if no competition
  if (!competition && isOpen) {
    return null;
  }

  return (
    <GameDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) {
          onClose();
        }
      }}
    >
      <GameDialogContent
        size="md"
        data-testid="entry-confirmation-modal"
        aria-describedby="entry-confirmation-description"
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        <GameDialogHeader>
          <GameDialogTitle>Confirm Entry</GameDialogTitle>
          <GameDialogDescription id="entry-confirmation-description">
            Review your competition entry details before submitting
          </GameDialogDescription>
        </GameDialogHeader>

        {competition && (
          <GameDialogBody>
            <div className="space-y-6 pt-2">
              {/* Success State */}
              {submitSuccess && (
                <div
                  className="flex items-start space-x-3 p-4 bg-[rgba(16,185,129,0.1)] border border-emerald-500/30 rounded-lg"
                  data-testid="success-message"
                >
                  <CheckCircle
                    className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium text-[rgb(220,235,255)]">Entry Confirmed!</p>
                    <p className="text-sm text-emerald-400 mt-1">
                      Your entry to <span className="font-semibold">{competition.name}</span> has
                      been successfully submitted.
                    </p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {submitError && (
                <div
                  className="flex items-start space-x-3 p-4 bg-[rgba(239,68,68,0.1)] border border-red-500/30 rounded-lg"
                  data-testid="error-message"
                >
                  <XCircle
                    className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium text-[rgb(220,235,255)]">Submission Failed</p>
                    <p className="text-sm text-red-400 mt-1">{submitError}</p>
                  </div>
                </div>
              )}

              {/* Competition Details */}
              <div className="bg-[rgba(15,35,70,0.5)] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[rgb(220,235,255)] mb-3 flex items-center">
                  <Trophy className="h-4 w-4 text-amber-500 mr-2" aria-hidden="true" />
                  Competition Details
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Name</span>
                    <span
                      className="text-sm font-medium text-[rgb(220,235,255)]"
                      data-testid="competition-name"
                    >
                      {competition.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Discipline</span>
                    <span
                      className="inline-block px-2 py-0.5 bg-[rgba(37,99,235,0.1)] text-blue-400 text-xs font-medium rounded-full border border-blue-500/30"
                      data-testid="competition-discipline"
                    >
                      {competition.discipline}
                    </span>
                  </div>
                  <div className="flex justify-between items-center" data-testid="competition-date">
                    <span className="text-sm text-slate-400 flex items-center">
                      <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
                      Date
                    </span>
                    <span className="text-sm font-medium text-[rgb(220,235,255)]">
                      {formatDate(competition.date)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selected Horses */}
              <div>
                <h3 className="text-sm font-semibold text-[rgb(220,235,255)] mb-3">
                  Selected Horses ({selectedHorses.length})
                </h3>
                <div className="space-y-2" data-testid="selected-horses-list">
                  {selectedHorses.length > 0 ? (
                    selectedHorses.map((horse) => (
                      <div
                        key={horse.id}
                        className="flex justify-between items-center p-3 bg-[rgba(15,35,70,0.5)] rounded-lg"
                        data-testid={`horse-item-${horse.id}`}
                      >
                        <span className="font-medium text-[rgb(220,235,255)]">{horse.name}</span>
                        <span className="text-sm text-slate-400">Level {horse.level}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400 italic p-3 bg-[rgba(15,35,70,0.5)] rounded-lg">
                      No horses selected
                    </p>
                  )}
                </div>
              </div>

              {/* Entry Fee & Balance Section */}
              <div
                className={cn(
                  'rounded-lg p-4 border-2',
                  hasSufficientBalance
                    ? 'border-[var(--status-success)]/30 bg-[var(--badge-success-bg)]'
                    : 'border-[var(--status-danger)]/30 bg-[var(--badge-danger-bg)]'
                )}
                data-testid="balance-section"
              >
                {/* Entry Fee */}
                <div
                  className="flex justify-between items-center mb-3"
                  data-testid="entry-fee-section"
                >
                  <span className="text-sm font-medium text-[rgb(220,235,255)] flex items-center">
                    <Coins className="h-4 w-4 mr-1" aria-hidden="true" />
                    Entry Fee
                  </span>
                  <span
                    className="text-lg font-bold text-[rgb(220,235,255)]"
                    data-testid="entry-fee"
                  >
                    <EntryFee amount={entryFee} />
                  </span>
                </div>

                <div className="border-t border-[rgba(37,99,235,0.2)] pt-3 space-y-2">
                  {/* Current Balance */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Current Balance</span>
                    <span
                      className="text-sm font-medium text-[rgb(220,235,255)]"
                      data-testid="current-balance"
                    >
                      <Currency amount={userBalance} />
                    </span>
                  </div>

                  {/* New Balance */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Balance After Entry</span>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        hasSufficientBalance
                          ? 'text-[var(--role-success-text)]'
                          : 'text-[var(--role-danger-text)]'
                      )}
                      data-testid="new-balance"
                    >
                      <Currency amount={Math.max(0, newBalance)} />
                    </span>
                  </div>

                  {/* Balance Status */}
                  {hasSufficientBalance ? (
                    <div className="flex items-center mt-2 text-emerald-400">
                      <CheckCircle
                        className="h-4 w-4 mr-1"
                        aria-hidden="true"
                        data-testid="balance-status-icon"
                      />
                      <span className="text-sm">Sufficient balance</span>
                    </div>
                  ) : (
                    <div
                      className="flex items-start mt-2 p-2 bg-[rgba(239,68,68,0.15)] rounded"
                      data-testid="insufficient-balance-warning"
                    >
                      <AlertTriangle
                        className="h-4 w-4 text-red-400 mr-2 mt-0.5 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-sm text-[var(--status-danger)]">
                        Insufficient balance. You need <Currency amount={entryFee - userBalance} />{' '}
                        more to enter this competition.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </GameDialogBody>
        )}

        {/* Action hierarchy (DECISIONS.md §5): one gold primary per surface —
            "Confirm Entry" is primary; Cancel/Close is secondary. The canonical
            Button `pending` state renders the spinner and locks the action. */}
        <GameDialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancelClick}
            disabled={isSubmitting}
            data-testid="cancel-button"
          >
            {submitSuccess ? 'Close' : 'Cancel'}
          </Button>
          {!submitSuccess && (
            <Button
              type="button"
              onClick={handleConfirmClick}
              disabled={isSubmitting || !hasSufficientBalance}
              pending={isSubmitting}
              data-testid="confirm-button"
            >
              Confirm Entry
            </Button>
          )}
        </GameDialogFooter>
      </GameDialogContent>
    </GameDialog>
  );
});

export default EntryConfirmationModal;
