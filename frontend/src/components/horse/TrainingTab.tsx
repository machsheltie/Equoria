import React, { useState } from 'react';
import { Clock, Dumbbell, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useTrainingOverview, useTrainHorse } from '../../hooks/api/useTraining';
import { canTrain, formatDisciplineName, getDisciplineScore } from '../../lib/utils/training-utils';
import DisciplinePicker from '../training/DisciplinePicker';
import TrainingConfirmModal, { TraitModifier } from '../training/TrainingConfirmModal';
import TrainingResultModal from '../training/TrainingResultModal';

// Temporary Horse Interface
interface Horse {
  id: number;
  name: string;
  breed: string;
  breedId?: number;
  age: number;
  gender: string;
  dateOfBirth: string;
  healthStatus: string;
  imageUrl?: string;
  disciplineScores: Record<string, number>;
  traits?: string[];
  description?: string;
  parentIds?: {
    sireId?: number;
    damId?: number;
  };
}

const TrainingTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  // Training flow state
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [trainingResult, setTrainingResult] = useState<{
    scoreGain: number;
    baseScoreGain: number;
    traitBonus: number;
    newScore: number;
    statGains?: { [stat: string]: number };
    xpGain?: number;
    nextTrainingDate: Date;
  } | null>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);

  // Training hooks
  const { data: trainingOverview, isLoading: isStatusLoading } = useTrainingOverview(horse.id);
  const trainHorse = useTrainHorse();

  // Check training eligibility
  const eligibility = canTrain({
    id: horse.id,
    name: horse.name,
    age: horse.age,
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

  // Calculate trait modifiers for the selected discipline (mock for frontend-first)
  function getTraitModifiers(_disciplineId: string): TraitModifier[] {
    // In Phase 1 (frontend-first), return mock trait modifiers
    // In Phase 2, this will be fetched from the backend
    if (!horse.traits || horse.traits.length === 0) return [];

    // Simulate trait modifiers based on horse traits
    const modifiers: TraitModifier[] = [];

    if (horse.traits.includes('Fast Learner')) {
      modifiers.push({ name: 'Fast Learner', modifier: 1 });
    }
    if (horse.traits.includes('Strong Build')) {
      modifiers.push({ name: 'Strong Build', modifier: 1 });
    }
    if (horse.traits.includes('Nervous')) {
      modifiers.push({ name: 'Nervous', modifier: -1 });
    }

    return modifiers;
  }

  // Handle discipline selection
  const handleDisciplineSelect = (disciplineId: string) => {
    setSelectedDiscipline(disciplineId);
    setTrainingError(null);
    setIsConfirmModalOpen(true);
  };

  // Handle training confirmation
  const handleConfirm = async () => {
    if (!selectedDiscipline) return;

    setTrainingError(null);

    try {
      const result = await trainHorse.mutateAsync({
        horseId: horse.id,
        discipline: selectedDiscipline,
      });

      // Close confirm modal
      setIsConfirmModalOpen(false);

      // Calculate training result for display
      const traitModifiers = getTraitModifiers(selectedDiscipline);
      const traitBonus = traitModifiers.reduce((sum, t) => sum + t.modifier, 0);
      const baseGain = 5; // Base score gain
      const scoreGain = Math.max(0, baseGain + traitBonus);
      const currentScore = getDisciplineScore(
        {
          id: horse.id,
          name: horse.name,
          age: horse.age,
          disciplineScores: horse.disciplineScores,
        },
        selectedDiscipline
      );

      // Map stat gain from result
      const statGains: { [stat: string]: number } = {};
      if (result.statGain) {
        statGains[result.statGain.stat] = result.statGain.amount;
      }

      // Set result for modal display
      setTrainingResult({
        scoreGain,
        baseScoreGain: baseGain,
        traitBonus,
        newScore: result.updatedScore ?? currentScore + scoreGain,
        statGains: Object.keys(statGains).length > 0 ? statGains : undefined,
        xpGain: result.traitEffects?.xpModifier,
        nextTrainingDate: result.nextEligible
          ? new Date(result.nextEligible)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Open result modal
      setIsResultModalOpen(true);
    } catch (error) {
      // Keep modal open on error so user can retry
      const errorMessage =
        error instanceof Error ? error.message : 'Training failed. Please try again.';
      setTrainingError(errorMessage);
    }
  };

  // Handle closing the result modal
  const handleCloseResult = () => {
    setIsResultModalOpen(false);
    setTrainingResult(null);
    setSelectedDiscipline(null);
    // Horse data will auto-refresh via React Query cache invalidation
  };

  // Handle closing confirm modal (cancel)
  const handleCloseConfirm = () => {
    setIsConfirmModalOpen(false);
    setSelectedDiscipline(null);
    setTrainingError(null);
  };

  // Format cooldown date for display
  function formatCooldownDisplay(dateStr: string | null): string {
    if (!dateStr) return 'Available now';

    const date = new Date(dateStr);
    const now = new Date();

    if (date <= now) return 'Available now';

    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return '1 day';
    if (diffDays < 7) return `${diffDays} days`;

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  const globalCooldown = getGlobalCooldown(trainingOverview);
  const disabledDisciplines = getDisabledDisciplines();
  const isOnCooldown = globalCooldown !== null;

  // Determine if ineligibility is due to cooldown vs age
  const isIneligibleDueToCooldown =
    !eligibility.eligible && eligibility.reason?.includes('cooldown');
  const isIneligibleDueToAge = !eligibility.eligible && eligibility.reason?.includes('3 years old');

  return (
    <div className="space-y-6 animate-fade-in-up" data-testid="training-tab">
      {/* Training Status Section */}
      <div className="glass-panel rounded-xl border border-white/10 p-6">
        <h3 className="font-heading text-xl text-white mb-3 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-celestial-gold" />
          Training Status
        </h3>

        {isStatusLoading ? (
          <div
            className="flex items-center text-starlight-white/60"
            data-testid="training-status-loading"
          >
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading training status...
          </div>
        ) : isIneligibleDueToAge ? (
          <div className="flex items-center text-red-400" data-testid="training-status-ineligible">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{eligibility.reason}</span>
          </div>
        ) : isOnCooldown || isIneligibleDueToCooldown ? (
          <div className="flex items-center text-amber-500" data-testid="training-status-cooldown">
            <Clock className="w-5 h-5 mr-2" />
            <span>
              Next training available in:{' '}
              {formatCooldownDisplay(
                globalCooldown || (eligibility.reason?.match(/until (.+)$/)?.[1] ?? null)
              )}
            </span>
          </div>
        ) : (
          <div className="flex items-center text-green-400" data-testid="training-status-ready">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span>Ready to train!</span>
          </div>
        )}
      </div>

      {/* Age/Eligibility Warning - only show for age-based ineligibility */}
      {isIneligibleDueToAge && (
        <div
          className="bg-red-900/20 border border-red-500/30 rounded-lg p-4"
          data-testid="training-eligibility-warning"
        >
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-200">Training Not Available</h4>
              <p className="text-sm text-red-300 mt-1">{eligibility.reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Discipline Picker Section */}
      {(eligibility.eligible || isIneligibleDueToCooldown) && (
        <div className="glass-panel rounded-xl border border-white/10 p-6">
          <h3 className="font-heading text-xl text-white mb-4 flex items-center">
            <Dumbbell className="w-5 h-5 mr-2 text-celestial-gold" />
            Select Discipline
          </h3>

          <DisciplinePicker
            selectedDiscipline={selectedDiscipline}
            onSelectDiscipline={handleDisciplineSelect}
            disciplineScores={horse.disciplineScores || {}}
            disabledDisciplines={disabledDisciplines}
            isLoading={isStatusLoading || trainHorse.isPending}
          />
        </div>
      )}

      {/* Training Error Display */}
      {trainingError && (
        <div
          className="bg-red-900/20 border border-red-500/30 rounded-lg p-4"
          data-testid="training-error"
        >
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-200">Training Error</h4>
              <p className="text-sm text-red-300 mt-1">{trainingError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Training Confirm Modal */}
      {selectedDiscipline && (
        <TrainingConfirmModal
          isOpen={isConfirmModalOpen}
          onClose={handleCloseConfirm}
          onConfirm={handleConfirm}
          horseName={horse.name}
          disciplineName={formatDisciplineName(selectedDiscipline)}
          baseScoreGain={5}
          currentScore={getDisciplineScore(
            {
              id: horse.id,
              name: horse.name,
              age: horse.age,
              disciplineScores: horse.disciplineScores,
            },
            selectedDiscipline
          )}
          traitModifiers={getTraitModifiers(selectedDiscipline)}
          cooldownDays={7}
          isLoading={trainHorse.isPending}
        />
      )}

      {/* Training Result Modal */}
      {trainingResult && (
        <TrainingResultModal
          isOpen={isResultModalOpen}
          onClose={handleCloseResult}
          disciplineName={formatDisciplineName(selectedDiscipline || '')}
          scoreGain={trainingResult.scoreGain}
          baseScoreGain={trainingResult.baseScoreGain}
          traitBonus={trainingResult.traitBonus}
          newScore={trainingResult.newScore}
          statGains={trainingResult.statGains}
          xpGain={trainingResult.xpGain}
          nextTrainingDate={trainingResult.nextTrainingDate}
        />
      )}
    </div>
  );
};

export default TrainingTab;
