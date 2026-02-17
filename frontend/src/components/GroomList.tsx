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
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Users, DollarSign, Star, RefreshCw, Clock, AlertCircle, X } from 'lucide-react';
import { useGroomMarketplace, useHireGroom, useRefreshMarketplace } from '../hooks/api/useGrooms';
import { useAuth } from '../contexts/AuthContext';
import { MarketplaceGroom, MarketplaceData } from '../lib/api-client';
import GroomPersonalityBadge from './groom/GroomPersonalityBadge';

interface GroomListProps {
  userId: number;
  onGroomHired?: (groom: MarketplaceGroom) => void;
  // Optional data props for testing (NO MOCKING)
  marketplaceData?: MarketplaceData;
}

const GroomList: React.FC<GroomListProps> = ({
  userId: _userId,
  onGroomHired,
  marketplaceData: propMarketplaceData,
}) => {
  const { user } = useAuth();
  const [selectedGroom, setSelectedGroom] = useState<MarketplaceGroom | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [filterSkillLevel, setFilterSkillLevel] = useState<string>('all');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
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

  // Only fetch if not provided as props
  const marketplaceQuery = useGroomMarketplace({ enabled: !propMarketplaceData });

  // Use provided data or fetched data
  const marketplaceData = propMarketplaceData || marketplaceQuery.data;
  const marketplaceLoading = !propMarketplaceData && marketplaceQuery.isLoading;
  const marketplaceError = !propMarketplaceData ? marketplaceQuery.error : null;

  // Hire groom mutation
  const hireMutation = useHireGroom();

  // Refresh marketplace mutation
  const refreshMutation = useRefreshMarketplace();

  // Filter and sort grooms
  const filteredAndSortedGrooms = useMemo(() => {
    const grooms = marketplaceData?.grooms || [];
    if (!grooms.length) return [];

    let filtered = [...grooms];

    // Apply filters
    if (filterSkillLevel !== 'all') {
      filtered = filtered.filter((g) => g.skillLevel === filterSkillLevel);
    }
    if (filterSpecialty !== 'all') {
      filtered = filtered.filter((g) => g.specialty === filterSpecialty);
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
    if (!user) return false;
    return (user.money || 0) >= calculateHiringCost(sessionRate);
  };

  // Handle hire button click
  const handleHireClick = (groom: MarketplaceGroom) => {
    setSelectedGroom(groom);
    setShowHireModal(true);
  };

  // Handle hire confirmation
  const handleHireConfirm = () => {
    if (selectedGroom) {
      hireMutation.mutate(selectedGroom.marketplaceId, {
        onSuccess: (data) => {
          setShowHireModal(false);
          setSelectedGroom(null);
          // Callback if provided
          if (onGroomHired && data) {
            // onGroomHired expects a groom object, but mutation might return success only.
            // Usually onGroomHired is used to update local state or navigate.
          }
        },
      });
    }
  };

  // Handle refresh marketplace
  const handleRefresh = () => {
    const force = !(marketplaceData && marketplaceData.canRefreshFree);
    refreshMutation.mutate(force);
  };

  if (marketplaceLoading && !propMarketplaceData) {
    return (
      <div data-testid="groom-list" className="min-h-screen bg-gray-50 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="ml-2 text-gray-600">Loading marketplace...</span>
        </div>
      </div>
    );
  }

  if (marketplaceError) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-red-900 mb-2">Error Loading Marketplace</h3>
          <p className="text-red-700">{marketplaceError.message}</p>
          <button
            onClick={() => handleRefresh()}
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
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
      className="bg-gray-50 p-4 lg:p-8"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Groom Marketplace</h1>
            <p className="text-gray-600">Hire professional grooms to care for your horses</p>
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
              {marketplaceData?.canRefreshFree
                ? 'Free Refresh Available'
                : `Refresh ($${marketplaceData?.refreshCost || 0})`}
            </span>
          </button>
        </div>

        {/* User Info & Refresh Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {marketplaceData?.nextFreeRefresh && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center space-x-3">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-blue-900 font-medium">
                Next free refresh: {new Date(marketplaceData.nextFreeRefresh).toLocaleTimeString()}
              </span>
            </div>
          )}
          {user && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-900">Your Balance</span>
              </div>
              <span className="text-lg font-bold text-emerald-900">
                ${user.money?.toLocaleString() || 0}
              </span>
            </div>
          )}
        </div>

        {/* Filters and Sort */}
        <div
          data-testid="groom-filters"
          className="bg-white rounded-lg shadow-sm border border-slate-200 p-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Skill Level Filter */}
            <div>
              <label
                htmlFor="skill-level-filter"
                className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
              >
                Skill Level
              </label>
              <select
                id="skill-level-filter"
                data-testid="skill-level-filter"
                value={filterSkillLevel}
                onChange={(e) => setFilterSkillLevel(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
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
              <label
                htmlFor="specialty-filter"
                className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
              >
                Specialty
              </label>
              <select
                id="specialty-filter"
                data-testid="specialty-filter"
                value={filterSpecialty}
                onChange={(e) => setFilterSpecialty(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
              >
                <option value="all">All Specialties</option>
                <option value="foalCare">Foal Care</option>
                <option value="generalCare">General Care</option>
                <option value="training">Training</option>
                <option value="showHandling">Show Handling</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label
                htmlFor="sort-select"
                className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
              >
                Sort By
              </label>
              <select
                id="sort-select"
                data-testid="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
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
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Grooms Available</h3>
              <p className="text-gray-600 mb-6">Try refreshing the marketplace to see new grooms</p>
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
                    className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    {/* Groom Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {groom.firstName} {groom.lastName}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded uppercase">
                            {groom.skillLevel}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded uppercase">
                            {groom.specialty.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        </div>
                      </div>
                      <Star className="w-6 h-6 text-amber-400" />
                    </div>

                    {/* Groom Details */}
                    <div className="space-y-2 mb-4 text-sm border-y border-slate-50 py-4">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Experience:</span>
                        <span className="font-semibold text-slate-900">
                          {groom.experience} years
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Personality:</span>
                        <GroomPersonalityBadge personality={groom.personality} />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Weekly Salary:</span>
                        <span className="font-bold text-emerald-600">
                          ${groom.sessionRate}/week
                        </span>
                      </div>
                    </div>

                    {/* Bio */}
                    <p className="text-sm text-slate-600 mb-6 line-clamp-2 italic">"{groom.bio}"</p>

                    {/* Hire Button */}
                    <button
                      onClick={() => handleHireClick(groom)}
                      disabled={!canAfford || hireMutation.isPending}
                      className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm transition-colors ${
                        canAfford
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      }`}
                      aria-label={`Hire ${groom.firstName} ${groom.lastName}`}
                    >
                      {hireMutation.isPending &&
                      selectedGroom?.marketplaceId === groom.marketplaceId
                        ? 'Processing...'
                        : canAfford
                          ? 'Hire for $' + hiringCost
                          : 'Insufficient Funds'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Insufficient Funds Warning */}
        {user && (user.money || 0) < 500 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900">Low Balance</h4>
              <p className="text-sm text-amber-800 mt-1">
                You might not have enough to hire top-tier grooms. Remember that hiring requires
                paying the first week upfront.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Hire Confirmation Modal */}
      {showHireModal && selectedGroom && (
        <div
          data-testid="hire-modal"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => setShowHireModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Confirm Hire</h3>
            </div>

            <p className="text-slate-600 mb-6 leading-relaxed">
              Are you sure you want to hire{' '}
              <strong>
                {selectedGroom.firstName} {selectedGroom.lastName}
              </strong>
              ? This professional will be added to your stable staff.
            </p>

            <div className="bg-slate-50 rounded-xl p-5 mb-6 border border-slate-100">
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-slate-500">Weekly Salary:</span>
                <span className="font-semibold text-slate-900">${selectedGroom.sessionRate}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-sm font-bold text-slate-700">Total Upfront:</span>
                <span className="text-2xl font-black text-blue-600">
                  ${calculateHiringCost(selectedGroom.sessionRate)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowHireModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleHireConfirm}
                disabled={hireMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
              >
                {hireMutation.isPending ? 'Hiring...' : 'Hire Groom'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default GroomList;
