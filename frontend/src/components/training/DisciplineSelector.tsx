/**
 * DisciplineSelector (Epic 26-1 rebuild)
 *
 * Celestial Night styled discipline picker for the training flow.
 * Features:
 *  - Top 5 recommended disciplines (from server aptitude scores or static popular defaults)
 *  - Expandable full list of all 23 disciplines
 *  - Stat impact preview per discipline (primary/secondary/tertiary stats + predicted gain range)
 *  - Backward compatible: same selectedDiscipline / onDisciplineChange interface
 *
 * Props:
 *  - selectedDiscipline: currently selected discipline string
 *  - onDisciplineChange: callback(discipline: string)
 *  - recommendedDisciplines?: ordered list of recommended discipline names (top shown first)
 *  - description?: helper text
 */

import React from 'react';
import { Zap, Lock } from 'lucide-react';

// ── Discipline stat map (mirrors backend/utils/statMap.mjs) ───────────────────

export const DISCIPLINE_STAT_MAP: Record<string, [string, string, string]> = {
  'Western Pleasure': ['obedience', 'focus', 'precision'],
  Reining: ['precision', 'agility', 'focus'],
  Cutting: ['agility', 'intelligence', 'strength'],
  'Barrel Racing': ['speed', 'agility', 'stamina'],
  Roping: ['strength', 'precision', 'focus'],
  'Team Penning': ['intelligence', 'agility', 'obedience'],
  Rodeo: ['strength', 'agility', 'endurance'],
  Hunter: ['precision', 'endurance', 'agility'],
  Saddleseat: ['flexibility', 'obedience', 'precision'],
  Endurance: ['endurance', 'stamina', 'speed'],
  Eventing: ['endurance', 'precision', 'agility'],
  Dressage: ['precision', 'obedience', 'focus'],
  'Show Jumping': ['agility', 'precision', 'intelligence'],
  Vaulting: ['strength', 'flexibility', 'endurance'],
  Polo: ['speed', 'agility', 'intelligence'],
  'Cross Country': ['endurance', 'intelligence', 'agility'],
  'Combined Driving': ['obedience', 'strength', 'focus'],
  'Fine Harness': ['precision', 'flexibility', 'obedience'],
  Gaited: ['flexibility', 'obedience', 'focus'],
  Gymkhana: ['speed', 'flexibility', 'stamina'],
  Steeplechase: ['speed', 'endurance', 'stamina'],
  Racing: ['speed', 'stamina', 'intelligence'],
  'Harness Racing': ['speed', 'precision', 'stamina'],
};

export const ALL_DISCIPLINES = Object.keys(DISCIPLINE_STAT_MAP).sort();

const DEFAULT_RECOMMENDED = ['Dressage', 'Show Jumping', 'Barrel Racing', 'Racing', 'Endurance'];

// ── Gain range estimates (points per session per weight tier) ─────────────────

const GAIN_RANGE = {
  primary: { min: 4, max: 9 },
  secondary: { min: 2, max: 5 },
  tertiary: { min: 1, max: 3 },
};

// ── Stat display label ────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Stat impact pill ─────────────────────────────────────────────────────────

