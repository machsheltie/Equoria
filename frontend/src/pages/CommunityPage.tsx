/**
 * CommunityPage — Community Hub (Epic 11 — Community Features)
 *
 * Central hub for all community features, linking to:
 * - Message Board (/message-board): General discussion, art, sales, services
 * - Clubs (/clubs): Discipline and breed associations with governance
 * - Messages/Inbox (/messages): Direct messaging between players
 *
 * Migrated to the canonical design system (Equoria-o5hub §4 community lane):
 * PageContainer(wide) + PageHeader, Surface semantics for cards/panels,
 * IconBox + GameBadge + text-role classes instead of raw palette colors.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Users, Mail, Trophy, ArrowRight, Globe } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { IconBox } from '@/components/ui/IconBox';
import { GameBadge } from '@/components/ui/game';
import { useThreads } from '@/hooks/api/useForum';
import { useUnreadCount } from '@/hooks/api/useMessages';
import { useClubs } from '@/hooks/api/useClubs';
import { useCommunityActivity } from '@/hooks/api/useUserProgress';
import ActivityFeed from '../components/ActivityFeed';
import { ActivityType, type Activity } from '../lib/activity-utils';

type CardRole = 'info' | 'accent' | 'success' | 'warning';

const CommunityPageContent: React.FC = () => {
  const { total: threadTotal } = useThreads();
  const { data: unreadData } = useUnreadCount();
  const { data: clubsData } = useClubs();
  const { data: activityData = [], isLoading: isActivityLoading } = useCommunityActivity();

  const unreadCount = unreadData?.count ?? 0;
  const disciplineCount = clubsData?.clubs.filter((c) => c.type === 'discipline').length ?? 0;
  const breedCount = clubsData?.clubs.filter((c) => c.type === 'breed').length ?? 0;

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
    stats: { label: string; value: string }[];
    badge?: string;
  }[] = [
    {
      title: 'Message Board',
      description:
        'Join the conversation. General chat, art sharing, horse sales, services, and community venting.',
      href: '/message-board',
      icon: <MessageSquare />,
      role: 'info',
      stats: [
        { label: 'Sections', value: '5' },
        { label: 'Active threads', value: threadTotal > 0 ? String(threadTotal) : '…' },
      ],
    },
    {
      title: 'Clubs',
      description:
        'Find your tribe. Join discipline associations and breed clubs, participate in elections and leaderboards.',
      href: '/clubs',
      icon: <Users />,
      role: 'accent',
      stats: [
        { label: 'Discipline clubs', value: disciplineCount > 0 ? String(disciplineCount) : '…' },
        { label: 'Breed clubs', value: breedCount > 0 ? String(breedCount) : '…' },
      ],
      badge: 'Elections open',
    },
    {
      title: 'Messages',
      description:
        'Your inbox. Send and receive direct messages with other stable owners and community members.',
      href: '/messages',
      icon: <Mail />,
      role: 'success',
      stats: [
        { label: 'Unread', value: String(unreadCount) },
        { label: 'Conversations', value: '…' },
      ],
    },
    {
      title: 'Hall of Fame',
      description:
        'Celebrate your greatest horses. Retired champions immortalised with career highlights and legacy records.',
      href: '/my-stable',
      icon: <Trophy />,
      role: 'warning',
      stats: [
        { label: 'Inductees', value: '…' },
        { label: 'Total wins', value: '…' },
      ],
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
                    <div className="text-lg font-bold text-role-secondary">{stat.value}</div>
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

        {/* Community Stats Banner — live stats where available, honest empty state otherwise */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {[
            {
              label: 'Active Threads',
              value: threadTotal > 0 ? String(threadTotal) : '…',
              icon: <MessageSquare className="w-4 h-4" />,
            },
            {
              label: 'Discipline Clubs',
              value: disciplineCount > 0 ? String(disciplineCount) : '…',
              icon: <Trophy className="w-4 h-4" />,
            },
            {
              label: 'Breed Clubs',
              value: breedCount > 0 ? String(breedCount) : '…',
              icon: <Users className="w-4 h-4" />,
            },
            {
              label: 'Unread Messages',
              value: String(unreadCount),
              icon: <Mail className="w-4 h-4" />,
            },
          ].map((stat) => (
            <Surface key={stat.label} variant="panel" className="text-center">
              <div className="flex justify-center mb-1 text-role-muted">{stat.icon}</div>
              <div className="text-xl font-bold text-role-secondary">{stat.value}</div>
              <div className="text-[10px] text-role-muted uppercase tracking-wide mt-0.5">
                {stat.label}
              </div>
            </Surface>
          ))}
        </div>

        {/* Recent Activity Feed */}
        <Surface variant="panel" className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-[var(--gold-400)]" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-role-secondary uppercase tracking-wide">
              Recent Community Activity
            </h2>
          </div>
          <ActivityFeed
            activities={activities}
            title=""
            maxItems={10}
            showViewAll={false}
            size="md"
            isLoading={isActivityLoading}
            emptyMessage="The community is quiet... for now. Start a discussion or join a club!"
          />
        </Surface>
      </PageContainer>
    </div>
  );
};

const CommunityPage: React.FC = () => {
  return <CommunityPageContent />;
};

export default CommunityPage;
