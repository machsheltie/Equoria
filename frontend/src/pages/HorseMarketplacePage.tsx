/**
 * HorseMarketplacePage — Epic 21: Horse Marketplace
 *
 * Three-tab layout:
 *   Browse       — paginated horse listings with filter panel
 *   My Listings  — seller's active listings with Delist button
 *   Sale History — completed transactions (bought + sold)
 *
 * Design-system migration (Equoria-o5hub, marketplace family): PageHeader
 * replaces PageHero; PageContainer content; the page-local `fixed inset-0`
 * detail/confirm overlay migrated onto the canonical GameDialog (DECISIONS.md
 * §8 listed this overlay explicitly); listing cards are Surface(interactive);
 * all game currency renders through Currency (no 🪙 emoji mixing, DECISIONS.md
 * §9); filters/sort use canonical form controls; loading via Skeleton
 * primitives; empty states via EmptyState.
 */

import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Search,
  SlidersHorizontal,
  History,
  Tag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import { Input, Select, FormField } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/state';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import CinematicMoment from '@/components/feedback/CinematicMoment';
import {
  useMarketplaceListings,
  useMyListings,
  useSaleHistory,
  useDelistHorse,
  useBuyHorse,
} from '@/hooks/api/useMarketplace';
import { useProfile } from '@/hooks/useAuth';
import type { MarketplaceListing, MarketplaceBrowseFilters, MyListing } from '@/lib/api-client';
import { getHorseImage } from '@/lib/breed-images';

// ─── Types ────────────────────────────────────────────────────────────────────

type MarketplaceTab = 'browse' | 'my-listings' | 'history';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'youngest', label: 'Youngest First' },
] as const;

// ─── Skeleton Card ─────────────────────────────────────────────────────────────

const ListingCardSkeleton: React.FC = () => (
  <Surface variant="subtle" data-testid="listing-skeleton">
    <div className="flex gap-4 p-4">
      <Skeleton.Rect className="w-20 h-20 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton.Line className="w-1/2" />
        <Skeleton.Line className="w-2/3" />
        <Skeleton.Line className="w-1/3" />
        <Skeleton.Line className="w-1/4" />
      </div>
    </div>
  </Surface>
);

// ─── Listing Card ─────────────────────────────────────────────────────────────

interface ListingCardProps {
  listing: MarketplaceListing;
  onSelect: (_listing: MarketplaceListing) => void;
}

