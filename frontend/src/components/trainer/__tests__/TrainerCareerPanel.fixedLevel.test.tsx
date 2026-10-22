/**
 * TrainerCareerPanel — staff are fixed NPCs (Equoria-dea06).
 *
 * Owner ruling 2026-10-21: trainers, riders and grooms never gain XP; each
 * keeps the level it was generated with. The panel used to derive a level from
 * `experience` and draw an XP progress bar ("x / y XP", "n total XP"). It now
 * shows the trainer's own generated `level` and no XP at all.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import TrainerCareerPanel, { type TrainerCareerData } from '../TrainerCareerPanel';

const trainer: TrainerCareerData = {
  id: 1,
  name: 'Fixture Trainer',
  // An experience value whose XP-curve level (1) differs from the generated level.
  experience: 37,
  level: 4,
  careerWeeks: 10,
  hiredDate: '2026-09-01T00:00:00.000Z',
  retired: false,
  totalSessions: 3,
  totalHorses: 2,
};

describe('TrainerCareerPanel (Equoria-dea06)', () => {
  it("shows the trainer's generated level", () => {
    render(<TrainerCareerPanel trainer={trainer} />);
    expect(screen.getByTestId('trainer-level')).toHaveTextContent('Level 4');
  });

  it('shows no XP progress for a staff member', () => {
    render(<TrainerCareerPanel trainer={trainer} />);
    expect(screen.queryByTestId('xp-progress-bar')).not.toBeInTheDocument();
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
  });
});
