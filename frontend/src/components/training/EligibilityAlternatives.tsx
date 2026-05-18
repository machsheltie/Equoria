/**
 * EligibilityAlternatives (Equoria-9zluc)
 *
 * Reusable "Eligibility Gate" pattern component (UX-spec Flow Optimization
 * Principle #2 — "No dead ends": every "you can't do this" must include
 * "but you CAN do this instead").
 *
 * When a horse is ineligible to train, this surfaces concrete, real-data
 * alternatives: the user's OTHER horses that are currently eligible to train
 * right now. Selecting one routes the flow to that horse instead of leaving
 * the user at a dead end.
 *
 * Data source: the real /api/v1/training/trainable/:userId list (TrainableHorse
 * with canTrain). No fabricated suggestions — if no horse is eligible, an
 * honest "none right now" message is shown with the soonest next-eligible time.
 */

import { CheckCircle, ArrowRight } from 'lucide-react';
import type { TrainableHorse } from '@/lib/api-client';

export interface EligibilityAlternativesProps {
  /** Id of the horse that is currently blocked (excluded from suggestions). */
  blockedHorseId: number;
  /** The user's trainable-horses list from useTrainableHorses (real data). */
  trainableHorses: TrainableHorse[] | undefined;
  /** Loading state of the trainable-horses query. */
  isLoading?: boolean;
  /**
   * Called with an eligible alternative horse when the user picks one.
   * The caller re-targets the flow (e.g. swaps the modal's horse).
   */
  onSelectAlternative: (_horse: TrainableHorse) => void;
  /** Max number of alternatives to show. @default 3 */
  limit?: number;
  className?: string;
}

function horseDisplayName(h: TrainableHorse): string {
  return h.name ?? `Horse #${h.horseId ?? h.id}`;
}

function soonestNextEligible(horses: TrainableHorse[]): string | null {
  const times = horses
    .map((h) => h.nextEligibleAt)
    .filter((t): t is string => Boolean(t))
    .map((t) => new Date(t).getTime())
    .filter((ms) => !Number.isNaN(ms) && ms > Date.now())
    .sort((a, b) => a - b);
  if (times.length === 0) return null;
  return new Date(times[0]).toLocaleString();
}

/**
 * Surface real, currently-eligible alternative horses when the selected
 * horse can't be trained. Reusable across any "Eligibility Gate" flow.
 */
const EligibilityAlternatives = ({
  blockedHorseId,
  trainableHorses,
  isLoading = false,
  onSelectAlternative,
  limit = 3,
  className = '',
}: EligibilityAlternativesProps): JSX.Element => {
  const list = trainableHorses ?? [];

  // Real eligibility comes from the backend's canTrain flag on each horse.
  const eligible = list.filter(
    (h) => h.canTrain === true && (h.horseId ?? h.id) !== blockedHorseId
  );
  const suggestions = eligible.slice(0, limit);

  if (isLoading) {
    return (
      <div
        data-testid="eligibility-alternatives-loading"
        className={`mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 ${className}`}
      >
        Finding horses you can train instead…
      </div>
    );
  }

  if (suggestions.length === 0) {
    const soonest = soonestNextEligible(list);
    return (
      <div
        data-testid="eligibility-alternatives-empty"
        className={`mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 ${className}`}
      >
        None of your other horses are eligible to train right now.
        {soonest && (
          <>
            {' '}
            The next one becomes available around{' '}
            <span className="font-semibold text-white/90">{soonest}</span>.
          </>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="eligibility-alternatives"
      className={`mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 ${className}`}
    >
      <p className="text-sm font-semibold text-emerald-300">
        You can&apos;t train this horse — but {suggestions.length} of your horses{' '}
        {suggestions.length === 1 ? 'is' : 'are'} ready now:
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {suggestions.map((h) => (
          <li key={h.horseId ?? h.id}>
            <button
              type="button"
              data-testid="eligibility-alternative-option"
              onClick={() => onSelectAlternative(h)}
              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-sm text-emerald-100 transition-colors hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                {horseDisplayName(h)}
              </span>
              <ArrowRight className="h-4 w-4 opacity-70" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default EligibilityAlternatives;
