/**
 * RiderCareerPanel — staff are fixed NPCs (Equoria-dea06), and their level is the star
 * level (owner ruling 2026-10-28, q229).
 *
 * Owner ruling 2026-10-21: trainers, riders and grooms never gain XP; each keeps the
 * level it was generated with. The panel used to show that as "Level N" (1-10). Owner
 * ruling q229 changed this contract: the old number is hidden everywhere and replaced by
 * the star level, which the card already shows, so the panel shows no "Level N" and no
 * level milestones.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import RiderCareerPanel from '../RiderCareerPanel';
import type { RiderCareerData } from '@/types/riderCareer';

const rider: RiderCareerData = {
  id: 1,
  name: 'Fixture Rider',
  experience: 37,
  starLevel: 'expert',
  careerWeeks: 10,
  hiredDate: '2026-09-01T00:00:00.000Z',
  retired: false,
  totalWins: 2,
  totalCompetitions: 5,
  prestige: 10,
};

describe('RiderCareerPanel (Equoria-dea06, q229)', () => {
  it('shows no old 1-10 level and no level milestones', () => {
    render(<RiderCareerPanel rider={rider} />);
    expect(screen.queryByTestId('rider-level')).not.toBeInTheDocument();
    expect(screen.queryByText(/\bLevel\s*\d/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('milestone-level_5')).not.toBeInTheDocument();
    expect(screen.queryByTestId('milestone-level_10')).not.toBeInTheDocument();
    expect(screen.getByTestId('milestone-first_win')).toBeInTheDocument();
  });

  it('shows no XP progress for a staff member', () => {
    render(<RiderCareerPanel rider={rider} />);
    expect(screen.queryByTestId('xp-progress-bar')).not.toBeInTheDocument();
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
  });
});
