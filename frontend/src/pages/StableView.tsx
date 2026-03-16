/**
 * StableView — Your Stable
 *
 * The player's horse stable with atmospheric Celestial Night treatment.
 * Sticky player info bar, tabbed horse grid, and floating action buttons.
 */

import React from 'react';
import { Coins, Star, Users, Plus, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import HorseCard from '../components/HorseCard';
import { FantasyTabs } from '../components/FantasyTabs';
import { SkeletonHorseCard } from '@/components/ui/SkeletonCard';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { useHorses } from '../hooks/api/useHorses';
import { useProfile } from '../hooks/useAuth';

const StableView = () => {
  const navigate = useNavigate();
  const { data: horsesData, isLoading, isError, error, refetch } = useHorses();
  const { data: profileData } = useProfile();

  const user = profileData?.user;
  const playerStats = {
    coins: user?.money ?? 0,
    xp: user?.xp ?? 0,
    level: user?.level ?? 1,
    stableSlots: { used: horsesData?.length ?? 0, total: 25 },
  };

  const formatDiscipline = (discipline: string) =>
    discipline
      .split(/[_-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const getPrimaryDiscipline = (scores?: Record<string, number>) => {
    if (!scores) return 'Unknown';
    const entries = Object.entries(scores);
    if (!entries.length) return 'Unknown';
    const [bestDiscipline] = entries.reduce(
      (best, current) => (current[1] > best[1] ? current : best),
      entries[0]
    );
    return formatDiscipline(bestDiscipline);
  };

  const defaultStats = {
    speed: 0,
    stamina: 0,
    agility: 0,
    strength: 0,
    intelligence: 0,
    health: 0,
  };

  const transformedHorses =
    horsesData?.map((horse) => ({
      id: horse.id.toString(),
      name: horse.name,
      age: horse.ageYears ?? horse.age ?? 0,
      discipline: getPrimaryDiscipline(horse.disciplineScores),
      category:
        (horse.ageYears ?? horse.age ?? 0) < 3
          ? 'foal'
          : horse.sex?.toLowerCase() === 'stallion'
            ? 'stallion'
            : horse.sex?.toLowerCase() === 'mare'
              ? 'mare'
              : horse.sex?.toLowerCase() === 'gelding'
                ? 'gelding'
                : 'unknown',
      isLegendary:
        typeof (horse as { isLegendary?: boolean }).isLegendary === 'boolean'
          ? (horse as { isLegendary?: boolean }).isLegendary
          : false,
      cooldownHours: 0,
      stats: horse.stats ?? defaultStats,
    })) ?? [];

  const renderHorseList = (category: string) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-2 gap-4 p-4" aria-label="Loading horses">
          {[...Array(4)].map((_, i) => (
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
      category === 'all'
        ? transformedHorses
        : transformedHorses.filter((horse) => {
            if (category === 'foals') return horse.category === 'foal' || horse.age < 3;
            if (category === 'stallions') return horse.category === 'stallion';
            if (category === 'mares') return horse.category === 'mare';
            if (category === 'retired') return horse.age >= 20;
            return true;
          });

    if (!filtered.length) {
      const isAll = category === 'all';
      return (
        <div className="flex items-center justify-center p-12">
          <div className="text-center space-y-4 max-w-sm">
            <div
              className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center border border-[rgba(201,162,39,0.2)]"
              style={{
                background: 'linear-gradient(135deg, rgba(201,162,39,0.08), rgba(10,22,40,0.8))',
              }}
            >
              <Star className="w-8 h-8 text-[var(--gold-400)] opacity-40" />
            </div>
            <h3 className="text-base font-semibold text-[var(--cream)] font-[var(--font-heading)]">
              {isAll ? 'Your stable is empty' : `No ${category} yet`}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              {isAll
                ? 'Breed or purchase your first horse to get started.'
                : `You have no horses in this category yet.`}
            </p>
            {isAll && (
              <Link to="/breeding" className="btn-primary-arcs inline-block text-sm px-8">
                Go to Breeding
              </Link>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-4 p-4">
        {filtered.map((horse) => (
          <HorseCard
            key={horse.id}
            horseName={horse.name}
            age={horse.age}
            discipline={horse.discipline}
            isLegendary={horse.isLegendary}
            cooldownHours={horse.cooldownHours}
            stats={horse.stats}
            onClick={() => navigate(`/horses/${horse.id}`)}
          />
        ))}
      </div>
    );
  };

  const tabs = [
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
      icon: <Settings className="w-4 h-4" />,
      content: renderHorseList('retired'),
    },
    {
      value: 'all',
      label: 'All',
      icon: <Star className="w-4 h-4" />,
      content: renderHorseList('all'),
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
              'radial-gradient(ellipse at 25% 50%, rgba(201,162,39,0.1) 0%, transparent 55%)',
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
            className="text-2xl font-bold text-[var(--gold-400)] mb-4"
            style={{
              fontFamily: 'var(--font-heading)',
              textShadow: '0 0 30px rgba(201,162,39,0.25)',
            }}
          >
            Your Stable
          </h1>

          {/* Player Info Strip */}
          <div className="flex items-center justify-between gap-4 glass-panel-subtle rounded-xl px-4 py-3">
            {/* Coins */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center border border-[rgba(201,162,39,0.3)]"
                style={{
                  background: 'linear-gradient(135deg, rgba(201,162,39,0.15), rgba(10,22,40,0.8))',
                }}
              >
                <Coins className="w-4 h-4 text-[var(--gold-400)]" />
              </div>
              <span className="text-base font-semibold text-[var(--gold-400)] font-[var(--font-heading)]">
                {playerStats.coins.toLocaleString()}
              </span>
            </div>

            {/* XP + Level */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wide mb-1">
                  XP
                </p>
                <div className="w-24 h-1.5 rounded-full overflow-hidden bg-[rgba(26,58,107,0.6)]">
                  <div
                    className="h-full rounded-full magical-glow"
                    style={{ width: '65%', background: 'var(--celestial-primary)' }}
                  />
                </div>
                <p className="text-xs text-[var(--cream)] mt-1">
                  {playerStats.xp.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wide">
                  Level
                </p>
                <p className="text-xl font-bold text-[var(--gold-400)] font-[var(--font-heading)]">
                  {playerStats.level}
                </p>
              </div>
            </div>

            {/* Stable capacity */}
            <div className="text-center">
              <p className="text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wide mb-1">
                Stable
              </p>
              <p className="text-sm text-[var(--cream)]">
                {playerStats.stableSlots.used}/{playerStats.stableSlots.total}
              </p>
              <div className="w-16 h-1 rounded-full overflow-hidden mt-1 bg-[rgba(26,58,107,0.6)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(playerStats.stableSlots.used / playerStats.stableSlots.total) * 100}%`,
                    background: 'var(--celestial-primary)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Gold accent divider */}
        <div
          className="h-px w-full"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(201,162,39,0.4), rgba(58,111,221,0.2), transparent)',
          }}
        />
      </header>

      {/* Main content — tabbed horse grid */}
      <div className="flex-1 pb-20">
        <FantasyTabs tabs={tabs} defaultValue="all" orientation="horizontal" />
      </div>

      {/* Floating action buttons */}
      <div className="fixed bottom-6 right-6 space-y-3 z-[30]">
        <button
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-[var(--shadow-button)] hover:scale-110 transition-transform magical-glow"
          style={{
            background:
              'linear-gradient(135deg, var(--electric-blue-500) 0%, var(--electric-blue-700) 100%)',
          }}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
        <button className="w-11 h-11 rounded-full flex items-center justify-center shadow-[var(--shadow-button)] hover:scale-110 transition-transform glass-panel">
          <Settings className="w-5 h-5 text-[var(--cream)]" />
        </button>
      </div>
    </div>
  );
};

export default StableView;
