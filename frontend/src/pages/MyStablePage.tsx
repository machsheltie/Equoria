/**
 * MyStablePage — Stable Profile & Legacy Hall of Fame (Epic 12 — Story 12-3)
 *
 * Displays the player's stable profile (name, banner, bio, stats) and a
 * Legacy Hall of Fame showcasing retired horses.
 * Distinct from ProfilePage (/profile) which handles account/auth settings.
 * Uses live horse/profile data and honest empty states.
 *
 * Uses Celestial Night theme (consistent with other standalone pages).
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Trophy, Heart, Award, Flame, ChevronRight } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import PageHero from '@/components/layout/PageHero';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdateProfile } from '@/hooks/useAuth';
import { useHorses } from '@/hooks/api/useHorses';
import { useUserCompetitionStats } from '@/hooks/api/useUserCompetitionStats';
import {
  fetchHorseCompetitionHistory,
  type CompetitionHistoryData,
} from '@/lib/api/competitionResults';
import { horseCompetitionHistoryQueryKeys } from '@/hooks/api/useHorseCompetitionHistory';
import { getBreedName } from '@/lib/utils';

type StableTab = 'profile' | 'legacy';

interface HallOfFameEntry {
  id: string;
  name: string;
  breed: string;
  retiredAge: number;
  discipline: string;
  career: {
    competitions: number;
    wins: number;
    earnings: number;
  };
  icon: string;
}

interface StableProfile {
  name: string;
  founded: string;
  bio: string;
  banner: string;
  stats: {
    totalHorses: number;
    activeRacers: number;
    competitionsEntered: number;
    firstPlaceFinishes: number;
    totalEarnings: number;
    breedingPairs: number;
  };
}

const StableProfileTab: React.FC<{
  stable: StableProfile;
  isLoading: boolean;
  isEditing: boolean;
  draftStableName: string;
  onDraftStableNameChange: (_value: string) => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSave: () => void;
  isSaving: boolean;
}> = ({
  stable,
  isLoading,
  isEditing,
  draftStableName,
  onDraftStableNameChange,
  onStartEditing,
  onCancelEditing,
  onSave,
  isSaving,
}) => (
  <div className="space-y-6" data-testid="stable-profile-tab">
    {/* Stable Banner */}
    <div className="flex items-center gap-5 p-6 bg-white/5 border border-white/10 rounded-xl">
      <div className="text-5xl select-none" aria-hidden="true">
        {stable.banner}
      </div>
      <div className="flex-1">
        <h2 className="text-2xl font-bold text-white/90">{stable.name}</h2>
        <p className="text-sm text-white/50 mt-1">Founded {stable.founded}</p>
        <p className="text-sm text-white/60 mt-2 max-w-lg">
          {isLoading ? 'Loading stable records...' : stable.bio}
        </p>
      </div>
      {isEditing ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={draftStableName}
            onChange={(event) => onDraftStableNameChange(event.target.value)}
            className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white/90"
            aria-label="Stable profile name"
          />
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || draftStableName.trim().length < 3}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-celestial-gold/20 border border-celestial-gold/40 text-celestial-gold disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onCancelEditing}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-white/5 border border-white/10 text-white/60 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onStartEditing}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white/90 hover:bg-white/10"
        >
          Edit Profile
        </button>
      )}
    </div>

    {/* Stable Statistics */}
    <div>
      <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
        Stable Statistics
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="stable-stats">
        <StatBlock
          label="Total Horses"
          value={stable.stats.totalHorses}
          icon={<Heart className="w-4 h-4 text-rose-400" />}
        />
        <StatBlock
          label="Active Racers"
          value={stable.stats.activeRacers}
          icon={<Flame className="w-4 h-4 text-orange-400" />}
        />
        <StatBlock
          label="Competitions"
          value={stable.stats.competitionsEntered}
          icon={<Trophy className="w-4 h-4 text-celestial-gold" />}
        />
        <StatBlock
          label="First Place Wins"
          value={stable.stats.firstPlaceFinishes}
          icon={<Award className="w-4 h-4 text-celestial-gold" />}
        />
        <StatBlock
          label="Total Earnings"
          value={`${stable.stats.totalEarnings.toLocaleString()} coins`}
          icon={<Star className="w-4 h-4 text-violet-400" />}
        />
        <StatBlock
          label="Breeding Pairs"
          value={stable.stats.breedingPairs}
          icon={<Heart className="w-4 h-4 text-pink-400" />}
        />
      </div>
    </div>

    {/* Quick Link to Stable */}
    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
      <div>
        <p className="text-sm font-medium text-white/80">View Active Horses</p>
        <p className="text-xs text-white/40 mt-0.5">See all horses currently in your stable</p>
      </div>
      <Link
        to="/stable"
        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/60 hover:text-[var(--text-primary)] hover:bg-white/10 transition-all"
      >
        Go to Stable
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  </div>
);

