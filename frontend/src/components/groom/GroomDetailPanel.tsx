/**
 * GroomDetailPanel Component (Equoria-cbkw)
 *
 * Renders the previously-captured-but-never-surfaced groom data:
 *  - GroomMetrics: the 7 score fields (bondingEffectiveness, taskCompletion,
 *    horseWellbeing, showPerformance, consistency, playerSatisfaction,
 *    reputationScore) plus totalInteractions, aggregated on every
 *    performance-record write by the backend.
 *  - GroomAssignmentLog: past-assignment history (milestonesCompleted,
 *    traitsShaped chips, xpGained) written on each unassign.
 *
 * Data sources (Equoria-wb7z backend half):
 *  - GET /api/v1/grooms/:id/profile          → metrics
 *  - GET /api/v1/grooms/:id/assignment-logs  → assignment history
 *
 * The panel is lazy: hooks are only enabled when `enabled` is true, so a
 * dashboard with N grooms does not fire 2N requests until a panel is opened.
 */

import React from 'react';
import { formatDate } from '@/lib/formatDate';
import { TrendingUp, History, Award } from 'lucide-react';
import {
  useGroomProfile,
  useGroomAssignmentLogs,
  useGroomTalents,
  useSelectTalent,
} from '../../hooks/api/useGrooms';
import GroomTalentTree from './GroomTalentTree';
import type { GroomTalentData } from '../../types/groomTalent';

interface GroomDetailPanelProps {
  groomId: number;
  /**
   * Equoria-oey96.6 — the groom's name / level / personality, needed to render
   * the talent tree: tier gating is level-based and the tree keys its talents
   * by personality. Sourced from the already-loaded groom LIST row in the
   * dashboard, so the tree renders without waiting on a second profile fetch.
   */
  groomName: string;
  groomLevel: number;
  groomPersonality: string;
  /** Only fetch when the panel is actually expanded. */
  enabled: boolean;
}

const SCORE_FIELDS: { key: string; label: string }[] = [
  { key: 'bondingEffectiveness', label: 'Bonding' },
  { key: 'taskCompletion', label: 'Task Completion' },
  { key: 'horseWellbeing', label: 'Horse Wellbeing' },
  { key: 'showPerformance', label: 'Show Performance' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'playerSatisfaction', label: 'Player Satisfaction' },
  { key: 'reputationScore', label: 'Reputation' },
];

function scoreColor(value: number): string {
  if (value >= 70) return 'text-emerald-400';
  if (value >= 40) return 'text-amber-400';
  return 'text-red-400';
}

