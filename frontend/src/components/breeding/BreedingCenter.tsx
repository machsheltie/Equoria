import React, { useState } from 'react';
import { useBreedFoal } from '@/hooks/api/useBreeding';
import { useHorses } from '@/hooks/api/useHorses';
import type { HorseSummary } from '@/lib/api-client';
import { getBreedName } from '@/lib/utils';

type TabType = 'my-mares' | 'stud-marketplace' | 'history';

const BreedingCenter = () => {
  const [activeTab, setActiveTab] = useState<TabType>('my-mares');
  const [sireId, setSireId] = useState<number | ''>('');
  const [damId, setDamId] = useState<number | ''>('');
  const [foalName, setFoalName] = useState<string>('');
  const [breedFilter, setBreedFilter] = useState<string>('all');

  const { mutateAsync: breedFoal, isPending, data, error } = useBreedFoal();
  const { data: horses, isLoading: horsesLoading, error: horsesError } = useHorses();

  if (horsesLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-[rgb(148,163,184)]">
        <p>Loading horses...</p>
      </div>
    );
  }

  if (horsesError) {
    return (
      <div className="flex items-center justify-center p-12 text-rose-400">
        <p>Failed to fetch horses: {horsesError.message}</p>
      </div>
    );
  }

  const mares = horses?.filter(
    (h) => h.sex?.toLowerCase() === 'mare' || h.gender?.toLowerCase() === 'mare'
  );
  const stallions = horses?.filter(
    (h) => h.sex?.toLowerCase() === 'stallion' || h.gender?.toLowerCase() === 'stallion'
  );

  const breeds = Array.from(new Set(horses?.map((h) => h.breed).filter(Boolean))) as string[];

  const filteredStallions = stallions?.filter(
    (s) => breedFilter === 'all' || s.breed === breedFilter
  );

  const renderOptions = (horseList: HorseSummary[] | undefined) => {
    return horseList?.map((horse) => (
      <option key={horse.id} value={horse.id}>
        {horse.name}
      </option>
    ));
  };

  const handleBreed = async () => {
    if (sireId === '' || damId === '' || !foalName.trim()) return;
    await breedFoal({
      sireId: Number(sireId),
      damId: Number(damId),
    });
    setFoalName('');
  };

  // ... (loading and error states) ...

  return (
    <div className="space-y-4 rounded-lg border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)] p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[rgb(148,163,184)]">Breeding</p>
          <h3 className="text-xl font-bold text-[rgb(220,235,255)]">Breeding Center</h3>
          <p className="text-sm text-[rgb(148,163,184)]">
            Pair mares and stallions, browse marketplace, and review breeding history.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[rgba(37,99,235,0.2)]">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'my-mares'}
            onClick={() => setActiveTab('my-mares')}
            className={`border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
              activeTab === 'my-mares'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-[rgb(148,163,184)] hover:border-[rgba(37,99,235,0.3)] hover:text-[rgb(220,235,255)]'
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
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-[rgb(148,163,184)] hover:border-[rgba(37,99,235,0.3)] hover:text-[rgb(220,235,255)]'
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
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-[rgb(148,163,184)] hover:border-[rgba(37,99,235,0.3)] hover:text-[rgb(220,235,255)]'
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
                <label className="text-sm font-medium text-[rgb(220,235,255)]" htmlFor="damId">
                  Mare
                </label>
                <select
                  id="damId"
                  value={damId}
                  onChange={(event) =>
                    setDamId(event.target.value === '' ? '' : Number(event.target.value))
                  }
                  className="celestial-input w-full mt-2"
                >
                  <option value="">Select mare</option>
                  {renderOptions(mares ?? horses)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[rgb(220,235,255)]" htmlFor="sireId">
                  Stallion
                </label>
                <select
                  id="sireId"
                  value={sireId}
                  onChange={(event) =>
                    setSireId(event.target.value === '' ? '' : Number(event.target.value))
                  }
                  className="celestial-input w-full mt-2"
                >
                  <option value="">Select stallion</option>
                  {renderOptions(stallions ?? horses)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[rgb(220,235,255)]" htmlFor="foalName">
                Foal Name
              </label>
              <input
                id="foalName"
                type="text"
                value={foalName}
                onChange={(e) => setFoalName(e.target.value)}
                placeholder="Enter foal name"
                className="celestial-input w-full mt-2"
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-[rgba(239,68,68,0.1)] px-3 py-2 text-sm text-red-400">
                {error.message}
              </div>
            )}

            {data?.message && (
              <div className="rounded-md border border-emerald-500/30 bg-[rgba(16,185,129,0.1)] px-3 py-2 text-sm text-emerald-400">
                {data.message}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleBreed}
                disabled={isPending || sireId === '' || damId === '' || !foalName.trim()}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
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
              <h4 className="text-lg font-semibold text-[rgb(220,235,255)]">
                Browse Available Stallions
              </h4>
              <div>
                <label htmlFor="breed-filter" className="sr-only">
                  Filter by Breed
                </label>
                <select
                  id="breed-filter"
                  value={breedFilter}
                  onChange={(e) => setBreedFilter(e.target.value)}
                  className="celestial-input w-full"
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
                    className="rounded-md border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)] p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <h5 className="text-base font-bold text-[rgb(220,235,255)]">{stallion.name}</h5>
                    <div className="mt-2 space-y-1 text-sm text-[rgb(148,163,184)]">
                      {stallion.breed && (
                        <p className="capitalize">{getBreedName(stallion.breed)}</p>
                      )}
                      {stallion.level !== undefined && <p>Level {stallion.level}</p>}
                      {stallion.ageYears !== undefined && <p>{stallion.ageYears} years old</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] px-6 py-12 text-center">
                <p className="text-sm text-[rgb(148,163,184)]">
                  No stallions found matching the selected breed.
                </p>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-[rgb(220,235,255)]">Breeding History</h4>

            {/* Empty state - will be replaced with actual history data later */}
            <div className="rounded-md border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] px-6 py-12 text-center">
              <p className="text-sm text-[rgb(148,163,184)]">
                No breeding history yet. Start breeding to see your history here!
              </p>
            </div>

            {/* Placeholder table structure for when history exists */}
            <div className="hidden">
              <table className="min-w-full divide-y divide-[rgba(37,99,235,0.2)]">
                <thead className="bg-[rgba(15,35,70,0.5)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-[rgb(148,163,184)]">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-[rgb(148,163,184)]">
                      Mare
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-[rgb(148,163,184)]">
                      Stallion
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-[rgb(148,163,184)]">
                      Foal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)]">
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
