/**
 * Foal Detail Page
 *
 * Minimal page rendered at /foals/:id. Loads the foal record + development
 * data via the existing useFoal / useFoalDevelopment hooks and displays a
 * small summary card.
 *
 * Equoria-p3g0
 */

import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { useFoal, useFoalDevelopment } from '@/hooks/api/useBreeding';

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

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        to="/my-stable"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--cream)] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to stable
      </Link>

      {/* Foal summary card */}
      <div className="glass-panel rounded-2xl border border-[rgba(201,162,39,0.2)] p-6">
        <h1 className="text-2xl font-[var(--font-display)] text-[var(--cream)] mb-2">
          {foal.name}
        </h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <Stat label="Sex" value={foal.sex ?? '—'} />
          <Stat
            label="Age"
            value={
              typeof foal.ageInDays === 'number'
                ? `${foal.ageInDays} days`
                : typeof foal.ageDays === 'number'
                  ? `${foal.ageDays} days`
                  : '—'
            }
          />
          <Stat label="Sire ID" value={foal.sireId != null ? String(foal.sireId) : '—'} />
          <Stat label="Dam ID" value={foal.damId != null ? String(foal.damId) : '—'} />
        </div>
      </div>

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
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-[var(--font-body)] mb-1">
      {label}
    </p>
    <p className="text-base text-[var(--cream)] font-[var(--font-body)]">{value}</p>
  </div>
);

export default FoalDetailPage;
