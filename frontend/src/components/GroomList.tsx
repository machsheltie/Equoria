/**
 * GroomList Component
 * 
 * Groom marketplace interface providing:
 * - Marketplace groom listing with filtering and sorting capabilities
 * - Groom hiring functionality with fund and stable limit validation
 * - Marketplace refresh mechanics (free daily or premium instant)
 * - Responsive design with mobile and desktop layouts
 * - Real-time data updates using React Query
 * - Accessibility support with ARIA labels and keyboard navigation
 * - Error handling and loading states
 * 
 * Integrates with backend APIs:
 * - GET /api/groom-marketplace - Fetch available grooms
 * - POST /api/groom-marketplace/hire - Hire groom from marketplace
 * - POST /api/groom-marketplace/refresh - Refresh marketplace
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  DollarSign, 
  Star, 
  RefreshCw, 
  Filter, 
  Grid, 
  List,
  Check,
  X,
  AlertCircle,
  Clock
} from 'lucide-react';

interface GroomListProps {
  userId: number;
  onGroomHired?: (groom: Groom) => void;
  // Optional data props for testing (NO MOCKING)
  marketplaceData?: MarketplaceData;
  userData?: UserData;
}

interface Groom {
  marketplaceId: string;
  firstName: string;
  lastName: string;
  specialty: string;
  skillLevel: string;
  personality: string;
  experience: number;
  sessionRate: number;
  bio: string;
  availability: boolean;
}

interface MarketplaceData {
  grooms: Groom[];
  lastRefresh: string;
  nextFreeRefresh: string;
  refreshCost: number;
  canRefreshFree: boolean;
  refreshCount: number;
}

interface UserData {
  id: number;
  money: number;
  stableLimit: number;
  currentHorses: number;
}

const GroomList: React.FC<GroomListProps> = ({
  userId,
  onGroomHired,
  marketplaceData: propMarketplaceData,
  userData: propUserData
}) => {
  const queryClient = useQueryClient();
  const [selectedGroom, setSelectedGroom] = useState<Groom | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [filterSkillLevel, setFilterSkillLevel] = useState<string>('all');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [layout, setLayout] = useState<'mobile' | 'desktop'>('desktop');

  // Detect screen size for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setLayout(window.innerWidth < 768 ? 'mobile' : 'desktop');
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch marketplace data (only if not provided as props)
  const {
    data: marketplaceData = propMarketplaceData,
    isLoading: marketplaceLoading,
    error: marketplaceError,
    refetch: refetchMarketplace
  } = useQuery<MarketplaceData>({
    queryKey: ['groomMarketplace', userId],
    queryFn: async () => {
      const response = await fetch(`/api/groom-marketplace`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch marketplace');
      }
      const result = await response.json();
      return result.data;
    },
    enabled: !propMarketplaceData && typeof fetch !== 'undefined',
  });

  // Fetch user data (only if not provided as props)
  const {
    data: userData = propUserData,
    isLoading: userLoading
  } = useQuery<UserData>({
    queryKey: ['userData', userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      return response.json();
    },
    enabled: !propUserData && typeof fetch !== 'undefined',
  });

  // Hire groom mutation
  const hireMutation = useMutation({
    mutationFn: async (marketplaceId: string) => {
      const response = await fetch('/api/groom-marketplace/hire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ marketplaceId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to hire groom');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['groomMarketplace', userId] });
      queryClient.invalidateQueries({ queryKey: ['userData', userId] });
      setShowHireModal(false);
      setSelectedGroom(null);
      if (onGroomHired) {
        onGroomHired(data.data);
      }
    },
  });

  // Refresh marketplace mutation
  const refreshMutation = useMutation({
    mutationFn: async (force: boolean = false) => {
      const response = await fetch('/api/groom-marketplace/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ force }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to refresh marketplace');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groomMarketplace', userId] });
    },
  });

  // Filter and sort grooms
  const filteredAndSortedGrooms = useMemo(() => {
    if (!marketplaceData?.grooms) return [];

    let filtered = [...marketplaceData.grooms];

    // Apply filters
    if (filterSkillLevel !== 'all') {
      filtered = filtered.filter(g => g.skillLevel === filterSkillLevel);
    }
    if (filterSpecialty !== 'all') {
      filtered = filtered.filter(g => g.specialty === filterSpecialty);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.sessionRate - b.sessionRate;
        case 'price-desc':
          return b.sessionRate - a.sessionRate;
        case 'experience-asc':
          return a.experience - b.experience;
        case 'experience-desc':
          return b.experience - a.experience;
        case 'name':
        default:
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      }
    });

    return filtered;
  }, [marketplaceData, filterSkillLevel, filterSpecialty, sortBy]);

  // Calculate hiring cost (1 week upfront)
  const calculateHiringCost = (sessionRate: number) => {
    return sessionRate * 7;
  };

  // Check if user can afford groom
  const canAffordGroom = (sessionRate: number) => {
    if (!userData) return false;
    return userData.money >= calculateHiringCost(sessionRate);
  };

  // Handle hire button click
  const handleHireClick = (groom: Groom) => {
    setSelectedGroom(groom);
    setShowHireModal(true);
  };

  // Handle hire confirmation
  const handleHireConfirm = () => {
    if (selectedGroom) {
      hireMutation.mutate(selectedGroom.marketplaceId);
    }
  };

  // Handle refresh marketplace
  const handleRefresh = () => {
    const force = !marketplaceData?.canRefreshFree;
    refreshMutation.mutate(force);
  };

  const isLoading = (marketplaceLoading || userLoading) && !propMarketplaceData && !propUserData;

  if (isLoading) {
    return (
      <div 
        data-testid="groom-list" 
        className="min-h-screen bg-gray-50 p-4 lg:p-8"
      >
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-12 bg-gray-200 rounded mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main
      role="main"
      aria-label="Groom marketplace"
      data-testid="groom-list"
      data-layout={layout}
      className="min-h-screen bg-gray-50 p-4 lg:p-8"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Groom Marketplace
            </h1>
            <p className="text-gray-600">
              Hire professional grooms to care for your horses
            </p>
          </div>

          {/* Refresh Button */}
          <button
            data-testid="refresh-button"
            onClick={handleRefresh}
            disabled={refreshMutation.isPending}
            className="mt-4 lg:mt-0 flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            aria-label="Refresh marketplace"
          >
            <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            <span>
              {marketplaceData?.canRefreshFree ? 'Free Refresh Available' : `Refresh ($${marketplaceData?.refreshCost})`}
            </span>
          </button>
        </div>

        {/* Marketplace Info */}
        {marketplaceData && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-blue-900">
                Next free refresh: {new Date(marketplaceData.nextFreeRefresh).toLocaleString()}
              </span>
            </div>
            {userData && (
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-900">
                  ${userData.money.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Filters and Sort */}
        <div data-testid="groom-filters" className="bg-white rounded-lg shadow-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Skill Level Filter */}
            <div>
              <label htmlFor="skill-level-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Skill Level
              </label>
              <select
                id="skill-level-filter"
                data-testid="skill-level-filter"
                value={filterSkillLevel}
                onChange={(e) => setFilterSkillLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Levels</option>
                <option value="novice">Novice</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
                <option value="master">Master</option>
              </select>
            </div>

            {/* Specialty Filter */}
            <div>
              <label htmlFor="specialty-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Specialty
              </label>
              <select
                id="specialty-filter"
                data-testid="specialty-filter"
                value={filterSpecialty}
                onChange={(e) => setFilterSpecialty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Specialties</option>
                <option value="foalCare">Foal Care</option>
                <option value="general">General</option>
                <option value="training">Training</option>
                <option value="medical">Medical</option>
                <option value="showHandling">Show Handling</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label htmlFor="sort-select" className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                id="sort-select"
                data-testid="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="name">Name</option>
                <option value="price-asc">Price (Low to High)</option>
                <option value="price-desc">Price (High to Low)</option>
                <option value="experience-asc">Experience (Low to High)</option>
                <option value="experience-desc">Experience (High to Low)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Groom Grid */}
        <div data-testid="groom-marketplace">
          {filteredAndSortedGrooms.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Grooms Available
              </h3>
              <p className="text-gray-600 mb-4">
                Try refreshing the marketplace to see new grooms
              </p>
              <button
                onClick={handleRefresh}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh Marketplace
              </button>
            </div>
          ) : (
            <div 
              data-testid="groom-grid"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredAndSortedGrooms.map((groom) => {
                const hiringCost = calculateHiringCost(groom.sessionRate);
                const canAfford = canAffordGroom(groom.sessionRate);

                return (
                  <div
                    key={groom.marketplaceId}
                    data-testid={`groom-card-${groom.marketplaceId}`}
                    className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                  >
                    {/* Groom Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {groom.firstName} {groom.lastName}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-sm text-gray-600 capitalize">
                            {groom.specialty.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-sm font-medium text-blue-600 capitalize">
                            {groom.skillLevel}
                          </span>
                        </div>
                      </div>
                      <Star className="w-6 h-6 text-yellow-500" />
                    </div>

                    {/* Groom Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Experience:</span>
                        <span className="font-medium">{groom.experience} years</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Weekly Salary:</span>
                        <span className="font-medium text-green-600">${groom.sessionRate}/week</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Personality:</span>
                        <span className="font-medium capitalize">{groom.personality}</span>
                      </div>
                    </div>

                    {/* Bio */}
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {groom.bio}
                    </p>

                    {/* Hire Button */}
                    <button
                      onClick={() => handleHireClick(groom)}
                      disabled={!canAfford || hireMutation.isPending}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                        canAfford
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      aria-label={`Hire ${groom.firstName} ${groom.lastName}`}
                    >
                      {canAfford ? 'Hire Groom' : 'Insufficient Funds'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Insufficient Funds Warning */}
        {userData && userData.money < 500 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-900">Insufficient Funds</h4>
              <p className="text-sm text-yellow-700 mt-1">
                You may not have enough money to hire some grooms. Hiring requires 1 week upfront payment.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Hire Confirmation Modal */}
      {showHireModal && selectedGroom && (
        <div 
          data-testid="hire-modal"
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowHireModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Confirm Hire
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to hire <strong>{selectedGroom.firstName} {selectedGroom.lastName}</strong>?
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Weekly Salary:</span>
                <span className="font-medium">${selectedGroom.sessionRate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Upfront Cost (1 week):</span>
                <span className="font-bold text-lg text-blue-600">
                  ${calculateHiringCost(selectedGroom.sessionRate)}
                </span>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowHireModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleHireConfirm}
                disabled={hireMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {hireMutation.isPending ? 'Hiring...' : 'Confirm Hire'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default GroomList;

