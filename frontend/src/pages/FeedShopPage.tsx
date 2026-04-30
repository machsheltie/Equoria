/**
 * FeedShopPage — World > Feed Shop (feed-system redesign 2026-04-29, Equoria-ymq2).
 *
 * Single-screen bulk-pack purchase UI for the 5-tier feed catalog. Inventory
 * is pooled at the user level (User.settings.inventory) — feed bought here
 * accumulates on the user's inventory row; equipping a tier to a specific
 * horse is a separate flow on the horse-detail page.
 *
 * Replaces the prior two-tab (Horses + Shop) per-horse-purchase UI from
 * Epic 10. The old `HorsesNutritionTab` and per-horse purchase state have
 * been removed entirely.
 *
 * Data hooks:
 *   useFeedCatalog()   — GET /api/v1/feed-shop/catalog (5 tiers)
 *   usePurchaseFeed()  — POST /api/v1/feed-shop/purchase ({ feedTier, packs })
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, AlertCircle, Leaf } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { useFeedCatalog, usePurchaseFeed, FeedItem } from '@/hooks/api/useFeedShop';

const FeedShopPage: React.FC = () => {
  const { data: catalog, isLoading, isError, error } = useFeedCatalog();
  const purchase = usePurchaseFeed();
  const [packsByTier, setPacksByTier] = useState<Record<string, number>>({});

  const handlePurchase = (tier: FeedItem) => {
    const packs = packsByTier[tier.id] ?? 1;
    purchase.mutate(
      { feedTier: tier.id, packs },
      {
        onSuccess: () => toast.success(`Purchased ${100 * packs} units of ${tier.name}.`),
        onError: (err) => toast.error((err as { message?: string })?.message ?? 'Purchase failed.'),
      }
    );
  };

  return (
    <div>
      <PageHero
        title="Feed Shop"
        subtitle="Buy feed in 100-unit packs. Stocked feed lives in your inventory; equip it to a horse from the horse page."
        mood="nature"
        icon={<Leaf className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
          <Link to="/world" className="hover:text-[var(--cream)] transition-colors">
            World
          </Link>
          <span>/</span>
          <span className="text-[var(--cream)]">Feed Shop</span>
        </div>
      </PageHero>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading && (
          <div className="flex justify-center py-16" data-testid="feed-shop-loading">
            <Loader2 className="w-8 h-8 animate-spin text-white/30" />
          </div>
        )}
        {isError && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20 text-[var(--status-danger)] text-sm"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>{error?.message ?? 'Could not load the feed catalog.'}</span>
          </div>
        )}

        {catalog && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="feed-shop-grid">
            {catalog.map((tier) => {
              const packs = packsByTier[tier.id] ?? 1;
              const totalCost = (tier.packPrice ?? 0) * packs;
              const totalUnits = 100 * packs;
              return (
                <div
                  key={tier.id}
                  className="bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] rounded-xl p-5"
                  data-testid={`feed-tier-${tier.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-[var(--cream)]">{tier.name}</h3>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {tier.packPrice} coins / 100-unit pack
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mb-3">{tier.description}</p>
                  <div className="text-xs text-[var(--text-muted)] mb-3 space-y-0.5">
                    <div>
                      Stat-boost roll: <strong>{tier.statRollPct}%</strong>
                    </div>
                    <div>
                      Pregnancy bonus: <strong>+{tier.pregnancyBonusPct}%</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() =>
                        setPacksByTier((p) => ({ ...p, [tier.id]: Math.max(1, packs - 1) }))
                      }
                      disabled={packs <= 1}
                      className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label={`Decrease packs of ${tier.name}`}
                      data-testid={`pack-decrement-${tier.id}`}
                    >
                      −
                    </button>
                    <span
                      className="px-3 text-sm font-medium text-[var(--cream)]"
                      data-testid={`pack-count-${tier.id}`}
                    >
                      {packs}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPacksByTier((p) => ({ ...p, [tier.id]: packs + 1 }))}
                      className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                      aria-label={`Increase packs of ${tier.name}`}
                      data-testid={`pack-increment-${tier.id}`}
                    >
                      +
                    </button>
                    <span className="ml-auto text-xs text-[var(--text-muted)]">
                      Total: {totalCost} coins
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePurchase(tier)}
                    disabled={purchase.isPending}
                    className="w-full py-2 rounded-lg bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)] hover:bg-[var(--status-success)]/20 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                    data-testid={`buy-${tier.id}`}
                    data-onboarding-target={
                      tier.id === 'basic' ? 'feed-shop-purchase-button' : undefined
                    }
                  >
                    {purchase.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin inline" />
                    ) : (
                      `Buy ${totalUnits} units (${totalCost} coins)`
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedShopPage;
