/**
 * TrainerList Component — Trainer Marketplace (Epic 13 — Story 13-1 / 13-5)
 *
 * Trainer hiring marketplace interface:
 * - Fetches live data from /api/trainers/marketplace via useTrainerMarketplace()
 * - Hire button wired via useHireTrainer() + confirmation modal
 * - Refresh button wired via useRefreshTrainerMarketplace()
 * - Real user balance from useAuth()
 * - Personality and skill-level filter controls
 *
 * Mirrors RiderList.tsx for the Trainer System.
 */

import React, { useState, useMemo } from 'react';
import { GraduationCap, DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import TrainerPersonalityBadge from './trainer/TrainerPersonalityBadge';
import {
  useTrainerMarketplace,
  useHireTrainer,
  useRefreshTrainerMarketplace,
  type MarketplaceTrainer,
} from '@/hooks/api/useTrainers';
import { useAuth } from '@/contexts/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const SKILL_LEVEL_LABELS: Record<
  string,
  { label: string; colorClass: string; visibility: string }
> = {
  novice: {
    label: 'Novice',
    colorClass: 'bg-[rgba(15,35,70,0.6)] text-[rgb(148,163,184)]',
    visibility: 'Stats hidden — unknown potential',
  },
  developing: {
    label: 'Developing',
    colorClass: 'bg-blue-900/60 text-blue-300',
    visibility: 'Some specializations revealed',
  },
  expert: {
    label: 'Expert',
    colorClass: 'bg-amber-900/60 text-amber-300',
    visibility: 'All specializations visible',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface TrainerListProps {
  userId?: number;
}

const TrainerList: React.FC<TrainerListProps> = () => {
  const { user } = useAuth();
  const [selectedTrainer, setSelectedTrainer] = useState<MarketplaceTrainer | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [filterSkillLevel, setFilterSkillLevel] = useState<string>('all');
  const [filterPersonality, setFilterPersonality] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  const { data, isLoading, isError, error } = useTrainerMarketplace();
  const hireMutation = useHireTrainer();
  const refreshMutation = useRefreshTrainerMarketplace();

  const calculateHiringCost = (sessionRate: number) => sessionRate * 4; // 4-week upfront

  const canAfford = (sessionRate: number) => (user?.money ?? 0) >= calculateHiringCost(sessionRate);

  const filteredAndSortedTrainers = useMemo(() => {
    const trainers: MarketplaceTrainer[] = data?.trainers ?? [];
    let filtered = [...trainers];

    if (filterSkillLevel !== 'all') {
      filtered = filtered.filter((t) => t.skillLevel === filterSkillLevel);
    }
    if (filterPersonality !== 'all') {
      filtered = filtered.filter((t) => t.personality === filterPersonality);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rate-asc':
          return a.sessionRate - b.sessionRate;
        case 'rate-desc':
          return b.sessionRate - a.sessionRate;
        default:
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      }
    });

    return filtered;
  }, [data, filterSkillLevel, filterPersonality, sortBy]);

  const handleHireClick = (trainer: MarketplaceTrainer) => {
    setSelectedTrainer(trainer);
    setShowHireModal(true);
  };

  const handleHireConfirm = () => {
    if (!selectedTrainer) return;
    hireMutation.mutate(selectedTrainer.marketplaceId, {
      onSuccess: () => {
        setShowHireModal(false);
        setSelectedTrainer(null);
      },
    });
  };

  const handleRefresh = () => {
    const force = !data?.canRefreshFree;
    refreshMutation.mutate(force);
  };

  return (
    <main
      role="main"
      aria-label="Trainer marketplace"
      data-testid="trainer-list"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white/90">Trainer Marketplace</h2>
          <p className="text-sm text-white/50 mt-0.5">Hire trainers to coach your horses</p>
        </div>
        <button
          type="button"
          data-testid="refresh-marketplace-button"
          onClick={handleRefresh}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/10 text-white/70 rounded-lg hover:bg-white/15 hover:text-white transition-all disabled:opacity-50 text-sm"
          aria-label="Refresh marketplace"
        >
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {data?.canRefreshFree ? 'Free Refresh' : `Refresh (${data?.refreshCost ?? 0} Coins)`}
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
        <strong>Level = Information, not quality.</strong> Novice trainers are affordable but their
        specializations are hidden — they could be exceptional. Expert trainers reveal all skills,
        good or bad.
      </div>

      {/* Filters */}
      <div
        data-testid="trainer-filters"
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
            <option value="novice">Novice</option>
            <option value="developing">Developing</option>
            <option value="expert">Expert</option>
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
            <option value="focused">Focused</option>
            <option value="encouraging">Encouraging</option>
            <option value="technical">Technical</option>
            <option value="competitive">Competitive</option>
            <option value="patient">Patient</option>
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
          </select>
        </div>
      </div>

      {/* Trainer Grid */}
      <div data-testid="trainer-marketplace">
        {isLoading && (
          <div className="text-center py-12 border border-white/10 rounded-xl">
            <GraduationCap className="w-12 h-12 text-white/20 mx-auto mb-3 animate-pulse" />
            <p className="text-sm text-white/40">Loading trainers...</p>
          </div>
        )}

        {isError && (
          <div className="text-center py-12 border border-red-500/20 rounded-xl bg-red-900/10">
            <GraduationCap className="w-12 h-12 text-red-400/40 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-400/70 mb-1">Failed to Load Trainers</h3>
            <p className="text-sm text-white/30">
              {error?.message ?? 'Unable to reach the marketplace. Please try again later.'}
            </p>
          </div>
        )}

        {!isLoading && !isError && filteredAndSortedTrainers.length === 0 && (
          <div className="text-center py-12 border border-white/10 rounded-xl">
            <GraduationCap className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white/50 mb-1">No Trainers Match</h3>
            <p className="text-sm text-white/30 mb-4">Try adjusting your filters</p>
          </div>
        )}

        {!isLoading && !isError && filteredAndSortedTrainers.length > 0 && (
          <div
            data-testid="trainer-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filteredAndSortedTrainers.map((trainer) => {
              const hiringCost = calculateHiringCost(trainer.sessionRate);
              const affordable = canAfford(trainer.sessionRate);
              const skillMeta = SKILL_LEVEL_LABELS[trainer.skillLevel] ?? SKILL_LEVEL_LABELS.novice;
              const showSpeciality =
                trainer.skillLevel === 'expert' && trainer.speciality.trim().length > 0;

              return (
                <div
                  key={trainer.marketplaceId}
                  data-testid={`trainer-card-${trainer.marketplaceId}`}
                  className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white/90">
                        {trainer.firstName} {trainer.lastName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded uppercase ${skillMeta.colorClass}`}
                        >
                          {skillMeta.label}
                        </span>
                        <TrainerPersonalityBadge personality={trainer.personality} size="sm" />
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm border-y border-white/5 py-3 mb-4">
                    <div className="flex justify-between">
                      <span className="text-white/40">Weekly Rate:</span>
                      <span className="font-semibold text-celestial-gold">
                        {trainer.sessionRate.toLocaleString()} Coins/wk
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/40">Specializations:</span>
                      <span className="text-[10px] text-white/40 italic">
                        {skillMeta.visibility}
                      </span>
                    </div>
                  </div>

                  {/* Known Speciality (expert only) */}
                  {showSpeciality && (
                    <div className="mb-4">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                        Known Specializations
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-1.5 py-0.5 bg-violet-900/30 text-violet-400 text-[10px] rounded">
                          {trainer.speciality}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Bio */}
                  <p className="text-xs text-white/40 italic mb-4 line-clamp-2">
                    &ldquo;{trainer.bio}&rdquo;
                  </p>

                  {/* Hire Button */}
                  <button
                    type="button"
                    onClick={() => handleHireClick(trainer)}
                    disabled={!affordable || hireMutation.isPending}
                    className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${
                      affordable
                        ? 'bg-celestial-gold/80 text-black hover:bg-celestial-gold'
                        : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
                    }`}
                    aria-label={`Hire ${trainer.firstName} ${trainer.lastName}`}
                    data-testid={`hire-button-${trainer.marketplaceId}`}
                  >
                    {hireMutation.isPending &&
                    selectedTrainer?.marketplaceId === trainer.marketplaceId
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
      {showHireModal && selectedTrainer && (
        <div
          data-testid="hire-modal"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[var(--z-modal)] animate-in fade-in duration-200"
          onClick={() => setShowHireModal(false)}
        >
          <div
            className="bg-deep-space border border-white/10 rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-celestial-gold/10 p-2 rounded-full">
                <GraduationCap className="w-5 h-5 text-celestial-gold" />
              </div>
              <h3 className="text-lg font-bold text-white/90">Confirm Hire</h3>
            </div>

            <p className="text-white/60 text-sm mb-5 leading-relaxed">
              Hire{' '}
              <strong className="text-white/90">
                {selectedTrainer.firstName} {selectedTrainer.lastName}
              </strong>
              ? They will join your training staff.
            </p>

            <div className="bg-white/5 rounded-xl p-4 mb-5 border border-white/10 space-y-2 text-sm">
              <div className="flex justify-between text-white/60">
                <span>Weekly Rate:</span>
                <span>{selectedTrainer.sessionRate.toLocaleString()} Coins</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="font-bold text-white/80">Upfront (4 weeks):</span>
                <span className="text-xl font-black text-celestial-gold">
                  {calculateHiringCost(selectedTrainer.sessionRate).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowHireModal(false)}
                className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-white/60 font-medium hover:bg-white/5 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleHireConfirm}
                disabled={hireMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-celestial-gold/80 text-black font-bold rounded-lg hover:bg-celestial-gold transition-all active:scale-95 disabled:opacity-50 text-sm"
                data-testid="confirm-hire-button"
              >
                {hireMutation.isPending ? 'Hiring...' : 'Hire Trainer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default TrainerList;
