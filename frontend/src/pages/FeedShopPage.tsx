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

const FEED_IMAGES: Record<FeedItem['id'], string> = {
  basic: '/images/feed/basicfeed.png',
  performance: '/images/feed/performancefeed.png',
  performancePlus: '/images/feed/performanceplusfeed.png',
  highPerformance: '/images/feed/highperformancefeed.png',
  elite: '/images/feed/elitefeed.png',
};

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

      {/* Banner image in glass card */}
      <div className="max-w-[52rem] mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-4">
        <div className="p-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] shadow-lg shadow-black/20">
          <img
            src="/images/feedstore.webp"
            alt="Starlight Feeds — a warm feed shop with wooden shelves of grain and supplements"
            className="w-full h-auto rounded-xl"
          />
        </div>
      </div>

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="feed-shop-grid">
            {catalog.map((tier) => {
              const packs = packsByTier[tier.id] ?? 1;
              const totalCost = (tier.packPrice ?? 0) * packs;
              const totalUnits = 100 * packs;
              return (
                <div
                  key={tier.id}
                  className="bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] rounded-xl p-5 flex gap-4"
                  data-testid={`feed-tier-${tier.id}`}
                >
                  <img
                    src={FEED_IMAGES[tier.id]}
                    alt={`${tier.name} feed bag`}
                    loading="lazy"
                    className="shrink-0 w-24 h-24 sm:w-32 sm:h-32 lg:w-[200px] lg:h-[200px] object-contain rounded-lg bg-black/20"
                  />
                  <div className="flex-1 min-w-0 flex flex-col">
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
                    <div className="mt-auto">
                      <div className="flex items-center gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() =>
                            setPacksByTier((p) => ({ ...p, [tier.id]: Math.max(1, packs - 1) }))
                          }
                          disabled={packs <= 1}
                          className="w-8 h-8 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)] text-[var(--bg-deep-space)] font-bold shadow-[0_2px_10px_rgba(201,162,39,0.35)] hover:brightness-110 hover:shadow-[0_3px_14px_rgba(201,162,39,0.5)] active:scale-[0.95] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
                          className="w-8 h-8 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)] text-[var(--bg-deep-space)] font-bold shadow-[0_2px_10px_rgba(201,162,39,0.35)] hover:brightness-110 hover:shadow-[0_3px_14px_rgba(201,162,39,0.5)] active:scale-[0.95] transition-all"
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
                        className="btn-cobalt w-full rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)] text-[var(--bg-deep-space)] font-semibold tracking-wide font-[var(--font-heading)] px-6 py-3 text-sm uppercase shadow-[0_4px_20px_rgba(201,162,39,0.4)] hover:brightness-110 hover:shadow-[0_6px_28px_rgba(201,162,39,0.55)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
                  </div>
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
