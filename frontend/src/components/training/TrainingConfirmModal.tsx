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
 * - Keyboard support (Escape to close)
 * - Click outside backdrop to close
 * - Focus management when modal opens
 * - Loading state for confirm button
 *
 * Story 4-1: Training Session Interface - Task 4
 */

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

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

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
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
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Calculate derived values
  const totalModifier = calculateTotalModifier(traitModifiers);
  const expectedGain = Math.max(0, baseScoreGain + totalModifier);
  const newScore = currentScore + expectedGain;
  const nextAvailableDate = getNextAvailableDate(cooldownDays);

  // Handle Escape key press
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading]
  );

  // Focus management and keyboard handler
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen, handleKeyDown]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      data-testid="training-confirm-modal-backdrop"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-confirm-title"
        tabIndex={-1}
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
        data-testid="training-confirm-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 id="training-confirm-title" className="text-2xl font-bold text-gray-900">
            Confirm Training
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close modal"
            data-testid="close-button"
          >
            <X size={24} />
          </button>
        </div>

        {/* Training Details */}
        <div className="space-y-4">
          {/* Horse and Discipline Info */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Horse</span>
              <span className="text-gray-900 font-semibold" data-testid="horse-name">
                {horseName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Discipline</span>
              <span className="text-gray-900 font-semibold" data-testid="discipline-name">
                {disciplineName}
              </span>
            </div>
          </div>

          {/* Expected Outcome */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Expected Outcome</h3>

            {/* Base Score Gain */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Base Score Gain</span>
              <span className="text-sm font-semibold text-green-600" data-testid="base-score-gain">
                +{baseScoreGain}
              </span>
            </div>

            {/* Score Progression */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-600">Score Progression</span>
              <span className="text-lg font-semibold" data-testid="score-progression">
                <span data-testid="current-score">{currentScore}</span>
                <span className="mx-2 text-gray-400">→</span>
                <span className="text-blue-600" data-testid="new-score">
                  {newScore}
                </span>
              </span>
            </div>

            {/* Trait Modifiers */}
            {traitModifiers.length > 0 && (
              <div className="border-t border-gray-200 pt-3 mt-3">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Trait Modifiers
                </h4>
                <ul className="space-y-1" data-testid="trait-modifiers-list">
                  {traitModifiers.map((trait, index) => (
                    <li
                      key={`${trait.name}-${index}`}
                      className="flex justify-between items-center text-sm"
                      data-testid={`trait-modifier-${index}`}
                    >
                      <span className="text-gray-600">{trait.name}</span>
                      <span
                        className={`font-semibold ${
                          trait.modifier >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                        data-testid={`trait-modifier-value-${index}`}
                      >
                        {trait.modifier >= 0 ? '+' : ''}
                        {trait.modifier}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                  <span className="text-sm font-medium text-gray-700">Total Modifier</span>
                  <span
                    className={`font-semibold ${
                      totalModifier >= 0 ? 'text-green-600' : 'text-red-600'
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
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Next Training Available</span>
              <span className="text-sm text-gray-600" data-testid="next-training-date">
                {nextAvailableDate}
              </span>
            </div>
            {cooldownDays > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {cooldownDays} day{cooldownDays !== 1 ? 's' : ''} cooldown after this session
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="cancel-button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            aria-busy={isLoading}
            data-testid="confirm-button"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
        </div>
      </div>
    </div>
  );

  // Render via portal for proper stacking context
  return createPortal(modalContent, document.body);
};

export default TrainingConfirmModal;
