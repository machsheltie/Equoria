import React, { useState } from 'react';
import { useBreedFoal } from '@/hooks/api/useBreeding';
import { useHorses } from '@/hooks/api/useHorses';
import type { HorseSummary } from '@/lib/api-client';
import { getBreedName } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';
import { Input, Select } from '@/components/ui/form';

const BreedingCenter = () => {
  const [sireId, setSireId] = useState<number | ''>('');
  const [damId, setDamId] = useState<number | ''>('');
  const [foalName, setFoalName] = useState<string>('');
  const [breedFilter, setBreedFilter] = useState<string>('all');

  const { mutateAsync: breedFoal, isPending, data, error } = useBreedFoal();
  const { data: horses, isLoading: horsesLoading, error: horsesError } = useHorses();

  if (horsesLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-role-secondary">
        <p>Loading horses...</p>
      </div>
    );
  }

  if (horsesError) {
    return (
      <div className="flex items-center justify-center p-12 text-[var(--role-danger-text)]">
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
    <div className="space-y-4 rounded-lg border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-role-secondary">Breeding</p>
          <h3 className="text-xl font-bold text-[var(--text-primary)]">Breeding Center</h3>
          <p className="text-sm text-role-secondary">
            Pair mares and stallions, browse marketplace, and review breeding history.
          </p>
        </div>
      </div>

      {/* Tabs — CanonicalTabs underline variant (Equoria-o5hub.11) */}
      <Tabs defaultValue="my-mares">
        <TabsList aria-label="Breeding tabs">
          <TabsTrigger value="my-mares">My Mares</TabsTrigger>
          <TabsTrigger value="stud-marketplace">Stud Marketplace</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* My Mares Tab */}
        <TabsContent value="my-mares">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)]" htmlFor="damId">
                  Mare
                </label>
                <Select
                  id="damId"
                  value={damId}
                  onChange={(event) =>
                    setDamId(event.target.value === '' ? '' : Number(event.target.value))
                  }
                  className="mt-2"
                >
                  <option value="">Select mare</option>
                  {renderOptions(mares ?? horses)}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)]" htmlFor="sireId">
                  Stallion
                </label>
                <Select
                  id="sireId"
                  value={sireId}
                  onChange={(event) =>
                    setSireId(event.target.value === '' ? '' : Number(event.target.value))
                  }
                  className="mt-2"
                >
                  <option value="">Select stallion</option>
                  {renderOptions(stallions ?? horses)}
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]" htmlFor="foalName">
                Foal Name
              </label>
              <Input
                id="foalName"
                type="text"
                value={foalName}
                onChange={(e) => setFoalName(e.target.value)}
                placeholder="Enter foal name"
                className="mt-2"
              />
            </div>

            {error && (
              <div className="rounded-md border border-[var(--role-danger-border)] bg-[var(--role-danger-bg)] px-3 py-2 text-sm text-[var(--role-danger-text)]">
                {error.message}
              </div>
            )}

            {data?.message && (
              <div className="rounded-md border border-[var(--role-success-border)] bg-[var(--role-success-bg)] px-3 py-2 text-sm text-[var(--role-success-text)]">
                {data.message}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleBreed}
                disabled={isPending || sireId === '' || damId === '' || !foalName.trim()}
                className="rounded-md bg-[var(--status-success)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--status-success)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? 'Breeding…' : 'Breed Now'}
              </button>
            </div>
          </div>
        </TabsContent>

        {/* Stud Marketplace Tab */}
        <TabsContent value="stud-marketplace">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-[var(--text-primary)]">
                Browse Available Stallions
              </h4>
              <div>
                <label htmlFor="breed-filter" className="sr-only">
                  Filter by Breed
                </label>
                <Select
                  id="breed-filter"
                  value={breedFilter}
                  onChange={(e) => setBreedFilter(e.target.value)}
                  aria-label="Filter by Breed"
                >
                  <option value="all">All Breeds</option>
                  {breeds.map((breed) => (
                    <option key={breed} value={breed}>
                      {breed}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {filteredStallions && filteredStallions.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredStallions.map((stallion) => (
                  <div
                    key={stallion.id}
                    className="rounded-md border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <h5 className="text-base font-bold text-[var(--text-primary)]">
                      {stallion.name}
                    </h5>
                    <div className="mt-2 space-y-1 text-sm text-role-secondary">
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
              <div className="rounded-md border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] px-6 py-12 text-center">
                <p className="text-sm text-role-secondary">
                  No stallions found matching the selected breed.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-[var(--text-primary)]">Breeding History</h4>

            {/* Empty state - will be replaced with actual history data later */}
            <div className="rounded-md border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] px-6 py-12 text-center">
              <p className="text-sm text-role-secondary">
                No breeding history yet. Start breeding to see your history here!
              </p>
            </div>

            {/* Placeholder table structure for when history exists */}
            <div className="hidden">
              <table className="min-w-full divide-y divide-[var(--glass-border)]">
                <thead className="bg-[var(--role-neutral-bg)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-role-secondary">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-role-secondary">
                      Mare
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-role-secondary">
                      Stallion
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-role-secondary">
                      Foal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--glass-border)] bg-[var(--role-neutral-bg)]">
                  {/* History rows will go here */}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BreedingCenter;
