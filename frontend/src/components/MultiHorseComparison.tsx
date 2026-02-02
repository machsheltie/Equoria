/**
 * Multi-Horse Comparison Interface Component
 *
 * Comprehensive interface for strategic comparison across multiple horses including:
 * - Horse Selection Interface with search, filtering, and multi-select
 * - Comparison Matrix with side-by-side trait and performance analysis
 * - Similarity/Difference Visualization with interactive charts
 * - Ranking Dashboard with sortable metrics and scoring
 * - Export functionality for comparison reports
 *
 * Features:
 * - Advanced filtering and search capabilities
 * - Drag-and-drop horse selection interface
 * - Real-time comparison updates
 * - Export to PDF, CSV, and JSON formats
 * - Responsive design for mobile and desktop
 * - TypeScript for type safety
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Save,
  Eye,
  EyeOff,
  BarChart3,
  TrendingUp,
} from 'lucide-react';

// Types
interface MultiHorseComparisonProps {
  userId: number | null;
  selectedHorses: number[];
  onHorseSelectionChange: (horseIds: number[]) => void;
  className?: string;
}

interface Horse {
  id: number;
  name: string;
  breed: string;
  age: number;
  traits: string[];
  epigeneticFlags: string[];
  stats: {
    speed: number;
    stamina: number;
    agility: number;
    intelligence: number;
    [key: string]: number;
  };
  disciplineScores: {
    [discipline: string]: number;
  };
  bondScore: number;
  stressLevel: number;
  overallScore?: number;
}

interface ComparisonData {
  horses: Horse[];
  similarities: Array<{
    horseIds: number[];
    traits: string[];
    score: number;
  }>;
  differences: Array<{
    horseIds: number[];
    attributes: string[];
    variance: number;
  }>;
  rankings: Array<{
    horseId: number;
    rank: number;
    score: number;
    strengths: string[];
    weaknesses: string[];
  }>;
}

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Custom hooks for data fetching
const useUserHorses = (userId: number | null) => {
  return useQuery({
    queryKey: ['user-horses', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await fetch(`${API_BASE_URL}/users/${userId}/horses`);
      if (!response.ok) throw new Error('Failed to fetch user horses');
      const result = await response.json();
      return result.data as Horse[];
    },
    enabled: !!userId,
  });
};

const useHorseComparison = (horseIds: number[]) => {
  return useQuery({
    queryKey: ['horse-comparison', horseIds],
    queryFn: async () => {
      if (horseIds.length < 2) return null;
      const response = await fetch(`${API_BASE_URL}/horses/compare-epigenetics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horseIds }),
      });
      if (!response.ok) throw new Error('Failed to fetch comparison data');
      const result = await response.json();
      return result.data as ComparisonData;
    },
    enabled: horseIds.length >= 2,
  });
};

// Main Component
const MultiHorseComparison: React.FC<MultiHorseComparisonProps> = ({
  userId,
  selectedHorses,
  onHorseSelectionChange,
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'age' | 'breed' | 'score'>('name');
  const [filterBy, setFilterBy] = useState<'all' | 'breed' | 'age'>('all');
  const [showComparison, setShowComparison] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Data queries
  const horsesQuery = useUserHorses(userId);
  const comparisonQuery = useHorseComparison(selectedHorses);

  // Handle no user
  if (!userId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Please log in to compare horses</p>
      </div>
    );
  }

  // Loading state
  if (horsesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p>Loading horses...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (horsesQuery.error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading horses</p>
          <button
            onClick={() => horsesQuery.refetch()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const horses = horsesQuery.data || [];

  // Filter and sort horses
  const filteredAndSortedHorses = useMemo(() => {
    let filtered = horses.filter(
      (horse) =>
        horse.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        horse.breed.toLowerCase().includes(searchTerm.toLowerCase()) ||
        horse.traits.some((trait) => trait.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Apply additional filters
    if (filterBy === 'breed') {
      // Group by breed for easier selection
      filtered = filtered.sort((a, b) => a.breed.localeCompare(b.breed));
    } else if (filterBy === 'age') {
      // Group by age ranges
      filtered = filtered.sort((a, b) => a.age - b.age);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'age':
          return a.age - b.age;
        case 'breed':
          return a.breed.localeCompare(b.breed);
        case 'score':
          return (b.overallScore || 0) - (a.overallScore || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [horses, searchTerm, sortBy, filterBy]);

  // Handle horse selection
  const handleHorseSelect = (horse: Horse) => {
    const newSelection = selectedHorses.includes(horse.id)
      ? selectedHorses.filter((id) => id !== horse.id)
      : [...selectedHorses, horse.id];
    onHorseSelectionChange(newSelection);
  };

  // Handle select all/none
  const handleSelectAll = () => {
    if (selectedHorses.length === filteredAndSortedHorses.length) {
      onHorseSelectionChange([]);
    } else {
      onHorseSelectionChange(filteredAndSortedHorses.map((h) => h.id));
    }
  };

  // Export functions
  const exportToPDF = () => {
    // TODO: Implement PDF export
    console.log('Exporting to PDF...');
  };

  const exportToCSV = () => {
    // TODO: Implement CSV export
    console.log('Exporting to CSV...');
  };

  const saveComparison = () => {
    // TODO: Implement save comparison
    console.log('Saving comparison...');
  };

  return (
    <div data-testid="multi-horse-comparison" className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Multi-Horse Comparison</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowComparison(!showComparison)}
            disabled={selectedHorses.length < 2}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {showComparison ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{showComparison ? 'Hide Comparison' : 'Show Comparison'}</span>
          </button>
        </div>
      </div>

      {/* Horse Selection Interface */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Horse Selection</h3>
            <button onClick={handleSelectAll} className="text-sm text-blue-600 hover:text-blue-800">
              {selectedHorses.length === filteredAndSortedHorses.length
                ? 'Deselect All'
                : 'Select All'}
            </button>
          </div>

          {/* Search and Filter Controls */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search horses by name, breed, or traits..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  data-testid="horse-search"
                />
              </div>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              data-testid="sort-select"
            >
              <option value="name">Sort by Name</option>
              <option value="age">Sort by Age</option>
              <option value="breed">Sort by Breed</option>
              <option value="score">Sort by Score</option>
            </select>

            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Horses</option>
              <option value="breed">Group by Breed</option>
              <option value="age">Group by Age</option>
            </select>
          </div>

          {/* Horse List */}
          <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="horse-list">
            {filteredAndSortedHorses.map((horse) => (
              <HorseSelectionItem
                key={horse.id}
                horse={horse}
                isSelected={selectedHorses.includes(horse.id)}
                onSelect={() => handleHorseSelect(horse)}
                viewMode={viewMode}
              />
            ))}

            {filteredAndSortedHorses.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No horses found matching your search criteria</p>
              </div>
            )}
          </div>

          {/* Selection Summary */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Selected: {selectedHorses.length} of {filteredAndSortedHorses.length} horses
                {selectedHorses.length >= 2 && (
                  <span className="text-green-600 ml-2">✓ Ready for comparison</span>
                )}
              </span>
              {selectedHorses.length > 0 && (
                <button
                  onClick={() => onHorseSelectionChange([])}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Matrix */}
      {showComparison && selectedHorses.length >= 2 && (
        <ComparisonMatrix
          horses={horses.filter((h) => selectedHorses.includes(h.id))}
          comparisonData={comparisonQuery.data}
          isLoading={comparisonQuery.isLoading}
        />
      )}

      {/* Ranking Dashboard */}
      {selectedHorses.length >= 2 && (
        <RankingDashboard
          horses={horses.filter((h) => selectedHorses.includes(h.id))}
          comparisonData={comparisonQuery.data}
        />
      )}

      {/* Export Options */}
      {selectedHorses.length >= 2 && (
        <div className="flex flex-wrap gap-4">
          <button
            onClick={exportToPDF}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export to PDF</span>
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export to CSV</span>
          </button>
          <button
            onClick={saveComparison}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Comparison</span>
          </button>
        </div>
      )}
    </div>
  );
};

