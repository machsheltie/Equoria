/**
 * RiderList Component — Rider Marketplace (Epic 9C — Story 9C-1)
 *
 * Rider hiring marketplace interface providing:
 * - Marketplace rider listing with filtering and sorting
 * - One-click rider hiring, fee on the button (owner ruling 2026-10-28, q230)
 * - Marketplace refresh mechanics
 * - Riders back for hire (released or unpaid riders, owner rulings 2026-10-28 q153/q177)
 *   in the same list as the new riders, filtered and sorted with them, with no separate
 *   section (owner ruling 2026-10-29, q284, Equoria-hwboq)
 * - Accessibility support with ARIA labels
 *
 * Mirrors GroomList.tsx for the Rider System.
 *
 * Design-system migration (Equoria-o5hub, world-services family): Surface
 * for panels/cards, form Select for filters, Currency for all coin amounts,
 * canonical SectionLoading / ErrorState / EmptyState, semantic role tokens (no raw
 * palette / text-white/NN).
 */

import React, { useState, useMemo } from 'react';
import { Users, Coins, RefreshCw, AlertCircle } from 'lucide-react';
import {
  useRiderMarketplace,
  useHireRider,
  useRefreshRiderMarketplace,
  type MarketplaceRider,
  type RiderMarketplaceData,
} from '@/hooks/api/useRiders';
import { useAuth } from '@/contexts/AuthContext';
import RiderPersonalityBadge from './rider/RiderPersonalityBadge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Surface } from '@/components/ui/Surface';
import Currency from '@/components/ui/Currency';
import { SectionLoading, ErrorState, InlineError } from '@/components/ui/state';
import { userMessageFor } from '@/lib/http/userMessage';
import {
  actionMessageFor,
  hireRefusalCodes,
  hireRefused,
  refreshRefused,
} from '@/lib/http/actionMessage';
import EmptyState from '@/components/ui/EmptyState';
import StaffLevelStars from '@/components/common/StaffLevelStars';
import ReturningStaffCard from '@/components/common/ReturningStaffCard';
import { useHireRiderFromPool, useRiderPool } from '@/hooks/api/useStaffPool';
import type { PoolRider } from '@/lib/api/staffPoolTypes';
import { staffLevelLabel, staffLevelOrder } from '@/lib/staffLevels';
import '@/styles/returningStaff.css';

/** A refused hire of a rider back for hire, beyond the shared hire copy. */
const poolHireRefused = {
  ...hireRefused,
  404: 'That rider has already left the hiring list.',
  409: 'Another stable hired that rider a moment ago.',
};

/** One card in the hire list: a new rider, or one back for hire (q284). */
type RiderEntry =
  | { kind: 'offer'; rider: MarketplaceRider }
  | { kind: 'returning'; rider: PoolRider };

const entryName = (e: RiderEntry) => `${e.rider.firstName} ${e.rider.lastName}`;
const entryExperience = (e: RiderEntry) => (e.kind === 'offer' ? e.rider.experience : 0);

interface RiderListProps {
  onRiderHired?: (_rider: MarketplaceRider) => void;
  marketplaceData?: RiderMarketplaceData;
}

