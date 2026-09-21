/**
 * ScoreBreakdownChart — Show Scorecard Ledger tests (Equoria-d6a47)
 *
 * The Recharts bar chart was replaced by a show scorecard ledger (owner ruling
 * Equoria-ij7ev, 2026-09-11): signed rows summing to the total. These tests
 * assert the ledger's substance with real, non-empty breakdowns:
 * - every score component is a row; the rows' values sum to the final score
 * - signs are rendered (+ for bonuses, a true minus for penalties, 0.0 held)
 * - the base row is unsigned because it is the score's foundation
 * - trait and tack details are written beneath their rows
 * - a breakdown whose rows do NOT reconcile with the recorded final score
 *   says so honestly instead of hiding it
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ScoreBreakdownChart, { type ScoreBreakdown } from '../ScoreBreakdownChart';

const MINUS = '−';

/** Rows: 77.5 + 15 + (5 + 3) + 13 + 7 − 2 + 4.5 = 123.0 */
const reconciled: ScoreBreakdown = {
  baseScore: { speed: 80, stamina: 75, agility: 70, total: 77.5 },
  trainingBonus: 15,
  traitBonuses: [
    { trait: 'Speed Demon', bonus: 5 },
    { trait: 'Agile', bonus: 3 },
  ],
  equipmentBonuses: { saddle: 8, bridle: 5, total: 13 },
  riderEffect: 7,
  healthModifier: -2,
  randomLuck: 4.5,
  total: 123,
};

/** Rows: 56.5 + 10 − 3 + 8 − 5 − 8 − 7 = 51.5 */
const withPenalties: ScoreBreakdown = {
  baseScore: { speed: 60, stamina: 55, agility: 50, total: 56.5 },
  trainingBonus: 10,
  traitBonuses: [{ trait: 'Nervous', bonus: -3 }],
  equipmentBonuses: { saddle: 5, bridle: 3, total: 8 },
  riderEffect: -5,
  healthModifier: -8,
  randomLuck: -7,
  total: 51.5,
};

/** Every modifier held at zero: the base carries the whole score. */
const allZeroModifiers: ScoreBreakdown = {
  baseScore: { speed: 50, stamina: 50, agility: 50, total: 50 },
  trainingBonus: 0,
  traitBonuses: [],
  equipmentBonuses: { saddle: 0, bridle: 0, total: 0 },
  riderEffect: 0,
  healthModifier: 0,
  randomLuck: 0,
  total: 50,
};

function readRowValues(): number[] {
  const rows = screen.getAllByTestId(/^ledger-row-/);
  expect(rows.length).toBeGreaterThan(0);
  return rows.map((row) => Number(row.getAttribute('data-value')));
}

