/**
 * Horse Detail Page
 *
 * Displays comprehensive information about a specific horse including:
 * - Basic profile (name, age, breed, image)
 * - Detailed statistics
 * - Discipline scores
 * - Genetic traits
 * - Training history (placeholder)
 * - Competition results (placeholder)
 *
 * Story 3.2: Horse Detail View - AC-1 through AC-5
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Zap,
  Heart,
  Star,
  Shield,
  Trophy,
  ArrowLeft,
  Dumbbell,
  Award,
  Edit,
  Users,
  AlertCircle,
  Loader2,
  Filter,
  ChevronDown,
} from 'lucide-react';
import FantasyButton from '../components/FantasyButton';
import HorseCard from '../components/HorseCard';
import TraitCard from '../components/TraitCard';
import {
  useHorseEpigeneticInsights,
  useHorseTraitInteractions,
  useHorseTraitTimeline,
} from '../hooks/useHorseGenetics';

// Types
interface HorseStats {
  speed: number;
  stamina: number;
  agility: number;
  strength: number;
  intelligence: number;
  health: number;
}

interface Horse {
  id: number;
  name: string;
  breed: string;
  age: number;
  gender: string;
  dateOfBirth: string;
  healthStatus: string;
  imageUrl?: string;
  stats: HorseStats;
  disciplineScores: Record<string, number>;
  traits?: string[];
  description?: string;
  parentIds?: {
    sireId?: number;
    damId?: number;
  };
}

type TabType = 'overview' | 'disciplines' | 'genetics' | 'training' | 'competition';

// Stat icon mapping (consistent with HorseCard)
const getStatIcon = (statName: string) => {
  switch (statName) {
    case 'speed':
      return <Zap className="w-5 h-5" />;
    case 'stamina':
      return <Heart className="w-5 h-5" />;
    case 'agility':
      return <Star className="w-5 h-5" />;
    case 'strength':
      return <Shield className="w-5 h-5" />;
    case 'intelligence':
      return <Trophy className="w-5 h-5" />;
    case 'health':
      return <Heart className="w-5 h-5" />;
    default:
      return <Star className="w-5 h-5" />;
  }
};

// Stat color coding (consistent with HorseCard)
const getStatColor = (value: number) => {
  if (value >= 90) return 'text-burnished-gold';
  if (value >= 75) return 'text-forest-green';
  if (value >= 60) return 'text-aged-bronze';
  return 'text-mystic-silver';
};

// API function
const fetchHorseDetail = async (horseId: string): Promise<Horse> => {
  const response = await fetch(`/api/v1/horses/${horseId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Horse not found');
    }
    throw new Error('Failed to fetch horse details');
  }

  const data = await response.json();
  return data.data;
};

const HorseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditing, setIsEditing] = useState(false);

  // Fetch horse data
  const {
    data: horse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Horse, Error>({
    queryKey: ['horse', id],
    queryFn: () => fetchHorseDetail(id!),
    enabled: !!id,
    retry: false,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-parchment parchment-texture flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-aged-bronze animate-spin mx-auto mb-4" />
          <p className="fantasy-body text-midnight-ink">Loading horse details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !horse) {
    return (
      <div className="min-h-screen bg-parchment parchment-texture flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/80 rounded-lg border-2 border-aged-bronze p-6 text-center">
          <AlertCircle className="w-16 h-16 text-aged-bronze mx-auto mb-4" />
          <h2 className="fantasy-title text-2xl text-midnight-ink mb-2">
            {error?.message === 'Horse not found' ? 'Horse Not Found' : 'Error Loading Horse'}
          </h2>
          <p className="fantasy-body text-aged-bronze mb-6">
            {error?.message === 'Horse not found'
              ? 'The horse you are looking for does not exist or has been removed.'
              : 'An error occurred while loading the horse details. Please try again.'}
          </p>
          <div className="flex gap-3 justify-center">
            <FantasyButton onClick={() => navigate('/horses')} variant="secondary">
              Back to Horse List
            </FantasyButton>
            {error?.message !== 'Horse not found' && (
              <FantasyButton onClick={() => refetch()}>Retry</FantasyButton>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Tab configuration
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Star className="w-4 h-4" /> },
    { id: 'disciplines', label: 'Disciplines', icon: <Trophy className="w-4 h-4" /> },
    { id: 'genetics', label: 'Genetics', icon: <Users className="w-4 h-4" /> },
    { id: 'training', label: 'Training', icon: <Dumbbell className="w-4 h-4" /> },
    { id: 'competition', label: 'Competitions', icon: <Award className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-parchment parchment-texture">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/horses')}
            className="flex items-center gap-2 text-aged-bronze hover:text-burnished-gold transition-colors mb-4 fantasy-body"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Horse List
          </button>

          {/* Horse Profile Card */}
          <div className="bg-white/80 rounded-lg border-2 border-burnished-gold p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Horse Image */}
              <div className="w-full md:w-48 h-48 rounded-lg border-2 border-aged-bronze overflow-hidden bg-mystic-silver/20">
                <img
                  src={horse.imageUrl || '/images/horse-placeholder.png'}
                  alt={horse.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Horse Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="fantasy-title text-3xl text-midnight-ink mb-2">
                      {horse.name}
                    </h1>
                    <div className="flex flex-wrap gap-3 text-sm fantasy-body text-aged-bronze">
                      <span>Breed: {horse.breed}</span>
                      <span>•</span>
                      <span>Age: {horse.age}</span>
                      <span>•</span>
                      <span>Gender: {horse.gender}</span>
                      <span>•</span>
                      <span>Health: {horse.healthStatus}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="p-2 hover:bg-aged-bronze/10 rounded transition-colors"
                    aria-label="Edit horse details"
                  >
                    <Edit className="w-5 h-5 text-aged-bronze" />
                  </button>
                </div>

                {/* Description */}
                {horse.description && (
                  <p className="fantasy-body text-midnight-ink mb-4">{horse.description}</p>
                )}

                {/* Quick Stats Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {Object.entries(horse.stats).map(([statName, value]) => (
                    <div
                      key={statName}
                      className="flex flex-col items-center p-3 bg-parchment/50 rounded border border-aged-bronze"
                    >
                      <div className={`mb-1 ${getStatColor(value)}`}>
                        {getStatIcon(statName)}
                      </div>
                      <span className="text-xs fantasy-caption text-aged-bronze capitalize">
                        {statName}
                      </span>
                      <span className="text-lg fantasy-title text-midnight-ink">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap gap-3 mb-6">
          <FantasyButton onClick={() => navigate(`/training?horseId=${horse.id}`)}>
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4" />
              Train This Horse
            </div>
          </FantasyButton>
          <FantasyButton
            onClick={() => navigate(`/competition?horseId=${horse.id}`)}
            variant="secondary"
          >
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              Enter Competition
            </div>
          </FantasyButton>
          {horse.parentIds?.sireId && (
            <FantasyButton
              onClick={() => navigate(`/horses/${horse.parentIds.sireId}`)}
              variant="secondary"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                View Parents
              </div>
            </FantasyButton>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="bg-white/80 rounded-lg border-2 border-aged-bronze mb-6">
          <div className="flex border-b border-aged-bronze overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 fantasy-body transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-aged-bronze/20 text-midnight-ink border-b-2 border-burnished-gold'
                    : 'text-aged-bronze hover:bg-aged-bronze/10'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && <OverviewTab horse={horse} />}
            {activeTab === 'disciplines' && <DisciplinesTab horse={horse} />}
            {activeTab === 'genetics' && <GeneticsTab horse={horse} />}
            {activeTab === 'training' && <PlaceholderTab title="Training History" />}
            {activeTab === 'competition' && <PlaceholderTab title="Competition Results" />}
          </div>
        </div>
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{ horse: Horse }> = ({ horse }) => (
  <div className="space-y-6">
    <div>
      <h3 className="fantasy-title text-xl text-midnight-ink mb-3">Current Status</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-parchment/50 rounded border border-aged-bronze">
          <p className="fantasy-caption text-aged-bronze mb-1">Health Status</p>
          <p className="fantasy-body text-midnight-ink">{horse.healthStatus}</p>
        </div>
        <div className="p-4 bg-parchment/50 rounded border border-aged-bronze">
          <p className="fantasy-caption text-aged-bronze mb-1">Age</p>
          <p className="fantasy-body text-midnight-ink">{horse.age} years old</p>
        </div>
        <div className="p-4 bg-parchment/50 rounded border border-aged-bronze">
          <p className="fantasy-caption text-aged-bronze mb-1">Date of Birth</p>
          <p className="fantasy-body text-midnight-ink">
            {new Date(horse.dateOfBirth).toLocaleDateString()}
          </p>
        </div>
        <div className="p-4 bg-parchment/50 rounded border border-aged-bronze">
          <p className="fantasy-caption text-aged-bronze mb-1">Gender</p>
          <p className="fantasy-body text-midnight-ink capitalize">{horse.gender}</p>
        </div>
      </div>
    </div>

    {horse.traits && horse.traits.length > 0 && (
      <div>
        <h3 className="fantasy-title text-xl text-midnight-ink mb-3">Traits</h3>
        <div className="flex flex-wrap gap-2">
          {horse.traits.map((trait, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-burnished-gold/20 text-midnight-ink rounded-full text-sm fantasy-body border border-burnished-gold"
            >
              {trait}
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
);

// Disciplines Tab Component
const DisciplinesTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const disciplines = Object.entries(horse.disciplineScores);

  if (disciplines.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="fantasy-body text-aged-bronze">
          This horse has not trained in any disciplines yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="fantasy-title text-xl text-midnight-ink mb-4">Discipline Scores</h3>
      {disciplines.map(([discipline, score]) => (
        <div key={discipline} className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="fantasy-body text-midnight-ink">{discipline}</span>
            <span className={`fantasy-title ${getStatColor(score)}`}>{score}</span>
          </div>
          <div className="h-3 bg-parchment rounded-full overflow-hidden border border-aged-bronze">
            <div
              className={`h-full transition-all ${
                score >= 90
                  ? 'bg-burnished-gold'
                  : score >= 75
                    ? 'bg-forest-green'
                    : score >= 60
                      ? 'bg-aged-bronze'
                      : 'bg-mystic-silver'
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// Genetics Tab Component (Enhanced with TraitCard, filtering, and sorting)
const GeneticsTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  // Fetch genetics data using hooks
  const {
    data: epigeneticData,
    isLoading: epigeneticLoading,
    error: epigeneticError,
  } = useHorseEpigeneticInsights(horse.id);

  const {
    data: interactionsData,
    isLoading: interactionsLoading,
    error: interactionsError,
  } = useHorseTraitInteractions(horse.id);

  const {
    data: timelineData,
    isLoading: timelineLoading,
    error: timelineError,
  } = useHorseTraitTimeline(horse.id);

  // Filter and sort state
  const [filterType, setFilterType] = useState<'all' | 'genetic' | 'epigenetic'>('all');
  const [filterRarity, setFilterRarity] = useState<
    'all' | 'common' | 'rare' | 'legendary'
  >('all');
  const [filterSource, setFilterSource] = useState<
    'all' | 'sire' | 'dam' | 'mutation'
  >('all');
  const [sortBy, setSortBy] = useState<
    'name' | 'rarity' | 'strength' | 'discoveryDate'
  >('name');

  // Filter and sort functions
  const getFilteredAndSortedTraits = () => {
    if (!epigeneticData?.traits) return [];

    let filtered = [...epigeneticData.traits];

    // Apply filters
    if (filterType !== 'all') {
      filtered = filtered.filter((trait) => trait.type === filterType);
    }
    if (filterRarity !== 'all') {
      filtered = filtered.filter((trait) => trait.rarity === filterRarity);
    }
    if (filterSource !== 'all') {
      filtered = filtered.filter((trait) => trait.source === filterSource);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rarity': {
          const rarityOrder = { common: 0, rare: 1, legendary: 2 };
          return rarityOrder[b.rarity] - rarityOrder[a.rarity];
        }
        case 'strength':
          return b.strength - a.strength;
        case 'discoveryDate':
          if (!a.discoveryDate || !b.discoveryDate) return 0;
          return (
            new Date(b.discoveryDate).getTime() - new Date(a.discoveryDate).getTime()
          );
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredTraits = getFilteredAndSortedTraits();

  // Separate traits by type for section display
  const geneticTraits = filteredTraits.filter((t) => t.type === 'genetic');
  const epigeneticTraits = filteredTraits.filter((t) => t.type === 'epigenetic');

  // Loading state
  if (epigeneticLoading || interactionsLoading || timelineLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-burnished-gold" />
        <span className="ml-3 text-aged-bronze">Loading genetics data...</span>
      </div>
    );
  }

  // Error state
  if (epigeneticError || interactionsError || timelineError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center text-red-700 mb-2">
          <AlertCircle className="w-5 h-5 mr-2" />
          <h4 className="font-semibold">Error Loading Genetics Data</h4>
        </div>
        <p className="text-red-600 text-sm">
          {epigeneticError?.message ||
            interactionsError?.message ||
            timelineError?.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Sorting */}
      <div className="bg-parchment/30 p-4 rounded-lg border border-aged-bronze">
        <div className="flex items-center mb-4">
          <Filter className="w-5 h-5 text-aged-bronze mr-2" />
          <h4 className="font-semibold text-midnight-ink">Filters & Sorting</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Type Filter */}
          <div>
            <label className="block text-sm text-aged-bronze mb-2">Type</label>
            <select
              value={filterType}
              onChange={(e) =>
                setFilterType(e.target.value as 'all' | 'genetic' | 'epigenetic')
              }
              className="w-full p-2 bg-parchment border border-aged-bronze rounded text-midnight-ink"
            >
              <option value="all">All Types</option>
              <option value="genetic">Genetic</option>
              <option value="epigenetic">Epigenetic</option>
            </select>
          </div>

          {/* Rarity Filter */}
          <div>
            <label className="block text-sm text-aged-bronze mb-2">Rarity</label>
            <select
              value={filterRarity}
              onChange={(e) =>
                setFilterRarity(
                  e.target.value as 'all' | 'common' | 'rare' | 'legendary'
                )
              }
              className="w-full p-2 bg-parchment border border-aged-bronze rounded text-midnight-ink"
            >
              <option value="all">All Rarities</option>
              <option value="common">Common</option>
              <option value="rare">Rare</option>
              <option value="legendary">Legendary</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-sm text-aged-bronze mb-2">Source</label>
            <select
              value={filterSource}
              onChange={(e) =>
                setFilterSource(e.target.value as 'all' | 'sire' | 'dam' | 'mutation')
              }
              className="w-full p-2 bg-parchment border border-aged-bronze rounded text-midnight-ink"
            >
              <option value="all">All Sources</option>
              <option value="sire">From Sire</option>
              <option value="dam">From Dam</option>
              <option value="mutation">Mutation</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm text-aged-bronze mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as 'name' | 'rarity' | 'strength' | 'discoveryDate'
                )
              }
              className="w-full p-2 bg-parchment border border-aged-bronze rounded text-midnight-ink"
            >
              <option value="name">Name (A-Z)</option>
              <option value="rarity">Rarity (High to Low)</option>
              <option value="strength">Strength (High to Low)</option>
              <option value="discoveryDate">Discovery Date (Recent First)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Genetic Traits Section */}
      {geneticTraits.length > 0 && (
        <div>
          <h3 className="fantasy-title text-xl text-midnight-ink mb-4">
            Genetic Traits ({geneticTraits.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {geneticTraits.map((trait) => (
              <TraitCard key={`${trait.name}-${trait.type}`} trait={trait} />
            ))}
          </div>
        </div>
      )}

      {/* Epigenetic Traits Section */}
      {epigeneticTraits.length > 0 && (
        <div>
          <h3 className="fantasy-title text-xl text-midnight-ink mb-4">
            Epigenetic Traits ({epigeneticTraits.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {epigeneticTraits.map((trait) => (
              <TraitCard key={`${trait.name}-${trait.type}`} trait={trait} />
            ))}
          </div>
        </div>
      )}

      {/* Trait Interactions Section */}
      {interactionsData?.interactions && interactionsData.interactions.length > 0 && (
        <div>
          <h3 className="fantasy-title text-xl text-midnight-ink mb-4">
            Trait Interactions ({interactionsData.interactions.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interactionsData.interactions.map((interaction, index) => (
              <div
                key={index}
                className="p-4 bg-parchment/50 rounded-lg border-2 border-purple-300"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-purple-700">
                    {interaction.trait1} + {interaction.trait2}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      interaction.strength >= 75
                        ? 'bg-green-100 text-green-700'
                        : interaction.strength >= 50
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Strength: {interaction.strength}
                  </span>
                </div>
                <p className="text-sm text-midnight-ink">{interaction.effect}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Traits Message */}
      {filteredTraits.length === 0 && (
        <div className="text-center py-8 text-aged-bronze">
          <p>No traits match the current filters.</p>
        </div>
      )}

      {/* Lineage Section (Preserved from original) */}
      {horse.parentIds && (
        <div>
          <h3 className="fantasy-title text-xl text-midnight-ink mb-4">Lineage</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {horse.parentIds.sireId && (
              <button
                onClick={() => (window.location.href = `/horses/${horse.parentIds.sireId}`)}
                className="p-4 bg-parchment/50 rounded border border-aged-bronze hover:border-burnished-gold transition-colors text-left"
              >
                <p className="fantasy-caption text-aged-bronze mb-1">Sire</p>
                <p className="fantasy-body text-midnight-ink">View Sire Details →</p>
              </button>
            )}
            {horse.parentIds.damId && (
              <button
                onClick={() => (window.location.href = `/horses/${horse.parentIds.damId}`)}
                className="p-4 bg-parchment/50 rounded border border-aged-bronze hover:border-burnished-gold transition-colors text-left"
              >
                <p className="fantasy-caption text-aged-bronze mb-1">Dam</p>
                <p className="fantasy-body text-midnight-ink">View Dam Details →</p>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Placeholder Tab Component
const PlaceholderTab: React.FC<{ title: string }> = ({ title }) => (
  <div className="text-center py-12">
    <h3 className="fantasy-title text-2xl text-midnight-ink mb-4">{title}</h3>
    <p className="fantasy-body text-aged-bronze">
      This section is coming soon. Check back later for updates!
    </p>
  </div>
);

export default HorseDetailPage;
