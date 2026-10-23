/**
 * HealthBadge — feed-system redesign 2026-04-29 (Equoria-6i0m, parent: Equoria-3gqg).
 *
 * Renders a horse's health as one of the five health words (owner ruling
 * 2026-10-23, Equoria-u0jop): Excellent, Very Good, Good, Fair, Bad — or
 * Retired for a retired horse. Any value is worded through lib/healthWords
 * formatHealth, so a stored Poor or Critical shows as Bad. Bad is rendered
 * with a subtle pulse and (when `showBadHealthWarning` is set) an inline
 * warning that the horse cannot breed, train or show until Fair or better.
 *
 * The server sends displayedHealth (backend/utils/horseHealth.mjs: worse of
 * feed and vet health). The pill colour is driven by a static map so the
 * component is dependency-free and trivial to render in tests.
 */

import React from 'react';
import { formatHealth, type HealthWord } from '@/lib/healthWords';

const colorByWord: Record<HealthWord | 'Retired', string> = {
  Excellent: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300',
  'Very Good': 'bg-green-500/20 border-green-400/40 text-green-300',
  Good: 'bg-green-500/20 border-green-400/40 text-green-300',
  Fair: 'bg-yellow-500/20 border-yellow-400/40 text-yellow-300',
  Bad: 'bg-red-500/20 border-red-400/50 text-red-300 animate-pulse',
  Retired: 'bg-purple-500/20 border-purple-400/40 text-purple-300',
};

interface HealthBadgeProps {
  /** A health value from the server (displayedHealth), or 'retired'. */
  band: string;
  label?: string;
  showBadHealthWarning?: boolean;
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({
  band,
  label,
  showBadHealthWarning = false,
}) => {
  const word = band.trim().toLowerCase() === 'retired' ? 'Retired' : formatHealth(band);
  // Fallback names its border colour explicitly (Equoria-dlup5): only an empty
  // band reaches it. border-[var(--border-default)] is the same colour the
  // deleted global `* { border-color }` rule applied — computed style unchanged.
  const cls = word
    ? colorByWord[word]
    : 'bg-white/10 border-[var(--border-default)] text-role-secondary';
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span
        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}
        data-testid="health-badge"
      >
        {label ?? word ?? '—'}
      </span>
      {showBadHealthWarning && word === 'Bad' && (
        <span className="text-xs text-red-400" data-testid="bad-health-warning">
          Cannot breed, train or show until Fair or better. Feed and vet to restore health.
        </span>
      )}
    </div>
  );
};

export default HealthBadge;
