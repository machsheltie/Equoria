/**
 * TrainingSessionModal Component
 *
 * A modal dialog for managing horse training sessions. Allows users to:
 * - Select a training discipline from 24 available options
 * - View current training status and scores
 * - Check eligibility before training
 * - Execute training sessions
 *
 * Features:
 * - Discipline selection
 * - The flat +5 a session adds (owner ruling 2026-10-23: no trait or trainer scaling)
 * - Eligibility checking with server-side validation
 * - Training execution; on success the popup closes and the Training Center
 *   row updates in place (owner ruling q173, 2026-10-28: no popups, no log).
 *   Old contract: a "Training Complete" results view (TrainingResultsDisplay,
 *   removed) stayed open until Close.
 * - Error handling with user-friendly messages
 * - The assigned trainer's fee on the train button (Equoria-yucph; owner rulings
 *   2026-10-22 and 2026-10-26: one click, one advertised charge, no receipt)
 *
 * Story: Training Trait Modifiers - Task 4
 * Migrated from hand-rolled `fixed inset-0` portal overlay → GameDialog
 * (Equoria-8l8zc, DECISIONS.md §8). The modal is mount-controlled by its
 * consumer (rendered only while a horse is selected), so GameDialog is held
 * `open` for its lifetime and `onOpenChange` routes Escape / backdrop /
 * outside-click dismissal back to `onClose`. Focus trap, scroll-lock, and focus
 * restoration come from the native Dialog primitive — no longer re-implemented.
 */

import { userMessageFor } from '@/lib/http/userMessage';
import { actionMessageFor, trainRefused } from '@/lib/http/actionMessage';
import { useEffect, useMemo, useState } from 'react';
import { GameDialog, GameDialogContent, GameDialogTitle } from '@/components/ui/game/GameDialog';
import {
  useTrainingEligibility,
  useTrainingSession,
  useTrainingStatus,
} from '@/hooks/api/useTraining';
import { useHorseTrainer } from '@/hooks/api/useTrainers';
import Currency from '@/components/ui/Currency';
import type { TrainableHorse, TrainingResult } from '@/lib/api-client';
import DisciplineSelector from './DisciplineSelector';
import HorseStatsCard from './HorseStatsCard';
import EligibilityAlternatives from './EligibilityAlternatives';

interface TrainingSessionModalProps {
  horse: TrainableHorse;
  onClose: () => void;
  onCompleted?: (_result: TrainingResult) => void;
  /**
   * Equoria-9zluc: the user's real trainable-horses list, used to suggest
   * currently-eligible alternatives when this horse is ineligible
   * ("No dead ends" UX-spec rule). Optional — when omitted, the
   * alternatives block is skipped (the modal still shows the reason).
   */
  trainableHorses?: TrainableHorse[];
  /** Loading state of the trainable-horses query. */
  trainableHorsesLoading?: boolean;
  /**
   * Called when the user picks an eligible alternative horse; the caller
   * re-targets the flow to that horse.
   */
  onSwitchHorse?: (_horse: TrainableHorse) => void;
}

// Equoria-2dnd2: the krjw5 invalid-date guard + date+time formatting now come
// from the shared util. The prior bare toLocaleString() (locale-default
// "12/10/2025, 12:00:00 AM") is normalized to the canonical app format
// ("Dec 10, 2025, 12:00 AM"); the 'Date unavailable' fallback is preserved.
import { formatDateTime } from '@/lib/formatDate';

