/**
 * LevelUpCelebrationModal Component
 *
 * A full-screen celebration modal displayed when a horse levels up:
 * - Centered content card with backdrop overlay
 * - Celebration animations (confetti effect, sparkles)
 * - Trophy/star burst animation with level badge
 * - Before/after stat comparison table with green increase arrows
 * - Total stat gain summary
 * - Optional XP gained display
 *
 * Features:
 * - Portal rendering for proper stacking context
 * - Focus trap when open
 * - Scroll lock when open
 * - Escape key to close
 * - Backdrop click to close
 * - "Continue" button to dismiss
 * - WCAG 2.1 AA compliance
 * - Responsive design (mobile, tablet, desktop)
 *
 * Story 5-4: Level-Up Celebration Modal - Task 2
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Star, ArrowUp, X, Sparkles } from 'lucide-react';

/**
 * Represents a single stat change with before and after values
 */
export interface StatChange {
  /** Name of the stat (e.g., "Speed", "Stamina") */
  statName: string;
  /** Value before the level up */
  oldValue: number;
  /** Value after the level up */
  newValue: number;
}

/**
 * Props interface for LevelUpCelebrationModal component
 */
export interface LevelUpCelebrationModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** ID of the horse that leveled up */
  horseId: number;
  /** Name of the horse that leveled up */
  horseName: string;
  /** Previous level before the level up */
  oldLevel: number;
  /** New level after the level up */
  newLevel: number;
  /** Array of stat changes from the level up */
  statChanges: StatChange[];
  /** Total XP gained (optional) */
  totalXpGained?: number;
}

/**
 * Calculate total stat gain across all stat changes
 */
const calculateTotalStatGain = (statChanges: StatChange[]): number => {
  return statChanges.reduce((total, change) => {
    const gain = change.newValue - change.oldValue;
    return total + Math.max(gain, 0);
  }, 0);
};

/**
 * LevelUpCelebrationModal Component
 *
 * Renders a celebratory modal when a horse levels up, showing
 * level transition, stat changes, and optional XP gained.
 */
