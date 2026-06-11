import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  TrendingUp,
  Award,
  Clock,
  RefreshCw,
  Home,
  Dumbbell,
  Trophy,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useUserProgress, useDashboard, useActivityFeed } from '../hooks/api/useUserProgress';
import { useGroomSalaries } from '../hooks/api/useGrooms';
import type {
  UserProgress,
  DashboardData,
  ActivityFeedItem,
  SalarySummary,
} from '@/lib/api-client';
import {
  FrostedPanel as Card,
  FrostedPanelHeader as CardHeader,
  FrostedPanelTitle as CardTitle,
  FrostedPanelContent as CardContent,
} from '@/components/ui/game';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/Surface';
import Currency from '@/components/ui/Currency';
import { ArtStage } from '@/components/layout/ArtStage';
import { Orb } from '@/components/layout/Orb';

// Extends DashboardData to include optional recentShows (returned by some dashboard API variants)
type DashboardDataExtended = DashboardData & {
  recentShows?: Array<{ id: number; name: string; placement: number }>;
};

interface UserDashboardProps {
  userId: number;
  progressData?: UserProgress;
  dashboardData?: DashboardDataExtended;
  activityData?: ActivityFeedItem[];
  salarySummaryData?: SalarySummary;
}

const UserDashboard: React.FC<UserDashboardProps> = ({
  userId,
  progressData: propProgressData,
  dashboardData: propDashboardData,
  activityData: propActivityData,
  salarySummaryData: propSalarySummaryData,
}) => {
  const navigate = useNavigate();
  const [_activityPage, _setActivityPage] = useState(1);
  const [isSalaryReminderDismissed, setIsSalaryReminderDismissed] = useState(false);

  // Hooks (Same as before)
  const {
    data: progressData = propProgressData,
    isLoading: progressLoading,
    error: progressError,
    refetch: refetchProgress,
  } = useUserProgress(userId);

  const {
    data: dashboardData = propDashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useDashboard(userId);

  const { data: activityData = propActivityData } = useActivityFeed(userId);

  const { data: salarySummaryData = propSalarySummaryData } = useGroomSalaries();

  const progressPercentage = useMemo(() => {
    if (!progressData) return 0;
    const currentLevelXP = progressData.xp % 100;
    return (currentLevelXP / 100) * 100;
  }, [progressData]);

  const isLoading = (progressLoading || dashboardLoading) && !propProgressData;
  const hasError = (progressError || dashboardError) && !propProgressData;

  const handleRefresh = () => {
    refetchProgress();
    refetchDashboard();
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'stable':
        navigate('/stable');
        break;
      case 'training':
        navigate('/training');
        break;
      case 'competition':
        navigate('/competition');
        break;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Recently';
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${Math.floor(diffHours / 24)} days ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-starlight-white">
        <div className="flex flex-col items-center">
          <Orb size="md" color="purple" className="relative" />
          <div className="absolute z-[var(--z-raised)] flex flex-col items-center">
            <RefreshCw className="w-8 h-8 animate-spin mb-4 text-celestial-gold" />
            <p className="text-lg font-heading tracking-widest animate-pulse">
              Summoning Dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="text-center py-12 text-starlight-white">
        <div className="mb-4">
          <p className="text-lg font-bold text-[var(--status-danger)]">Connection Severed</p>
          <p className="text-sm opacity-70">The stars are clouded. Please try again.</p>
        </div>
        <Button onClick={handleRefresh} variant="default">
          Reconnect
        </Button>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 lg:p-8 relative overflow-hidden">
      {/* Background Decor */}
      <Orb size="xl" color="blue" blur="lg" className="-top-20 -right-20 opacity-30" />
      <Orb size="lg" color="gold" blur="md" className="top-40 -left-20 opacity-20" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-[var(--z-raised)]">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-8 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-5xl font-heading font-bold text-transparent bg-clip-text bg-gradient-to-r from-starlight-white to-[rgb(100,130,165)] mb-2 drop-shadow-md">
              Welcome, {dashboardData?.user.username}
            </h1>
            <div className="flex items-center space-x-6 text-sm text-role-secondary font-body tracking-wider">
              <span className="flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-celestial-gold" /> Level{' '}
                {progressData?.level || 1}
              </span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              {/* Canonical Currency (DECISIONS.md §9): game currency is coins —
                  never "$"/USD formatting. */}
              <Currency amount={Number(dashboardData?.user?.money ?? 0)} />
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span className="flex items-center">{dashboardData?.horses?.total || 0} Horses</span>
            </div>
          </div>
          <Button
            onClick={handleRefresh}
            variant="ghost"
            className="mt-4 lg:mt-0 text-role-muted hover:text-celestial-gold hover:bg-white/5"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Hero Section: Progress & Featured Art */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Col: Stats & Progress */}
          <Card className="lg:col-span-2 relative overflow-hidden group">
            {/* Art Stage for Dashboard Visualization */}
            <div className="absolute inset-0 z-0 opacity-20 transition-opacity duration-700 group-hover:opacity-30">
              <ArtStage
                variant="sidebar"
                artSrc="/assets/art/equoriacelestial.png"
                className="object-top"
                overlay={false}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-deep-space via-deep-space/90 to-transparent" />
            </div>

            <div className="relative z-[var(--z-raised)] p-6 space-y-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-xl">
                  <TrendingUp className="w-5 h-5 mr-3 text-celestial-gold" /> Ascension Progress
                </CardTitle>
                <span className="text-sm font-mono text-celestial-gold">
                  {Math.round(progressPercentage)}%
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs text-role-secondary mb-2 uppercase tracking-widest">
                  <span>Current Tier</span>
                  <span>
                    {progressData?.xp || 0} / {progressData?.xpToNextLevel || 100} XP
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden border border-white/5">
                  <div
                    className="bg-gradient-to-r from-celestial-gold to-[var(--gold-light)] h-full shadow-[var(--glow-gold)] transition-all duration-1000 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-white/5">
                {/* Role tokens replace the raw blue/purple/emerald palette (D-11) */}
                {[
                  {
                    label: 'Competitions',
                    value: progressData?.totalCompetitions,
                    color: 'text-[var(--status-info)]',
                  },
                  {
                    label: 'Victories',
                    value: progressData?.totalWins,
                    color: 'text-[var(--gold-light)]',
                  },
                  {
                    label: 'Win Rate',
                    value: `${progressData?.winRate}%`,
                    color: 'text-role-primary',
                  },
                  {
                    label: 'Stable Size',
                    value: progressData?.totalHorses,
                    color: 'text-[var(--status-success)]',
                  },
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className={`text-2xl font-heading font-bold ${stat.color}`}>
                      {stat.value || 0}
                    </div>
                    <div className="text-xs text-role-muted uppercase tracking-widest mt-1">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Right Col: Quick Actions */}
          <div className="space-y-4">
            <h2 className="text-lg font-heading text-role-primary pl-1">Command Center</h2>
            {/* Role tokens replace the raw palette; Surface(interactive) is the
                clickable repeated item (D-05 — only variant with hover affordance). */}
            {[
              {
                id: 'stable',
                icon: Home,
                label: 'Stable Management',
                desc: 'Manage your horses',
                color: 'text-[var(--status-info)]',
              },
              {
                id: 'training',
                icon: Dumbbell,
                label: 'Training Grounds',
                desc: 'Improve stats',
                color: 'text-[var(--status-success)]',
              },
              {
                id: 'competition',
                icon: Trophy,
                label: 'Competition',
                desc: 'Enter events',
                color: 'text-[var(--gold-light)]',
              },
            ].map((action) => (
              <Surface
                key={action.id}
                variant="interactive"
                as="button"
                // SurfaceProps is not polymorphically typed over `as` yet;
                // spread passes the button `type` attr.
                {...{ type: 'button' }}
                onClick={() => handleQuickAction(action.id)}
                className="w-full group relative flex items-center justify-between p-4 overflow-hidden"
              >
                <div className="flex items-center relative z-[var(--z-raised)]">
                  <div
                    className={`p-3 rounded-[var(--radius-md)] bg-[var(--glass-surface-subtle-bg)] ${action.color} ring-1 ring-[var(--glass-border)]`}
                  >
                    <action.icon className="w-5 h-5" />
                  </div>
                  <div className="ml-4 text-left">
                    <div className="font-heading font-semibold text-role-primary">
                      {action.label}
                    </div>
                    <div className="text-xs text-role-muted">{action.desc}</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-role-muted group-hover:text-[var(--gold-light)] transition-colors" />
              </Surface>
            ))}
          </div>
        </div>

        {/* Lower Section: Feeds */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="w-5 h-5 mr-3 text-role-muted" /> Chronicle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityData?.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 p-3 rounded-lg bg-white/5 border-l-2 border-white/10 hover:border-celestial-gold transition-colors group"
                  >
                    <div className="text-xs font-mono text-role-muted min-w-[80px] pt-1">
                      {formatTimestamp(item.timestamp)}
                    </div>
                    <div className="text-sm text-role-primary group-hover:text-[var(--text-primary)] transition-colors">
                      {item.description}
                    </div>
                  </div>
                ))}
                {activityData?.length === 0 && (
                  <div className="text-center text-role-disabled py-8 italic">
                    The chronicle is silent...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Achievements / Notifications */}
          <div className="space-y-6">
            {/* Salary Notification */}
            {salarySummaryData &&
              salarySummaryData.groomCount > 0 &&
              !isSalaryReminderDismissed && (
                /* Info-role notice — raw indigo palette + nested backdrop-blur
                   removed (D-11/D-12 + single-blur rule, DECISIONS.md §4). */
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--badge-info-bg)] border border-[var(--status-info)]/30 flex gap-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-50">
                    <Sparkles className="w-12 h-12 text-[var(--status-info)]/20" />
                  </div>
                  <div className="flex-1 relative z-[var(--z-raised)]">
                    <h3 className="font-heading font-bold text-[var(--status-info)] mb-1">
                      Weekly Coffers
                    </h3>
                    <p className="text-sm text-role-secondary mb-2">
                      Expenses: {/* Canonical Currency (DECISIONS.md §9) — never "$"/USD */}
                      <Currency
                        amount={salarySummaryData.totalWeeklyCost}
                        className="text-role-primary font-bold"
                      />{' '}
                      assigned to grooms.
                    </p>
                    <Link
                      to="/grooms"
                      className="text-xs font-bold text-[var(--status-info)] hover:text-role-primary uppercase tracking-wider flex items-center"
                    >
                      Manage Staff <ChevronRight className="w-3 h-3 ml-1" />
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSalaryReminderDismissed(true)}
                    className="text-role-muted hover:text-role-primary"
                  >
                    <div className="sr-only">Dismiss</div>×
                  </button>
                </div>
              )}

            {/* Recent Wins */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Award className="w-5 h-5 mr-3 text-celestial-gold" /> Glory
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData?.recentShows?.slice(0, 3).map((show) => (
                    <div
                      key={show.id}
                      className="flex items-center justify-between p-3 rounded bg-gradient-to-r from-celestial-gold/10 to-transparent border border-celestial-gold/20"
                    >
                      <div className="flex items-center gap-3">
                        <Trophy className="w-4 h-4 text-celestial-gold shadow-glow" />
                        <span className="font-medium text-starlight-white">{show.name}</span>
                      </div>
                      <span className="text-xs font-heading font-bold text-celestial-gold bg-black/40 px-2 py-1 rounded">
                        {show.placement === 1 ? '1st' : show.placement === 2 ? '2nd' : '3rd'}
                      </span>
                    </div>
                  ))}
                  {!dashboardData?.recentShows?.length && (
                    <div className="text-center text-role-disabled py-8 italic">
                      No victories recorded yet...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
};

export default UserDashboard;
