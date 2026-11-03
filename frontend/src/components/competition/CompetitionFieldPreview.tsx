/**
 * CompetitionFieldPreview (Epic 27-1)
 *
 * Shows show entry status for an open show:
 *  - Entered horses with stat comparison radar
 *  - Entry count (shows have no entry cap)
 *  - Closing date CooldownTimer
 *  - "Scout the Field" expandable section
 *
 * Props:
 *  - show: Show data with entryCount and closeDate
 *  - entries?: Array of entered horses (for Scout view)
 */

import React, { useState } from 'react';
import Currency from '@/components/ui/Currency';
import { competitionDisciplineLabel } from '@/lib/utils/training-utils';
import { Users, Eye, EyeOff } from 'lucide-react';
import { CooldownTimer } from '@/components/common/CooldownTimer';
import { ScoreBreakdownRadar } from './ScoreBreakdownRadar';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ShowSummary {
  id: number;
  name: string;
  discipline: string;
  entryFee: number;
  entryCount?: number;
  closeDate?: string | null;
  status: string;
}

interface EnteredHorse {
  id: number;
  name: string;
  breed?: string;
  stats?: Record<string, number>;
}

interface CompetitionFieldPreviewProps {
  show: ShowSummary;
  entries?: EnteredHorse[];
  className?: string;
  /**
   * Visual density. `full` (default) is the standalone card. `compact`
   * renders a condensed inline-in-card variant for tight layouts (e.g.
   * embedded in a show list row) — smaller padding/typography, header and
   * radar dropped, but the same data + accessible scout list preserved.
   */
  variant?: 'full' | 'compact';
}

/**
 * Build a screen-reader accessible label for a single scouted entry.
 * Includes the horse name, breed (if any), and every stat as
 * "<stat> <value>" so non-visual users get the same stat data the radar
 * conveys visually. Never emits "undefined"/"NaN" for missing data.
 */
function buildEntryAriaLabel(entry: EnteredHorse, position: number): string {
  const parts: string[] = [`Entry ${position}: ${entry.name}`];
  if (entry.breed) {
    parts.push(entry.breed);
  }
  const statEntries = entry.stats ? Object.entries(entry.stats) : [];
  if (statEntries.length > 0) {
    const statText = statEntries.map(([stat, value]) => `${stat} ${value}`).join(', ');
    parts.push(`stats: ${statText}`);
  } else {
    parts.push('no stats available');
  }
  return parts.join(', ');
}

// ── Entry count bar ────────────────────────────────────────────────────────────

function EntryCountBar({ count }: { count: number }) {
  // Owner ruling q339 (2026-11-03): shows have no entry cap, ever, so the
  // count is shown on its own, never against a ceiling.
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] font-[var(--font-body)]">
      <Users className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span>
        {count} {count === 1 ? 'entry' : 'entries'}
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CompetitionFieldPreview({
  show,
  entries = [],
  className = '',
  variant = 'full',
}: CompetitionFieldPreviewProps) {
  const [scouting, setScouting] = useState(false);

  const topEntry = entries[0];
  const isCompact = variant === 'compact';

  return (
    <div
      className={`glass-panel rounded-xl border border-[rgba(100,130,165,0.2)] ${
        isCompact ? 'p-3 space-y-2' : 'p-4 space-y-4'
      } ${className}`}
      data-testid="competition-field-preview"
      data-variant={variant}
    >
      {/* Header — condensed in compact mode (single line, no large heading) */}
      {isCompact ? (
        <div className="flex items-baseline justify-between gap-2">
          <h3
            className="text-sm font-bold text-[var(--text-primary)] truncate"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {show.name}
          </h3>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-[var(--font-body)] flex-shrink-0">
            {competitionDisciplineLabel(show.discipline)}
          </span>
        </div>
      ) : (
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-[var(--font-body)] mb-0.5">
            {competitionDisciplineLabel(show.discipline)}
          </p>
          <h3
            className="text-base font-bold text-[var(--text-primary)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {show.name}
          </h3>
        </div>
      )}

      {/* Entry count */}
      <EntryCountBar count={show.entryCount ?? 0} />

      {/* Closing timer */}
      {show.closeDate && <CooldownTimer endsAt={show.closeDate} label="Entries close" compact />}

      {/* Scout the Field */}
      {entries.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setScouting((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-[var(--gold-primary)] hover:text-[var(--gold-light)] transition-colors focus-visible:outline-none font-[var(--font-body)]"
            aria-expanded={scouting}
          >
            {scouting ? (
              <>
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                Hide Field
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                Scout the Field ({entries.length})
              </>
            )}
          </button>

          {scouting && (
            <div className="mt-3 space-y-3">
              {/* Radar for top entry — dropped in compact mode to save space */}
              {!isCompact && topEntry?.stats && Object.keys(topEntry.stats).length > 0 && (
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] font-[var(--font-body)] mb-1">
                    {topEntry.name} · stat profile
                  </p>
                  <ScoreBreakdownRadar stats={topEntry.stats} height={200} />
                </div>
              )}

              {/* Entry list — explicit list semantics + per-item accessible
                  labels carrying stat values so screen-reader users get the
                  same scouting data the radar shows visually. */}
              <ul className="space-y-1" role="list" aria-label={`Entered horses for ${show.name}`}>
                {entries.map((e, i) => (
                  <li
                    key={e.id}
                    role="listitem"
                    aria-label={buildEntryAriaLabel(e, i + 1)}
                    className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-[var(--font-body)]"
                  >
                    <span
                      className="w-5 text-right text-[var(--alpha-gold-primary-60)] font-bold tabular-nums"
                      aria-hidden="true"
                    >
                      {i + 1}.
                    </span>
                    <span className="text-[var(--text-primary)]" aria-hidden="true">
                      {e.name}
                    </span>
                    {e.breed && (
                      <span className="text-[var(--text-muted)]" aria-hidden="true">
                        · {e.breed}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Entry fee */}
      {show.entryFee > 0 && (
        <div className="text-xs text-[var(--text-muted)] font-[var(--font-body)] border-t border-[rgba(100,130,165,0.15)] pt-3">
          Entry fee:{' '}
          <span className="text-[var(--gold-primary)] font-semibold">
            {/* Canonical coin rendering — DECISIONS.md §9 ("coins", never "gold"/USD) */}
            <Currency amount={show.entryFee} />
          </span>
        </div>
      )}
    </div>
  );
}

export default CompetitionFieldPreview;
