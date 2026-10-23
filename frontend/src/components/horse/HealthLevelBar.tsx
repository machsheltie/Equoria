/**
 * HealthLevelBar: a five-level fill bar for a horse's health or hunger (owner
 * request 2026-10-23, Equoria-0l0tq). Filled by level, always labelled with the
 * level word, so the state is never carried by colour alone. Excellent is green,
 * Very Good yellow-green, Good yellow, Fair orange, Bad red (--health-* tokens).
 */

import React from 'react';
import { formatHealth, healthWords, type HealthWord } from '@/lib/healthWords';

const colorVarByWord: Record<HealthWord, string> = {
  Excellent: 'var(--health-excellent)',
  'Very Good': 'var(--health-very-good)',
  Good: 'var(--health-good)',
  Fair: 'var(--health-fair)',
  Bad: 'var(--health-bad)',
};

interface HealthLevelBarProps {
  /** The caption: "Health Status" or "Hunger Status". */
  title: string;
  /** The server's level word for the horse (displayedHealth or feedHealth). */
  level: string | null | undefined;
  testId: string;
}

export const HealthLevelBar: React.FC<HealthLevelBarProps> = ({ title, level, testId }) => {
  const word = formatHealth(level);
  // Excellent fills the bar; Bad leaves one segment so the bar never reads as empty.
  const filledSegments = word === null ? 0 : healthWords.length - healthWords.indexOf(word);

  return (
    <div data-testid={testId}>
      <p className="fantasy-caption text-[var(--text-secondary)] mb-1">{title}</p>
      <div
        role="meter"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={healthWords.length}
        aria-valuenow={filledSegments}
        aria-valuetext={word ?? 'Unknown'}
        className="flex gap-1 h-2.5 mb-1"
      >
        {healthWords.map((_, index) => (
          <span
            key={index}
            data-testid={`${testId}-segment`}
            data-filled={index < filledSegments}
            className="flex-1 rounded-sm"
            style={{
              backgroundColor:
                word !== null && index < filledSegments
                  ? colorVarByWord[word]
                  : 'var(--border-muted)',
            }}
          />
        ))}
      </div>
      <p className="fantasy-body text-[var(--text-primary)]" data-testid={`${testId}-label`}>
        {word ?? '—'}
      </p>
    </div>
  );
};

export default HealthLevelBar;
