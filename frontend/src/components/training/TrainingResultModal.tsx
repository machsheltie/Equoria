/**
 * TrainingResultModal Component
 *
 * Modal for displaying training session results with celebration styling:
 * - Success message with celebration emoji
 * - Score gain breakdown showing base and trait bonus
 * - New score display
 * - Additional gains section (stat gains and XP)
 * - Next training availability date
 * - Close button (primary action)
 * - Keyboard support (Escape to close)
 * - Click outside backdrop to close
 * - Focus management when modal opens
 *
 * Story 4-1: Training Session Interface - Task 5
 */

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, PartyPopper } from 'lucide-react';

export interface TrainingResultModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Callback when modal should close
   */
  onClose: () => void;

  /**
   * Name of the trained discipline
   */
  disciplineName: string;

  /**
   * Total score gain (base + trait bonus)
   */
  scoreGain: number;

  /**
   * Base score gain from training (+5 typically)
   */
  baseScoreGain: number;

  /**
   * Trait bonus modifier
   */
  traitBonus: number;

  /**
   * New total discipline score after training
   */
  newScore: number;

  /**
   * Optional stat gains from training session
   */
  statGains?: { [stat: string]: number };

  /**
   * Optional XP gain from training session
   */
  xpGain?: number;

  /**
   * Next training availability date (string or Date object)
   */
  nextTrainingDate: string | Date;
}

/**
 * Formats a date for display
 */
function formatNextTrainingDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return 'Date unavailable';
  }

  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats the score breakdown text
 */
function formatScoreBreakdown(baseScoreGain: number, traitBonus: number): string {
  if (traitBonus === 0) {
    return `+${baseScoreGain} base`;
  }

  const traitSign = traitBonus > 0 ? '+' : '';
  return `+${baseScoreGain} base, ${traitSign}${traitBonus} trait bonus`;
}

/**
 * TrainingResultModal Component
 */
const TrainingResultModal = ({
  isOpen,
  onClose,
  disciplineName,
  scoreGain,
  baseScoreGain,
  traitBonus,
  newScore,
  statGains,
  xpGain,
  nextTrainingDate,
}: TrainingResultModalProps) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Format values for display
  const formattedDate = formatNextTrainingDate(nextTrainingDate);
  const scoreBreakdown = formatScoreBreakdown(baseScoreGain, traitBonus);
  const hasAdditionalGains =
    (statGains && Object.keys(statGains).length > 0) || (xpGain !== undefined && xpGain > 0);

  // Handle Escape key press
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Focus management and keyboard handler
  useEffect(() => {
    if (isOpen) {
      // Store previously focused element
      previousActiveElement.current = document.activeElement;

      // Add keyboard listener
      document.addEventListener('keydown', handleKeyDown);

      // Focus the close button for accessibility
      if (closeButtonRef.current) {
        closeButtonRef.current.focus();
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
      data-testid="training-result-modal-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-result-title"
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
        data-testid="training-result-modal"
      >
        {/* Header with celebration */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-2">
            <PartyPopper className="w-8 h-8 text-green-600 mr-2" aria-hidden="true" />
            <h2 id="training-result-title" className="text-2xl font-bold text-green-600">
              Training Complete!
            </h2>
            <span className="ml-2 text-2xl" role="img" aria-label="celebration">
              🎉
            </span>
          </div>
        </div>

        {/* Discipline and Score Information */}
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700" data-testid="discipline-name">
            {disciplineName}
          </p>

          <p className="text-4xl font-bold text-green-600 mt-3" data-testid="score-gain">
            +{scoreGain}
          </p>

          <p className="text-sm text-gray-600 mt-1" data-testid="score-breakdown">
            ({scoreBreakdown})
          </p>
        </div>

        {/* New Score Display */}
        <div className="mt-4 text-center">
          <p className="font-semibold text-gray-900" data-testid="new-score">
            New Score: <span className="text-blue-600">{newScore}</span>
          </p>
        </div>

        {/* Additional Gains Section */}
        {hasAdditionalGains && (
          <div
            className="mt-4 border-t border-gray-200 pt-4"
            data-testid="additional-gains-section"
          >
            <h3 className="font-semibold text-gray-700 mb-2">Additional Gains:</h3>
            <ul className="space-y-1 text-sm" data-testid="gains-list">
              {statGains &&
                Object.entries(statGains).map(([stat, gain]) => (
                  <li key={stat} className="text-gray-600" data-testid={`stat-gain-${stat}`}>
                    • {stat}: <span className="text-green-600 font-medium">+{gain}</span>
                  </li>
                ))}
              {xpGain !== undefined && xpGain > 0 && (
                <li className="text-yellow-600 font-semibold" data-testid="xp-gain">
                  • XP: +{xpGain}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Next Training Date */}
        <div
          className="mt-4 text-sm text-gray-500 flex items-center justify-center"
          data-testid="next-training-section"
        >
          <Calendar className="w-4 h-4 mr-1" aria-hidden="true" />
          <span data-testid="next-training-date">Next Training Available: {formattedDate}</span>
        </div>

        {/* Close Button */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="w-full mt-6 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          data-testid="close-button"
        >
          Close
        </button>
      </div>
    </div>
  );

  // Render via portal for proper stacking context
  return createPortal(modalContent, document.body);
};

export default TrainingResultModal;
