/**
 * MyStablePage — Stable Profile & Legacy Hall of Fame (Epic 12 — Story 12-3)
 *
 * Displays the player's stable profile (name, banner, bio, stats) and a
 * Legacy Hall of Fame showcasing retired horses.
 * Distinct from ProfilePage (/profile) which handles account/auth settings.
 * Backend routes deferred; UI is mock-ready.
 *
 * Uses Celestial Night theme (consistent with other standalone pages).
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Trophy, Heart, Award, Flame, ChevronRight } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';

type StableTab = 'profile' | 'legacy';

// Mock stable data — replaced by live API in Story 12-5 wire-up
const MOCK_STABLE = {
  name: 'Celestial Stables',
  founded: '2024',
  bio: 'A dedicated breeding and training stable focused on producing championship-calibre horses with exceptional genetics.',
  banner: '🌙',
  stats: {
    totalHorses: 12,
    activeRacers: 5,
    competitionsEntered: 47,
    firstPlaceFinishes: 8,
    totalEarnings: 24_500,
    breedingPairs: 3,
  },
};

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

// Mock Hall of Fame — replaced by live API in Story 12-5 wire-up
const MOCK_HALL_OF_FAME: HallOfFameEntry[] = [
  {
    id: 'hof-001',
    name: 'Midnight Eclipse',
    breed: 'Andalusian',
    retiredAge: 18,
    discipline: 'Dressage',
    career: { competitions: 32, wins: 14, earnings: 8_400 },
    icon: '🌙',
  },
  {
    id: 'hof-002',
    name: 'Golden Arrow',
    breed: 'Thoroughbred',
    retiredAge: 16,
    discipline: 'Racing',
    career: { competitions: 28, wins: 11, earnings: 12_200 },
    icon: '⭐',
  },
  {
    id: 'hof-003',
    name: 'Storm Dancer',
    breed: 'Lipizzan',
    retiredAge: 20,
    discipline: 'Show Jumping',
    career: { competitions: 41, wins: 9, earnings: 6_700 },
    icon: '⚡',
  },
];

const StableProfileTab: React.FC = () => (
  <div className="space-y-6" data-testid="stable-profile-tab">
    {/* Stable Banner */}
    <div className="flex items-center gap-5 p-6 bg-white/5 border border-white/10 rounded-xl">
      <div className="text-5xl select-none" aria-hidden="true">
        {MOCK_STABLE.banner}
      </div>
      <div className="flex-1">
        <h2 className="text-2xl font-bold text-white/90">{MOCK_STABLE.name}</h2>
        <p className="text-sm text-white/50 mt-1">Founded {MOCK_STABLE.founded}</p>
        <p className="text-sm text-white/60 mt-2 max-w-lg">{MOCK_STABLE.bio}</p>
      </div>
      <button
        type="button"
        disabled
        className="px-4 py-2 text-sm font-medium rounded-lg bg-white/5 border border-white/10 text-white/30 cursor-not-allowed"
        title="Edit stable profile — coming soon"
      >
        Edit Profile
      </button>
    </div>

    {/* Stable Statistics */}
    <div>
      <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
        Stable Statistics
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="stable-stats">
        <StatBlock
          label="Total Horses"
          value={MOCK_STABLE.stats.totalHorses}
          icon={<Heart className="w-4 h-4 text-rose-400" />}
        />
        <StatBlock
          label="Active Racers"
          value={MOCK_STABLE.stats.activeRacers}
          icon={<Flame className="w-4 h-4 text-orange-400" />}
        />
        <StatBlock
          label="Competitions"
          value={MOCK_STABLE.stats.competitionsEntered}
          icon={<Trophy className="w-4 h-4 text-celestial-gold" />}
        />
        <StatBlock
          label="First Place Wins"
          value={MOCK_STABLE.stats.firstPlaceFinishes}
          icon={<Award className="w-4 h-4 text-celestial-gold" />}
        />
        <StatBlock
          label="Total Earnings"
          value={`${MOCK_STABLE.stats.totalEarnings.toLocaleString()} coins`}
          icon={<Star className="w-4 h-4 text-violet-400" />}
        />
        <StatBlock
          label="Breeding Pairs"
          value={MOCK_STABLE.stats.breedingPairs}
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

const LegacyHallTab: React.FC = () => (
  <div className="space-y-4" data-testid="legacy-hall-tab">
    <p className="text-sm text-white/50">
      Retired horses live on in the Hall of Fame, their careers immortalised for future generations.
    </p>

    {MOCK_HALL_OF_FAME.length === 0 ? (
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
        {MOCK_HALL_OF_FAME.map((entry, index) => (
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

  return (
    <div className="min-h-screen">
      <PageHero
        title="My Stable"
        subtitle="Your stable profile and legacy hall of fame"
        mood="golden"
        icon={<Star className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
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
          {activeTab === 'profile' ? <StableProfileTab /> : <LegacyHallTab />}
        </div>

        {/* Info Panel */}
        <div className="mt-10 p-5 rounded-xl glass-panel text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-[var(--cream)] mb-2">About My Stable</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Your stable profile is visible to other players on the leaderboards</li>
            <li>Horses retired at level 8 or higher are inducted into the Hall of Fame</li>
            <li>Hall of Fame horses can be shown in breeding lineages for prestige</li>
            <li>Total earnings and win count contribute to your stable ranking</li>
            <li>Customise your stable name and banner in the profile settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MyStablePage;
