/**
 * MyStablePage — Stable Profile & Legacy Hall of Fame (Epic 12 — Story 12-3)
 *
 * Displays the player's stable profile (name, banner, bio, stats) and a
 * Legacy Hall of Fame showcasing retired horses.
 * Distinct from ProfilePage (/profile) which handles account/auth settings.
 * Uses live horse/profile data and honest empty states.
 *
 * Design-system migration (Equoria-o5hub.20): renamed "My Stable" →
 * "Stable Profile" per D-27 (DECISIONS.md §10); PageHeader + PageContainer
 * replace PageHero (operational page, no location artwork); Surface
 * semantics, role tokens, canonical Input, and Currency replace the local
 * recipes.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Trophy, Heart, Award, Flame, ChevronRight } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Surface } from '@/components/ui/Surface';
import Currency from '@/components/ui/Currency';
import { Input } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { CanonicalTabs } from '@/components/ui/game';
import { GoldBorderFrame } from '@/components/ui/GoldBorderFrame';
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
  isCareerStatsError: boolean;
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
  isCareerStatsError,
  isEditing,
  draftStableName,
  onDraftStableNameChange,
  onStartEditing,
  onCancelEditing,
  onSave,
  isSaving,
}) => (
  <div className="space-y-6" data-testid="stable-profile-tab">
    {/* Stable Banner — Surface panel + role tokens (white/NN opacity removed, D-12) */}
    <Surface variant="panel" className="flex items-center gap-5">
      <div className="text-5xl select-none" aria-hidden="true">
        {stable.banner}
      </div>
      <div className="flex-1">
        <h2 className="type-section-heading">{stable.name}</h2>
        <p className="text-sm text-role-muted mt-1">Founded {stable.founded}</p>
        <p className="text-sm text-role-secondary mt-2 max-w-lg">
          {isLoading ? 'Loading stable records...' : stable.bio}
        </p>
      </div>
      {isEditing ? (
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Canonical Input (D-13) — preserves the aria-label + controlled value */}
          <Input
            type="text"
            value={draftStableName}
            onChange={(event) => onDraftStableNameChange(event.target.value)}
            aria-label="Stable profile name"
          />
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving || draftStableName.trim().length < 3}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancelEditing} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={onStartEditing}>
          Edit Profile
        </Button>
      )}
    </Surface>

    {/* Stable Statistics */}
    <div>
      <h3 className="type-label mb-4">Stable Statistics</h3>
      {isCareerStatsError && (
        <p className="text-sm text-[var(--status-warning)] mb-3" data-testid="career-stats-error">
          Stats unavailable — could not load competition data.
        </p>
      )}
      {/* Decorative stat icons use the accent role uniformly (raw palette
          rose/orange/violet/pink removed per D-11/D-12). */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="stable-stats">
        <StatBlock
          label="Total Horses"
          value={stable.stats.totalHorses}
          icon={<Heart className="w-4 h-4 text-[var(--gold-light)]" />}
        />
        <StatBlock
          label="Active Racers"
          value={stable.stats.activeRacers}
          icon={<Flame className="w-4 h-4 text-[var(--gold-light)]" />}
        />
        <StatBlock
          label="Competitions"
          value={stable.stats.competitionsEntered}
          icon={<Trophy className="w-4 h-4 text-[var(--gold-light)]" />}
        />
        <StatBlock
          label="First Place Wins"
          value={stable.stats.firstPlaceFinishes}
          icon={<Award className="w-4 h-4 text-[var(--gold-light)]" />}
        />
        <StatBlock
          label="Total Earnings"
          value={<Currency amount={stable.stats.totalEarnings} />}
          icon={<Star className="w-4 h-4 text-[var(--gold-light)]" />}
        />
        <StatBlock
          label="Breeding Pairs"
          value={stable.stats.breedingPairs}
          icon={<Heart className="w-4 h-4 text-[var(--gold-light)]" />}
        />
      </div>
    </div>

    {/* Quick Link to Stable */}
    <Surface variant="panel" className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-role-primary">View Active Horses</p>
        <p className="text-xs text-role-muted mt-0.5">See all horses currently in your stable</p>
      </div>
      {/* Secondary tier — the gold primary on this surface is Edit Profile (D-08) */}
      <Button asChild variant="secondary">
        <Link to="/stable">
          Go to Stable
          <ChevronRight className="w-4 h-4" />
        </Link>
      </Button>
    </Surface>
  </div>
);

