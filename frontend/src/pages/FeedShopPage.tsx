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
 * Cards use the shared ItemCard + CardGrid so this page stops being the
 * giant-2-column outlier (was lg:grid-cols-2; now matches Inventory/Equip).
 *
 * Design-system migration (Equoria-o5hub, world-services family): PageHero
 * retained (genuine location artwork), PageContainer variants replace local
 * max-w wrappers, Surface replaces the local glass recipe, SectionLoading /
 * ErrorState for async states, Currency for prices, Button for the pack
 * stepper and purchase actions.
 *
 * Data hooks:
 *   useFeedCatalog()   — GET /api/v1/feed-shop/catalog (5 tiers)
 *   usePurchaseFeed()  — POST /api/v1/feed-shop/purchase ({ feedTier, packs })
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Leaf } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import { CardGrid } from '@/components/ui/CardGrid';
import { ItemCard } from '@/components/ui/ItemCard';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import { useFeedCatalog, usePurchaseFeed, FeedItem } from '@/hooks/api/useFeedShop';

const FEED_IMAGES: Record<FeedItem['id'], string> = {
  basic: '/images/feed/basicfeed.png',
  performance: '/images/feed/performancefeed.png',
  performancePlus: '/images/feed/performanceplusfeed.png',
  highPerformance: '/images/feed/highperformancefeed.png',
  elite: '/images/feed/elitefeed.png',
};

const FeedShopPage: React.FC = () => {
  const { data: catalog, isLoading, isError, error, refetch } = useFeedCatalog();
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
        icon={<Leaf className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
        >
          <Link to="/world" className="hover:text-[var(--text-primary)] transition-colors">
            World
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-[var(--text-primary)]">Feed Shop</span>
        </nav>
      </PageHero>

      {/* Banner image in glass card */}
      <PageContainer variant="content" padded={false} className="pt-1 pb-4">
        <Surface variant="panel">
          <img
            src="/images/feedstore.webp"
            alt="Starlight Feeds — a warm feed shop with wooden shelves of grain and supplements"
            className="w-full h-auto rounded-[var(--radius-md)]"
          />
        </Surface>
      </PageContainer>

      <PageContainer variant="wide" padded={false} className="py-6">
        {isLoading && (
          <div data-testid="feed-shop-loading">
            <SectionLoading label="Loading the feed catalog" minHeight="200px" />
          </div>
        )}
        {isError && (
          <ErrorState
            title="Feed Catalog Unavailable"
            message={error?.message ?? 'Could not load the feed catalog.'}
            retry={{ label: 'Try Again', onClick: () => refetch() }}
          />
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
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setPacksByTier((p) => ({ ...p, [tier.id]: Math.max(1, packs - 1) }))
                        }
                        disabled={packs <= 1}
                        className="w-9 px-0"
                        aria-label={`Decrease packs of ${tier.name}`}
                        data-testid={`pack-decrement-${tier.id}`}
                      >
                        −
                      </Button>
                      <span
                        className="px-2 text-sm font-medium text-[var(--text-primary)] tabular-nums"
                        data-testid={`pack-count-${tier.id}`}
                      >
                        {packs}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setPacksByTier((p) => ({ ...p, [tier.id]: packs + 1 }))}
                        className="w-9 px-0"
                        aria-label={`Increase packs of ${tier.name}`}
                        data-testid={`pack-increment-${tier.id}`}
                      >
                        +
                      </Button>
                      <Currency
                        amount={totalCost}
                        className="ml-auto text-[0.7rem] text-[var(--text-muted)] tabular-nums"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handlePurchase(tier)}
                      disabled={purchase.isPending}
                      pending={purchase.isPending}
                      className="w-full"
                      data-testid={`buy-${tier.id}`}
                      data-onboarding-target={
                        tier.id === 'basic' ? 'feed-shop-purchase-button' : undefined
                      }
                    >
                      {`Buy ${totalUnits} units`}
                    </Button>
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
                    subtitle={
                      <span className="inline-flex items-center gap-1">
                        <Currency amount={tier.packPrice ?? 0} /> / 100-unit pack
                      </span>
                    }
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
      </PageContainer>
    </div>
  );
};

export default FeedShopPage;
