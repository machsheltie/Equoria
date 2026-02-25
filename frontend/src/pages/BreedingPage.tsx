import { useState } from 'react';
import BreedingPairSelection from '@/pages/breeding/BreedingPairSelection';
import BreedingCenter from '@/components/breeding/BreedingCenter';
import FoalDevelopmentTracker from '@/components/breeding/FoalDevelopmentTracker';
import { useAuth } from '@/contexts/AuthContext';

const BreedingPage = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [foalId, setFoalId] = useState<number | ''>('');

  console.log('[BreedingPage] Auth State:', { isLoading, isAuthenticated, userId: user?.id });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="text-sm text-[rgb(148,163,184)]">Checking authentication…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-md border border-amber-500/30 bg-[rgba(212,168,67,0.1)] px-4 py-3 text-sm text-amber-400 shadow-sm">
          Please log in to access breeding features.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Main Breeding Pair Selection (Story 6-1) */}
      <BreedingPairSelection userId={user?.id != null ? String(user.id) : undefined} />

      {/* Legacy breeding components - will be deprecated */}
      <div className="mt-8 space-y-6 border-t border-[rgba(37,99,235,0.2)] pt-8">
        <div className="rounded-lg border border-amber-500/30 bg-[rgba(212,168,67,0.1)] p-4">
          <p className="text-sm text-amber-400">
            <strong>Note:</strong> The sections below show legacy breeding features and will be
            replaced with the new breeding system components.
          </p>
        </div>

        <BreedingCenter />

        <div className="rounded-lg border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-[rgb(148,163,184)]">
                Foal Development
              </p>
              <h3 className="text-base font-semibold text-[rgb(220,235,255)]">
                Track an existing foal
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={foalId}
                onChange={(event) =>
                  setFoalId(event.target.value === '' ? '' : Number(event.target.value))
                }
                placeholder="Foal ID"
                className="celestial-input w-32"
              />
            </div>
          </div>
          {foalId !== '' ? (
            <div className="mt-4">
              <FoalDevelopmentTracker foalId={Number(foalId)} />
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] px-3 py-2 text-sm text-[rgb(148,163,184)]">
              Enter a foal ID to load development details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BreedingPage;
