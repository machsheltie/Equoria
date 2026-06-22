/**
 * TrainingSessionModal Component
 *
 * A modal dialog for managing horse training sessions. Allows users to:
 * - Select a training discipline from 23 available options
 * - View current training status and scores
 * - Check eligibility before training
 * - Execute training sessions
 * - View training results with trait modifiers
 *
 * Features:
 * - Discipline selection with trait modifier display
 * - Net effect calculation based on trait bonuses/penalties
 * - Eligibility checking with server-side validation
 * - Training execution with result display
 * - Error handling with user-friendly messages
 *
 * Story: Training Trait Modifiers - Task 4
 * Migrated from hand-rolled `fixed inset-0` portal overlay → GameDialog
 * (Equoria-8l8zc, DECISIONS.md §8). The modal is mount-controlled by its
 * consumer (rendered only while a horse is selected), so GameDialog is held
 * `open` for its lifetime and `onOpenChange` routes Escape / backdrop /
 * outside-click dismissal back to `onClose`. Focus trap, scroll-lock, and focus
 * restoration come from the native Dialog primitive — no longer re-implemented.
 */

import { useEffect, useMemo, useState } from 'react';
import { GameDialog, GameDialogContent, GameDialogTitle } from '@/components/ui/game/GameDialog';
import {
  useTrainingEligibility,
  useTrainingSession,
  useTrainingStatus,
} from '@/hooks/api/useTraining';
import type { TrainableHorse, TrainingResult } from '@/lib/api-client';
import { useHorse } from '@/hooks/api/useHorses';
import {
  recommendedDisciplineOrder,
  disciplineMatchScores,
  disciplineTraitIndicators,
} from './disciplineRecommendation';
import DisciplineSelector from './DisciplineSelector';
import HorseStatsCard from './HorseStatsCard';
import TrainingResultsDisplay from './TrainingResultsDisplay';
import TraitModifierList from './TraitModifierList';
import EligibilityAlternatives from './EligibilityAlternatives';
import type { TraitModifier } from './TraitModifierBadge';
import { getDisciplineTraitModifiers } from './disciplineTraitGrouping';

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

/**
 * Discipline trait modifiers now come from the shared
 * ./disciplineTraitGrouping module (Equoria-svilx) — single source of
 * truth shared with disciplineRecommendation so the Trait-Modifiers panel
 * and the per-discipline recommendation indicators cannot drift.
 */

/**
 * Calculates the net effect of trait modifiers on training gain.
 * Net Effect = Base Gain + Positive Bonuses - Negative Penalties
 */
