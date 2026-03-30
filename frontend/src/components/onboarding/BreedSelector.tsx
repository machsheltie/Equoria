/**
 * BreedSelector (Epic 25-1)
 *
 * Grid (mobile) / list (desktop) breed picker used in the onboarding wizard.
 * Features:
 *  - View toggle: grid cards (mobile-default) ↔ list rows (desktop-default)
 *  - Breed cards with portrait placeholder, name, stat tendency bars, lore blurb
 *  - Gender selection (Mare / Stallion)
 *  - Name input with live preview chip
 *  - Skeleton loading + error state
 */

import React, { useState } from 'react';
import { LayoutGrid, List, Star } from 'lucide-react';
import { type Breed, type BreedStatTendencies } from '@/hooks/api/useBreeds';

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

// ── Stat tendency mini bar ─────────────────────────────────────────────────────

const STAT_LABELS: (keyof BreedStatTendencies)[] = [
  'speed',
  'stamina',
  'agility',
  'balance',
  'precision',
  'boldness',
];

const STAT_DISPLAY: Record<keyof BreedStatTendencies, string> = {
  speed: 'Spd',
  stamina: 'Stm',
  agility: 'Agi',
  balance: 'Bal',
  precision: 'Pre',
  boldness: 'Bld',
};

function StatBars({ tendencies }: { tendencies: BreedStatTendencies }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
      {STAT_LABELS.map((key) => {
        const t = tendencies[key];
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-[var(--font-body)]">
              {STAT_DISPLAY[key]}
            </span>
            <div
              className="h-1 rounded-full bg-[var(--celestial-navy-700)] overflow-hidden"
              role="presentation"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-primary)]"
                style={{ width: `${t.avg}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Breed card (grid view) ─────────────────────────────────────────────────────

function BreedCard({
  breed,
  isSelected,
  onSelect,
}: {
  breed: Breed;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={[
        'text-left rounded-xl p-3 border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-night-sky)]',
        isSelected
          ? 'border-[var(--gold-primary)] bg-[rgba(201,162,39,0.12)] shadow-[0_0_14px_rgba(201,162,39,0.2)]'
          : 'border-[rgba(100,130,165,0.25)] bg-[rgba(10,22,50,0.5)] hover:border-[rgba(201,162,39,0.4)] hover:bg-[rgba(10,22,50,0.7)]',
      ].join(' ')}
    >
      {/* Portrait placeholder */}
      <div className="w-full aspect-square rounded-lg mb-2 flex items-center justify-center bg-[var(--bg-midnight)] border border-[rgba(100,130,165,0.2)] overflow-hidden">
        <img
          src="/placeholder.svg"
          alt={breed.name}
          className="w-3/4 h-3/4 object-contain opacity-60"
          loading="lazy"
        />
      </div>

      {/* Name */}
      <p className="text-xs font-semibold text-[var(--text-primary)] font-[var(--font-heading)] leading-tight mb-1 truncate">
        {breed.name}
      </p>

      {/* Stat bars */}
      <StatBars tendencies={breed.statTendencies} />

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
}: {
  breed: Breed;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={[
        'rounded-xl border transition-all duration-200',
        isSelected
          ? 'border-[var(--gold-primary)] bg-[rgba(201,162,39,0.08)]'
          : 'border-[rgba(100,130,165,0.25)] bg-[rgba(10,22,50,0.4)] hover:border-[rgba(201,162,39,0.35)]',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className="w-full flex items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-night-sky)] rounded-xl"
      >
        {/* Portrait thumbnail */}
        <div className="w-12 h-12 flex-shrink-0 rounded-lg flex items-center justify-center bg-[var(--bg-midnight)] border border-[rgba(100,130,165,0.2)] overflow-hidden">
          <img
            src="/placeholder.svg"
            alt={breed.name}
            className="w-8 h-8 object-contain opacity-60"
            loading="lazy"
          />
        </div>

        {/* Name + lore preview */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] font-[var(--font-heading)] truncate">
            {breed.name}
          </p>
          <p className="text-xs text-[var(--text-muted)] line-clamp-1 font-[var(--font-body)] mt-0.5">
            {breed.loreBlurb}
          </p>
        </div>

        {/* Stat mini preview */}
        <div className="hidden sm:grid grid-cols-3 gap-x-2 gap-y-1 w-24 flex-shrink-0">
          {(['speed', 'stamina', 'agility'] as const).map((key) => {
            const t = breed.statTendencies[key];
            return (
              <div key={key} className="flex flex-col gap-0.5">
                <span className="text-[8px] uppercase tracking-widest text-[var(--text-muted)]">
                  {STAT_DISPLAY[key]}
                </span>
                <div className="h-1 rounded-full bg-[var(--celestial-navy-700)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--gold-700)] to-[var(--gold-primary)]"
                    style={{ width: `${t.avg}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected badge */}
        {isSelected && (
          <Star
            className="w-4 h-4 fill-[var(--gold-primary)] text-[var(--gold-primary)] flex-shrink-0"
            aria-label="Selected"
          />
        )}
      </button>

      {/* Expandable lore + full stats (desktop list view) */}
      {isSelected && (
        <div className="px-3 pb-3 border-t border-[rgba(201,162,39,0.15)]">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-[var(--gold-primary)] hover:text-[var(--gold-light)] mt-2 transition-colors focus-visible:outline-none"
          >
            {expanded ? '▲ Less detail' : '▼ More detail'}
          </button>
          {expanded && (
            <div className="mt-2 space-y-3">
              <p className="text-xs text-white/70 font-[var(--font-body)] italic leading-relaxed">
                {breed.loreBlurb}
              </p>
              <StatBars tendencies={breed.statTendencies} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton placeholders ──────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[rgba(100,130,165,0.15)] bg-[rgba(10,22,50,0.4)] p-3 animate-pulse"
        >
          <div className="w-full aspect-square rounded-lg bg-[var(--bg-midnight)] mb-2" />
          <div className="h-3 rounded bg-[var(--celestial-navy-700)] w-3/4 mb-2" />
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-1 rounded-full bg-[var(--celestial-navy-700)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-xl border border-[rgba(100,130,165,0.15)] bg-[rgba(10,22,50,0.4)] animate-pulse"
        >
          <div className="w-12 h-12 rounded-lg bg-[var(--bg-midnight)] flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 rounded bg-[var(--celestial-navy-700)] w-1/3" />
            <div className="h-2 rounded bg-[var(--bg-midnight)] w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main BreedSelector ─────────────────────────────────────────────────────────

export function BreedSelector({ breeds, value, onChange }: BreedSelectorProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const selectedBreed = breeds.find((b) => b.id === value.breedId) ?? null;

  function selectBreed(breed: Breed) {
    onChange({ ...value, breedId: breed.id, breedName: breed.name });
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

      {/* ── Breed grid / list ── */}
      <div
        className="max-h-64 overflow-y-auto scroll-area-celestial pr-1"
        role="listbox"
        aria-label="Horse breeds"
        aria-multiselectable="false"
      >
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {breeds.map((breed) => (
              <BreedCard
                key={breed.id}
                breed={breed}
                isSelected={value.breedId === breed.id}
                onSelect={() => selectBreed(breed)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {breeds.map((breed) => (
              <BreedRow
                key={breed.id}
                breed={breed}
                isSelected={value.breedId === breed.id}
                onSelect={() => selectBreed(breed)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Lore blurb for selected breed ── */}
      {selectedBreed && (
        <div className="rounded-xl p-3 bg-[rgba(201,162,39,0.06)] border border-[rgba(201,162,39,0.18)]">
          <p className="text-xs italic text-white/70 font-[var(--font-body)] leading-relaxed">
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
                  ? 'border-[var(--gold-primary)] bg-[rgba(201,162,39,0.12)] text-[var(--gold-primary)]'
                  : 'border-[rgba(100,130,165,0.25)] bg-[rgba(10,22,50,0.4)] text-[var(--text-muted)] hover:border-[rgba(201,162,39,0.35)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {g === 'Mare' ? '♀' : '♂'} {g}
            </button>
          ))}
        </div>
      </div>

      {/* ── Name input ── */}
      <div>
        <label
          htmlFor="horse-name-input"
          className="block text-xs text-[var(--text-muted)] font-[var(--font-body)] uppercase tracking-widest mb-2"
        >
          Name Your Horse
        </label>
        <input
          id="horse-name-input"
          type="text"
          value={value.horseName ?? ''}
          onChange={setHorseName}
          placeholder="e.g. Midnight Comet"
          maxLength={40}
          className="celestial-input w-full rounded-lg"
          data-testid="horse-name-input"
        />

        {/* Live preview chip */}
        {(value.horseName ?? '').length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] font-[var(--font-body)]">
              Preview:
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[rgba(201,162,39,0.12)] border border-[rgba(201,162,39,0.3)] text-[var(--gold-primary)] font-[var(--font-heading)]">
              {value.horseName}
              {value.breedName ? ` · ${value.breedName}` : ''}
              {value.gender ? ` · ${value.gender}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Loading & Error states (for parent to render) ──────────────────────────────

export function BreedSelectorSkeleton({ viewMode = 'grid' }: { viewMode?: 'grid' | 'list' }) {
  return viewMode === 'grid' ? <GridSkeleton /> : <ListSkeleton />;
}
