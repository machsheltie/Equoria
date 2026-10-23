/**
 * DisciplinePicker reads scores the way the API keys them (Equoria-znmtg).
 *
 * Horse.disciplineScores arrives keyed by discipline NAME ('Dressage',
 * 'Show Jumping'). The picker looked scores up by the kebab id ('show-jumping'),
 * so every discipline showed 0 even for a trained horse. The result modal's
 * "current score" read through getDisciplineScore, which had the same mismatch.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DisciplinePicker from '../DisciplinePicker';
import { getDisciplineScore } from '../../../lib/utils/training-utils';

// Exactly the shape GET /horses/:id sends: names as keys.
const apiScores = { Dressage: 40, 'Show Jumping': 12, 'Western Pleasure': 7 };

describe('DisciplinePicker with API-shaped disciplineScores', () => {
  it('shows the real score beside each discipline, including multi-word names', () => {
    render(
      <DisciplinePicker
        disciplineScores={apiScores}
        selectedDiscipline={null}
        onSelectDiscipline={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: /Select Dressage discipline.*score: 40/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Select Show Jumping discipline.*score: 12/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Select Western Pleasure discipline.*score: 7/i })
    ).toBeInTheDocument();
    // An untrained discipline is a genuine zero.
    expect(
      screen.getByRole('button', { name: /Select Racing discipline.*score: 0/i })
    ).toBeInTheDocument();
  });
});

describe('getDisciplineScore with API-shaped disciplineScores', () => {
  it('reads the score by discipline name for a kebab id', () => {
    const horse = { id: 1, name: 'Thunder', age: 5, disciplineScores: apiScores };

    expect(getDisciplineScore(horse, 'dressage')).toBe(40);
    expect(getDisciplineScore(horse, 'show-jumping')).toBe(12);
    expect(getDisciplineScore(horse, 'racing')).toBe(0);
  });
});
