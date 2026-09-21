/**
 * ScoreBreakdownChart — the Show Scorecard Ledger (Equoria-d6a47)
 *
 * Successor to the Recharts bar chart, per the owner ruling on Equoria-ij7ev
 * (2026-09-11): a show scorecard ledger — signed rows summing to the total.
 * The base stats open the card unsigned, because they are the score's
 * foundation; every modifier beneath is written with its sign (+ bonus,
 * − penalty, 0.0 held) and its provenance (which traits, which tack) in a
 * quiet note under the row. A gold rule closes the ledger above the final
 * score as the show recorded it.
 *
 * If the rows do not reconcile with the recorded final score, the ledger says
 * so in one line rather than replacing the show's number with its own sum.
 *
 * The file keeps its historical name so the barrel, the call site and its
 * tests are undisturbed. Story 5-2: Competition Results Display.
 */

import React, { memo, useMemo } from 'react';

/**
 * Individual trait bonus in the score breakdown
 */
export interface TraitBonus {
  trait: string;
  bonus: number;
}

/**
 * Score breakdown data structure
 * Contains all components that contribute to the final competition score
 */
export interface ScoreBreakdown {
  /** Base stats contribution (speed/stamina/agility with 50/30/20 weighting) */
  baseScore: {
    speed: number;
    stamina: number;
    agility: number;
    total: number;
  };
  /** Training bonus points */
  trainingBonus: number;
  /** List of trait bonuses (can be positive or negative) */
  traitBonuses: TraitBonus[];
  /** Equipment bonus breakdown */
  equipmentBonuses: {
    saddle: number;
    bridle: number;
    total: number;
  };
  /** Rider effect (can be positive bonus or negative penalty) */
  riderEffect: number;
  /** Health modifier (percentage adjustment based on rating) */
  healthModifier: number;
  /** Random luck factor (plus or minus 9%) */
  randomLuck: number;
  /** Total final score */
  total: number;
}

/**
 * Props for ScoreBreakdownChart component
 */
export interface ScoreBreakdownChartProps {
  /** The score breakdown data to write into the ledger */
  breakdown: ScoreBreakdown;
  /** Table caption; defaults to "Show scorecard". */
  caption?: string;
  /** Additional CSS class for the container */
  className?: string;
}

type Sign = 'base' | 'positive' | 'negative' | 'zero';

interface LedgerRow {
  key: string;
  label: string;
  value: number;
  sign: Sign;
  /** Provenance written beneath the label. */
  note?: string;
}

const MINUS = '−';
const RECONCILE_TOLERANCE = 0.05;

function signOf(value: number): Exclude<Sign, 'base'> {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'zero';
}

/** "+15.0", "−2.0", "0.0" — a true minus, never a hyphen. */
export function formatSigned(value: number, decimals = 1): string {
  if (value > 0) return `+${value.toFixed(decimals)}`;
  if (value < 0) return `${MINUS}${Math.abs(value).toFixed(decimals)}`;
  return (0).toFixed(decimals);
}

const SIGN_TONE: Record<Sign, string> = {
  base: 'text-[var(--text-primary)]',
  positive: 'text-[var(--role-success-text)]',
  negative: 'text-[var(--role-danger-text)]',
  zero: 'text-[var(--text-secondary)]',
};

export function buildLedgerRows(breakdown: ScoreBreakdown): LedgerRow[] {
  const { baseScore, equipmentBonuses } = breakdown;
  const traitTotal = breakdown.traitBonuses.reduce((sum, tb) => sum + tb.bonus, 0);
  const traitNote =
    breakdown.traitBonuses.length > 0
      ? breakdown.traitBonuses.map((tb) => `${tb.trait} ${formatSigned(tb.bonus)}`).join(' · ')
      : 'No trait bonuses';

  return [
    {
      key: 'base',
      label: 'Base stats',
      value: baseScore.total,
      sign: 'base',
      note: `Speed ${baseScore.speed} × 50% · Stamina ${baseScore.stamina} × 30% · Agility ${baseScore.agility} × 20%`,
    },
    {
      key: 'training',
      label: 'Training',
      value: breakdown.trainingBonus,
      sign: signOf(breakdown.trainingBonus),
      note: 'Discipline training',
    },
    {
      key: 'traits',
      label: 'Traits',
      value: traitTotal,
      sign: signOf(traitTotal),
      note: traitNote,
    },
    {
      key: 'tack',
      label: 'Tack',
      value: equipmentBonuses.total,
      sign: signOf(equipmentBonuses.total),
      note: `Saddle ${formatSigned(equipmentBonuses.saddle)} · Bridle ${formatSigned(equipmentBonuses.bridle)}`,
    },
    {
      key: 'rider',
      label: 'Rider',
      value: breakdown.riderEffect,
      sign: signOf(breakdown.riderEffect),
      note: breakdown.riderEffect < 0 ? 'Rider penalty' : 'Rider bonus',
    },
    {
      key: 'health',
      label: 'Health',
      value: breakdown.healthModifier,
      sign: signOf(breakdown.healthModifier),
      note: 'Condition on the day',
    },
    {
      key: 'luck',
      label: 'Luck',
      value: breakdown.randomLuck,
      sign: signOf(breakdown.randomLuck),
      note: 'The day’s fortune, up to ±9%',
    },
  ];
}

const ScoreBreakdownChart: React.FC<ScoreBreakdownChartProps> = ({
  breakdown,
  caption = 'Show scorecard',
  className = '',
}) => {
  const rows = useMemo(() => buildLedgerRows(breakdown), [breakdown]);
  const rowSum = useMemo(() => rows.reduce((sum, row) => sum + row.value, 0), [rows]);
  const reconciles = Math.abs(rowSum - breakdown.total) <= RECONCILE_TOLERANCE;

  return (
    <div className={className} data-testid="score-breakdown-ledger">
      <table className="w-full border-collapse font-[var(--font-body)] text-sm">
        <caption className="type-label mb-2 text-left">{caption}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Score component</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              data-testid={`ledger-row-${row.key}`}
              data-value={row.value}
              data-sign={row.sign}
              className="border-b border-[var(--glass-border)]"
            >
              <th
                scope="row"
                className="py-2 pr-4 text-left align-top font-medium text-[var(--text-primary)]"
              >
                {row.label}
                {row.note && (
                  <span className="mt-0.5 block text-xs font-normal leading-snug text-[var(--text-secondary)]">
                    {row.note}
                  </span>
                )}
              </th>
              <td
                className={`whitespace-nowrap py-2 text-right align-top font-semibold tabular-nums ${SIGN_TONE[row.sign]}`}
              >
                {row.sign === 'base' ? row.value.toFixed(1) : formatSigned(row.value)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr
            data-testid="ledger-total"
            data-value={breakdown.total}
            className="border-t border-[var(--alpha-gold-primary-40)]"
          >
            <th
              scope="row"
              className="pt-3 text-left align-baseline font-semibold text-[var(--text-primary)]"
            >
              Final score
            </th>
            <td className="whitespace-nowrap pt-3 text-right align-baseline text-xl font-bold tabular-nums text-[var(--gold-light)]">
              {breakdown.total.toFixed(1)}
            </td>
          </tr>
          {!reconciles && (
            <tr data-testid="ledger-reconciliation">
              <td colSpan={2} className="pt-1 text-xs leading-snug text-[var(--text-secondary)]">
                The rows above sum to {rowSum.toFixed(1)}; the final score is as the show recorded
                it.
              </td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
};

export default memo(ScoreBreakdownChart);