const ListingCard: React.FC<ListingCardProps> = ({ listing, onSelect }) => (
  // SurfaceProps doesn't surface button-only attributes like `type`; this
  // button is not inside a form, so the implicit type cannot trigger a submit.
  <Surface
    variant="interactive"
    as="button"
    onClick={() => onSelect(listing)}
    className="w-full text-left"
  >
    <div className="flex gap-4 items-start">
      <div className="w-20 h-20 rounded-[var(--radius-md)] overflow-hidden bg-[var(--glass-surface-subtle-bg)] flex-shrink-0 border border-[var(--glass-border)]">
        <img
          src={getHorseImage(listing.imageUrl, listing.breed)}
          alt={listing.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-[var(--text-primary)] text-base truncate">
            {listing.name}
          </h3>
          <Currency
            amount={listing.salePrice}
            className="text-[var(--role-success-text)] font-bold text-sm whitespace-nowrap flex-shrink-0"
          />
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-2">
          {listing.breed} · {listing.age ?? '?'} yr · {listing.sex} · Seller: {listing.seller}
        </p>
        <div className="flex gap-3 text-xs text-[var(--text-muted)]">
          <span>Spd {listing.stats.speed}</span>
          <span>Sta {listing.stats.stamina}</span>
          <span>Agi {listing.stats.agility}</span>
        </div>
      </div>
    </div>
  </Surface>
);

// ─── Detail Dialog (Story 21-4 → GameDialog, DECISIONS.md §8) ─────────────────

interface DetailDialogProps {
  listing: MarketplaceListing;
  userBalance: number;
  onClose: () => void;
  onPurchased: (_horseName: string) => void;
}

const DetailDialog: React.FC<DetailDialogProps> = ({
  listing,
  userBalance,
  onClose,
  onPurchased,
}) => {
  const [step, setStep] = useState<'detail' | 'confirm'>('detail');
  const buyMutation = useBuyHorse();

  const canBuy = userBalance >= listing.salePrice;
  const remaining = userBalance - listing.salePrice;

  const handleConfirm = useCallback(() => {
    buyMutation.mutate(listing.id, {
      onSuccess: () => onPurchased(listing.name),
    });
  }, [buyMutation, listing.id, listing.name, onPurchased]);

  return (
    <GameDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <GameDialogContent
        size="md"
        data-testid="listing-detail-dialog"
        aria-describedby="listing-detail-description"
      >
        <GameDialogHeader>
          <GameDialogTitle>
            {step === 'confirm' ? 'Confirm Purchase' : listing.name}
          </GameDialogTitle>
          <GameDialogDescription id="listing-detail-description">
            {step === 'confirm'
              ? `Confirm buying ${listing.name} from ${listing.seller}.`
              : `${listing.breed} · ${listing.age ?? '?'} yr · ${listing.sex} · Seller: ${listing.seller}`}
          </GameDialogDescription>
        </GameDialogHeader>

        {step === 'detail' ? (
          <>
            <GameDialogBody>
              <div className="flex gap-4 mb-5">
                <div className="w-28 h-28 rounded-[var(--radius-md)] overflow-hidden bg-[var(--glass-surface-subtle-bg)] border border-[var(--glass-border)] flex-shrink-0">
                  <img
                    src={getHorseImage(listing.imageUrl, listing.breed)}
                    alt={listing.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-secondary)] mb-1">
                    {listing.breed} · {listing.age ?? '?'} yr · {listing.sex}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mb-3">Seller: {listing.seller}</p>
                  <Currency
                    amount={listing.salePrice}
                    className="text-2xl font-bold text-[var(--role-success-text)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(listing.stats).map(([stat, val]) => (
                  <Surface variant="subtle" key={stat} className="p-2 text-center">
                    <p className="text-lg font-bold text-[var(--text-primary)]">{val}</p>
                    <p className="text-xs text-[var(--text-muted)] capitalize">{stat}</p>
                  </Surface>
                ))}
              </div>
              {!canBuy && (
                <p className="text-xs text-role-danger mt-4 text-center">
                  Insufficient funds — you need{' '}
                  <Currency amount={listing.salePrice - userBalance} showIcon={false} /> more coins
                </p>
              )}
            </GameDialogBody>
            <GameDialogFooter>
              <Button
                type="button"
                className="w-full"
                disabled={!canBuy}
                onClick={() => setStep('confirm')}
                title={!canBuy ? 'Insufficient funds' : undefined}
              >
                Buy Now
              </Button>
            </GameDialogFooter>
          </>
        ) : (
          <>
            <GameDialogBody>
              <p className="text-sm text-[var(--text-secondary)] text-center mb-4">
                You are about to spend{' '}
                <Currency
                  amount={listing.salePrice}
                  showIcon={false}
                  className="text-[var(--role-success-text)] font-bold"
                />{' '}
                coins
              </p>
              <Surface variant="subtle" className="space-y-2 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Your balance</span>
                  <Currency amount={userBalance} className="text-[var(--text-primary)]" />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Purchase price</span>
                  <Currency amount={-listing.salePrice} variant="signed" showIcon={false} />
                </div>
                <div className="border-t border-[var(--glass-border)] pt-2 flex justify-between text-sm font-bold">
                  <span className="text-[var(--text-secondary)]">Remaining</span>
                  <Currency
                    amount={remaining}
                    className={remaining >= 0 ? 'text-[var(--text-primary)]' : 'text-role-danger'}
                  />
                </div>
              </Surface>
            </GameDialogBody>
            <GameDialogFooter>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setStep('detail')}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={buyMutation.isPending}
                pending={buyMutation.isPending}
                onClick={handleConfirm}
              >
                Confirm Purchase
              </Button>
            </GameDialogFooter>
          </>
        )}
      </GameDialogContent>
    </GameDialog>
  );
};

