/**
 * HorseSearch — the Marketplace horse search (Equoria-q4uem.9.1).
 *
 * Owner ruling 2026-10-27 (q104): the search covers all horses. The player ticks
 * "For sale", "At stud", or both. Filters are age, breed, gender, color, sale
 * price, stud price and Public or Private stud; sort is by price either way.
 * Results are a ledger of rows, not a wall of cards. Clicking a horse opens its
 * one horse page; a horse for sale also offers Buy.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, ShoppingCart } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import { Input, Select, FormField, Checkbox } from '@/components/ui/form';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { EmptyState } from '@/components/ui/EmptyState';
import { userMessageFor } from '@/lib/http/userMessage';
import { ListingDetailDialog } from '@/components/marketplace/ListingDetailDialog';
import { HorseSearchRow, toListing } from '@/components/marketplace/HorseSearchRow';
import { useMarketplaceSearch } from '@/hooks/api/useMarketplace';
import { useBreeds } from '@/hooks/api/useBreeds';
import type { MarketplaceSearchFilters, MarketplaceSearchHorse } from '@/lib/api-client';

// Debounce window for the text inputs (Equoria-gb2uq): one request per pause, not per key.
const TEXT_DEBOUNCE_MS = 300;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'youngest', label: 'Youngest First' },
];

// Sex values are sex GROUPS: the server matches Mare→{Mare,Filly} and Stallion→{Stallion,Colt}.
const SEX_OPTIONS = [
  { value: '', label: 'Any Sex' },
  { value: 'Mare', label: 'Mares & Fillies' },
  { value: 'Stallion', label: 'Stallions & Colts' },
];

const STUD_MODE_OPTIONS = [
  { value: '', label: 'Public or Private' },
  { value: 'public', label: 'Public Stud' },
  { value: 'private', label: 'Private Stud' },
];

const NUMBER_FILTERS = [
  { key: 'minAge', label: 'Min Age' },
  { key: 'maxAge', label: 'Max Age' },
  { key: 'minPrice', label: 'Min Sale Price' },
  { key: 'maxPrice', label: 'Max Sale Price' },
  { key: 'minStudFee', label: 'Min Stud Fee' },
  { key: 'maxStudFee', label: 'Max Stud Fee' },
] as const;

export function emptyTitle(f: Pick<MarketplaceSearchFilters, 'forSale' | 'atStud'>): string {
  if (f.forSale && f.atStud) return 'No horses for sale or at stud right now';
  if (f.atStud) return 'No stallions at stud right now';
  return 'No horses listed for sale right now';
}

const RowSkeleton: React.FC = () => (
  <li className="flex gap-4 py-4" data-testid="listing-skeleton">
    <Skeleton.Rect className="w-16 h-16 flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton.Line className="w-1/3" />
      <Skeleton.Line className="w-2/3" />
    </div>
  </li>
);

interface HorseSearchProps {
  userBalance: number;
  onPurchased: (_horseName: string) => void;
}

export const HorseSearch: React.FC<HorseSearchProps> = ({ userBalance, onPurchased }) => {
  const [filters, setFilters] = useState<MarketplaceSearchFilters>({
    forSale: true,
    atStud: true,
    sort: 'newest',
    page: 1,
  });
  const [nameInput, setNameInput] = useState('');
  const [colorInput, setColorInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [buying, setBuying] = useState<MarketplaceSearchHorse | null>(null);

  const { data, isLoading, isError, error, refetch } = useMarketplaceSearch(filters);
  const horses = data?.horses ?? [];
  const pagination = data?.pagination;
  const noneTicked = !filters.forSale && !filters.atStud;

  const { data: breedsData } = useBreeds();
  const breedOptions = [
    { value: '', label: 'All Breeds' },
    ...(breedsData ?? []).map((b) => ({ value: String(b.id), label: b.name })),
  ];

  const update = useCallback(
    <K extends keyof MarketplaceSearchFilters>(key: K, value: MarketplaceSearchFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    },
    []
  );

  // Name and color reach the query key only after the player pauses typing.
  useEffect(() => {
    const name = nameInput.trim() || undefined;
    const color = colorInput.trim() || undefined;
    const handle = window.setTimeout(() => {
      setFilters((prev) =>
        prev.name === name && prev.color === color ? prev : { ...prev, name, color, page: 1 }
      );
    }, TEXT_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [nameInput, colorInput]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
        <fieldset className="flex items-center gap-5 border-0 p-0 m-0">
          <legend className="sr-only">Show me</legend>
          <label className="flex items-center gap-2 min-h-11 cursor-pointer text-[var(--text-primary)]">
            <Checkbox
              checked={filters.forSale}
              onCheckedChange={(v) => update('forSale', v === true)}
              aria-label="Horses for sale"
            />
            <span>For sale</span>
          </label>
          <label className="flex items-center gap-2 min-h-11 cursor-pointer text-[var(--text-primary)]">
            <Checkbox
              checked={filters.atStud}
              onCheckedChange={(v) => update('atStud', v === true)}
              aria-label="Stallions at stud"
            />
            <span>At stud</span>
          </label>
        </fieldset>
        <div className="flex-1 min-w-[12rem] relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none"
            aria-hidden="true"
          />
          <Input
            type="text"
            placeholder="Search by name…"
            aria-label="Search horses by name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.sort ?? 'newest'}
          aria-label="Sort listings"
          onChange={(e) => update('sort', e.target.value as MarketplaceSearchFilters['sort'])}
          options={SORT_OPTIONS}
          className="w-auto"
        />
        <Button
          type="button"
          variant={showFilters ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Advanced filters"
          aria-pressed={showFilters}
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      {showFilters && (
        <Surface variant="panel" className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FormField label="Breed" htmlFor="filter-breedId">
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={filters.breedId !== undefined ? String(filters.breedId) : ''}
                onChange={(e) =>
                  update('breedId', e.target.value ? Number(e.target.value) : undefined)
                }
                options={breedOptions}
              />
            )}
          </FormField>
          <FormField label="Sex" htmlFor="filter-sex">
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={filters.sex ?? ''}
                onChange={(e) => update('sex', e.target.value || undefined)}
                options={SEX_OPTIONS}
              />
            )}
          </FormField>
          <FormField label="Color" htmlFor="filter-color">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="text"
                maxLength={100}
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Stud" htmlFor="filter-studMode">
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={filters.studMode ?? ''}
                onChange={(e) =>
                  update(
                    'studMode',
                    (e.target.value || undefined) as MarketplaceSearchFilters['studMode']
                  )
                }
                options={STUD_MODE_OPTIONS}
              />
            )}
          </FormField>
          {NUMBER_FILTERS.map(({ key, label }) => (
            <FormField key={key} label={label} htmlFor={`filter-${key}`}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  min={0}
                  value={filters[key] ?? ''}
                  onChange={(e) => update(key, e.target.value ? Number(e.target.value) : undefined)}
                />
              )}
            </FormField>
          ))}
        </Surface>
      )}

      {noneTicked ? (
        <EmptyState
          variant="no-results"
          icon={<ShoppingCart className="h-8 w-8" aria-hidden="true" />}
          title="Tick For sale, At stud, or both"
          description="The search needs to know which horses to look for."
        />
      ) : isLoading ? (
        <ul
          className="divide-y divide-[var(--glass-border)]"
          role="status"
          aria-label="Loading listings"
        >
          {[...Array(4)].map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </ul>
      ) : isError ? (
        // ERROR before EMPTY (doctrine §1): a failed search must never read as "nothing here".
        <SearchError error={error} onRetry={() => refetch()} />
      ) : horses.length === 0 ? (
        <EmptyState
          variant="no-results"
          icon={<ShoppingCart className="h-8 w-8" aria-hidden="true" />}
          title={emptyTitle(filters)}
          description="Check back soon!"
        />
      ) : (
        <ul className="divide-y divide-[var(--glass-border)]">
          {horses.map((h) => (
            <HorseSearchRow key={h.id} horse={h} onBuy={setBuying} />
          ))}
        </ul>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6" data-testid="pagination">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={(filters.page ?? 1) <= 1}
            onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <span className="text-sm text-[var(--text-muted)]">
            Page {filters.page ?? 1} of {pagination.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={(filters.page ?? 1) >= pagination.totalPages}
            onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {buying && buying.sale && (
        <ListingDetailDialog
          listing={toListing(buying)}
          userBalance={userBalance}
          onClose={() => setBuying(null)}
          onPurchased={(name) => {
            setBuying(null);
            onPurchased(name);
          }}
        />
      )}
    </div>
  );
};

const SearchError: React.FC<{ error: unknown; onRetry: () => void }> = ({ error, onRetry }) => {
  const { title, message, retryable } = userMessageFor(error);
  return (
    <ErrorState
      title={title}
      message={message}
      retry={retryable ? { label: 'Try Again', onClick: onRetry } : undefined}
    />
  );
};