function StatPill({ stat, tier }: { stat: string; tier: 'primary' | 'secondary' | 'tertiary' }) {
  const range = GAIN_RANGE[tier];
  const colorClass =
    tier === 'primary'
      ? 'bg-[rgba(201,162,39,0.15)] border-[rgba(201,162,39,0.4)] text-[var(--gold-primary)]'
      : tier === 'secondary'
        ? 'bg-[rgba(200,168,78,0.1)] border-[rgba(200,168,78,0.25)] text-[var(--gold-dim)]'
        : 'bg-[rgba(100,130,165,0.12)] border-[rgba(100,130,165,0.25)] text-[var(--text-muted)]';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colorClass} font-[var(--font-body)] whitespace-nowrap`}
      title={`${capitalize(stat)}: +${range.min}–${range.max} pts/session`}
    >
      {capitalize(stat)}
      <span className="opacity-70">
        +{range.min}–{range.max}
      </span>
    </span>
  );
}

// ── Discipline option button ──────────────────────────────────────────────────

function DisciplineOption({
  discipline,
  isSelected,
  isRecommended,
  matchScore,
  isIneligible,
  ineligibleReason,
  onSelect,
}: {
  discipline: string;
  isSelected: boolean;
  isRecommended: boolean;
  matchScore?: number;
  isIneligible?: boolean;
  ineligibleReason?: string;
  onSelect: () => void;
}) {
  const stats = DISCIPLINE_STAT_MAP[discipline];

  return (
    <button
      type="button"
      onClick={isIneligible ? undefined : onSelect}
      aria-pressed={isSelected}
      aria-disabled={isIneligible}
      title={isIneligible ? ineligibleReason : undefined}
      className={[
        'w-full text-left rounded-xl border p-3 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-night-sky)]',
        isIneligible
          ? 'border-[rgba(100,130,165,0.1)] bg-[rgba(10,22,50,0.2)] opacity-50 cursor-not-allowed'
          : isSelected
            ? 'border-[var(--gold-primary)] bg-[rgba(201,162,39,0.1)] shadow-[0_0_12px_rgba(201,162,39,0.15)]'
            : 'border-[rgba(100,130,165,0.2)] bg-[rgba(10,22,50,0.4)] hover:border-[rgba(201,162,39,0.35)] hover:bg-[rgba(10,22,50,0.65)]',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-sm font-semibold font-[var(--font-heading)] ${isIneligible ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}
        >
          {isIneligible && (
            <Lock className="w-3 h-3 inline-block mr-1 -mt-0.5" aria-hidden="true" />
          )}
          {discipline}
        </span>
        <div className="flex items-center gap-1.5">
          {matchScore !== undefined && (
            <span
              className={[
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full border font-[var(--font-body)]',
                matchScore >= 80
                  ? 'text-emerald-400 bg-[rgba(16,185,129,0.12)] border-[rgba(16,185,129,0.3)]'
                  : matchScore >= 50
                    ? 'text-[var(--gold-primary)] bg-[rgba(201,162,39,0.12)] border-[rgba(201,162,39,0.25)]'
                    : 'text-[var(--text-muted)] bg-[rgba(100,130,165,0.1)] border-[rgba(100,130,165,0.2)]',
              ].join(' ')}
            >
              {matchScore}%
            </span>
          )}
          {isRecommended && (
            <span className="flex items-center gap-0.5 text-[9px] uppercase tracking-widest text-[var(--gold-primary)] bg-[rgba(201,162,39,0.12)] border border-[rgba(201,162,39,0.25)] px-1.5 py-0.5 rounded-full">
              <Zap className="w-2.5 h-2.5" aria-hidden="true" />
              Rec.
            </span>
          )}
        </div>
      </div>
      {isIneligible && ineligibleReason && (
        <p className="text-[10px] text-red-400/70 mb-1.5 font-[var(--font-body)]">
          {ineligibleReason}
        </p>
      )}
      {stats && (
        <div className="flex flex-wrap gap-1">
          <StatPill stat={stats[0]} tier="primary" />
          <StatPill stat={stats[1]} tier="secondary" />
          <StatPill stat={stats[2]} tier="tertiary" />
        </div>
      )}
    </button>
  );
}

// ── Main DisciplineSelector ───────────────────────────────────────────────────

interface DisciplineSelectorProps {
  selectedDiscipline: string;
  onDisciplineChange: (_discipline: string) => void;
  /** Ordered list of recommended disciplines for this horse. Defaults to popular 5. */
  recommendedDisciplines?: string[];
  disciplines?: string[];
  description?: string;
  /** Match score percentages keyed by discipline name (e.g. { "Dressage": 92 }) */
  matchScores?: Record<string, number>;
  /** Disciplines the horse is ineligible for, with reason strings */
  ineligibleDisciplines?: Record<string, string>;
}

const DisciplineSelector: React.FC<DisciplineSelectorProps> = ({
  selectedDiscipline,
  onDisciplineChange,
  recommendedDisciplines = DEFAULT_RECOMMENDED,
  disciplines = ALL_DISCIPLINES,
  description,
  matchScores,
  ineligibleDisciplines,
}) => {
  // Top 5 recommended (validated against known list)
  const top5 = recommendedDisciplines.filter((d) => disciplines.includes(d)).slice(0, 5);

  // Remaining disciplines not in top 5
  const rest = disciplines.filter((d) => !top5.includes(d)).sort();

  return (
    <div data-testid="discipline-selector">
      {/* Label */}
      <div className="mb-3">
        <label className="text-xs text-[var(--text-muted)] font-[var(--font-body)] uppercase tracking-widest">
          Discipline
        </label>
        {description && (
          <p className="mt-0.5 text-xs text-[var(--text-muted)] font-[var(--font-body)]">
            {description}
          </p>
        )}
      </div>

      {/* Recommended section */}
      {top5.length > 0 && (
        <div className="mb-3">
          <p className="text-[9px] uppercase tracking-widest text-[var(--gold-primary)]/70 font-[var(--font-body)] mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3" aria-hidden="true" />
            Recommended for this horse
          </p>
          <div className="space-y-2">
            {top5.map((d) => (
              <DisciplineOption
                key={d}
                discipline={d}
                isSelected={selectedDiscipline === d}
                isRecommended
                matchScore={matchScores?.[d]}
                isIneligible={!!ineligibleDisciplines?.[d]}
                ineligibleReason={ineligibleDisciplines?.[d]}
                onSelect={() => onDisciplineChange(d)}
              />
            ))}
          </div>
        </div>
      )}

      {/* All remaining disciplines — always visible */}
      {rest.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto scroll-area-celestial pr-1">
          {rest.map((d) => (
            <DisciplineOption
              key={d}
              discipline={d}
              isSelected={selectedDiscipline === d}
              isRecommended={false}
              matchScore={matchScores?.[d]}
              isIneligible={!!ineligibleDisciplines?.[d]}
              ineligibleReason={ineligibleDisciplines?.[d]}
              onSelect={() => onDisciplineChange(d)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DisciplineSelector;