const TrainingSessionModal = ({
  horse,
  onClose,
  onCompleted,
  trainableHorses,
  trainableHorsesLoading,
  onSwitchHorse,
}: TrainingSessionModalProps) => {
  const [discipline, setDiscipline] = useState<string>('Barrel Racing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Owner ruling 2026-10-07: no discipline ranking or recommendation — the
  // player chooses.
  const { data: status } = useTrainingStatus(horse.id, discipline);
  const {
    data: eligibility,
    isFetching: checking,
    refetch: checkEligibility,
  } = useTrainingEligibility(horse.id, discipline);
  const { mutateAsync: runTraining, isPending: isTraining } = useTrainingSession();
  // Equoria-yucph: the assigned trainer's per-session fee is the one charge this
  // click makes, so it goes on the button. No trainer read yet (or none assigned)
  // shows no price; the server stays the authority on what is charged.
  const { fee: trainerFee } = useHorseTrainer(horse.id);

  // Owner ruling 2026-10-23: a weekly session adds a flat +5 to the trained
  // discipline, whatever the horse's traits or trainer.
  const TRAINING_GAIN = 5;

  // Calculate expected new score
  const currentScore = status?.score ?? 0;
  const expectedNewScore = currentScore + TRAINING_GAIN;

  useEffect(() => {
    setErrorMessage(null);
  }, [discipline]);

  const statusSummary = useMemo(() => {
    if (!status) return 'Awaiting status...';
    const scoreText = status.score !== undefined ? `Score ${status.score}` : 'Score pending';
    // The server's verdict, not just the cooldown (Equoria-6m8zv): a refused
    // horse shows why instead of "Ready".
    const cooldownText = status.nextEligibleDate
      ? `Cooldown until ${formatDateTime(status.nextEligibleDate)}`
      : status.eligible === false
        ? status.reason || 'Cannot train right now'
        : 'Ready';
    return `${scoreText} - ${cooldownText}`;
  }, [status]);

  const handleCheckEligibility = async () => {
    try {
      setErrorMessage(null);
      await checkEligibility();
    } catch (error) {
      setErrorMessage(userMessageFor(error).message);
    }
  };

  const handleTrain = async () => {
    try {
      setErrorMessage(null);
      const result = await runTraining({ horseId: horse.id, discipline });
      onCompleted?.(result);
      // The popup closes; the row on the page shows the new state (q173).
      onClose();
    } catch (error) {
      setErrorMessage(actionMessageFor(error, trainRefused));
    }
  };

  return (
    <GameDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <GameDialogContent
        // Preserve the modal's bespoke deep-space surface + max-w-xl width and
        // make the long body scroll inside the panel (parity with the prior
        // max-h-[90vh] overflow-y-auto wrapper). max-w-xl overrides the default
        // max-w-lg from GameDialogContent.
        className="max-w-xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-deep-space)', border: '1px solid rgba(200,168,78,0.25)' }}
        noDescription
        hideCloseButton
      >
        <>
          {/* Training Form */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-role-secondary">
                Training Session
              </p>
              <GameDialogTitle className="text-xl font-bold text-[var(--text-primary)]">
                {horse.name}
              </GameDialogTitle>
              <p className="text-sm text-role-secondary">
                Choose a discipline to train. Eligibility and cooldown are enforced server-side.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-role-secondary hover:text-[var(--text-primary)] hover:bg-[var(--glass-glow)] transition-colors"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          {/* Horse Stats Display */}
          <div className="mt-4">
            <HorseStatsCard horse={horse} />
          </div>

          {/* Use new DisciplineSelector component */}
          <div className="mt-4">
            <DisciplineSelector
              selectedDiscipline={discipline}
              onDisciplineChange={setDiscipline}
            />
          </div>

          <div className="mt-3 rounded-md border border-[var(--role-neutral-border)] bg-[var(--role-neutral-bg)] px-3 py-2 text-sm text-[var(--text-primary)]">
            {statusSummary}
          </div>

          {/* Expected Score Display */}
          <div
            className="mt-3 rounded-md border border-[var(--alpha-gold-light-20)] bg-[var(--alpha-gold-light-5)] px-3 py-2 text-sm text-[var(--gold-300)]"
            data-testid="expected-score-display"
          >
            <span className="font-semibold">Expected New Score:</span>{' '}
            <span data-testid="expected-score-value">{expectedNewScore}</span>
            <span className="text-[var(--gold-400)] ml-2">
              (Current: {currentScore} + {TRAINING_GAIN})
            </span>
          </div>

          {eligibility && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-sm ${
                eligibility.eligible
                  ? 'border border-[var(--role-success-border)] bg-[var(--role-success-bg)] text-[var(--role-success-text)]'
                  : 'border border-[var(--role-warning-border)] bg-[var(--role-warning-bg)] text-[var(--role-warning-text)]'
              }`}
            >
              {eligibility.eligible
                ? 'Eligible to train'
                : eligibility.reason || 'Not eligible to train'}
            </div>
          )}

          {/* Equoria-9zluc — "No dead ends": when this horse is ineligible,
                suggest the user's real currently-eligible horses instead of
                stopping at the reason. */}
          {eligibility && !eligibility.eligible && onSwitchHorse && (
            <EligibilityAlternatives
              blockedHorseId={horse.horseId ?? horse.id}
              trainableHorses={trainableHorses}
              isLoading={trainableHorsesLoading}
              onSelectAlternative={onSwitchHorse}
            />
          )}

          {errorMessage && (
            <div className="mt-3 rounded-md border border-[var(--role-danger-border)] bg-[var(--role-danger-bg)] px-3 py-2 text-sm text-[var(--role-danger-text)]">
              {errorMessage}
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCheckEligibility}
              disabled={checking || isTraining}
              className="rounded-lg border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-role-secondary hover:text-[var(--text-primary)] hover:border-[var(--btn-secondary-border-hover)] hover:bg-[var(--btn-secondary-bg-hover)] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checking ? 'Checking...' : 'Check Eligibility'}
            </button>
            <button
              type="button"
              onClick={handleTrain}
              disabled={isTraining}
              className="rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:brightness-110 hover:shadow-[0_0_16px_rgba(200,168,78,0.3)] disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-light) 100%)',
                color: 'var(--bg-deep-space)',
              }}
            >
              {isTraining ? (
                'Training...'
              ) : trainerFee > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  Train Horse <Currency amount={trainerFee} />
                </span>
              ) : (
                'Start Training'
              )}
            </button>
          </div>
        </>
      </GameDialogContent>
    </GameDialog>
  );
};

export default TrainingSessionModal;
