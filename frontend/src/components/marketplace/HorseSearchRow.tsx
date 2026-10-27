/**
 * HorseSearchRow — one horse in the Marketplace search ledger (Equoria-q4uem.9.1).
 *
 * A row, not a card: portrait, name, plain-words line, revealed traits, and the
 * terms on the right. The name opens the horse's one page. Only revealed traits
 * arrive from the server; names are shown as authored words, never stored codes.
 */

import React from 'react';
import { Link } from 'react-router';
import Currency from '@/components/ui/Currency';
import { Button } from '@/components/ui/button';
import { humanizeTraitKey } from '@/hooks/useHorseTraits';
import { getHorseImage } from '@/lib/breed-images';
import type { MarketplaceListing, MarketplaceSearchHorse } from '@/lib/api-client';

/** The shape the purchase dialog takes. Only called for a horse that is for sale. */
export function toListing(h: MarketplaceSearchHorse): MarketplaceListing {
  return {
    id: h.id,
    name: h.name,
    breed: h.breed,
    age: h.age,
    sex: h.sex,
    salePrice: h.sale?.price ?? 0,
    seller: h.owner.username,
    stats: h.stats,
    imageUrl: h.imageUrl,
  };
}

interface Props {
  horse: MarketplaceSearchHorse;
  onBuy: (_horse: MarketplaceSearchHorse) => void;
}

export const HorseSearchRow: React.FC<Props> = ({ horse, onBuy }) => {
  const { positive, negative } = horse.revealedTraits;
  const traits = [...positive, ...negative];
  const facts = [horse.breed, `${horse.age ?? '?'} yr`, horse.sex, horse.color]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-3 py-4">
      <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border border-[var(--glass-border)] bg-[var(--glass-surface-subtle-bg)]">
        <img
          src={getHorseImage(horse.imageUrl, horse.breed)}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-[12rem]">
        <h3 className="font-[var(--font-entity)] text-xl text-[var(--text-primary)] truncate">
          <Link
            to={`/horses/${horse.id}`}
            className="hover:text-[var(--gold-400)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-primary)] rounded-sm"
          >
            {horse.name}
          </Link>
        </h3>
        <p className="text-sm text-[var(--text-muted)]">
          {facts} · Kept by {horse.owner.username}
        </p>
        {traits.length > 0 && (
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {positive.map((t) => (
              <span key={`p-${t}`} className="mr-3">
                <span aria-hidden="true">✦ </span>
                {humanizeTraitKey(t)}
              </span>
            ))}
            {negative.map((t) => (
              <span key={`n-${t}`} className="mr-3 text-[var(--text-muted)]">
                <span aria-hidden="true">◇ </span>
                {humanizeTraitKey(t)}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2 text-sm min-w-[10rem] ml-auto">
        {horse.stud && (
          <p className="text-[var(--text-secondary)]" data-testid="stud-terms">
            {horse.stud.mode === 'public' ? 'Public Stud' : 'Private Stud'} ·{' '}
            <Currency
              amount={horse.stud.fee}
              className="text-[var(--role-success-text)] font-bold"
            />
          </p>
        )}
        {horse.sale && (
          <div className="flex items-center gap-3" data-testid="sale-terms">
            <span className="text-[var(--text-secondary)]">For sale</span>
            <Currency
              amount={horse.sale.price}
              className="text-[var(--role-success-text)] font-bold"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => onBuy(horse)}
              aria-label={`Buy ${horse.name}`}
            >
              Buy
            </Button>
          </div>
        )}
      </div>
    </li>
  );
};
