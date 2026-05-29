/**
 * ListForSaleModal — modal that takes a price input and lists the
 * horse on the player marketplace.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  if (!isOpen) return null;

  const handleClose = () => {
    setListPrice('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm glass-panel-heavy rounded-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white/90">List for Sale</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-white/60 mb-4">
          Set a price for <span className="text-white/90 font-medium">{horseName}</span>. Other
          players will be able to purchase this horse.
        </p>
        <div className="mb-5">
          <label className="block text-xs text-white/50 mb-1.5">Price (coins)</label>
          <input
            type="number"
            min={100}
            max={9999999}
            value={listPrice}
            onChange={(e) => setListPrice(e.target.value)}
            placeholder="Min 100 — Max 9,999,999"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white/90 text-sm focus:outline-none focus:border-white/40"
          />
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
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
    </div>
  );
};

export default ListForSaleModal;
