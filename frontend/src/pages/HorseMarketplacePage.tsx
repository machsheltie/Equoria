/**
 * HorseMarketplacePage — Epic 21: Horse Marketplace
 *
 * Three-tab layout:
 *   Browse       — paginated horse listings with filter panel
 *   My Listings  — seller's active listings with Delist button
 *   Sale History — completed transactions (bought + sold)
 */

import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Search,
  SlidersHorizontal,
  X,
  History,
  Tag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import CinematicMoment from '@/components/feedback/CinematicMoment';
import {
  useMarketplaceListings,
  useMyListings,
  useSaleHistory,
  useDelistHorse,
  useBuyHorse,
} from '@/hooks/api/useMarketplace';
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
  <div className="animate-pulse bg-white/5 border border-white/10 rounded-xl p-5">
    <div className="flex gap-4">
      <div className="w-20 h-20 rounded-lg bg-white/10 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-5 bg-white/10 rounded w-1/2" />
        <div className="h-3 bg-white/10 rounded w-2/3" />
        <div className="h-3 bg-white/10 rounded w-1/3" />
        <div className="h-4 bg-white/10 rounded w-1/4 mt-2" />
      </div>
    </div>
  </div>
);

// ─── Listing Card ─────────────────────────────────────────────────────────────

interface ListingCardProps {
  listing: MarketplaceListing;
  onSelect: (_listing: MarketplaceListing) => void;
}

