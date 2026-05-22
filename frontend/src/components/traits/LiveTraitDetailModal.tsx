/**
 * LiveTraitDetailModal — real-data trait detail dialog (Equoria-vpgmc)
 *
 * Opens when a user clicks / keyboard-activates a trait card on the Genetics
 * tab, replacing the legacy hover-only tooltip as the PRIMARY detail
 * affordance. Built on BaseModal (focus trap, Escape close, backdrop click).
 *
 * Consumes the HorseTrait view model from useHorseTraits (real
 * /api/v1/traits/horse/:id data) — name, authoritative valence, description,
 * rarity, category. It deliberately does NOT render tier / per-discipline
 * competition-impact matrix / epigenetic-flag chips because the backend trait
 * endpoint does not provide that data; surfacing fabricated values would
 * violate the no-fake-product-values doctrine.
 */

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import BaseModal from '@/components/common/BaseModal';
import type { HorseTrait } from '@/hooks/useHorseTraits';

export interface LiveTraitDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  trait: HorseTrait | null;
}

const LiveTraitDetailModal: React.FC<LiveTraitDetailModalProps> = ({ isOpen, onClose, trait }) => {
  if (!trait) return null;

  const isPositive = trait.valence === 'positive';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={trait.name}
      size="md"
      data-testid="trait-detail-modal"
    >
      <div className="space-y-4" data-testid="trait-detail-content">
        {/* Valence banner — icon + text, not color-only */}
        <div
          data-testid="trait-detail-valence"
          className={`flex items-center gap-2 rounded-lg border p-3 ${
            isPositive
              ? 'border-emerald-500/30 bg-[rgba(16,185,129,0.1)]'
              : 'border-red-500/30 bg-[rgba(239,68,68,0.1)]'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-400" aria-hidden="true" />
          )}
          <span
            className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {isPositive ? 'Beneficial Trait' : 'Detrimental Trait'}
          </span>
        </div>

        {/* Description */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Description
          </h4>
          <p className="text-sm text-[rgb(220,235,255)] leading-relaxed">
            {trait.description || 'No description available for this trait.'}
          </p>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-2">
          {trait.rarity && (
            <span className="text-xs px-2 py-1 rounded-full bg-[rgba(37,99,235,0.15)] text-[rgb(160,175,200)] capitalize">
              Rarity: {trait.rarity}
            </span>
          )}
          {trait.category && (
            <span className="text-xs px-2 py-1 rounded-full bg-[rgba(37,99,235,0.15)] text-[rgb(160,175,200)] capitalize">
              {trait.category}
            </span>
          )}
        </div>

        <p className="text-sm text-slate-400">
          This trait {isPositive ? 'provides benefits' : 'presents challenges'} for this
          horse&apos;s development and competition performance.
        </p>
      </div>
    </BaseModal>
  );
};

export default LiveTraitDetailModal;
