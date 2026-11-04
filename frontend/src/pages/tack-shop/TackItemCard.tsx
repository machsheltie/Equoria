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
import { InlineError } from '@/components/ui/state';
import type { TackItem } from '@/hooks/api/useTackShop';
import { categoryIcons, tierColors } from './constants';

interface TackItemCardProps {
  item: TackItem;
  onPurchase: (_item: TackItem) => void;
  isPurchasing: boolean;
  /** Mapped copy for this item's failed purchase, shown under its Buy button (q173). */
  errorMessage?: string | null;
}

export const TackItemCard: React.FC<TackItemCardProps> = ({
  item,
  onPurchase,
  isPurchasing,
  errorMessage = null,
}) => {
  const tierStyle = tierColors[item.tier] ?? tierColors.basic;

  const media = item.image ? (
    <img src={item.image} alt={item.name} className="w-20 h-20 object-contain" />
  ) : (
    <div className="w-20 h-20 rounded-[var(--radius-md)] bg-[var(--glass-surface-subtle-bg)] flex items-center justify-center">
      <span className="text-3xl" aria-hidden="true">
        {item.icon ?? categoryIcons[item.category] ?? '🏷️'}
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

  const button = (
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
  const action = errorMessage ? (
    <div className="flex flex-col gap-1">
      {button}
      <InlineError message={errorMessage} />
    </div>
  ) : (
    button
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
