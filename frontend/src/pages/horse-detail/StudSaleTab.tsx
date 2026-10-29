/**
 * StudSaleTab — the horse's Stud / Sale area. Story 12-4 / 15-5 / Equoria-q072.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 *
 * Equoria-q4uem.9 (owner rulings q89-q95, q104-q110): a stallion's stud
 * standing is one three-way choice with the fee beside it; "Breed to <name>"
 * breeds one of her mares to her own stallion, free and at once; a
 * "Breeding requests" button lists the requests for this horse. There is no
 * Breeding Hall and no Marketplace link here (q105).
 */

import React from 'react';
import type { Horse } from './HorseDetailPageTypes';
import StudStanding from './stud/StudStanding';
import BreedToStallion from './stud/BreedToStallion';
import BreedingRequests from './stud/BreedingRequests';
import { maxBreedingAge, minBreedingAge } from './stud/studBreeding';
import VisitorStudSale from './stud/VisitorStudSale';
import { InlineError } from '@/components/ui/state';
import { useHorseVisitData } from './horseVisitContext';
import '@/styles/studBreeding.css';

interface StudSaleTabProps {
  horse: Horse;
  onListForSale: () => void;
  onDelist: () => void;
  isDelisting: boolean;
  /** Authored copy for a refused delist, shown under the listing control (q161). */
  delistError?: string;
}

const StudSaleTab: React.FC<StudSaleTabProps> = ({
  horse,
  onListForSale,
  onDelist,
  isDelisting,
  delistError,
}) => {
  // Visitor mode (q205): the same tab, read-only; the visitor's own actions
  // (breed to a stallion at stud, answer a request, buy a listed horse)
  // replace the owner's stud and sale controls.
  const visit = useHorseVisitData();
  const isMale =
    horse.gender?.toLowerCase() === 'stallion' || horse.gender?.toLowerCase() === 'male';
  const isFemale =
    horse.gender?.toLowerCase() === 'mare' || horse.gender?.toLowerCase() === 'female';

  const ageYears = typeof horse.ageYears === 'number' ? horse.ageYears : null;
  const canBreed = ageYears === null || (ageYears >= minBreedingAge && ageYears <= maxBreedingAge);

  return (
    <div className="space-y-6" data-testid="stud-sale-tab">
      <div>
        <h3 className="type-section-heading mb-2">Stud &amp; Sale</h3>
        <p className="fantasy-body text-[var(--text-secondary)] text-sm">
          {horse.name}'s place at stud and on the sale list.
        </p>
      </div>

      {/* Current Listing Status */}
      <div className="p-4 bg-[var(--bg-midnight)] rounded-lg border border-[var(--glass-border)]">
        <p className="fantasy-caption text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-1">
          Current Status
        </p>
        <p className="font-semibold text-lg text-[var(--text-primary)]">
          {horse.forSale
            ? typeof horse.salePrice === 'number'
              ? `Listed for ${horse.salePrice.toLocaleString()} coins`
              : 'Listed for sale'
            : 'Not Listed'}
        </p>
      </div>

      {/* Equoria-8xfo (31F-FE-2) — Conformation Titles block. Hidden when
          horse has never been entered in a conformation show
          (titlePoints === 0 && currentTitle == null). */}
      {((horse.titlePoints ?? 0) > 0 || horse.currentTitle) && (
        <div
          className="p-4 bg-[var(--bg-midnight)] rounded-lg border border-[var(--gold-dim)]"
          data-testid="conformation-titles-block"
        >
          <p className="fantasy-caption text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-2">
            Conformation Titles
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="fantasy-caption text-[var(--text-secondary)] text-2xs uppercase">
                Current Title
              </p>
              <p
                className="font-semibold text-lg text-[var(--gold-light)]"
                data-testid="conformation-current-title"
              >
                {horse.currentTitle ?? '—'}
              </p>
            </div>
            <div>
              <p className="fantasy-caption text-[var(--text-secondary)] text-2xs uppercase">
                Title Points
              </p>
              <p
                className="font-semibold text-lg tabular-nums text-[var(--text-primary)]"
                data-testid="conformation-title-points"
              >
                {(horse.titlePoints ?? 0).toLocaleString()}
              </p>
            </div>
            {horse.breedingValueBoost && horse.breedingValueBoost > 0 ? (
              <div>
                <p className="fantasy-caption text-[var(--text-secondary)] text-2xs uppercase">
                  Breeding Value Boost
                </p>
                <p
                  className="font-semibold text-lg tabular-nums text-[var(--status-success)]"
                  data-testid="conformation-breeding-boost"
                >
                  +{(horse.breedingValueBoost * 100).toFixed(0)}%
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {visit && <VisitorStudSale horse={visit} />}

      {!visit && isMale && (
        <div data-testid="stud-area">
          <StudStanding
            horseId={horse.id}
            horseName={horse.name}
            ageYears={ageYears}
            studStatus={horse.studStatus}
            studFee={horse.studFee}
          />
          {canBreed ? (
            <BreedToStallion
              stallion={{ id: horse.id, name: horse.name, breed: horse.breed || null }}
              kind="own"
              fee={0}
            />
          ) : (
            <p className="stud-quiet">
              {horse.name} can breed from age {minBreedingAge} to {maxBreedingAge}.
            </p>
          )}
          <BreedingRequests side="stallion" horseId={horse.id} horseName={horse.name} />
        </div>
      )}

      {!visit && isFemale && (
        <BreedingRequests side="mare" horseId={horse.id} horseName={horse.name} />
      )}

      {/* Listing Type Buttons */}
      {!visit && (
        <div className="space-y-3">
          {!isFemale && !isMale && (
            <div className="p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)]">
              <p className="fantasy-body text-[var(--text-secondary)] text-sm italic">
                Stud listing is only available for stallions.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={horse.forSale ? onDelist : onListForSale}
            disabled={isDelisting}
            className="w-full flex items-center justify-between p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)] text-left hover:border-[var(--glass-hover)] transition-colors"
            title={horse.forSale ? 'Remove marketplace listing' : 'List horse for sale'}
            data-testid="sale-listing-btn"
          >
            <div>
              <p className="font-semibold text-[var(--text-primary)] text-sm">
                {horse.forSale ? 'Remove Sale Listing' : 'List for Sale'}
              </p>
              <p className="fantasy-body text-[var(--text-secondary)] text-xs mt-0.5">
                {horse.forSale
                  ? 'Take this horse off the Marketplace'
                  : `Place ${horse.name} on the Marketplace for other players to purchase`}
              </p>
            </div>
            <span className="text-xs fantasy-caption text-[var(--text-secondary)]">
              {isDelisting ? 'Saving...' : horse.forSale ? 'Delist' : 'Set Price'}
            </span>
          </button>
          {delistError && <InlineError message={delistError} />}
        </div>
      )}
    </div>
  );
};

export default StudSaleTab;
