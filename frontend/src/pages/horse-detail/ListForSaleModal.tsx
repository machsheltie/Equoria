/**
 * ListForSaleModal — dialog that takes a price input and lists the
 * horse on the player marketplace.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 *
 * Design-system migration (Equoria-o5hub.20 / DECISIONS.md §8): the
 * page-local `fixed inset-0` overlay is replaced by the canonical
 * GameDialog (Radix-backed focus trap / Escape / scroll-lock). The price
 * field uses FormField + canonical Input; close is prevented while the
 * list mutation is pending (pending-close rule, handoff §6.6).
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
} from '@/components/ui/game';
import { FormField, Input } from '@/components/ui/form';
import { useListHorse } from '@/hooks/api/useMarketplace';

interface ListForSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  horseId: number;
  horseName: string;
  onSuccess: () => void;
}

const ListForSaleModal: React.FC<ListForSaleModalProps> = ({
  isOpen,
  onClose,
  horseId,
  horseName,
  onSuccess,
}) => {
  const [listPrice, setListPrice] = useState('');
  const listHorseMutation = useListHorse();

  const handleClose = () => {
    setListPrice('');
    onClose();
  };

  // Render nothing while closed (parity with the pre-migration overlay).
  if (!isOpen) return null;

  return (
    <GameDialog
      open={isOpen}
      onOpenChange={(open) => {
        // Pending-close prevention: ignore close requests while listing.
        if (!open && !listHorseMutation.isPending) handleClose();
      }}
    >
      <GameDialogContent size="sm" data-testid="list-for-sale-modal">
        <GameDialogHeader>
          <GameDialogTitle>List for Sale</GameDialogTitle>
          <GameDialogDescription>
            Set a price for <span className="text-role-secondary font-medium">{horseName}</span>.
            Other players will be able to purchase this horse.
          </GameDialogDescription>
        </GameDialogHeader>

        <div className="pt-4">
          <FormField label="Price (coins)" className="mb-5">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="number"
                min={100}
                max={9999999}
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="Min 100 — Max 9,999,999"
              />
            )}
          </FormField>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={handleClose}
              disabled={listHorseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={listHorseMutation.isPending || !listPrice || Number(listPrice) < 100}
              onClick={() => {
                listHorseMutation.mutate(
                  { horseId, price: Number(listPrice) },
                  {
                    onSuccess: () => {
                      setListPrice('');
                      onClose();
                      onSuccess();
                    },
                  }
                );
              }}
            >
              {listHorseMutation.isPending ? 'Listing…' : 'Confirm'}
            </Button>
          </div>
        </div>
      </GameDialogContent>
    </GameDialog>
  );
};

export default ListForSaleModal;
