/**
 * TrainingTab — lazy sub-panel for HorseDetailPage (Equoria-r22q)
 *
 * Integrates the full training flow with:
 * - DisciplinePicker for discipline selection, then one "Train — <fee>" button
 * - TrainingResultModal for results display
 * - Training status and cooldown display
 *
 * Extracted from HorseDetailPage.tsx to enable React.lazy() code-splitting
 * so this ~330-line module only loads when the Training tab is first selected.
 *
 * Story 4-1: Training Session Interface - Task 6
 *
 * Owner ruling q163 (2026-10-28; Equoria-tjh8k, and "just a game: no
 * receipts" 2026-10-26): pick the discipline, then one "Train — 250" button,
 * the trainer's fee on the button. Old contract: picking a discipline opened a
 * Confirm Training dialog (TrainingConfirmModal, removed).
 */

import { actionMessageFor, trainRefused, trainRefusalCodes } from '@/lib/http/actionMessage';
import React, { useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, Loader2, Dumbbell, Clock, CheckCircle } from 'lucide-react';
import DisciplinePicker from '../../components/training/DisciplinePicker';
import TrainingResultModal from '../../components/training/TrainingResultModal';
import { ErrorState } from '@/components/ui/state';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import { userMessageFor } from '@/lib/http/userMessage';
import { useTrainHorse, useTrainingOverview } from '../../hooks/api/useTraining';
import {
  formatDisciplineName,
  canTrain,
  getDisciplineScore,
  formatCooldownDate,
} from '../../lib/utils/training-utils';
import { isBadHealth } from '../../lib/healthWords';
import { useHorseTrainer } from '../../hooks/api/useTrainers';
import HorseTrainerPanel from './HorseTrainerPanel';
import type { Horse } from './HorseDetailPageTypes';

const TrainingTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  // Training flow state
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [trainingResult, setTrainingResult] = useState<{
    scoreGain: number;
    baseScoreGain: number;
    newScore: number;
    xpGain?: number;
    // Equoria-gzvwa — the authoritative server next-eligible value (ISO string)
    // or null when the server omits it. We never fabricate a client-side guess;
    // null flows to the result modal's honest "Date unavailable" state.
    nextTrainingDate: string | null;
  } | null>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);

  // Training hooks. Equoria-llhf6: destructure the query's error/refetch too —
  // a swallowed overview error (only `data`/`isLoading` read) let a FAILED fetch
  // fall through to the actionable "Ready to train!" state, because undefined
  // overview → null cooldown → isOnCooldown=false. A failed read must never
  // render a positive, actionable state (FRONTEND_ASYNC_STATE_DOCTRINE §1/§4).
  const {
    data: trainingOverview,
    isLoading: isStatusLoading,
    isError: isOverviewError,
    error: overviewError,
    refetch: refetchOverview,
  } = useTrainingOverview(horse.id);
  const trainHorse = useTrainHorse();
  // Equoria-r8a6h: the assigned trainer's per-session fee is what the button charges.
  const {
    assignment: horseTrainer,
    fee: trainerFee,
    isLoading: isTrainerLoading,
    isError: isTrainerError,
  } = useHorseTrainer(horse.id);
  // Owner ruling 2026-10-26 (q81): a trainer is required to train. With none assigned
  // the tab offers "Assign Trainer" instead of the discipline picker. A failed trainer
  // read says nothing here: the server's refusal stays the authority on a train click.
  const needsTrainer = !isTrainerLoading && !isTrainerError && horseTrainer === null;

  // Check training eligibility
  const eligibility = canTrain({
    id: horse.id,
    name: horse.name,
    age: horse.age,
    // The server refuses a horse in Bad health (owner ruling 2026-10-23); never offer one.
    ineligibleReason: isBadHealth(horse.displayedHealth ?? horse.healthStatus)
      ? `${horse.name} is in Bad health and cannot train. Feed and vet to restore health.`
      : needsTrainer
        ? `${horse.name} needs a trainer before training.`
        : null,
    trainingCooldown: getGlobalCooldown(trainingOverview),
  });

  // Get global cooldown date (most recent cooldown across all disciplines)
  function getGlobalCooldown(
    overview: Array<{ discipline: string; nextEligibleDate?: string | null }> | undefined
  ): string | null {
    if (!overview || overview.length === 0) return null;

    const cooldowns = overview
      .filter((d) => d.nextEligibleDate)
      .map((d) => new Date(d.nextEligibleDate!))
      .filter((d) => d > new Date());

    if (cooldowns.length === 0) return null;

    // Return the earliest cooldown
    const earliest = cooldowns.sort((a, b) => a.getTime() - b.getTime())[0];
    return earliest.toISOString();
  }

  // Get list of disabled disciplines (on cooldown)
  function getDisabledDisciplines(): string[] {
    if (!trainingOverview) return [];
    if (!eligibility.eligible) {
      // If horse is not eligible at all, return empty (DisciplinePicker won't be active anyway)
      return [];
    }

    return trainingOverview
      .filter((d) => d.nextEligibleDate && new Date(d.nextEligibleDate) > new Date())
      .map((d) => d.discipline);
  }

  // Picking a discipline only selects it; the Train button below trains.
  const handleDisciplineSelect = (disciplineId: string) => {
    setSelectedDiscipline(disciplineId);
    setTrainingError(null);
  };

  // One click on Train, the fee on the button (owner ruling q163).
  const handleTrain = async () => {
    if (!selectedDiscipline) return;

    setTrainingError(null);

    try {
      const result = await trainHorse.mutateAsync({
        horseId: horse.id,
        discipline: selectedDiscipline,
      });

      // Equoria-o1x6g: read the REAL backend-computed values instead of
      // inferring them client-side. The route now emits the authoritative
      // disciplineScoreIncrease (the flat +5, owner ruling 2026-10-23) and
      // the real awarded XP (xpAwarded), so the modal shows what actually
      // happened rather than a recomputed estimate that drifts from the server.
      const baseGain = 5; // A session's flat gain — for the breakdown line.
      // Prefer the authoritative server value; fall back to the flat gain
      // only on the legacy path that omits it.
      const scoreGain = result.disciplineScoreIncrease ?? baseGain;
      const currentScore = getDisciplineScore(
        {
          id: horse.id,
          name: horse.name,
          age: horse.age,
          disciplineScores: horse.disciplineScores,
        },
        selectedDiscipline
      );

      // Set result for modal display
      setTrainingResult({
        scoreGain,
        baseScoreGain: baseGain,
        newScore: result.updatedScore ?? currentScore + scoreGain,
        // Equoria-o1x6g: the REAL awarded XP, not the trait-only delta
        // (traitEffects.xpModifier) it was previously wired to.
        xpGain: result.xpAwarded ?? undefined,
        // Equoria-gzvwa — pass the REAL server value through; when the server
        // omits nextEligible (null), pass null so the result modal renders its
        // honest "Date unavailable" state. NEVER fabricate a now+7-days guess —
        // a client-computed cooldown date masks a missing server value and lies
        // to the player about when training is actually available.
        nextTrainingDate: result.nextEligible ?? null,
      });

      // Open result modal
      setIsResultModalOpen(true);
    } catch (error) {
      // The discipline stays picked so she can press Train again.
      setTrainingError(actionMessageFor(error, trainRefused, trainRefusalCodes));
    }
  };

  // Handle closing the result modal
  const handleCloseResult = () => {
    setIsResultModalOpen(false);
    setTrainingResult(null);
    setSelectedDiscipline(null);
    // Horse data will auto-refresh via React Query cache invalidation
  };

  const cooldownDateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  };

  const globalCooldown = getGlobalCooldown(trainingOverview);
  const disabledDisciplines = getDisabledDisciplines();
  const isOnCooldown = globalCooldown !== null;

  // Determine if ineligibility is due to cooldown, or to a standing refusal (too
  // young, retired, Bad health): a refusal is never shown as "Ready to train".
  const isIneligibleDueToCooldown =
    !eligibility.eligible && eligibility.reason?.includes('cooldown');
  const isRefused = !eligibility.eligible && !isIneligibleDueToCooldown;

  return (
    <div className="space-y-6" data-testid="training-tab">
      <HorseTrainerPanel horseId={horse.id} />

      {/* Training Status Section */}
      <div className="bg-[rgba(15,35,70,0.4)] rounded-lg border border-[rgba(37,99,235,0.2)] p-6">
        <h3 className="type-section-heading mb-3 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-[rgb(160,175,200)]" />
          Training Status
        </h3>

        {isStatusLoading ? (
          <div
            className="flex items-center text-[rgb(160,175,200)]"
            data-testid="training-status-loading"
          >
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading training status...
          </div>
        ) : isRefused ? (
          <div
            className="flex items-center text-[var(--status-danger)]"
            data-testid="training-status-ineligible"
          >
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{eligibility.reason}</span>
          </div>
        ) : isOnCooldown || isIneligibleDueToCooldown ? (
          <div
            className="flex items-center text-[var(--gold-primary)]"
            data-testid="training-status-cooldown"
          >
            <Clock className="w-5 h-5 mr-2" />
            <span>
              Next training available in:{' '}
              {formatCooldownDate(
                globalCooldown || (eligibility.reason?.match(/until (.+)$/)?.[1] ?? null),
                cooldownDateOptions
              )}
            </span>
          </div>
        ) : isOverviewError ? (
          // Equoria-llhf6 — a FAILED overview fetch renders an honest error with
          // a retry (wired to the query's refetch), NEVER the actionable "Ready
          // to train!" state. Placed after the age/cooldown branches on purpose:
          // age-ineligibility is derived from horse.age (fetch-independent, so it
          // is honest even during an overview error), while cooldown/ready both
          // require a successful fetch — so gating the ready fallback behind the
          // error keeps "Ready to train!" reachable ONLY on a confirmed success.
          // Copy comes from the shared userMessageFor taxonomy (§3) — the raw
          // server error body is never surfaced.
          ((): React.ReactElement => {
            const { title, message, retryable } = userMessageFor(overviewError);
            return (
              <div data-testid="training-status-error">
                <ErrorState
                  title={title ?? 'Training status unavailable'}
                  message={message}
                  retry={
                    retryable
                      ? { label: 'Try Again', onClick: () => void refetchOverview() }
                      : undefined
                  }
                />
              </div>
            );
          })()
        ) : (
          <div
            className="flex items-center text-[var(--status-success)]"
            data-testid="training-status-ready"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            <span>Ready to train!</span>
          </div>
        )}
      </div>

      {/* Eligibility Warning - for a standing refusal (age, health), not a cooldown */}
      {isRefused && (
        <div
          className="glass-panel border border-[var(--role-danger-border)] rounded-lg p-4"
          data-testid="training-eligibility-warning"
        >
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-[var(--status-danger)] mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-[var(--status-danger)]">Training Not Available</h4>
              <p className="text-sm text-[var(--status-danger)] mt-1">{eligibility.reason}</p>
              {needsTrainer && (
                <Link
                  to={`/trainers?horseId=${horse.id}`}
                  className="inline-block mt-2 text-sm text-[var(--gold-400)] hover:underline"
                  data-testid="training-assign-trainer"
                >
                  Assign Trainer
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Discipline Picker Section — Equoria-llhf6: suppressed on a failed
          overview fetch. The picker is a positive-actionable surface whose
          disabled-discipline set is derived from the overview; with the fetch
          errored we can't know which disciplines are on cooldown, so presenting
          a fully-enabled picker would be the same false-actionable defect as the
          "Ready to train!" status (§1/§4). The error state's retry recovers it. */}
      {!isOverviewError &&
        !isTrainerLoading &&
        (eligibility.eligible || isIneligibleDueToCooldown) && (
          <div className="glass-panel rounded-lg p-6">
            <h3 className="type-section-heading mb-4 flex items-center">
              <Dumbbell className="w-5 h-5 mr-2 text-[rgb(160,175,200)]" />
              Select Discipline
            </h3>

            <DisciplinePicker
              selectedDiscipline={selectedDiscipline}
              onSelectDiscipline={handleDisciplineSelect}
              disciplineScores={horse.disciplineScores || {}}
              disabledDisciplines={disabledDisciplines}
              isLoading={isStatusLoading || trainHorse.isPending}
            />

            {selectedDiscipline && eligibility.eligible && (
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  data-testid="train-button"
                  pending={trainHorse.isPending}
                  onClick={() => void handleTrain()}
                >
                  {trainerFee > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      Train — <Currency amount={trainerFee} />
                    </span>
                  ) : (
                    'Train'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

      {/* Training Error Display */}
      {trainingError && (
        <div
          className="glass-panel border border-[var(--role-danger-border)] rounded-lg p-4"
          data-testid="training-error"
        >
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-[var(--status-danger)] mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-[var(--status-danger)]">Training Error</h4>
              <p className="text-sm text-[var(--status-danger)] mt-1">{trainingError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Training Result Modal */}
      {trainingResult && (
        <TrainingResultModal
          isOpen={isResultModalOpen}
          onClose={handleCloseResult}
          disciplineName={formatDisciplineName(selectedDiscipline || '')}
          scoreGain={trainingResult.scoreGain}
          baseScoreGain={trainingResult.baseScoreGain}
          newScore={trainingResult.newScore}
          xpGain={trainingResult.xpGain}
          nextTrainingDate={trainingResult.nextTrainingDate}
        />
      )}
    </div>
  );
};

export default TrainingTab;
