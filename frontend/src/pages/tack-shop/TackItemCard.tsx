/**
 * TackItemCard (extracted from TackShopPage — Equoria-f5xni)
 *
 * A single purchasable tack item rendered as a shared ItemCard. Owns the
 * tier badge, discipline/age-restriction meta chips, and the
 * purchase-for-selected-horse action button. Pure presentational: all
 * purchase behavior is delegated to the onPurchase callback.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { ItemCard } from '@/components/ui/ItemCard';
import type { TackItem } from '@/hooks/api/useTackShop';
import type { HorseSummary } from '@/lib/api-client';
import { CATEGORY_ICONS, TIER_COLORS } from './constants';

interface TackItemCardProps {
  item: TackItem;
  selectedHorse: HorseSummary | null;
  onPurchase: (_item: TackItem) => void;
  isPurchasing: boolean;
}

export const TackItemCard: React.FC<TackItemCardProps> = ({
  item,
  selectedHorse,
  onPurchase,
  isPurchasing,
}) => {
  const canPurchase = selectedHorse !== null && !isPurchasing;
  const tierStyle = TIER_COLORS[item.tier] ?? TIER_COLORS.basic;

  const buttonLabel = selectedHorse
    ? isPurchasing
      ? 'Purchasing…'
      : `Buy for ${selectedHorse.name}`
    : 'Select a Horse';

  const media = item.image ? (
    <img src={item.image} alt={item.name} className="w-20 h-20 object-contain" />
  ) : (
    <div className="w-20 h-20 rounded-lg bg-black/20 flex items-center justify-center">
      <span className="text-3xl" aria-hidden="true">
        {item.icon ?? CATEGORY_ICONS[item.category] ?? '🏷️'}
      </span>
    </div>
  );

  const meta = (
    <>
      <span
        className={`text-[0.6rem] font-semibold uppercase px-1.5 py-0.5 rounded ${tierStyle.bg} ${tierStyle.text}`}
      >
        {tierStyle.label}
      </span>
      {item.bonus && (
        <span className="text-[0.65rem] text-[var(--gold-light)] font-medium">{item.bonus}</span>
      )}
      {item.disciplines.map((d) => (
        <span
          key={d}
          className="text-[0.6rem] px-1.5 py-0.5 rounded bg-[var(--glass-glow)] text-[var(--text-muted)]"
        >
          {d}
        </span>
      ))}
      {item.ageRestriction && (
        <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">
          ≤ {item.ageRestriction} yrs
        </span>
      )}
    </>
  );

  const action = (
    <button
      type="button"
      disabled={!canPurchase}
      onClick={() => canPurchase && onPurchase(item)}
      className={`w-full py-2 text-sm font-medium rounded-lg transition-all ${
        canPurchase
          ? 'bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)] hover:bg-[var(--status-success)]/20 hover:border-[var(--status-success)]/40 cursor-pointer'
          : 'bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)]/60 cursor-not-allowed'
      }`}
      title={
        canPurchase
          ? `Purchase ${item.name} for ${selectedHorse!.name}`
          : 'Select a horse from My Horses to purchase'
      }
    >
      {isPurchasing && canPurchase ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          {buttonLabel}
        </span>
      ) : (
        buttonLabel
      )}
    </button>
  );

  return (
    <ItemCard
      data-testid={`tack-item-${item.id}`}
      media={media}
      title={item.name}
      description={item.description}
      meta={meta}
      price={`$${item.cost.toLocaleString()}`}
      action={action}
    />
  );
};
