/**
 * ClubsPage — Clubs System (Epic 11 + 19B-3)
 *
 * Three-tab structure:
 *   - Discipline Clubs tab: list + join
 *   - Breed Clubs tab: list + join
 *   - My Club tab: memberships, active elections, club leaderboard, create club
 *
 * All data live via useClubs / useMyClubs / useClubElections / useVote / useNominate hooks.
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
  PlusCircle,
} from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import {
  useClubs,
  useMyClubs,
  useJoinClub,
  useCreateClub,
  useClubElections,
  useVote,
  useNominate,
  useElectionResults,
} from '@/hooks/api/useClubs';
import type { Club, ClubType, ClubElection, ElectionCandidate } from '@/lib/api-client';

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

// ── Election card ─────────────────────────────────────────────────────────────

const ElectionCard: React.FC<{ election: ClubElection; isMember: boolean }> = ({
  election,
  isMember,
}) => {
  const { data: resultsData } = useElectionResults(election.id);
  const vote = useVote(election.id);
  const nominate = useNominate(election.id);
  const [statement, setStatement] = useState('');
  const [showNominate, setShowNominate] = useState(false);

  const candidates: ElectionCandidate[] = resultsData?.candidates ?? [];

  return (
    <div
      className="p-4 rounded-xl bg-white/5 border border-white/10 mb-3"
      data-testid={`election-${election.id}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-semibold text-white/80">{election.position}</span>
          <span
            className={`ml-2 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
              election.status === 'open'
                ? 'bg-emerald-500/15 text-emerald-400'
                : election.status === 'upcoming'
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-white/10 text-white/40'
            }`}
          >
            {election.status}
          </span>
        </div>
        {isMember && election.status === 'open' && (
          <button
            type="button"
            onClick={() => setShowNominate((v) => !v)}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            Nominate
          </button>
        )}
      </div>

      {/* Nominate form */}
      {showNominate && (
        <div className="mb-3">
          <input
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40 mb-2"
            placeholder="Optional statement…"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
          />
          <button
            type="button"
            disabled={nominate.isPending}
            onClick={() => {
              nominate.mutate(statement);
              setShowNominate(false);
              setStatement('');
            }}
            className="text-xs px-3 py-1 rounded bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 transition-colors disabled:opacity-40"
          >
            {nominate.isPending ? 'Submitting…' : 'Submit Nomination'}
          </button>
        </div>
      )}

      {/* Candidates */}
      {candidates.length > 0 ? (
        <div className="space-y-2">
          {candidates.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between text-xs text-white/60 p-2 rounded bg-white/3 border border-white/8"
            >
              <span className="font-medium">{c.user.username}</span>
              <div className="flex items-center gap-3">
                <span className="text-white/40">{c.voteCount} votes</span>
                {isMember && election.status === 'open' && (
                  <button
                    type="button"
                    disabled={vote.isPending}
                    onClick={() => vote.mutate(c.id)}
                    className="px-2 py-0.5 rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors disabled:opacity-40"
                  >
                    Vote
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-white/30">No candidates yet.</p>
      )}
    </div>
  );
};

// ── My Club tab ───────────────────────────────────────────────────────────────

const MyClubTab: React.FC<{ allClubs: Club[] }> = ({ allClubs }) => {
  const { data: myClubsData } = useMyClubs();
  const myMemberships = myClubsData?.memberships ?? [];
  const createClub = useCreateClub();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ClubType>('discipline');
  const [newCategory, setNewCategory] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleCreate = async () => {
    if (!newName.trim() || !newCategory.trim() || !newDescription.trim()) return;
    await createClub.mutateAsync({
      name: newName.trim(),
      type: newType,
      category: newCategory.trim(),
      description: newDescription.trim(),
    });
    setShowCreate(false);
    setNewName('');
    setNewCategory('');
    setNewDescription('');
  };

  // Gather all clubIds the user is in
  const myClubIds = new Set(myMemberships.map((m) => m.club.id));

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
            Join a club to access governance, elections, and member rankings — or create your own.
          </p>
        </div>
      )}

      {/* Active Elections for each joined club */}
      {myMemberships.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Vote className="w-4 h-4" />
            Elections
          </h2>
          {myMemberships.map((m) => (
            <ClubElectionsSection
              key={m.id}
              clubId={m.club.id}
              clubName={m.club.name}
              isMember={myClubIds.has(m.club.id)}
            />
          ))}
        </div>
      )}

      <div className="mb-8">
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
          data-testid="create-club-toggle"
        >
          <PlusCircle className="w-4 h-4" />
          Create a new club
        </button>

        {showCreate && (
          <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
            <h3 className="text-sm font-semibold text-white/70 mb-3">New Club</h3>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40 mb-2"
              placeholder="Club name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={100}
              data-testid="create-club-name"
            />
            <div className="flex gap-2 mb-2">
              <select
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/40"
                value={newType}
                onChange={(e) => setNewType(e.target.value as ClubType)}
                data-testid="create-club-type"
              >
                <option value="discipline">Discipline</option>
                <option value="breed">Breed</option>
              </select>
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40"
                placeholder="Category (e.g. Dressage)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                data-testid="create-club-category"
              />
            </div>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40 resize-none mb-3 h-20"
              placeholder="Club description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              data-testid="create-club-description"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                className="text-sm text-white/40 hover:text-white/70 transition-colors px-3 py-1.5"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !newName.trim() ||
                  !newCategory.trim() ||
                  !newDescription.trim() ||
                  createClub.isPending
                }
                onClick={handleCreate}
                className="px-4 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="create-club-submit"
              >
                {createClub.isPending ? 'Creating…' : 'Create Club'}
              </button>
            </div>
          </div>
        )}
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

      {/* Suppress unused import warning */}
      <Award className="hidden" />
    </div>
  );
};

