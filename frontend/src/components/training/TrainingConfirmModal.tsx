/**
 * TrainingConfirmModal Component
 *
 * Modal for confirming training session details before execution:
 * - Displays horse name and selected discipline
 * - Shows expected outcome with base score gain
 * - Shows current score -> new score calculation
 * - Displays trait modifiers (positive/negative with color coding)
 * - Shows next training availability date
 * - Cancel and Confirm buttons
 * - Loading state for confirm button
 *
 * Story 4-1: Training Session Interface - Task 4
 * Migrated from hand-rolled `fixed inset-0` portal overlay → GameDialog
 * (Equoria-8l8zc, DECISIONS.md §8). Focus trap, scroll-lock, Escape close,
 * backdrop/outside-click dismissal, and focus restoration come from the native
 * Dialog primitive. During `isLoading` the dialog is held open by cancelling
 * the Escape / outside-interaction events (parity with the prior manual guards).
 */

import { formatDate } from '@/lib/formatDate';
import { X } from 'lucide-react';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';

export interface TraitModifier {
  name: string;
  modifier: number;
}

export interface TrainingConfirmModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Callback when modal should close
   */
  onClose: () => void;

  /**
   * Callback when training is confirmed
   */
  onConfirm: () => void;

  /**
   * Name of the horse being trained
   */
  horseName: string;

  /**
   * Name of the selected discipline
   */
  disciplineName: string;

  /**
   * Base score gain from training (+5 typically)
   */
  baseScoreGain: number;

  /**
   * Current discipline score
   */
  currentScore: number;

  /**
   * Array of trait modifiers affecting the training
   */
  traitModifiers: TraitModifier[];

  /**
   * Days until next training is available
   */
  cooldownDays: number;

  /**
   * Loading state during training mutation
   */
  isLoading?: boolean;
}

/**
 * Calculates total modifier from trait array
 */
function calculateTotalModifier(traitModifiers: TraitModifier[]): number {
  return traitModifiers.reduce((sum, trait) => sum + trait.modifier, 0);
}

/**
 * Calculates next training availability date
 */
function getNextAvailableDate(cooldownDays: number): string {
  if (cooldownDays <= 0) {
    return 'Immediately after this session';
  }

  const date = new Date();
  date.setDate(date.getDate() + cooldownDays);

  return formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * TrainingConfirmModal Component
 */
const TrainingConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  horseName,
  disciplineName,
  baseScoreGain,
  currentScore,
  traitModifiers,
  cooldownDays,
  isLoading = false,
}: TrainingConfirmModalProps) => {
  // Calculate derived values
  const totalModifier = calculateTotalModifier(traitModifiers);
  const expectedGain = Math.max(0, baseScoreGain + totalModifier);
  const newScore = currentScore + expectedGain;
  const nextAvailableDate = getNextAvailableDate(cooldownDays);

  return (
    <GameDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isLoading) {
          onClose();
        }
      }}
    >
      <GameDialogContent
        size="sm"
        data-testid="training-confirm-modal"
        aria-labelledby="training-confirm-title"
        noDescription
        hideCloseButton
        onEscapeKeyDown={(e) => {
          if (isLoading) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isLoading) e.preventDefault();
        }}
      >
        {/* Header */}
        <GameDialogHeader>
          <div className="flex items-center justify-between">
            <GameDialogTitle
              id="training-confirm-title"
              className="text-2xl font-bold text-[var(--text-primary)]"
            >
              Confirm Training
            </GameDialogTitle>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="text-role-secondary hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Close modal"
              data-testid="close-button"
            >
              <X size={24} />
            </button>
          </div>
        </GameDialogHeader>

        {/* Training Details */}
        <GameDialogBody>
          <div className="space-y-4">
            {/* Horse and Discipline Info */}
            <div className="bg-[var(--role-info-bg)] rounded-lg p-4 border border-[var(--role-info-border)]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-role-secondary">Horse</span>
                <span className="text-[var(--text-primary)] font-semibold" data-testid="horse-name">
                  {horseName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-role-secondary">Discipline</span>
                <span
                  className="text-[var(--text-primary)] font-semibold"
                  data-testid="discipline-name"
                >
                  {disciplineName}
                </span>
              </div>
            </div>

            {/* Expected Outcome */}
            <div>
              <h3 className="text-sm font-medium text-role-secondary mb-3">Expected Outcome</h3>

              {/* Base Score Gain */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-role-secondary">Base Score Gain</span>
                <span
                  className="text-sm font-semibold text-[var(--role-success-text)]"
                  data-testid="base-score-gain"
                >
                  +{baseScoreGain}
                </span>
              </div>

              {/* Score Progression */}
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-role-secondary">Score Progression</span>
                <span className="text-lg font-semibold" data-testid="score-progression">
                  <span data-testid="current-score" className="text-[var(--text-primary)]">
                    {currentScore}
                  </span>
                  <span className="mx-2 text-role-secondary">→</span>
                  <span className="text-[var(--role-info-text)]" data-testid="new-score">
                    {newScore}
                  </span>
                </span>
              </div>

              {/* Trait Modifiers */}
              {traitModifiers.length > 0 && (
                <div className="border-t border-[var(--glass-border)] pt-3 mt-3">
                  <h4 className="text-xs font-medium text-role-secondary uppercase tracking-wider mb-2">
                    Trait Modifiers
                  </h4>
                  <ul className="space-y-1" data-testid="trait-modifiers-list">
                    {traitModifiers.map((trait, index) => (
                      <li
                        key={`${trait.name}-${index}`}
                        className="flex justify-between items-center text-sm"
                        data-testid={`trait-modifier-${index}`}
                      >
                        <span className="text-role-secondary">{trait.name}</span>
                        <span
                          className={`font-semibold ${
                            trait.modifier >= 0
                              ? 'text-[var(--role-success-text)]'
                              : 'text-[var(--role-danger-text)]'
                          }`}
                          data-testid={`trait-modifier-value-${index}`}
                        >
                          {trait.modifier >= 0 ? '+' : ''}
                          {trait.modifier}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--glass-border)]">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      Total Modifier
                    </span>
                    <span
                      className={`font-semibold ${
                        totalModifier >= 0
                          ? 'text-[var(--role-success-text)]'
                          : 'text-[var(--role-danger-text)]'
                      }`}
                      data-testid="total-modifier"
                    >
                      {totalModifier >= 0 ? '+' : ''}
                      {totalModifier}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Next Training Availability */}
            <div className="bg-[var(--role-neutral-bg)] rounded-lg p-3 border border-[var(--glass-border)]">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-role-secondary">
                  Next Training Available
                </span>
                <span
                  className="text-sm text-[var(--text-primary)]"
                  data-testid="next-training-date"
                >
                  {nextAvailableDate}
                </span>
              </div>
              {cooldownDays > 0 && (
                <p className="text-xs text-role-secondary mt-1">
                  {cooldownDays} day{cooldownDays !== 1 ? 's' : ''} cooldown after this session
                </p>
              )}
            </div>
          </div>
        </GameDialogBody>

        {/* Actions */}
        <GameDialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-[var(--glass-border)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--role-info-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="cancel-button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-[var(--electric-blue-700)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--gold-dim)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            aria-busy={isLoading}
            data-testid="confirm-button"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-[var(--text-primary)]"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  role="status"
                  aria-label="Loading"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span role="status" aria-live="polite">
                  Training...
                </span>
              </>
            ) : (
              'Confirm Training'
            )}
          </button>
        </GameDialogFooter>
      </GameDialogContent>
    </GameDialog>
  );
};

export default TrainingConfirmModal;
