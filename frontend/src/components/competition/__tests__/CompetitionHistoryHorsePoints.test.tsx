/**
 * CompetitionHistory — Horse Points, never a fake or hidden figure (Equoria-q4uem.15).
 *
 * Owner ruling 2026-10-07: horse XP is called Horse Points (player XP stays XP).
 * PRODUCT.md "Truth, State": unknown is an em dash, never a reassuring zero.
 * The competition-history endpoint does not record Horse Points per entry yet,
 * so each entry shows "Horse Points —"; a recorded value prints as itself.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import CompetitionHistory, {
  type CompetitionEntry,
  type CompetitionHistoryData,
} from '../CompetitionHistory';

const baseEntry: Omit<CompetitionEntry, 'competitionId' | 'competitionName'> = {
  discipline: 'racing',
  date: new Date().toISOString().slice(0, 10),
  placement: 2,
  totalParticipants: 10,
  finalScore: 80,
  prizeMoney: 500,
};

function renderWith(competitions: CompetitionEntry[]) {
  const data: CompetitionHistoryData = {
    horseId: 7,
    horseName: 'Moonflower',
    statistics: {
      totalCompetitions: competitions.length,
      wins: 0,
      top3Finishes: competitions.length,
      winRate: 0,
      totalPrizeMoney: 500 * competitions.length,
      averagePlacement: 2,
      bestPlacement: 2,
    },
    competitions,
  };
  render(<CompetitionHistory horseId={7} horseName="Moonflower" data={data} isLoading={false} />);
  return screen.getAllByTestId(/^competition-entry/);
}

describe('CompetitionHistory — Horse Points (Equoria-q4uem.15)', () => {
  it('an entry with no recorded Horse Points shows an em dash under the Horse Points label', () => {
    const [entry] = renderWith([
      { ...baseEntry, competitionId: 1, competitionName: 'Halcyon Downs Stakes' },
    ]);
    expect(within(entry).getByText('Horse Points')).toBeInTheDocument();
    expect(within(entry).getByText('—')).toBeInTheDocument();
    expect(within(entry).queryByText('XP')).not.toBeInTheDocument();
  });

  it('a recorded value prints as itself, labelled Horse Points, not XP', () => {
    const [entry] = renderWith([
      { ...baseEntry, competitionId: 2, competitionName: 'Lantern Cup', xpGained: 5 },
    ]);
    expect(within(entry).getByText('5')).toBeInTheDocument();
    expect(within(entry).getByText('Horse Points')).toBeInTheDocument();
    expect(within(entry).queryByText('XP')).not.toBeInTheDocument();
  });
});
