/**
 * DisciplinesTab — per-discipline scores with progress bars.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 */

import React from 'react';
import type { Horse } from './HorseDetailPageTypes';
import { getStatColor } from './statHelpers';

const DisciplinesTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const disciplines = Object.entries(horse.disciplineScores);

  if (disciplines.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="fantasy-body text-[var(--text-secondary)]">
          This horse has not trained in any disciplines yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-4">Discipline Scores</h3>
      {disciplines.map(([discipline, score]) => (
        <div key={discipline} className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="fantasy-body text-[var(--text-primary)]">{discipline}</span>
            <span className={`fantasy-title ${getStatColor(score)}`}>{score}</span>
          </div>
          <div className="h-3 bg-[var(--glass-surface-subtle-bg)] rounded-full overflow-hidden border border-[var(--glass-border)]">
            <div
              className={`h-full transition-all ${
                score >= 90
                  ? 'bg-burnished-gold'
                  : score >= 75
                    ? 'bg-[var(--status-success)]'
                    : score >= 60
                      ? 'bg-aged-bronze'
                      : 'bg-[var(--text-secondary)]'
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default DisciplinesTab;
