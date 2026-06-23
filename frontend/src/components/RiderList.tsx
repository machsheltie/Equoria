/**
 * RiderList Component — Rider Marketplace (Epic 9C — Story 9C-1)
 *
 * Rider hiring marketplace interface providing:
 * - Marketplace rider listing with filtering and sorting
 * - Rider hiring with confirmation modal
 * - Skill level transparency system (rookie=hidden, developing=partial, experienced=full)
 * - Marketplace refresh mechanics
 * - Accessibility support with ARIA labels
 *
 * Mirrors GroomList.tsx for the Rider System.
 *
 * Design-system migration (Equoria-o5hub, world-services family): Surface
 * for panels/cards, form Select for filters, Currency for all coin amounts,
 * GameDialog for the hire confirmation (replaces page-local fixed-inset
 * overlay), canonical SectionLoading / ErrorState / EmptyState, semantic
 * role tokens (no raw palette / text-white/NN).
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
import { SectionLoading, ErrorState } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';

interface RiderListProps {
  // Auth user id is a UUID string (Equoria-ai6pw / phv9p), not a numeric DB int.
  userId: string;
  onRiderHired?: (_rider: MarketplaceRider) => void;
  marketplaceData?: RiderMarketplaceData;
}

const SKILL_LEVEL_LABELS: Record<
  string,
  { label: string; colorClass: string; visibility: string }
> = {
  rookie: {
    label: 'Rookie',
    colorClass: 'bg-[var(--role-neutral-bg)] text-[var(--role-neutral-text)]',
    visibility: 'Stats hidden — unknown potential',
  },
  developing: {
    label: 'Developing',
    colorClass: 'bg-[var(--role-info-bg)] text-[var(--role-info-text)]',
    visibility: 'Some stats revealed',
  },
  experienced: {
    label: 'Experienced',
    colorClass: 'bg-[var(--role-warning-bg)] text-[var(--role-warning-text)]',
    visibility: 'All stats visible',
  },
};

const RiderList: React.FC<RiderListProps> = ({
  userId: _userId,
  onRiderHired: _onRiderHired,
  marketplaceData: propMarketplaceData,
}) => {
  const { user } = useAuth();
  const [selectedRider, setSelectedRider] = useState<MarketplaceRider | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [filterSkillLevel, setFilterSkillLevel] = useState<string>('all');
  const [filterPersonality, setFilterPersonality] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  const marketplaceQuery = useRiderMarketplace({ enabled: !propMarketplaceData });
  const marketplaceData = propMarketplaceData ?? marketplaceQuery.data;
  const marketplaceLoading = !propMarketplaceData && marketplaceQuery.isLoading;
  const marketplaceError = !propMarketplaceData ? marketplaceQuery.error : null;

  const hireMutation = useHireRider();
  const refreshMutation = useRefreshRiderMarketplace();

  const filteredAndSortedRiders = useMemo(() => {
    const riders = marketplaceData?.riders ?? [];
    if (!riders.length) return [];

    let filtered = [...riders];

    if (filterSkillLevel !== 'all') {
      filtered = filtered.filter((r) => r.skillLevel === filterSkillLevel);
    }
    if (filterPersonality !== 'all') {
      filtered = filtered.filter((r) => r.personality === filterPersonality);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rate-asc':
          return a.weeklyRate - b.weeklyRate;
        case 'rate-desc':
          return b.weeklyRate - a.weeklyRate;
        case 'experience-desc':
          return b.experience - a.experience;
        default:
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      }
    });

    return filtered;
  }, [marketplaceData, filterSkillLevel, filterPersonality, sortBy]);

  const calculateHiringCost = (weeklyRate: number) => weeklyRate * 4; // 4-week upfront

  const canAfford = (weeklyRate: number) => (user?.money ?? 0) >= calculateHiringCost(weeklyRate);

  const handleHireClick = (rider: MarketplaceRider) => {
    setSelectedRider(rider);
    setShowHireModal(true);
  };

  const handleHireConfirm = () => {
    if (!selectedRider) return;
    hireMutation.mutate(selectedRider.marketplaceId, {
      onSuccess: () => {
        setShowHireModal(false);
        setSelectedRider(null);
      },
    });
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
        message={marketplaceError.message}
        retry={{ label: 'Retry', onClick: handleRefresh }}
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

      {/* Skill Level Transparency Note */}
      <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--role-info-bg)] border border-[var(--role-info-border)] text-xs text-[var(--role-info-text)]">
        <strong>Level = Information, not quality.</strong> Rookies are cheap but their abilities are
        hidden — they could be exceptional. Experienced riders reveal all stats, good or bad.
      </div>

      {/* Filters */}
      <Surface
        variant="panel"
        data-testid="rider-filters"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <div>
          <label htmlFor="skill-level-filter" className="type-label block mb-1.5">
            Skill Level
          </label>
          <Select
            id="skill-level-filter"
            data-testid="skill-level-filter"
            value={filterSkillLevel}
            onChange={(e) => setFilterSkillLevel(e.target.value)}
            className="w-full"
          >
            <option value="all">All Levels</option>
            <option value="rookie">Rookie</option>
            <option value="developing">Developing</option>
            <option value="experienced">Experienced</option>
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
            {filteredAndSortedRiders.map((rider) => {
              const hiringCost = calculateHiringCost(rider.weeklyRate);
              const affordable = canAfford(rider.weeklyRate);
              const skillMeta = SKILL_LEVEL_LABELS[rider.skillLevel] ?? SKILL_LEVEL_LABELS.rookie;

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
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-[var(--radius-sm)] uppercase ${skillMeta.colorClass}`}
                        >
                          {skillMeta.label}
                        </span>
                        <RiderPersonalityBadge personality={rider.personality} size="sm" />
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm border-y border-[var(--glass-border)] py-3 mb-4">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Experience:</span>
                      <span className="text-[var(--text-secondary)]">
                        {rider.skillLevel === 'rookie' ? '???' : `${rider.experience} XP`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Weekly Rate:</span>
                      <span className="font-semibold inline-flex items-center gap-1">
                        <Currency amount={rider.weeklyRate} />
                        /wk
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-muted)]">Stats:</span>
                      <span className="text-[10px] text-[var(--text-muted)] italic">
                        {skillMeta.visibility}
                      </span>
                    </div>
                  </div>

                  {/* Known Affinities (experienced only) */}
                  {rider.skillLevel === 'experienced' && rider.knownAffinities.length > 0 && (
                    <div className="mb-4">
                      <p className="type-label text-[10px] text-[var(--text-muted)] mb-1">
                        Known Affinities
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {rider.knownAffinities.map((a) => (
                          <span
                            key={a}
                            className="px-1.5 py-0.5 bg-[var(--role-success-bg)] text-[var(--role-success-text)] text-[10px] rounded-[var(--radius-sm)]"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

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
                </Surface>
              );
            })}
          </div>
        )}
      </div>

      {/* Low balance warning */}
      {user && (user.money ?? 0) < 5000 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--role-warning-bg)] border border-[var(--role-warning-border)] text-sm text-[var(--role-warning-text)]">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p>Low balance — hiring requires a 4-week upfront payment.</p>
        </div>
      )}

      {/* Hire Confirmation Dialog — GameDialog (DECISIONS.md §8). Overlay +
          blur owned by GameDialogOverlay (single-blur rule). */}
      <GameDialog
        open={showHireModal && selectedRider !== null}
        onOpenChange={(open) => {
          if (!open) setShowHireModal(false);
        }}
      >
        {selectedRider && (
          <GameDialogContent size="sm" data-testid="hire-modal">
            <GameDialogHeader>
              <GameDialogTitle>Confirm Hire</GameDialogTitle>
            </GameDialogHeader>
            <GameDialogBody>
              <p className="text-[var(--text-secondary)] text-sm mb-5 leading-relaxed">
                Hire{' '}
                <strong className="text-[var(--text-primary)]">
                  {selectedRider.firstName} {selectedRider.lastName}
                </strong>
                ? They will join your stable staff.
              </p>

              <Surface variant="subtle" className="p-4 space-y-2 text-sm">
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Weekly Rate:</span>
                  <Currency amount={selectedRider.weeklyRate} />
                </div>
                <div className="flex justify-between border-t border-[var(--glass-border)] pt-2">
                  <span className="font-bold text-[var(--text-secondary)]">Upfront (4 weeks):</span>
                  <Currency
                    amount={calculateHiringCost(selectedRider.weeklyRate)}
                    variant="balance"
                  />
                </div>
              </Surface>
            </GameDialogBody>
            <GameDialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowHireModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleHireConfirm}
                disabled={hireMutation.isPending}
                className="flex-1"
                data-testid="confirm-hire-button"
              >
                {hireMutation.isPending ? 'Hiring...' : 'Hire Rider'}
              </Button>
            </GameDialogFooter>
          </GameDialogContent>
        )}
      </GameDialog>
    </main>
  );
};

export default RiderList;
