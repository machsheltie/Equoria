/**
 * BreedSelector (Epic 25-1)
 *
 * Grid (mobile) / list (desktop) breed picker used in the onboarding wizard.
 * Features:
 *  - View toggle: grid cards (mobile-default) ↔ list rows (desktop-default)
 *  - Breed cards with portrait placeholder, name and lore blurb (owner ruling
 *    2026-10-29 q292, Equoria-9kakx: no breed stat bars, radar or
 *    discipline-strength badges)
 *  - Gender selection (Mare / Stallion)
 *  - Name input with live preview chip
 *  - Skeleton loading + error state
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, List, Search, Star, X } from 'lucide-react';
import { type Breed } from '@/hooks/api/useBreeds';
import { getBreedCategoryPlaceholder } from '@/lib/breed-images';
import { Input } from '@/components/ui/form';
import { HorseNameField } from './HorseNameField';
import { GridSkeleton, ListSkeleton } from './BreedSelectorSkeletons';

// ── Types ──────────────────────────────────────────────────────────────────────

export type Gender = 'Mare' | 'Stallion';

export interface BreedSelectionValue {
  breedId: number;
  breedName: string;
  gender: Gender;
  horseName: string;
}

interface BreedSelectorProps {
  breeds: Breed[];
  value: Partial<BreedSelectionValue>;
  onChange: (_value: Partial<BreedSelectionValue>) => void;
}

// ── Breed card (grid view) ─────────────────────────────────────────────────────

/**
 * Shared radio-option a11y props (Equoria-zanq, Spec 11.3.4 — radiogroup
 * with arrow-key navigation). Each breed card/row is an ARIA `radio` inside
 * the `radiogroup`; roving tabindex (only the checked/first option is
 * tabbable) + the parent's arrow-key handler implement the WAI-ARIA radio
 * group keyboard pattern.
 */
interface RadioOptionProps {
  isSelected: boolean;
  /** Roving tabindex: 0 only for the checked option (or first if none). */
  tabIndex: number;
  onKeyDown: (_e: React.KeyboardEvent) => void;
}

function BreedCard({
  breed,
  isSelected,
  onSelect,
  tabIndex,
  onKeyDown,
}: {
  breed: Breed;
  isSelected: boolean;
  onSelect: () => void;
} & RadioOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      role="radio"
      aria-checked={isSelected}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      data-breed-option={breed.id}
      className={[
        'text-left rounded-xl p-3 border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-night-sky)]',
        isSelected
          ? 'border-[var(--gold-primary)] bg-[var(--alpha-gold-primary-12)] shadow-[0_0_14px_var(--alpha-gold-ember-20)]'
          : 'border-[rgba(100,130,165,0.25)] bg-[rgba(10,22,50,0.5)] hover:border-[var(--alpha-gold-ember-40)] hover:bg-[rgba(10,22,50,0.7)]',
      ].join(' ')}
    >
      {/* Portrait placeholder — category-distinct silhouette (Equoria-x83v4)
          so the 300+ portrait-less breeds aren't all-identical. */}
      <div className="w-full aspect-square rounded-lg mb-2 flex items-center justify-center bg-[var(--bg-midnight)] border border-[rgba(100,130,165,0.2)] overflow-hidden">
        <img
          src={getBreedCategoryPlaceholder(breed.name)}
          alt={breed.name}
          className="w-3/4 h-3/4 object-contain opacity-60"
          loading="lazy"
        />
      </div>

      {/* Name */}
      <p className="text-xs font-semibold text-[var(--text-primary)] font-[var(--font-body)] leading-tight mb-1 truncate">
        {breed.name}
      </p>

      {/* Selected indicator */}
      {isSelected && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-[var(--gold-primary)] font-semibold">
          <Star className="w-3 h-3 fill-[var(--gold-primary)]" aria-hidden="true" />
          Selected
        </div>
      )}
    </button>
  );
}

// ── Breed row (list view) ──────────────────────────────────────────────────────

