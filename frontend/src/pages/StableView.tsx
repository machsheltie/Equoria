/**
 * StableView — My Stable
 *
 * The player's horse stable matching direction-4-hybrid.html mockup:
 * atmospheric header, player info strip, tabbed horse grid with
 * medium-density cards (portrait + stats bars + trait chips + care strip).
 */

import { useState } from 'react';
import { Award, Coins, Grid3X3, List, Star, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CelestialTabs } from '@/components/ui/game';
import { SkeletonBase } from '@/components/ui/SkeletonCard';
import { CardGrid } from '@/components/ui/CardGrid';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { Button } from '@/components/ui/button';
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
      return (
        <div className="flex items-center justify-center p-12">
          <div className="text-center space-y-4 max-w-sm">
            <div
              className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center border border-[var(--gold-dim)]"
              style={{
                background: 'linear-gradient(135deg, var(--glass-glow), var(--bg-deep-space))',
              }}
            >
              <Star className="w-8 h-8 text-[var(--gold-primary)] opacity-40" />
            </div>
            <h3
              className="text-base font-semibold text-[var(--cream)]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {isAll ? 'Your stable is empty' : `No ${tabCategory} yet`}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              {isAll
                ? 'Breed or purchase your first horse to get started.'
                : 'You have no horses in this category yet.'}
            </p>
            {isAll && (
              <div className="flex gap-3 justify-center">
                <Button asChild>
                  <Link to="/breeding">Go to Breeding</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/marketplace/horses">Browse Marketplace</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
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
            <button
              type="button"
              onClick={() => handleViewChange('grid')}
              className={`p-1.5 rounded-[var(--radius-sm)] transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[var(--glass-glow)] text-[var(--gold-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('list')}
              className={`p-1.5 rounded-[var(--radius-sm)] transition-colors ${
                viewMode === 'list'
                  ? 'bg-[var(--glass-glow)] text-[var(--gold-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List className="w-4 h-4" />
            </button>
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
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 text-xs rounded-[var(--radius-sm)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--gold-dim)] hover:text-[var(--gold-light)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
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
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 text-xs rounded-[var(--radius-sm)] transition-colors ${
                      page === safePage
                        ? 'bg-[var(--glass-glow)] text-[var(--gold-primary)] border border-[var(--gold-dim)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'
                    }`}
                  >
                    {page}
                  </button>
                )
              );
            })()}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 text-xs rounded-[var(--radius-sm)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--gold-dim)] hover:text-[var(--gold-light)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
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
    <div className="min-h-screen flex flex-col">
      {/* Atmospheric stable header */}
      <header className="relative overflow-hidden">
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse at 25% 50%, var(--glass-glow) 0%, transparent 55%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse at 80% 30%, rgba(58,111,221,0.06) 0%, transparent 50%)',
          }}
        />

        <div className="relative z-[1] px-4 sm:px-6 lg:px-8 pt-6 pb-4 max-w-7xl mx-auto">
          <h1
            className="text-2xl font-bold text-[var(--gold-primary)] mb-4"
            style={{
              fontFamily: 'var(--font-heading)',
              textShadow: '0 0 30px var(--glass-glow)',
            }}
          >
            My Stable
          </h1>

          {/* Player Info Strip */}
          <div className="flex items-center justify-between gap-4 rounded-xl px-4 py-3 border border-[var(--glass-border)] bg-[var(--glass-bg)] [backdrop-filter:var(--glass-bg-filter)]">
            {/* Coins */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--gold-dim)]"
                style={{
                  background: 'linear-gradient(135deg, var(--glass-glow), var(--bg-deep-space))',
                }}
              >
                <Coins className="w-4 h-4 text-[var(--gold-primary)]" />
              </div>
              <span
                className="text-base font-semibold text-[var(--gold-primary)]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {playerStats.coins.toLocaleString()}
              </span>
            </div>

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
                <p className="text-xs text-[var(--text-primary)] mt-1">
                  {playerStats.xp.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wide">
                  Level
                </p>
                <p
                  className="text-xl font-bold text-[var(--gold-primary)]"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {playerStats.level}
                </p>
              </div>
            </div>

            {/* Horse count */}
            <div className="text-center">
              <p className="text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wide">
                Horses
              </p>
              <p
                className="text-xl font-bold text-[var(--gold-primary)]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {playerStats.horseCount}
              </p>
            </div>
          </div>
        </div>

        {/* Gold accent divider */}
        <div
          className="h-px w-full"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--gold-dim), rgba(58,111,221,0.2), transparent)',
          }}
        />
      </header>

      {/* Main content — tabbed horse grid */}
      <div className="flex-1 pb-8">
        <CelestialTabs tabs={tabs} defaultValue="all" orientation="horizontal" />
      </div>
    </div>
  );
};

export default StableView;
