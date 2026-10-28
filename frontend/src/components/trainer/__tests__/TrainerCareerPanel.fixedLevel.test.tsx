/**
 * TrainerCareerPanel — staff are fixed NPCs (Equoria-dea06), and their level is the
 * star level (owner ruling 2026-10-28, q229).
 *
 * Owner ruling 2026-10-21: trainers, riders and grooms never gain XP; each keeps the
 * level it was generated with. The panel used to show that as "Level N" (1-10), with
 * "Level 3 / 6 / 9" milestones. Owner ruling q229 changed this contract: the old number
 * is hidden everywhere and replaced by the star level (two old levels per star), which
 * the card already shows. The legacy badge, which needed the old level 7, needs four
 * stars.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import TrainerCareerPanel, { type TrainerCareerData } from '../TrainerCareerPanel';

const trainer: TrainerCareerData = {
  id: 1,
  name: 'Fixture Trainer',
  experience: 37,
  starLevel: 'novice',
  careerWeeks: 10,
  hiredDate: '2026-09-01T00:00:00.000Z',
  retired: false,
  totalSessions: 3,
  totalHorses: 2,
};

describe('TrainerCareerPanel (Equoria-dea06, q229)', () => {
  it('shows no old 1-10 level and no level milestones', () => {
    render(<TrainerCareerPanel trainer={trainer} />);
    expect(screen.queryByTestId('trainer-level')).not.toBeInTheDocument();
    expect(screen.queryByText(/\bLevel\s*\d/)).not.toBeInTheDocument();
    for (const id of ['level3', 'level6', 'level9']) {
      expect(screen.queryByTestId(`milestone-${id}`)).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('milestone-first_session')).toBeInTheDocument();
  });

  it('the legacy badge follows the stars: Advanced and up, not Novice', () => {
    const { rerender } = render(<TrainerCareerPanel trainer={trainer} />);
    expect(screen.queryByTestId('legacy-badge')).not.toBeInTheDocument();
    rerender(<TrainerCareerPanel trainer={{ ...trainer, starLevel: 'advanced' }} />);
    expect(screen.getByTestId('legacy-badge')).toBeInTheDocument();
  });

  it('shows no XP progress for a staff member', () => {
    render(<TrainerCareerPanel trainer={trainer} />);
    expect(screen.queryByTestId('xp-progress-bar')).not.toBeInTheDocument();
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
  });
});