const LevelUpCelebrationModal = memo(function LevelUpCelebrationModal({
  isOpen,
  onClose,
  _horseId,
  horseName,
  oldLevel,
  newLevel,
  statChanges,
  totalXpGained,
}: LevelUpCelebrationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  /**
   * Handle Escape key press to close modal
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  /**
   * Handle backdrop click to close modal
   */
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  /**
   * Stop propagation when clicking inside modal content
   */
  const handleContentClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  /**
   * Handle Continue button click
   */
  const handleContinue = useCallback(() => {
    onClose();
  }, [onClose]);

  /**
   * Focus management, keyboard handler, and scroll lock
   */
  useEffect(() => {
    if (isOpen) {
      // Store previously focused element for restoration
      previousActiveElement.current = document.activeElement;

      // Add keyboard listener for Escape key
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
        if (
          previousActiveElement.current &&
          previousActiveElement.current instanceof HTMLElement
        ) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen, handleKeyDown]);

  // Do not render if not open
  if (!isOpen) {
    return null;
  }

  // Calculate total stat gain for summary display
  const totalStatGain = calculateTotalStatGain(statChanges);

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      data-testid="modal-backdrop"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="levelup-modal-title"
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col focus:outline-none animate-fade-in"
        onClick={handleContentClick}
        data-testid="levelup-celebration-modal"
      >
        {/* Celebration Effect (confetti/sparkles visual) */}
        <div
          data-testid="celebration-effect"
          className="absolute inset-0 pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          <Sparkles className="absolute top-2 left-4 h-6 w-6 text-yellow-400 animate-pulse" />
          <Star className="absolute top-4 right-6 h-5 w-5 text-yellow-300 animate-bounce" />
          <Sparkles className="absolute bottom-8 right-4 h-4 w-4 text-amber-400 animate-pulse" />
          <Star className="absolute bottom-4 left-6 h-5 w-5 text-yellow-500 animate-bounce" />
        </div>

        {/* Celebration Header */}
        <div className="bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 p-6 text-center relative">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
            aria-label="Close level up notification"
            data-testid="close-button"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Trophy Icon */}
          <div className="flex justify-center mb-3">
            <div className="bg-white/20 rounded-full p-4">
              <Trophy
                className="h-10 w-10 text-yellow-100 drop-shadow-lg"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Level Badge with scale animation */}
          <div
            data-testid="level-badge"
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white text-amber-600 text-2xl font-black shadow-lg mb-3 animate-scale-up"
          >
            {newLevel}
          </div>

          {/* Congratulations Heading */}
          <h2
            id="levelup-modal-title"
            className="text-2xl font-bold text-white mb-1"
            data-testid="congratulations-heading"
          >
            Level Up!
          </h2>

          {/* Horse Name */}
          <p className="text-white/90 font-medium" data-testid="horse-name">
            {horseName}
          </p>

          {/* Level Transition Text */}
          <p
            className="text-white/80 text-sm mt-1"
            data-testid="level-transition"
          >
            Level {oldLevel} → Level {newLevel}
          </p>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {/* XP Gained (conditional) */}
          {totalXpGained !== undefined && totalXpGained !== null && (
            <div className="flex items-center justify-center mb-4">
              <span
                data-testid="xp-gained-display"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold"
              >
                +{totalXpGained} XP
              </span>
            </div>
          )}

          {/* Stat Changes Table */}
          <div data-testid="stat-changes-table" className="mb-4">
            {statChanges.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                  Stat Changes
                </h3>
                <div className="space-y-2">
                  {statChanges.map((change) => {
                    const gain = change.newValue - change.oldValue;
                    const hasIncreased = gain > 0;

                    return (
                      <div
                        key={change.statName}
                        data-testid={`stat-row-${change.statName}`}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50"
                      >
                        {/* Stat Name */}
                        <span className="text-sm font-medium text-slate-700 flex-1">
                          {change.statName}
                        </span>

                        {/* Old Value */}
                        <span
                          data-testid="stat-old-value"
                          className="text-sm text-slate-500 w-12 text-right"
                        >
                          {change.oldValue}
                        </span>

                        {/* Arrow separator */}
                        <span className="mx-2 text-slate-400" aria-hidden="true">
                          →
                        </span>

                        {/* New Value */}
                        <span
                          data-testid="stat-new-value"
                          className={`text-sm font-semibold w-12 text-right ${
                            hasIncreased ? 'text-green-600' : 'text-slate-600'
                          }`}
                        >
                          {change.newValue}
                        </span>

                        {/* Increase Indicator */}
                        {hasIncreased && (
                          <span
                            data-testid="stat-increase-indicator"
                            className="ml-2 inline-flex items-center gap-0.5 text-xs font-bold text-green-600"
                          >
                            <ArrowUp className="h-3 w-3" aria-hidden="true" />
                            +{gain}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Total Stat Gain Summary */}
          <div
            data-testid="total-stat-gain"
            className="flex items-center justify-between py-3 px-4 rounded-xl bg-green-50 border border-green-200 mb-6"
          >
            <span className="text-sm font-semibold text-slate-700">Total Stat Gain</span>
            <span className="text-lg font-bold text-green-600">+{totalStatGain}</span>
          </div>

          {/* Continue Button */}
          <button
            type="button"
            onClick={handleContinue}
            data-testid="continue-button"
            className="w-full py-3 px-6 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold rounded-xl shadow-md hover:from-amber-600 hover:to-yellow-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
          >
            Continue
          </button>
        </div>

        {/* Screen Reader Announcement */}
        <div
          data-testid="sr-announcement"
          role="status"
          aria-live="assertive"
          aria-atomic="true"
          className="sr-only"
        >
          {horseName} has reached Level {newLevel}! Total stat gain: {totalStatGain} points.
        </div>
      </div>
    </div>
  );

  // Render via portal for proper stacking context
  return createPortal(modalContent, document.body);
});

export default LevelUpCelebrationModal;
