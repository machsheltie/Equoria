/**
 * HorseMarketplacePage — Epic 21: Horse Marketplace
 *
 * Three-tab layout:
 *   Browse       — all-horses search: for sale and/or at stud, with filters
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
import { formatDate } from '@/lib/formatDate';
import { Link } from 'react-router';
import { ShoppingCart, History, Tag } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import Currency from '@/components/ui/Currency';
import { Skeleton, ErrorState, InlineError } from '@/components/ui/state';
import { actionMessageFor, delistHorseRefused } from '@/lib/http/actionMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { userMessageFor } from '@/lib/http/userMessage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';
import CinematicMoment from '@/components/feedback/CinematicMoment';
import { HorseSearch } from '@/components/marketplace/HorseSearch';
import { useMyListings, useSaleHistory, useDelistHorse } from '@/hooks/api/useMarketplace';
import { useProfile } from '@/hooks/useAuth';
import type { MyListing } from '@/lib/api-client';
import { getHorseImage } from '@/lib/breed-images';

// ─── Types ────────────────────────────────────────────────────────────────────

type MarketplaceTab = 'browse' | 'my-listings' | 'history';

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

// ─── Tab Error State (shared, doctrine §1/§3) ─────────────────────────────────

/**
 * Shared ERROR-branch for every marketplace tab: maps the caught query error to
 * user-safe copy (userMessageFor, §3 — never the raw server message) and wires
 * the retry to the query's refetch (§1). Each tab renders this instead of
 * falling through to its empty state on a failed fetch.
 */
const TabErrorState: React.FC<{ error: unknown; onRetry: () => void }> = ({ error, onRetry }) => {
  const { title, message, retryable } = userMessageFor(error);
  return (
    <ErrorState
      title={title}
      message={message}
      retry={retryable ? { label: 'Try Again', onClick: onRetry } : undefined}
    />
  );
};

// ─── My Listings Tab (Story 21-5) ─────────────────────────────────────────────

const MyListingsTab: React.FC = () => {
  const { data: listings, isLoading, isError, error, refetch } = useMyListings();
  const delistMutation = useDelistHorse();

  if (isLoading)
    return (
      <div className="space-y-3" role="status" aria-label="Loading your listings">
        {[...Array(2)].map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    );

  // ERROR before EMPTY (doctrine §1): a failed fetch must never render the
  // "No Active Listings" empty state.
  if (isError) return <TabErrorState error={error} onRetry={() => refetch()} />;

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
            {/* A refused delist says why on its own listing (owner ruling 2026-10-28, q161). */}
            {delistMutation.isError && delistMutation.variables === l.id && (
              <InlineError
                className="mt-1"
                message={actionMessageFor(delistMutation.error, delistHorseRefused)}
              />
            )}
          </div>
          {/* Delist removes the listing — supporting action, not the page's gold primary */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={delistMutation.isPending && delistMutation.variables === l.id}
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
  const { data: history, isLoading, isError, error, refetch } = useSaleHistory();

  if (isLoading)
    return (
      <div className="space-y-2" role="status" aria-label="Loading sale history">
        {[...Array(3)].map((_, i) => (
          <Skeleton.Rect key={i} className="h-16 w-full" />
        ))}
      </div>
    );

  // ERROR before EMPTY (doctrine §1): a failed fetch must never render the
  // "No Sale History" empty state.
  if (isError) return <TabErrorState error={error} onRetry={() => refetch()} />;

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
              {formatDate(entry.soldAt)}
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
            <HorseSearch userBalance={userBalance} onPurchased={handlePurchased} />
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