const RiderList: React.FC<RiderListProps> = ({
  onRiderHired: _onRiderHired,
  marketplaceData: propMarketplaceData,
}) => {
  const { user } = useAuth();
  // The rider the last Hire click was for: its card shows "Hiring..." and any refusal.
  const [selectedRider, setSelectedRider] = useState<MarketplaceRider | null>(null);
  const [filterStarLevel, setFilterStarLevel] = useState<string>('all');
  const [filterPersonality, setFilterPersonality] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  const marketplaceQuery = useRiderMarketplace({ enabled: !propMarketplaceData });
  const marketplaceData = propMarketplaceData ?? marketplaceQuery.data;
  const marketplaceLoading = !propMarketplaceData && marketplaceQuery.isLoading;
  const marketplaceError = !propMarketplaceData ? marketplaceQuery.error : null;

  const hireMutation = useHireRider();
  const refreshMutation = useRefreshRiderMarketplace();

  // Riders back for hire share the list (q284). Their load never holds up the new riders.
  const pool = useRiderPool();
  const poolHire = useHireRiderFromPool();
  // The returning rider the last Hire click was for: its card shows "Hiring..." and any refusal.
  const [poolHiringId, setPoolHiringId] = useState<number | null>(null);
  const [joined, setJoined] = useState<string | null>(null);

  const filteredAndSortedRiders = useMemo(() => {
    let filtered: RiderEntry[] = [
      ...(marketplaceData?.riders ?? []).map((rider) => ({ kind: 'offer' as const, rider })),
      ...(pool.data?.riders ?? []).map((rider) => ({ kind: 'returning' as const, rider })),
    ];

    if (filterStarLevel !== 'all') {
      filtered = filtered.filter((e) => e.rider.starLevel === filterStarLevel);
    }
    if (filterPersonality !== 'all') {
      filtered = filtered.filter((e) => e.rider.personality === filterPersonality);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rate-asc':
          return a.rider.weeklyRate - b.rider.weeklyRate;
        case 'rate-desc':
          return b.rider.weeklyRate - a.rider.weeklyRate;
        case 'experience-desc':
          return entryExperience(b) - entryExperience(a);
        default:
          return entryName(a).localeCompare(entryName(b));
      }
    });

    return filtered;
  }, [marketplaceData, pool.data, filterStarLevel, filterPersonality, sortBy]);

  // One click hires a rider back for hire, the weekly price on the button (q230).
  const handlePoolHire = (rider: PoolRider) => {
    poolHire.reset();
    setJoined(null);
    setPoolHiringId(rider.id);
    poolHire.mutate(rider.id, {
      onSuccess: () => {
        setPoolHiringId(null);
        setJoined(rider.name);
      },
    });
  };

  // Hiring a rider charges one week's pay, once (owner ruling 2026-10-22,
  // Equoria-yw6w1); the server charges the same figure.
  const calculateHiringCost = (weeklyRate: number) => weeklyRate;

  const canAfford = (weeklyRate: number) => (user?.money ?? 0) >= calculateHiringCost(weeklyRate);

  // Owner ruling 2026-10-28 (q230): one click hires; the fee is on the button.
  const handleHireClick = (rider: MarketplaceRider) => {
    // A refusal belongs to the attempt that earned it; don't carry it to the next.
    hireMutation.reset();
    setSelectedRider(rider);
    hireMutation.mutate(rider.marketplaceId, { onSuccess: () => setSelectedRider(null) });
  };

  const handleRefresh = () => {
    const force = !marketplaceData?.canRefreshFree;
    refreshMutation.mutate(force);
  };

  if (marketplaceLoading) {
    return (
      <div data-testid="rider-list">
        <SectionLoading label="Loading rider marketplace" minHeight="192px" />
      </div>
    );
  }

  if (marketplaceError) {
    return (
      <ErrorState
        title="Error Loading Marketplace"
        message={userMessageFor(marketplaceError).message}
        retry={{ label: 'Retry', onClick: () => marketplaceQuery.refetch() }}
      />
    );
  }

  return (
    <main role="main" aria-label="Rider marketplace" data-testid="rider-list" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="type-section-heading">Rider Marketplace</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Hire riders to compete with your horses
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="refresh-marketplace-button"
          onClick={handleRefresh}
          disabled={refreshMutation.isPending}
          aria-label="Refresh marketplace"
        >
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {marketplaceData?.canRefreshFree ? (
            'Free Refresh'
          ) : (
            <span className="inline-flex items-center gap-1">
              Refresh (<Currency amount={marketplaceData?.refreshCost ?? 0} />)
            </span>
          )}
        </Button>
      </div>

      {refreshMutation.isError && (
        <InlineError
          message={actionMessageFor(refreshMutation.error, refreshRefused)}
          className="-mt-3"
        />
      )}

      {/* User Balance */}
      {user && (
        <Surface variant="subtle" className="flex items-center justify-between px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Coins className="w-4 h-4 text-[var(--gold-primary)]" aria-hidden="true" />
            <span>Your Balance</span>
          </div>
          <Currency amount={user.money ?? 0} variant="balance" className="text-base" />
        </Surface>
      )}

      {/* Owner rulings 2026-10-28/29 (q160, q282, q283): every new rider is a Rookie whose
          strengths and weaknesses, disciplines included, show only as it grows. */}
      <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--role-info-bg)] border border-[var(--role-info-border)] text-xs text-[var(--role-info-text)]">
        Every new rider starts as a Rookie. What they are good at, disciplines included, shows
        itself as they ride in shows and climb the levels.
      </div>

      {/* Filters */}
      <Surface
        variant="panel"
        data-testid="rider-filters"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <div>
          <label htmlFor="star-level-filter" className="type-label block mb-1.5">
            Level
          </label>
          <Select
            id="star-level-filter"
            data-testid="star-level-filter"
            value={filterStarLevel}
            onChange={(e) => setFilterStarLevel(e.target.value)}
            className="w-full"
          >
            <option value="all">All Levels</option>
            {staffLevelOrder.map((level) => (
              <option key={level} value={level}>
                {staffLevelLabel(level)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="personality-filter" className="type-label block mb-1.5">
            Personality
          </label>
          <Select
            id="personality-filter"
            data-testid="personality-filter"
            value={filterPersonality}
            onChange={(e) => setFilterPersonality(e.target.value)}
            className="w-full"
          >
            <option value="all">All Personalities</option>
            <option value="daring">Daring</option>
            <option value="methodical">Methodical</option>
            <option value="intuitive">Intuitive</option>
            <option value="competitive">Competitive</option>
          </Select>
        </div>
        <div>
          <label htmlFor="sort-select" className="type-label block mb-1.5">
            Sort By
          </label>
          <Select
            id="sort-select"
            data-testid="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full"
          >
            <option value="name">Name</option>
            <option value="rate-asc">Rate (Low → High)</option>
            <option value="rate-desc">Rate (High → Low)</option>
            <option value="experience-desc">Most Experienced</option>
          </Select>
        </div>
      </Surface>

      {/* Rider Grid */}
      <div data-testid="rider-marketplace">
        {filteredAndSortedRiders.length === 0 ? (
          <EmptyState
            variant="no-results"
            icon={<Users className="w-8 h-8" aria-hidden="true" />}
            title="No Riders Available"
            description="Try refreshing the marketplace"
            primaryAction={{ label: 'Refresh', onClick: handleRefresh }}
          />
        ) : (
          <div
            data-testid="rider-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filteredAndSortedRiders.map((entry) => {
              if (entry.kind === 'returning') {
                const returning = entry.rider;
                return (
                  <ReturningStaffCard
                    key={`returning-${returning.id}`}
                    testId={`returning-rider-${returning.id}`}
                    name={returning.name}
                    starLevel={returning.starLevel}
                    personality={
                      <RiderPersonalityBadge personality={returning.personality} size="sm" />
                    }
                    growth={returning.growth}
                    bio={returning.bio}
                    weeklyPrice={returning.weeklyRate}
                    affordable={(user?.money ?? 0) >= returning.weeklyRate}
                    hiring={poolHire.isPending && poolHiringId === returning.id}
                    disabled={poolHire.isPending}
                    onHire={() => handlePoolHire(returning)}
                    errorMessage={
                      poolHire.isError && poolHiringId === returning.id
                        ? actionMessageFor(
                            poolHire.error,
                            poolHireRefused,
                            hireRefusalCodes('rider')
                          )
                        : null
                    }
                  />
                );
              }
              const rider = entry.rider;
              const hiringCost = calculateHiringCost(rider.weeklyRate);
              const affordable = canAfford(rider.weeklyRate);

              return (
                <Surface
                  variant="panel"
                  key={rider.marketplaceId}
                  data-testid={`rider-card-${rider.marketplaceId}`}
                  // Static card — no hover lift/glow (D-05, Equoria-o5hub.26)
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">
                        {rider.firstName} {rider.lastName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <StaffLevelStars level={rider.starLevel} />
                        <RiderPersonalityBadge personality={rider.personality} size="sm" />
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm border-y border-[var(--glass-border)] py-3 mb-4">
                    {/* Equoria-dea06: riders are fixed NPCs with no XP, so the
                        card no longer shows an "Experience: n XP" row. */}
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Weekly Rate:</span>
                      <span className="font-semibold inline-flex items-center gap-1">
                        <Currency amount={rider.weeklyRate} />
                        /wk
                      </span>
                    </div>
                  </div>

                  {/* Equoria-xlw03 (owner rulings 2026-10-28): the old "Known Affinities"
                      hint is gone; every new rider is a Rookie whose hidden items are
                      revealed only as it levels up. */}
                  {/* Bio */}
                  <p className="text-xs text-[var(--text-muted)] italic mb-4 line-clamp-2">
                    "{rider.bio}"
                  </p>

                  {/* Hire Button */}
                  <Button
                    type="button"
                    onClick={() => handleHireClick(rider)}
                    disabled={!affordable || hireMutation.isPending}
                    className="w-full"
                    aria-label={`Hire ${rider.firstName} ${rider.lastName}`}
                    data-testid={`hire-button-${rider.marketplaceId}`}
                  >
                    {hireMutation.isPending &&
                    selectedRider?.marketplaceId === rider.marketplaceId ? (
                      'Hiring...'
                    ) : affordable ? (
                      <span className="inline-flex items-center gap-1.5">
                        Hire — <Currency amount={hiringCost} />
                      </span>
                    ) : (
                      'Insufficient Funds'
                    )}
                  </Button>
                  {hireMutation.isError && selectedRider?.marketplaceId === rider.marketplaceId && (
                    <InlineError
                      message={actionMessageFor(
                        hireMutation.error,
                        hireRefused,
                        hireRefusalCodes('rider')
                      )}
                      className="mt-3"
                    />
                  )}
                </Surface>
              );
            })}
          </div>
        )}
      </div>

      <p role="status" className="returning-staff__more">
        {joined ? `${joined} has joined your riders.` : ''}
      </p>
      {pool.isError && (
        <div data-testid="rider-pool-error" className="space-y-2">
          <InlineError message={"The riders back for hire didn't load."} />
          <Button type="button" variant="secondary" size="sm" onClick={() => void pool.refetch()}>
            Try Again
          </Button>
        </div>
      )}
      {pool.data && pool.data.total > pool.data.riders.length && (
        <p className="returning-staff__more">
          Showing the {pool.data.riders.length} riders who came back most recently, of{' '}
          {pool.data.total}.
        </p>
      )}

      {/* Low balance warning */}
      {user && (user.money ?? 0) < 5000 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--role-warning-bg)] border border-[var(--role-warning-border)] text-sm text-[var(--role-warning-text)]">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p>Low balance — hiring a rider takes one week's pay up front.</p>
        </div>
      )}
    </main>
  );
};

export default RiderList;
