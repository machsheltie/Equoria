/**
 * CommunityPage — Community Hub (Epic 11 — Community Features)
 *
 * Central hub for all community features, linking to:
 * - Message Board (/message-board): General discussion, art, sales, services
 * - Clubs (/clubs): Discipline and breed associations with governance
 * - Messages/Inbox (/messages): Direct messaging between players
 *
 * Uses Celestial Night theme (consistent with other standalone pages).
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Users, Mail, Trophy, ArrowRight, Globe } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { useThreads } from '@/hooks/api/useForum';
import { useUnreadCount } from '@/hooks/api/useMessages';
import { useClubs } from '@/hooks/api/useClubs';

const MOCK_RECENT_ACTIVITY = [
  {
    id: 'act-1',
    type: 'thread',
    user: 'StarlightStables',
    action: 'posted in',
    target: 'General Chat',
    content: 'Anyone else excited for the Spring Classic next month?',
    time: '2 min ago',
  },
  {
    id: 'act-2',
    type: 'club',
    user: 'IronHoof Racing',
    action: 'joined',
    target: 'Thoroughbred Breed Club',
    content: '',
    time: '14 min ago',
  },
  {
    id: 'act-3',
    type: 'sale',
    user: 'MidnightMane',
    action: 'listed in',
    target: 'Horse Sales',
    content: 'WB mare, 5yo, Dressage-bred — 2,400 coins',
    time: '28 min ago',
  },
  {
    id: 'act-4',
    type: 'art',
    user: 'CanvasAndCanter',
    action: 'posted in',
    target: 'Art & Photography',
    content: 'Drew my bay gelding Copperfield — feedback welcome!',
    time: '1 hr ago',
  },
  {
    id: 'act-5',
    type: 'club',
    user: 'ArabiaNights',
    action: 'opened elections in',
    target: 'Arabian Breed Club',
    content: 'Vote for your next club president!',
    time: '2 hr ago',
  },
];

const activityTypeColor: Record<string, string> = {
  thread: 'bg-violet-500/20 text-violet-400',
  club: 'bg-celestial-gold/20 text-celestial-gold',
  sale: 'bg-emerald-500/20 text-emerald-400',
  art: 'bg-pink-500/20 text-pink-400',
};

const activityTypeLabel: Record<string, string> = {
  thread: '💬',
  club: '👥',
  sale: '🐴',
  art: '🎨',
};

const CommunityPage: React.FC = () => {
  const { total: threadTotal } = useThreads();
  const { data: unreadData } = useUnreadCount();
  const { data: clubsData } = useClubs();

  const unreadCount = unreadData?.count ?? 0;
  const disciplineCount = clubsData?.clubs.filter((c) => c.type === 'discipline').length ?? 0;
  const breedCount = clubsData?.clubs.filter((c) => c.type === 'breed').length ?? 0;

  const communityCards = [
    {
      title: 'Message Board',
      description:
        'Join the conversation. General chat, art sharing, horse sales, services, and community venting.',
      href: '/message-board',
      icon: <MessageSquare className="w-7 h-7 text-violet-400" />,
      accent: 'bg-violet-500/10 border-violet-500/30',
      borderAccent: 'hover:border-violet-500/50',
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
      icon: <Users className="w-7 h-7 text-celestial-gold" />,
      accent: 'bg-celestial-gold/10 border-celestial-gold/30',
      borderAccent: 'hover:border-celestial-gold/50',
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
      icon: <Mail className="w-7 h-7 text-emerald-400" />,
      accent: 'bg-emerald-500/10 border-emerald-500/30',
      borderAccent: 'hover:border-emerald-500/50',
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
      icon: <Trophy className="w-7 h-7 text-amber-400" />,
      accent: 'bg-amber-500/10 border-amber-500/30',
      borderAccent: 'hover:border-amber-500/50',
      stats: [
        { label: 'Inductees', value: '3' },
        { label: 'Total wins', value: '47' },
      ],
    },
  ];

  return (
    <div className="min-h-screen">
      <PageHero
        title="Community"
        subtitle="Connect with stable owners, join clubs, and share your equestrian journey"
        mood="default"
        icon={<Globe className="w-7 h-7 text-[var(--gold-400)]" />}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--cream)]/60">
          <Link to="/" className="hover:text-[var(--cream)] transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-[var(--cream)]">Community</span>
        </div>
      </PageHero>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Community Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {communityCards.map((card) => (
            <Link
              key={card.href}
              to={card.href}
              className={`group relative bg-white/5 border border-white/10 ${card.borderAccent} rounded-2xl p-6 transition-all hover:bg-white/8`}
              data-testid={`community-card-${card.href.replace('/', '')}`}
            >
              {card.badge && (
                <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-celestial-gold/20 text-celestial-gold border border-celestial-gold/30">
                  {card.badge}
                </span>
              )}

              <div className={`inline-flex p-2.5 rounded-xl border ${card.accent} mb-4`}>
                {card.icon}
              </div>

              <h2 className="text-base font-bold text-white/90 mb-1.5">{card.title}</h2>
              <p className="text-xs text-white/50 leading-relaxed mb-4">{card.description}</p>

              <div className="flex gap-4 mb-4">
                {card.stats.map((stat) => (
                  <div key={stat.label}>
                    <div className="text-lg font-bold text-white/80">{stat.value}</div>
                    <div className="text-[10px] text-white/40 uppercase tracking-wide">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1 text-xs text-white/40 group-hover:text-white/70 transition-colors">
                Open
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          ))}
        </div>

        {/* Community Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {[
            { label: 'Community Members', value: '1,284', icon: <Users className="w-4 h-4" /> },
            { label: 'Active Clubs', value: '13', icon: <Trophy className="w-4 h-4" /> },
            {
              label: 'Board Posts Today',
              value: '47',
              icon: <MessageSquare className="w-4 h-4" />,
            },
            { label: 'Messages Sent Today', value: '215', icon: <Mail className="w-4 h-4" /> },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white/5 border border-white/10 rounded-xl p-4 text-center"
            >
              <div className="flex justify-center mb-1 text-white/40">{stat.icon}</div>
              <div className="text-xl font-bold text-white/80">{stat.value}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wide mt-0.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity Feed — placeholder until live activity endpoint is implemented */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">
              Recent Community Activity
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 uppercase tracking-wide font-semibold">
              Coming Soon
            </span>
          </div>
          <div className="space-y-2">
            {MOCK_RECENT_ACTIVITY.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-4 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 transition-colors"
                data-testid={`activity-item-${activity.id}`}
              >
                <span className="text-lg mt-0.5 flex-shrink-0">
                  {activityTypeLabel[activity.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-semibold text-white/80">{activity.user}</span>
                    <span className="text-xs text-white/40">{activity.action}</span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${activityTypeColor[activity.type]}`}
                    >
                      {activity.target}
                    </span>
                  </div>
                  {activity.content && (
                    <p className="text-xs text-white/50 truncate">{activity.content}</p>
                  )}
                </div>
                <span className="text-[11px] text-white/30 flex-shrink-0 mt-0.5">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityPage;