// ─── Browse Tab (Story 21-2) ──────────────────────────────────────────────────

interface BrowseTabProps {
  userBalance: number;
  onPurchased: (_horseName: string) => void;
}

const BrowseTab: React.FC<BrowseTabProps> = ({ userBalance, onPurchased }) => {
  const [filters, setFilters] = useState<MarketplaceBrowseFilters>({ sort: 'newest', page: 1 });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);

  const { data, isLoading } = useMarketplaceListings(filters);
  const listings = data?.listings ?? [];
  const pagination = data?.pagination;

  const updateFilter = useCallback(
    <K extends keyof MarketplaceBrowseFilters>(key: K, value: MarketplaceBrowseFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    },
    []
  );

  return (
    <div>
      {/* Search/filter toolbar — canonical form controls (D-13) */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none"
            aria-hidden="true"
          />
          <Input
            type="text"
            placeholder="Filter by breed…"
            aria-label="Filter by breed"
            value={filters.breed ?? ''}
            onChange={(e) => updateFilter('breed', e.target.value || undefined)}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.sort ?? 'newest'}
          aria-label="Sort listings"
          onChange={(e) => updateFilter('sort', e.target.value as MarketplaceBrowseFilters['sort'])}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          className="w-auto"
        />
        <Button
          type="button"
          variant={showFilters ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Advanced filters"
          aria-pressed={showFilters}
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Advanced filter panel */}
      {showFilters && (
        <Surface variant="panel" className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: 'minAge' as const, label: 'Min Age' },
            { key: 'maxAge' as const, label: 'Max Age' },
            { key: 'minPrice' as const, label: 'Min Price' },
            { key: 'maxPrice' as const, label: 'Max Price' },
          ].map(({ key, label }) => (
            <FormField key={key} label={label} htmlFor={`filter-${key}`}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  min={0}
                  value={filters[key] ?? ''}
                  onChange={(e) =>
                    updateFilter(key, e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              )}
            </FormField>
          ))}
        </Surface>
      )}

      {/* Listings */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          variant="no-results"
          icon={<ShoppingCart className="h-8 w-8" aria-hidden="true" />}
          title="No horses listed for sale right now"
          description="Check back soon!"
        />
      ) : (
        <div className="space-y-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} onSelect={setSelectedListing} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6" data-testid="pagination">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={(filters.page ?? 1) <= 1}
            onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <span className="text-sm text-[var(--text-muted)]">
            Page {filters.page ?? 1} of {pagination.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={(filters.page ?? 1) >= pagination.totalPages}
            onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {/* Detail dialog */}
      {selectedListing && (
        <DetailDialog
          listing={selectedListing}
          userBalance={userBalance}
          onClose={() => setSelectedListing(null)}
          onPurchased={(name) => {
            setSelectedListing(null);
            onPurchased(name);
          }}
        />
      )}
    </div>
  );
};

// ─── My Listings Tab (Story 21-5) ─────────────────────────────────────────────

const MyListingsTab: React.FC = () => {
  const { data: listings, isLoading, refetch } = useMyListings();
  const delistMutation = useDelistHorse();

  if (isLoading)
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    );

  if (!listings || listings.length === 0)
    return (
      <EmptyState
        variant="first-use"
        icon={<Tag className="h-8 w-8" aria-hidden="true" />}
        title="No Active Listings"
        description="Go to a horse's detail page to list it for sale."
      />
    );

  return (
    <div className="space-y-3">
      {(listings as MyListing[]).map((l) => (
        <Surface variant="panel" key={l.id} className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[var(--radius-md)] overflow-hidden bg-[var(--glass-surface-subtle-bg)] flex-shrink-0 border border-[var(--glass-border)]">
            <img
              src={getHorseImage(l.imageUrl, l.breed)}
              alt={l.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--text-primary)] truncate">{l.name}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {l.breed} · {l.age ?? '?'} yr · {l.sex}
            </p>
            <Currency
              amount={l.salePrice}
              className="text-sm text-[var(--role-success-text)] font-bold mt-0.5"
            />
          </div>
          {/* Delist removes the listing — supporting action, not the page's gold primary */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={delistMutation.isPending}
            onClick={() => delistMutation.mutate(l.id, { onSuccess: () => refetch() })}
          >
            Delist
          </Button>
        </Surface>
      ))}
    </div>
  );
};

