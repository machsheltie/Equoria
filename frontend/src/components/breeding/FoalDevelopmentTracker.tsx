/**
 * FoalDevelopmentTracker (Epic 29-2 — Celestial Night restyle) — CONTAINER
 *
 * Full foal development interface:
 *  - DevelopmentTracker (age-stage timeline + bond score)
 *  - Discovered traits
 *  - Activity log
 *
 * No player-run enrichment, stage activities or graduation (Equoria-fr2kg;
 * owner ruling 2026-10-14/15: foal enrichment is the groom's job, and there
 * is no graduation). No "Reveal Traits" button either (Equoria-gu8jk; owner
 * ruling 2026-10-20: players never reveal traits — grooms will). With it went
 * the reveal CinematicMoment and reward toast it drove, and the actions row it
 * was the last control in.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * RELATIONSHIP TO foal/DevelopmentTracker.tsx (Equoria-rpnq4)
 *
 * Two intentionally separate components, NOT a duplicate:
 *
 *  - THIS file (breeding/FoalDevelopmentTracker): the CONTAINER /
 *    orchestrator. Owns all the API hooks (useFoal, useFoalDevelopment,
 *    useFoalActivities) and the activity log. This is the
 *    component wired into FoalDetailPage.
 *
 *  - foal/DevelopmentTracker: the dumb PRESENTATIONAL "view" it renders —
 *    pure timeline/bond-bar UI with no data fetching.
 *
 * If you need data/mutations → you are in the right file (edit here).
 * If you need to change the timeline/bond-bar LAYOUT → edit
 * foal/DevelopmentTracker instead. Do NOT merge them without a unified
 * UX spec agreed up-front.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { formatDate } from '@/lib/formatDate';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useFoal, useFoalActivities, useFoalDevelopment } from '@/hooks/api/useBreeding';
import DevelopmentTracker from '@/components/foal/DevelopmentTracker';

interface FoalDevelopmentTrackerProps {
  foalId: number;
}

const FoalDevelopmentTracker = ({ foalId }: FoalDevelopmentTrackerProps) => {
  const { data: foal, isLoading: loadingFoal } = useFoal(foalId);
  const { data: development, isLoading: loadingDev, error: devError } = useFoalDevelopment(foalId);
  const { data: activities } = useFoalActivities(foalId);

  const [showLog, setShowLog] = useState(false);

  const isLoading = loadingFoal || loadingDev;

  return (
    <>
      <div className="space-y-4">
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 py-4 text-sm text-[var(--text-muted)] font-[var(--font-body)]">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold-400)] border-r-transparent" />
            Loading foal details…
          </div>
        )}

        {/* Error */}
        {devError && (
          <div className="glass-panel rounded-xl border border-[var(--role-danger-border)] px-4 py-3 text-sm text-[var(--role-danger-text)] font-[var(--font-body)]">
            {devError.message}
          </div>
        )}

        {/* DevelopmentTracker — shows stage timeline + bond score */}
        {foal && (
          <DevelopmentTracker
            foalName={foal.name ?? `Foal #${foalId}`}
            dateOfBirth={foal.dateOfBirth ?? foal.birthDate ?? new Date().toISOString()}
            bondScore={development?.bondingLevel ?? 0}
            completedMilestones={{}}
            lastInteractionAt={undefined}
          />
        )}

        {/* Development stats — Equoria-n3yw6: these are the REAL backend
            fields (data.development.*), normalized flat by the api-client.
            No fabricated stage/progress/enrichmentLevel placeholders. */}
        {development && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Day', value: `${development.currentDay} / ${development.maxDay}` },
              { label: 'Bonding', value: development.bondingLevel },
              { label: 'Stress', value: development.stressLevel },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="glass-panel rounded-xl border border-[rgba(100,130,165,0.12)] px-3 py-2.5"
              >
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-[var(--font-body)]">
                  {label}
                </p>
                <p className="text-sm font-bold text-[var(--cream)] font-[var(--font-heading)] mt-0.5 capitalize">
                  {String(value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* No foal actions: no "Advance Day" (Equoria-mwjst; owner ruling
            2026-10-05 — the nightly job moves the day, never the player) and
            no "Reveal Traits" (Equoria-gu8jk; owner ruling 2026-10-20 —
            players never reveal traits). */}

        {/* Traits display */}
        {foal?.traits && foal.traits.length > 0 && (
          <div className="glass-panel rounded-xl border border-[rgba(100,130,165,0.15)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-[var(--font-body)] mb-2">
              Discovered Traits
            </p>
            <div className="flex flex-wrap gap-1.5">
              {foal.traits.map((trait, i) => (
                <span
                  key={i}
                  className="rounded-full px-2 py-0.5 text-xs bg-[var(--alpha-gold-primary-10)] border border-[var(--alpha-gold-ember-20)] text-[var(--gold-400)] font-[var(--font-body)]"
                >
                  {String(trait)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Activity log — collapsible */}
        {activities && activities.length > 0 && (
          <div className="glass-panel rounded-xl border border-[rgba(100,130,165,0.12)] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowLog((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--alpha-gold-primary-3)] transition-colors"
            >
              <span className="text-xs font-semibold text-[var(--text-muted)] font-[var(--font-body)] uppercase tracking-wider">
                Activity Log ({activities.length})
              </span>
              {showLog ? (
                <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
              )}
            </button>
            {showLog && (
              <div className="border-t border-[rgba(100,130,165,0.1)] px-4 pb-3 space-y-2 max-h-48 overflow-y-auto">
                {activities.map((activity) => (
                  <div
                    key={`${activity.activity}-${activity.createdAt ?? activity.id ?? 'pending'}`}
                    className="flex items-center justify-between py-2 border-b border-[rgba(100,130,165,0.08)] last:border-0"
                  >
                    <span className="text-xs text-[var(--cream)] font-[var(--font-body)] capitalize">
                      {activity.activity}
                    </span>
                    <div className="flex items-center gap-3">
                      {activity.duration && (
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {activity.duration} min
                        </span>
                      )}
                      {activity.createdAt && (
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {/* Equoria-2dnd2: shared util (guard + canonical format, was bare toLocaleDateString). */}
                          {formatDate(activity.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default FoalDevelopmentTracker;
