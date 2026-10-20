/**
 * DevelopmentTracker (Epic 29-1) — PRESENTATIONAL / "View"
 *
 * Celestial Night foal development tracker.
 *
 * Desktop: horizontal timeline showing all 4 age stages
 * Mobile:  card showing current stage only, with prev/next navigation
 *
 * Features:
 *  - Current age stage derived from dateOfBirth (matches backend foalAgeUtils)
 *  - Bond score progress bar with milestone markers at 25 / 50 / 75 / 100
 *  - Stage completion badges for past stages
 *
 * No player-selectable stage activities and no "Graduated" state
 * (Equoria-fr2kg; owner ruling 2026-10-14/15: grooms do the foal's
 * activities, and there is no graduation).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * RELATIONSHIP TO breeding/FoalDevelopmentTracker.tsx (Equoria-rpnq4)
 *
 * Two intentionally separate components, NOT a duplicate:
 *
 *  - THIS file (foal/DevelopmentTracker): the dumb PRESENTATIONAL "view".
 *    Pure timeline/bond-bar UI driven entirely by the passed-in foal data.
 *    No API hooks, no data fetching, no mutations. Reusable and trivially
 *    testable.
 *
 *  - breeding/FoalDevelopmentTracker: the CONTAINER / orchestrator. Owns
 *    the API hooks (useFoal, useFoalDevelopment, useFoalActivities) and the
 *    activity log. It RENDERS this
 *    view and is the one wired into FoalDetailPage.
 *
 * If you need data/mutations → edit breeding/FoalDevelopmentTracker.
 * If you need to change the timeline/bond-bar LAYOUT → edit this
 * file. Do NOT merge them without a unified UX spec agreed up-front.
 * ──────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import { formatDate } from '@/lib/formatDate';
import { Baby, TrendingUp, Star, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AgeStage = 'newborn' | 'weanling' | 'yearling' | 'two_year_old';

export interface CompletedMilestones {
  bond25?: string;
  bond50?: string;
  bond75?: string;
  bond100?: string;
}

export interface DevelopmentTrackerProps {
  foalName: string;
  dateOfBirth: string;
  bondScore?: number;
  completedMilestones?: CompletedMilestones;
  lastInteractionAt?: string | null;
  className?: string;
}

// ── Stage metadata ─────────────────────────────────────────────────────────────

interface StageInfo {
  key: AgeStage;
  label: string;
  weeksRange: string;
  icon: string;
  description: string;
}

const STAGES: StageInfo[] = [
  {
    key: 'newborn',
    label: 'Newborn',
    weeksRange: '0–4 wk',
    icon: '🐣',
    description: 'Gentle first contact and early bonding',
  },
  {
    key: 'weanling',
    label: 'Weanling',
    weeksRange: '4–26 wk',
    icon: '🐴',
    description: 'Socialisation and desensitisation',
  },
  {
    key: 'yearling',
    label: 'Yearling',
    weeksRange: '26–52 wk',
    icon: '🐎',
    description: 'Ground work and confidence building',
  },
  {
    key: 'two_year_old',
    label: '2-Year-Old',
    weeksRange: '52–104 wk',
    icon: '🏇',
    description: 'First tack and foundation training',
  },
];

const STAGE_ORDER: AgeStage[] = ['newborn', 'weanling', 'yearling', 'two_year_old'];

const BOND_MILESTONES = [25, 50, 75, 100] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeAgeStage(dateOfBirth: string): AgeStage | null {
  const nowMs = Date.now() - new Date(dateOfBirth).getTime();
  const weeks = nowMs / (1000 * 60 * 60 * 24 * 7);
  if (weeks < 4) return 'newborn';
  if (weeks < 26) return 'weanling';
  if (weeks < 52) return 'yearling';
  if (weeks < 104) return 'two_year_old';
  return null; // past the last stage
}

function stageIndex(stage: AgeStage | null): number {
  if (!stage) return 4;
  return STAGE_ORDER.indexOf(stage);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// ── Desktop: horizontal timeline ───────────────────────────────────────────────

function DesktopTimeline({
  currentStage,
  bondScore,
  completedMilestones,
}: {
  currentStage: AgeStage | null;
  bondScore: number;
  completedMilestones: CompletedMilestones;
}) {
  const currentIdx = stageIndex(currentStage);

  return (
    <div className="hidden sm:block space-y-6">
      {/* Stage timeline */}
      <div className="relative">
        {/* Connector line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-[var(--celestial-navy-700)]" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-primary)] transition-all duration-500"
          style={{
            width:
              currentIdx >= 4
                ? '100%'
                : currentIdx === 0
                  ? '0%'
                  : `${(currentIdx / (STAGES.length - 1)) * 100}%`,
          }}
        />

        <div className="relative flex justify-between">
          {STAGES.map((stage, idx) => {
            const isPast = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const isFuture = idx > currentIdx;

            return (
              <div key={stage.key} className="flex flex-col items-center gap-2 w-1/4">
                {/* Node */}
                <div
                  className={[
                    'relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-lg border-2 transition-all',
                    isCurrent
                      ? 'border-[var(--gold-primary)] bg-[var(--alpha-gold-ember-15)] shadow-[0_0_12px_var(--alpha-gold-ember-40)]'
                      : isPast
                        ? 'border-[var(--gold-700)] bg-[var(--alpha-gold-primary-8)]'
                        : 'border-[var(--celestial-navy-600)] bg-[var(--bg-midnight)]',
                  ].join(' ')}
                >
                  {stage.icon}
                </div>
                {/* Label */}
                <div className="text-center px-1">
                  <p
                    className={[
                      'text-xs font-semibold font-[var(--font-body)]',
                      isCurrent
                        ? 'text-[var(--gold-primary)]'
                        : isPast
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--text-muted)]',
                    ].join(' ')}
                  >
                    {stage.label}
                  </p>
                  <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{stage.weeksRange}</p>
                  {isPast && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-400 mt-0.5">
                      <Star className="h-2.5 w-2.5" /> Complete
                    </span>
                  )}
                  {isFuture && (
                    <span className="text-[9px] text-[var(--text-muted)] mt-0.5 block">
                      Upcoming
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bond score + milestones */}
      <BondScoreBar bondScore={bondScore} completedMilestones={completedMilestones} />
    </div>
  );
}

