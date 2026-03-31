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
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
  Sparkles,
  TrendingUp,
  Ruler,
  Clock,
  CheckCircle,
  GitBranch,
  Stethoscope,
  Tag,
  ShoppingCart,
  X,
  Target,
  Activity,
  Scale,
  Flame,
  Wind,
  Eye,
} from 'lucide-react';
import { useHorse, useUpdateHorse } from '../hooks/api/useHorses';
import TraitCard from '../components/TraitCard';
import {
  useHorseEpigeneticInsights,
  useHorseTraitInteractions,
  useHorseTraitTimeline,
} from '../hooks/useHorseGenetics';
import XpProgressBar from '../components/horse/XpProgressBar';
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
import { SkeletonBase } from '@/components/ui/SkeletonCard';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRiders, useAssignRider, type Rider } from '@/hooks/api/useRiders';
import { useListHorse, useDelistHorse } from '@/hooks/api/useMarketplace';
import { getHorseImage } from '@/lib/breed-images';
import { getBreedName } from '@/lib/utils';

// Types
interface HorseStats {
  precision: number;
  strength: number;
  speed: number;
  agility: number;
  endurance: number;
  intelligence: number;
  stamina: number;
  balance: number;
  boldness: number;
  flexibility: number;
  obedience: number;
  focus: number;
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
  forSale?: boolean;
  salePrice?: number;
  userId?: string;
  parentIds?: {
    sireId?: number;
    damId?: number;
  };
  // Equipped tack — JSON field from Prisma; includes item IDs + <category>_condition values
  tack?: Record<string, unknown>;
}

type TabType =
  | 'overview'
  | 'disciplines'
  | 'genetics'
  | 'conformation'
  | 'progression'
  | 'training'
  | 'competition'
  | 'pedigree'
  | 'health'
  | 'stud-sale'
  | 'tack';

// Stat icon mapping for all 12 stats
const getStatIcon = (statName: string) => {
  switch (statName) {
    case 'precision':
      return <Target className="w-5 h-5" />;
    case 'strength':
      return <Shield className="w-5 h-5" />;
    case 'speed':
      return <Zap className="w-5 h-5" />;
    case 'agility':
      return <Star className="w-5 h-5" />;
    case 'endurance':
      return <Heart className="w-5 h-5" />;
    case 'intelligence':
      return <Trophy className="w-5 h-5" />;
    case 'stamina':
      return <Activity className="w-5 h-5" />;
    case 'balance':
      return <Scale className="w-5 h-5" />;
    case 'boldness':
      return <Flame className="w-5 h-5" />;
    case 'flexibility':
      return <Wind className="w-5 h-5" />;
    case 'obedience':
      return <CheckCircle className="w-5 h-5" />;
    case 'focus':
      return <Eye className="w-5 h-5" />;
    default:
      return <Star className="w-5 h-5" />;
  }
};

// Stat color coding
const getStatColor = (value: number) => {
  if (value >= 90) return 'text-burnished-gold';
  if (value >= 75) return 'text-emerald-400';
  if (value >= 60) return 'text-[rgb(180,195,215)]';
  return 'text-[rgb(148,163,184)]';
};

const HorseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showRiderPicker, setShowRiderPicker] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [listPrice, setListPrice] = useState('');

  const listHorseMutation = useListHorse();
  const delistHorseMutation = useDelistHorse();
  const updateHorseMutation = useUpdateHorse();

  // Auth — needed to fetch user's riders
  const { user } = useAuth();

  // Rider assignment (Story 15-5)
  const { data: riders, isLoading: ridersLoading } = useUserRiders(user?.id ?? 0);
  const assignRiderMutation = useAssignRider();

  // Fetch horse data — use `horseRaw` so the normalized copy can be named `horse` below,
  // keeping all downstream JSX references unchanged.
  const { data: horseRaw, isLoading, isError, error, refetch } = useHorse(Number(id));

  // Loading state — detail page skeleton (portrait left + tab area right)
  if (isLoading) {
    return (
      <div className="min-h-screen" aria-label="Loading horse details">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Portrait skeleton */}
            <div className="w-full md:w-64 flex-shrink-0 space-y-3">
              <SkeletonBase className="w-full h-64" rounded="lg" />
              <SkeletonBase className="h-5 w-2/3" rounded="full" />
              <SkeletonBase className="h-4 w-1/2" rounded="full" />
              <div className="space-y-2 pt-2">
                {[...Array(5)].map((_, i) => (
                  <SkeletonBase key={i} className="h-3 w-full" rounded="full" />
                ))}
              </div>
            </div>
            {/* Tab area skeleton */}
            <div className="flex-1 space-y-4">
              <div className="flex gap-2">
                {[...Array(5)].map((_, i) => (
                  <SkeletonBase key={i} className="h-9 w-20" rounded="md" />
                ))}
              </div>
              <SkeletonBase className="h-48 w-full" rounded="lg" />
              <SkeletonBase className="h-32 w-full" rounded="lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !horseRaw) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel max-w-md w-full px-6 py-7 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="fantasy-header text-xl" style={{ color: 'var(--gold-500)' }}>
            {error?.message === 'Horse not found' ? 'Horse Not Found' : 'Error Loading Horse'}
          </h2>
          <p className="text-sm text-[rgb(220,235,255)]">
            {error?.message === 'Horse not found'
              ? 'The horse you are looking for does not exist or has been removed.'
              : 'An error occurred while loading the horse details. Please try again.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button type="button" variant="secondary" onClick={() => navigate('/stable')}>
              Back to Horse List
            </Button>
            {error?.message !== 'Horse not found' && (
              <Button type="button" onClick={() => refetch()}>
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Normalize horse data — produce a NEW object so the React Query cache is never mutated.
  const rawHorse = horseRaw as unknown as Record<string, unknown>;

  // Resolve breed: API returns a Prisma relation object { id, name, ... } but the Horse
  // interface and downstream components expect a plain string (the breed name).
  const resolvedBreed =
    typeof horseRaw.breed === 'object' && horseRaw.breed !== null
      ? (horseRaw.breed as { name: string }).name
      : (horseRaw.breed as string);

  // Resolve gender: the Prisma model stores `sex` (e.g. "MARE") but the local Horse
  // interface uses `gender`. Fall back to `sex` when `gender` is absent.
  const resolvedGender = (horseRaw.gender || rawHorse.sex || '') as string;

  // Resolve stats: API may return flat fields (speed, stamina, …) instead of a nested
  // stats object when coming from a Prisma raw query.
  const resolvedStats: HorseStats = horseRaw.stats ?? {
    precision: (rawHorse.precision as number) ?? 0,
    strength: (rawHorse.strength as number) ?? 0,
    speed: (rawHorse.speed as number) ?? 0,
    agility: (rawHorse.agility as number) ?? 0,
    endurance: (rawHorse.endurance as number) ?? 0,
    intelligence: (rawHorse.intelligence as number) ?? 0,
    stamina: (rawHorse.stamina as number) ?? 0,
    balance: (rawHorse.balance as number) ?? 0,
    boldness: (rawHorse.boldness as number) ?? 0,
    flexibility: (rawHorse.flexibility as number) ?? 0,
    obedience: (rawHorse.obedience as number) ?? 0,
    focus: (rawHorse.focus as number) ?? 0,
  };

  // Shadow `horse` with the normalized copy — all downstream JSX references remain unchanged.
  // dateOfBirth passes through from horseRaw via spread (already an ISO string from the API).
  const horse: Horse = {
    id: horseRaw.id,
    name: horseRaw.name,
    breed: resolvedBreed,
    breedId: (horseRaw as unknown as Record<string, unknown>).breedId as number | undefined,
    age: horseRaw.age,
    gender: resolvedGender,
    dateOfBirth: horseRaw.dateOfBirth,
    healthStatus: horseRaw.healthStatus,
    imageUrl: horseRaw.imageUrl,
    stats: resolvedStats,
    disciplineScores: horseRaw.disciplineScores ?? {},
    traits: horseRaw.traits,
    description: horseRaw.description,
    forSale: horseRaw.forSale,
    salePrice: horseRaw.salePrice,
    userId: horseRaw.userId,
    parentIds: horseRaw.parentIds,
    tack: (horseRaw as unknown as Record<string, unknown>).tack as
      | Record<string, unknown>
      | undefined,
  };

  // Tab configuration
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Star className="w-4 h-4" /> },
    { id: 'disciplines', label: 'Disciplines', icon: <Trophy className="w-4 h-4" /> },
    { id: 'genetics', label: 'Genetics', icon: <Users className="w-4 h-4" /> },
    { id: 'conformation', label: 'Conformation', icon: <Ruler className="w-4 h-4" /> },
    { id: 'progression', label: 'Progression', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'training', label: 'Training', icon: <Dumbbell className="w-4 h-4" /> },
    { id: 'competition', label: 'Competitions', icon: <Award className="w-4 h-4" /> },
    { id: 'pedigree', label: 'Pedigree', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'health', label: 'Health & Vet', icon: <Stethoscope className="w-4 h-4" /> },
    { id: 'tack', label: 'Tack', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'stud-sale', label: 'Stud / Sale', icon: <Tag className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/stable')}
            className="flex items-center gap-2 text-[rgb(148,163,184)] hover:text-[rgb(220,235,255)] transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Horse List
          </button>

          {/* Horse Profile Card */}
          <div className="glass-panel rounded-lg p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Horse Image */}
              <div className="w-full md:w-48 h-48 rounded-lg border border-[rgba(37,99,235,0.3)] overflow-hidden bg-[rgba(37,99,235,0.05)]">
                <img
                  src={getHorseImage(horse.imageUrl, horse.breed)}
                  alt={horse.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/horse-placeholder.png';
                  }}
                />
              </div>

              {/* Horse Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    {isEditing ? (
                      <form
                        className="flex items-center gap-2 mb-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const trimmed = editName.trim();
                          if (trimmed && trimmed !== horse.name) {
                            updateHorseMutation.mutate(
                              { horseId: horse.id, data: { name: trimmed } },
                              {
                                onSuccess: () => {
                                  toast.success('Horse name updated!');
                                  setIsEditing(false);
                                  refetch();
                                },
                                onError: (err) => {
                                  toast.error(err.message || 'Failed to update name');
                                },
                              }
                            );
                          } else {
                            setIsEditing(false);
                          }
                        }}
                      >
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                          maxLength={50}
                          className="fantasy-title text-2xl text-[rgb(220,235,255)] bg-[rgba(15,35,70,0.6)] border border-burnished-gold/40 rounded-lg px-3 py-1 outline-none focus:border-burnished-gold/70 focus:shadow-[0_0_8px_rgba(200,168,78,0.2)]"
                        />
                        <button
                          type="submit"
                          disabled={updateHorseMutation.isPending}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:brightness-110"
                          style={{
                            background:
                              'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-light) 100%)',
                            color: 'var(--bg-deep-space)',
                          }}
                        >
                          {updateHorseMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white/60 hover:text-white/90 hover:bg-white/10 border border-white/20 transition-colors"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <h1 className="fantasy-title text-3xl text-[rgb(220,235,255)] mb-2">
                        {horse.name}
                      </h1>
                    )}
                    <div className="flex flex-wrap gap-3 text-sm fantasy-body text-[rgb(180,195,215)]">
                      <span>Breed: {getBreedName(horse.breed)}</span>
                      <span>•</span>
                      <span>Color: {horse.finalDisplayColor || 'Unknown'}</span>
                      <span>•</span>
                      <span>Age: {horse.age}</span>
                      <span>•</span>
                      <span>Gender: {horse.gender}</span>
                      <span>•</span>
                      <span>Health: {horse.healthStatus}</span>
                    </div>
                    {horse.forSale && (
                      <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-emerald-900/30 border border-emerald-500/40 text-emerald-400 text-xs w-fit">
                        <ShoppingCart className="w-3 h-3" />
                        For Sale — {(horse.salePrice ?? 0).toLocaleString()} coins
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (!isEditing) setEditName(horse.name);
                      setIsEditing(!isEditing);
                    }}
                    className="p-2 hover:bg-[rgba(200,168,78,0.15)] rounded transition-colors"
                    aria-label={isEditing ? 'Cancel editing' : 'Edit horse name'}
                  >
                    {isEditing ? (
                      <X className="w-5 h-5 text-white/60" />
                    ) : (
                      <Edit className="w-5 h-5 text-[rgb(160,175,200)]" />
                    )}
                  </button>
                </div>

                {/* Description */}
                {horse.description && (
                  <p className="fantasy-body text-[rgb(220,235,255)] mb-4">{horse.description}</p>
                )}

                {/* Quick Stats Summary */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {Object.entries(horse.stats).map(([statName, value]) => (
                    <div
                      key={statName}
                      className="flex flex-col items-center p-3 bg-[rgba(15,35,70,0.4)] rounded border border-[rgba(37,99,235,0.2)]"
                    >
                      <div className={`mb-1 ${getStatColor(value)}`}>{getStatIcon(statName)}</div>
                      <span className="text-xs fantasy-caption text-[rgb(160,175,200)] capitalize">
                        {statName}
                      </span>
                      <span className="text-lg fantasy-title text-[rgb(220,235,255)]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          <Button type="button" onClick={() => navigate(`/training?horseId=${horse.id}`)}>
            <Dumbbell className="w-4 h-4" />
            Train This Horse
          </Button>
          <Button type="button" onClick={() => navigate(`/competitions?horseId=${horse.id}`)}>
            <Award className="w-4 h-4" />
            Enter Competition
          </Button>
          {horse.parentIds?.sireId && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/horses/${horse.parentIds!.sireId}`)}
            >
              <Users className="w-4 h-4" />
              View Parents
            </Button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="glass-panel rounded-lg mb-6">
          <div
            className="flex border-b border-[rgba(37,99,235,0.3)] overflow-x-auto rounded-t-lg bg-[rgba(15,35,70,0.4)]"
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
                    ? 'bg-[rgba(37,99,235,0.2)] text-[rgb(220,235,255)] border-b-2 border-burnished-gold'
                    : 'text-[rgb(160,175,200)] hover:bg-[rgba(37,99,235,0.1)] hover:text-[rgb(220,235,255)]'
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
            {activeTab === 'conformation' && <ConformationTab horseId={horse.id} />}
            {activeTab === 'progression' && <ProgressionTab horse={horse} />}
            {activeTab === 'training' && <TrainingTab horse={horse} />}
            {activeTab === 'competition' && <PlaceholderTab title="Competition Results" />}
            {activeTab === 'pedigree' && <PedigreeTab horse={horse} />}
            {activeTab === 'health' && <HealthVetTab horse={horse} />}
            {activeTab === 'tack' && <TackTab horse={horse} />}
            {activeTab === 'stud-sale' && <StudSaleTab horse={horse} />}
          </div>
        </div>
      </div>

      {/* Rider Picker Modal (Story 15-5) */}
      {showRiderPicker && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[var(--z-modal)]"
          onClick={() => setShowRiderPicker(false)}
          data-testid="rider-picker-modal"
        >
          <div
            className="bg-[rgba(10,22,40,0.98)] border border-burnished-gold/40 rounded-xl shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="fantasy-title text-lg text-[rgb(220,235,255)] mb-4">
              Assign Rider to {horse.name}
            </h3>
            {ridersLoading && (
              <p className="text-sm text-[rgb(160,175,200)] text-center py-4">Loading riders…</p>
            )}
            {!ridersLoading && (!riders || riders.length === 0) && (
              <div className="text-center py-4">
                <p className="text-sm text-[rgb(160,175,200)] mb-3">No riders hired yet.</p>
                <Link
                  to="/riders"
                  className="inline-block px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-85"
                  style={{ background: 'var(--celestial-primary)' }}
                  onClick={() => setShowRiderPicker(false)}
                >
                  Browse Rider Marketplace
                </Link>
              </div>
            )}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {riders?.map((rider: Rider) => (
                <button
                  key={rider.id}
                  type="button"
                  onClick={() => {
                    assignRiderMutation.mutate(
                      { riderId: rider.id, horseId: horse.id },
                      {
                        onSuccess: () => {
                          setShowRiderPicker(false);
                          toast.success(
                            `${rider.firstName} ${rider.lastName} assigned to ${horse.name}`
                          );
                        },
                        onError: () => {
                          toast.error('Failed to assign rider. Please try again.');
                        },
                      }
                    );
                  }}
                  disabled={assignRiderMutation.isPending}
                  className="w-full text-left px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:border-burnished-gold/40 transition-all disabled:opacity-50"
                >
                  <p className="font-bold text-[rgb(220,235,255)] text-sm">
                    {rider.firstName} {rider.lastName}
                  </p>
                  <p className="text-xs text-[rgb(160,175,200)] capitalize">
                    {rider.skillLevel} · {rider.personality}
                  </p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowRiderPicker(false)}
              className="mt-4 w-full py-2 text-sm text-[rgb(160,175,200)] hover:text-[rgb(220,235,255)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Story 12-5 — Sticky Bottom Action Bar (portal to escape stacking context) */}
      {createPortal(
        <div
          className="fixed bottom-0 left-0 right-0 z-[var(--z-modal)] bg-[rgba(10,22,40,0.95)] border-t border-burnished-gold/40 backdrop-blur-sm"
          data-testid="horse-action-bar"
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 overflow-x-auto">
            <span className="text-xs fantasy-caption text-[rgb(160,175,200)] whitespace-nowrap mr-1 flex-shrink-0">
              Quick Actions:
            </span>
            <button
              type="button"
              onClick={() => navigate(`/feed-shop?horseId=${horse.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 hover:shadow-[0_0_16px_rgba(200,168,78,0.3)] active:brightness-95"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-light) 100%)',
                color: 'var(--bg-deep-space)',
              }}
              title="Go to Feed Shop"
              data-testid="action-feed"
            >
              <span aria-hidden="true">🌾</span>
              Feed
            </button>
            <button
              type="button"
              onClick={() => navigate(`/training?horseId=${horse.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 hover:shadow-[0_0_16px_rgba(200,168,78,0.3)] active:brightness-95"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-light) 100%)',
                color: 'var(--bg-deep-space)',
              }}
              data-testid="action-train"
            >
              <Dumbbell className="w-3.5 h-3.5" />
              Train
            </button>
            <button
              type="button"
              onClick={() => navigate(`/breeding?horseId=${horse.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 hover:shadow-[0_0_16px_rgba(200,168,78,0.3)] active:brightness-95"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-light) 100%)',
                color: 'var(--bg-deep-space)',
              }}
              data-testid="action-breed"
            >
              <Heart className="w-3.5 h-3.5" />
              Breed
            </button>
            <button
              type="button"
              onClick={() => setShowRiderPicker(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 hover:shadow-[0_0_16px_rgba(200,168,78,0.3)] active:brightness-95"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-light) 100%)',
                color: 'var(--bg-deep-space)',
              }}
              title="Assign a rider to this horse"
              data-testid="action-assign-rider"
            >
              <Users className="w-3.5 h-3.5" />
              Assign Rider
            </button>
            <button
              type="button"
              onClick={() => navigate(`/grooms?horseId=${horse.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 hover:shadow-[0_0_16px_rgba(200,168,78,0.3)] active:brightness-95"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-light) 100%)',
                color: 'var(--bg-deep-space)',
              }}
              title="Assign a groom to this horse"
              data-testid="action-assign-groom"
            >
              <span aria-hidden="true">🧹</span>
              Assign Groom
            </button>
            <button
              type="button"
              onClick={() => navigate(`/tack-shop?horseId=${horse.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 hover:shadow-[0_0_16px_rgba(200,168,78,0.3)] active:brightness-95"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-light) 100%)',
                color: 'var(--bg-deep-space)',
              }}
              title="Equip tack for this horse"
              data-testid="action-equip-tack"
            >
              <span aria-hidden="true">🎠</span>
              Equip Tack
            </button>
            <button
              type="button"
              onClick={() => navigate(`/farrier?horseId=${horse.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 hover:shadow-[0_0_16px_rgba(200,168,78,0.3)] active:brightness-95"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-light) 100%)',
                color: 'var(--bg-deep-space)',
              }}
              title="Shoe this horse"
              data-testid="action-shoe-horse"
            >
              <span aria-hidden="true">🔧</span>
              Shoe Horse
            </button>
            {horse.forSale ? (
              <button
                type="button"
                onClick={() => delistHorseMutation.mutate(horse.id, { onSuccess: () => refetch() })}
                disabled={delistHorseMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-900/20 border border-red-500/40 text-red-300 text-sm fantasy-body whitespace-nowrap hover:bg-red-900/30 transition-colors disabled:opacity-50"
                data-testid="action-delist"
              >
                <X className="w-3.5 h-3.5" />
                Delist
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowListModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 hover:shadow-[0_0_16px_rgba(200,168,78,0.3)] active:brightness-95"
                style={{
                  background:
                    'linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-light) 100%)',
                  color: 'var(--bg-deep-space)',
                }}
                data-testid="action-list-for-sale"
              >
                <Tag className="w-3.5 h-3.5" />
                List for Sale
              </button>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* List for Sale Modal */}
      {showListModal && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[rgba(10,22,40,0.97)] border border-white/20 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white/90">List for Sale</h2>
              <button
                type="button"
                onClick={() => {
                  setShowListModal(false);
                  setListPrice('');
                }}
                className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-white/60 mb-4">
              Set a price for <span className="text-white/90 font-medium">{horse.name}</span>. Other
              players will be able to purchase this horse.
            </p>
            <div className="mb-5">
              <label className="block text-xs text-white/50 mb-1.5">Price (coins)</label>
              <input
                type="number"
                min={100}
                max={9999999}
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="Min 100 — Max 9,999,999"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white/90 text-sm focus:outline-none focus:border-white/40"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowListModal(false);
                  setListPrice('');
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={listHorseMutation.isPending || !listPrice || Number(listPrice) < 100}
                onClick={() => {
                  listHorseMutation.mutate(
                    { horseId: horse.id, price: Number(listPrice) },
                    {
                      onSuccess: () => {
                        setShowListModal(false);
                        setListPrice('');
                        refetch();
                      },
                    }
                  );
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-emerald-600/80 border border-emerald-500/40 text-white text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {listHorseMutation.isPending ? 'Listing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{ horse: Horse }> = ({ horse }) => (
  <div className="space-y-6">
    <div>
      <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-3">Current Status</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-[rgba(15,35,70,0.4)] rounded border border-[rgba(37,99,235,0.2)]">
          <p className="fantasy-caption text-[rgb(160,175,200)] mb-1">Health Status</p>
          <p className="fantasy-body text-[rgb(220,235,255)]">{horse.healthStatus}</p>
        </div>
        <div className="p-4 bg-[rgba(15,35,70,0.4)] rounded border border-[rgba(37,99,235,0.2)]">
          <p className="fantasy-caption text-[rgb(160,175,200)] mb-1">Age</p>
          <p className="fantasy-body text-[rgb(220,235,255)]">{horse.age} years old</p>
        </div>
        <div className="p-4 bg-[rgba(15,35,70,0.4)] rounded border border-[rgba(37,99,235,0.2)]">
          <p className="fantasy-caption text-[rgb(160,175,200)] mb-1">Date of Birth</p>
          <p className="fantasy-body text-[rgb(220,235,255)]">
            {typeof horse.dateOfBirth === 'string' && !isNaN(new Date(horse.dateOfBirth).getTime())
              ? new Date(horse.dateOfBirth).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Not recorded'}
          </p>
        </div>
        <div className="p-4 bg-[rgba(15,35,70,0.4)] rounded border border-[rgba(37,99,235,0.2)]">
          <p className="fantasy-caption text-[rgb(160,175,200)] mb-1">Gender</p>
          <p className="fantasy-body text-[rgb(220,235,255)] capitalize">{horse.gender}</p>
        </div>
      </div>
    </div>

    {horse.traits && horse.traits.length > 0 && (
      <div>
        <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-3">Traits</h3>
        <div className="flex flex-wrap gap-2">
          {horse.traits.map((trait, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-burnished-gold/20 text-[rgb(220,235,255)] rounded-full text-sm fantasy-body border border-burnished-gold/40"
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
        <p className="fantasy-body text-[rgb(160,175,200)]">
          This horse has not trained in any disciplines yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4">Discipline Scores</h3>
      {disciplines.map(([discipline, score]) => (
        <div key={discipline} className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="fantasy-body text-[rgb(220,235,255)]">{discipline}</span>
            <span className={`fantasy-title ${getStatColor(score)}`}>{score}</span>
          </div>
          <div className="h-3 bg-[rgba(15,35,70,0.5)] rounded-full overflow-hidden border border-[rgba(37,99,235,0.2)]">
            <div
              className={`h-full transition-all ${
                score >= 90
                  ? 'bg-burnished-gold'
                  : score >= 75
                    ? 'bg-emerald-500'
                    : score >= 60
                      ? 'bg-aged-bronze'
                      : 'bg-[rgb(148,163,184)]'
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
  const allTraits = filteredTraits;

  // Loading state
  if (epigeneticLoading || interactionsLoading || timelineLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-burnished-gold" />
        <span className="ml-3 text-[rgb(160,175,200)]">Loading genetics data...</span>
      </div>
    );
  }

  // Error state
  if (epigeneticError || interactionsError || timelineError) {
    return (
      <div className="glass-panel p-6 border border-red-500/30 rounded-lg">
        <div className="flex items-center text-red-400 mb-2">
          <AlertCircle className="w-5 h-5 mr-2" />
          <h4 className="font-semibold">Error Loading Genetics Data</h4>
        </div>
        <p className="text-red-400 text-sm">
          {epigeneticError?.message || interactionsError?.message || timelineError?.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Sorting */}
      <div className="bg-[rgba(15,35,70,0.4)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
        <div className="flex items-center mb-4">
          <Filter className="w-5 h-5 text-[rgb(160,175,200)] mr-2" />
          <h4 className="font-semibold text-[rgb(220,235,255)]">Filters & Sorting</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Type Filter */}
          <div>
            <label className="block text-sm text-[rgb(160,175,200)] mb-2">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'genetic' | 'epigenetic')}
              className="celestial-input w-full"
            >
              <option value="all">All Types</option>
              <option value="genetic">Genetic</option>
              <option value="epigenetic">Epigenetic</option>
            </select>
          </div>

          {/* Rarity Filter */}
          <div>
            <label className="block text-sm text-[rgb(160,175,200)] mb-2">Rarity</label>
            <select
              value={filterRarity}
              onChange={(e) =>
                setFilterRarity(e.target.value as 'all' | 'common' | 'rare' | 'legendary')
              }
              className="celestial-input w-full"
            >
              <option value="all">All Rarities</option>
              <option value="common">Common</option>
              <option value="rare">Rare</option>
              <option value="legendary">Legendary</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-sm text-[rgb(160,175,200)] mb-2">Source</label>
            <select
              value={filterSource}
              onChange={(e) =>
                setFilterSource(e.target.value as 'all' | 'sire' | 'dam' | 'mutation')
              }
              className="celestial-input w-full"
            >
              <option value="all">All Sources</option>
              <option value="sire">From Sire</option>
              <option value="dam">From Dam</option>
              <option value="mutation">Mutation</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm text-[rgb(160,175,200)] mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'name' | 'rarity' | 'strength' | 'discoveryDate')
              }
              className="celestial-input w-full"
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
        <div className="glass-panel p-6 rounded-lg border border-burnished-gold/30">
          <h3 className="fantasy-title text-2xl text-[rgb(220,235,255)] mb-6 flex items-center">
            <Sparkles className="w-6 h-6 mr-2 text-burnished-gold" />
            Genetic Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Genetic Potential */}
            <div className="bg-[rgba(15,35,70,0.5)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
              <div className="text-sm text-[rgb(160,175,200)] mb-2 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                Genetic Potential
              </div>
              <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">
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
              <div className="h-3 bg-[rgba(15,35,70,0.6)] rounded-full overflow-hidden">
                <div
                  className={`h-full ${(() => {
                    const rarityScores = allTraits.map((t) =>
                      t.rarity === 'legendary' ? 100 : t.rarity === 'rare' ? 70 : 40
                    );
                    const avgScore = Math.round(
                      rarityScores.reduce((a, b) => a + b, 0) / rarityScores.length
                    );
                    return avgScore >= 80
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                      : avgScore >= 60
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                        : avgScore >= 40
                          ? 'bg-gradient-to-r from-burnished-gold to-aged-bronze'
                          : 'bg-gradient-to-r from-[rgba(148,163,184,0.6)] to-[rgba(148,163,184,0.4)]';
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
              <p className="text-xs text-[rgb(160,175,200)] mt-2">
                Based on {allTraits.length} trait{allTraits.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Trait Stability */}
            <div className="bg-[rgba(15,35,70,0.5)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
              <div className="text-sm text-[rgb(160,175,200)] mb-2 flex items-center">
                <Shield className="w-4 h-4 mr-1" />
                Trait Stability
              </div>
              <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">
                {(() => {
                  const geneticCount = geneticTraits.length;
                  const totalCount = allTraits.length;
                  const stability =
                    totalCount > 0 ? Math.round((geneticCount / totalCount) * 100) : 0;
                  return stability;
                })()}
                %
              </div>
              <div className="h-3 bg-[rgba(15,35,70,0.6)] rounded-full overflow-hidden">
                <div
                  className={`h-full ${(() => {
                    const geneticCount = geneticTraits.length;
                    const totalCount = allTraits.length;
                    const stability =
                      totalCount > 0 ? Math.round((geneticCount / totalCount) * 100) : 0;
                    return stability >= 75
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                      : stability >= 50
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                        : 'bg-gradient-to-r from-burnished-gold to-aged-bronze';
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
              <p className="text-xs text-[rgb(160,175,200)] mt-2">
                {geneticTraits.length} genetic / {allTraits.length} total
              </p>
            </div>

            {/* Breeding Value */}
            <div className="bg-[rgba(15,35,70,0.5)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
              <div className="text-sm text-[rgb(160,175,200)] mb-2 flex items-center">
                <Award className="w-4 h-4 mr-1" />
                Breeding Value
              </div>
              <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">
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
              <div className="h-3 bg-[rgba(15,35,70,0.6)] rounded-full overflow-hidden">
                <div
                  className={`h-full ${(() => {
                    const legendaryCount = allTraits.filter((t) => t.rarity === 'legendary').length;
                    const rareCount = allTraits.filter((t) => t.rarity === 'rare').length;
                    const value = Math.min(
                      100,
                      legendaryCount * 30 + rareCount * 10 + geneticTraits.length * 2
                    );
                    return value >= 70
                      ? 'bg-gradient-to-r from-burnished-gold to-aged-bronze'
                      : value >= 40
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                        : 'bg-gradient-to-r from-[rgba(148,163,184,0.6)] to-[rgba(148,163,184,0.4)]';
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
              <p className="text-xs text-[rgb(160,175,200)] mt-2">
                {allTraits.filter((t) => t.rarity !== 'common').length} rare+ traits
              </p>
            </div>

            {/* Optimal Combinations */}
            <div className="bg-[rgba(15,35,70,0.5)] p-4 rounded-lg border border-[rgba(37,99,235,0.2)]">
              <div className="text-sm text-[rgb(160,175,200)] mb-2 flex items-center">
                <Sparkles className="w-4 h-4 mr-1" />
                Optimal Combos
              </div>
              <div className="text-3xl font-bold text-[rgb(220,235,255)] mb-2">
                {interactionsData?.interactions?.filter((i) => i.strength >= 75).length || 0}
              </div>
              <div className="text-sm text-[rgb(160,175,200)] mb-2">
                {interactionsData?.interactions?.filter((i) => i.strength >= 50 && i.strength < 75)
                  .length || 0}{' '}
                good
              </div>
              <p className="text-xs text-[rgb(160,175,200)] mt-2">High-value trait synergies</p>
            </div>
          </div>

          {/* Breeding Recommendations */}
          {interactionsData?.interactions &&
            interactionsData.interactions.some((i) => i.strength >= 75) && (
              <div className="mt-4 p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                <p className="text-sm text-emerald-400 flex items-center">
                  <Award className="w-4 h-4 mr-2" />
                  <strong>Prime Breeding Candidate:</strong>&nbsp;This horse has{' '}
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
          <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4">
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
          <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4">
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
          <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4">
            Trait Interactions ({interactionsData.interactions.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interactionsData.interactions.map((interaction, index) => (
              <div
                key={index}
                className="p-4 bg-[rgba(37,99,235,0.08)] rounded-lg border border-purple-500/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-purple-400">
                    {interaction.trait1} + {interaction.trait2}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      interaction.strength >= 75
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : interaction.strength >= 50
                          ? 'bg-burnished-gold/20 text-burnished-gold'
                          : 'bg-[rgba(37,99,235,0.15)] text-[rgb(148,163,184)]'
                    }`}
                  >
                    Strength: {interaction.strength}
                  </span>
                </div>
                <p className="text-sm text-[rgb(220,235,255)]">{interaction.effect}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trait Timeline Section */}
      {timelineData?.timeline && timelineData.timeline.length > 0 && (
        <div>
          <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4">
            Trait Development Timeline ({timelineData.timeline.length})
          </h3>
          <div className="space-y-3">
            {timelineData.timeline.map((entry) => (
              <div
                key={entry.id}
                className="p-4 bg-[rgba(15,35,70,0.4)] rounded-lg border-l-4 border-[rgba(37,99,235,0.5)]"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        entry.eventType === 'discovered'
                          ? 'bg-purple-500/20 text-purple-400'
                          : entry.eventType === 'activated'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : entry.eventType === 'deactivated'
                              ? 'bg-[rgba(37,99,235,0.15)] text-[rgb(148,163,184)]'
                              : entry.eventType === 'mutated'
                                ? 'bg-burnished-gold/20 text-burnished-gold'
                                : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {entry.eventType.charAt(0).toUpperCase() + entry.eventType.slice(1)}
                    </span>
                    <span className="text-sm font-semibold text-[rgb(220,235,255)]">
                      {entry.traitName}
                    </span>
                  </div>
                  <span className="text-xs text-[rgb(160,175,200)]">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </span>
                </div>
                {entry.description && (
                  <p className="text-sm text-[rgb(220,235,255)] mb-2">{entry.description}</p>
                )}
                {entry.source && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[rgb(160,175,200)]">
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
        <div className="text-center py-8 text-[rgb(160,175,200)]">
          <p>No traits match the current filters.</p>
        </div>
      )}

      {/* Lineage Section with Genetic Contribution */}
      {horse.parentIds && (
        <div>
          <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4">
            Lineage & Genetic Contribution
          </h3>

          {/* Genetic Contribution Visualization */}
          {allTraits.length > 0 && (
            <div className="mb-6 p-4 glass-panel rounded-lg border border-[rgba(37,99,235,0.2)]">
              <h4 className="text-sm font-semibold text-[rgb(220,235,255)] mb-3">
                Genetic Contribution
              </h4>

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
                    <div className="flex h-8 rounded-lg overflow-hidden border border-[rgba(37,99,235,0.3)] mb-3">
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
                        <span className="text-[rgb(220,235,255)]">
                          Sire: <strong>{sireTraits}</strong> ({sirePercentage}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-gradient-to-r from-purple-500 to-purple-600"></div>
                        <span className="text-[rgb(220,235,255)]">
                          Dam: <strong>{damTraits}</strong> ({damPercentage}%)
                        </span>
                      </div>
                      {mutationTraits > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-gradient-to-r from-burnished-gold to-aged-bronze"></div>
                          <span className="text-[rgb(220,235,255)]">
                            Mutations: <strong>{mutationTraits}</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Analysis */}
                    {inheritedTotal > 0 && (
                      <div className="mt-3 pt-3 border-t border-[rgba(37,99,235,0.2)]">
                        <p className="text-xs text-[rgb(160,175,200)]">
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
                onClick={() => (window.location.href = `/horses/${horse.parentIds!.sireId}`)}
                className="p-4 bg-[rgba(15,35,70,0.4)] rounded border border-[rgba(37,99,235,0.2)] hover:border-burnished-gold/50 transition-colors text-left"
              >
                <p className="fantasy-caption text-[rgb(160,175,200)] mb-1">Sire</p>
                <p className="fantasy-body text-[rgb(220,235,255)]">View Sire Details →</p>
              </button>
            )}
            {horse.parentIds.damId && (
              <button
                onClick={() => (window.location.href = `/horses/${horse.parentIds!.damId}`)}
                className="p-4 bg-[rgba(15,35,70,0.4)] rounded border border-[rgba(37,99,235,0.2)] hover:border-burnished-gold/50 transition-colors text-left"
              >
                <p className="fantasy-caption text-[rgb(160,175,200)] mb-1">Dam</p>
                <p className="fantasy-body text-[rgb(220,235,255)]">View Dam Details →</p>
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
      <div className="bg-[rgba(15,35,70,0.4)] rounded-lg border border-[rgba(37,99,235,0.2)] p-6">
        <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-3 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-[rgb(160,175,200)]" />
          Training Status
        </h3>

        {isStatusLoading ? (
          <div
            className="flex items-center text-[rgb(160,175,200)]"
            data-testid="training-status-loading"
          >
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading training status...
          </div>
        ) : isIneligibleDueToAge ? (
          <div className="flex items-center text-red-400" data-testid="training-status-ineligible">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{eligibility.reason}</span>
          </div>
        ) : isOnCooldown || isIneligibleDueToCooldown ? (
          <div
            className="flex items-center text-burnished-gold"
            data-testid="training-status-cooldown"
          >
            <Clock className="w-5 h-5 mr-2" />
            <span>
              Next training available in:{' '}
              {formatCooldownDisplay(
                globalCooldown || (eligibility.reason?.match(/until (.+)$/)?.[1] ?? null)
              )}
            </span>
          </div>
        ) : (
          <div className="flex items-center text-emerald-400" data-testid="training-status-ready">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span>Ready to train!</span>
          </div>
        )}
      </div>

      {/* Age/Eligibility Warning - only show for age-based ineligibility */}
      {isIneligibleDueToAge && (
        <div
          className="glass-panel border border-red-500/30 rounded-lg p-4"
          data-testid="training-eligibility-warning"
        >
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-400">Training Not Available</h4>
              <p className="text-sm text-red-400/80 mt-1">{eligibility.reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Discipline Picker Section */}
      {(eligibility.eligible || isIneligibleDueToCooldown) && (
        <div className="glass-panel rounded-lg p-6">
          <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4 flex items-center">
            <Dumbbell className="w-5 h-5 mr-2 text-[rgb(160,175,200)]" />
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
          className="glass-panel border border-red-500/30 rounded-lg p-4"
          data-testid="training-error"
        >
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-400">Training Error</h4>
              <p className="text-sm text-red-400/80 mt-1">{trainingError}</p>
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
      <XpProgressBar horseId={horse.id} />
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
    <h3 className="fantasy-title text-2xl text-[rgb(220,235,255)] mb-4">{title}</h3>
    <p className="fantasy-body text-[rgb(160,175,200)]">
      This section is coming soon. Check back later for updates!
    </p>
  </div>
);

// Pedigree Tab Component — Story 12-4
const PedigreeTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const hasSire = Boolean(horse.parentIds?.sireId);
  const hasDam = Boolean(horse.parentIds?.damId);
  const _hasAnyParent = hasSire || hasDam;

  return (
    <div className="space-y-6" data-testid="pedigree-tab">
      <div>
        <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-3">Family Tree</h3>
        <p className="fantasy-body text-[rgb(160,175,200)] text-sm mb-6">
          Parentage and bloodline information for {horse.name}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sire */}
        <div
          className="p-5 bg-[rgba(15,35,70,0.4)] rounded-lg border border-[rgba(37,99,235,0.2)]"
          data-testid="pedigree-sire"
        >
          <p className="fantasy-caption text-[rgb(160,175,200)] mb-1 text-xs uppercase tracking-wider">
            Sire (Father)
          </p>
          {hasSire ? (
            <Link
              to={`/horses/${horse.parentIds!.sireId}`}
              className="fantasy-title text-lg text-burnished-gold hover:text-[rgb(220,235,255)] transition-colors flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4" />
              View Sire Profile
            </Link>
          ) : (
            <p className="fantasy-title text-lg text-[rgb(148,163,184)]">Store Horse</p>
          )}
        </div>

        {/* Dam */}
        <div
          className="p-5 bg-[rgba(15,35,70,0.4)] rounded-lg border border-[rgba(37,99,235,0.2)]"
          data-testid="pedigree-dam"
        >
          <p className="fantasy-caption text-[rgb(160,175,200)] mb-1 text-xs uppercase tracking-wider">
            Dam (Mother)
          </p>
          {hasDam ? (
            <Link
              to={`/horses/${horse.parentIds!.damId}`}
              className="fantasy-title text-lg text-burnished-gold hover:text-[rgb(220,235,255)] transition-colors flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4" />
              View Dam Profile
            </Link>
          ) : (
            <p className="fantasy-title text-lg text-[rgb(148,163,184)]">Store Horse</p>
          )}
        </div>
      </div>

      {/* Offspring section — future expansion */}
      <div className="p-4 bg-[rgba(15,35,70,0.3)] rounded-lg border border-[rgba(37,99,235,0.15)]">
        <p className="fantasy-caption text-[rgb(160,175,200)] text-xs uppercase tracking-wider mb-1">
          Offspring
        </p>
        <p className="fantasy-body text-[rgb(160,175,200)] text-sm italic">
          Offspring records are displayed once this horse has produced foals through the breeding
          system.
        </p>
      </div>
    </div>
  );
};

// Health & Vet Tab Component — Story 12-4
// Mock vet history — replaced by live API in Story 12-5 wire-up
interface VetRecord {
  date: string;
  type: string;
  result: string;
  vet: string;
}

const MOCK_VET_HISTORY: VetRecord[] = [
  {
    date: '2026-02-10',
    type: 'Health Check',
    result: 'Excellent — cleared for competition',
    vet: 'Dr. Ashwood',
  },
  {
    date: '2026-01-15',
    type: 'Injury Assessment',
    result: 'Minor strain — 3 days rest advised',
    vet: 'Dr. Whitmore',
  },
  {
    date: '2025-12-01',
    type: 'Annual Vaccination',
    result: 'Complete — all vaccines administered',
    vet: 'Dr. Ashwood',
  },
];

const HealthVetTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const healthColor =
    horse.healthStatus?.toLowerCase() === 'healthy'
      ? 'text-emerald-400'
      : horse.healthStatus?.toLowerCase().includes('injured')
        ? 'text-burnished-gold'
        : 'text-[rgb(160,175,200)]';

  return (
    <div className="space-y-6" data-testid="health-vet-tab">
      {/* Current Status */}
      <div>
        <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-3">
          Current Health Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[rgba(15,35,70,0.4)] rounded-lg border border-[rgba(37,99,235,0.2)]">
            <p className="fantasy-caption text-[rgb(160,175,200)] mb-1 text-xs uppercase tracking-wider">
              Status
            </p>
            <p className={`fantasy-title text-xl ${healthColor}`}>{horse.healthStatus}</p>
          </div>
          <div className="p-4 bg-[rgba(15,35,70,0.4)] rounded-lg border border-[rgba(37,99,235,0.2)]">
            <p className="fantasy-caption text-[rgb(160,175,200)] mb-1 text-xs uppercase tracking-wider">
              Next Recommended Check
            </p>
            <p className="fantasy-body text-[rgb(220,235,255)]">6 weeks from last visit</p>
          </div>
        </div>
      </div>

      {/* Vet History */}
      <div>
        <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-3">Veterinary History</h3>
        {MOCK_VET_HISTORY.length === 0 ? (
          <div className="text-center py-8 bg-[rgba(15,35,70,0.3)] rounded-lg border border-[rgba(37,99,235,0.15)]">
            <Stethoscope className="w-8 h-8 text-[rgb(160,175,200)]/40 mx-auto mb-2" />
            <p className="fantasy-body text-[rgb(160,175,200)]">No vet records on file.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {MOCK_VET_HISTORY.map((record, idx) => (
              <div
                key={idx}
                className="p-4 bg-[rgba(15,35,70,0.4)] rounded-lg border border-[rgba(37,99,235,0.2)] hover:border-burnished-gold/40 transition-colors"
                data-testid={`vet-record-${idx}`}
              >
                <div className="flex items-start justify-between mb-1">
                  <p className="fantasy-title text-[rgb(220,235,255)] text-sm">{record.type}</p>
                  <span className="text-xs fantasy-caption text-[rgb(160,175,200)] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(record.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="fantasy-body text-[rgb(220,235,255)] text-sm mb-1">{record.result}</p>
                <p className="fantasy-caption text-[rgb(160,175,200)] text-xs">Vet: {record.vet}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Book Appointment CTA */}
      <div className="p-4 bg-[rgba(15,35,70,0.3)] rounded-lg border border-[rgba(37,99,235,0.15)] flex items-center justify-between">
        <div>
          <p className="fantasy-title text-[rgb(220,235,255)] text-sm">Need a Vet Appointment?</p>
          <p className="fantasy-body text-[rgb(160,175,200)] text-sm">
            Visit the Vet Clinic to book a health check or treatment.
          </p>
        </div>
        <Link
          to="/vet"
          className="px-4 py-2 bg-[rgba(37,99,235,0.1)] border border-[rgba(37,99,235,0.3)] rounded-lg text-sm fantasy-body text-[rgb(160,175,200)] hover:bg-[rgba(37,99,235,0.2)] transition-colors whitespace-nowrap"
        >
          Go to Vet Clinic
        </Link>
      </div>
    </div>
  );
};

// Stud / Sale Tab Component — Story 12-4 / 15-5
const StudSaleTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const isMale =
    horse.gender?.toLowerCase() === 'stallion' || horse.gender?.toLowerCase() === 'male';
  const isFemale =
    horse.gender?.toLowerCase() === 'mare' || horse.gender?.toLowerCase() === 'female';

  return (
    <div className="space-y-6" data-testid="stud-sale-tab">
      <div>
        <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-2">Listing Options</h3>
        <p className="fantasy-body text-[rgb(160,175,200)] text-sm">
          List {horse.name} as a stud service or for outright sale. Pricing and listing management
          will be wired to the live API in a future update.
        </p>
      </div>

      {/* Current Listing Status */}
      <div className="p-4 bg-[rgba(15,35,70,0.4)] rounded-lg border border-[rgba(37,99,235,0.2)]">
        <p className="fantasy-caption text-[rgb(160,175,200)] text-xs uppercase tracking-wider mb-1">
          Current Status
        </p>
        <p className="fantasy-title text-lg text-[rgb(220,235,255)]">Not Listed</p>
      </div>

      {/* Listing Type Buttons */}
      <div className="space-y-3">
        {isMale && (
          <button
            type="button"
            onClick={() => toast.info('Stud listing is coming in a future update. Stay tuned!')}
            className="w-full flex items-center justify-between p-4 bg-[rgba(15,35,70,0.3)] rounded-lg border border-[rgba(37,99,235,0.15)] text-left hover:border-[rgba(37,99,235,0.3)] transition-colors"
            title="Stud listing — coming in a future update"
            data-testid="stud-listing-btn"
          >
            <div>
              <p className="fantasy-title text-[rgb(220,235,255)] text-sm">Offer as Stud Service</p>
              <p className="fantasy-body text-[rgb(160,175,200)] text-xs mt-0.5">
                Other players can pay a breeding fee to use {horse.name}
              </p>
            </div>
            <span className="text-xs fantasy-caption text-[rgb(160,175,200)]">Coming Soon</span>
          </button>
        )}

        {!isFemale && !isMale && (
          <div className="p-4 bg-[rgba(15,35,70,0.3)] rounded-lg border border-[rgba(37,99,235,0.1)]">
            <p className="fantasy-body text-[rgb(160,175,200)] text-sm italic">
              Stud listing is only available for stallions.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            toast.info('Horse marketplace listing is coming in a future update. Stay tuned!')
          }
          className="w-full flex items-center justify-between p-4 bg-[rgba(15,35,70,0.3)] rounded-lg border border-[rgba(37,99,235,0.15)] text-left hover:border-[rgba(37,99,235,0.3)] transition-colors"
          title="Sale listing — coming in a future update"
          data-testid="sale-listing-btn"
        >
          <div>
            <p className="fantasy-title text-[rgb(220,235,255)] text-sm">List for Sale</p>
            <p className="fantasy-body text-[rgb(160,175,200)] text-xs mt-0.5">
              Place {horse.name} on the Marketplace for other players to purchase
            </p>
          </div>
          <span className="text-xs fantasy-caption text-[rgb(160,175,200)]">Coming Soon</span>
        </button>
      </div>

      {/* Marketplace Link */}
      <div className="p-4 bg-[rgba(15,35,70,0.3)] rounded-lg border border-[rgba(37,99,235,0.15)] flex items-center justify-between">
        <div>
          <p className="fantasy-title text-[rgb(220,235,255)] text-sm">Browse the Marketplace</p>
          <p className="fantasy-body text-[rgb(160,175,200)] text-sm">
            See horses listed for sale by other players.
          </p>
        </div>
        <Link
          to="/marketplace"
          className="px-4 py-2 bg-[rgba(37,99,235,0.1)] border border-[rgba(37,99,235,0.3)] rounded-lg text-sm fantasy-body text-[rgb(160,175,200)] hover:bg-[rgba(37,99,235,0.2)] transition-colors whitespace-nowrap"
        >
          Marketplace
        </Link>
      </div>
    </div>
  );
};

// ── Tack condition helpers ───────────────────────────────────────────────────

const TACK_DISPLAY_CATEGORIES = [
  { key: 'saddle', label: 'Saddle' },
  { key: 'bridle', label: 'Bridle' },
  { key: 'halter', label: 'Halter' },
  { key: 'saddle_pad', label: 'Saddle Pad' },
  { key: 'leg_wraps', label: 'Leg Wraps' },
  { key: 'reins', label: 'Reins' },
  { key: 'girth', label: 'Girth' },
  { key: 'breastplate', label: 'Breastplate' },
];

function getTackConditionValue(tack: Record<string, unknown>, category: string): number {
  const val = tack[`${category}_condition`];
  return typeof val === 'number' ? val : 100;
}

function conditionColorClasses(condition: number): { bar: string; text: string; label: string } {
  if (condition >= 75) return { bar: 'bg-green-500', text: 'text-green-400', label: 'Good' };
  if (condition >= 50) return { bar: 'bg-yellow-500', text: 'text-yellow-400', label: 'Fair' };
  if (condition >= 25) return { bar: 'bg-orange-500', text: 'text-orange-400', label: 'Poor' };
  return { bar: 'bg-red-500', text: 'text-red-400', label: condition <= 0 ? 'Broken' : 'Critical' };
}

// Tack Tab Component — shows equipped items with condition colour coding
const TackTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const tack = horse.tack;

  const equippedItems = TACK_DISPLAY_CATEGORIES.filter(
    ({ key }) => tack && typeof tack[key] === 'string'
  );

  if (!tack || equippedItems.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="w-10 h-10 text-[rgb(148,163,184)]/40 mx-auto mb-4" />
        <p className="fantasy-body text-[rgb(160,175,200)] mb-2">No tack equipped</p>
        <p className="text-sm text-[rgb(148,163,184)] mb-4">
          Visit the Tack Shop to equip saddles, bridles, and more.
        </p>
        <Link
          to="/tack-shop"
          className="text-sm text-burnished-gold hover:text-[rgb(220,235,255)] underline transition-colors"
        >
          Go to Tack Shop →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="fantasy-title text-xl text-[rgb(220,235,255)] mb-4">Equipped Tack</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {equippedItems.map(({ key, label }) => {
          const itemId = tack[key] as string;
          const condition = getTackConditionValue(tack, key);
          const colors = conditionColorClasses(condition);

          return (
            <div
              key={key}
              className="p-4 bg-[rgba(15,35,70,0.4)] rounded border border-[rgba(37,99,235,0.2)]"
              data-testid={`tack-condition-${key}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="fantasy-caption text-[rgb(160,175,200)] capitalize">{label}</span>
                <span className={`text-xs font-semibold ${colors.text}`}>{colors.label}</span>
              </div>
              <p className="fantasy-body text-[rgb(220,235,255)] text-sm mb-3 truncate">{itemId}</p>

              {/* Condition progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-[rgba(15,35,70,0.6)] rounded-full overflow-hidden border border-[rgba(37,99,235,0.15)]">
                  <div
                    className={`h-full transition-all ${colors.bar}`}
                    style={{ width: `${Math.max(0, Math.min(100, condition))}%` }}
                    role="progressbar"
                    aria-valuenow={condition}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${label} condition: ${condition}%`}
                  />
                </div>
                <span className={`text-xs font-medium w-8 text-right shrink-0 ${colors.text}`}>
                  {condition}%
                </span>
              </div>

              {condition < 50 && (
                <p className="text-xs text-[rgb(148,163,184)] mt-2 italic">
                  {condition <= 0
                    ? 'Broken — provides no bonus. Repair to restore.'
                    : 'Below 50% — bonus is halved. Consider repairing.'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-right">
        <Link
          to="/tack-shop"
          className="text-sm text-burnished-gold hover:text-[rgb(220,235,255)] underline transition-colors"
        >
          Manage tack in Tack Shop →
        </Link>
      </div>
    </div>
  );
};

export default HorseDetailPage;
