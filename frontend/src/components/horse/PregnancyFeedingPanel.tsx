/**
 * PregnancyFeedingPanel — feed-system redesign 2026-04-29
 * (Equoria-ta4s, parent: Equoria-3gqg).
 *
 * Renders the in-foal status panel on the HorseDetailPage when a mare has
 * `inFoalSinceDate` set. Shows:
 *   1. Gestation day X of 7 + days remaining countdown.
 *   2. Per-tier feeding counters accrued during the gestation window.
 *   3. No trait-chance numbers: feeding still counts toward the foal's traits,
 *      but the odds stay secret (owner ruling 2026-10-29 q293, Equoria-9kakx).
 *   4. Sire name (when supplied by the parent page after a useHorse lookup).
 *   5. "Foaling imminent" banner once 7+ days have elapsed but the foaling
 *      job hasn't materialised the foal yet.
 *
 * Pure component: takes the in-foal fields as props. The parent
 * (HorseDetailPage) is responsible for fetching the sire and passing the
 * `sireName` if it wants to display it.
 *
 * Time zones: countdown is computed from `Date.now()` minus the parsed
 * ISO timestamp. ISO timestamps are absolute (UTC), so the comparison is
 * UTC-safe regardless of the browser's local tz.
 */

import React from 'react';
import { getPregnancyProgress, GESTATION_DAYS } from '@/lib/utils/pregnancyChances';

const TIER_LABELS: Record<string, string> = {
  basic: 'Basic',
  performance: 'Performance',
  performancePlus: 'Performance Plus',
  highPerformance: 'High Performance',
  elite: 'Elite',
};

// Stable display order — drives the rendered list independent of object-key insertion order.
const TIER_ORDER: Array<keyof typeof TIER_LABELS> = [
  'elite',
  'highPerformance',
  'performancePlus',
  'performance',
  'basic',
];

export interface PregnancyFeedingPanelProps {
  /** ISO timestamp when the mare was bred. Null/undefined = not pregnant → renders nothing. */
  inFoalSinceDate?: string | null;
  /** Per-tier feeding counters from `Horse.pregnancyFeedingsByTier`. */
  feedings: Record<string, number>;
  /** Display name of the sire, looked up by the parent via pregnancySireId. */
  sireName?: string | null;
  /** Numeric sire ID — used as a fallback display token if sireName is missing. */
  pregnancySireId?: number | null;
}

export const PregnancyFeedingPanel: React.FC<PregnancyFeedingPanelProps> = ({
  inFoalSinceDate,
  feedings,
  sireName,
  pregnancySireId,
}) => {
  const progress = getPregnancyProgress(inFoalSinceDate);
  if (!progress) return null;
  const { gestationDay, daysRemaining, isOverdue } = progress;

  // Sire row: render only when we have something meaningful to show.
  const hasSireInfo = Boolean(sireName) || pregnancySireId != null;
  const sireDisplay =
    sireName ?? (pregnancySireId != null ? `Unknown sire (#${pregnancySireId})` : '');

  return (
    <div
      className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5 space-y-3"
      data-testid="pregnancy-feeding-panel"
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-bold text-[rgb(220,235,255)]">
          In foal — Day {gestationDay} of {GESTATION_DAYS}
        </h3>
        <span
          className={`text-xs ${
            isOverdue ? 'text-amber-300 font-semibold' : 'text-[rgb(160,175,200)]'
          }`}
          data-testid="pregnancy-days-remaining"
        >
          {isOverdue
            ? 'Foaling imminent'
            : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`}
        </span>
      </div>

      {hasSireInfo && (
        <div className="text-sm text-[rgb(180,195,215)]">
          Sire:{' '}
          <span className="font-semibold text-[rgb(220,235,255)]" data-testid="pregnancy-sire-name">
            {sireDisplay}
          </span>
        </div>
      )}

      <div>
        <p className="text-xs text-[rgb(160,175,200)] mb-1">Feedings so far:</p>
        <ul className="space-y-1 text-sm text-[rgb(220,235,255)]">
          {TIER_ORDER.filter((tier) => (feedings?.[tier] ?? 0) > 0).map((tier) => (
            <li key={tier} data-testid={`pregnancy-counter-${tier}`}>
              {feedings[tier]}× {TIER_LABELS[tier]}
            </li>
          ))}
          {Object.values(feedings ?? {}).every((n) => !n) && (
            <li className="text-[rgb(160,175,200)] italic">No feedings recorded yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default PregnancyFeedingPanel;
