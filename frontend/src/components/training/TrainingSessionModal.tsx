import { useEffect, useMemo, useState } from 'react';
import {
  useTrainingEligibility,
  useTrainingSession,
  useTrainingStatus,
} from '@/hooks/api/useTraining';
import type { TrainableHorse, TrainingResult } from '@/lib/api-client';
import DisciplineSelector from './DisciplineSelector';
import HorseStatsCard from './HorseStatsCard';
import TrainingResultsDisplay from './TrainingResultsDisplay';

interface TrainingSessionModalProps {
  horse: TrainableHorse;
  onClose: () => void;
  onCompleted?: (result: TrainingResult) => void;
}

const TrainingSessionModal = ({ horse, onClose, onCompleted }: TrainingSessionModalProps) => {
  const [discipline, setDiscipline] = useState<string>('Barrel Racing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trainingResult, setTrainingResult] = useState<TrainingResult | null>(null);
  const [previousScore, setPreviousScore] = useState<number | undefined>(undefined);

  const { data: status } = useTrainingStatus(horse.id, discipline);
  const { mutateAsync: checkEligibility, data: eligibility, isPending: checking } =
    useTrainingEligibility();
  const { mutateAsync: runTraining, isPending: isTraining } = useTrainingSession();

  useEffect(() => {
    setErrorMessage(null);
  }, [discipline]);

  const statusSummary = useMemo(() => {
    if (!status) return 'Awaiting status…';
    const scoreText = status.score !== undefined ? `Score ${status.score}` : 'Score pending';
    const cooldownText = status.nextEligibleDate
      ? `Cooldown until ${new Date(status.nextEligibleDate).toLocaleString()}`
      : 'Ready';
    return `${scoreText} • ${cooldownText}`;
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
                {checking ? 'Checking…' : 'Check Eligibility'}
              </button>
              <button
                type="button"
                onClick={handleTrain}
                disabled={isTraining}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isTraining ? 'Training…' : 'Start Training'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TrainingSessionModal;
