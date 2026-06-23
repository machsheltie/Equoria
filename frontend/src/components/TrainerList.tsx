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
 *
 * Design-system migration (Equoria-o5hub, world-services family): Surface
 * for panels/cards, form Select for filters, Currency for all coin amounts,
 * GameDialog for the hire confirmation (replaces page-local fixed-inset
 * overlay), canonical SectionLoading / ErrorState / EmptyState, semantic
 * role tokens (no raw palette / text-white/NN).
 */

import React, { useState, useMemo } from 'react';
import { GraduationCap, Coins, RefreshCw, AlertCircle } from 'lucide-react';
import TrainerPersonalityBadge from './trainer/TrainerPersonalityBadge';
import {
  useTrainerMarketplace,
  useHireTrainer,
  useRefreshTrainerMarketplace,
  type MarketplaceTrainer,
} from '@/hooks/api/useTrainers';
import { useAuth } from '@/contexts/AuthContext';
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

// ─── Constants ────────────────────────────────────────────────────────────────

const SKILL_LEVEL_LABELS: Record<
  string,
  { label: string; colorClass: string; visibility: string }
> = {
  novice: {
    label: 'Novice',
    colorClass: 'bg-[var(--role-neutral-bg)] text-[var(--role-neutral-text)]',
    visibility: 'Stats hidden — unknown potential',
  },
  developing: {
    label: 'Developing',
    colorClass: 'bg-[var(--role-info-bg)] text-[var(--role-info-text)]',
    visibility: 'Some specializations revealed',
  },
  expert: {
    label: 'Expert',
    colorClass: 'bg-[var(--role-warning-bg)] text-[var(--role-warning-text)]',
    visibility: 'All specializations visible',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface TrainerListProps {
  // Auth user id is a UUID string (Equoria-ai6pw / j2a51), not a numeric DB int.
  userId?: string;
}

const TrainerList: React.FC<TrainerListProps> = () => {
  const { user } = useAuth();
  const [selectedTrainer, setSelectedTrainer] = useState<MarketplaceTrainer | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [filterSkillLevel, setFilterSkillLevel] = useState<string>('all');
  const [filterPersonality, setFilterPersonality] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  const { data, isLoading, isError, error, refetch } = useTrainerMarketplace();
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
          <h2 className="type-section-heading">Trainer Marketplace</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Hire trainers to coach your horses
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
          {data?.canRefreshFree ? (
            'Free Refresh'
          ) : (
            <span className="inline-flex items-center gap-1">
              Refresh (<Currency amount={data?.refreshCost ?? 0} />)
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
        <strong>Level = Information, not quality.</strong> Novice trainers are affordable but their
        specializations are hidden — they could be exceptional. Expert trainers reveal all skills,
        good or bad.
      </div>

      {/* Filters */}
      <Surface
        variant="panel"
        data-testid="trainer-filters"
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
            <option value="novice">Novice</option>
            <option value="developing">Developing</option>
            <option value="expert">Expert</option>
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
            <option value="focused">Focused</option>
            <option value="encouraging">Encouraging</option>
            <option value="technical">Technical</option>
            <option value="competitive">Competitive</option>
            <option value="patient">Patient</option>
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
          </Select>
        </div>
      </Surface>

      {/* Trainer Grid */}
      <div data-testid="trainer-marketplace">
        {isLoading && <SectionLoading label="Loading trainers" minHeight="192px" />}

        {isError && (
          <ErrorState
            title="Failed to Load Trainers"
            message={error?.message ?? 'Unable to reach the marketplace. Please try again later.'}
            retry={{ label: 'Try Again', onClick: () => refetch() }}
          />
        )}

        {!isLoading && !isError && filteredAndSortedTrainers.length === 0 && (
          <EmptyState
            variant="filtered"
            icon={<GraduationCap className="w-8 h-8" aria-hidden="true" />}
            title="No Trainers Match"
            description="Try adjusting your filters"
          />
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
                <Surface
                  variant="panel"
                  key={trainer.marketplaceId}
                  data-testid={`trainer-card-${trainer.marketplaceId}`}
                  // Static card — no hover lift/glow (D-05, Equoria-o5hub.26)
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">
                        {trainer.firstName} {trainer.lastName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-[var(--radius-sm)] uppercase ${skillMeta.colorClass}`}
                        >
                          {skillMeta.label}
                        </span>
                        <TrainerPersonalityBadge personality={trainer.personality} size="sm" />
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm border-y border-[var(--glass-border)] py-3 mb-4">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Weekly Rate:</span>
                      <span className="font-semibold inline-flex items-center gap-1">
                        <Currency amount={trainer.sessionRate} />
                        /wk
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-muted)]">Specializations:</span>
                      <span className="text-[10px] text-[var(--text-muted)] italic">
                        {skillMeta.visibility}
                      </span>
                    </div>
                  </div>

                  {/* Known Speciality (expert only) */}
                  {showSpeciality && (
                    <div className="mb-4">
                      <p className="type-label text-[10px] text-[var(--text-muted)] mb-1">
                        Known Specializations
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-1.5 py-0.5 bg-[var(--badge-rare-bg)] text-[var(--status-rare)] text-[10px] rounded-[var(--radius-sm)]">
                          {trainer.speciality}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Bio */}
                  <p className="text-xs text-[var(--text-muted)] italic mb-4 line-clamp-2">
                    &ldquo;{trainer.bio}&rdquo;
                  </p>

                  {/* Hire Button */}
                  <Button
                    type="button"
                    onClick={() => handleHireClick(trainer)}
                    disabled={!affordable || hireMutation.isPending}
                    className="w-full"
                    aria-label={`Hire ${trainer.firstName} ${trainer.lastName}`}
                    data-testid={`hire-button-${trainer.marketplaceId}`}
                  >
                    {hireMutation.isPending &&
                    selectedTrainer?.marketplaceId === trainer.marketplaceId ? (
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
        open={showHireModal && selectedTrainer !== null}
        onOpenChange={(open) => {
          if (!open) setShowHireModal(false);
        }}
      >
        {selectedTrainer && (
          <GameDialogContent size="sm" data-testid="hire-modal">
            <GameDialogHeader>
              <GameDialogTitle>Confirm Hire</GameDialogTitle>
            </GameDialogHeader>
            <GameDialogBody>
              <p className="text-[var(--text-secondary)] text-sm mb-5 leading-relaxed">
                Hire{' '}
                <strong className="text-[var(--text-primary)]">
                  {selectedTrainer.firstName} {selectedTrainer.lastName}
                </strong>
                ? They will join your training staff.
              </p>

              <Surface variant="subtle" className="p-4 space-y-2 text-sm">
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Weekly Rate:</span>
                  <Currency amount={selectedTrainer.sessionRate} />
                </div>
                <div className="flex justify-between border-t border-[var(--glass-border)] pt-2">
                  <span className="font-bold text-[var(--text-secondary)]">Upfront (4 weeks):</span>
                  <Currency
                    amount={calculateHiringCost(selectedTrainer.sessionRate)}
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
                {hireMutation.isPending ? 'Hiring...' : 'Hire Trainer'}
              </Button>
            </GameDialogFooter>
          </GameDialogContent>
        )}
      </GameDialog>
    </main>
  );
};

export default TrainerList;
