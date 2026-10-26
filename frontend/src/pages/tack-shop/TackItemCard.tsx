/**
 * TackItemCard (extracted from TackShopPage — Equoria-f5xni)
 *
 * A single purchasable tack item rendered as a shared ItemCard. Owns the
 * tier badge, discipline/age-restriction meta chips, and the
 * Buy action button. Pure presentational: all
 * purchase behavior is delegated to the onPurchase callback.
 *
 * Design-system migration (Equoria-o5hub, world-services family): canonical
 * Button for the purchase action, Currency for the price, semantic role
 * tokens for the meta chips.
 */

import React from 'react';
import { ItemCard } from '@/components/ui/ItemCard';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import type { TackItem } from '@/hooks/api/useTackShop';
import { CATEGORY_ICONS, TIER_COLORS } from './constants';

interface TackItemCardProps {
  item: TackItem;
  onPurchase: (_item: TackItem) => void;
  isPurchasing: boolean;
}

export const TackItemCard: React.FC<TackItemCardProps> = ({ item, onPurchase, isPurchasing }) => {
  const tierStyle = TIER_COLORS[item.tier] ?? TIER_COLORS.basic;

  const media = item.image ? (
    <img src={item.image} alt={item.name} className="w-20 h-20 object-contain" />
  ) : (
    <div className="w-20 h-20 rounded-[var(--radius-md)] bg-[var(--glass-surface-subtle-bg)] flex items-center justify-center">
      <span className="text-3xl" aria-hidden="true">
        {item.icon ?? CATEGORY_ICONS[item.category] ?? '🏷️'}
      </span>
    </div>
  );

  const meta = (
    <>
      <span
        className={`text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-[var(--radius-sm)] ${tierStyle.bg} ${tierStyle.text}`}
      >
        {tierStyle.label}
      </span>
      {item.bonus && (
        <span className="text-2xs text-[var(--gold-light)] font-medium">{item.bonus}</span>
      )}
      {item.comingSoon && (
        <span className="text-2xs text-[var(--text-muted)] font-medium">Coming soon</span>
      )}
      {item.disciplines.map((d) => (
        <span
          key={d}
          className="text-2xs px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--glass-glow)] text-[var(--text-secondary)]"
        >
          {d}
        </span>
      ))}
      {item.ageRestriction && (
        <span className="text-2xs px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--badge-rare-bg)] text-[var(--status-rare)] font-medium">
          ≤ {item.ageRestriction} yrs
        </span>
      )}
    </>
  );

  const action = (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={isPurchasing}
      pending={isPurchasing}
      onClick={() => onPurchase(item)}
      className="w-full"
      data-testid={`buy-${item.id}`}
    >
      Buy
    </Button>
  );

  return (
    <ItemCard
      data-testid={`tack-item-${item.id}`}
      media={media}
      title={item.name}
      description={item.description}
      meta={meta}
      price={<Currency amount={item.cost} />}
      action={action}
    />
  );
};