const GroomDetailPanel: React.FC<GroomDetailPanelProps> = ({
  groomId,
  groomName,
  groomLevel,
  groomPersonality,
  enabled,
}) => {
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useGroomProfile(groomId, { enabled });
  const {
    data: logs,
    isLoading: logsLoading,
    error: logsError,
  } = useGroomAssignmentLogs(groomId, { enabled });
  // Equoria-oey96.6 — talent-tree read + write. Selections come from the real
  // backend (source of truth); the mutation is permanent (no respec).
  const {
    data: talents,
    isLoading: talentsLoading,
    error: talentsError,
  } = useGroomTalents(groomId, { enabled });
  const selectTalent = useSelectTalent();

  const metrics = profile?.metrics ?? null;

  // Equoria-oey96.6 — map the list-row groom fields + backend selections into
  // the shape GroomTalentTree consumes. `talentSelections: null` is the honest
  // empty state (no talents chosen yet), NOT a placeholder.
  const talentData: GroomTalentData = {
    id: groomId,
    name: groomName,
    level: groomLevel,
    groomPersonality,
    talentSelections: talents ?? null,
  };

  return (
    <div
      className="mt-3 rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.5)] p-4 space-y-5"
      data-testid={`groom-detail-panel-${groomId}`}
      aria-label={`Performance metrics and assignment history for groom ${groomId}`}
    >
      {/* ---- Performance metrics ---- */}
      <section data-testid={`groom-metrics-section-${groomId}`}>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" aria-hidden="true" />
          Performance Metrics
        </h4>

        {profileLoading && (
          <p
            className="text-xs text-slate-400 italic"
            data-testid={`groom-metrics-loading-${groomId}`}
          >
            Loading metrics…
          </p>
        )}

        {!profileLoading && profileError && (
          <p className="text-xs text-red-400" data-testid={`groom-metrics-error-${groomId}`}>
            Could not load performance metrics.
          </p>
        )}

        {!profileLoading && !profileError && !metrics && (
          <p
            className="text-xs text-slate-400 italic"
            data-testid={`groom-metrics-empty-${groomId}`}
          >
            No metrics recorded yet — they accumulate as this groom completes interactions.
          </p>
        )}

        {!profileLoading && !profileError && metrics && (
          <div className="grid grid-cols-2 gap-2" data-testid={`groom-metrics-grid-${groomId}`}>
            {SCORE_FIELDS.map((f) => {
              const value = (metrics as unknown as Record<string, number>)[f.key] ?? 0;
              return (
                <div
                  key={f.key}
                  className="flex items-center justify-between bg-[rgba(15,35,70,0.4)] rounded px-3 py-2 border border-[rgba(37,99,235,0.3)]"
                >
                  <span className="text-xs text-slate-400">{f.label}</span>
                  <span
                    className={`text-sm font-semibold ${scoreColor(value)}`}
                    data-testid={`groom-metric-${f.key}-${groomId}`}
                  >
                    {value}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center justify-between bg-[rgba(15,35,70,0.4)] rounded px-3 py-2 border border-[rgba(37,99,235,0.3)]">
              <span className="text-xs text-slate-400">Interactions</span>
              <span
                className="text-sm font-semibold text-[rgb(220,235,255)]"
                data-testid={`groom-metric-totalInteractions-${groomId}`}
              >
                {metrics.totalInteractions}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ---- Assignment history ---- */}
      <section data-testid={`groom-assignment-log-section-${groomId}`}>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1">
          <History className="w-3 h-3" aria-hidden="true" />
          Assignment History
        </h4>

        {logsLoading && (
          <p
            className="text-xs text-slate-400 italic"
            data-testid={`groom-logs-loading-${groomId}`}
          >
            Loading assignment history…
          </p>
        )}

        {!logsLoading && logsError && (
          <p className="text-xs text-red-400" data-testid={`groom-logs-error-${groomId}`}>
            Could not load assignment history.
          </p>
        )}

        {!logsLoading && !logsError && (logs?.length ?? 0) === 0 && (
          <p className="text-xs text-slate-400 italic" data-testid={`groom-logs-empty-${groomId}`}>
            No past assignments recorded for this groom yet.
          </p>
        )}

        {!logsLoading && !logsError && (logs?.length ?? 0) > 0 && (
          <ul className="space-y-2" data-testid={`groom-logs-list-${groomId}`}>
            {logs!.map((log) => (
              <li
                key={log.id}
                className="rounded-lg p-3 border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)]"
                data-testid={`groom-log-${log.id}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-[rgb(220,235,255)]">
                    {log.horse?.name ?? `Horse #${log.horseId}`}
                  </span>
                  <span className="text-[10px] text-[rgb(100,130,165)]">
                    {/* Equoria-2dnd2: shared util (guard + canonical format). */}
                    {formatDate(log.assignedAt)}
                    {log.unassignedAt ? ` → ${formatDate(log.unassignedAt)}` : ' → active'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                  <span data-testid={`groom-log-milestones-${log.id}`}>
                    Milestones: {log.milestonesCompleted}
                  </span>
                  <span data-testid={`groom-log-xp-${log.id}`}>XP gained: {log.xpGained}</span>
                </div>
                {log.traitsShaped.length > 0 && (
                  <div
                    className="flex flex-wrap gap-1 mt-2"
                    data-testid={`groom-log-traits-${log.id}`}
                  >
                    {log.traitsShaped.map((trait) => (
                      <span
                        key={trait}
                        className="px-2 py-0.5 text-[10px] rounded-full bg-[rgba(16,185,129,0.12)] text-[rgb(16,185,129)] border border-[rgba(16,185,129,0.25)]"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Talent tree (Equoria-oey96.6) ---- */}
      <section data-testid={`groom-talents-section-${groomId}`}>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1">
          <Award className="w-3 h-3" aria-hidden="true" />
          Talents
        </h4>

        {talentsLoading && (
          <p
            className="text-xs text-slate-400 italic"
            data-testid={`groom-talents-loading-${groomId}`}
          >
            Loading talents…
          </p>
        )}

        {!talentsLoading && talentsError && (
          <p className="text-xs text-red-400" data-testid={`groom-talents-error-${groomId}`}>
            Could not load talents.
          </p>
        )}

        {!talentsLoading && !talentsError && (
          <>
            {/* AC5 — a rejected selection (e.g. locked tier) surfaces the real
                backend message here; it is never silently swallowed. */}
            {selectTalent.isError && (
              <p
                className="text-xs text-red-400 mb-2"
                role="alert"
                data-testid={`groom-talent-select-error-${groomId}`}
              >
                {selectTalent.error?.message ?? 'Could not select talent.'}
              </p>
            )}
            <GroomTalentTree
              groom={talentData}
              onSelectTalent={(tier, talentId) => selectTalent.mutate({ groomId, tier, talentId })}
              isSaving={selectTalent.isPending}
            />
          </>
        )}
      </section>
    </div>
  );
};

export default GroomDetailPanel;
