/**
 * TrainerList Component — Trainer Marketplace (Epic 13 — Story 13-1 / 13-5)
 *
 * Trainer hiring marketplace interface:
 * - Fetches live data from /api/trainers/marketplace via useTrainerMarketplace()
 * - One-click "Assign Trainer" via useHireTrainer() (owner ruling 2026-10-28, q230:
 *   no confirmation box)
 * - Refresh button wired via useRefreshTrainerMarketplace()
 * - Real user balance from useAuth()
 * - Personality and skill-level filter controls
 *
 * Mirrors RiderList.tsx for the Trainer System.
 *
 * Design-system migration (Equoria-o5hub, world-services family): Surface
 * for panels/cards, form Select for filters, Currency for all coin amounts,
 * canonical SectionLoading / ErrorState / EmptyState, semantic role tokens (no raw
 * palette / text-white/NN).
 *
 * "Assign Trainer" (owner ruling q14 2026-10-23, Equoria-1poxi): the card button hires
 * and assigns in one step, in one server transaction, with one click (q230). With a
 * horse in view (horseId) it assigns to that horse; without one the player picks the
 * horse once, above the list.
 *
 * Cost (owner ruling 2026-10-22, Equoria-3kegj): hiring a trainer is free. A
 * trainer's only cost is its advertised per-training fee (sessionRate), charged
 * once each time it trains one of the player's horses (one training per horse
 * per week).
 */

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { GraduationCap, Coins, RefreshCw } from 'lucide-react';
import TrainerPersonalityBadge from './trainer/TrainerPersonalityBadge';
import {
  useTrainerMarketplace,
  useHireTrainer,
  useRefreshTrainerMarketplace,
  type MarketplaceTrainer,
} from '@/hooks/api/useTrainers';
import { useAuth } from '@/contexts/AuthContext';
import { useHorses } from '@/hooks/api/useHorses';
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
import { staffLevelLabel, staffLevelOrder } from '@/lib/staffLevels';
import { disciplineLabel } from '@/lib/utils/training-utils';

// ─── Constants ────────────────────────────────────────────────────────────────

// How much of a trainer's specialization the card reveals still follows the
// trainer's skill tier. The level the player sees is the star level (Equoria-nawn5).
const specializationVisibility: Record<string, string> = {
  novice: 'Stats hidden — unknown potential',
  developing: 'Some specializations revealed',
  expert: 'All specializations visible',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface TrainerListProps {
  // Auth user id is a UUID string (Equoria-ai6pw / j2a51), not a numeric DB int.
  userId?: string;
  // The horse being viewed, when the listing was opened from a horse's page.
  horseId?: number;
}

const TrainerList: React.FC<TrainerListProps> = ({ horseId }) => {
  const { user } = useAuth();
  // The trainer the last Assign click was for: its card shows "Assigning..." and any refusal.
  const [selectedTrainer, setSelectedTrainer] = useState<MarketplaceTrainer | null>(null);
  const [filterStarLevel, setFilterStarLevel] = useState<string>('all');
  const [filterPersonality, setFilterPersonality] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  // The horse picked above the list when no horse is in view.
  const [pickedHorseId, setPickedHorseId] = useState<string>('');

  const { data: horses } = useHorses();
  const assignHorseId = horseId ?? (pickedHorseId ? Number(pickedHorseId) : null);

  const { data, isLoading, isError, error, refetch } = useTrainerMarketplace();
  const hireMutation = useHireTrainer();
  const refreshMutation = useRefreshTrainerMarketplace();

  const filteredAndSortedTrainers = useMemo(() => {
    const trainers: MarketplaceTrainer[] = data?.trainers ?? [];
    let filtered = [...trainers];

    if (filterStarLevel !== 'all') {
      filtered = filtered.filter((t) => t.starLevel === filterStarLevel);
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
  }, [data, filterStarLevel, filterPersonality, sortBy]);

  // Owner ruling 2026-10-28 (q230): one click hires and assigns; no confirmation box.
  const handleHireClick = (trainer: MarketplaceTrainer) => {
    if (assignHorseId === null) return;
    // A refusal belongs to the attempt that earned it; don't carry it to the next.
    hireMutation.reset();
    setSelectedTrainer(trainer);
    hireMutation.mutate(
      { marketplaceId: trainer.marketplaceId, horseId: assignHorseId },
      { onSuccess: () => setSelectedTrainer(null) }
    );
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
            <option value="rate-asc">Training fee (Low → High)</option>
            <option value="rate-desc">Training fee (High → Low)</option>
          </Select>
        </div>
      </Surface>

      {/* Which horse an assigned trainer goes to, when no horse is in view (q230). */}
      {horseId === undefined && (
        <Surface variant="panel" className="space-y-1.5">
          <label htmlFor="assign-horse-select" className="type-label block">
            Assign to which horse?
          </label>
          <Select
            id="assign-horse-select"
            value={pickedHorseId}
            onChange={(e) => setPickedHorseId(e.target.value)}
            className="w-full sm:max-w-xs"
          >
            <option value="">Choose a horse</option>
            {(horses ?? []).map((horse) => (
              <option key={horse.id} value={String(horse.id)}>
                {horse.name}
              </option>
            ))}
          </Select>
        </Surface>
      )}

      {/* Trainer Grid */}
      <div data-testid="trainer-marketplace">
        {isLoading && <SectionLoading label="Loading trainers" minHeight="192px" />}

        {isError && (
          <ErrorState
            title="Failed to Load Trainers"
            message={userMessageFor(error).message}
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
                        <Link
                          to={`/trainers/offers/${trainer.marketplaceId}${horseId ? `?horseId=${horseId}` : ''}`}
                          className="hover:underline"
                          data-testid={`trainer-link-${trainer.marketplaceId}`}
                        >
                          {trainer.firstName} {trainer.lastName}
                        </Link>
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <StaffLevelStars level={trainer.starLevel} />
                        <TrainerPersonalityBadge personality={trainer.personality} size="sm" />
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm border-y border-[var(--glass-border)] py-3 mb-4">
                    {/* Hiring is free (Equoria-3kegj); said on the card now that the
                        confirmation box is gone (q230). */}
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Hiring:</span>
                      <span className="font-semibold">Free</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Training fee:</span>
                      <span className="font-semibold inline-flex items-center gap-1">
                        <Currency amount={trainer.sessionRate} />
                        per training
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-muted)]">Specializations:</span>
                      <span className="text-[10px] text-[var(--text-muted)] italic">
                        {specializationVisibility[trainer.skillLevel] ??
                          specializationVisibility.novice}
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
                          {disciplineLabel(trainer.speciality)}
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
                    disabled={hireMutation.isPending || assignHorseId === null}
                    className="w-full"
                    aria-label={`Assign Trainer ${trainer.firstName} ${trainer.lastName}`}
                    data-testid={`hire-button-${trainer.marketplaceId}`}
                  >
                    {hireMutation.isPending &&
                    selectedTrainer?.marketplaceId === trainer.marketplaceId
                      ? 'Assigning...'
                      : 'Assign Trainer'}
                  </Button>
                  {hireMutation.isError &&
                    selectedTrainer?.marketplaceId === trainer.marketplaceId && (
                      <InlineError
                        message={actionMessageFor(
                          hireMutation.error,
                          hireRefused,
                          hireRefusalCodes('trainer')
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
    </main>
  );
};

export default TrainerList;
