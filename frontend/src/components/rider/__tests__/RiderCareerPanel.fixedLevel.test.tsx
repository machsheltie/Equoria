/**
 * RiderCareerPanel — staff are fixed NPCs (Equoria-dea06).
 *
 * Owner ruling 2026-10-21: trainers, riders and grooms never gain XP; each
 * keeps the level it was generated with. The panel used to derive a level from
 * `experience` and draw an XP progress bar ("x / y XP", "n total XP"). It now
 * shows the rider's own generated `level` and no XP at all.
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
  // An experience value whose XP-curve level (1) differs from the generated level.
  experience: 37,
  level: 4,
  careerWeeks: 10,
  hiredDate: '2026-09-01T00:00:00.000Z',
  retired: false,
  totalWins: 2,
  totalCompetitions: 5,
  prestige: 10,
};

describe('RiderCareerPanel (Equoria-dea06)', () => {
  it("shows the rider's generated level", () => {
    render(<RiderCareerPanel rider={rider} />);
    expect(screen.getByTestId('rider-level')).toHaveTextContent('Level 4');
  });

  it('shows no XP progress for a staff member', () => {
    render(<RiderCareerPanel rider={rider} />);
    expect(screen.queryByTestId('xp-progress-bar')).not.toBeInTheDocument();
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
  });
});
