/**
 * StableView — Your Stable
 *
 * The player's horse stable matching direction-4-hybrid.html mockup:
 * atmospheric header, player info strip, tabbed horse grid with
 * medium-density cards (portrait + stats bars + trait chips + care strip).
 */

import React, { useState } from 'react';
import { Award, Coins, Grid3X3, List, Star, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { FantasyTabs } from '../components/FantasyTabs';
import { SkeletonBase } from '@/components/ui/SkeletonCard';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { Button } from '@/components/ui/button';
import { useHorses } from '../hooks/api/useHorses';
import { useProfile } from '../hooks/useAuth';
import { getHorseImage } from '@/lib/breed-images';
import { getXPProgressPercent } from '@/lib/xp-utils';
import { getBreedName } from '@/lib/utils';
import { careChipStatus, trainingCooldownChip } from '@/lib/utils/care-status-utils';
import type { HorseSummary } from '@/lib/api-client';

/* ─── Helpers ────────────────────────────────────────────────────────── */

/** Determine horse category from age + sex */
function getHorseCategory(horse: HorseSummary): string {
  const age = horse.ageYears ?? horse.age ?? 0;
  const sex = (horse.sex ?? horse.gender ?? '').toLowerCase();
  if (age >= 21) return 'retired';
  if (age < 3) return 'foal';
  if (sex === 'stallion') return 'stallion';
  if (sex === 'mare') return 'mare';
  return 'unknown';
}

/** Resolve stat value from flat fields or nested stats object */
function getStat(horse: HorseSummary, stat: keyof HorseSummary['stats']): number {
  return (horse[stat] as number | undefined) ?? horse.stats?.[stat] ?? 0;
}

// Care chip: icon + label, colored by status. Hidden when 'none' (system not active).
function CareChip({ label, status }: { label: string; status: 'good' | 'warn' | 'bad' | 'none' }) {
  if (status === 'none') return null;
  const colors = {
    good: 'text-[var(--status-success)]',
    warn: 'text-[var(--status-warning)]',
    bad: 'text-[var(--status-danger)]',
  };
  const icons = { good: '✓', warn: '⏰', bad: '✗' };
  return (
    <span
      className={`flex items-center gap-1 text-[0.6rem] px-[7px] py-0.5 rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.03)] ${colors[status]}`}
    >
      {icons[status]} {label}
    </span>
  );
}

/* ─── Horse Card — matches direction-4-hybrid.html mockup ─────────────── */

function StableHorseCard({ horse, onClick }: { horse: HorseSummary; onClick: () => void }) {
  const age = horse.ageYears ?? horse.age ?? 0;
  const sex = horse.sex ?? horse.gender ?? '';
  const subtitle = [getBreedName(horse.breed), sex, `${age} yrs`].filter(Boolean).join(' · ');
  const isLegendary = !!(horse as unknown as Record<string, unknown>).isLegendary;

  const traits = horse.traits ?? (horse.trait ? [horse.trait] : []);

  const stats = [
    { label: 'PRC', value: getStat(horse, 'precision') },
    { label: 'STR', value: getStat(horse, 'strength') },
    { label: 'SPD', value: getStat(horse, 'speed') },
    { label: 'AGI', value: getStat(horse, 'agility') },
    { label: 'END', value: getStat(horse, 'endurance') },
    { label: 'INT', value: getStat(horse, 'intelligence') },
    { label: 'STA', value: getStat(horse, 'stamina') },
    { label: 'BAL', value: getStat(horse, 'balance') },
    { label: 'BLD', value: getStat(horse, 'boldness') },
    { label: 'FLX', value: getStat(horse, 'flexibility') },
    { label: 'OBD', value: getStat(horse, 'obedience') },
    { label: 'FCS', value: getStat(horse, 'focus') },
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-[var(--glass-bg)] border rounded-[var(--radius-lg)] overflow-hidden transition-all duration-[250ms] hover:border-[var(--gold-primary)] hover:shadow-[var(--glow-gold-strong)] hover:-translate-y-1 hover:bg-[var(--glass-glow)] active:translate-y-0 active:shadow-[var(--glow-gold)] active:border-[var(--gold-primary)] cursor-pointer group [backdrop-filter:var(--glass-bg-filter)] shadow-[var(--shadow-card)] ${
        isLegendary ? 'border-[var(--gold-dim)]' : 'border-[var(--glass-border)]'
      }`}
      aria-label={`View ${horse.name}`}
    >
      {/* Top: portrait + info */}
      <div className="flex gap-4 p-4 pb-0">
        <div className="w-20 h-20 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0 relative bg-gradient-to-br from-[var(--bg-midnight)] to-[var(--bg-twilight)] overflow-hidden">
          <img
            src={getHorseImage(horse.imageUrl, horse.breed)}
            alt={horse.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/horse-placeholder.png';
            }}
          />
          {horse.level != null && (
            <span className="absolute -bottom-1 -right-1 bg-[var(--glass-glow)] border border-[var(--gold-dim)] rounded-[var(--radius-sm)] px-1.5 py-px text-[0.65rem] font-bold text-[var(--gold-light)]">
              {horse.level}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-[1.1rem] font-semibold text-[var(--text-primary)] truncate mb-0.5"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {horse.name}
          </p>
          <p className="text-[0.75rem] text-[var(--text-secondary)] truncate">{subtitle}</p>
        </div>
      </div>

      {/* Stats — compact 4×3 grid */}
      <div className="grid grid-cols-4 gap-x-3 gap-y-1 px-4 pt-3">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <span className="text-[0.6rem] text-[var(--text-secondary)] uppercase tracking-wider font-medium">
              {s.label}
            </span>
            <span className="text-[0.75rem] font-semibold text-[var(--cream)]">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Trait chips */}
      {traits.length > 0 && (
        <div className="px-4 pt-2 pb-0 flex flex-wrap gap-1">
          {traits.map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[0.6rem] font-medium bg-[var(--glass-glow)] text-[var(--gold-light)]"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Care strip — matches mockup */}
      <div className="flex flex-wrap gap-1 px-3 py-3 mt-2 border-t border-[var(--glass-border)]">
        <CareChip label="Fed" status={careChipStatus(horse.lastFedDate, 1, 3)} />
        <CareChip label="Shod" status={careChipStatus(horse.lastShod, 7, 14)} />
        <CareChip label="Groomed" status={careChipStatus(horse.lastGroomed, 3, 7)} />
        <CareChip label="Vetted" status={careChipStatus(horse.lastVettedDate, 7, 14)} />
        <CareChip
          label={trainingCooldownChip(horse.trainingCooldown).label}
          status={trainingCooldownChip(horse.trainingCooldown).status}
        />
      </div>
    </button>
  );
}

/* ─── Skeleton card for loading state ─────────────────────────────────── */
function SkeletonHorseCard() {
  return <SkeletonBase className="h-40 rounded-[var(--radius-lg)]" />;
}

/* ─── Main StableView ─────────────────────────────────────────────────── */
const HORSES_PER_PAGE = 12;

const StableView = () => {
  const navigate = useNavigate();
  const { data: horsesData, isLoading, isError, error, refetch } = useHorses();
  const { data: profileData } = useProfile();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('stableViewMode') as 'grid' | 'list') || 'grid'
  );
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
        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 p-4"
          aria-label="Loading horses"
        >
          {[...Array(6)].map((_, i) => (
            <SkeletonHorseCard key={i} />
          ))}
        </div>
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
                  <Link to="/marketplace">Browse Marketplace</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Pagination
    const totalPages = Math.ceil(filtered.length / HORSES_PER_PAGE);
    const paginated = filtered.slice(
      (currentPage - 1) * HORSES_PER_PAGE,
      currentPage * HORSES_PER_PAGE
    );

    return (
      <div className="p-4 space-y-4">
        {/* View toggle + count */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--text-muted)]">
            {filtered.length} horse{filtered.length !== 1 ? 's' : ''}
            {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
            {paginated.map(({ horse }) => (
              <StableHorseCard
                key={horse.id}
                horse={horse}
                onClick={() => navigate(`/horses/${horse.id}`)}
              />
            ))}
          </div>
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
              const topStat = ['speed', 'agility', 'stamina', 'precision', 'strength'].reduce(
                (best, stat) => {
                  const val = getStat(horse, stat as keyof HorseSummary['stats']);
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
                  <span className="text-xs">
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

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-xs rounded-[var(--radius-sm)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--gold-dim)] hover:text-[var(--gold-light)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 text-xs rounded-[var(--radius-sm)] transition-colors ${
                  page === currentPage
                    ? 'bg-[var(--glass-glow)] text-[var(--gold-primary)] border border-[var(--gold-dim)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
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
            Your Stable
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
        <FantasyTabs tabs={tabs} defaultValue="all" orientation="horizontal" />
      </div>
    </div>
  );
};

export default StableView;
