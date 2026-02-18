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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
          <div className="absolute z-10 flex flex-col items-center">
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
          <p className="text-lg font-bold text-red-400">Connection Severed</p>
          <p className="text-sm opacity-70">The stars are clouded. Please try again.</p>
        </div>
        <Button onClick={handleRefresh} variant="celestial">
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

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-8 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-5xl font-heading font-bold text-transparent bg-clip-text bg-gradient-to-r from-starlight-white to-gray-400 mb-2 drop-shadow-md">
              Welcome, {dashboardData?.user.username}
            </h1>
            <div className="flex items-center space-x-6 text-sm text-starlight-white/70 font-body tracking-wider">
              <span className="flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-celestial-gold" /> Level{' '}
                {progressData?.level || 1}
              </span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span className="flex items-center">
                <span className="text-celestial-gold mr-1">$</span>
                {dashboardData?.user?.money?.toLocaleString() || 0}
              </span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span className="flex items-center">{dashboardData?.horses?.total || 0} Horses</span>
            </div>
          </div>
          <Button
            onClick={handleRefresh}
            variant="ghost"
            className="mt-4 lg:mt-0 text-starlight-white/50 hover:text-celestial-gold hover:bg-white/5"
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

            <div className="relative z-10 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-xl">
                  <TrendingUp className="w-5 h-5 mr-3 text-celestial-gold" /> Ascension Progress
                </CardTitle>
                <span className="text-sm font-mono text-celestial-gold">
                  {Math.round(progressPercentage)}%
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs text-starlight-white/60 mb-2 uppercase tracking-widest">
                  <span>Current Tier</span>
                  <span>
                    {progressData?.xp || 0} / {progressData?.xpToNextLevel || 100} XP
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden border border-white/5">
                  <div
                    className="bg-gradient-to-r from-celestial-gold to-amber-500 h-full shadow-[0_0_10px_rgba(250,204,21,0.5)] transition-all duration-1000 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-white/5">
                {[
                  {
                    label: 'Competitions',
                    value: progressData?.totalCompetitions,
                    color: 'text-blue-400',
                  },
                  {
                    label: 'Victories',
                    value: progressData?.totalWins,
                    color: 'text-celestial-gold',
                  },
                  {
                    label: 'Win Rate',
                    value: `${progressData?.winRate}%`,
                    color: 'text-purple-400',
                  },
                  {
                    label: 'Stable Size',
                    value: progressData?.totalHorses,
                    color: 'text-emerald-400',
                  },
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className={`text-2xl font-heading font-bold ${stat.color}`}>
                      {stat.value || 0}
                    </div>
                    <div className="text-xs text-starlight-white/50 uppercase tracking-widest mt-1">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Right Col: Quick Actions */}
          <div className="space-y-4">
            <h2 className="text-lg font-heading text-starlight-white/80 pl-1">Command Center</h2>
            {[
              {
                id: 'stable',
                icon: Home,
                label: 'Stable Management',
                desc: 'Manage your horses',
                color: 'text-blue-400',
              },
              {
                id: 'training',
                icon: Dumbbell,
                label: 'Training Grounds',
                desc: 'Improve stats',
                color: 'text-emerald-400',
              },
              {
                id: 'competition',
                icon: Trophy,
                label: 'Competition',
                desc: 'Enter events',
                color: 'text-celestial-gold',
              },
            ].map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.id)}
                className="w-full group relative flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <div className="flex items-center relative z-10">
                  <div
                    className={`p-3 rounded-md bg-black/40 ${action.color} ring-1 ring-white/10 group-hover:scale-110 transition-transform`}
                  >
                    <action.icon className="w-5 h-5" />
                  </div>
                  <div className="ml-4 text-left">
                    <div className="font-heading font-semibold text-starlight-white group-hover:text-white transition-colors">
                      {action.label}
                    </div>
                    <div className="text-xs text-starlight-white/50">{action.desc}</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-celestial-gold group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>

        {/* Lower Section: Feeds */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="w-5 h-5 mr-3 text-starlight-white/50" /> Chronicle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityData?.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 p-3 rounded-lg bg-white/5 border-l-2 border-white/10 hover:border-celestial-gold transition-colors group"
                  >
                    <div className="text-xs font-mono text-starlight-white/40 min-w-[80px] pt-1">
                      {formatTimestamp(item.timestamp)}
                    </div>
                    <div className="text-sm text-starlight-white/90 group-hover:text-white transition-colors">
                      {item.description}
                    </div>
                  </div>
                ))}
                {activityData?.length === 0 && (
                  <div className="text-center text-starlight-white/30 py-8 italic">
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
                <div className="p-4 rounded-lg bg-indigo-900/40 border border-indigo-500/30 flex gap-4 backdrop-blur-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-50">
                    <Sparkles className="w-12 h-12 text-indigo-500/20" />
                  </div>
                  <div className="flex-1 relative z-10">
                    <h3 className="font-heading font-bold text-indigo-300 mb-1">Weekly Coffers</h3>
                    <p className="text-sm text-indigo-100/80 mb-2">
                      Expenses:{' '}
                      <span className="text-white font-bold">
                        ${salarySummaryData.weeklyCost.toLocaleString()}
                      </span>{' '}
                      assigned to grooms.
                    </p>
                    <Link
                      to="/grooms"
                      className="text-xs font-bold text-indigo-400 hover:text-indigo-200 uppercase tracking-wider flex items-center"
                    >
                      Manage Staff <ChevronRight className="w-3 h-3 ml-1" />
                    </Link>
                  </div>
                  <button
                    onClick={() => setIsSalaryReminderDismissed(true)}
                    className="text-white/30 hover:text-white"
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
                    <div className="text-center text-starlight-white/30 py-8 italic">
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