// ── Mobile: single-stage card with prev/next ────────────────────────────────────

function MobileCard({
  currentStage,
  bondScore,
  completedMilestones,
}: {
  currentStage: AgeStage | null;
  bondScore: number;
  completedMilestones: CompletedMilestones;
}) {
  const currentIdx = stageIndex(currentStage);
  const [viewIdx, setViewIdx] = useState(Math.min(currentIdx, STAGES.length - 1));

  const viewStage = STAGES[viewIdx];
  const isCurrentView = viewIdx === currentIdx;
  const isPast = viewIdx < currentIdx;

  return (
    <div className="sm:hidden space-y-4">
      {/* Card header with nav */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous stage"
          onClick={() => setViewIdx((v) => Math.max(0, v - 1))}
          disabled={viewIdx === 0}
          className="p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <span className="text-2xl">{viewStage.icon}</span>
          <p
            className={[
              'text-sm font-bold font-[var(--font-heading)] mt-1',
              isCurrentView
                ? 'text-[var(--gold-primary)]'
                : isPast
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)]',
            ].join(' ')}
          >
            {viewStage.label}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] font-[var(--font-body)]">
            {viewStage.weeksRange}
          </p>
          {isCurrentView && (
            <span className="inline-block mt-1 rounded-full px-2 py-0.5 text-[9px] font-bold bg-[var(--alpha-gold-ember-15)] text-[var(--gold-primary)]">
              Current Stage
            </span>
          )}
          {isPast && (
            <span className="inline-flex items-center gap-0.5 mt-1 text-[9px] text-emerald-400">
              <Star className="h-2.5 w-2.5" /> Completed
            </span>
          )}
        </div>

        <button
          type="button"
          aria-label="Next stage"
          onClick={() => setViewIdx((v) => Math.min(STAGES.length - 1, v + 1))}
          disabled={viewIdx === STAGES.length - 1}
          className="p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Dot indicator */}
      <div className="flex justify-center gap-1.5">
        {STAGES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to stage ${i + 1}`}
            onClick={() => setViewIdx(i)}
            className={[
              'h-1.5 rounded-full transition-all',
              i === viewIdx
                ? 'w-4 bg-[var(--gold-primary)]'
                : 'w-1.5 bg-[var(--celestial-navy-600)]',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Bond score */}
      <BondScoreBar bondScore={bondScore} completedMilestones={completedMilestones} />
    </div>
  );
}

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
        <span className="text-sm font-bold text-[var(--gold-primary)] font-[var(--font-heading)] tabular-nums">
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
  dateOfBirth,
  bondScore = 0,
  completedMilestones = {},
  lastInteractionAt,
  className = '',
}: DevelopmentTrackerProps) {
  const currentStage = computeAgeStage(dateOfBirth);
  const currentIdx = stageIndex(currentStage);

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
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {foalName}
            </p>
          </div>
          {currentStage && (
            <div className="ml-auto">
              <span className="rounded-full px-2 py-1 text-[10px] font-bold bg-[var(--alpha-gold-primary-12)] text-[var(--gold-primary)] border border-[var(--alpha-gold-ember-20)]">
                Stage {currentIdx + 1} / {STAGES.length}
              </span>
            </div>
          )}
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
        {/* Desktop timeline */}
        <DesktopTimeline
          currentStage={currentStage}
          bondScore={bondScore}
          completedMilestones={completedMilestones}
        />

        {/* Mobile card */}
        <MobileCard
          currentStage={currentStage}
          bondScore={bondScore}
          completedMilestones={completedMilestones}
        />
      </div>
    </div>
  );
}

export default DevelopmentTracker;
