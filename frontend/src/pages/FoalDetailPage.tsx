/**
 * Foal Detail Page
 *
 * Page rendered at /foals/:id. Loads the foal record + development
 * data via the existing useFoal / useFoalDevelopment hooks and displays
 * a summary card plus the foal development UI (FoalDevelopmentTracker).
 * There is no "Reveal Traits" (Equoria-gu8jk; owner ruling 2026-10-20:
 * players never reveal traits). There is deliberately no "Advance Day":
 * foals wait out their full development week (Equoria-mwjst). There is no
 * player-run enrichment, stage activity or graduation either (Equoria-fr2kg;
 * owner ruling 2026-10-14/15: foal enrichment is the groom's job, no
 * graduation).
 *
 * Equoria-p3g0 (initial page), Equoria-bi6i (lifecycle UI wired in).
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router';
import { useFoal, useFoalDevelopment } from '@/hooks/api/useBreeding';
import FoalDevelopmentTracker from '@/components/breeding/FoalDevelopmentTracker';
import { EntityHeader } from '@/components/layout/EntityHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { ErrorState, SectionLoading } from '@/components/ui/state';

const FoalDetailPage: React.FC = () => {
  const navigate = useNavigate();
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
    errorUpdateCount: devErrorCount,
  } = useFoalDevelopment(isValidId ? foalId : 0);

  // Equoria-v61q2: the full-page loading gate covers only the FIRST
  // development fetch. FoalDevelopmentTracker (below) subscribes to the same
  // query; when it mounts after an error it may re-fetch, which puts the query
  // back to `pending`. Re-showing the gate then unmounted the tracker, the error
  // came back, the tracker mounted again: a request loop. Once the query has
  // errored, the tracker shows its own inline loading and error instead.
  const firstDevLoad = loadingDev && devErrorCount === 0;

  // Shared async-state primitives (D-15/D-16) replace the local
  // glass-panel/rounded-2xl error recipes and the local spinner.
  if (!isValidId) {
    return (
      <ErrorState
        title="Invalid foal ID"
        message="This foal link is not valid."
        backLink={{ label: 'Back to stable', onClick: () => navigate('/my-stable') }}
      />
    );
  }

  if (loadingFoal || firstDevLoad) {
    return <SectionLoading label="Loading foal" minHeight="240px" />;
  }

  if (foalError || !foal) {
    return (
      <ErrorState
        title="Foal not found"
        message="This foal does not exist or you don't have access to it."
        backLink={{ label: 'Back to stable', onClick: () => navigate('/my-stable') }}
      />
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

      {/* Development panel — Surface panel (semantic radius via --radius-lg) */}
      <Surface variant="panel">
        <h2 className="type-section-heading mb-4">Development</h2>
        {devError || !development ? (
          <p className="text-sm text-[var(--text-muted)]">No development data available yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Day" value={`${development.currentDay} / ${development.maxDay}`} />
            <Stat label="Bonding" value={String(development.bondingLevel)} />
            <Stat label="Stress" value={String(development.stressLevel)} />
          </div>
        )}
      </Surface>

      {/*
       * Foal development (Equoria-bi6i). FoalDevelopmentTracker shows the
       * development timeline, discovered traits and activity log; it has no
       * player actions (Equoria-mwjst, Equoria-fr2kg, Equoria-gu8jk).
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