// ─── Sale History Tab (Story 21-5) ────────────────────────────────────────────

const HistoryTab: React.FC = () => {
  const { data: history, isLoading } = useSaleHistory();

  if (isLoading)
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton.Rect key={i} className="h-16 w-full" />
        ))}
      </div>
    );

  if (!history || history.length === 0)
    return (
      <EmptyState
        variant="first-use"
        icon={<History className="h-8 w-8" aria-hidden="true" />}
        title="No Sale History"
        description="Transactions will appear here once you buy or sell a horse."
      />
    );

  return (
    <div className="space-y-2">
      {history.map((entry) => (
        <Surface variant="subtle" key={entry.id} className="flex items-center gap-3 p-4">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              entry.type === 'sold' ? 'bg-[var(--status-success)]' : 'bg-[var(--status-info)]'
            }`}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {entry.horseName}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {entry.type === 'sold'
                ? `Sold to ${entry.counterparty}`
                : `Bought from ${entry.counterparty}`}
              {' · '}
              {new Date(entry.soldAt).toLocaleDateString()}
            </p>
          </div>
          <Currency
            amount={entry.type === 'sold' ? entry.salePrice : -entry.salePrice}
            variant="signed"
            showIcon={false}
            className="text-sm font-bold flex-shrink-0"
          />
        </Surface>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const HorseMarketplacePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('browse');
  const [cinematicHorse, setCinematicHorse] = useState<string | null>(null);

  // Real user balance — server still enforces atomically on purchase, but the UI
  // must reflect honest affordability so the Insufficient-Funds gate and remaining-
  // balance display are not fake (21R doctrine: no fake product values).
  const { data: profileData } = useProfile();
  const userBalance = profileData?.user?.money ?? 0;

  const handlePurchased = useCallback((horseName: string) => {
    setCinematicHorse(horseName);
  }, []);

  return (
    <PageContainer variant="content" data-testid="horse-marketplace-page">
      <PageHeader
        title="Marketplace"
        subtitle="Buy and sell horses with other players"
        icon={<ShoppingCart className="w-6 h-6 text-[var(--gold-400)]" aria-hidden="true" />}
        breadcrumbs={
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Link to="/" className="hover:text-[var(--text-primary)] transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-[var(--text-primary)]">Marketplace</span>
          </div>
        }
      />

      <div className="mt-6 pb-8">
        {/* Tab Navigation + Content — CanonicalTabs underline variant (Equoria-o5hub.11) */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MarketplaceTab)}>
          <TabsList aria-label="Marketplace sections">
            <TabsTrigger value="browse" data-testid="tab-browse">
              🏷️ Browse
            </TabsTrigger>
            <TabsTrigger value="my-listings" data-testid="tab-my-listings">
              📋 My Listings
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              📜 Sale History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="browse">
            <BrowseTab userBalance={userBalance} onPurchased={handlePurchased} />
          </TabsContent>
          <TabsContent value="my-listings">
            <MyListingsTab />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Cinematic moment on purchase success */}
      {cinematicHorse && (
        <CinematicMoment
          variant="cup-win"
          title="🐴 Horse Acquired!"
          subtitle={`${cinematicHorse} is now in your stable!`}
          onDismiss={() => setCinematicHorse(null)}
        />
      )}
    </PageContainer>
  );
};

export default HorseMarketplacePage;
