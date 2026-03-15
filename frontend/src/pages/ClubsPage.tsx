/**
 * ClubsPage — Clubs System (Epic 11 — Stories 11-3 + 11-4 + 11-5)
 *
 * Wired to live API in Epic 19B-3:
 *   - useClubs('discipline') / useClubs('breed') replace MOCK_DISCIPLINE_CLUBS / MOCK_BREED_CLUBS
 *   - useMyClubs() shows membership state
 *   - useJoinClub() mutation enables "Join Club" buttons
 *
 * Three-tab structure:
 *   Story 11-3: Discipline Clubs tab
 *   Story 11-4: Breed Clubs tab
 *   Story 11-5: My Club tab — Governance, elections, leaderboard
 *
 * Uses Celestial Night theme.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Shield,
  Star,
  Crown,
  Vote,
  ChevronRight,
  Award,
  BarChart3,
  Trophy,
} from 'lucide-react';
import { useClubs, useMyClubs, useJoinClub } from '@/hooks/api/useClubs';
import type { Club } from '@/lib/api-client';

type ClubsTab = 'discipline' | 'breed' | 'my-club';

const tabsConfig: { id: ClubsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'discipline', label: 'Discipline Clubs', icon: <Shield className="w-4 h-4" /> },
  { id: 'breed', label: 'Breed Clubs', icon: <Star className="w-4 h-4" /> },
  { id: 'my-club', label: 'My Club', icon: <Crown className="w-4 h-4" /> },
];

const DISCIPLINE_ICONS: Record<string, string> = {
  Dressage: '🎭',
  'Show Jumping': '🚧',
  'Cross Country': '🌲',
  Western: '🤠',
  Endurance: '⚡',
};

const BREED_ICONS: Record<string, string> = {
  Thoroughbred: '🏇',
  Arabian: '🌙',
  Warmblood: '🔵',
  Andalusian: '🌹',
  'Quarter Horse': '⭐',
  Friesian: '🖤',
  Mustang: '🌿',
  Paint: '🎨',
};

function clubIcon(club: Club): string {
  if (club.type === 'discipline') return DISCIPLINE_ICONS[club.category] ?? '🏇';
  return BREED_ICONS[club.category] ?? '🐴';
}

const ClubsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ClubsTab>('discipline');

  const { data: disciplineData, isLoading: discLoading } = useClubs('discipline');
  const { data: breedData, isLoading: breedLoading } = useClubs('breed');
  const { data: allData } = useClubs();

  const disciplineClubs = disciplineData?.clubs ?? [];
  const breedClubs = breedData?.clubs ?? [];
  const allClubs = allData?.clubs ?? [];

  const totalClubs = allClubs.length;

  return (
    <div className="min-h-screen">
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
            <span>{totalClubs > 0 ? `${totalClubs} clubs total` : '…'}</span>
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
            <ClubGrid clubs={disciplineClubs} isLoading={discLoading} testPrefix="discipline" />
          )}
          {activeTab === 'breed' && (
            <ClubGrid clubs={breedClubs} isLoading={breedLoading} testPrefix="breed" />
          )}
          {activeTab === 'my-club' && <MyClubTab allClubs={allClubs} />}
        </div>
      </div>
    </div>
  );
};

const ClubGrid: React.FC<{
  clubs: Club[];
  isLoading: boolean;
  testPrefix: string;
}> = ({ clubs, isLoading, testPrefix }) => {
  const joinClub = useJoinClub();
  const { data: myClubsData } = useMyClubs();
  const myClubIds = new Set(myClubsData?.memberships.map((m) => m.club.id) ?? []);

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        data-testid={`${testPrefix}-clubs-grid`}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white/5 border border-white/10 rounded-xl p-5 animate-pulse h-40"
          />
        ))}
      </div>
    );
  }

  if (clubs.length === 0) {
    return (
      <div className="text-center py-12 text-white/40" data-testid={`${testPrefix}-clubs-grid`}>
        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No clubs yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid={`${testPrefix}-clubs-grid`}>
      {clubs.map((club) => {
        const isMember = myClubIds.has(club.id);
        return (
          <div
            key={club.id}
            className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-all"
            data-testid={`club-card-${club.id}`}
          >
            {/* Club Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{clubIcon(club)}</span>
                <div>
                  <h3 className="font-bold text-white/90 text-sm">{club.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-white/40">{club.category}</span>
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
                {club.leader.username}
              </span>
            </div>

            {/* Join / Already Member Button */}
            {isMember ? (
              <div className="w-full py-2 text-xs font-medium rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center gap-1.5">
                ✓ Member
              </div>
            ) : (
              <button
                type="button"
                onClick={() => joinClub.mutate(club.id)}
                disabled={joinClub.isPending}
                className="w-full py-2 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid={`join-button-${club.id}`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
                {joinClub.isPending ? 'Joining…' : 'Join Club'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

const MyClubTab: React.FC<{ allClubs: Club[] }> = ({ allClubs }) => {
  const { data: myClubsData } = useMyClubs();
  const myMemberships = myClubsData?.memberships ?? [];

  return (
    <div data-testid="my-club-tab">
      {/* My Memberships */}
      {myMemberships.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Crown className="w-4 h-4" />
            My Clubs
          </h2>
          <div className="space-y-3">
            {myMemberships.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <span className="text-xl">{clubIcon(m.club)}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white/80">{m.club.name}</div>
                  <div className="text-xs text-white/40 capitalize">{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8 p-6 rounded-xl bg-white/3 border border-white/8 text-center">
          <Crown className="w-10 h-10 text-celestial-gold/40 mx-auto mb-3" />
          <h2 className="text-base font-bold text-white/70 mb-1">Club Governance</h2>
          <p className="text-sm text-white/40 mb-4">
            Join a club first to access governance features, elections, and member rankings.
          </p>
        </div>
      )}

      {/* Active Elections placeholder */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Vote className="w-4 h-4" />
          Elections
        </h2>
        <div className="p-4 rounded-xl bg-white/3 border border-white/8 text-center text-sm text-white/40">
          Election results available once you join a club.
        </div>
      </div>

      {/* Global Leaderboard */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Club Leaderboard
        </h2>
        {allClubs.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">No clubs yet</div>
        ) : (
          <div className="space-y-2">
            {[...allClubs]
              .sort((a, b) => b.memberCount - a.memberCount)
              .slice(0, 5)
              .map((club, idx) => (
                <div
                  key={club.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                  data-testid={`leaderboard-row-${club.id}`}
                >
                  <span className="w-6 text-center text-sm font-bold text-white/40">{idx + 1}</span>
                  <span className="text-lg">{clubIcon(club)}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white/80">{club.name}</div>
                    <div className="text-xs text-white/40">
                      {club.leader.username} · {club.memberCount} members
                    </div>
                  </div>
                  {idx === 0 && <Trophy className="w-4 h-4 text-celestial-gold" />}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Award badge stub to avoid unused import */}
      <Award className="hidden" />
    </div>
  );
};

export default ClubsPage;
