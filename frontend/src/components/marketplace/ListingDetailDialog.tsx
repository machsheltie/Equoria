/**
 * ListingDetailDialog — marketplace listing detail + purchase confirmation
 * (Story 21-4 → GameDialog, DECISIONS.md §8).
 *
 * Extracted from HorseMarketplacePage under Equoria-cvsfk when the page
 * crossed the 600-line source cap. Two-step flow: detail view (Buy Now gated
 * on real balance) → confirm view (balance / price / remaining breakdown).
 */

import React, { useState, useCallback } from 'react';
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
  const [step, setStep] = useState<'detail' | 'confirm'>('detail');
  const buyMutation = useBuyHorse();

  const canBuy = userBalance >= listing.salePrice;
  const remaining = userBalance - listing.salePrice;

  const handleConfirm = useCallback(() => {
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
          <GameDialogTitle>
            {step === 'confirm' ? 'Confirm Purchase' : listing.name}
          </GameDialogTitle>
          <GameDialogDescription id="listing-detail-description">
            {step === 'confirm'
              ? `Confirm buying ${listing.name} from ${listing.seller}.`
              : `${listing.breed} · ${listing.age ?? '?'} yr · ${listing.sex} · Seller: ${listing.seller}`}
          </GameDialogDescription>
        </GameDialogHeader>

        {step === 'detail' ? (
          <>
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
                disabled={!canBuy}
                onClick={() => setStep('confirm')}
                title={!canBuy ? 'Insufficient funds' : undefined}
              >
                Buy Now
              </Button>
            </GameDialogFooter>
          </>
        ) : (
          <>
            <GameDialogBody>
              <p className="text-sm text-[var(--text-secondary)] text-center mb-4">
                You are about to spend{' '}
                <Currency
                  amount={listing.salePrice}
                  showIcon={false}
                  className="text-[var(--role-success-text)] font-bold"
                />{' '}
                coins
              </p>
              <Surface variant="subtle" className="space-y-2 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Your balance</span>
                  <Currency amount={userBalance} className="text-[var(--text-primary)]" />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Purchase price</span>
                  <Currency amount={-listing.salePrice} variant="signed" showIcon={false} />
                </div>
                <div className="border-t border-[var(--glass-border)] pt-2 flex justify-between text-sm font-bold">
                  <span className="text-[var(--text-secondary)]">Remaining</span>
                  <Currency
                    amount={remaining}
                    className={remaining >= 0 ? 'text-[var(--text-primary)]' : 'text-role-danger'}
                  />
                </div>
              </Surface>
            </GameDialogBody>
            <GameDialogFooter>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setStep('detail')}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={buyMutation.isPending}
                pending={buyMutation.isPending}
                onClick={handleConfirm}
              >
                Confirm Purchase
              </Button>
            </GameDialogFooter>
          </>
        )}
      </GameDialogContent>
    </GameDialog>
  );
};

export default ListingDetailDialog;
