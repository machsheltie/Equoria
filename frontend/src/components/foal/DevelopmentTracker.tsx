/**
 * DevelopmentTracker (Epic 29-1) — PRESENTATIONAL / "View"
 *
 * Celestial Night foal development tracker: the foal's name, last
 * interaction and a bond score bar with milestone markers at 25 / 50 / 75 /
 * 100.
 *
 * No player-selectable stage activities and no "Graduated" state
 * (Equoria-fr2kg; owner ruling 2026-10-14/15: grooms do the foal's
 * activities, and there is no graduation). No named life stages either
 * (Equoria-fr2kg Q5; owner ruling 2026-10-15): the Newborn / Weanling /
 * Yearling / 2-Year-Old timeline, its real-week clock, the "Stage N / 4"
 * badge and the phone stage card were removed.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * RELATIONSHIP TO breeding/FoalDevelopmentTracker.tsx (Equoria-rpnq4)
 *
 * Two intentionally separate components, NOT a duplicate:
 *
 *  - THIS file (foal/DevelopmentTracker): the dumb PRESENTATIONAL "view".
 *    Pure bond-bar UI driven entirely by the passed-in foal data.
 *    No API hooks, no data fetching, no mutations. Reusable and trivially
 *    testable.
 *
 *  - breeding/FoalDevelopmentTracker: the CONTAINER / orchestrator. Owns
 *    the API hooks (useFoal, useFoalDevelopment, useFoalActivities) and the
 *    activity log. It RENDERS this
 *    view and is the one wired into FoalDetailPage.
 *
 * If you need data/mutations → edit breeding/FoalDevelopmentTracker.
 * If you need to change the bond-bar LAYOUT → edit this
 * file. Do NOT merge them without a unified UX spec agreed up-front.
 * ──────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { formatDate } from '@/lib/formatDate';
import { Baby, TrendingUp } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CompletedMilestones {
  bond25?: string;
  bond50?: string;
  bond75?: string;
  bond100?: string;
}

export interface DevelopmentTrackerProps {
  foalName: string;
  bondScore?: number;
  completedMilestones?: CompletedMilestones;
  lastInteractionAt?: string | null;
  className?: string;
}

const BOND_MILESTONES = [25, 50, 75, 100] as const;

// ── Bond score bar ─────────────────────────────────────────────────────────────

function BondScoreBar({
  bondScore,
  completedMilestones,
}: {
  bondScore: number;
  completedMilestones: CompletedMilestones;
}) {
  const pct = Math.min(100, Math.max(0, bondScore));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-[var(--gold-primary)]" aria-hidden="true" />
          <span className="text-xs font-semibold text-[var(--text-primary)] font-[var(--font-body)]">
            Bond Score
          </span>
        </div>
        <span className="text-sm font-bold text-[var(--gold-primary)] font-[var(--font-body)] tabular-nums">
          {bondScore}
        </span>
      </div>

      {/* Bar with milestone markers */}
      <div className="relative">
        <div
          className="h-3 w-full rounded-full bg-[var(--celestial-navy-700)] overflow-hidden"
          role="progressbar"
          aria-valuenow={bondScore}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Bond score: ${bondScore} out of 100`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-primary)] transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Milestone tick marks */}
        <div className="absolute inset-0 pointer-events-none">
          {BOND_MILESTONES.map((m) => {
            const key = `bond${m}` as keyof CompletedMilestones;
            const achieved = Boolean(completedMilestones[key]);
            return (
              <div
                key={m}
                className="absolute top-0 bottom-0 flex flex-col items-center"
                style={{ left: `${m}%` }}
                title={achieved ? `Bond ${m} achieved` : `Bond ${m}`}
              >
                <div
                  className={[
                    'w-0.5 h-full',
                    achieved ? 'bg-[var(--gold-primary)]' : 'bg-[var(--celestial-navy-600)]',
                  ].join(' ')}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Milestone labels */}
      <div className="relative h-4">
        {BOND_MILESTONES.map((m) => {
          const key = `bond${m}` as keyof CompletedMilestones;
          const achieved = Boolean(completedMilestones[key]);
          return (
            <span
              key={m}
              className={[
                'absolute -translate-x-1/2 text-[9px] font-[var(--font-body)]',
                achieved ? 'text-[var(--gold-primary)]' : 'text-[var(--celestial-navy-500)]',
              ].join(' ')}
              style={{ left: `${m}%` }}
            >
              {m}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DevelopmentTracker({
  foalName,
  bondScore = 0,
  completedMilestones = {},
  lastInteractionAt,
  className = '',
}: DevelopmentTrackerProps) {
  return (
    <div
      className={`glass-panel rounded-2xl border border-[var(--alpha-gold-ember-15)] overflow-hidden ${className}`}
      data-testid="development-tracker"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--alpha-gold-primary-10)]">
        <div className="flex items-center gap-2">
          <Baby className="h-4 w-4 text-[var(--gold-primary)]" aria-hidden="true" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-[var(--font-body)]">
              Development
            </p>
            <p
              className="text-sm font-semibold text-[var(--text-primary)]"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {foalName}
            </p>
          </div>
        </div>

        {lastInteractionAt && (
          <p className="mt-1 text-[10px] text-[var(--text-muted)] font-[var(--font-body)]">
            Last interaction:{' '}
            {/* Equoria-2dnd2: shared util adds the isNaN guard the truthy check missed. */}
            {formatDate(lastInteractionAt, { month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>

      <div className="p-4">
        <BondScoreBar bondScore={bondScore} completedMilestones={completedMilestones} />
      </div>
    </div>
  );
}

export default DevelopmentTracker;