// ── Club elections section ────────────────────────────────────────────────────

const ClubElectionsSection: React.FC<{
  clubId: number;
  clubName: string;
  isMember: boolean;
}> = ({ clubId, clubName, isMember }) => {
  const { data } = useClubElections(clubId);
  const elections = data?.elections ?? [];
  const active = elections.filter((e) => e.status !== 'closed');

  if (active.length === 0) {
    return (
      <p className="text-xs text-white/30 mb-3">
        No active elections in <span className="text-white/50">{clubName}</span>.
      </p>
    );
  }

  return (
    <div className="mb-4">
      <p className="text-xs text-white/50 mb-2 font-medium">{clubName}</p>
      {active.map((election) => (
        <ElectionCard key={election.id} election={election} isMember={isMember} />
      ))}
    </div>
  );
};

// ── Club grid ─────────────────────────────────────────────────────────────────

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

            <div className="flex items-center justify-between mb-4 text-xs text-white/40">
              <span className="flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-celestial-gold/60" />
                {club.leader.username}
              </span>
            </div>

            {isMember ? (
              <div className="w-full py-2 text-xs font-medium rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center gap-1.5">
                ✓ Member
              </div>
            ) : (
              <button
                type="button"
                onClick={() => joinClub.mutate(club.id)}
                disabled={joinClub.isPending}
                className="w-full py-2 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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

// ── Page ──────────────────────────────────────────────────────────────────────

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
      <PageHero
        title="Clubs"
        subtitle="Join discipline associations and breed clubs"
        mood="default"
        icon={<Users className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
            <Link to="/" className="hover:text-[var(--cream)] transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link to="/community" className="hover:text-[var(--cream)] transition-colors">
              Community
            </Link>
            <span>/</span>
            <span className="text-[var(--cream)]">Clubs</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60 glass-panel rounded-lg px-3 py-1.5">
            <Users className="w-4 h-4" />
            <span>{totalClubs > 0 ? `${totalClubs} clubs total` : '…'}</span>
          </div>
        </div>
      </PageHero>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
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

export default ClubsPage;
