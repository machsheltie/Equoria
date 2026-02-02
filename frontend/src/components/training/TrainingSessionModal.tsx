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
 */

import { useEffect, useMemo, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  useTrainingEligibility,
  useTrainingSession,
  useTrainingStatus,
} from '@/hooks/api/useTraining';
import type { TrainableHorse, TrainingResult } from '@/lib/api-client';
import DisciplineSelector from './DisciplineSelector';
import HorseStatsCard from './HorseStatsCard';
import TrainingResultsDisplay from './TrainingResultsDisplay';
import TraitModifierList from './TraitModifierList';
import type { TraitModifier } from './TraitModifierBadge';

interface TrainingSessionModalProps {
  horse: TrainableHorse;
  onClose: () => void;
  onCompleted?: (result: TrainingResult) => void;
}

/**
 * Returns mock trait modifiers based on the selected discipline.
 * Different disciplines have different trait combinations:
 * - Physical disciplines: Athletic + Stubborn
 * - Mental disciplines: Intelligent + Calm
 * - Other disciplines: Quick Learner
 */
const getMockTraitModifiers = (discipline: string): TraitModifier[] => {
  // Normalize discipline for comparison (lowercase, no spaces/hyphens)
  const normalizedDiscipline = discipline.toLowerCase().replace(/[\s-]/g, '');

  // Physical disciplines (racing, show-jumping, barrel-racing)
  const physicalDisciplines = ['racing', 'showjumping', 'barrelracing', 'steeplechase', 'polo'];
  if (physicalDisciplines.some((d) => normalizedDiscipline.includes(d))) {
    return [
      {
        traitId: 'athletic',
        traitName: 'Athletic',
        effect: 3,
        description: 'Enhances performance in physical disciplines',
        affectedDisciplines: ['racing', 'show-jumping', 'barrel-racing'],
        category: 'positive',
      },
      {
        traitId: 'stubborn',
        traitName: 'Stubborn',
        effect: -2,
        description: 'Reduces training effectiveness',
        affectedDisciplines: ['all'],
        category: 'negative',
      },
    ];
  }

  // Mental disciplines (dressage, western-pleasure)
  const mentalDisciplines = ['dressage', 'westernpleasure', 'saddleseat', 'fineharness', 'gaited'];
  if (mentalDisciplines.some((d) => normalizedDiscipline.includes(d))) {
    return [
      {
        traitId: 'intelligent',
        traitName: 'Intelligent',
        effect: 4,
        description: 'Learns techniques quickly',
        affectedDisciplines: ['dressage', 'western-pleasure'],
        category: 'positive',
      },
      {
        traitId: 'calm',
        traitName: 'Calm',
        effect: 0,
        description: 'Maintains composure under pressure',
        affectedDisciplines: ['all'],
        category: 'neutral',
      },
    ];
  }

  // Default: Quick Learner for all others
  return [
    {
      traitId: 'quick-learner',
      traitName: 'Quick Learner',
      effect: 2,
      description: 'Picks up new skills faster',
      affectedDisciplines: ['all'],
      category: 'positive',
    },
  ];
};

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

const TrainingSessionModal = ({ horse, onClose, onCompleted }: TrainingSessionModalProps) => {
  const [discipline, setDiscipline] = useState<string>('Barrel Racing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trainingResult, setTrainingResult] = useState<TrainingResult | null>(null);
  const [previousScore, setPreviousScore] = useState<number | undefined>(undefined);

  const { data: status } = useTrainingStatus(horse.id, discipline);
  const {
    mutateAsync: checkEligibility,
    data: eligibility,
    isPending: checking,
  } = useTrainingEligibility();
  const { mutateAsync: runTraining, isPending: isTraining } = useTrainingSession();

  // Base training gain constant
  const BASE_GAIN = 5;

  // Calculate trait modifiers based on selected discipline
  const traitModifiers = useMemo(() => {
    return getMockTraitModifiers(discipline);
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
      ? `Cooldown until ${new Date(status.nextEligibleDate).toLocaleString()}`
      : 'Ready';
    return `${scoreText} - ${cooldownText}`;
  }, [status]);

  const handleCheckEligibility = async () => {
    try {
      setErrorMessage(null);
      await checkEligibility({ horseId: horse.id, discipline });
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

  /**
   * Handler for "Learn More" button click.
   * Opens trait documentation or information modal (future implementation).
   */
  const handleLearnMore = () => {
    console.log('Learn more about traits clicked');
    // Future: Open trait documentation or modal
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
        {/* Show training results if available */}
        {trainingResult ? (
          <div>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Training Complete</p>
                <h3 className="text-xl font-bold text-slate-900">{horse.name}</h3>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
                <p className="text-xs uppercase tracking-wide text-slate-500">Training Session</p>
                <h3 className="text-xl font-bold text-slate-900">{horse.name}</h3>
                <p className="text-sm text-slate-600">
                  Choose a discipline to train. Eligibility and cooldown are enforced server-side.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
                description="Select from all 23 available training disciplines"
              />
            </div>

            <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {statusSummary}
            </div>

            {/* Trait Modifiers Section */}
            <div className="mt-4" data-testid="trait-modifiers-section">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Trait Modifiers</h3>
                <button
                  onClick={handleLearnMore}
                  className="text-blue-600 hover:text-blue-800"
                  aria-label="Learn more about traits"
                  type="button"
                >
                  <HelpCircle className="w-4 h-4" data-testid="help-circle-icon" />
                </button>
              </div>
              <TraitModifierList
                modifiers={traitModifiers}
                baseGain={BASE_GAIN}
                showNetEffect={true}
                onLearnMore={handleLearnMore}
              />
            </div>

            {/* Expected Score Display */}
            <div
              className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800"
              data-testid="expected-score-display"
            >
              <span className="font-semibold">Expected New Score:</span>{' '}
              <span data-testid="expected-score-value">{expectedNewScore}</span>
              <span className="text-blue-600 ml-2">
                (Current: {currentScore} + Net Effect: {netEffect})
              </span>
            </div>

            {eligibility && (
              <div
                className={`mt-3 rounded-md px-3 py-2 text-sm ${
                  eligibility.eligible
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                {eligibility.eligible
                  ? 'Eligible to train'
                  : eligibility.reason || 'Not eligible to train'}
              </div>
            )}

            {errorMessage && (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {errorMessage}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCheckEligibility}
                disabled={checking || isTraining}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checking ? 'Checking...' : 'Check Eligibility'}
              </button>
              <button
                type="button"
                onClick={handleTrain}
                disabled={isTraining}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isTraining ? 'Training...' : 'Start Training'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TrainingSessionModal;
