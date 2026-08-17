/**
 * CommunityPage — Community Hub (Epic 11 — Community Features)
 *
 * Central hub for all community features, linking to:
 * - Message Board (/message-board): General discussion, art, sales, services
 * - Clubs (/clubs): Discipline and breed associations with governance
 * - Messages/Inbox (/messages): Direct messaging between players
 * - Hall of Fame (/my-stable): Retired champions (MyStablePage legacy tab)
 *
 * Migrated to the canonical design system (Equoria-o5hub §4 community lane):
 * PageContainer(wide) + PageHeader, Surface semantics for cards/panels,
 * IconBox + GameBadge + text-role classes instead of raw palette colors.
 *
 * Equoria-r4cyk: every displayed stat is backed by a real query and rendered
 * through the four-state contract (FRONTEND_ASYNC_STATE_DOCTRINE §1):
 * pending → skeleton, error → "—" + a visible error bar with a wired retry,
 * success → the real number INCLUDING a real 0. The "Elections open" badge is
 * gated on real election state (GET /api/v1/clubs/elections/open-count) and
 * the Hall of Fame stats reuse MyStablePage's real retired-horse + career
 * history queries. No stub literals, no unconditional badges.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Users, Mail, Trophy, ArrowRight, Globe } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import PageHeader from '@/components/layout/PageHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { IconBox } from '@/components/ui/IconBox';
import { GameBadge } from '@/components/ui/game';
import { Skeleton, InlineError, ErrorState } from '@/components/ui/state';
import { FORUM_SECTIONS } from '@/lib/api-client';
import { useThreads } from '@/hooks/api/useForum';
import { useUnreadCount, useConversationsCount } from '@/hooks/api/useMessages';
import { useClubs, useOpenElectionsCount } from '@/hooks/api/useClubs';
import { useCommunityActivity } from '@/hooks/api/useUserProgress';
import { useHorses } from '@/hooks/api/useHorses';
import {
  fetchHorseCompetitionHistory,
  type CompetitionHistoryData,
} from '@/lib/api/competitionResults';
import { horseCompetitionHistoryQueryKeys } from '@/hooks/api/useHorseCompetitionHistory';
import ActivityFeed from '../components/ActivityFeed';
import { ActivityType, type Activity } from '../lib/activity-utils';

type CardRole = 'info' | 'accent' | 'success' | 'warning';

/**
 * Horses at or past this age are Hall of Fame inductees — the same
 * definition MyStablePage uses for its legacy tab (backend horseAgePolicy:
 * active window 3–20, retires at 21).
 */
const RETIREMENT_AGE_YEARS = 21;

/**
 * Four-state model for one hub stat. `value` is only meaningful when the
 * stat is neither pending nor errored (empty-and-zero is only reachable
 * through success — doctrine §1).
 */
interface HubStat {
  label: string;
  isPending: boolean;
  isError: boolean;
  value: number;
}

/** A stat derived from static app config — never pending, never errored. */
const staticStat = (label: string, value: number): HubStat => ({
  label,
  isPending: false,
  isError: false,
  value,
});

/**
 * Renders a stat value per the four-state contract: skeleton while pending
 * (announced via role="status"), an honest "—" on error (the page-level
 * stats error bar carries the role="alert" + retry), the real number —
 * including a real 0 — on success.
 */
const StatValue: React.FC<{ stat: HubStat }> = ({ stat }) => {
  if (stat.isPending) {
    return (
      <span role="status" aria-label={`Loading ${stat.label}`} className="inline-block">
        <Skeleton.Rect className="h-5 w-8" />
      </span>
    );
  }
  if (stat.isError) {
    return <span>—</span>;
  }
  return <span>{String(stat.value)}</span>;
};