const StatBlock: React.FC<{
  label: string;
  value: number | string | React.ReactNode;
  icon: React.ReactNode;
}> = ({ label, value, icon }) => (
  <Surface variant="subtle" className="p-4">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-xs text-role-muted uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-xl font-bold text-role-primary">{value}</p>
  </Surface>
);

const LegacyHallTab: React.FC<{ entries: HallOfFameEntry[] }> = ({ entries }) => (
  <div className="space-y-4" data-testid="legacy-hall-tab">
    <p className="text-sm text-role-muted">
      Retired horses live on in the Hall of Fame, their careers immortalised for future generations.
    </p>

    {entries.length === 0 ? (
      <div className="flex flex-col items-center justify-center min-h-48 text-center p-8">
        <Trophy className="w-12 h-12 text-role-disabled mb-4" />
        <h3 className="text-base font-semibold text-role-secondary mb-2">No Retired Horses Yet</h3>
        <p className="text-role-muted text-sm max-w-xs">
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

const HallOfFameCard: React.FC<{ entry: HallOfFameEntry; rank: number }> = ({ entry, rank }) => {
  // Spec 11.3.13: GoldBorderFrame is reserved for "championship horses /
  // featured / highest-level horses". A Hall-of-Fame horse that actually
  // earned at least one competition 1st-place win is a true champion — this
  // is real backend data (career.wins is derived from
  // useHorseCompetitionHistory → history.statistics.wins, NOT a hardcoded
  // "featured" flag). A retired horse with zero career wins is in the hall
  // but does not get the ornate champion frame.
  const isChampion = entry.career.wins > 0;

  const card = (
    /* Static content — no hover affordance (D-05); Surface panel + role tokens */
    <Surface variant="panel" data-testid={`hof-entry-${entry.id}`}>
      <div className="flex items-start gap-4">
        {/* Rank Badge */}
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-[var(--btn-gold-bg)] border border-[var(--btn-gold-border)]">
          <span className="text-sm font-bold text-[var(--gold-light)]">#{rank}</span>
        </div>

        {/* Horse Details */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl" aria-hidden="true">
              {entry.icon}
            </span>
            <h3 className="font-bold text-role-primary">{entry.name}</h3>
            <span className="text-xs text-role-muted ml-1">
              {entry.breed} · {entry.discipline}
            </span>
          </div>
          <p className="text-xs text-role-muted mb-3">Retired at age {entry.retiredAge}</p>

          {/* Career Stats — nested inside the panel → Surface subtle (no blur, §4) */}
          <div className="grid grid-cols-3 gap-3">
            <Surface variant="subtle" className="text-center p-2">
              <p className="text-lg font-bold text-role-primary">{entry.career.competitions}</p>
              <p className="text-xs text-role-muted">Competitions</p>
            </Surface>
            <Surface variant="subtle" className="text-center p-2">
              <p className="text-lg font-bold text-[var(--gold-light)]">{entry.career.wins}</p>
              <p className="text-xs text-role-muted">Wins</p>
            </Surface>
            <Surface variant="subtle" className="text-center p-2">
              <p className="text-lg font-bold text-role-primary">
                {entry.career.earnings.toLocaleString()}
              </p>
              <p className="text-xs text-role-muted">Coins Earned</p>
            </Surface>
          </div>
        </div>
      </div>
    </Surface>
  );

  if (!isChampion) {
    return card;
  }

  // Champion (≥1 real career win): wrap in the ornate GoldBorderFrame so the
  // hall-of-fame champion is visually highlighted per spec 11.3.13.
  return (
    <div data-testid={`hof-champion-frame-${entry.id}`}>
      <GoldBorderFrame className="rounded-[var(--radius-lg)]">{card}</GoldBorderFrame>
    </div>
  );
};

const MyStablePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<StableTab>('profile');
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const [isEditingStable, setIsEditingStable] = useState(false);
  const [draftStableName, setDraftStableName] = useState(user?.username ?? '');
  const { data: horses = [], isLoading } = useHorses();

  // Story 21S-4: real user-level career totals via /api/users/:userId/competition-stats
  // User.id is a UUID string (Equoria-ai6pw), so it can be passed through directly.
  const { data: userCompetitionStats, isError: isCompetitionStatsError } = useUserCompetitionStats(
    user?.id ?? null
  );

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
        // Equoria-8nmxm: dropped the `horse.earnings` fallback. Pre-fix
        // it referenced Horse.earnings (Decimal) — a column that was
        // never read elsewhere because the production writer (now fixed
        // in backend/utils/horseUpdates.mjs) targeted Horse.earnings
        // instead of Horse.totalEarnings. The Decimal column is dropped
        // by the schema migration tracked with this PR.
        earnings: Number(horse.totalEarnings ?? 0),
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
  // When the query has errored, we keep zeros for the numeric stats but also
  // expose isCompetitionStatsError so the UI can render a visible notice.
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
    <PageContainer variant="wide" padded={false} className="pb-8">
      {/* PageHeader (D-01): operational page, no location artwork — PageHero
          removed. Title is "Stable Profile" per D-27 (DECISIONS.md §10). */}
      <PageHeader
        title="Stable Profile"
        subtitle="Your stable profile and legacy hall of fame"
        icon={<Star className="w-6 h-6 text-[var(--gold-400)]" />}
        breadcrumbs={
          <nav aria-label="Breadcrumb" className="flex items-center gap-2">
            <Link to="/" className="hover:text-[var(--text-primary)] transition-colors">
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[var(--text-primary)]">Stable Profile</span>
          </nav>
        }
      />

      <div className="mt-6">
        {/* Tab Navigation — CanonicalTabs (DECISIONS.md §6), controlled
            so future cross-tab navigation can drive activeTab from the parent. */}
        <CanonicalTabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as StableTab)}
          tabs={[
            {
              value: 'profile',
              label: 'Stable Profile',
              icon: <Star className="w-4 h-4" />,
              content: (
                <StableProfileTab
                  stable={stable}
                  isLoading={isLoading}
                  isCareerStatsError={isCompetitionStatsError}
                  isEditing={isEditingStable}
                  draftStableName={draftStableName}
                  onDraftStableNameChange={setDraftStableName}
                  onStartEditing={handleStartEditing}
                  onCancelEditing={() => setIsEditingStable(false)}
                  onSave={handleSaveStableProfile}
                  isSaving={updateProfile.isPending}
                />
              ),
            },
            {
              value: 'legacy',
              label: 'Hall of Fame',
              icon: <Trophy className="w-4 h-4" />,
              content: <LegacyHallTab entries={hallOfFameEntries} />,
            },
          ]}
        />

        {/* Info Panel */}
        <Surface variant="panel" as="aside" className="mt-10 text-sm text-[var(--text-muted)]">
          <h3 className="font-semibold text-role-primary mb-2">About Your Stable Profile</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Your stable profile is visible to other players on the leaderboards</li>
            <li>Horses retired at level 8 or higher are inducted into the Hall of Fame</li>
            <li>Hall of Fame horses can be shown in breeding lineages for prestige</li>
            <li>Total earnings and win count contribute to your stable ranking</li>
            <li>Edit your stable display name from this profile panel</li>
          </ul>
        </Surface>
      </div>
    </PageContainer>
  );
};

export default MyStablePage;
