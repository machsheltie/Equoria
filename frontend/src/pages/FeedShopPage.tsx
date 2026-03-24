/**
 * FeedShopPage — World > Feed Shop Location (Epic 10 — Story 10-3)
 *
 * The Feed Shop location in the World hub. Two tabs:
 * - My Horses: Real horse list with live feed status, energy level, and per-horse purchase flow
 * - Shop: Live catalog from /api/feed-shop/catalog — handles loading / error / empty states
 *
 * Data hooks:
 *   useHorses()        — /api/horses list
 *   useFeedCatalog()   — /api/feed-shop/catalog
 *   usePurchaseFeed()  — POST /api/feed-shop/purchase
 *
 * Background: DashboardLayout sets feedstore2.webp as the full-viewport bg
 * for this route — no duplicate background here.
 */

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Heart, ShoppingCart, Clock, Loader2, AlertCircle, Zap, Leaf } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { useHorses } from '@/hooks/api/useHorses';
import { useFeedCatalog, usePurchaseFeed, FeedItem } from '@/hooks/api/useFeedShop';
import { HorseSummary } from '@/lib/api-client';
import { getBreedName } from '@/lib/utils';

type FeedShopTab = 'horses' | 'shop';

// ---------------------------------------------------------------------------
// Purchase flow state — lifted into FeedShopPage so both tabs can coordinate
// ---------------------------------------------------------------------------
interface PurchaseState {
  horseId: number | null;
  feedId: string | null;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
const CardSkeleton: React.FC = () => (
  <div className="bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] rounded-xl p-5 animate-pulse">
    <div className="h-5 w-2/3 bg-[var(--glass-bg)] rounded mb-3" />
    <div className="h-3 w-full bg-[var(--glass-bg)] rounded mb-2" />
    <div className="h-3 w-4/5 bg-[var(--glass-bg)] rounded mb-4" />
    <div className="h-8 w-full bg-[var(--glass-bg)] rounded" />
  </div>
);

// ---------------------------------------------------------------------------
// Error message
// ---------------------------------------------------------------------------
const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div
    className="flex items-start gap-3 p-4 rounded-xl bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/20 text-[var(--status-danger)] text-sm"
    role="alert"
  >
    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
    <span>{message}</span>
  </div>
);

// ---------------------------------------------------------------------------
// My Horses tab
// ---------------------------------------------------------------------------
interface HorsesNutritionTabProps {
  purchaseState: PurchaseState;
  onSelectHorse: (_horseId: number | null) => void;
  onPurchase: (_horseId: number, _feedId: string) => void;
  isPurchasing: boolean;
  catalog: FeedItem[] | undefined;
}

