/**
 * HealthVetTab shows only what the game actually recorded (Equoria-oey96.56).
 *
 * Owner decision 2026-07-07: derive from the vet data that exists and drop
 * fabricated precision; no schema change. A vet visit persists exactly one
 * thing on the horse, `lastVettedDate` (vetController.mjs). So:
 *   - the history is that one real visit, with its real date, never a
 *     hardcoded empty list;
 *   - there is no "Next Recommended Check: 6 weeks from last visit" line, which
 *     had no basis anywhere in the game (and the game gives no advice);
 *   - a horse with no recorded visit says so.
 *
 * The real payload normalizer feeds the real tab.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { HorseSummary } from '@/lib/api/types';
import { normalizeHorseDetail } from '../normalizeHorseDetail';
import HealthVetTab from '../HealthVetTab';

const stats = {
  precision: 1,
  strength: 2,
  speed: 3,
  agility: 4,
  endurance: 5,
  intelligence: 6,
  stamina: 7,
  balance: 8,
  boldness: 9,
  flexibility: 10,
  obedience: 11,
  focus: 12,
};

function renderTab(overrides: Partial<HorseSummary> = {}) {
  const payload: HorseSummary = {
    id: 7,
    name: 'Moonflower',
    breed: { id: 3, name: 'Arabian' },
    age: 5,
    gender: 'Mare',
    dateOfBirth: '2021-01-01',
    healthStatus: 'Healthy',
    stats,
    disciplineScores: {},
    ...overrides,
  };
  return render(
    <MemoryRouter>
      <HealthVetTab horse={normalizeHorseDetail(payload)} />
    </MemoryRouter>
  );
}

describe('HealthVetTab (Equoria-oey96.56)', () => {
  it('shows the real last vet visit date from lastVettedDate', () => {
    renderTab({ lastVettedDate: '2026-10-14' });

    const record = screen.getByTestId('vet-record-0');
    expect(record).toHaveTextContent(/vet check/i);
    expect(record).toHaveTextContent(/14/);
    expect(record).toHaveTextContent(/Oct/);
    expect(record).toHaveTextContent(/2026/);
    expect(screen.queryByText(/no vet visit on record/i)).not.toBeInTheDocument();
  });

  it('says so honestly when the horse has no recorded vet visit', () => {
    renderTab({ lastVettedDate: undefined });

    expect(screen.getByText(/no vet visit on record/i)).toBeInTheDocument();
    expect(screen.queryByTestId('vet-record-0')).not.toBeInTheDocument();
  });

  it('no longer prints the invented six-week next-check line', () => {
    renderTab({ lastVettedDate: '2026-10-14' });

    expect(screen.queryByText(/6 weeks/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/next recommended check/i)).not.toBeInTheDocument();
  });

  it('still offers the way to the vet clinic', () => {
    renderTab({ lastVettedDate: '2026-10-14' });

    expect(screen.getByRole('link', { name: /go to vet clinic/i })).toHaveAttribute('href', '/vet');
  });
});

// Owner ruling 2026-10-23 (Equoria-u0jop): health shows as one of Excellent,
// Very Good, Good, Fair, Bad — the displayed health every gate checks. Old
// contract: the raw stored healthStatus (default 'Excellent' forever, even for
// a horse the gates refuse as Bad).
describe('HealthVetTab current health (Equoria-u0jop)', () => {
  it('shows the displayed health word, not the stored vet finding', () => {
    renderTab({ healthStatus: 'Excellent', displayedHealth: 'Bad' });
    expect(screen.getByTestId('health-status-word')).toHaveTextContent('Bad');
  });

  it('shows Very Good as Very Good', () => {
    renderTab({ displayedHealth: 'Very Good' });
    expect(screen.getByTestId('health-status-word')).toHaveTextContent('Very Good');
  });

  it('shows an em dash, never a fake word, when health is unknown', () => {
    renderTab({ healthStatus: 'Excellent', displayedHealth: undefined });
    expect(screen.getByTestId('health-status-word')).toHaveTextContent('—');
  });
});
