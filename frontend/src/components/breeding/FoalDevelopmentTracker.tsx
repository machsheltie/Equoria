/**
 * FoalDevelopmentTracker (Epic 29-2 — Celestial Night restyle)
 *
 * Full foal development interface:
 *  - DevelopmentTracker (age-stage timeline + bond score)
 *  - Age-stage-grouped activity selection (out-of-stage activities disabled)
 *  - Trait reveal with CinematicMoment (lifetime-first; Story 18-4 / Epic 29-3)
 *  - Activity log
 */

import { useState, useEffect } from 'react';
import { Sparkles, Dna, ChevronDown, ChevronUp, GraduationCap } from 'lucide-react';
import {
  useDevelopFoal,
  useEnrichFoal,
  useFoal,
  useFoalActivities,
  useFoalDevelopment,
  useGraduateFoal,
  useLogFoalActivity,
  useRevealFoalTraits,
} from '@/hooks/api/useBreeding';
import CinematicMoment from '@/components/feedback/CinematicMoment';
import DevelopmentTracker from '@/components/foal/DevelopmentTracker';
import type { Activity } from '@/components/foal/DevelopmentTracker';

interface FoalDevelopmentTrackerProps {
  foalId: number;
}

const FoalDevelopmentTracker = ({ foalId }: FoalDevelopmentTrackerProps) => {
  const { data: foal, isLoading: loadingFoal } = useFoal(foalId);
  const { data: development, isLoading: loadingDev, error: devError } = useFoalDevelopment(foalId);
  const { data: activities } = useFoalActivities(foalId);

  const logActivity = useLogFoalActivity(foalId);
  const enrichFoal = useEnrichFoal(foalId);
  const revealTraits = useRevealFoalTraits(foalId);
  const developFoal = useDevelopFoal(foalId);
  const graduateFoal = useGraduateFoal(foalId);

  const [showLog, setShowLog] = useState(false);
  const [showTraitCinematic, setShowTraitCinematic] = useState(false);
  const [showGraduationCinematic, setShowGraduationCinematic] = useState(false);
  const [pendingActivity, setPendingActivity] = useState<Activity | null>(null);

  // Compute whether the foal is eligible for graduation (age >= 104 weeks)
  const dateOfBirth = foal?.dateOfBirth ?? foal?.birthDate;
  const ageInWeeks = dateOfBirth
    ? Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 7))
    : 0;
  const isGraduationEligible = ageInWeeks >= 104;

  // Cinematic on trait reveal (Story 18-4 / Epic 29-3)
  useEffect(() => {
    if (revealTraits.isSuccess) {
      setShowTraitCinematic(true);
    }
  }, [revealTraits.isSuccess]);

  // Cinematic on graduation (BB-4)
  useEffect(() => {
    if (graduateFoal.isSuccess && graduateFoal.data?.graduation?.isFirstGraduation) {
      setShowGraduationCinematic(true);
    }
  }, [graduateFoal.isSuccess, graduateFoal.data]);

  // Handle activity selection from DevelopmentTracker
  const handleActivitySelect = (activity: Activity) => {
    setPendingActivity(activity);
  };

  const handleConfirmActivity = () => {
    if (!pendingActivity) return;
    logActivity.mutate({ activity: pendingActivity.id, duration: pendingActivity.cooldownHours });
    setPendingActivity(null);
  };

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
          <div className="glass-panel rounded-xl border border-red-500/30 px-4 py-3 text-sm text-red-400 font-[var(--font-body)]">
            {devError.message}
          </div>
        )}

        {/* DevelopmentTracker — shows stage timeline + bond score + activities */}
        {foal && (
          <DevelopmentTracker
            foalName={foal.name ?? `Foal #${foalId}`}
            dateOfBirth={foal.dateOfBirth ?? foal.birthDate ?? new Date().toISOString()}
            bondScore={development?.bonding ?? 0}
            completedMilestones={{}}
            lastInteractionAt={undefined}
            onActivitySelect={handleActivitySelect}
          />
        )}

        {/* Pending activity confirmation */}
        {pendingActivity && (
          <div className="glass-panel rounded-2xl border border-[rgba(201,162,39,0.2)] px-4 py-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-[var(--font-body)]">
              Confirm Activity
            </p>
            <p className="text-sm font-semibold text-[var(--cream)] font-[var(--font-body)]">
              {pendingActivity.label}
            </p>
            <p className="text-xs text-[var(--text-muted)] font-[var(--font-body)]">
              {pendingActivity.description}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmActivity}
                disabled={logActivity.isPending}
                className="flex-1 rounded-full py-2 text-xs font-bold bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-400)] text-[var(--celestial-navy-900)] disabled:opacity-40 font-[var(--font-heading)]"
              >
                {logActivity.isPending ? 'Logging…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setPendingActivity(null)}
                className="flex-1 rounded-full py-2 text-xs font-bold border border-[rgba(100,130,165,0.25)] text-[var(--text-muted)] hover:text-[var(--cream)] font-[var(--font-body)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Development stats */}
        {development && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Stage', value: development.stage ?? '—' },
              { label: 'Progress', value: `${development.progress ?? 0}%` },
              { label: 'Stress', value: development.stress ?? 0 },
              { label: 'Enrichment', value: development.enrichmentLevel ?? 0 },
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

        {/* Actions row */}
        <div className="flex flex-wrap gap-2">
          {/* Reveal traits */}
          <button
            type="button"
            onClick={() => revealTraits.mutate()}
            disabled={revealTraits.isPending}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.25)] text-blue-400 hover:bg-[rgba(59,130,246,0.2)] disabled:opacity-40 transition-colors font-[var(--font-body)]"
          >
            <Dna className="h-3.5 w-3.5" />
            {revealTraits.isPending ? 'Revealing…' : 'Reveal Traits'}
          </button>

          {/* Enrich */}
          <button
            type="button"
            onClick={() => enrichFoal.mutate({ activity: 'enrichment', duration: 30 })}
            disabled={enrichFoal.isPending}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] text-emerald-400 hover:bg-[rgba(16,185,129,0.2)] disabled:opacity-40 transition-colors font-[var(--font-body)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {enrichFoal.isPending ? 'Enriching…' : 'Enrich'}
          </button>

          {/* Advance stage (dev helper) */}
          <button
            type="button"
            onClick={() => developFoal.mutate({ progress: (development?.progress ?? 0) + 5 })}
            disabled={developFoal.isPending}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold border border-[rgba(100,130,165,0.2)] text-[var(--text-muted)] hover:text-[var(--cream)] disabled:opacity-40 transition-colors font-[var(--font-body)]"
          >
            {developFoal.isPending ? 'Updating…' : 'Advance Stage'}
          </button>

          {/* Graduate — BB-4: visible only when foal is 3+ years old */}
          {isGraduationEligible && (
            <button
              type="button"
              onClick={() => graduateFoal.mutate()}
              disabled={graduateFoal.isPending || graduateFoal.isSuccess}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-400)] text-[var(--celestial-navy-900)] disabled:opacity-40 transition-colors font-[var(--font-heading)]"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              {graduateFoal.isPending
                ? 'Graduating…'
                : graduateFoal.isSuccess
                  ? 'Graduated!'
                  : 'Graduate to Adult'}
            </button>
          )}
        </div>

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
                  className="rounded-full px-2 py-0.5 text-xs bg-[rgba(201,162,39,0.1)] border border-[rgba(201,162,39,0.2)] text-[var(--gold-400)] font-[var(--font-body)]"
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
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[rgba(201,162,39,0.03)] transition-colors"
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
                          {new Date(activity.createdAt).toLocaleDateString()}
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

      {/* Cinematic trait reveal (Story 18-4 / Epic 29-3) */}
      {showTraitCinematic && (
        <CinematicMoment
          variant="trait-discovery"
          title="New Trait Discovered!"
          subtitle={
            foal?.traits && foal.traits.length > 0
              ? String(foal.traits[foal.traits.length - 1])
              : undefined
          }
          onDismiss={() => setShowTraitCinematic(false)}
        />
      )}

      {/* Cinematic graduation (BB-4 — lifetime-first only) */}
      {showGraduationCinematic && (
        <CinematicMoment
          variant="cup-win"
          title="Graduation Day!"
          subtitle={`${foal?.name ?? 'Your horse'} is now an adult — ready for training & competition!`}
          onDismiss={() => setShowGraduationCinematic(false)}
        />
      )}
    </>
  );
};

export default FoalDevelopmentTracker;
