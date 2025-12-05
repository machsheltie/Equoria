/**
 * Horse List View Component
 * 
 * Comprehensive horse list interface with sorting, filtering, and pagination.
 * Features responsive design for mobile and desktop with real-time data updates.
 * 
 * Features:
 * - Sortable table view for desktop
 * - Card view for mobile devices
 * - Advanced filtering by breed, age, level
 * - Search functionality
 * - Pagination for large collections
 * - Quick action buttons (view, train, compete)
 * - Real-time data updates with React Query
 * - Accessibility support with ARIA labels
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  Eye,
  Dumbbell,
  Trophy,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List
} from 'lucide-react';

// Types
interface Horse {
  id: number;
  name: string;
  breed: string;
  age: number;
  level: number;
  health: number;
  xp: number;
  imageUrl?: string; // Optional horse thumbnail/avatar image URL
  stats: {
    speed: number;
    stamina: number;
    agility: number;
    balance: number;
    precision: number;
    intelligence: number;
    boldness: number;
    flexibility: number;
    obedience: number;
    focus: number;
  };
  disciplineScores: Record<string, number>;
  trainingCooldown?: string;
}

interface HorseListViewProps {
  userId: number;
  // Optional horses data prop (if provided, component won't fetch)
  horses?: Horse[];
}

interface SortConfig {
  key: keyof Horse | null;
  direction: 'asc' | 'desc';
}

interface FilterConfig {
  breed: string;
  ageMin: number;
  ageMax: number;
  levelMin: number;
  levelMax: number;
  search: string;
}

type ViewMode = 'grid' | 'list';

// API function to fetch horses
const fetchHorses = async (userId: number): Promise<Horse[]> => {
  const response = await fetch(`/api/horses?userId=${userId}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch horses');
  }

  const data = await response.json();
  return data.data || [];
};

const HorseListView: React.FC<HorseListViewProps> = ({ userId, horses: propHorses }) => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState<FilterConfig>({
    breed: '',
    ageMin: 0,
    ageMax: 30,
    levelMin: 1,
    levelMax: 100,
    search: '',
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Load from localStorage, default to 'list'
    const saved = localStorage.getItem('horseListViewMode');
    return (saved as ViewMode) || 'list';
  });

  const itemsPerPage = 10;

  // React Query for data fetching (only if horses not provided as props)
  const {
    data: horses = propHorses || [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['horses', userId],
    queryFn: () => fetchHorses(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    enabled: !propHorses && typeof fetch !== 'undefined', // Only fetch if horses not provided and fetch is available
  });

  // Handle window resize for responsive design
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save viewMode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('horseListViewMode', viewMode);
  }, [viewMode]);

  // Toggle view mode
  const toggleView = () => {
    setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'));
  };

  // Filter and sort horses
  const filteredAndSortedHorses = useMemo(() => {
    let filtered = horses.filter((horse) => {
      const matchesBreed = !filters.breed || horse.breed.toLowerCase().includes(filters.breed.toLowerCase());
      const matchesAge = horse.age >= filters.ageMin && horse.age <= filters.ageMax;
      const matchesLevel = horse.level >= filters.levelMin && horse.level <= filters.levelMax;
      const matchesSearch = !filters.search ||
        horse.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        horse.breed.toLowerCase().includes(filters.search.toLowerCase());

      return matchesBreed && matchesAge && matchesLevel && matchesSearch;
    });

    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [horses, filters, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedHorses.length / itemsPerPage);
  const paginatedHorses = filteredAndSortedHorses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Sorting handler
  const handleSort = (key: keyof Horse) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Action handlers
  const handleViewDetails = (horseId: number) => {
    navigate(`/horses/${horseId}`);
  };

  const handleTrain = (horseId: number) => {
    navigate(`/training/${horseId}`);
  };

  const handleCompete = (horseId: number) => {
    navigate(`/competition/enter/${horseId}`);
  };

  // Loading state (only show if not using prop horses)
  if (isLoading && !propHorses) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg">Loading horses...</span>
      </div>
    );
  }

  // Error state (only show if not using prop horses)
  if (error && !propHorses) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <p className="text-lg font-semibold">Error loading horses</p>
          <p className="text-sm">{error.message}</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <main className="horse-list-container p-6" aria-label="Horse list">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Horses</h1>
          <p className="text-gray-600">Manage your stable of {horses.length} horses</p>
        </div>

        {/* View Toggle Button (Desktop only) */}
        {!isMobile && (
          <button
            onClick={toggleView}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            aria-label={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
            title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
          >
            {viewMode === 'grid' ? (
              <>
                <List className="w-5 h-5" />
                <span className="text-sm">List View</span>
              </>
            ) : (
              <>
                <LayoutGrid className="w-5 h-5" />
                <span className="text-sm">Grid View</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Filters and Search */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search horses..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Breed Filter */}
          <select
            aria-label="Filter by breed"
            value={filters.breed}
            onChange={(e) => setFilters(prev => ({ ...prev, breed: e.target.value }))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Breeds</option>
            <option value="Arabian">Arabian</option>
            <option value="Thoroughbred">Thoroughbred</option>
            <option value="Quarter Horse">Quarter Horse</option>
            <option value="Friesian">Friesian</option>
          </select>

          {/* Age Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="age-min" className="text-sm text-gray-600">Age:</label>
            <input
              id="age-min"
              type="number"
              min="0"
              max="30"
              value={filters.ageMin}
              onChange={(e) => setFilters(prev => ({ ...prev, ageMin: parseInt(e.target.value) || 0 }))}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
              aria-label="Filter by age minimum"
            />
            <span className="text-gray-400">-</span>
            <input
              type="number"
              min="0"
              max="30"
              value={filters.ageMax}
              onChange={(e) => setFilters(prev => ({ ...prev, ageMax: parseInt(e.target.value) || 30 }))}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
              aria-label="Filter by age maximum"
            />
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="level-min" className="text-sm text-gray-600">Level:</label>
            <input
              id="level-min"
              type="number"
              min="1"
              max="100"
              value={filters.levelMin}
              onChange={(e) => setFilters(prev => ({ ...prev, levelMin: parseInt(e.target.value) || 1 }))}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
              aria-label="Filter by level minimum"
            />
            <span className="text-gray-400">-</span>
            <input
              type="number"
              min="1"
              max="100"
              value={filters.levelMax}
              onChange={(e) => setFilters(prev => ({ ...prev, levelMax: parseInt(e.target.value) || 100 }))}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
              aria-label="Filter by level maximum"
            />
          </div>
        </div>
      </div>

      {/* Horse List */}
      {isMobile ? (
        // Mobile Card View
        <div data-testid="mobile-layout" className="space-y-4">
          <div data-testid="horse-cards-container">
            {paginatedHorses.map((horse) => (
              <div key={horse.id} className="bg-white rounded-lg shadow-md border overflow-hidden">
                {/* Horse Thumbnail */}
                <img
                  src={horse.imageUrl || '/images/horse-placeholder.png'}
                  alt={horse.name}
                  className="w-full h-32 object-cover"
                />

                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{horse.name}</h3>
                      <p className="text-sm text-gray-600">{horse.breed}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Level {horse.level}</p>
                      <p className="text-xs text-gray-500">{horse.age} years old</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewDetails(horse.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        aria-label="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleTrain(horse.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        aria-label="Train"
                      >
                        <Dumbbell className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCompete(horse.id)}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        aria-label="Compete"
                      >
                        <Trophy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-xs text-gray-500">
                      Health: {horse.health}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        // Desktop Grid View
        <div data-testid="desktop-grid-layout" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {paginatedHorses.map((horse) => (
            <div key={horse.id} className="bg-white rounded-lg shadow-md border hover:shadow-lg transition-shadow overflow-hidden">
              {/* Horse Thumbnail */}
              <img
                src={horse.imageUrl || '/images/horse-placeholder.png'}
                alt={horse.name}
                className="w-full h-32 object-cover rounded-t-lg"
              />

              <div className="p-4">
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{horse.name}</h3>
                  <p className="text-sm text-gray-600">{horse.breed}</p>
                </div>

                <div className="space-y-1 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Age:</span>
                    <span className="font-medium">{horse.age} years</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Level:</span>
                    <span className="font-medium">{horse.level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Health:</span>
                    <span className="font-medium">{horse.health}%</span>
                  </div>
                </div>

                <div className="flex justify-between border-t pt-3">
                  <button
                    onClick={() => handleViewDetails(horse.id)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    aria-label="View details"
                    title="View details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleTrain(horse.id)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    aria-label="Train"
                    title="Train"
                  >
                    <Dumbbell className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCompete(horse.id)}
                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    aria-label="Compete"
                    title="Compete"
                  >
                    <Trophy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Desktop Table View
        <div data-testid="desktop-layout" className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200" aria-label="Horses table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Image
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                  aria-sort={sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <div className="flex items-center">
                    Name
                    {sortConfig.key === 'name' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('breed')}
                  aria-sort={sortConfig.key === 'breed' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <div className="flex items-center">
                    Breed
                    {sortConfig.key === 'breed' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('age')}
                  aria-sort={sortConfig.key === 'age' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <div className="flex items-center">
                    Age
                    {sortConfig.key === 'age' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('level')}
                  aria-sort={sortConfig.key === 'level' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <div className="flex items-center">
                    Level
                    {sortConfig.key === 'level' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Health
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedHorses.map((horse) => (
                <tr key={horse.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <img
                      src={horse.imageUrl || '/images/horse-placeholder.png'}
                      alt={horse.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{horse.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{horse.breed}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{horse.age} years</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{horse.level}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{horse.health}%</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewDetails(horse.id)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded"
                        aria-label="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleTrain(horse.id)}
                        className="text-green-600 hover:text-green-900 p-1 rounded"
                        aria-label="Train"
                      >
                        <Dumbbell className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCompete(horse.id)}
                        className="text-purple-600 hover:text-purple-900 p-1 rounded"
                        aria-label="Compete"
                      >
                        <Trophy className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * itemsPerPage, filteredAndSortedHorses.length)}
                </span>{' '}
                of <span className="font-medium">{filteredAndSortedHorses.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === currentPage
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </nav>
            </div>
          </div>
        </nav>
      )}

      {/* Empty state */}
      {filteredAndSortedHorses.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No horses found matching your criteria.</p>
          <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or search terms.</p>
        </div>
      )}
    </main>
  );
};

export default HorseListView;
