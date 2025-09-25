/**
 * User Dashboard Component
 * 
 * Comprehensive dashboard interface providing:
 * - User overview with level, XP, money, and statistics
 * - Progress tracking with visual indicators and achievement display
 * - Recent activity timeline with pagination support
 * - Quick actions for common game functions (stable, training, competition)
 * - Real-time data updates using React Query
 * - Responsive design with mobile-first approach
 * - Accessibility support with ARIA labels and keyboard navigation
 * 
 * Integrates with backend APIs:
 * - GET /api/users/:id/progress - User progress data
 * - GET /api/dashboard/:userId - Dashboard overview
 * - GET /api/users/:id/activity - Activity feed
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  TrendingUp, 
  Award, 
  Clock, 
  RefreshCw,
  Home,
  Dumbbell,
  Trophy,
  ChevronRight,
  Star
} from 'lucide-react';

interface UserDashboardProps {
  userId: number;
}

interface UserProgress {
  level: number;
  xp: number;
  xpToNextLevel: number;
  money: number;
  totalHorses: number;
  totalCompetitions: number;
  totalWins: number;
  winRate: number;
}

interface DashboardData {
  user: {
    id: number;
    username: string;
    email: string;
    level: number;
    xp: number;
    money: number;
  };
  horses: Array<{
    id: number;
    name: string;
    breed: string;
    age: number;
  }>;
  recentShows: Array<{
    id: number;
    name: string;
    date: string;
    placement: number;
  }>;
  recentActivity: Array<{
    id: number;
    type: string;
    description: string;
    timestamp: string;
  }>;
}

interface ActivityItem {
  id: number;
  type: string;
  description: string;
  timestamp: string;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ userId }) => {
  const navigate = useNavigate();
  const [activityPage, setActivityPage] = useState(1);

  // Fetch user progress data
  const { 
    data: progressData, 
    isLoading: progressLoading, 
    error: progressError,
    refetch: refetchProgress 
  } = useQuery<UserProgress>({
    queryKey: ['userProgress', userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/progress`);
      if (!response.ok) {
        throw new Error('Failed to fetch user progress');
      }
      return response.json();
    },
  });

  // Fetch dashboard data
  const { 
    data: dashboardData, 
    isLoading: dashboardLoading, 
    error: dashboardError,
    refetch: refetchDashboard 
  } = useQuery<DashboardData>({
    queryKey: ['dashboard', userId],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      return response.json();
    },
  });

  // Fetch activity feed
  const { 
    data: activityData, 
    isLoading: activityLoading,
    error: activityError 
  } = useQuery<ActivityItem[]>({
    queryKey: ['userActivity', userId, activityPage],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/activity?page=${activityPage}&limit=10`);
      if (!response.ok) {
        throw new Error('Failed to fetch activity data');
      }
      return response.json();
    },
  });

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (!progressData) return 0;
    const currentLevelXP = progressData.xp % 100; // Assuming 100 XP per level
    return (currentLevelXP / 100) * 100;
  }, [progressData]);

  // Handle loading states
  const isLoading = progressLoading || dashboardLoading;
  const hasError = progressError || dashboardError || activityError;

  // Handle refresh
  const handleRefresh = () => {
    refetchProgress();
    refetchDashboard();
  };

  // Handle quick actions
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
      default:
        break;
    }
  };

  // Format activity timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Recently';
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${Math.floor(diffHours / 24)} days ago`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <p className="text-lg font-semibold">Error loading dashboard</p>
          <p className="text-sm">{progressError?.message || dashboardError?.message || activityError?.message}</p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <main 
      role="main" 
      aria-label="User dashboard"
      className="user-dashboard-container min-h-screen bg-gray-50 p-4 lg:p-8"
      data-testid={window.innerWidth < 768 ? 'mobile-dashboard' : 'desktop-dashboard'}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div data-testid="user-profile-section">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {dashboardData?.user.username}!
            </h1>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>Level {progressData?.level || 1}</span>
              <span>•</span>
              <span>${progressData?.money?.toLocaleString() || 0}</span>
              <span>•</span>
              <span>{progressData?.totalHorses || 0} Horses</span>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            className="mt-4 lg:mt-0 flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Progress Section */}
        <div className="bg-white rounded-lg shadow-md p-6" data-testid="progress-stats">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
            Your Progress
          </h2>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Level {progressData?.level || 1} Progress</span>
                <span>{progressData?.xp || 0} / {progressData?.xpToNextLevel || 100} XP</span>
              </div>
              <div 
                role="progressbar" 
                aria-label="Level progress"
                aria-valuenow={progressPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                className="w-full bg-gray-200 rounded-full h-3"
              >
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{progressData?.totalCompetitions || 0}</div>
                <div className="text-sm text-gray-600">Competitions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{progressData?.totalWins || 0}</div>
                <div className="text-sm text-gray-600">Wins</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{progressData?.winRate || 0}%</div>
                <div className="text-sm text-gray-600">Win Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{progressData?.totalHorses || 0}</div>
                <div className="text-sm text-gray-600">Horses</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6" data-testid="quick-actions-section">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleQuickAction('stable')}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Visit stable"
            >
              <div className="flex items-center">
                <Home className="w-6 h-6 text-blue-600 mr-3" />
                <span className="font-medium">Visit Stable</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={() => handleQuickAction('training')}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Train horses"
            >
              <div className="flex items-center">
                <Dumbbell className="w-6 h-6 text-green-600 mr-3" />
                <span className="font-medium">Train Horses</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={() => handleQuickAction('competition')}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Enter competition"
            >
              <div className="flex items-center">
                <Trophy className="w-6 h-6 text-yellow-600 mr-3" />
                <span className="font-medium">Enter Competition</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Achievement Section */}
        <div className="bg-white rounded-lg shadow-md p-6" data-testid="achievement-section">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Award className="w-5 h-5 mr-2 text-yellow-600" />
            Recent Achievements
          </h2>
          <div className="space-y-3">
            {dashboardData?.recentShows?.slice(0, 3).map((show) => (
              <div key={show.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <Star className="w-5 h-5 text-yellow-500 mr-3" />
                  <div>
                    <div className="font-medium">{show.name}</div>
                    <div className="text-sm text-gray-600">
                      {show.placement === 1 ? '1st Place' : 
                       show.placement === 2 ? '2nd Place' : 
                       show.placement === 3 ? '3rd Place' : `${show.placement}th Place`}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(show.date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-lg shadow-md p-6" data-testid="activity-feed">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-gray-600" />
            Recent Activity
          </h2>
          
          <div className="space-y-3">
            {activityData?.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 border-l-4 border-blue-200 bg-blue-50 rounded-r-lg" data-testid="activity-item">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{activity.description}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {formatTimestamp(activity.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {activityData && activityData.length >= 10 && (
            <button
              onClick={() => setActivityPage(prev => prev + 1)}
              className="w-full mt-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
              aria-label="Load more activity"
            >
              Load More
            </button>
          )}
        </div>
      </div>
    </main>
  );
};

export default UserDashboard;
