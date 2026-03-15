/**
 * CompetitionFieldPreview (Epic 27-1)
 *
 * Shows show entry status for an open show:
 *  - Entered horses with stat comparison radar
 *  - Entry count vs. max entries
 *  - Closing date CooldownTimer
 *  - "Scout the Field" expandable section
 *
 * Props:
 *  - show: Show data with entryCount and closeDate
 *  - entries?: Array of entered horses (for Scout view)
 */

import React, { useState } from 'react';
import { Users, Eye, EyeOff } from 'lucide-react';
import { CooldownTimer } from '@/components/common/CooldownTimer';
import { ScoreBreakdownRadar } from './ScoreBreakdownRadar';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ShowSummary {
  id: number;
  name: string;
  discipline: string;
  entryFee: number;
  maxEntries?: number | null;
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
}

// ── Entry count bar ────────────────────────────────────────────────────────────

function EntryCountBar({ count, max }: { count: number; max: number | null | undefined }) {
  if (!max) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] font-[var(--font-body)]">
        <Users className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span>
          {count} {count === 1 ? 'entry' : 'entries'}
        </span>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((count / max) * 100));
  const isFull = count >= max;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-[var(--font-body)]">
        <span className="flex items-center gap-1 text-[var(--text-muted)]">
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          Entries
        </span>
        <span className={isFull ? 'text-red-400 font-semibold' : 'text-[var(--text-primary)]'}>
          {count} / {max}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full bg-[var(--celestial-navy-700)] overflow-hidden"
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`h-full rounded-full transition-all ${isFull ? 'bg-red-500' : 'bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-primary)]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CompetitionFieldPreview({
  show,
  entries = [],
  className = '',
}: CompetitionFieldPreviewProps) {
  const [scouting, setScouting] = useState(false);

  const topEntry = entries[0];

  return (
    <div
      className={`glass-panel rounded-xl p-4 space-y-4 border border-[rgba(100,130,165,0.2)] ${className}`}
      data-testid="competition-field-preview"
    >
      {/* Header */}
      <div>
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-[var(--font-body)] mb-0.5">
          {show.discipline}
        </p>
        <h3
          className="text-base font-bold text-[var(--text-primary)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {show.name}
        </h3>
      </div>

      {/* Entry count */}
      <EntryCountBar count={show.entryCount ?? 0} max={show.maxEntries} />

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
              {/* Radar for top entry */}
              {topEntry?.stats && Object.keys(topEntry.stats).length > 0 && (
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] font-[var(--font-body)] mb-1">
                    {topEntry.name} · stat profile
                  </p>
                  <ScoreBreakdownRadar stats={topEntry.stats} height={200} />
                </div>
              )}

              {/* Entry list */}
              <ul className="space-y-1">
                {entries.map((e, i) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-[var(--font-body)]"
                  >
                    <span className="w-5 text-right text-[var(--gold-primary)]/60 font-bold tabular-nums">
                      {i + 1}.
                    </span>
                    <span className="text-[var(--text-primary)]">{e.name}</span>
                    {e.breed && <span className="text-[var(--text-muted)]">· {e.breed}</span>}
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
            {show.entryFee.toLocaleString()} gold
          </span>
        </div>
      )}
    </div>
  );
}

export default CompetitionFieldPreview;
