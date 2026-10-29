/**
 * ListingDetailDialog — marketplace listing detail with a one-click buy
 * (Story 21-4 → GameDialog, DECISIONS.md §8).
 *
 * Extracted from HorseMarketplacePage under Equoria-cvsfk when the page
 * crossed the 600-line source cap. The price is on the Buy button and one
 * click buys (owner ruling 2026-10-26: no confirm pages, no receipts —
 * Equoria-wmjc0). Old contract: a second "Confirm Purchase" step with a
 * balance / price / remaining breakdown.
 */

import React, { useCallback } from 'react';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import { useBuyHorse } from '@/hooks/api/useMarketplace';
import type { MarketplaceListing } from '@/lib/api-client';
import { getHorseImage } from '@/lib/breed-images';

export interface ListingDetailDialogProps {
  listing: MarketplaceListing;
  userBalance: number;
  onClose: () => void;
  onPurchased: (_horseName: string) => void;
}

export const ListingDetailDialog: React.FC<ListingDetailDialogProps> = ({
  listing,
  userBalance,
  onClose,
  onPurchased,
}) => {
  const buyMutation = useBuyHorse();

  const canBuy = userBalance >= listing.salePrice;

  const handleBuy = useCallback(() => {
    buyMutation.mutate(listing.id, {
      onSuccess: () => onPurchased(listing.name),
    });
  }, [buyMutation, listing.id, listing.name, onPurchased]);

  return (
    <GameDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <GameDialogContent
        size="md"
        data-testid="listing-detail-dialog"
        aria-describedby="listing-detail-description"
      >
        <GameDialogHeader>
          <GameDialogTitle>{listing.name}</GameDialogTitle>
          <GameDialogDescription id="listing-detail-description">
            {`${listing.breed} · ${listing.age ?? '?'} yr · ${listing.sex} · Seller: ${listing.seller}`}
          </GameDialogDescription>
        </GameDialogHeader>

        <GameDialogBody>
          <div className="flex gap-4 mb-5">
            <div className="w-28 h-28 rounded-[var(--radius-md)] overflow-hidden bg-[var(--glass-surface-subtle-bg)] border border-[var(--glass-border)] flex-shrink-0">
              <img
                src={getHorseImage(listing.imageUrl, listing.breed)}
                alt={listing.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">
                {listing.breed} · {listing.age ?? '?'} yr · {listing.sex}
              </p>
              <p className="text-xs text-[var(--text-muted)] mb-3">Seller: {listing.seller}</p>
              <Currency
                amount={listing.salePrice}
                className="text-2xl font-bold text-[var(--role-success-text)]"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(listing.stats).map(([stat, val]) => (
              <Surface variant="subtle" key={stat} className="p-2 text-center">
                <p className="text-lg font-bold text-[var(--text-primary)]">{val}</p>
                <p className="text-xs text-[var(--text-muted)] capitalize">{stat}</p>
              </Surface>
            ))}
          </div>
          {!canBuy && (
            <p className="text-xs text-role-danger mt-4 text-center">
              Insufficient funds — you need{' '}
              <Currency amount={listing.salePrice - userBalance} showIcon={false} /> more coins
            </p>
          )}
        </GameDialogBody>
        <GameDialogFooter>
          <Button
            type="button"
            className="w-full"
            disabled={!canBuy || buyMutation.isPending}
            pending={buyMutation.isPending}
            onClick={handleBuy}
            title={!canBuy ? 'Insufficient funds' : undefined}
          >
            Buy now for <Currency amount={listing.salePrice} />
          </Button>
        </GameDialogFooter>
      </GameDialogContent>
    </GameDialog>
  );
};

export default ListingDetailDialog;
