import { useState } from 'react';
import BreedingCenter from '@/components/breeding/BreedingCenter';
import BreedingPairSelector from '@/components/breeding/BreedingPairSelector';
import FoalDevelopmentTracker from '@/components/breeding/FoalDevelopmentTracker';
import { useAuth } from '@/contexts/AuthContext';

const BreedingPage = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [foalId, setFoalId] = useState<number | ''>('');

  console.log('[BreedingPage] Auth State:', { isLoading, isAuthenticated, userId: user?.id });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="text-sm text-slate-600">Checking authentication…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
          Please log in to access breeding features.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <BreedingCenter />
      {/* <BreedingPairSelector stallionId={0} mareId={0} /> - TODO: Add actual horse selection */}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Foal Development</p>
            <h3 className="text-base font-semibold text-slate-900">Track an existing foal</h3>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={foalId}
              onChange={(event) =>
                setFoalId(event.target.value === '' ? '' : Number(event.target.value))
              }
              placeholder="Foal ID"
              className="w-32 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        {foalId !== '' ? (
          <div className="mt-4">
            <FoalDevelopmentTracker foalId={Number(foalId)} />
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Enter a foal ID to load development details.
          </div>
        )}
      </div>
    </div>
  );
};

export default BreedingPage;