function BreedRow({
  breed,
  isSelected,
  onSelect,
  tabIndex,
  onKeyDown,
}: {
  breed: Breed;
  isSelected: boolean;
  onSelect: () => void;
} & RadioOptionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={[
        'rounded-xl border transition-all duration-200',
        isSelected
          ? 'border-[var(--gold-primary)] bg-[var(--alpha-gold-primary-8)]'
          : 'border-[rgba(100,130,165,0.25)] bg-[rgba(10,22,50,0.4)] hover:border-[var(--alpha-gold-ember-35)]',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onSelect}
        role="radio"
        aria-checked={isSelected}
        tabIndex={tabIndex}
        onKeyDown={onKeyDown}
        data-breed-option={breed.id}
        className="w-full flex items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-night-sky)] rounded-xl"
      >
        {/* Portrait thumbnail — category-distinct silhouette (Equoria-x83v4). */}
        <div className="w-12 h-12 flex-shrink-0 rounded-lg flex items-center justify-center bg-[var(--bg-midnight)] border border-[rgba(100,130,165,0.2)] overflow-hidden">
          <img
            src={getBreedCategoryPlaceholder(breed.name)}
            alt={breed.name}
            className="w-8 h-8 object-contain opacity-60"
            loading="lazy"
          />
        </div>

        {/* Name + lore preview */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] font-[var(--font-body)] truncate">
            {breed.name}
          </p>
          <p className="text-xs text-[var(--text-muted)] line-clamp-1 font-[var(--font-body)] mt-0.5">
            {breed.loreBlurb}
          </p>
        </div>

        {/* Selected badge */}
        {isSelected && (
          <Star
            className="w-4 h-4 fill-[var(--gold-primary)] text-[var(--gold-primary)] flex-shrink-0"
            aria-label="Selected"
          />
        )}
      </button>

      {/* Expandable lore (desktop list view) */}
      {isSelected && (
        <div className="px-3 pb-3 border-t border-[var(--alpha-gold-ember-15)]">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-[var(--gold-primary)] hover:text-[var(--gold-light)] mt-2 transition-colors focus-visible:outline-none"
          >
            {expanded ? '▲ Less detail' : '▼ More detail'}
          </button>
          {expanded && (
            <div className="mt-2">
              <p className="text-xs text-role-secondary font-[var(--font-body)] italic leading-relaxed">
                {breed.loreBlurb}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main BreedSelector ─────────────────────────────────────────────────────────

export function BreedSelector({ breeds, value, onChange }: BreedSelectorProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const radioGroupRef = useRef<HTMLDivElement | null>(null);

  // Equoria-4rz4b — text-search filter for breed picker.
  // `searchQuery` is the live input value (updated synchronously while typing
  // so the input stays responsive). `debouncedQuery` is what actually drives
  // the filter — 200ms debounce keeps filter recomputation + ARIA live-region
  // announcements off the per-keystroke path. Both start empty so the initial
  // render shows the full breeds list (preserves existing first-mount
  // behaviour: no autofocus on the input, arrow-key entry into the grid still
  // works).
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed === debouncedQuery) return;
    const handle = window.setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, 200);
    return () => window.clearTimeout(handle);
    // debouncedQuery is the output of this effect, not an input — including it
    // in the dependency array would re-run the effect every debounce flush.
  }, [searchQuery, debouncedQuery]);

  // Case-insensitive substring match on breed.name. The filter is intentionally
  // narrow (name only, not loreBlurb) — onboarding users search by the breed
  // they remember reading about, not by free-text description, and matching
  // lore would surface confusing "why is this breed in my results?" hits.
  const filteredBreeds = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    if (!q) return breeds;
    return breeds.filter((b) => b.name.toLowerCase().includes(q));
  }, [breeds, debouncedQuery]);

  const selectedBreed = breeds.find((b) => b.id === value.breedId) ?? null;

  function selectBreed(breed: Breed) {
    onChange({ ...value, breedId: breed.id, breedName: breed.name });
  }

  // WAI-ARIA radio-group keyboard pattern (Equoria-zanq, Spec 11.3.4).
  // Arrow keys move selection AND focus to the adjacent breed; Home/End jump
  // to the ends. Wraps around. Selecting via arrows also checks the option
  // (standard radiogroup behaviour).
  //
  // Equoria-4rz4b: operates on the FILTERED set, not the full breeds list.
  // If the currently-selected breed is filtered out, selectedIndex is -1 —
  // we do NOT auto-select the first match (disorienting for keyboard users
  // mid-search). Arrow-key entry from a filtered-out selection lands on the
  // first option in the filtered set via the optionTabIndex fallback.
  const selectedIndex = filteredBreeds.findIndex((b) => b.id === value.breedId);
  function handleOptionKeyDown(e: React.KeyboardEvent, index: number) {
    const last = filteredBreeds.length - 1;
    if (last < 0) return;
    let next: number | null = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = index >= last ? 0 : index + 1;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = index <= 0 ? last : index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    selectBreed(filteredBreeds[next]);
    const el = radioGroupRef.current?.querySelector<HTMLElement>(
      `[data-breed-option="${filteredBreeds[next].id}"]`
    );
    el?.focus();
  }
  // Roving tabindex: only the checked option (or the first, if none checked)
  // is in the tab order; the rest are reached via arrow keys. Operates on the
  // FILTERED set so the tab-stop is always reachable.
  function optionTabIndex(index: number): number {
    if (selectedIndex >= 0) return index === selectedIndex ? 0 : -1;
    return index === 0 ? 0 : -1;
  }

  function clearSearch() {
    setSearchQuery('');
    setDebouncedQuery('');
  }

  function selectGender(gender: Gender) {
    onChange({ ...value, gender });
  }

  function setHorseName(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ ...value, horseName: e.target.value });
  }

  return (
    <div className="space-y-5" data-testid="breed-selector">
      {/* ── View toggle ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)] font-[var(--font-body)] uppercase tracking-widest">
          Choose a Breed
        </p>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-midnight)] border border-[rgba(100,130,165,0.2)]">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            aria-label="Grid view"
            className={[
              'p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold-bright)]',
              viewMode === 'grid'
                ? 'bg-[var(--celestial-navy-600)] text-[var(--gold-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            ].join(' ')}
          >
            <LayoutGrid className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
            aria-label="List view"
            className={[
              'p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold-bright)]',
              viewMode === 'list'
                ? 'bg-[var(--celestial-navy-600)] text-[var(--gold-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            ].join(' ')}
          >
            <List className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Search input (Equoria-4rz4b) ──
           Plain visible search field; intentionally NOT autofocused so the
           existing arrow-key entry-from-card behaviour is preserved. The
           debounced filter drives both the visible list and the ARIA
           live-region announcement below. */}
      <div className="relative">
        <label htmlFor="breed-search-input" className="sr-only">
          Search breeds
        </label>
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none"
          aria-hidden="true"
        />
        <Input
          id="breed-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search breeds"
          className="pl-9 pr-9"
          data-testid="breed-search-input"
          aria-label="Search breeds"
          aria-controls="breed-radiogroup"
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear breed search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold-bright)]"
            data-testid="breed-search-clear"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ARIA live region: announces filtered count to AT users. Visually
          hidden — the visible "no results" copy below covers sighted users. */}
      <span
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-testid="breed-search-live-region"
      >
        {debouncedQuery
          ? `${filteredBreeds.length} of ${breeds.length} breeds match "${debouncedQuery}"`
          : `${breeds.length} breeds available`}
      </span>

      {/* ── Breed grid / list ── */}
      <div
        ref={radioGroupRef}
        id="breed-radiogroup"
        className="max-h-64 overflow-y-auto scroll-area-celestial pr-1"
        role="radiogroup"
        aria-label="Horse breeds"
      >
        {filteredBreeds.length === 0 ? (
          <div
            className="rounded-xl p-4 border border-[rgba(100,130,165,0.25)] bg-[rgba(10,22,50,0.4)] text-center space-y-2"
            data-testid="breed-search-empty"
          >
            <p className="text-sm text-[var(--text-muted)] font-[var(--font-body)]">
              No breeds match &ldquo;{debouncedQuery}&rdquo;
            </p>
            <button
              type="button"
              onClick={clearSearch}
              className="text-xs text-[var(--gold-primary)] hover:text-[var(--gold-light)] underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold-bright)] rounded"
              data-testid="breed-search-clear-empty"
            >
              Clear search
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredBreeds.map((breed, index) => (
              <BreedCard
                key={breed.id}
                breed={breed}
                isSelected={value.breedId === breed.id}
                onSelect={() => selectBreed(breed)}
                tabIndex={optionTabIndex(index)}
                onKeyDown={(e) => handleOptionKeyDown(e, index)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredBreeds.map((breed, index) => (
              <BreedRow
                key={breed.id}
                breed={breed}
                isSelected={value.breedId === breed.id}
                onSelect={() => selectBreed(breed)}
                tabIndex={optionTabIndex(index)}
                onKeyDown={(e) => handleOptionKeyDown(e, index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Lore blurb for selected breed ── */}
      {selectedBreed && (
        <div className="rounded-xl p-3 bg-[var(--alpha-gold-primary-6)] border border-[var(--alpha-gold-ember-18)]">
          <p className="text-xs italic text-role-secondary font-[var(--font-body)] leading-relaxed">
            &ldquo;{selectedBreed.loreBlurb}&rdquo;
          </p>
        </div>
      )}

      {/* ── Gender selection ── */}
      <div>
        <p className="text-xs text-[var(--text-muted)] font-[var(--font-body)] uppercase tracking-widest mb-2">
          Gender
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(['Mare', 'Stallion'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => selectGender(g)}
              aria-pressed={value.gender === g}
              className={[
                'py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-night-sky)]',
                value.gender === g
                  ? 'border-[var(--gold-primary)] bg-[var(--alpha-gold-primary-12)] text-[var(--gold-primary)]'
                  : 'border-[rgba(100,130,165,0.25)] bg-[rgba(10,22,50,0.4)] text-[var(--text-muted)] hover:border-[var(--alpha-gold-ember-35)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {g === 'Mare' ? '♀' : '♂'} {g}
            </button>
          ))}
        </div>
      </div>

      {/* ── Name input ── (extracted to HorseNameField for Equoria-zalyb: the
          field now carries the 40-character rule, its counter and its own
          rejection copy, and BreedSelector was already at its size ceiling.) */}
      <HorseNameField
        name={value.horseName ?? ''}
        onChange={setHorseName}
        breedName={value.breedName}
        gender={value.gender}
      />
    </div>
  );
}

// ── Loading & Error states (for parent to render) ──────────────────────────────

export function BreedSelectorSkeleton({ viewMode = 'grid' }: { viewMode?: 'grid' | 'list' }) {
  return viewMode === 'grid' ? <GridSkeleton /> : <ListSkeleton />;
}