const calculateNetEffect = (base: number, modifiers: TraitModifier[]): number => {
  const positiveSum = modifiers
    .filter((m) => m.category === 'positive')
    .reduce((sum, m) => sum + m.effect, 0);
  const negativeSum = Math.abs(
    modifiers.filter((m) => m.category === 'negative').reduce((sum, m) => sum + m.effect, 0)
  );
  return base + positiveSum - negativeSum;
};

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
  const [trainingResult, setTrainingResult] = useState<TrainingResult | null>(null);
  const [previousScore, setPreviousScore] = useState<number | undefined>(undefined);

  // Real horse stats + traits drive personalized discipline recommendations
  // (Equoria-pfp1w) — replaces DisciplineSelector's static DEFAULT_RECOMMENDED
  // fallback. useHorse fetches the full HorseSummary (stats + traits).
  const { data: horseDetail } = useHorse(horse.id);
  const personalizedRecommended = useMemo(
    () => recommendedDisciplineOrder(horseDetail),
    [horseDetail]
  );
  const personalizedMatchScores = useMemo(() => disciplineMatchScores(horseDetail), [horseDetail]);
  const personalizedTraitIndicators = useMemo(
    () => disciplineTraitIndicators(horseDetail),
    [horseDetail]
  );

  const { data: status } = useTrainingStatus(horse.id, discipline);
  const {
    data: eligibility,
    isFetching: checking,
    refetch: checkEligibility,
  } = useTrainingEligibility(horse.id, discipline);
  const { mutateAsync: runTraining, isPending: isTraining } = useTrainingSession();

  // Base training gain constant
  const BASE_GAIN = 5;

  // Calculate trait modifiers based on selected discipline
  const traitModifiers = useMemo(() => {
    return getDisciplineTraitModifiers(discipline);
  }, [discipline]);

  // Calculate net effect for expected score display
  const netEffect = useMemo(() => {
    return calculateNetEffect(BASE_GAIN, traitModifiers);
  }, [traitModifiers]);

  // Calculate expected new score
  const currentScore = status?.score ?? 0;
  const expectedNewScore = currentScore + netEffect;

  useEffect(() => {
    setErrorMessage(null);
  }, [discipline]);

  const statusSummary = useMemo(() => {
    if (!status) return 'Awaiting status...';
    const scoreText = status.score !== undefined ? `Score ${status.score}` : 'Score pending';
    const cooldownText = status.nextEligibleDate
      ? `Cooldown until ${formatDateTime(status.nextEligibleDate)}`
      : 'Ready';
    return `${scoreText} - ${cooldownText}`;
  }, [status]);

  const handleCheckEligibility = async () => {
    try {
      setErrorMessage(null);
      await checkEligibility();
    } catch (error) {
      setErrorMessage((error as { message?: string }).message ?? 'Unable to check eligibility');
    }
  };

  const handleTrain = async () => {
    try {
      setErrorMessage(null);
      // Save current score before training
      setPreviousScore(status?.score);
      // Run training
      const result = await runTraining({ horseId: horse.id, discipline });
      // Save result to display
      setTrainingResult(result);
      // Call parent callback if provided
      if (onCompleted) {
        onCompleted(result);
      }
    } catch (error) {
      setErrorMessage((error as { message?: string }).message ?? 'Training failed');
    }
  };

  const handleTrainAgain = () => {
    setTrainingResult(null);
    setPreviousScore(undefined);
    setErrorMessage(null);
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
        {/* Show training results if available */}
        {trainingResult ? (
          <div>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-role-secondary">
                  Training Complete
                </p>
                <GameDialogTitle className="text-xl font-bold text-[var(--text-primary)]">
                  {horse.name}
                </GameDialogTitle>
              </div>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-role-secondary hover:text-[var(--text-primary)] hover:bg-[var(--glass-glow)] transition-colors"
                onClick={onClose}
              >
                Close
              </button>
            </div>
            <TrainingResultsDisplay
              result={trainingResult}
              previousScore={previousScore}
              onClose={onClose}
              onTrainAgain={handleTrainAgain}
            />
          </div>
        ) : (
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
                recommendedDisciplines={
                  personalizedRecommended.length > 0 ? personalizedRecommended : undefined
                }
                matchScores={personalizedMatchScores}
                traitIndicators={personalizedTraitIndicators}
                description="Ranked for this horse's stats — best matches shown first (all 23 below)"
              />
            </div>

            <div className="mt-3 rounded-md border border-[var(--role-neutral-border)] bg-[var(--role-neutral-bg)] px-3 py-2 text-sm text-[var(--text-primary)]">
              {statusSummary}
            </div>

            {/* Trait Modifiers Section */}
            <div className="mt-4" data-testid="trait-modifiers-section">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Trait Modifiers
                </h3>
              </div>
              <TraitModifierList
                modifiers={traitModifiers}
                baseGain={BASE_GAIN}
                showNetEffect={true}
              />
            </div>

            {/* Expected Score Display */}
            <div
              className="mt-3 rounded-md border border-[var(--alpha-gold-light-20)] bg-[var(--alpha-gold-light-5)] px-3 py-2 text-sm text-[var(--gold-300)]"
              data-testid="expected-score-display"
            >
              <span className="font-semibold">Expected New Score:</span>{' '}
              <span data-testid="expected-score-value">{expectedNewScore}</span>
              <span className="text-[var(--gold-400)] ml-2">
                (Current: {currentScore} + Net Effect: {netEffect})
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
                {isTraining ? 'Training...' : 'Start Training'}
              </button>
            </div>
          </>
        )}
      </GameDialogContent>
    </GameDialog>
  );
};

export default TrainingSessionModal;
