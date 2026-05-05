/**
 * FeedShopPage — World > Feed Shop (feed-system redesign 2026-04-29, Equoria-ymq2;
 * UI consistency 2026-05-05, Equoria-unxm).
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
 * Cards now use the shared ItemCard + CardGrid so this page stops being the
 * giant-2-column outlier (was lg:grid-cols-2; now matches Inventory/Equip).
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
import { CardGrid } from '@/components/ui/CardGrid';
import { ItemCard } from '@/components/ui/ItemCard';
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
          <div data-testid="feed-shop-grid">
            <CardGrid aria-label="Feed catalog">
              {catalog.map((tier) => {
                const packs = packsByTier[tier.id] ?? 1;
                const totalCost = (tier.packPrice ?? 0) * packs;
                const totalUnits = 100 * packs;

                const action = (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPacksByTier((p) => ({ ...p, [tier.id]: Math.max(1, packs - 1) }))
                        }
                        disabled={packs <= 1}
                        className="w-8 h-8 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)] text-[var(--bg-deep-space)] font-bold shadow-[0_2px_10px_rgba(201,162,39,0.35)] hover:brightness-110 active:scale-[0.95] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={`Decrease packs of ${tier.name}`}
                        data-testid={`pack-decrement-${tier.id}`}
                      >
                        −
                      </button>
                      <span
                        className="px-2 text-sm font-medium text-[var(--cream)] tabular-nums"
                        data-testid={`pack-count-${tier.id}`}
                      >
                        {packs}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPacksByTier((p) => ({ ...p, [tier.id]: packs + 1 }))}
                        className="w-8 h-8 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)] text-[var(--bg-deep-space)] font-bold shadow-[0_2px_10px_rgba(201,162,39,0.35)] hover:brightness-110 active:scale-[0.95] transition-all"
                        aria-label={`Increase packs of ${tier.name}`}
                        data-testid={`pack-increment-${tier.id}`}
                      >
                        +
                      </button>
                      <span className="ml-auto text-[0.7rem] text-[var(--text-muted)] tabular-nums">
                        {totalCost} coins
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePurchase(tier)}
                      disabled={purchase.isPending}
                      className="btn-cobalt w-full rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)] text-[var(--bg-deep-space)] font-semibold tracking-wide font-[var(--font-heading)] px-3 py-2 text-xs uppercase shadow-[0_4px_20px_rgba(201,162,39,0.4)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      data-testid={`buy-${tier.id}`}
                      data-onboarding-target={
                        tier.id === 'basic' ? 'feed-shop-purchase-button' : undefined
                      }
                    >
                      {purchase.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin inline" />
                      ) : (
                        `Buy ${totalUnits} units`
                      )}
                    </button>
                  </div>
                );

                return (
                  <ItemCard
                    key={tier.id}
                    data-testid={`feed-tier-${tier.id}`}
                    media={
                      <img
                        src={FEED_IMAGES[tier.id]}
                        alt={`${tier.name} feed bag`}
                        loading="lazy"
                        className="w-20 h-20 object-contain"
                      />
                    }
                    title={tier.name}
                    subtitle={`${tier.packPrice} coins / 100-unit pack`}
                    description={tier.description}
                    meta={
                      <span className="text-[0.65rem] text-[var(--text-muted)]">
                        Stat-roll{' '}
                        <strong className="text-[var(--text-secondary)]">
                          {tier.statRollPct}%
                        </strong>{' '}
                        · Pregnancy{' '}
                        <strong className="text-[var(--text-secondary)]">
                          +{tier.pregnancyBonusPct}%
                        </strong>
                      </span>
                    }
                    action={action}
                  />
                );
              })}
            </CardGrid>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedShopPage;
