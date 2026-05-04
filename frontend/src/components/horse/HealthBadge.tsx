/**
 * HealthBadge — feed-system redesign 2026-04-29 (Equoria-6i0m, parent: Equoria-3gqg).
 *
 * Renders one of the six derived health bands (excellent / good / fair /
 * poor / critical / retired) as a colour-coded pill. Critical is rendered
 * with a subtle pulse and (when `showCriticalWarning` is set) an inline
 * warning message about gates that fire on critical health.
 *
 * Bands are produced by backend/utils/horseHealth.mjs (worseOf of feed-
 * derived and vet-derived). The pill colour is driven by a static map so
 * the component is dependency-free and trivial to render in tests.
 */

import React from 'react';

const COLOR_BY_BAND: Record<string, string> = {
  excellent: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300',
  good: 'bg-green-500/20 border-green-400/40 text-green-300',
  fair: 'bg-yellow-500/20 border-yellow-400/40 text-yellow-300',
  poor: 'bg-orange-500/20 border-orange-400/40 text-orange-300',
  critical: 'bg-red-500/20 border-red-400/50 text-red-300 animate-pulse',
  retired: 'bg-purple-500/20 border-purple-400/40 text-purple-300',
};

export type HealthBand = 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'retired';

interface HealthBadgeProps {
  band: HealthBand;
  label?: string;
  showCriticalWarning?: boolean;
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({
  band,
  label,
  showCriticalWarning = false,
}) => {
  const cls = COLOR_BY_BAND[band] ?? 'bg-white/10 text-white/60';
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span
        className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${cls}`}
        data-testid="health-badge"
      >
        {label ?? band}
      </span>
      {showCriticalWarning && band === 'critical' && (
        <span className="text-xs text-red-400" data-testid="critical-warning">
          Cannot breed or compete until fed.
        </span>
      )}
    </div>
  );
};

export default HealthBadge;
