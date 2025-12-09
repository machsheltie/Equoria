import React, { useState } from 'react';
import { useBreedFoal } from '@/hooks/api/useBreeding';
import { useHorses } from '@/hooks/api/useHorses';
import type { HorseSummary } from '@/lib/api-client';

type TabType = 'my-mares' | 'stud-marketplace' | 'history';

const BreedingCenter = () => {
  const [activeTab, setActiveTab] = useState<TabType>('my-mares');
  const [sireId, setSireId] = useState<number | ''>('');
  const [damId, setDamId] = useState<number | ''>('');
  const [breedFilter, setBreedFilter] = useState<string>('all');

  const { mutateAsync: breedFoal, isPending, data, error } = useBreedFoal();
  const { data: horses, isLoading: horsesLoading, error: horsesError } = useHorses();

  const mares = horses?.filter((horse) => {
    const sexOrGender = (horse.sex || horse.gender)?.toLowerCase();
    return sexOrGender === 'mare' || sexOrGender === 'female';
  });
  const stallions = horses?.filter((horse) => {
    const sexOrGender = (horse.sex || horse.gender)?.toLowerCase();
    return sexOrGender === 'stallion' || sexOrGender === 'male';
  });

  // Get unique breeds for filter
  const breeds = Array.from(new Set(stallions?.map((h) => h.breed).filter(Boolean))) as string[];

  // Filter stallions by breed
  const filteredStallions =
    breedFilter === 'all'
      ? stallions
      : stallions?.filter((s) => s.breed === breedFilter);

  const renderOptions = (list?: typeof horses) =>
    list?.map((horse) => (
      <option key={horse.id} value={horse.id}>
        {horse.name} {horse.breed ? `(${horse.breed})` : ''}
      </option>
    ));

  const handleBreed = async () => {
    if (sireId === '' || damId === '') return;
    await breedFoal({ sireId: Number(sireId), damId: Number(damId) });
  };

  // Loading state
  if (horsesLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-12 shadow-sm">
        <div className="text-center">
          <div className="mb-2 text-lg font-semibold text-slate-900">Loading...</div>
          <div className="text-sm text-slate-600">Fetching horses data</div>
        </div>
      </div>
    );
  }

  // Error state
  if (horsesError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <div className="text-sm text-rose-800">{horsesError.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Breeding</p>
          <h3 className="text-xl font-bold text-slate-900">Breeding Center</h3>
          <p className="text-sm text-slate-600">
            Pair mares and stallions, browse marketplace, and review breeding history.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'my-mares'}
            onClick={() => setActiveTab('my-mares')}
            className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
              activeTab === 'my-mares'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            My Mares
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'stud-marketplace'}
            onClick={() => setActiveTab('stud-marketplace')}
            className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
              activeTab === 'stud-marketplace'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            Stud Marketplace
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            History
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* My Mares Tab */}
        {activeTab === 'my-mares' && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="damId">
                  Mare
                </label>
                <select
                  id="damId"
                  value={damId}
                  onChange={(event) =>
                    setDamId(event.target.value === '' ? '' : Number(event.target.value))
                  }
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select mare</option>
                  {renderOptions(mares ?? horses)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="sireId">
                  Stallion
                </label>
                <select
                  id="sireId"
                  value={sireId}
                  onChange={(event) =>
                    setSireId(event.target.value === '' ? '' : Number(event.target.value))
                  }
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select stallion</option>
                  {renderOptions(stallions ?? horses)}
                </select>
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error.message}
              </div>
            )}

            {data?.message && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {data.message}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleBreed}
                disabled={isPending || sireId === '' || damId === ''}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? 'Breeding…' : 'Breed Now'}
              </button>
            </div>
          </div>
        )}

        {/* Stud Marketplace Tab */}
        {activeTab === 'stud-marketplace' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-slate-900">Browse Available Stallions</h4>
              <div>
                <label htmlFor="breed-filter" className="sr-only">
                  Filter by Breed
                </label>
                <select
                  id="breed-filter"
                  value={breedFilter}
                  onChange={(e) => setBreedFilter(e.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label="Filter by Breed"
                >
                  <option value="all">All Breeds</option>
                  {breeds.map((breed) => (
                    <option key={breed} value={breed}>
                      {breed}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredStallions && filteredStallions.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredStallions.map((stallion) => (
                  <div
                    key={stallion.id}
                    className="rounded-md border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <h5 className="text-base font-bold text-slate-900">{stallion.name}</h5>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      {stallion.breed && <p className="capitalize">{stallion.breed}</p>}
                      {stallion.level !== undefined && <p>Level {stallion.level}</p>}
                      {stallion.ageYears !== undefined && (
                        <p>{stallion.ageYears} years old</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-6 py-12 text-center">
                <p className="text-sm text-slate-600">No stallions found matching the selected breed.</p>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-slate-900">Breeding History</h4>

            {/* Empty state - will be replaced with actual history data later */}
            <div className="rounded-md border border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <p className="text-sm text-slate-600">No breeding history yet. Start breeding to see your history here!</p>
            </div>

            {/* Placeholder table structure for when history exists */}
            <div className="hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Mare
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Stallion
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Foal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {/* History rows will go here */}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BreedingCenter;
