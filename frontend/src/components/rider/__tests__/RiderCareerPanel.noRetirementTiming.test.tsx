/**
 * Rider screens say nothing about when a rider retires (owner ruling
 * 2026-10-23, Equoria-or2ua; settles Equoria-oey96.26).
 *
 * OLD CONTRACT: the panel and the roster computed a "Retiring in Nw" warning
 * from a 104-week client constant while the server retired riders at 80 weeks,
 * so the two disagreed. NEW RULING: riders retire at a hidden random age; the
 * only notice is the game's notification a week before. No screen counts down,
 * warns or states timing, however many career weeks a rider has.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import RiderCareerPanel from '../RiderCareerPanel';
import type { RiderCareerData } from '@/types/riderCareer';

const veteran: RiderCareerData = {
  id: 7,
  name: 'Veteran Rider',
  experience: 0,
  level: 6,
  // 101 weeks was the old "warnings start" point (104 - 3); 80 the server's.
  careerWeeks: 101,
  hiredDate: '2025-09-01T00:00:00.000Z',
  retired: false,
  totalWins: 3,
  totalCompetitions: 9,
  prestige: 20,
};

describe('RiderCareerPanel says nothing about retirement timing (Equoria-or2ua)', () => {
  it.each([5, 79, 80, 101, 103, 104, 200])(
    'shows no retirement warning at %i career weeks',
    (careerWeeks) => {
      const { container } = render(<RiderCareerPanel rider={{ ...veteran, careerWeeks }} />);
      expect(screen.queryByTestId('retirement-warning')).not.toBeInTheDocument();
      expect(container.textContent ?? '').not.toMatch(/retir/i);
    }
  );
});