describe('ScoreBreakdownChart (show scorecard ledger)', () => {
  describe('ledger structure', () => {
    it('renders a real table captioned as the show scorecard', () => {
      render(<ScoreBreakdownChart breakdown={reconciled} />);
      expect(screen.getByTestId('score-breakdown-ledger')).toBeInTheDocument();
      const table = screen.getByRole('table', { name: /show scorecard/i });
      expect(table).toBeInTheDocument();
    });

    it('renders one row per score component, base first, in show order', () => {
      render(<ScoreBreakdownChart breakdown={reconciled} />);
      const rows = screen.getAllByTestId(/^ledger-row-/);
      expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
        'ledger-row-base',
        'ledger-row-training',
        'ledger-row-traits',
        'ledger-row-tack',
        'ledger-row-rider',
        'ledger-row-health',
        'ledger-row-luck',
      ]);
      // Row headers name the component for assistive tech.
      expect(screen.getByRole('rowheader', { name: /base stats/i })).toBeInTheDocument();
      expect(screen.getByRole('rowheader', { name: /luck/i })).toBeInTheDocument();
    });

    it('accepts a custom caption', () => {
      render(<ScoreBreakdownChart breakdown={reconciled} caption="Moonflower at Halcyon Downs" />);
      expect(
        screen.getByRole('table', { name: 'Moonflower at Halcyon Downs' })
      ).toBeInTheDocument();
    });
  });

  describe('signed rows summing to the total', () => {
    it('sums the row values to the rendered final score', () => {
      render(<ScoreBreakdownChart breakdown={reconciled} />);
      const values = readRowValues();
      const sum = values.reduce((acc, v) => acc + v, 0);
      const total = screen.getByTestId('ledger-total');
      expect(Number(total.getAttribute('data-value'))).toBeCloseTo(sum, 5);
      expect(total).toHaveTextContent('123.0');
      expect(screen.queryByTestId('ledger-reconciliation')).not.toBeInTheDocument();
    });

    it('sums to the total when the rows carry penalties', () => {
      render(<ScoreBreakdownChart breakdown={withPenalties} />);
      const sum = readRowValues().reduce((acc, v) => acc + v, 0);
      expect(sum).toBeCloseTo(51.5, 5);
      expect(screen.getByTestId('ledger-total')).toHaveTextContent('51.5');
      expect(screen.queryByTestId('ledger-reconciliation')).not.toBeInTheDocument();
    });

    it('renders a plus on bonuses, a true minus on penalties, and the base unsigned', () => {
      render(<ScoreBreakdownChart breakdown={reconciled} />);
      expect(within(screen.getByTestId('ledger-row-base')).getByText('77.5')).toBeInTheDocument();
      expect(
        within(screen.getByTestId('ledger-row-training')).getByText('+15.0')
      ).toBeInTheDocument();
      expect(within(screen.getByTestId('ledger-row-traits')).getByText('+8.0')).toBeInTheDocument();
      expect(
        within(screen.getByTestId('ledger-row-health')).getByText(`${MINUS}2.0`)
      ).toBeInTheDocument();
      expect(within(screen.getByTestId('ledger-row-luck')).getByText('+4.5')).toBeInTheDocument();
    });

    it('carries the sign in a data attribute so tone is never colour alone', () => {
      render(<ScoreBreakdownChart breakdown={withPenalties} />);
      expect(screen.getByTestId('ledger-row-base')).toHaveAttribute('data-sign', 'base');
      expect(screen.getByTestId('ledger-row-training')).toHaveAttribute('data-sign', 'positive');
      expect(screen.getByTestId('ledger-row-rider')).toHaveAttribute('data-sign', 'negative');
    });

    it('renders held modifiers as 0.0 and still sums to the base', () => {
      render(<ScoreBreakdownChart breakdown={allZeroModifiers} />);
      const zeroRows = screen
        .getAllByTestId(/^ledger-row-/)
        .filter((r) => r.getAttribute('data-sign') === 'zero');
      expect(zeroRows).toHaveLength(6);
      zeroRows.forEach((row) => expect(within(row).getByText('0.0')).toBeInTheDocument());
      expect(screen.getByTestId('ledger-total')).toHaveTextContent('50.0');
    });
  });

  describe('row details', () => {
    it('writes the weighted base stats and each trait with its signed bonus', () => {
      render(<ScoreBreakdownChart breakdown={reconciled} />);
      const base = screen.getByTestId('ledger-row-base');
      expect(base).toHaveTextContent('Speed 80 × 50%');
      expect(base).toHaveTextContent('Stamina 75 × 30%');
      expect(base).toHaveTextContent('Agility 70 × 20%');

      const traits = screen.getByTestId('ledger-row-traits');
      expect(traits).toHaveTextContent('Speed Demon +5.0');
      expect(traits).toHaveTextContent('Agile +3.0');

      const tack = screen.getByTestId('ledger-row-tack');
      expect(tack).toHaveTextContent('Saddle +8.0');
      expect(tack).toHaveTextContent('Bridle +5.0');
    });

    it('says plainly when no traits influenced the score', () => {
      render(<ScoreBreakdownChart breakdown={allZeroModifiers} />);
      expect(screen.getByTestId('ledger-row-traits')).toHaveTextContent('No trait bonuses');
    });
  });

  describe('honesty', () => {
    it('states the row sum when it does not reconcile with the recorded final score', () => {
      const unreconciled: ScoreBreakdown = { ...reconciled, total: 115 };
      render(<ScoreBreakdownChart breakdown={unreconciled} />);
      // The recorded final score is what the show recorded; never silently
      // replaced by our own arithmetic.
      expect(screen.getByTestId('ledger-total')).toHaveTextContent('115.0');
      const note = screen.getByTestId('ledger-reconciliation');
      expect(note).toHaveTextContent('123.0');
    });
  });
});
