/**
 * DisciplineScoresSection — every discipline on its own line with the horse's
 * score and level (Equoria-a0fim; owner request 2026-10-28).
 *
 * The score and level come from the server, computed with the nightly show
 * scorer's own flat score: the discipline's three stats weighted 50/30/20,
 * plus the horse's training in that discipline, plus its saddle and bridle.
 * Health, temperament, rider and luck are show-day modifiers and are not in
 * it. The page shows the numbers only — no ranking, no advice (owner ruling
 * 2026-10-07). A quiet ledger reusing the Horse Details rows.
 */

import React from 'react';
import { InlineError, SectionLoading } from '@/components/ui/state';
import { useHorseDisciplineScores } from '@/hooks/api/useHorses';
import { userMessageFor } from '@/lib/http/userMessage';
import { competitionDisciplineLabel } from '@/lib/utils/training-utils';
import '@/styles/horseCare.css';
import '@/styles/horseProgression.css';

const DisciplineScoresSection: React.FC<{ horseId: number }> = ({ horseId }) => {
  const scores = useHorseDisciplineScores(horseId);

  return (
    <section aria-labelledby="discipline-scores-heading" data-testid="discipline-scores">
      <h3 id="discipline-scores-heading" className="type-section-heading mb-3">
        Discipline Scores
      </h3>
      {scores.isPending && <SectionLoading label="Loading discipline scores" minHeight="64px" />}
      {scores.isError && (
        <div className="flex items-center gap-3" data-testid="discipline-scores-error">
          <InlineError message={userMessageFor(scores.error).message} />
          <button
            type="button"
            className="fantasy-caption underline text-[var(--text-secondary)]"
            onClick={() => scores.refetch()}
          >
            Try Again
          </button>
        </div>
      )}
      {scores.isSuccess && (
        <dl className="horse-status__record">
          {scores.data.map(({ discipline, score, level }) => (
            <div key={discipline} className="horse-status__row">
              <dt>{competitionDisciplineLabel(discipline)}</dt>
              <dd
                className="discipline-scores__value"
                data-testid={`discipline-score-${discipline}`}
              >
                <span>{score}</span>
                <span className="discipline-scores__level">Level {level}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};

export default DisciplineScoresSection;
