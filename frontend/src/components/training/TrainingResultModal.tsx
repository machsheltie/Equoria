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
 *
 * Story 4-1: Training Session Interface - Task 5
 * Migrated from hand-rolled `fixed inset-0` portal overlay → GameDialog
 * (Equoria-8l8zc, DECISIONS.md §8). Focus trap, scroll-lock, Escape close,
 * backdrop/outside-click dismissal, and focus restoration come from the native
 * Dialog primitive — no longer re-implemented here. The full-width "Close"
 * button is the single primary action and the first focusable element, so the
 * focus trap lands on it when the dialog opens (parity with the prior manual
 * closeButtonRef focus).
 */

import { Calendar, PartyPopper } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';
import { GameDialog, GameDialogContent, GameDialogTitle } from '@/components/ui/game/GameDialog';

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
   * Next training availability date (string or Date object).
   *
   * Equoria-gzvwa — accepts null/undefined to honestly represent an ABSENT
   * server value. Callers MUST NOT fabricate a client-side guess (e.g.
   * now + 7 days) when the server omits the next-eligible date; passing
   * null/undefined here routes to the "Date unavailable" empty state below.
   */
  nextTrainingDate: string | Date | null | undefined;

  /**
   * Equoria-npnw — temperament modifier attribution (null when horse has no
   * temperament). When present, renders an expansion section below the score
   * breakdown explaining the applied XP/score modifiers.
   */
  temperamentEffects?: {
    temperament: string;
    xpModifier: number;
    scoreModifier: number;
  } | null;
}

/**
 * Formats the next-training date for display.
 *
 * Equoria-gzvwa — absent server value (null/undefined/'') is an honest empty
 * state ('Date unavailable'), NOT a reason to fabricate a guessed date.
 * Equoria-2dnd2 — delegates to the shared util, preserving the long
 * "Weekday, Month D, YYYY" format and the same fallback behavior.
 */
function formatNextTrainingDate(date: string | Date | null | undefined): string {
  return formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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
  temperamentEffects,
}: TrainingResultModalProps) => {
  // Format values for display
  const formattedDate = formatNextTrainingDate(nextTrainingDate);
  const scoreBreakdown = formatScoreBreakdown(baseScoreGain, traitBonus);
  const hasAdditionalGains =
    (statGains && Object.keys(statGains).length > 0) || (xpGain !== undefined && xpGain > 0);

  return (
    <GameDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <GameDialogContent
        size="sm"
        data-testid="training-result-modal"
        aria-labelledby="training-result-title"
        noDescription
        hideCloseButton
      >
        {/* Header with celebration */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-2">
            <PartyPopper
              className="w-8 h-8 text-[var(--role-success-text)] mr-2"
              aria-hidden="true"
            />
            <GameDialogTitle
              id="training-result-title"
              className="text-2xl font-bold text-[var(--role-success-text)]"
            >
              Training Complete!
            </GameDialogTitle>
            <span className="ml-2 text-2xl" role="img" aria-label="celebration">
              🎉
            </span>
          </div>
        </div>

        {/* Discipline and Score Information */}
        <div className="text-center">
          <p
            className="text-lg font-semibold text-[var(--text-primary)]"
            data-testid="discipline-name"
          >
            {disciplineName}
          </p>

          <p
            className="text-4xl font-bold text-[var(--role-success-text)] mt-3"
            data-testid="score-gain"
          >
            +{scoreGain}
          </p>

          <p className="text-sm text-role-secondary mt-1" data-testid="score-breakdown">
            ({scoreBreakdown})
          </p>
        </div>

        {/* New Score Display */}
        <div className="mt-4 text-center">
          <p className="font-semibold text-[var(--text-primary)]" data-testid="new-score">
            New Score: <span className="text-[var(--role-info-text)]">{newScore}</span>
          </p>
        </div>

        {/* Additional Gains Section */}
        {hasAdditionalGains && (
          <div
            className="mt-4 border-t border-[var(--glass-border)] pt-4"
            data-testid="additional-gains-section"
          >
            <h3 className="font-semibold text-[var(--text-primary)] mb-2">Additional Gains:</h3>
            <ul className="space-y-1 text-sm" data-testid="gains-list">
              {statGains &&
                Object.entries(statGains).map(([stat, gain]) => (
                  <li key={stat} className="text-role-secondary" data-testid={`stat-gain-${stat}`}>
                    • {stat}:{' '}
                    <span className="text-[var(--role-success-text)] font-medium">+{gain}</span>
                  </li>
                ))}
              {xpGain !== undefined && xpGain > 0 && (
                <li className="text-[var(--role-warning-text)] font-semibold" data-testid="xp-gain">
                  • XP: +{xpGain}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Equoria-npnw — Temperament modifier attribution */}
        {temperamentEffects && (
          <div
            className="mt-4 border-t border-[var(--glass-border)] pt-4"
            data-testid="temperament-effects-section"
          >
            <h3 className="font-semibold text-[var(--text-primary)] mb-2">Temperament Modifier:</h3>
            <p className="text-sm text-role-secondary" data-testid="temperament-effects-text">
              <span
                className="text-burnished-gold font-medium"
                data-testid="temperament-effects-name"
              >
                {temperamentEffects.temperament}
              </span>{' '}
              applied{' '}
              <span data-testid="temperament-effects-xp">
                {temperamentEffects.xpModifier > 0 ? '+' : ''}
                {Math.round(temperamentEffects.xpModifier * 100)}% XP
              </span>
              ,{' '}
              <span data-testid="temperament-effects-score">
                {temperamentEffects.scoreModifier > 0 ? '+' : ''}
                {Math.round(temperamentEffects.scoreModifier * 100)}% score
              </span>
              .
            </p>
          </div>
        )}

        {/* Next Training Date */}
        <div
          className="mt-4 text-sm text-role-secondary flex items-center justify-center"
          data-testid="next-training-section"
        >
          <Calendar className="w-4 h-4 mr-1" aria-hidden="true" />
          <span data-testid="next-training-date">Next Training Available: {formattedDate}</span>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 bg-[var(--electric-blue-700)] text-[var(--text-primary)] py-3 px-4 rounded-lg hover:bg-[var(--gold-dim)] transition-colors font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--celestial-primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg-midnight)]"
          data-testid="close-button"
        >
          Close
        </button>
      </GameDialogContent>
    </GameDialog>
  );
};

export default TrainingResultModal;
