/**
 * Foal Detail Page
 *
 * Page rendered at /foals/:id. Loads the foal record + development
 * data via the existing useFoal / useFoalDevelopment hooks and displays
 * a summary card plus the full foal lifecycle UI (FoalDevelopmentTracker)
 * which exposes the 5 lifecycle primary actions:
 *   - Enrich (POST /api/foals/:foalId/enrich)
 *   - Reveal Traits (POST /api/foals/:foalId/reveal-traits)
 *   - Advance Stage / Develop (PUT /api/foals/:foalId/develop)
 *   - Graduate to Adult (POST /api/foals/:foalId/graduate)
 *   - Activity (POST /api/foals/:foalId/activity, via DevelopmentTracker activity-select)
 *
 * Equoria-p3g0 (initial page), Equoria-bi6i (lifecycle UI wired in).
 */

import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useFoal, useFoalDevelopment } from '@/hooks/api/useBreeding';
import FoalDevelopmentTracker from '@/components/breeding/FoalDevelopmentTracker';
import { EntityHeader } from '@/components/layout/EntityHeader';
import { PageContainer } from '@/components/layout/PageContainer';

const FoalDetailPage: React.FC = () => {
  const params = useParams<{ id?: string; foalId?: string }>();
  // Route is mounted as /foals/:id — `foalId` is the legacy/explicit name.
  const rawId = params.id ?? params.foalId;
  const foalId = rawId ? Number.parseInt(rawId, 10) : NaN;
  const isValidId = Number.isFinite(foalId) && foalId > 0;

  const { data: foal, isLoading: loadingFoal, error: foalError } = useFoal(isValidId ? foalId : 0);

  const {
    data: development,
    isLoading: loadingDev,
    error: devError,
  } = useFoalDevelopment(isValidId ? foalId : 0);

  if (!isValidId) {
    return (
      <div className="glass-panel rounded-2xl border border-red-500/30 p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-[var(--cream)] font-[var(--font-body)]">
            Invalid foal ID. Return to your{' '}
            <Link to="/my-stable" className="text-[var(--gold-400)] underline">
              stable
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  if (loadingFoal || loadingDev) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--gold-400)]" />
          <p className="text-sm text-[var(--text-muted)] font-[var(--font-body)]">Loading foal…</p>
        </div>
      </div>
    );
  }

  if (foalError || !foal) {
    return (
      <div className="glass-panel rounded-2xl border border-red-500/30 p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-[var(--cream)] font-[var(--font-body)]">
            Foal not found or you don&apos;t have access. Return to your{' '}
            <Link to="/my-stable" className="text-[var(--gold-400)] underline">
              stable
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const ageDisplay =
    typeof foal.ageInDays === 'number'
      ? `${foal.ageInDays} days`
      : typeof foal.ageDays === 'number'
        ? `${foal.ageDays} days`
        : null;

  return (
    <PageContainer variant="content" padded={false} className="space-y-5 py-6">
      <EntityHeader
        name={foal.name}
        backLink={{ to: '/my-stable', label: 'Back to stable' }}
        metadata={
          <div className="flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
            {foal.sex && <span>Sex: {foal.sex}</span>}
            {ageDisplay && <span>Age: {ageDisplay}</span>}
            {foal.sireId != null && <span>Sire ID: {foal.sireId}</span>}
            {foal.damId != null && <span>Dam ID: {foal.damId}</span>}
          </div>
        }
        className="mb-6"
      />

      {/* Development panel */}
      <div className="glass-panel rounded-2xl border border-[rgba(201,162,39,0.15)] p-6">
        <h2 className="text-lg font-[var(--font-display)] text-[var(--cream)] mb-4">Development</h2>
        {devError || !development ? (
          <p className="text-sm text-[var(--text-muted)]">No development data available yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Day" value={`${development.currentDay} / ${development.maxDay}`} />
            <Stat label="Bonding" value={String(development.bondingLevel)} />
            <Stat label="Stress" value={String(development.stressLevel)} />
            <Stat
              label="Activities done"
              value={String(
                Object.values(development.completedActivities ?? {}).reduce(
                  (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
                  0
                )
              )}
            />
          </div>
        )}
      </div>

      {/*
       * Foal lifecycle actions (Equoria-bi6i).
       *
       * FoalDevelopmentTracker owns the buttons + mutations + cache
       * invalidation for the 5 primary actions called out in
       * docs/beta-route-truth-table.md for the /breeding row:
       *   enrich / reveal-traits / develop / graduate / activity.
       *
       * The hooks (useEnrichFoal, useRevealFoalTraits, useDevelopFoal,
       * useGraduateFoal, useLogFoalActivity) all invalidate their
       * relevant React Query keys on success — see
       * frontend/src/hooks/api/useBreeding.ts.
       */}
      <FoalDevelopmentTracker foalId={foalId} />
    </PageContainer>
  );
};

/** Small key-value stat cell used in the development panel. */
const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-[var(--font-body)] mb-1">
      {label}
    </p>
    <p className="text-base text-[var(--cream)] font-[var(--font-body)]">{value}</p>
  </div>
);

export default FoalDetailPage;
