/**
 * StableView — Stable (roster browser at /stable)
 *
 * The player's horse roster: player info strip + tabbed horse grid with
 * medium-density cards (portrait + stats bars + trait chips + care strip).
 *
 * Design-system migration (Equoria-o5hub.20): renamed "My Stable" → "Stable"
 * per D-27 (DECISIONS.md §10); PageHeader + PageContainer replace the local
 * atmospheric hero; player info strip is a Surface panel; empty states use
 * the shared EmptyState; coins render via the canonical Currency component.
 */

import { useState } from 'react';
import { Award, Grid3X3, List, Star, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CanonicalTabs } from '@/components/ui/game';
import { SkeletonBase } from '@/components/ui/SkeletonCard';
import { CardGrid } from '@/components/ui/CardGrid';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import Currency from '@/components/ui/Currency';
import EmptyState from '@/components/ui/EmptyState';
import { HorseCard } from '@/components/horse/HorseCard';
import { CareChip } from '@/components/common/CareChip';
import { careChipStatus, trainingCooldownChip } from '@/lib/utils/care-status-utils';
import { getHorseImage } from '@/lib/breed-images';
import { useHorses } from '../hooks/api/useHorses';
import { useProfile } from '../hooks/useAuth';
import { getXPProgressPercent } from '@/lib/xp-utils';
import type { HorseSummary } from '@/lib/api-client';