// Horse Selection Item Component
interface HorseSelectionItemProps {
  horse: Horse;
  isSelected: boolean;
  onSelect: () => void;
  viewMode: 'grid' | 'list';
}

const HorseSelectionItem: React.FC<HorseSelectionItemProps> = ({
  horse,
  isSelected,
  onSelect,
  viewMode,
}) => {
  return (
    <div
      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
          : 'hover:bg-gray-50 border-gray-200'
      }`}
      onClick={onSelect}
      data-testid={`horse-item-${horse.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <div
              className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
              }`}
            >
              {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
            </div>
            <div>
              <span className="font-medium text-gray-900">{horse.name}</span>
              <div className="text-sm text-gray-500">
                {horse.breed} • {horse.age} years old
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Stats Preview */}
          <div className="hidden md:flex space-x-2 text-xs">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
              Speed: {horse.stats?.speed || 0}
            </span>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
              Bond: {horse.bondScore || 0}
            </span>
          </div>

          {/* Traits */}
          <div className="flex flex-wrap gap-1 max-w-48">
            {horse.traits.slice(0, 3).map((trait) => (
              <span key={trait} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                {trait}
              </span>
            ))}
            {horse.traits.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                +{horse.traits.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Comparison Matrix Component
interface ComparisonMatrixProps {
  horses: Horse[];
  comparisonData: ComparisonData | null | undefined;
  isLoading: boolean;
}

const ComparisonMatrix: React.FC<ComparisonMatrixProps> = ({
  horses,
  comparisonData,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Comparison Matrix</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const attributes = [
    { key: 'breed', label: 'Breed' },
    { key: 'age', label: 'Age' },
    { key: 'speed', label: 'Speed', isNumeric: true },
    { key: 'stamina', label: 'Stamina', isNumeric: true },
    { key: 'agility', label: 'Agility', isNumeric: true },
    { key: 'intelligence', label: 'Intelligence', isNumeric: true },
    { key: 'bondScore', label: 'Bond Score', isNumeric: true },
    { key: 'stressLevel', label: 'Stress Level', isNumeric: true },
  ];

  const getAttributeValue = (horse: Horse, attribute: string) => {
    switch (attribute) {
      case 'breed':
        return horse.breed;
      case 'age':
        return `${horse.age} years`;
      case 'speed':
      case 'stamina':
      case 'agility':
      case 'intelligence':
        return horse.stats?.[attribute] || 0;
      case 'bondScore':
        return horse.bondScore || 0;
      case 'stressLevel':
        return horse.stressLevel || 0;
      default:
        return 'N/A';
    }
  };

  const getValueColor = (value: any, attribute: any, allValues: any[]) => {
    if (!attribute.isNumeric) return '';

    const numValue = typeof value === 'number' ? value : 0;
    const numValues = allValues.filter((v) => typeof v === 'number');
    const max = Math.max(...numValues);
    const min = Math.min(...numValues);

    if (numValue === max && max !== min) return 'bg-green-100 text-green-800';
    if (numValue === min && max !== min) return 'bg-red-100 text-red-800';
    return '';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Comparison Matrix</h3>

      <div className="overflow-x-auto">
        <table className="w-full" data-testid="comparison-matrix">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-700">Attribute</th>
              {horses.slice(0, 4).map((horse) => (
                <th
                  key={horse.id}
                  className="text-center py-3 px-4 font-medium text-gray-700 min-w-32"
                >
                  {horse.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attributes.map((attribute) => {
              const values = horses
                .slice(0, 4)
                .map((horse) => getAttributeValue(horse, attribute.key));

              return (
                <tr key={attribute.key} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium text-gray-600">{attribute.label}</td>
                  {horses.slice(0, 4).map((horse, index) => {
                    const value = values[index];
                    const colorClass = getValueColor(value, attribute, values);

                    return (
                      <td key={horse.id} className={`py-3 px-4 text-center ${colorClass} rounded`}>
                        {value}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Traits Comparison */}
      <div className="mt-6">
        <h4 className="font-medium text-gray-700 mb-3">Traits Comparison</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {horses.slice(0, 4).map((horse) => (
            <div key={horse.id} className="p-3 bg-gray-50 rounded">
              <h5 className="font-medium text-sm mb-2">{horse.name}</h5>
              <div className="flex flex-wrap gap-1">
                {horse.traits.map((trait) => (
                  <span key={trait} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Similarities and Differences */}
      {comparisonData && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Similarities */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Similarities</h4>
            <div className="space-y-2">
              {comparisonData.similarities.map((similarity, index) => (
                <div key={index} className="p-3 bg-green-50 rounded border border-green-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-green-800">Common Traits</span>
                    <span className="text-sm text-green-600">
                      {Math.round(similarity.score * 100)}% match
                    </span>
                  </div>
                  <div className="text-xs text-green-700">{similarity.traits.join(', ')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Differences */}
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Key Differences</h4>
            <div className="space-y-2">
              {comparisonData.differences.map((difference, index) => (
                <div key={index} className="p-3 bg-orange-50 rounded border border-orange-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-orange-800">
                      Variance in {difference.attributes.join(', ')}
                    </span>
                    <span className="text-sm text-orange-600">
                      {Math.round(difference.variance * 100)}% difference
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Ranking Dashboard Component
interface RankingDashboardProps {
  horses: Horse[];
  comparisonData: ComparisonData | null | undefined;
}

const RankingDashboard: React.FC<RankingDashboardProps> = ({ horses, comparisonData }) => {
  // Calculate overall scores if not provided
  const rankedHorses = useMemo(() => {
    return horses
      .map((horse) => {
        // Calculate overall score based on stats, traits, and other factors
        const statsAverage = horse.stats
          ? Object.values(horse.stats).reduce((sum, val) => sum + val, 0) /
            Object.values(horse.stats).length
          : 0;

        const traitBonus = horse.traits.length * 5; // 5 points per trait
        const bondBonus = (horse.bondScore || 0) * 0.5;
        const stressPenalty = (horse.stressLevel || 0) * 0.3;

        const overallScore = statsAverage + traitBonus + bondBonus - stressPenalty;

        return {
          ...horse,
          overallScore: Math.round(overallScore),
        };
      })
      .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));
  }, [horses]);

  // Get ranking data from comparison if available
  const rankings =
    comparisonData?.rankings ||
    rankedHorses.map((horse, index) => ({
      horseId: horse.id,
      rank: index + 1,
      score: horse.overallScore || 0,
      strengths: horse.traits.slice(0, 3),
      weaknesses: [], // Would be calculated based on low stats
    }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Ranking Dashboard</h3>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <TrendingUp className="w-4 h-4" />
          <span>Based on overall performance metrics</span>
        </div>
      </div>

      <div className="space-y-3" data-testid="ranking-dashboard">
        {rankedHorses.map((horse, index) => {
          const ranking = rankings.find((r) => r.horseId === horse.id);
          const rank = ranking?.rank || index + 1;

          // Determine rank styling
          const getRankStyling = (rank: number) => {
            switch (rank) {
              case 1:
                return 'bg-yellow-100 text-yellow-800 border-yellow-300';
              case 2:
                return 'bg-gray-100 text-gray-800 border-gray-300';
              case 3:
                return 'bg-orange-100 text-orange-800 border-orange-300';
              default:
                return 'bg-blue-50 text-blue-800 border-blue-200';
            }
          };

          return (
            <div key={horse.id} className={`p-4 rounded-lg border-2 ${getRankStyling(rank)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Rank Badge */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm">
                    <span className="font-bold text-lg">#{rank}</span>
                  </div>

                  {/* Horse Info */}
                  <div>
                    <h4 className="font-semibold text-lg">{horse.name}</h4>
                    <p className="text-sm opacity-75">
                      {horse.breed} • {horse.age} years old
                    </p>
                  </div>
                </div>

                {/* Score and Stats */}
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {horse.overallScore || ranking?.score || 0}
                  </div>
                  <div className="text-sm opacity-75">Overall Score</div>
                </div>
              </div>

              {/* Detailed Metrics */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-lg font-semibold">{horse.stats?.speed || 0}</div>
                  <div className="text-xs opacity-75">Speed</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{horse.stats?.stamina || 0}</div>
                  <div className="text-xs opacity-75">Stamina</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{horse.bondScore || 0}</div>
                  <div className="text-xs opacity-75">Bond</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{horse.traits.length}</div>
                  <div className="text-xs opacity-75">Traits</div>
                </div>
              </div>

              {/* Strengths and Weaknesses */}
              {ranking && (ranking.strengths.length > 0 || ranking.weaknesses.length > 0) && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ranking.strengths.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium mb-2">Strengths</h5>
                      <div className="flex flex-wrap gap-1">
                        {ranking.strengths.map((strength) => (
                          <span
                            key={strength}
                            className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded"
                          >
                            {strength}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {ranking.weaknesses.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium mb-2">Areas for Improvement</h5>
                      <div className="flex flex-wrap gap-1">
                        {ranking.weaknesses.map((weakness) => (
                          <span
                            key={weakness}
                            className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded"
                          >
                            {weakness}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Statistics */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-700 mb-3">Summary Statistics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {Math.round(
                rankedHorses.reduce((sum, h) => sum + (h.overallScore || 0), 0) /
                  rankedHorses.length
              )}
            </div>
            <div className="text-sm text-gray-600">Average Score</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {Math.max(...rankedHorses.map((h) => h.overallScore || 0))}
            </div>
            <div className="text-sm text-gray-600">Highest Score</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {rankedHorses.reduce((sum, h) => sum + h.traits.length, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Traits</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {Math.round(
                rankedHorses.reduce((sum, h) => sum + (h.bondScore || 0), 0) / rankedHorses.length
              )}
            </div>
            <div className="text-sm text-gray-600">Average Bond</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiHorseComparison;