const ListingCard: React.FC<ListingCardProps> = ({ listing, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(listing)}
    className="w-full text-left bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/30 hover:bg-white/[0.08] transition-all group"
  >
    <div className="flex gap-4 items-start">
      <div className="w-20 h-20 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
        <img
          src={getHorseImage(listing.imageUrl, listing.breed)}
          alt={listing.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-white/90 text-base truncate group-hover:text-white transition-colors">
            {listing.name}
          </h3>
          <span className="text-emerald-400 font-bold text-sm whitespace-nowrap flex-shrink-0">
            {listing.salePrice.toLocaleString()} 🪙
          </span>
        </div>
        <p className="text-xs text-white/50 mb-2">
          {listing.breed} · {listing.age ?? '?'} yr · {listing.sex} · Seller: {listing.seller}
        </p>
        <div className="flex gap-3 text-xs text-white/40">
          <span>Spd {listing.stats.speed}</span>
          <span>Sta {listing.stats.stamina}</span>
          <span>Agi {listing.stats.agility}</span>
        </div>
      </div>
    </div>
  </button>
);

// ─── Detail Modal (Story 21-4) ────────────────────────────────────────────────

interface DetailModalProps {
  listing: MarketplaceListing;
  userBalance: number;
  onClose: () => void;
  onPurchased: (_horseName: string) => void;
}

const DetailModal: React.FC<DetailModalProps> = ({
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
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[rgba(10,22,40,0.98)] border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          {step === 'confirm' ? (
            <button
              type="button"
              onClick={() => setStep('detail')}
              className="text-white/50 hover:text-white flex items-center gap-1 text-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <h2 className="font-bold text-white/90 text-lg">{listing.name}</h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'detail' ? (
          <>
            <div className="p-5 pb-0">
              <div className="flex gap-4 mb-5">
                <div className="w-28 h-28 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                  <img
                    src={getHorseImage(listing.imageUrl, listing.breed)}
                    alt={listing.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm text-white/60 mb-1">
                    {listing.breed} · {listing.age ?? '?'} yr · {listing.sex}
                  </p>
                  <p className="text-xs text-white/40 mb-3">Seller: {listing.seller}</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {listing.salePrice.toLocaleString()} 🪙
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {Object.entries(listing.stats).map(([stat, val]) => (
                  <div
                    key={stat}
                    className="bg-white/5 rounded-lg p-2 text-center border border-white/[0.08]"
                  >
                    <p className="text-lg font-bold text-white/80">{val}</p>
                    <p className="text-xs text-white/40 capitalize">{stat}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 pt-0">
              {!canBuy && (
                <p className="text-xs text-red-400 mb-2 text-center">
                  Insufficient funds — you need {(listing.salePrice - userBalance).toLocaleString()}{' '}
                  more coins
                </p>
              )}
              <button
                type="button"
                disabled={!canBuy}
                onClick={() => setStep('confirm')}
                title={!canBuy ? 'Insufficient funds' : undefined}
                className="w-full py-3 rounded-xl bg-emerald-600/80 border border-emerald-500/40 text-white font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Buy Now
              </button>
            </div>
          </>
        ) : (
          <div className="p-6 space-y-4">
            <h2 className="font-bold text-white/90 text-lg text-center">Confirm Purchase</h2>
            <p className="text-sm text-white/60 text-center">
              You are about to spend{' '}
              <span className="text-emerald-400 font-bold">
                {listing.salePrice.toLocaleString()} coins
              </span>
            </p>
            <div className="space-y-2 bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Your balance</span>
                <span className="text-white/80">{userBalance.toLocaleString()} 🪙</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Purchase price</span>
                <span className="text-red-400">− {listing.salePrice.toLocaleString()} 🪙</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-bold">
                <span className="text-white/70">Remaining</span>
                <span className={remaining >= 0 ? 'text-white/90' : 'text-red-400'}>
                  {remaining.toLocaleString()} 🪙
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('detail')}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={buyMutation.isPending}
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600/80 border border-emerald-500/40 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {buyMutation.isPending ? 'Processing…' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
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
      {/* Search/filter toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Filter by breed…"
            value={filters.breed ?? ''}
            onChange={(e) => updateFilter('breed', e.target.value || undefined)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-white/30"
          />
        </div>
        <select
          value={filters.sort ?? 'newest'}
          onChange={(e) => updateFilter('sort', e.target.value as MarketplaceBrowseFilters['sort'])}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 focus:outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`p-2 rounded-lg border text-sm transition-colors ${
            showFilters
              ? 'bg-white/15 border-white/30 text-white'
              : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
          }`}
          title="Advanced filters"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Advanced filter panel */}
      {showFilters && (
        <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: 'minAge' as const, label: 'Min Age' },
            { key: 'maxAge' as const, label: 'Max Age' },
            { key: 'minPrice' as const, label: 'Min Price' },
            { key: 'maxPrice' as const, label: 'Max Price' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-white/40 mb-1">{label}</label>
              <input
                type="number"
                min={0}
                value={filters[key] ?? ''}
                onChange={(e) =>
                  updateFilter(key, e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}

      {/* Listings */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-64 text-center p-8">
          <ShoppingCart className="w-12 h-12 text-white/20 mb-4" />
          <h3 className="text-base font-semibold text-white/60 mb-2">
            No horses listed for sale right now
          </h3>
          <p className="text-sm text-white/40 max-w-xs">Check back soon!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} onSelect={setSelectedListing} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            type="button"
            disabled={(filters.page ?? 1) <= 1}
            onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-white/50">
            Page {filters.page ?? 1} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={(filters.page ?? 1) >= pagination.totalPages}
            onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Detail modal */}
      {selectedListing && (
        <DetailModal
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
      <div className="flex flex-col items-center justify-center min-h-48 text-center p-8">
        <Tag className="w-10 h-10 text-white/20 mb-3" />
        <h3 className="text-base font-semibold text-white/60 mb-1">No Active Listings</h3>
        <p className="text-sm text-white/40 max-w-xs">
          Go to a horse's detail page to list it for sale.
        </p>
      </div>
    );

  return (
    <div className="space-y-3">
      {(listings as MyListing[]).map((l) => (
        <div
          key={l.id}
          className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl"
        >
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
            <img
              src={getHorseImage(l.imageUrl, l.breed)}
              alt={l.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white/90 truncate">{l.name}</p>
            <p className="text-xs text-white/50">
              {l.breed} · {l.age ?? '?'} yr · {l.sex}
            </p>
            <p className="text-sm text-emerald-400 font-bold mt-0.5">
              {l.salePrice.toLocaleString()} 🪙
            </p>
          </div>
          <button
            type="button"
            disabled={delistMutation.isPending}
            onClick={() => delistMutation.mutate(l.id, { onSuccess: () => refetch() })}
            className="px-4 py-1.5 rounded-lg bg-red-900/20 border border-red-500/30 text-red-300 text-xs hover:bg-red-900/30 transition-colors disabled:opacity-50"
          >
            Delist
          </button>
        </div>
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
          <div key={i} className="animate-pulse h-16 bg-white/5 rounded-xl" />
        ))}
      </div>
    );

  if (!history || history.length === 0)
    return (
      <div className="flex flex-col items-center justify-center min-h-48 text-center p-8">
        <History className="w-10 h-10 text-white/20 mb-3" />
        <h3 className="text-base font-semibold text-white/60 mb-1">No Sale History</h3>
        <p className="text-sm text-white/40 max-w-xs">
          Transactions will appear here once you buy or sell a horse.
        </p>
      </div>
    );

  return (
    <div className="space-y-2">
      {history.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl"
        >
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.type === 'sold' ? 'bg-emerald-400' : 'bg-blue-400'}`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/80 truncate">{entry.horseName}</p>
            <p className="text-xs text-white/40">
              {entry.type === 'sold'
                ? `Sold to ${entry.counterparty}`
                : `Bought from ${entry.counterparty}`}
              {' · '}
              {new Date(entry.soldAt).toLocaleDateString()}
            </p>
          </div>
          <p
            className={`text-sm font-bold flex-shrink-0 ${entry.type === 'sold' ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {entry.type === 'sold' ? '+' : '−'}
            {entry.salePrice.toLocaleString()} 🪙
          </p>
        </div>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const HorseMarketplacePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('browse');
  const [cinematicHorse, setCinematicHorse] = useState<string | null>(null);

  // Large default so the client-side UI doesn't incorrectly block the button.
  // The real balance check is enforced server-side atomically.
  const userBalance = 999_999;

  const handlePurchased = useCallback((horseName: string) => {
    setCinematicHorse(horseName);
  }, []);

  return (
    <div className="min-h-screen">
      <PageHero
        title="Marketplace"
        subtitle="Buy and sell horses with other players"
        mood="golden"
        icon={<ShoppingCart className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
          <Link to="/" className="hover:text-[var(--cream)] transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-[var(--cream)]">Marketplace</span>
        </div>
      </PageHero>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Tab Navigation */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="Marketplace sections"
        >
          {[
            { id: 'browse' as const, label: '🏷️ Browse', testId: 'tab-browse' },
            { id: 'my-listings' as const, label: '📋 My Listings', testId: 'tab-my-listings' },
            { id: 'history' as const, label: '📜 Sale History', testId: 'tab-history' },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={tab.testId}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white/90 shadow-sm'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div role="tabpanel">
          {activeTab === 'browse' && (
            <BrowseTab userBalance={userBalance} onPurchased={handlePurchased} />
          )}
          {activeTab === 'my-listings' && <MyListingsTab />}
          {activeTab === 'history' && <HistoryTab />}
        </div>
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
    </div>
  );
};

export default HorseMarketplacePage;
