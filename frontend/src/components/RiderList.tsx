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
 */

import React, { useState, useMemo } from 'react';
import { Users, DollarSign, RefreshCw, AlertCircle, X } from 'lucide-react';
import {
  useRiderMarketplace,
  useHireRider,
  useRefreshRiderMarketplace,
  type MarketplaceRider,
  type RiderMarketplaceData,
} from '@/hooks/api/useRiders';
import { useAuth } from '@/contexts/AuthContext';
import RiderPersonalityBadge from './rider/RiderPersonalityBadge';

interface RiderListProps {
  userId: number;
  onRiderHired?: (_rider: MarketplaceRider) => void;
  marketplaceData?: RiderMarketplaceData;
}

const SKILL_LEVEL_LABELS: Record<
  string,
  { label: string; colorClass: string; visibility: string }
> = {
  rookie: {
    label: 'Rookie',
    colorClass: 'bg-slate-700 text-slate-300',
    visibility: 'Stats hidden — unknown potential',
  },
  developing: {
    label: 'Developing',
    colorClass: 'bg-blue-900/60 text-blue-300',
    visibility: 'Some stats revealed',
  },
  experienced: {
    label: 'Experienced',
    colorClass: 'bg-amber-900/60 text-amber-300',
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
      <div data-testid="rider-list" className="flex items-center justify-center h-48 text-white/40">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading rider marketplace...
      </div>
    );
  }

  if (marketplaceError) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
        <X className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-red-300 mb-1">Error Loading Marketplace</h3>
        <p className="text-red-400/70 text-sm">{marketplaceError.message}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-5 py-2 bg-red-700/50 text-red-200 rounded-lg hover:bg-red-700/70 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <main role="main" aria-label="Rider marketplace" data-testid="rider-list" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white/90">Rider Marketplace</h2>
          <p className="text-sm text-white/50 mt-0.5">Hire riders to compete with your horses</p>
        </div>
        <button
          data-testid="refresh-marketplace-button"
          onClick={handleRefresh}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/10 text-white/70 rounded-lg hover:bg-white/15 hover:text-white transition-all disabled:opacity-50 text-sm"
          aria-label="Refresh marketplace"
        >
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {marketplaceData?.canRefreshFree
            ? 'Free Refresh'
            : `Refresh (${marketplaceData?.refreshCost ?? 0} Coins)`}
        </button>
      </div>

      {/* User Balance */}
      {user && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm">
          <div className="flex items-center gap-2 text-white/50">
            <DollarSign className="w-4 h-4" />
            <span>Your Balance</span>
          </div>
          <span className="font-bold text-celestial-gold">
            {(user.money ?? 0).toLocaleString()} Coins
          </span>
        </div>
      )}

      {/* Skill Level Transparency Note */}
      <div className="px-4 py-3 rounded-lg bg-blue-900/20 border border-blue-500/20 text-xs text-blue-300/80">
        <strong>Level = Information, not quality.</strong> Rookies are cheap but their abilities are
        hidden — they could be exceptional. Experienced riders reveal all stats, good or bad.
      </div>

      {/* Filters */}
      <div
        data-testid="rider-filters"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white/5 border border-white/10 rounded-xl"
      >
        <div>
          <label
            htmlFor="skill-level-filter"
            className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5"
          >
            Skill Level
          </label>
          <select
            id="skill-level-filter"
            data-testid="skill-level-filter"
            value={filterSkillLevel}
            onChange={(e) => setFilterSkillLevel(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20"
          >
            <option value="all">All Levels</option>
            <option value="rookie">Rookie</option>
            <option value="developing">Developing</option>
            <option value="experienced">Experienced</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="personality-filter"
            className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5"
          >
            Personality
          </label>
          <select
            id="personality-filter"
            data-testid="personality-filter"
            value={filterPersonality}
            onChange={(e) => setFilterPersonality(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20"
          >
            <option value="all">All Personalities</option>
            <option value="daring">Daring</option>
            <option value="methodical">Methodical</option>
            <option value="intuitive">Intuitive</option>
            <option value="competitive">Competitive</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="sort-select"
            className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5"
          >
            Sort By
          </label>
          <select
            id="sort-select"
            data-testid="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20"
          >
            <option value="name">Name</option>
            <option value="rate-asc">Rate (Low → High)</option>
            <option value="rate-desc">Rate (High → Low)</option>
            <option value="experience-desc">Most Experienced</option>
          </select>
        </div>
      </div>

      {/* Rider Grid */}
      <div data-testid="rider-marketplace">
        {filteredAndSortedRiders.length === 0 ? (
          <div className="text-center py-12 border border-white/10 rounded-xl">
            <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white/50 mb-1">No Riders Available</h3>
            <p className="text-sm text-white/30 mb-4">Try refreshing the marketplace</p>
            <button
              onClick={handleRefresh}
              className="px-5 py-2 bg-white/10 text-white/60 rounded-lg hover:bg-white/15 text-sm"
            >
              Refresh
            </button>
          </div>
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
                <div
                  key={rider.marketplaceId}
                  data-testid={`rider-card-${rider.marketplaceId}`}
                  className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white/90">
                        {rider.firstName} {rider.lastName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded uppercase ${skillMeta.colorClass}`}
                        >
                          {skillMeta.label}
                        </span>
                        <RiderPersonalityBadge personality={rider.personality} size="sm" />
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm border-y border-white/5 py-3 mb-4">
                    <div className="flex justify-between">
                      <span className="text-white/40">Experience:</span>
                      <span className="text-white/70">
                        {rider.skillLevel === 'rookie' ? '???' : `${rider.experience} XP`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Weekly Rate:</span>
                      <span className="font-semibold text-celestial-gold">
                        {rider.weeklyRate.toLocaleString()} Coins/wk
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/40">Stats:</span>
                      <span className="text-[10px] text-white/40 italic">
                        {skillMeta.visibility}
                      </span>
                    </div>
                  </div>

                  {/* Known Affinities (experienced only) */}
                  {rider.skillLevel === 'experienced' && rider.knownAffinities.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                        Known Affinities
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {rider.knownAffinities.map((a) => (
                          <span
                            key={a}
                            className="px-1.5 py-0.5 bg-emerald-900/30 text-emerald-400 text-[10px] rounded"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bio */}
                  <p className="text-xs text-white/40 italic mb-4 line-clamp-2">"{rider.bio}"</p>

                  {/* Hire Button */}
                  <button
                    onClick={() => handleHireClick(rider)}
                    disabled={!affordable || hireMutation.isPending}
                    className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${
                      affordable
                        ? 'bg-celestial-gold/80 text-black hover:bg-celestial-gold'
                        : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
                    }`}
                    aria-label={`Hire ${rider.firstName} ${rider.lastName}`}
                    data-testid={`hire-button-${rider.marketplaceId}`}
                  >
                    {hireMutation.isPending && selectedRider?.marketplaceId === rider.marketplaceId
                      ? 'Hiring...'
                      : affordable
                        ? `Hire — ${hiringCost.toLocaleString()} Coins`
                        : 'Insufficient Funds'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Low balance warning */}
      {user && (user.money ?? 0) < 5000 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-900/20 border border-amber-500/30 text-sm text-amber-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>Low balance — hiring requires a 4-week upfront payment.</p>
        </div>
      )}

      {/* Hire Confirmation Modal */}
      {showHireModal && selectedRider && (
        <div
          data-testid="hire-modal"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => setShowHireModal(false)}
        >
          <div
            className="bg-deep-space border border-white/10 rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-celestial-gold/10 p-2 rounded-full">
                <Users className="w-5 h-5 text-celestial-gold" />
              </div>
              <h3 className="text-lg font-bold text-white/90">Confirm Hire</h3>
            </div>

            <p className="text-white/60 text-sm mb-5 leading-relaxed">
              Hire{' '}
              <strong className="text-white/90">
                {selectedRider.firstName} {selectedRider.lastName}
              </strong>
              ? They will join your stable staff.
            </p>

            <div className="bg-white/5 rounded-xl p-4 mb-5 border border-white/10 space-y-2 text-sm">
              <div className="flex justify-between text-white/60">
                <span>Weekly Rate:</span>
                <span>{selectedRider.weeklyRate.toLocaleString()} Coins</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="font-bold text-white/80">Upfront (4 weeks):</span>
                <span className="text-xl font-black text-celestial-gold">
                  {calculateHiringCost(selectedRider.weeklyRate).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowHireModal(false)}
                className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-white/60 font-medium hover:bg-white/5 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleHireConfirm}
                disabled={hireMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-celestial-gold/80 text-black font-bold rounded-lg hover:bg-celestial-gold transition-all active:scale-95 disabled:opacity-50 text-sm"
                data-testid="confirm-hire-button"
              >
                {hireMutation.isPending ? 'Hiring...' : 'Hire Rider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default RiderList;