const HorsesNutritionTab: React.FC<HorsesNutritionTabProps> = ({
  purchaseState,
  onSelectHorse,
  onPurchase,
  isPurchasing,
  catalog,
}) => {
  const { data: horses, isLoading, isError, error } = useHorses();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="horses-nutrition-tab">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="horses-nutrition-tab">
        <ErrorMessage
          message={error?.message ?? 'Could not load horses. Check your connection and try again.'}
        />
      </div>
    );
  }

  if (!horses || horses.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="horses-nutrition-tab"
      >
        <span className="text-5xl mb-4 select-none" aria-hidden="true">
          🌾
        </span>
        <h2 className="text-lg font-bold text-[var(--text-secondary)] mb-2">
          No Horses Registered
        </h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6">
          Visit your stable to manage feed for your horses. Consistent nutrition keeps energy high
          and prevents performance decline.
        </p>
        <Link
          to="/stable"
          className="px-5 py-2.5 bg-[var(--status-success)]/20 border border-[var(--status-success)]/30 text-[var(--status-success)] rounded-lg text-sm font-medium hover:bg-[var(--status-success)]/30 transition-colors"
        >
          Go to Stable
        </Link>
      </div>
    );
  }

  const selectedHorseId = purchaseState.horseId;

  return (
    <div data-testid="horses-nutrition-tab">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {horses.map((horse: HorseSummary) => {
          const isSelected = selectedHorseId === horse.id;

          return (
            <div
              key={horse.id}
              className={`backdrop-blur-sm border rounded-xl p-5 transition-all ${
                isSelected
                  ? 'bg-[var(--status-success)]/10 border-[var(--status-success)]/50'
                  : 'bg-[var(--glass-bg)] border-[var(--glass-border)] hover:border-[var(--glass-hover)]'
              }`}
              data-testid={`horse-card-${horse.id}`}
            >
              {/* Horse header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-[var(--cream)]">{horse.name}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {getBreedName(horse.breed)} · Age {horse.age}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    horse.healthStatus === 'good'
                      ? 'bg-[var(--status-success)]/10 border-[var(--status-success)]/20 text-[var(--status-success)]'
                      : horse.healthStatus === 'injured'
                        ? 'bg-[var(--status-danger)]/10 border-[var(--status-danger)]/20 text-[var(--status-danger)]'
                        : 'bg-[var(--status-warning)]/10 border-[var(--status-warning)]/20 text-[var(--status-warning)]'
                  }`}
                >
                  {horse.healthStatus}
                </span>
              </div>

              {/* Energy indicator */}
              <div className="flex items-center gap-2 mb-4 text-xs text-[var(--text-muted)]">
                <Zap className="w-3 h-3 text-[var(--status-success)]/60" />
                <span>Energy: Stable</span>
              </div>

              {/* Select / Deselect button */}
              <button
                type="button"
                onClick={() => onSelectHorse(isSelected ? null : horse.id)}
                className={`w-full py-2 text-sm font-medium rounded-lg transition-all ${
                  isSelected
                    ? 'bg-[var(--status-success)]/30 border border-[var(--status-success)]/40 text-[var(--status-success)]'
                    : 'bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-hover)]/20 hover:text-[var(--cream)]'
                }`}
              >
                {isSelected ? 'Selected — choose a feed below' : 'Select to feed'}
              </button>

              {/* Feed picker — only shown for selected horse */}
              {isSelected && catalog && catalog.length > 0 && (
                <div className="mt-4 space-y-2" data-testid={`feed-picker-${horse.id}`}>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Choose a feed:</p>
                  {catalog.map((feed: FeedItem) => {
                    const isChosen = purchaseState.feedId === feed.id;
                    return (
                      <button
                        key={feed.id}
                        type="button"
                        onClick={() => onPurchase(horse.id, feed.id)}
                        disabled={isPurchasing}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                          isChosen
                            ? 'bg-[var(--status-success)]/20 border-[var(--status-success)]/40 text-[var(--status-success)]'
                            : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--status-success)]/30 hover:bg-[var(--status-success)]/5 hover:text-[var(--cream)]'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        data-testid={`purchase-btn-${horse.id}-${feed.id}`}
                      >
                        <span className="flex items-center gap-2">
                          {isPurchasing && isChosen ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <span aria-hidden="true">🌾</span>
                          )}
                          {feed.name}
                        </span>
                        <span className="text-[var(--gold-primary)] font-semibold">
                          {feed.cost.toLocaleString()} coins
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {isSelected && (!catalog || catalog.length === 0) && (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  Feed catalog is loading — switch to the Shop tab.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shop / Catalog tab
// ---------------------------------------------------------------------------
interface ShopTabProps {
  onSelectFeedFromShop: (_feedId: string) => void;
  selectedHorseId: number | null;
  onPurchase: (_horseId: number, _feedId: string) => void;
  isPurchasing: boolean;
  purchaseFeedId: string | null;
}

const ShopTab: React.FC<ShopTabProps> = ({
  onSelectFeedFromShop,
  selectedHorseId,
  onPurchase,
  isPurchasing,
  purchaseFeedId,
}) => {
  const { data: catalog, isLoading, isError, error } = useFeedCatalog();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="feed-shop-tab">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="feed-shop-tab">
        <ErrorMessage
          message={error?.message ?? 'Could not load the feed catalog. Please try again shortly.'}
        />
      </div>
    );
  }

  if (!catalog || catalog.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-64 p-8 text-center"
        data-testid="feed-shop-tab"
      >
        <span className="text-4xl mb-4 select-none" aria-hidden="true">
          🏪
        </span>
        <h2 className="text-lg font-bold text-[var(--text-secondary)] mb-2">
          No Feed Items Available
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          The catalog is currently empty. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="feed-shop-tab">
      {catalog.map((item: FeedItem) => {
        const isChosen = purchaseFeedId === item.id;
        const canPurchase = selectedHorseId !== null;

        return (
          <div
            key={item.id}
            className="bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] rounded-xl p-5 hover:border-[var(--glass-hover)] transition-all"
            data-testid={`feed-item-${item.id}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">
                  🌾
                </span>
                <div>
                  <h3 className="font-bold text-[var(--cream)]">{item.name}</h3>
                  <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {item.billing}
                  </span>
                </div>
              </div>
              <p className="text-lg font-bold text-[var(--gold-primary)]">
                {item.cost.toLocaleString()} coins
              </p>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">{item.description}</p>

            {canPurchase ? (
              <button
                type="button"
                disabled={isPurchasing}
                onClick={() => {
                  onSelectFeedFromShop(item.id);
                  onPurchase(selectedHorseId, item.id);
                }}
                className={`w-full py-2 text-sm font-medium rounded-lg transition-all ${
                  isChosen && isPurchasing
                    ? 'bg-[var(--status-success)]/20 border border-[var(--status-success)]/30 text-[var(--status-success)]/60 cursor-not-allowed'
                    : 'bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)] hover:bg-[var(--status-success)]/20 hover:border-[var(--status-success)]/40'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                data-testid={`shop-purchase-btn-${item.id}`}
              >
                {isChosen && isPurchasing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Purchasing…
                  </span>
                ) : (
                  'Purchase for Selected Horse'
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full py-2 text-sm font-medium rounded-lg bg-[var(--status-success)]/10 border border-[var(--status-success)]/20 text-[var(--status-success)]/60 cursor-not-allowed"
                title="Select a horse from My Horses to purchase"
                data-testid={`shop-purchase-btn-${item.id}`}
              >
                Select a Horse to Purchase
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------
const FeedShopPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<FeedShopTab>('horses');
  const [purchaseState, setPurchaseState] = useState<PurchaseState>({
    horseId: null,
    feedId: null,
  });

  // If navigated from Horse Detail with ?horseId=X, auto-select that horse
  useEffect(() => {
    const horseIdParam = searchParams.get('horseId');
    if (horseIdParam) {
      const parsed = parseInt(horseIdParam, 10);
      if (!isNaN(parsed)) {
        setPurchaseState({ horseId: parsed, feedId: null });
      }
    }
  }, [searchParams]);

  // Pre-fetch catalog so it's ready when ShopTab mounts
  const { data: catalogPreload } = useFeedCatalog();

  const purchaseMutation = usePurchaseFeed();

  const handleSelectHorse = (horseId: number | null) => {
    setPurchaseState({ horseId, feedId: null });
  };

  const handlePurchase = (horseId: number, feedId: string) => {
    setPurchaseState({ horseId, feedId });
    purchaseMutation.mutate(
      { horseId, feedId },
      {
        onSuccess: (result) => {
          const horseName = result.horse?.name ?? 'your horse';
          toast.success(`Feed purchased for ${horseName}!`);
        },
        onError: (err) => {
          toast.error(
            (err as { message?: string })?.message ?? 'Purchase failed. Please try again.'
          );
        },
      }
    );
  };

  const handleSelectFeedFromShop = (feedId: string) => {
    setPurchaseState((prev) => ({ ...prev, feedId }));
  };

  const tabPanelId = activeTab === 'horses' ? 'tabpanel-horses' : 'tabpanel-shop';

  return (
    <div>
      <PageHero
        title="Feed Shop"
        subtitle="Quality feed and supplements to keep your horses energized and healthy"
        mood="nature"
        icon={<Leaf className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* My Horses / Shop Tabs */}
        <div
          className="flex gap-1 p-1 bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border)] rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="Feed Shop section"
        >
          <button
            role="tab"
            id="tab-horses"
            aria-selected={activeTab === 'horses'}
            aria-controls="tabpanel-horses"
            onClick={() => setActiveTab('horses')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'horses'
                ? 'bg-[var(--glass-bg)] text-[var(--cream)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            data-testid="horses-tab"
          >
            <Heart className="w-4 h-4" />
            My Horses
          </button>
          <button
            role="tab"
            id="tab-shop"
            aria-selected={activeTab === 'shop'}
            aria-controls="tabpanel-shop"
            onClick={() => setActiveTab('shop')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'shop'
                ? 'bg-[var(--glass-bg)] text-[var(--cream)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            data-testid="shop-tab"
            data-onboarding-target="feed-shop-purchase-button"
          >
            <ShoppingCart className="w-4 h-4" />
            Shop
          </button>
        </div>

        {/* Tab Content */}
        <div
          role="tabpanel"
          id={tabPanelId}
          aria-labelledby={activeTab === 'horses' ? 'tab-horses' : 'tab-shop'}
        >
          {activeTab === 'horses' ? (
            <HorsesNutritionTab
              purchaseState={purchaseState}
              onSelectHorse={handleSelectHorse}
              onPurchase={handlePurchase}
              isPurchasing={purchaseMutation.isPending}
              catalog={catalogPreload}
            />
          ) : (
            <ShopTab
              onSelectFeedFromShop={handleSelectFeedFromShop}
              selectedHorseId={purchaseState.horseId}
              onPurchase={handlePurchase}
              isPurchasing={purchaseMutation.isPending}
              purchaseFeedId={purchaseState.feedId}
            />
          )}
        </div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl glass-panel text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2">About the Feed Shop</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Horses with an empty feed supply lose energy and health over time</li>
            <li>Performance Mix increases stamina recovery between competitions</li>
            <li>Vitamin supplements reduce the chance of illness and injury</li>
            <li>Custom diet plans are recommended before high-tier events</li>
            <li>Foals in development benefit most from consistent nutrition</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FeedShopPage;