const StatBlock: React.FC<{ label: string; value: number | string; icon: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => (
  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-xs text-white/50 uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-xl font-bold text-white/90">{value}</p>
  </div>
);

const LegacyHallTab: React.FC<{ entries: HallOfFameEntry[] }> = ({ entries }) => (
  <div className="space-y-4" data-testid="legacy-hall-tab">
    <p className="text-sm text-white/50">
      Retired horses live on in the Hall of Fame, their careers immortalised for future generations.
    </p>

    {entries.length === 0 ? (
      <div className="flex flex-col items-center justify-center min-h-48 text-center p-8">
        <Trophy className="w-12 h-12 text-white/20 mb-4" />
        <h3 className="text-base font-semibold text-white/60 mb-2">No Retired Horses Yet</h3>
        <p className="text-white/40 text-sm max-w-xs">
          Horses reach retirement at level 10 or after 80–104 career weeks of competition. Retire a
          horse at level 8 or higher to induct them into your Hall of Fame.
        </p>
      </div>
    ) : (
      <div className="space-y-4">
        {entries.map((entry, index) => (
          <HallOfFameCard key={entry.id} entry={entry} rank={index + 1} />
        ))}
      </div>
    )}
  </div>
);

const HallOfFameCard: React.FC<{ entry: HallOfFameEntry; rank: number }> = ({ entry, rank }) => (
  <div
    className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-celestial-gold/30 transition-all"
    data-testid={`hof-entry-${entry.id}`}
  >
    <div className="flex items-start gap-4">
      {/* Rank Badge */}
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-celestial-gold/10 border border-celestial-gold/30">
        <span className="text-sm font-bold text-celestial-gold">#{rank}</span>
      </div>

      {/* Horse Details */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl" aria-hidden="true">
            {entry.icon}
          </span>
          <h3 className="font-bold text-white/90">{entry.name}</h3>
          <span className="text-xs text-white/40 ml-1">
            {entry.breed} · {entry.discipline}
          </span>
        </div>
        <p className="text-xs text-white/50 mb-3">Retired at age {entry.retiredAge}</p>

        {/* Career Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 bg-white/5 rounded-lg">
            <p className="text-lg font-bold text-white/80">{entry.career.competitions}</p>
            <p className="text-xs text-white/40">Competitions</p>
          </div>
          <div className="text-center p-2 bg-white/5 rounded-lg">
            <p className="text-lg font-bold text-celestial-gold">{entry.career.wins}</p>
            <p className="text-xs text-white/40">Wins</p>
          </div>
          <div className="text-center p-2 bg-white/5 rounded-lg">
            <p className="text-lg font-bold text-white/80">
              {entry.career.earnings.toLocaleString()}
            </p>
            <p className="text-xs text-white/40">Coins Earned</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const MyStablePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<StableTab>('profile');
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const [isEditingStable, setIsEditingStable] = useState(false);
  const [draftStableName, setDraftStableName] = useState(user?.username ?? '');
  const { data: horses = [], isLoading } = useHorses();

  // Story 21S-4: real user-level career totals via /api/users/:userId/competition-stats
  // User.id is declared as `number` in useAuth but the server returns a UUID
  // string; stringify defensively so the hook receives the shape it expects.
  const { data: userCompetitionStats } = useUserCompetitionStats(user?.id ? String(user.id) : null);

  const retiredHorses = horses.filter((horse) => (horse.ageYears ?? horse.age ?? 0) >= 21);

  // Story 21S-4: parallel per-horse career history for the Hall of Fame
  // list. Uses useQueries so N retired horses don't serialize on first paint.
  const retiredHorseHistories = useQueries({
    queries: retiredHorses.map((horse) => ({
      queryKey: horseCompetitionHistoryQueryKeys.history(horse.id),
      queryFn: () => fetchHorseCompetitionHistory(horse.id),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    })),
  });

  const hallOfFameEntries: HallOfFameEntry[] = retiredHorses.map((horse, index) => {
    const history = retiredHorseHistories[index]?.data as CompetitionHistoryData | undefined;
    return {
      id: String(horse.id),
      name: horse.name,
      breed: getBreedName(horse.breed),
      retiredAge: horse.ageYears ?? horse.age ?? 21,
      discipline: 'All disciplines',
      career: {
        competitions: history?.statistics.totalCompetitions ?? 0,
        wins: history?.statistics.wins ?? 0,
        earnings: Number(horse.totalEarnings ?? horse.earnings ?? 0),
      },
      icon: '*',
    };
  });

  const activeRacers = horses.filter((horse) => (horse.ageYears ?? horse.age ?? 0) >= 3).length;
  const breedingPairs =
    Math.min(
      horses.filter((horse) => (horse.sex ?? horse.gender ?? '').toLowerCase() === 'stallion')
        .length,
      horses.filter((horse) => (horse.sex ?? horse.gender ?? '').toLowerCase() === 'mare').length
    ) || 0;
  const totalEarnings = horses.reduce(
    (sum, horse) => sum + Number(horse.totalEarnings ?? horse.earnings ?? 0),
    0
  );

  // Story 21S-4: competitionsEntered + firstPlaceFinishes now come from the
  // backend aggregation. Falls back to 0 only while the query is pending.
  const competitionsEntered = userCompetitionStats?.totalCompetitions ?? 0;
  const firstPlaceFinishes = userCompetitionStats?.totalWins ?? 0;

  const stable: StableProfile = {
    name: user?.username ? `${user.username}'s Stable` : 'My Stable',
    founded: 'active account',
    bio:
      horses.length > 0
        ? 'Live stable profile based on your current horses and account records.'
        : 'Your stable profile will grow as you add horses and enter competitions.',
    banner: 'EQ',
    stats: {
      totalHorses: horses.length,
      activeRacers,
      competitionsEntered,
      firstPlaceFinishes,
      totalEarnings,
      breedingPairs,
    },
  };

  const handleStartEditing = () => {
    setDraftStableName(user?.username ?? '');
    setIsEditingStable(true);
  };

  const handleSaveStableProfile = () => {
    const username = draftStableName.trim();
    if (username.length < 3) return;
    updateProfile.mutate(
      { username },
      {
        onSuccess: () => {
          setIsEditingStable(false);
        },
      }
    );
  };

  return (
    <div className="min-h-screen">
      <PageHero
        title="My Stable"
        subtitle="Your stable profile and legacy hall of fame"
        mood="golden"
        icon={<Star className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
          <Link to="/" className="hover:text-[var(--cream)] transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-[var(--cream)]">My Stable</span>
        </div>
      </PageHero>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Tab Navigation */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-8 w-fit"
          role="tablist"
          aria-label="My Stable sections"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'profile'}
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'profile'
                ? 'bg-white/10 text-white/90 shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
            data-testid="profile-tab"
          >
            <Star className="w-4 h-4" />
            Stable Profile
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'legacy'}
            onClick={() => setActiveTab('legacy')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'legacy'
                ? 'bg-white/10 text-white/90 shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
            data-testid="legacy-tab"
          >
            <Trophy className="w-4 h-4" />
            Hall of Fame
          </button>
        </div>

        {/* Tab Content */}
        <div role="tabpanel">
          {activeTab === 'profile' ? (
            <StableProfileTab
              stable={stable}
              isLoading={isLoading}
              isEditing={isEditingStable}
              draftStableName={draftStableName}
              onDraftStableNameChange={setDraftStableName}
              onStartEditing={handleStartEditing}
              onCancelEditing={() => setIsEditingStable(false)}
              onSave={handleSaveStableProfile}
              isSaving={updateProfile.isPending}
            />
          ) : (
            <LegacyHallTab entries={hallOfFameEntries} />
          )}
        </div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl glass-panel text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2">About My Stable</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Your stable profile is visible to other players on the leaderboards</li>
            <li>Horses retired at level 8 or higher are inducted into the Hall of Fame</li>
            <li>Hall of Fame horses can be shown in breeding lineages for prestige</li>
            <li>Total earnings and win count contribute to your stable ranking</li>
            <li>Edit your stable display name from this profile panel</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MyStablePage;
