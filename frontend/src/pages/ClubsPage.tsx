/**
 * ClubsPage — Clubs System (Epic 11 — Stories 11-3 + 11-4 + 11-5)
 *
 * Three-tab structure:
 *   Story 11-3: Discipline Clubs tab — Dressage, Show Jumping, Cross Country, Western, Endurance
 *   Story 11-4: Breed Clubs tab     — Thoroughbred, Arabian, Warmblood, Andalusian, Quarter Horse,
 *                                      Friesian, Mustang, Paint
 *   Story 11-5: My Club tab         — Governance, elections, leaderboard (P2 / coming soon state)
 *
 * "Join Club" buttons are disabled (pending auth wire-up).
 * Mock data uses MOCK_DISCIPLINE_CLUBS, MOCK_BREED_CLUBS (labelled for replacement).
 *
 * Uses Celestial Night theme.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Shield,
  Trophy,
  Star,
  Crown,
  Vote,
  ChevronRight,
  Award,
  BarChart3,
} from 'lucide-react';
import MainNavigation from '@/components/MainNavigation';

type ClubsTab = 'discipline' | 'breed' | 'my-club';

interface ClubEntry {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  rank?: number;
  president?: string;
  founded: string;
  openToJoin: boolean;
  featured?: boolean;
  topHorse?: string;
  icon: string;
}

// Mock data — replace with /api/clubs/discipline and /api/clubs/breed endpoints
const MOCK_DISCIPLINE_CLUBS: ClubEntry[] = [
  {
    id: 'club-dressage',
    name: 'Dressage Society',
    description:
      'The premier club for dressage enthusiasts. Monthly fixtures, judging circles, and piaffe clinics.',
    memberCount: 312,
    rank: 1,
    president: 'SilverSpur',
    founded: '2024-03',
    openToJoin: true,
    featured: true,
    topHorse: 'Grand Prix Marquessa',
    icon: '🎭',
  },
  {
    id: 'club-showjumping',
    name: 'Show Jumping Association',
    description:
      'Clearance is everything. Weekly virtual clinics, obstacle rankings, and jump-off competitions.',
    memberCount: 287,
    rank: 2,
    president: 'IronHoof',
    founded: '2024-01',
    openToJoin: true,
    topHorse: 'Voltage',
    icon: '🚧',
  },
  {
    id: 'club-xc',
    name: 'Cross Country Federation',
    description: 'Bold horses and bolder riders. Endurance-focused, cross-discipline welcome.',
    memberCount: 198,
    rank: 3,
    president: 'WildTrailRider',
    founded: '2024-05',
    openToJoin: true,
    topHorse: 'Mudslide',
    icon: '🌲',
  },
  {
    id: 'club-western',
    name: 'Western Riding League',
    description:
      'Barrel racing, reining, cutting — all things western. Tight-knit community with weekly events.',
    memberCount: 154,
    rank: 4,
    president: 'DesertDust',
    founded: '2024-06',
    openToJoin: true,
    topHorse: 'Turbo Rodeo',
    icon: '🤠',
  },
  {
    id: 'club-endurance',
    name: 'Endurance Riders Guild',
    description: 'Long-distance stamina racing for horses and players who go the distance.',
    memberCount: 91,
    rank: 5,
    president: 'MarathonMare',
    founded: '2024-09',
    openToJoin: true,
    topHorse: 'Titanfall',
    icon: '⚡',
  },
];

const MOCK_BREED_CLUBS: ClubEntry[] = [
  {
    id: 'club-tb',
    name: 'Thoroughbred Breed Club',
    description:
      'Racing royalty. The oldest and most prestigious breed club on Equoria. Strict breeding standards.',
    memberCount: 425,
    rank: 1,
    president: 'HighlandStud',
    founded: '2023-12',
    openToJoin: true,
    featured: true,
    topHorse: 'Daybreak Champion',
    icon: '🏇',
  },
  {
    id: 'club-arabian',
    name: 'Arabian Breed Club',
    description:
      'Celebrate the desert jewel. Beauty contests, endurance rankings, and pure bloodline registry.',
    memberCount: 318,
    rank: 2,
    president: 'ArabiaNights',
    founded: '2024-01',
    openToJoin: true,
    topHorse: 'Desert Rose',
    icon: '🌙',
  },
  {
    id: 'club-wb',
    name: 'Warmblood Breeders Circle',
    description:
      'The sport horse standard. Dressage and jumping specialists, strict performance evaluation.',
    memberCount: 241,
    rank: 3,
    president: 'ElegantGaits',
    founded: '2024-02',
    openToJoin: true,
    topHorse: 'Valentino Blue',
    icon: '🔵',
  },
  {
    id: 'club-andalusian',
    name: 'Iberian Breeds Society',
    description:
      'Andalusian and Lusitano enthusiasts. Baroque movement specialists and classical dressage.',
    memberCount: 127,
    rank: 4,
    president: 'ToledoRider',
    founded: '2024-04',
    openToJoin: true,
    topHorse: 'El Magnifico',
    icon: '🌹',
  },
  {
    id: 'club-qh',
    name: 'Quarter Horse Nation',
    description:
      'Fast, versatile, and all-American. Western sports specialists with barrel and rein rankings.',
    memberCount: 186,
    rank: 5,
    president: 'PrairieRunner',
    founded: '2024-03',
    openToJoin: true,
    topHorse: 'Quicksilver',
    icon: '⭐',
  },
  {
    id: 'club-friesian',
    name: 'Friesian Fanciers Guild',
    description:
      'The black pearls of Equoria. Baroque power and flowing manes — beauty and strength united.',
    memberCount: 98,
    rank: 6,
    president: 'NightMareRider',
    founded: '2024-07',
    openToJoin: true,
    topHorse: 'Phantom',
    icon: '🖤',
  },
  {
    id: 'club-mustang',
    name: 'Mustang Preservation Society',
    description:
      'Wild hearts and resilient spirits. Dedicated to mustang welfare, training, and competition.',
    memberCount: 73,
    rank: 7,
    president: 'FreeRangeRider',
    founded: '2024-08',
    openToJoin: true,
    topHorse: 'Wild Spirit',
    icon: '🌿',
  },
  {
    id: 'club-paint',
    name: 'Paint Horse Alliance',
    description: 'Colour, pattern, and Western heritage. Show, barrel, and pleasure specialists.',
    memberCount: 109,
    rank: 8,
    president: 'SunsetPaint',
    founded: '2024-05',
    openToJoin: true,
    topHorse: 'Painted Lady',
    icon: '🎨',
  },
];

const MOCK_ELECTIONS = [
  {
    id: 'elect-1',
    club: 'Arabian Breed Club',
    candidates: [
      { name: 'ArabiaNights', votes: 42 },
      { name: 'SandstormRider', votes: 31 },
      { name: 'DesertPearl', votes: 18 },
    ],
    closesIn: '3 days',
    open: true,
  },
  {
    id: 'elect-2',
    club: 'Dressage Society',
    candidates: [
      { name: 'SilverSpur', votes: 78 },
      { name: 'GrandPrixMaster', votes: 52 },
    ],
    closesIn: '12 days',
    open: true,
  },
];

const tabsConfig: { id: ClubsTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'discipline',
    label: 'Discipline Clubs',
    icon: <Shield className="w-4 h-4" />,
  },
  {
    id: 'breed',
    label: 'Breed Clubs',
    icon: <Star className="w-4 h-4" />,
  },
  {
    id: 'my-club',
    label: 'My Club',
    icon: <Crown className="w-4 h-4" />,
  },
];

const ClubsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ClubsTab>('discipline');

  return (
    <div className="min-h-screen">
      <MainNavigation />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link to="/" className="hover:text-white/70 transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link to="/community" className="hover:text-white/70 transition-colors">
            Community
          </Link>
          <span>/</span>
          <span className="text-white/70">Clubs</span>
        </div>

        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-celestial-gold/10 border border-celestial-gold/30">
              <Users className="w-6 h-6 text-celestial-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white/90">👥 Clubs</h1>
              <p className="text-sm text-white/50 mt-0.5">
                Join discipline associations and breed clubs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/40 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
            <Users className="w-4 h-4" />
            <span>13 clubs total</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl mb-6 w-fit"
          role="tablist"
          aria-label="Club categories"
          data-testid="club-tabs"
        >
          {tabsConfig.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white/90 shadow-sm'
                  : 'text-white/40 hover:text-white/70'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div role="tabpanel">
          {activeTab === 'discipline' && (
            <ClubGrid clubs={MOCK_DISCIPLINE_CLUBS} accentColor="violet" testPrefix="discipline" />
          )}
          {activeTab === 'breed' && (
            <ClubGrid clubs={MOCK_BREED_CLUBS} accentColor="celestial-gold" testPrefix="breed" />
          )}
          {activeTab === 'my-club' && <MyClubTab />}
        </div>
      </div>
    </div>
  );
};

const ClubGrid: React.FC<{
  clubs: ClubEntry[];
  accentColor: string;
  testPrefix: string;
}> = ({ clubs, testPrefix }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid={`${testPrefix}-clubs-grid`}>
    {clubs.map((club) => (
      <div
        key={club.id}
        className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-all"
        data-testid={`club-card-${club.id}`}
      >
        {/* Club Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{club.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white/90 text-sm">{club.name}</h3>
                {club.featured && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-celestial-gold/20 text-celestial-gold">
                    Featured
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {club.rank && <span className="text-[10px] text-white/40">Rank #{club.rank}</span>}
                <span className="text-[10px] text-white/30">·</span>
                <span className="text-[10px] text-white/40">Founded {club.founded}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-white/70">{club.memberCount}</div>
            <div className="text-[10px] text-white/40">members</div>
          </div>
        </div>

        <p className="text-xs text-white/50 mb-3 leading-relaxed">{club.description}</p>

        {/* Club Meta */}
        <div className="flex items-center justify-between mb-4 text-xs text-white/40">
          <span className="flex items-center gap-1">
            <Crown className="w-3.5 h-3.5 text-celestial-gold/60" />
            {club.president}
          </span>
          {club.topHorse && (
            <span className="flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-celestial-gold/60" />
              {club.topHorse}
            </span>
          )}
        </div>

        {/* Join Button */}
        <button
          type="button"
          disabled
          className="w-full py-2 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-white/30 cursor-not-allowed flex items-center justify-center gap-1.5"
          title="Sign in to join clubs"
          data-testid={`join-button-${club.id}`}
        >
          <ChevronRight className="w-3.5 h-3.5" />
          Join Club
        </button>
      </div>
    ))}
  </div>
);

