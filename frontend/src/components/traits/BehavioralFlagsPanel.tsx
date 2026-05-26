/**
 * BehavioralFlagsPanel (Equoria-yzqhj.8)
 *
 * Surfaces a horse's PERMANENT BEHAVIORAL epigenetic flags (brave / confident /
 * fearful / ...) from the real /api/v1/flags/* backend, plus — for owned
 * foals/youngstock (< 3 game-years) — a care-pattern eligibility insight.
 *
 * ⚠️ NAMING TRAP: these behavioral flags are NOT the genetic-trait
 * acquisition-source tag (`EpigeneticFlag` in types/traits.ts, rendered by
 * EpigeneticFlagBadge). To keep the two concepts visually distinct, this panel
 * is explicitly titled "Behavioral Flags" with its own card style and never
 * reuses the genetic source-badge components.
 *
 * 21R doctrine: real API data only. No mock flag data. Honest loading / empty /
 * error states — never fabricated values.
 */

import React from 'react';
import { Loader2, AlertCircle, Brain } from 'lucide-react';
import {
  useHorseFlags,
  useHorseCarePatterns,
  type BehavioralFlag,
} from '../../hooks/useHorseFlags';

interface BehavioralFlagsPanelProps {
  horseId: number;
}

/** Map a flag valence to a badge style + label. */
function valenceBadge(type: BehavioralFlag['type']): { label: string; className: string } {
  switch (type) {
    case 'positive':
      return { label: 'Positive', className: 'bg-emerald-500/20 text-emerald-400' };
    case 'negative':
      return { label: 'Negative', className: 'bg-red-500/20 text-red-400' };
    case 'adaptive':
      return { label: 'Adaptive', className: 'bg-burnished-gold/20 text-burnished-gold' };
    default:
      return { label: 'Unknown', className: 'bg-[rgba(37,99,235,0.15)] text-slate-400' };
  }
}

const BehavioralFlagsPanel: React.FC<BehavioralFlagsPanelProps> = ({ horseId }) => {
  const { data: flagsData, isLoading: flagsLoading, error: flagsError } = useHorseFlags(horseId);

  // Care patterns are only meaningful for young horses; the backend returns
  // { eligible: false } for ≥3 game-years. We always issue the query (the hook
  // surfaces the real eligibility), but only render the insight when eligible.
  const { data: carePatterns } = useHorseCarePatterns(horseId);

  return (
    <div data-testid="behavioral-flags-panel">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-purple-400" aria-hidden="true" />
        <h3 className="fantasy-title text-xl text-[rgb(220,235,255)]">Behavioral Flags</h3>
      </div>
      <p className="text-sm text-[rgb(160,175,200)] mb-4">
        Permanent behavioral epigenetic flags shaped by this horse&apos;s early-life care and
        environment. Distinct from the genetic traits above.
      </p>

      {/* Loading */}
      {flagsLoading && (
        <div
          className="flex items-center gap-2 text-sm text-[rgb(160,175,200)]"
          data-testid="behavioral-flags-loading"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading behavioral flags…
        </div>
      )}

      {/* Error — honest message, no fabricated data */}
      {!flagsLoading && flagsError && (
        <div
          className="flex items-start gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-400"
          role="alert"
          data-testid="behavioral-flags-error"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{flagsError.message || 'Could not load behavioral flags.'}</span>
        </div>
      )}

      {/* Loaded */}
      {!flagsLoading && !flagsError && flagsData && (
        <>
          {/* Defensive: a well-formed backend response always includes a
              `flags` array, but guard so a partial payload can never crash the
              whole Genetics tab (treat missing as empty). */}
          {(flagsData.flags ?? []).length === 0 ? (
            <div
              className="text-sm text-[rgb(160,175,200)] py-4"
              data-testid="behavioral-flags-empty"
            >
              {flagsData.canReceiveMoreFlags
                ? 'No behavioral flags yet. Flags develop from care and environment during the first 3 years.'
                : 'No behavioral flags were recorded for this horse.'}
            </div>
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
              data-testid="behavioral-flags-list"
            >
              {(flagsData.flags ?? []).map((flag) => {
                const badge = valenceBadge(flag.type);
                return (
                  <div
                    key={flag.name}
                    data-testid="behavioral-flag-card"
                    className="p-4 bg-[rgba(15,35,70,0.4)] rounded-lg border border-[rgba(147,51,234,0.3)]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-[rgb(220,235,255)]">
                        {flag.displayName || flag.name}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badge.className}`}
                        data-testid="behavioral-flag-valence"
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-sm text-[rgb(160,175,200)]">{flag.description}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Care-pattern insight — only for eligible young horses (real backend
              eligibility, not a client-side age guess). */}
          {carePatterns?.eligible && (
            <div
              className="mt-4 p-3 rounded-lg border border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.08)]"
              data-testid="care-pattern-insight"
            >
              <p className="text-xs uppercase tracking-widest text-[rgb(160,175,200)] mb-1">
                Care-Pattern Insight
              </p>
              <p className="text-sm text-[rgb(220,235,255)]">
                This{' '}
                {carePatterns.ageInYears !== undefined
                  ? `${carePatterns.ageInYears}-year-old `
                  : ''}
                foal is still in the behavioral-flag development window. Consistent, varied, and
                low-stress care now shapes which permanent flags it develops.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BehavioralFlagsPanel;
