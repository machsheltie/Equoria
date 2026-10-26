/**
 * DisciplineScoreColumns
 *
 * A horse's discipline scores as one column per discipline family (Western,
 * English, Specialized, Racing). Each scored discipline is listed with its name
 * and its score number; disciplines still at zero share one quiet line at the
 * foot of their column.
 *
 * Owner ruling 2026-10-26 (q97, q79): replaces the Recharts spider-web chart.
 * No bars, no horseshoes, no laurels (large scores would sprawl), and no axis:
 * scores are uncapped (ruling 2026-10-07), so nothing here assumes a maximum.
 * Equoria-9jjoc, Equoria-q2ols, Equoria-ycivq.
 */

import React from 'react';
import { DISCIPLINES } from '../../lib/utils/training-utils';

interface DisciplineScoreColumnsProps {
  /** Discipline id -> score (uncapped). A missing discipline reads as zero. */
  disciplineScores: { [disciplineId: string]: number };
  className?: string;
}

const FAMILIES = ['Western', 'English', 'Specialized', 'Racing'] as const;

function scoreOf(scores: { [id: string]: number }, id: string): number {
  const value = scores?.[id];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

const DisciplineScoreColumns: React.FC<DisciplineScoreColumnsProps> = ({
  disciplineScores = {},
  className = '',
}) => (
  <div
    data-testid="discipline-score-columns"
    className={`grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 ${className}`}
  >
    {FAMILIES.map((family) => {
      const members = DISCIPLINES.filter((d) => d.category === family);
      const scored = members
        .map((d) => ({ d, score: scoreOf(disciplineScores, d.id) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score);
      const unscored = members.filter((d) => scoreOf(disciplineScores, d.id) === 0);
      return (
        <section
          key={family}
          aria-labelledby={`score-family-${family}`}
          data-testid={`score-family-${family}`}
          className="min-w-0"
        >
          <h4
            id={`score-family-${family}`}
            className="type-section-heading mb-2 border-b border-[var(--frosted-border)] pb-1"
          >
            {family}
          </h4>
          {scored.length > 0 && (
            <ul className="space-y-1">
              {scored.map(({ d, score }) => (
                <li key={d.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-[var(--text-primary)]">{d.name}</span>
                  <span className="font-semibold tabular-nums text-[var(--gold-primary)]">
                    {score.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {unscored.length > 0 && (
            <p
              data-testid={`score-family-${family}-unscored`}
              className="mt-2 text-sm text-[var(--text-secondary)]"
            >
              {scored.length === 0 ? 'Not yet scored: ' : 'Also not yet scored: '}
              {unscored.map((d) => d.name).join(', ')}
            </p>
          )}
        </section>
      );
    })}
  </div>
);

export default DisciplineScoreColumns;