const MyClubTab: React.FC = () => (
  <div data-testid="my-club-tab">
    {/* Governance — Coming Soon */}
    <div className="mb-8 p-6 rounded-xl bg-white/3 border border-white/8 text-center">
      <Crown className="w-10 h-10 text-celestial-gold/40 mx-auto mb-3" />
      <h2 className="text-base font-bold text-white/70 mb-1">Club Governance</h2>
      <p className="text-sm text-white/40 mb-4">
        Join a club first to access governance features, elections, and member rankings.
      </p>
      <button
        type="button"
        disabled
        className="px-6 py-2 text-sm font-medium rounded-xl bg-celestial-gold/10 border border-celestial-gold/20 text-celestial-gold/50 cursor-not-allowed"
      >
        Join a Club First
      </button>
    </div>

    {/* Active Elections (community-wide, read-only) */}
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4 flex items-center gap-2">
        <Vote className="w-4 h-4" />
        Active Elections
      </h2>
      <div className="space-y-4">
        {MOCK_ELECTIONS.map((election) => (
          <div
            key={election.id}
            className="bg-white/5 border border-white/10 rounded-xl p-5"
            data-testid={`election-${election.id}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-white/90 text-sm">{election.club}</h3>
                <p className="text-xs text-white/40 mt-0.5">
                  Presidential election · Closes in {election.closesIn}
                </p>
              </div>
              <span className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Open
              </span>
            </div>

            {/* Candidates */}
            <div className="space-y-2">
              {election.candidates.map((candidate, idx) => {
                const totalVotes = election.candidates.reduce((s, c) => s + c.votes, 0);
                const pct = Math.round((candidate.votes / totalVotes) * 100);
                return (
                  <div key={candidate.name}>
                    <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                      <span className="flex items-center gap-1.5">
                        {idx === 0 && <Award className="w-3.5 h-3.5 text-celestial-gold" />}
                        {candidate.name}
                      </span>
                      <span className="text-white/50">
                        {candidate.votes} votes ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${idx === 0 ? 'bg-celestial-gold/60' : 'bg-white/20'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              disabled
              className="mt-4 w-full py-2 text-xs font-medium rounded-lg bg-violet-600/10 border border-violet-500/20 text-violet-400/60 cursor-not-allowed"
              title="Join this club to vote"
            >
              <Vote className="w-3.5 h-3.5 inline mr-1" />
              Vote (join club to participate)
            </button>
          </div>
        ))}
      </div>
    </div>

    {/* Global Leaderboard */}
    <div>
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4 flex items-center gap-2">
        <BarChart3 className="w-4 h-4" />
        Club Leaderboard
      </h2>
      <div className="space-y-2">
        {[...MOCK_DISCIPLINE_CLUBS, ...MOCK_BREED_CLUBS]
          .sort((a, b) => b.memberCount - a.memberCount)
          .slice(0, 5)
          .map((club, idx) => (
            <div
              key={club.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
              data-testid={`leaderboard-row-${club.id}`}
            >
              <span className="w-6 text-center text-sm font-bold text-white/40">{idx + 1}</span>
              <span className="text-lg">{club.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-white/80">{club.name}</div>
                <div className="text-xs text-white/40">
                  {club.president} · {club.memberCount} members
                </div>
              </div>
              {idx === 0 && <Trophy className="w-4 h-4 text-celestial-gold" />}
            </div>
          ))}
      </div>
    </div>
  </div>
);

export default ClubsPage;