/** Resolve stat value from flat fields or nested stats object — used by list view's top-stat reducer. */
function getStat(horse: HorseSummary, stat: keyof HorseSummary['stats']): number {
  return (horse[stat] as number | undefined) ?? horse.stats?.[stat] ?? 0;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

/**
 * Determine horse category from age + sex.
 * Note: Prisma schema only has 'stallion' and 'mare' sex values — no geldings.
 */
function getHorseCategory(horse: HorseSummary): string {
  const age = horse.ageYears ?? horse.age ?? 0;
  const sex = (horse.sex ?? horse.gender ?? '').toLowerCase();
  if (age >= 21) return 'retired';
  if (age < 3) return 'foal';
  if (sex === 'stallion') return 'stallion';
  if (sex === 'mare') return 'mare';
  return 'unknown';
}

/* ─── Skeleton card for loading state ─────────────────────────────────── */
function SkeletonHorseCard() {
  return <SkeletonBase className="h-64 rounded-[var(--radius-lg)]" />;
}

/* ─── Main StableView ─────────────────────────────────────────────────── */
const HORSES_PER_PAGE = 12;

const StableView = () => {
  const navigate = useNavigate();
  const { data: horsesData, isLoading, isError, error, refetch } = useHorses();
  const { data: profileData } = useProfile();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const stored = localStorage.getItem('stableViewMode');
    return stored === 'grid' || stored === 'list' ? stored : 'grid';
  });
  const [currentPage, setCurrentPage] = useState(1);

  const handleViewChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('stableViewMode', mode);
  };

  const user = profileData?.user;
  const playerStats = {
    coins: user?.money ?? 0,
    xp: user?.xp ?? 0,
    level: user?.level ?? 1,
    horseCount: horsesData?.length ?? 0,
  };

  const xpPercent = getXPProgressPercent(playerStats.xp);

  // Compute categories for each horse
  const horsesWithCategory = (horsesData ?? []).map((horse) => ({
    horse,
    category: getHorseCategory(horse),
  }));

  const renderHorseList = (tabCategory: string) => {
    if (isLoading) {
      return (
        <CardGrid className="p-4" aria-label="Loading horses">
          {[...Array(6)].map((_, i) => (
            <SkeletonHorseCard key={i} />
          ))}
        </CardGrid>
      );
    }

    if (isError) {
      return (
        <ErrorCard
          title="Unable to Load Horses"
          message={error?.message || 'Failed to fetch horses. Please check your connection.'}
          onRetry={() => refetch()}
        />
      );
    }

    const filtered =
      tabCategory === 'all'
        ? horsesWithCategory
        : horsesWithCategory.filter(({ category }) => {
            if (tabCategory === 'foals') return category === 'foal';
            if (tabCategory === 'stallions') return category === 'stallion';
            if (tabCategory === 'mares') return category === 'mare';
            if (tabCategory === 'retired') return category === 'retired';
            return true;
          });

    if (!filtered.length) {
      const isAll = tabCategory === 'all';
      // Shared EmptyState (D-17): first-use for an empty stable (one gold
      // primary + one secondary action, D-08), filtered for empty tab filters.
      return isAll ? (
        <EmptyState
          variant="first-use"
          icon={<Star className="w-8 h-8" />}
          title="Your stable is empty"
          description="Breed or purchase your first horse to get started."
          primaryAction={{ label: 'Go to Breeding', onClick: () => navigate('/breeding') }}
          secondaryAction={{
            label: 'Browse Marketplace',
            onClick: () => navigate('/marketplace/horses'),
          }}
        />
      ) : (
        <EmptyState
          variant="filtered"
          icon={<Star className="w-8 h-8" />}
          title={`No ${tabCategory} yet`}
          description="You have no horses in this category yet."
        />
      );
    }

    // Pagination — clamp page to valid range when tab filter changes result count
    const totalPages = Math.ceil(filtered.length / HORSES_PER_PAGE);
    const safePage = currentPage > totalPages ? 1 : currentPage;
    const paginated = filtered.slice((safePage - 1) * HORSES_PER_PAGE, safePage * HORSES_PER_PAGE);

    return (
      <div className="p-4 space-y-4">
        {/* View toggle + count */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--text-muted)]">
            {filtered.length} horse{filtered.length !== 1 ? 's' : ''}
            {totalPages > 1 && ` · Page ${safePage} of ${totalPages}`}
          </p>
          <div className="flex gap-1">
            {/* IconButton (D-07/D-09): canonical icon-only control with required aria-label */}
            <IconButton
              type="button"
              onClick={() => handleViewChange('grid')}
              className={
                viewMode === 'grid'
                  ? 'bg-[var(--glass-glow)] text-[var(--gold-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              icon={<Grid3X3 className="w-4 h-4" />}
            />
            <IconButton
              type="button"
              onClick={() => handleViewChange('list')}
              className={
                viewMode === 'list'
                  ? 'bg-[var(--glass-glow)] text-[var(--gold-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              icon={<List className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Grid or List view */}
        {viewMode === 'grid' ? (
          <CardGrid>
            {paginated.map(({ horse }) => (
              <HorseCard
                key={horse.id}
                horse={horse}
                onClick={() => navigate(`/horses/${horse.id}`)}
              />
            ))}
          </CardGrid>
        ) : (
          <div className="space-y-1">
            {/* List header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider font-medium border-b border-[var(--glass-border)]">
              <span>Horse</span>
              <span>Level</span>
              <span>Top Stat</span>
              <span>Status</span>
              <span>Cooldown</span>
            </div>
            {paginated.map(({ horse }) => {
              const allStats: (keyof HorseSummary['stats'])[] = [
                'speed',
                'agility',
                'stamina',
                'precision',
                'strength',
                'endurance',
                'intelligence',
                'balance',
                'boldness',
                'flexibility',
                'obedience',
                'focus',
              ];
              const topStat = allStats.reduce(
                (best, stat) => {
                  const val = getStat(horse, stat);
                  return val > best.value ? { label: stat, value: val } : best;
                },
                { label: '', value: 0 }
              );
              const cooldown = trainingCooldownChip(horse.trainingCooldown);
              return (
                <button
                  key={horse.id}
                  type="button"
                  onClick={() => navigate(`/horses/${horse.id}`)}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2.5 items-center text-left rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--glass-glow)] cursor-pointer border border-transparent hover:border-[var(--glass-border)]"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <img
                      src={getHorseImage(horse.imageUrl, horse.breed)}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/horse-placeholder.png';
                      }}
                    />
                    <span className="truncate text-sm text-[var(--text-primary)] font-medium">
                      {horse.name}
                    </span>
                  </span>
                  <span className="text-sm text-[var(--gold-light)]">{horse.level ?? '—'}</span>
                  <span className="text-sm text-[var(--text-primary)] capitalize">
                    {topStat.label ? `${topStat.label} ${topStat.value}` : '—'}
                  </span>
                  <span className="flex gap-1 text-xs">
                    <CareChip label="Fed" status={careChipStatus(horse.lastFedDate, 1, 3)} />
                    <CareChip label="Shod" status={careChipStatus(horse.lastShod, 7, 14)} />
                    <CareChip label={cooldown.label} status={cooldown.status} />
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {cooldown.status === 'warn' ? 'On cooldown' : 'Ready'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Pagination controls — truncated for large page counts */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {/* Pagination — canonical Button tiers (raw command buttons removed, D-08/D-09) */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              Previous
            </Button>
            {(() => {
              const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (safePage > 3) pages.push('ellipsis-start');
                const start = Math.max(2, safePage - 1);
                const end = Math.min(totalPages - 1, safePage + 1);
                for (let i = start; i <= end; i++) pages.push(i);
                if (safePage < totalPages - 2) pages.push('ellipsis-end');
                pages.push(totalPages);
              }
              return pages.map((page) =>
                typeof page === 'string' ? (
                  <span
                    key={page}
                    className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)]"
                  >
                    ...
                  </span>
                ) : (
                  <Button
                    key={page}
                    type="button"
                    variant={page === safePage ? 'outline' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    aria-current={page === safePage ? 'page' : undefined}
                    className={
                      page === safePage ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)]'
                    }
                  >
                    {page}
                  </Button>
                )
              );
            })()}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    );
  };

  const tabs = [
    {
      value: 'all',
      label: 'All',
      icon: <Star className="w-4 h-4" />,
      content: renderHorseList('all'),
    },
    {
      value: 'foals',
      label: 'Foals',
      icon: <Star className="w-4 h-4" />,
      content: renderHorseList('foals'),
    },
    {
      value: 'mares',
      label: 'Mares',
      icon: <Users className="w-4 h-4" />,
      content: renderHorseList('mares'),
    },
    {
      value: 'stallions',
      label: 'Stallions',
      icon: <Users className="w-4 h-4" />,
      content: renderHorseList('stallions'),
    },
    {
      value: 'retired',
      label: 'Retired',
      icon: <Award className="w-4 h-4" />,
      content: renderHorseList('retired'),
    },
  ];

  return (
    <PageContainer variant="wide" padded={false} className="pb-8">
      {/* PageHeader (D-01): compact operational header — replaces the local
          atmospheric hero (ambient orbs + gradient divider removed). Title is
          "Stable" per D-27 (DECISIONS.md §10). */}
      <PageHeader
        title="Stable"
        subtitle="Your horse roster"
        metadata={
          /* Player Info Strip — Surface panel replaces the local glass recipe
             (page-local backdrop-filter removed per the single-blur rule). */
          <Surface
            variant="panel"
            className="flex items-center justify-between gap-4 px-4 py-3"
            data-testid="stable-player-info"
          >
            {/* Coins — canonical Currency component (DECISIONS.md §9) */}
            <Currency amount={playerStats.coins} variant="balance" />

            {/* XP + Level */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wide mb-1">
                  XP
                </p>
                <div className="w-24 h-1.5 rounded-full overflow-hidden bg-[var(--bg-twilight)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${xpPercent}%`, background: 'var(--gold-primary)' }}
                  />
                </div>
                <p className="text-xs text-role-primary mt-1">{playerStats.xp.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wide">
                  Level
                </p>
                <p className="text-xl font-bold text-[var(--gold-primary)] font-[var(--font-heading)]">
                  {playerStats.level}
                </p>
              </div>
            </div>

            {/* Horse count */}
            <div className="text-center">
              <p className="text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wide">
                Horses
              </p>
              <p className="text-xl font-bold text-[var(--gold-primary)] font-[var(--font-heading)]">
                {playerStats.horseCount}
              </p>
            </div>
          </Surface>
        }
      />

      {/* Main content — tabbed horse grid */}
      <div className="mt-2">
        <CanonicalTabs tabs={tabs} defaultValue="all" />
      </div>
    </PageContainer>
  );
};

export default StableView;
