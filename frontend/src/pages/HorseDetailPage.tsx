/**
 * Horse Detail Page
 *
 * Displays comprehensive information about a specific horse including:
 * - Basic profile (name, age, breed, image)
 * - Detailed statistics
 * - Discipline scores
 * - Genetic traits
 * - Training system with discipline selection and session management
 * - Competition results (placeholder)
 *
 * Story 3.2: Horse Detail View - AC-1 through AC-5
 * Story 4-1: Training Session Interface - Task 6
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Sparkles,
  TrendingUp,
  Ruler,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { useHorse } from '../hooks/api/useHorses';
import FantasyButton from '../components/FantasyButton';
import HorseCard from '../components/HorseCard';
import TraitCard from '../components/TraitCard';
import {
  useHorseEpigeneticInsights,
  useHorseTraitInteractions,
  useHorseTraitTimeline,
} from '../hooks/useHorseGenetics';
import XPProgressBar from '../components/horse/XPProgressBar';
import StatProgressionChart from '../components/horse/StatProgressionChart';
import RecentGains from '../components/horse/RecentGains';
import AgeUpCounter from '../components/horse/AgeUpCounter';
import TrainingRecommendations from '../components/horse/TrainingRecommendations';
import ConformationTab from '../components/horse/ConformationTab';
// Training components (Story 4-1)
import DisciplinePicker from '../components/training/DisciplinePicker';
import TrainingConfirmModal, { TraitModifier } from '../components/training/TrainingConfirmModal';
import TrainingResultModal from '../components/training/TrainingResultModal';
import ScoreProgressionPanel from '../components/training/ScoreProgressionPanel';
import { useTrainHorse, useTrainingOverview } from '../hooks/api/useTraining';
import { formatDisciplineName, canTrain, getDisciplineScore } from '../lib/utils/training-utils';

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
  breedId?: number;
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

type TabType =
  | 'overview'
  | 'disciplines'
  | 'genetics'
  | 'conformation'
  | 'progression'
  | 'training'
  | 'competition';

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

const HorseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditing, setIsEditing] = useState(false);

  // Fetch horse data
  const { data: horse, isLoading, isError, error, refetch } = useHorse(Number(id));

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
    { id: 'conformation', label: 'Conformation', icon: <Ruler className="w-4 h-4" /> },
    { id: 'progression', label: 'Progression', icon: <TrendingUp className="w-4 h-4" /> },
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
                    <h1 className="fantasy-title text-3xl text-midnight-ink mb-2">{horse.name}</h1>
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
                      <div className={`mb-1 ${getStatColor(value)}`}>{getStatIcon(statName)}</div>
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
          <div
            className="flex border-b border-aged-bronze overflow-x-auto"
            role="tablist"
            aria-label="Horse details tabs"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${tab.id}-panel`}
                id={`${tab.id}-tab`}
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
          <div
            className="p-6"
            role="tabpanel"
            id={`${activeTab}-panel`}
            aria-labelledby={`${activeTab}-tab`}
          >
            {activeTab === 'overview' && <OverviewTab horse={horse} />}
            {activeTab === 'disciplines' && <DisciplinesTab horse={horse} />}
            {activeTab === 'genetics' && <GeneticsTab horse={horse} />}
            {activeTab === 'conformation' && (
              <ConformationTab horseId={horse.id} breedId={horse.breedId} />
            )}
            {activeTab === 'progression' && <ProgressionTab horse={horse} />}
            {activeTab === 'training' && <TrainingTab horse={horse} />}
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
  const [filterRarity, setFilterRarity] = useState<'all' | 'common' | 'rare' | 'legendary'>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'sire' | 'dam' | 'mutation'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'rarity' | 'strength' | 'discoveryDate'>('name');

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
          return new Date(b.discoveryDate).getTime() - new Date(a.discoveryDate).getTime();
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
  const allTraits = filteredTraits; // Used by Genetic Overview and Lineage sections

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
          {epigeneticError?.message || interactionsError?.message || timelineError?.message}
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
              onChange={(e) => setFilterType(e.target.value as 'all' | 'genetic' | 'epigenetic')}
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
                setFilterRarity(e.target.value as 'all' | 'common' | 'rare' | 'legendary')
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
                setSortBy(e.target.value as 'name' | 'rarity' | 'strength' | 'discoveryDate')
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

      {/* Genetic Overview Section */}
      {allTraits.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg border-2 border-burnished-gold">
          <h3 className="fantasy-title text-2xl text-midnight-ink mb-6 flex items-center">
            <Sparkles className="w-6 h-6 mr-2 text-burnished-gold" />
            Genetic Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Genetic Potential */}
            <div className="bg-white/80 p-4 rounded-lg border border-blue-300">
              <div className="text-sm text-aged-bronze mb-2 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                Genetic Potential
              </div>
              <div className="text-3xl font-bold text-midnight-ink mb-2">
                {(() => {
                  const rarityScores = allTraits.map((t) =>
                    t.rarity === 'legendary' ? 100 : t.rarity === 'rare' ? 70 : 40
                  );
                  const avgScore = Math.round(
                    rarityScores.reduce((a, b) => a + b, 0) / rarityScores.length
                  );
                  return avgScore;
                })()}
                /100
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${(() => {
                    const rarityScores = allTraits.map((t) =>
                      t.rarity === 'legendary' ? 100 : t.rarity === 'rare' ? 70 : 40
                    );
                    const avgScore = Math.round(
                      rarityScores.reduce((a, b) => a + b, 0) / rarityScores.length
                    );
                    return avgScore >= 80
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                      : avgScore >= 60
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                        : avgScore >= 40
                          ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                          : 'bg-gradient-to-r from-gray-400 to-gray-500';
                  })()}`}
                  style={{
                    width: `${(() => {
                      const rarityScores = allTraits.map((t) =>
                        t.rarity === 'legendary' ? 100 : t.rarity === 'rare' ? 70 : 40
                      );
                      return Math.round(
                        rarityScores.reduce((a, b) => a + b, 0) / rarityScores.length
                      );
                    })()}%`,
                  }}
                />
              </div>
              <p className="text-xs text-aged-bronze mt-2">
                Based on {allTraits.length} trait{allTraits.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Trait Stability */}
            <div className="bg-white/80 p-4 rounded-lg border border-purple-300">
              <div className="text-sm text-aged-bronze mb-2 flex items-center">
                <Shield className="w-4 h-4 mr-1" />
                Trait Stability
              </div>
              <div className="text-3xl font-bold text-midnight-ink mb-2">
                {(() => {
                  const geneticCount = geneticTraits.length;
                  const totalCount = allTraits.length;
                  const stability =
                    totalCount > 0 ? Math.round((geneticCount / totalCount) * 100) : 0;
                  return stability;
                })()}
                %
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${(() => {
                    const geneticCount = geneticTraits.length;
                    const totalCount = allTraits.length;
                    const stability =
                      totalCount > 0 ? Math.round((geneticCount / totalCount) * 100) : 0;
                    return stability >= 75
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                      : stability >= 50
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                        : 'bg-gradient-to-r from-yellow-500 to-yellow-600';
                  })()}`}
                  style={{
                    width: `${(() => {
                      const geneticCount = geneticTraits.length;
                      const totalCount = allTraits.length;
                      return totalCount > 0 ? Math.round((geneticCount / totalCount) * 100) : 0;
                    })()}%`,
                  }}
                />
              </div>
              <p className="text-xs text-aged-bronze mt-2">
                {geneticTraits.length} genetic / {allTraits.length} total
              </p>
            </div>

            {/* Breeding Value */}
            <div className="bg-white/80 p-4 rounded-lg border border-amber-300">
              <div className="text-sm text-aged-bronze mb-2 flex items-center">
                <Award className="w-4 h-4 mr-1" />
                Breeding Value
              </div>
              <div className="text-3xl font-bold text-midnight-ink mb-2">
                {(() => {
                  const legendaryCount = allTraits.filter((t) => t.rarity === 'legendary').length;
                  const rareCount = allTraits.filter((t) => t.rarity === 'rare').length;
                  const value = Math.min(
                    100,
                    legendaryCount * 30 + rareCount * 10 + geneticTraits.length * 2
                  );
                  return value;
                })()}
                /100
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${(() => {
                    const legendaryCount = allTraits.filter((t) => t.rarity === 'legendary').length;
                    const rareCount = allTraits.filter((t) => t.rarity === 'rare').length;
                    const value = Math.min(
                      100,
                      legendaryCount * 30 + rareCount * 10 + geneticTraits.length * 2
                    );
                    return value >= 70
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                      : value >= 40
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                        : 'bg-gradient-to-r from-gray-400 to-gray-500';
                  })()}`}
                  style={{
                    width: `${(() => {
                      const legendaryCount = allTraits.filter(
                        (t) => t.rarity === 'legendary'
                      ).length;
                      const rareCount = allTraits.filter((t) => t.rarity === 'rare').length;
                      return Math.min(
                        100,
                        legendaryCount * 30 + rareCount * 10 + geneticTraits.length * 2
                      );
                    })()}%`,
                  }}
                />
              </div>
              <p className="text-xs text-aged-bronze mt-2">
                {allTraits.filter((t) => t.rarity !== 'common').length} rare+ traits
              </p>
            </div>

            {/* Optimal Combinations */}
            <div className="bg-white/80 p-4 rounded-lg border border-green-300">
              <div className="text-sm text-aged-bronze mb-2 flex items-center">
                <Sparkles className="w-4 h-4 mr-1" />
                Optimal Combos
              </div>
              <div className="text-3xl font-bold text-midnight-ink mb-2">
                {interactionsData?.interactions?.filter((i) => i.strength >= 75).length || 0}
              </div>
              <div className="text-sm text-aged-bronze mb-2">
                {interactionsData?.interactions?.filter((i) => i.strength >= 50 && i.strength < 75)
                  .length || 0}{' '}
                good
              </div>
              <p className="text-xs text-aged-bronze mt-2">High-value trait synergies</p>
            </div>
          </div>

          {/* Breeding Recommendations */}
          {interactionsData?.interactions &&
            interactionsData.interactions.some((i) => i.strength >= 75) && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-300">
                <p className="text-sm text-green-800 flex items-center">
                  <Award className="w-4 h-4 mr-2" />
                  <strong>Prime Breeding Candidate:</strong> This horse has{' '}
                  {interactionsData.interactions.filter((i) => i.strength >= 75).length} optimal
                  trait combination
                  {interactionsData.interactions.filter((i) => i.strength >= 75).length !== 1
                    ? 's'
                    : ''}{' '}
                  making them highly valuable for breeding programs.
                </p>
              </div>
            )}
        </div>
      )}

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

      {/* Trait Timeline Section */}
      {timelineData?.timeline && timelineData.timeline.length > 0 && (
        <div>
          <h3 className="fantasy-title text-xl text-midnight-ink mb-4">
            Trait Development Timeline ({timelineData.timeline.length})
          </h3>
          <div className="space-y-3">
            {timelineData.timeline.map((entry) => (
              <div
                key={entry.id}
                className="p-4 bg-parchment/50 rounded-lg border-l-4 border-aged-bronze"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        entry.eventType === 'discovered'
                          ? 'bg-purple-100 text-purple-700'
                          : entry.eventType === 'activated'
                            ? 'bg-green-100 text-green-700'
                            : entry.eventType === 'deactivated'
                              ? 'bg-gray-100 text-gray-700'
                              : entry.eventType === 'mutated'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {entry.eventType.charAt(0).toUpperCase() + entry.eventType.slice(1)}
                    </span>
                    <span className="text-sm font-semibold text-midnight-ink">
                      {entry.traitName}
                    </span>
                  </div>
                  <span className="text-xs text-aged-bronze">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </span>
                </div>
                {entry.description && (
                  <p className="text-sm text-midnight-ink mb-2">{entry.description}</p>
                )}
                {entry.source && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-aged-bronze">
                      Source: <span className="capitalize font-semibold">{entry.source}</span>
                    </span>
                  </div>
                )}
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

      {/* Lineage Section with Genetic Contribution */}
      {horse.parentIds && (
        <div>
          <h3 className="fantasy-title text-xl text-midnight-ink mb-4">
            Lineage & Genetic Contribution
          </h3>

          {/* Genetic Contribution Visualization */}
          {allTraits.length > 0 && (
            <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-aged-bronze">
              <h4 className="text-sm font-semibold text-midnight-ink mb-3">Genetic Contribution</h4>

              {(() => {
                const sireTraits = allTraits.filter((t) => t.source === 'sire').length;
                const damTraits = allTraits.filter((t) => t.source === 'dam').length;
                const mutationTraits = allTraits.filter((t) => t.source === 'mutation').length;
                const inheritedTotal = sireTraits + damTraits;

                const sirePercentage =
                  inheritedTotal > 0 ? Math.round((sireTraits / inheritedTotal) * 100) : 0;
                const damPercentage =
                  inheritedTotal > 0 ? Math.round((damTraits / inheritedTotal) * 100) : 0;

                return (
                  <>
                    {/* Contribution Bar */}
                    <div className="flex h-8 rounded-lg overflow-hidden border border-aged-bronze mb-3">
                      {sireTraits > 0 && (
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold"
                          style={{ width: `${sirePercentage}%` }}
                        >
                          {sirePercentage}%
                        </div>
                      )}
                      {damTraits > 0 && (
                        <div
                          className="bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold"
                          style={{ width: `${damPercentage}%` }}
                        >
                          {damPercentage}%
                        </div>
                      )}
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-gradient-to-r from-blue-500 to-blue-600"></div>
                        <span className="text-midnight-ink">
                          Sire: <strong>{sireTraits}</strong> ({sirePercentage}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-gradient-to-r from-purple-500 to-purple-600"></div>
                        <span className="text-midnight-ink">
                          Dam: <strong>{damTraits}</strong> ({damPercentage}%)
                        </span>
                      </div>
                      {mutationTraits > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-gradient-to-r from-amber-500 to-amber-600"></div>
                          <span className="text-midnight-ink">
                            Mutations: <strong>{mutationTraits}</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Analysis */}
                    {inheritedTotal > 0 && (
                      <div className="mt-3 pt-3 border-t border-aged-bronze/30">
                        <p className="text-xs text-aged-bronze">
                          {sirePercentage > damPercentage + 10 ? (
                            <>
                              <strong>Sire-Dominant:</strong> This horse inherited significantly
                              more traits from the sire lineage.
                            </>
                          ) : damPercentage > sirePercentage + 10 ? (
                            <>
                              <strong>Dam-Dominant:</strong> This horse inherited significantly more
                              traits from the dam lineage.
                            </>
                          ) : (
                            <>
                              <strong>Balanced Inheritance:</strong> This horse has a well-balanced
                              genetic contribution from both parents.
                            </>
                          )}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Parent Links */}
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

/**
 * Training Tab Component
 *
 * Integrates the full training flow with:
 * - DisciplinePicker for discipline selection
 * - TrainingConfirmModal for confirmation
 * - TrainingResultModal for results display
 * - Training status and cooldown display
 *
 * Story 4-1: Training Session Interface - Task 6
 */
const TrainingTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  // Training flow state
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [trainingResult, setTrainingResult] = useState<{
    scoreGain: number;
    baseScoreGain: number;
    traitBonus: number;
    newScore: number;
    statGains?: { [stat: string]: number };
    xpGain?: number;
    nextTrainingDate: Date;
  } | null>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);

  // Training hooks
  const { data: trainingOverview, isLoading: isStatusLoading } = useTrainingOverview(horse.id);
  const trainHorse = useTrainHorse();

  // Check training eligibility
  const eligibility = canTrain({
    id: horse.id,
    name: horse.name,
    age: horse.age,
    trainingCooldown: getGlobalCooldown(trainingOverview),
  });

  // Get global cooldown date (most recent cooldown across all disciplines)
  function getGlobalCooldown(
    overview: Array<{ discipline: string; nextEligibleDate?: string | null }> | undefined
  ): string | null {
    if (!overview || overview.length === 0) return null;

    const cooldowns = overview
      .filter((d) => d.nextEligibleDate)
      .map((d) => new Date(d.nextEligibleDate!))
      .filter((d) => d > new Date());

    if (cooldowns.length === 0) return null;

    // Return the earliest cooldown
    const earliest = cooldowns.sort((a, b) => a.getTime() - b.getTime())[0];
    return earliest.toISOString();
  }

  // Get list of disabled disciplines (on cooldown)
  function getDisabledDisciplines(): string[] {
    if (!trainingOverview) return [];
    if (!eligibility.eligible) {
      // If horse is not eligible at all, return empty (DisciplinePicker won't be active anyway)
      return [];
    }

    return trainingOverview
      .filter((d) => d.nextEligibleDate && new Date(d.nextEligibleDate) > new Date())
      .map((d) => d.discipline);
  }

  // Calculate trait modifiers for the selected discipline (mock for frontend-first)
  function getTraitModifiers(_disciplineId: string): TraitModifier[] {
    // In Phase 1 (frontend-first), return mock trait modifiers
    // In Phase 2, this will be fetched from the backend
    if (!horse.traits || horse.traits.length === 0) return [];

    // Simulate trait modifiers based on horse traits
    const modifiers: TraitModifier[] = [];

    if (horse.traits.includes('Fast Learner')) {
      modifiers.push({ name: 'Fast Learner', modifier: 1 });
    }
    if (horse.traits.includes('Strong Build')) {
      modifiers.push({ name: 'Strong Build', modifier: 1 });
    }
    if (horse.traits.includes('Nervous')) {
      modifiers.push({ name: 'Nervous', modifier: -1 });
    }

    return modifiers;
  }

  // Handle discipline selection
  const handleDisciplineSelect = (disciplineId: string) => {
    setSelectedDiscipline(disciplineId);
    setTrainingError(null);
    setIsConfirmModalOpen(true);
  };

  // Handle training confirmation
  const handleConfirm = async () => {
    if (!selectedDiscipline) return;

    setTrainingError(null);

    try {
      const result = await trainHorse.mutateAsync({
        horseId: horse.id,
        discipline: selectedDiscipline,
      });

      // Close confirm modal
      setIsConfirmModalOpen(false);

      // Calculate training result for display
      const traitModifiers = getTraitModifiers(selectedDiscipline);
      const traitBonus = traitModifiers.reduce((sum, t) => sum + t.modifier, 0);
      const baseGain = 5; // Base score gain
      const scoreGain = Math.max(0, baseGain + traitBonus);
      const currentScore = getDisciplineScore(
        {
          id: horse.id,
          name: horse.name,
          age: horse.age,
          disciplineScores: horse.disciplineScores,
        },
        selectedDiscipline
      );

      // Map stat gain from result
      const statGains: { [stat: string]: number } = {};
      if (result.statGain) {
        statGains[result.statGain.stat] = result.statGain.amount;
      }

      // Set result for modal display
      setTrainingResult({
        scoreGain,
        baseScoreGain: baseGain,
        traitBonus,
        newScore: result.updatedScore ?? currentScore + scoreGain,
        statGains: Object.keys(statGains).length > 0 ? statGains : undefined,
        xpGain: result.traitEffects?.xpModifier,
        nextTrainingDate: result.nextEligible
          ? new Date(result.nextEligible)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Open result modal
      setIsResultModalOpen(true);
    } catch (error) {
      // Keep modal open on error so user can retry
      const errorMessage =
        error instanceof Error ? error.message : 'Training failed. Please try again.';
      setTrainingError(errorMessage);
    }
  };

  // Handle closing the result modal
  const handleCloseResult = () => {
    setIsResultModalOpen(false);
    setTrainingResult(null);
    setSelectedDiscipline(null);
    // Horse data will auto-refresh via React Query cache invalidation
  };

  // Handle closing confirm modal (cancel)
  const handleCloseConfirm = () => {
    setIsConfirmModalOpen(false);
    setSelectedDiscipline(null);
    setTrainingError(null);
  };

  // Format cooldown date for display
  function formatCooldownDisplay(dateStr: string | null): string {
    if (!dateStr) return 'Available now';

    const date = new Date(dateStr);
    const now = new Date();

    if (date <= now) return 'Available now';

    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return '1 day';
    if (diffDays < 7) return `${diffDays} days`;

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  const globalCooldown = getGlobalCooldown(trainingOverview);
  const disabledDisciplines = getDisabledDisciplines();
  const isOnCooldown = globalCooldown !== null;

  // Determine if ineligibility is due to cooldown vs age
  const isIneligibleDueToCooldown =
    !eligibility.eligible && eligibility.reason?.includes('cooldown');
  const isIneligibleDueToAge = !eligibility.eligible && eligibility.reason?.includes('3 years old');

  return (
    <div className="space-y-6" data-testid="training-tab">
      {/* Training Status Section */}
      <div className="bg-parchment/50 rounded-lg border border-aged-bronze p-6">
        <h3 className="fantasy-title text-xl text-midnight-ink mb-3 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-aged-bronze" />
          Training Status
        </h3>

        {isStatusLoading ? (
          <div className="flex items-center text-aged-bronze" data-testid="training-status-loading">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading training status...
          </div>
        ) : isIneligibleDueToAge ? (
          <div className="flex items-center text-red-600" data-testid="training-status-ineligible">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{eligibility.reason}</span>
          </div>
        ) : isOnCooldown || isIneligibleDueToCooldown ? (
          <div className="flex items-center text-amber-600" data-testid="training-status-cooldown">
            <Clock className="w-5 h-5 mr-2" />
            <span>
              Next training available in:{' '}
              {formatCooldownDisplay(
                globalCooldown || (eligibility.reason?.match(/until (.+)$/)?.[1] ?? null)
              )}
            </span>
          </div>
        ) : (
          <div className="flex items-center text-forest-green" data-testid="training-status-ready">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span>Ready to train!</span>
          </div>
        )}
      </div>

      {/* Age/Eligibility Warning - only show for age-based ineligibility */}
      {isIneligibleDueToAge && (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-4"
          data-testid="training-eligibility-warning"
        >
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-800">Training Not Available</h4>
              <p className="text-sm text-red-600 mt-1">{eligibility.reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Discipline Picker Section */}
      {(eligibility.eligible || isIneligibleDueToCooldown) && (
        <div className="bg-white/80 rounded-lg border-2 border-aged-bronze p-6">
          <h3 className="fantasy-title text-xl text-midnight-ink mb-4 flex items-center">
            <Dumbbell className="w-5 h-5 mr-2 text-aged-bronze" />
            Select Discipline
          </h3>

          <DisciplinePicker
            selectedDiscipline={selectedDiscipline}
            onSelectDiscipline={handleDisciplineSelect}
            disciplineScores={horse.disciplineScores || {}}
            disabledDisciplines={disabledDisciplines}
            isLoading={isStatusLoading || trainHorse.isPending}
          />
        </div>
      )}

      {/* Training Error Display */}
      {trainingError && (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-4"
          data-testid="training-error"
        >
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-800">Training Error</h4>
              <p className="text-sm text-red-600 mt-1">{trainingError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Training Confirm Modal */}
      {selectedDiscipline && (
        <TrainingConfirmModal
          isOpen={isConfirmModalOpen}
          onClose={handleCloseConfirm}
          onConfirm={handleConfirm}
          horseName={horse.name}
          disciplineName={formatDisciplineName(selectedDiscipline)}
          baseScoreGain={5}
          currentScore={getDisciplineScore(
            {
              id: horse.id,
              name: horse.name,
              age: horse.age,
              disciplineScores: horse.disciplineScores,
            },
            selectedDiscipline
          )}
          traitModifiers={getTraitModifiers(selectedDiscipline)}
          cooldownDays={7}
          isLoading={trainHorse.isPending}
        />
      )}

      {/* Training Result Modal */}
      {trainingResult && (
        <TrainingResultModal
          isOpen={isResultModalOpen}
          onClose={handleCloseResult}
          disciplineName={formatDisciplineName(selectedDiscipline || '')}
          scoreGain={trainingResult.scoreGain}
          baseScoreGain={trainingResult.baseScoreGain}
          traitBonus={trainingResult.traitBonus}
          newScore={trainingResult.newScore}
          statGains={trainingResult.statGains}
          xpGain={trainingResult.xpGain}
          nextTrainingDate={trainingResult.nextTrainingDate}
        />
      )}
    </div>
  );
};

// Progression Tab Component
const ProgressionTab: React.FC<{ horse: Horse }> = ({ horse }) => (
  <div className="space-y-6" data-testid="progression-tab">
    {/* XP Progress Bar - Full Width */}
    <div className="col-span-full">
      <XPProgressBar horseId={horse.id} />
    </div>

    {/* Stat Progression Chart - Full Width */}
    <div className="col-span-full">
      <StatProgressionChart horseId={horse.id} />
    </div>

    {/* Recent Gains and Age Counter - Two Column Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="col-span-1">
        <RecentGains horseId={horse.id} />
      </div>
      <div className="col-span-1">
        <AgeUpCounter horseId={horse.id} />
      </div>
    </div>

    {/* Training Recommendations - Full Width */}
    <div className="col-span-full">
      <TrainingRecommendations horseId={horse.id} />
    </div>

    {/* Score Progression Panel - Discipline scores and training history */}
    <div className="col-span-full" data-testid="score-progression-section">
      <ScoreProgressionPanel horseId={horse.id} className="mt-4" />
    </div>
  </div>
);

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
