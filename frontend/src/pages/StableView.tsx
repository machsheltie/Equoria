import React from 'react';
import { Coins, Star, Users, Plus, Settings, AlertCircle, Loader2 } from 'lucide-react';
import HorseCard from '../components/HorseCard';
import { FantasyTabs } from '../components/FantasyTabs';
import { useHorses } from '../hooks/api/useHorses';
import { useProfile } from '../hooks/useAuth';

const StableView = () => {
  // Fetch horses from API
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
    if (!scores) {
      return 'Unknown';
    }

    const entries = Object.entries(scores);
    if (!entries.length) {
      return 'Unknown';
    }

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

  // Transform API data to component format
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
      cooldownHours: 0, // TODO: Calculate from training status
      stats: horse.stats ?? defaultStats,
    })) ?? [];

  const renderHorseList = (category: string) => {
    // Loading state
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-12">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 text-[rgb(37,99,235)] animate-spin mx-auto" />
            <p className="text-sm text-[rgb(148,163,184)]">Loading your stable…</p>
          </div>
        </div>
      );
    }

    // Error state
    if (isError) {
      return (
        <div className="flex items-center justify-center p-12">
          <div className="text-center space-y-4 max-w-md">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h3 className="text-lg font-semibold text-[rgb(220,235,255)]">Unable to Load Horses</h3>
            <p className="text-sm text-[rgb(148,163,184)]">
              {error?.message || 'Failed to fetch horses. Please check your connection.'}
            </p>
            <button onClick={() => refetch()} className="btn-cobalt">
              Try Again
            </button>
          </div>
        </div>
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

    // Empty state
    if (!filtered.length) {
      return (
        <div className="flex items-center justify-center p-12">
          <div className="text-center space-y-3">
            <Star className="w-12 h-12 text-[rgb(37,99,235)] opacity-40 mx-auto" />
            <p className="text-sm text-[rgb(148,163,184)]">No horses in this category</p>
            <button
              onClick={() => refetch()}
              className="text-xs text-[rgb(212,168,67)] underline hover:text-white transition-colors"
            >
              Refresh List
            </button>
          </div>
        </div>
      );
    }

    // Success state with horses
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
            onClick={() => console.log(`Viewing ${horse.name}`)}
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
      {/* Player Info Bar */}
      <div
        className="sticky top-0 z-20 backdrop-blur-sm border-b"
        style={{ background: 'rgba(10,22,40,0.9)', borderColor: 'rgba(37,99,235,0.3)' }}
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Coins */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgb(212,168,67), rgb(100,130,165))' }}
              >
                <Coins className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-semibold" style={{ color: 'rgb(212,168,67)' }}>
                {playerStats.coins.toLocaleString()}
              </span>
            </div>

            {/* XP + Level */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs text-[rgb(148,163,184)] mb-1">XP</p>
                <div
                  className="w-24 h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'rgba(37,99,235,0.2)' }}
                >
                  <div
                    className="h-full rounded-full magical-glow"
                    style={{ width: '65%', background: 'rgb(37,99,235)' }}
                  />
                </div>
                <p className="text-xs text-[rgb(220,235,255)] mt-1">
                  {playerStats.xp.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[rgb(148,163,184)]">Level</p>
                <p className="text-xl font-bold" style={{ color: 'rgb(212,168,67)' }}>
                  {playerStats.level}
                </p>
              </div>
            </div>

            {/* Stable capacity */}
            <div className="text-center">
              <p className="text-xs text-[rgb(148,163,184)] mb-1">Stable</p>
              <p className="text-sm text-[rgb(220,235,255)]">
                {playerStats.stableSlots.used}/{playerStats.stableSlots.total}
              </p>
              <div
                className="w-16 h-1 rounded-full overflow-hidden mt-1"
                style={{ background: 'rgba(37,99,235,0.2)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(playerStats.stableSlots.used / playerStats.stableSlots.total) * 100}%`,
                    background: 'rgb(37,99,235)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 pb-20">
        <FantasyTabs tabs={tabs} defaultValue="all" orientation="horizontal" />
      </div>

      {/* Action buttons */}
      <div className="fixed bottom-6 right-6 space-y-3 z-30">
        <button
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform magical-glow"
          style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
        <button
          className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
          style={{ background: 'rgba(37,99,235,0.3)', border: '1px solid rgba(37,99,235,0.5)' }}
        >
          <Settings className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
};

export default StableView;