const CommunityPageContent: React.FC = () => {
  const threadsQuery = useThreads();
  const unreadQuery = useUnreadCount();
  const conversationsQuery = useConversationsCount();
  const clubsQuery = useClubs();
  const openElectionsQuery = useOpenElectionsCount();
  const activityQuery = useCommunityActivity();
  const horsesQuery = useHorses();

  // Hall of Fame: retired horses + their real career histories. Reuses
  // MyStablePage's exact query keys so the caches are shared between the hub
  // card and the destination page.
  const horses = horsesQuery.data ?? [];
  const retiredHorses = horses.filter(
    (horse) => (horse.ageYears ?? horse.age ?? 0) >= RETIREMENT_AGE_YEARS
  );
  const hofHistories = useQueries({
    queries: retiredHorses.map((horse) => ({
      queryKey: horseCompetitionHistoryQueryKeys.history(horse.id),
      queryFn: () => fetchHorseCompetitionHistory(horse.id),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    })),
  });

  const threadsError = Boolean(threadsQuery.error);
  const clubs = clubsQuery.data?.clubs;
  const disciplineCount = clubs?.filter((c) => c.type === 'discipline').length ?? 0;
  const breedCount = clubs?.filter((c) => c.type === 'breed').length ?? 0;

  const hofPending = horsesQuery.isPending || hofHistories.some((q) => q.isPending);
  const hofError = horsesQuery.isError || hofHistories.some((q) => q.isError);
  const hofWins = hofHistories.reduce(
    (sum, q) => sum + ((q.data as CompetitionHistoryData | undefined)?.statistics.wins ?? 0),
    0
  );

  const stats: Record<string, HubStat> = {
    sections: staticStat('Sections', FORUM_SECTIONS.length),
    activeThreads: {
      label: 'Active threads',
      isPending: threadsQuery.isLoading,
      isError: threadsError,
      value: threadsQuery.total,
    },
    disciplineClubs: {
      label: 'Discipline clubs',
      isPending: clubsQuery.isPending,
      isError: clubsQuery.isError,
      value: disciplineCount,
    },
    breedClubs: {
      label: 'Breed clubs',
      isPending: clubsQuery.isPending,
      isError: clubsQuery.isError,
      value: breedCount,
    },
    unread: {
      label: 'Unread',
      isPending: unreadQuery.isPending,
      isError: unreadQuery.isError,
      value: unreadQuery.data?.count ?? 0,
    },
    conversations: {
      label: 'Conversations',
      isPending: conversationsQuery.isPending,
      isError: conversationsQuery.isError,
      value: conversationsQuery.data?.count ?? 0,
    },
    inductees: {
      label: 'Inductees',
      isPending: horsesQuery.isPending,
      isError: horsesQuery.isError,
      value: retiredHorses.length,
    },
    totalWins: {
      label: 'Total wins',
      isPending: hofPending,
      isError: hofError,
      value: hofWins,
    },
  };

  // "Elections open" badge — present ONLY when the caller's clubs have at
  // least one genuinely-open election (success-gated; pending or errored
  // election state renders no badge, and an errored query joins the shared
  // error bar below).
  const electionsOpen = openElectionsQuery.isSuccess && (openElectionsQuery.data?.count ?? 0) > 0;

  // One shared error bar + retry for every errored stat query. The retry is
  // a real refetch of exactly the queries that failed (doctrine §1). It lives
  // OUTSIDE the link cards because a button nested inside an anchor is
  // invalid interactive markup.
  const statQueries: Array<{ isError: boolean; refetch: () => unknown }> = [
    { isError: threadsError, refetch: threadsQuery.refetch },
    { isError: clubsQuery.isError, refetch: clubsQuery.refetch },
    { isError: unreadQuery.isError, refetch: unreadQuery.refetch },
    { isError: conversationsQuery.isError, refetch: conversationsQuery.refetch },
    { isError: openElectionsQuery.isError, refetch: openElectionsQuery.refetch },
    { isError: horsesQuery.isError, refetch: horsesQuery.refetch },
    ...hofHistories.map((q) => ({ isError: q.isError, refetch: q.refetch })),
  ];
  const erroredStatQueries = statQueries.filter((q) => q.isError);
  const hasStatsError = erroredStatQueries.length > 0;
  const retryStats = () => {
    erroredStatQueries.forEach((q) => {
      void q.refetch();
    });
  };

  const activityData = activityQuery.data ?? [];
  const activities: Activity[] = activityData.map((act) => {
    let type = ActivityType.ACHIEVEMENT;
    if (act.type === 'FORUM_POST') type = ActivityType.ACHIEVEMENT;
    if (act.type === 'CLUB_CREATED') type = ActivityType.ACHIEVEMENT;
    if (act.type === 'COMPETITION_WIN') type = ActivityType.COMPETITION;

    return {
      id: String(act.id),
      type,
      timestamp: act.timestamp,
      data: {
        description: act.description,
        ...act.metadata,
      },
    };
  });

  const communityCards: {
    title: string;
    description: string;
    href: string;
    icon: React.ReactNode;
    role: CardRole;
    stats: HubStat[];
    badge?: string;
  }[] = [
    {
      title: 'Message Board',
      description:
        'Join the conversation. General chat, art sharing, horse sales, services, and community venting.',
      href: '/message-board',
      icon: <MessageSquare />,
      role: 'info',
      stats: [stats.sections, stats.activeThreads],
    },
    {
      title: 'Clubs',
      description:
        'Find your tribe. Join discipline associations and breed clubs, participate in elections and leaderboards.',
      href: '/clubs',
      icon: <Users />,
      role: 'accent',
      stats: [stats.disciplineClubs, stats.breedClubs],
      badge: electionsOpen ? 'Elections open' : undefined,
    },
    {
      title: 'Messages',
      description:
        'Your inbox. Send and receive direct messages with other stable owners and community members.',
      href: '/messages',
      icon: <Mail />,
      role: 'success',
      stats: [stats.unread, stats.conversations],
    },
    {
      title: 'Hall of Fame',
      description:
        'Celebrate your greatest horses. Retired champions immortalised with career highlights and legacy records.',
      href: '/my-stable',
      icon: <Trophy />,
      role: 'warning',
      stats: [stats.inductees, stats.totalWins],
    },
  ];

  return (
    <div className="min-h-screen">
      <PageContainer variant="wide" padded={false} className="pb-8">
        <PageHeader
          title="Community"
          subtitle="Connect with stable owners, join clubs, and share your equestrian journey"
          icon={<Globe className="w-5 h-5 text-[var(--gold-400)]" aria-hidden="true" />}
          breadcrumbs={
            <div className="flex items-center gap-2">
              <Link to="/" className="hover:text-[var(--text-primary)] transition-colors">
                Home
              </Link>
              <span>/</span>
              <span className="text-[var(--text-primary)]">Community</span>
            </div>
          }
          className="mb-8"
        />

        {/* Shared stats error bar — visible error + wired retry for every
            errored stat query (doctrine §1). Errored tiles render "—". */}
        {hasStatsError && (
          <Surface
            variant="panel"
            className="mb-6 flex flex-wrap items-center justify-between gap-3"
            data-testid="community-stats-error"
          >
            <InlineError message="Some community stats couldn't load. Check your connection and try again." />
            <button
              type="button"
              onClick={retryStats}
              className="text-xs font-semibold underline underline-offset-2 text-role-secondary hover:text-[var(--text-primary)] transition-colors"
            >
              Try again
            </button>
          </Surface>
        )}

        {/* Community Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {communityCards.map((card) => (
            <Surface
              key={card.href}
              variant="interactive"
              as={Link}
              to={card.href}
              className="group relative"
              data-testid={`community-card-${card.href.replace('/', '')}`}
            >
              {card.badge && (
                <GameBadge className="absolute top-4 right-4 text-[10px]">{card.badge}</GameBadge>
              )}

              <IconBox variant={card.role} size="lg" className="mb-4">
                {card.icon}
              </IconBox>

              <h2 className="text-base font-bold text-role-primary mb-1.5">{card.title}</h2>
              <p className="text-xs text-role-muted leading-relaxed mb-4">{card.description}</p>

              <div className="flex gap-4 mb-4">
                {card.stats.map((stat) => (
                  <div key={stat.label}>
                    <div className="text-lg font-bold text-role-secondary">
                      <StatValue stat={stat} />
                    </div>
                    <div className="text-[10px] text-role-muted uppercase tracking-wide">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1 text-xs text-role-muted group-hover:text-[var(--text-secondary)] transition-colors">
                Open
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Surface>
          ))}
        </div>

        {/* Community Stats Banner — every value real, four-state rendered */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {[
            {
              stat: { ...stats.activeThreads, label: 'Active Threads' },
              icon: <MessageSquare className="w-4 h-4" />,
            },
            {
              stat: { ...stats.disciplineClubs, label: 'Discipline Clubs' },
              icon: <Trophy className="w-4 h-4" />,
            },
            {
              stat: { ...stats.breedClubs, label: 'Breed Clubs' },
              icon: <Users className="w-4 h-4" />,
            },
            {
              stat: { ...stats.unread, label: 'Unread Messages' },
              icon: <Mail className="w-4 h-4" />,
            },
          ].map(({ stat, icon }) => (
            <Surface key={stat.label} variant="panel" className="text-center">
              <div className="flex justify-center mb-1 text-role-muted">{icon}</div>
              <div className="text-xl font-bold text-role-secondary">
                <StatValue stat={stat} />
              </div>
              <div className="text-[10px] text-role-muted uppercase tracking-wide mt-0.5">
                {stat.label}
              </div>
            </Surface>
          ))}
        </div>

        {/* Recent Activity Feed — four-state: a failed fetch renders a real
            error + retry, never the "community is quiet" empty lie. */}
        <Surface variant="panel" className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-[var(--gold-400)]" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-role-secondary uppercase tracking-wide">
              Recent Community Activity
            </h2>
          </div>
          {activityQuery.isError ? (
            <ErrorState
              title="Couldn't load community activity"
              message="Check your connection and try again."
              retry={{
                label: 'Try Again',
                onClick: () => {
                  void activityQuery.refetch();
                },
              }}
            />
          ) : (
            <ActivityFeed
              activities={activities}
              title=""
              maxItems={10}
              showViewAll={false}
              size="md"
              isLoading={activityQuery.isPending}
              emptyMessage="The community is quiet... for now. Start a discussion or join a club!"
            />
          )}
        </Surface>
      </PageContainer>
    </div>
  );
};

const CommunityPage: React.FC = () => {
  return <CommunityPageContent />;
};

export default CommunityPage;
