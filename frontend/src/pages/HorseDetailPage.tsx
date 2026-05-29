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

import React, { lazy, Suspense, useState, useEffect, useCallback, useMemo } from 'react';
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
  Award,
  Edit,
  Users,
  AlertCircle,
  Loader2,
  Ruler,
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
  Dumbbell,
  TrendingUp,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useHorse, useUpdateHorse } from '../hooks/api/useHorses';
import { useFeedHorse } from '../hooks/api/useFeedHorse';
import HealthBadge from '../components/horse/HealthBadge';
import PregnancyFeedingPanel from '../components/horse/PregnancyFeedingPanel';
import XpProgressBar from '../components/horse/XpProgressBar';
import StatProgressionChart from '../components/horse/StatProgressionChart';
import RecentGains from '../components/horse/RecentGains';
import AgeUpCounter from '../components/horse/AgeUpCounter';
import TrainingRecommendations from '../components/horse/TrainingRecommendations';
import ConformationTab from '../components/horse/ConformationTab';
// Equoria-ga5g — render markings (face / legs / advanced / modifiers) from phenotype JSONB
import MarkingsPanel from '../components/horse/MarkingsPanel';
// Equoria-aa6b — walk/trot/canter/gallop + breed-specific gait scores tab
import GaitsTab from '../components/horse/GaitsTab';
// Equoria-876o — reference modal for the 11 temperament definitions
import TemperamentReferenceModal from '../components/horse/TemperamentReferenceModal';
import ScoreProgressionPanel from '../components/training/ScoreProgressionPanel';
import { SkeletonBase } from '@/components/ui/SkeletonCard';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRiders, useAssignRider, type Rider } from '@/hooks/api/useRiders';
import { useListHorse, useDelistHorse } from '@/hooks/api/useMarketplace';
import { useListAtStud, useUnlistAtStud } from '@/hooks/api/useStudListing';
import { getHorseImage, getHorseImageStyle } from '@/lib/breed-images';
import { getBreedName } from '@/lib/utils';
// Competition history (Story 5-3)
import CompetitionHistory from '@/components/competition/CompetitionHistory';
import { useHorseCompetitionHistory } from '@/hooks/api/useHorseCompetitionHistory';
import { useHorseUltraRareTraits } from '@/hooks/api/useUltraRareTraits';
import CinematicMoment from '@/components/feedback/CinematicMoment';
import { hasSeenEvent, markEventSeen } from '@/lib/traitEventSeen';
// Shared types for page + lazy tabs
import type { Horse, HorseStats } from './horse-detail/HorseDetailPageTypes';

// Heavy tab sub-panels — lazy loaded so they only enter the bundle when first selected
const GeneticsTab = lazy(() => import('./horse-detail/GeneticsTab'));
// Equoria-ea3n + Equoria-oovy — 31E-4 dedicated Color & Genetics panel sourced
// from the GET /horses/:id/color and /horses/:id/genetics endpoints (not the
// main horse payload).
const CoatTab = lazy(() => import('./horse-detail/CoatTab'));
const TrainingTab = lazy(() => import('./horse-detail/TrainingTab'));

type TabType =
  | 'overview'
  | 'disciplines'
  | 'genetics'
  | 'coat'
  | 'conformation'
  | 'gaits'
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
  if (value >= 60) return 'text-[var(--text-secondary)]';
  return 'text-[var(--text-secondary)]';
};

const HorseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showRiderPicker, setShowRiderPicker] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  // Equoria-876o — temperament reference modal trigger
  const [showTemperamentReference, setShowTemperamentReference] = useState(false);
  const [listPrice, setListPrice] = useState('');

  const listHorseMutation = useListHorse();
  const delistHorseMutation = useDelistHorse();
  const updateHorseMutation = useUpdateHorse();
  // Feed-system redesign 2026-04-29 (A16): per-horse feed action.
  const feedHorseMutation = useFeedHorse(Number(id));

  // Auth — needed to fetch user's riders
  const { user } = useAuth();

  // Rider assignment (Story 15-5)
  const { data: riders, isLoading: ridersLoading } = useUserRiders(user?.id ?? 0);
  const assignRiderMutation = useAssignRider();

  // Fetch horse data — use `horseRaw` so the normalized copy can be named `horse` below,
  // keeping all downstream JSX references unchanged.
  const { data: horseRaw, isLoading, isError, error, refetch } = useHorse(Number(id));

  // Sire lookup for the in-foal panel (B6, Equoria-ta4s). useHorse() is
  // disabled when its argument is falsy (`enabled: Boolean(horseId)`), so
  // 0 here means "not pregnant or sire not yet known — skip the fetch."
  const pregnancySireId = horseRaw?.pregnancySireId ?? 0;
  const { data: sireHorse } = useHorse(Number(pregnancySireId) || 0);

  // Fetch competition history — must be called before any early returns (Rules of Hooks).
  // Disabled until horse is loaded and competition tab is active.
  const { data: competitionHistoryData, isLoading: isCompHistoryLoading } =
    useHorseCompetitionHistory(
      !isLoading && !isError && !!horseRaw && activeTab === 'competition' ? Number(id) : null
    );

  // Equoria-gt6j — surface UltraRareTraitEvent reveals. The backend
  // (Equoria-d4tl) auto-populates UltraRareTraitEvent rows on milestone
  // boundaries; here we show a one-time CinematicMoment for the most recent
  // event the player hasn't seen yet. "Seen" is tracked in a single bounded
  // localStorage key via traitEventSeen (Equoria-o7c0x L7) so storage cannot
  // grow unboundedly (capped at URT_SEEN_MAX=100 ids, FIFO eviction).
  const { data: ultraRareData } = useHorseUltraRareTraits(
    !isLoading && !isError && !!horseRaw ? Number(id) : undefined
  );

  // Equoria-p30y1: the reveal is DERIVED state — useMemo on the
  // latest event id, not setState-from-useEffect. This eliminates two
  // stale-closure / re-pop bugs:
  //   1) The old useEffect's dep array was [ultraRareData], so any
  //      reference change (refetch, window-focus refetch) re-fired the
  //      effect. The new memo keys on the SCALAR latest.id — re-derives
  //      only when the newest event actually changes.
  //   2) "Seen" was previously marked on dismiss. If the user navigated
  //      away mid-reveal the modal re-popped on return because
  //      hasSeenEvent was still false. Now we mark seen on display
  //      (in a separate one-shot effect, below).
  // `dismissedRevealId` separately tracks "user closed THIS id" so the
  // memo suppresses re-render without depending on the localStorage
  // write having happened-before the next render.
  const latestUltraRareEventId: number | undefined = ultraRareData?.recentEvents?.[0]?.id;
  const [dismissedRevealId, setDismissedRevealId] = useState<number | null>(null);

  const ultraRareReveal = useMemo(() => {
    const events = ultraRareData?.recentEvents;
    if (!events || events.length === 0) return null;
    // recentEvents is ordered by timestamp desc — index 0 is the newest.
    const latest = events[0];
    if (dismissedRevealId === latest.id) return null;
    // hasSeenEvent reads a single bounded key (not one key per id).
    // It is fail-safe: returns false if localStorage is unavailable.
    if (hasSeenEvent(localStorage, latest.id)) return null;
    return { id: latest.id, traitName: latest.traitName };
    // Narrow dep array (AC #1): we key ONLY on the SCALAR latest-id
    // (and the scalar dismissed-id) — NOT on ultraRareData itself. A
    // refetch / window-focus refetch returns a new reference with an
    // identical newest-event id; the memo intentionally returns the
    // stale (but correct) cached result rather than re-deriving and
    // re-firing the display-side effect. The trait name is immutable
    // for a given event id, so the cached value is safe.
  }, [latestUltraRareEventId, dismissedRevealId]);

  // Mark seen the MOMENT the reveal is displayed, not on dismiss (AC #2).
  // If the user navigates away mid-reveal, the next mount finds the id
  // already in the seen-set and useMemo returns null — no re-pop.
  useEffect(() => {
    if (ultraRareReveal) {
      // markEventSeen writes to a single bounded key (FIFO cap = 100 ids).
      // It is fail-safe: silently skips on storage write error.
      markEventSeen(localStorage, ultraRareReveal.id);
    }
  }, [ultraRareReveal]);

  const dismissUltraRareReveal = useCallback(() => {
    if (ultraRareReveal) {
      setDismissedRevealId(ultraRareReveal.id);
    }
  }, [ultraRareReveal]);

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
          <p className="text-sm text-[var(--text-primary)]">
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
    // Equoria-gncv — temperament was never copied off horseRaw, so the
    // temperament line (HorseDetailPage.tsx:601) + highlightTemperament
    // (line 803) could never show the real DB value. Carry it through
    // (null for legacy horses with no temperament).
    temperament: (horseRaw as unknown as { temperament?: string | null }).temperament ?? null,
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
    // Resolve coat color (Equoria-lsi5 + Equoria-iwy3): we now expose BOTH
    // fields so the render layer can apply the canonical fallback
    // (phenotype.colorName ?? finalDisplayColor ?? 'not recorded'), mirroring
    // HorseCard.tsx:130. The legacy finalDisplayColor TEXT column is NULL for
    // every canonical-DB horse, so phenotype.colorName is the real source of
    // truth.
    finalDisplayColor: (rawHorse.finalDisplayColor as string | undefined) ?? undefined,
    phenotype: (() => {
      // JSONB type guard per .claude/rules/CONTRIBUTING.md §1 — Prisma returns
      // JsonValue which can be null, primitive, array, or object. Only return
      // a phenotype object shape after the four-part guard passes.
      const raw = (rawHorse as unknown as { phenotype?: unknown }).phenotype;
      if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
      }
      const ph = raw as { colorName?: unknown; [key: string]: unknown };
      const colorName = typeof ph.colorName === 'string' ? ph.colorName : undefined;
      return { ...ph, colorName };
    })(),
    // Epic 31E-3 / Equoria-ga5g — markings stored on phenotype JSONB.
    // We pluck the marking-relevant fields off phenotype into a flat shape so
    // the renderer can treat them as a single object regardless of JSONB drift.
    markings: (() => {
      const phenotype = rawHorse.phenotype as {
        faceMarking?: string;
        legMarkings?: {
          frontLeft?: string;
          frontRight?: string;
          hindLeft?: string;
          hindRight?: string;
        };
        advancedMarkings?: {
          bloodyShoulderPresent?: boolean;
          snowflakePresent?: boolean;
          frostPresent?: boolean;
        };
        modifiers?: {
          isSooty?: boolean;
          isFlaxen?: boolean;
          hasPangare?: boolean;
          isRabicano?: boolean;
        };
      } | null;
      if (!phenotype || typeof phenotype !== 'object') {
        return null;
      }
      // Only return a markings object if at least one of the sub-fields exists.
      const hasAny =
        phenotype.faceMarking !== undefined ||
        phenotype.legMarkings !== undefined ||
        phenotype.advancedMarkings !== undefined ||
        phenotype.modifiers !== undefined;
      if (!hasAny) return null;
      return {
        faceMarking: phenotype.faceMarking,
        legMarkings: phenotype.legMarkings,
        advancedMarkings: phenotype.advancedMarkings,
        modifiers: phenotype.modifiers,
      };
    })(),
    // In-foal state — feed-system redesign 2026-04-29 (B6, Equoria-ta4s).
    // Carried straight through from the backend Horse row.
    inFoalSinceDate:
      (horseRaw as unknown as { inFoalSinceDate?: string | null }).inFoalSinceDate ?? null,
    pregnancySireId:
      (horseRaw as unknown as { pregnancySireId?: number | null }).pregnancySireId ?? null,
    pregnancyFeedingsByTier:
      (horseRaw as unknown as { pregnancyFeedingsByTier?: Record<string, number> })
        .pregnancyFeedingsByTier ?? {},
    lastFedDate: (horseRaw as unknown as { lastFedDate?: string | null }).lastFedDate ?? null,
    equippedFeedType:
      (horseRaw as unknown as { equippedFeedType?: string | null }).equippedFeedType ?? null,
    feedHealth: (horseRaw as unknown as { feedHealth?: string }).feedHealth as Horse['feedHealth'],
    // Equoria-8xfo (31F-FE-2) — Conformation title fields from /horses/:id payload.
    // currentTitle is null for never-shown horses; titlePoints starts at 0;
    // breedingValueBoost is a 0..N multiplier (0.10 == +10%).
    currentTitle: (horseRaw as unknown as { currentTitle?: string | null }).currentTitle ?? null,
    titlePoints: (horseRaw as unknown as { titlePoints?: number }).titlePoints ?? 0,
    breedingValueBoost:
      (horseRaw as unknown as { breedingValueBoost?: number }).breedingValueBoost ?? 0,
  };

  // Tab configuration
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Star className="w-4 h-4" /> },
    { id: 'disciplines', label: 'Disciplines', icon: <Trophy className="w-4 h-4" /> },
    { id: 'genetics', label: 'Genetics', icon: <Users className="w-4 h-4" /> },
    // Equoria-ea3n / Equoria-oovy — 31E-4 coat-color & genotype tab
    { id: 'coat', label: 'Coat', icon: <Eye className="w-4 h-4" /> },
    { id: 'conformation', label: 'Conformation', icon: <Ruler className="w-4 h-4" /> },
    { id: 'gaits', label: 'Gaits', icon: <Wind className="w-4 h-4" /> },
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
      {/* Equoria-gt6j — ultra-rare trait reveal cinematic moment */}
      {ultraRareReveal && (
        <CinematicMoment
          variant="trait-discovery"
          title="Ultra-Rare Trait Revealed!"
          subtitle={ultraRareReveal.traitName}
          onDismiss={dismissUltraRareReveal}
        />
      )}
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/stable')}
            className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Horse List
          </button>

          {/* Horse Profile Card */}
          <div className="glass-panel rounded-lg p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Horse Image */}
              <div className="w-full md:w-48 h-48 rounded-lg border border-[var(--glass-hover)] overflow-hidden bg-[var(--glass-bg)]">
                <img
                  src={getHorseImage(horse.imageUrl, horse.breed)}
                  alt={horse.name}
                  className="w-full h-full object-cover"
                  style={getHorseImageStyle(horse.imageUrl, horse.breed)}
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
                          className="fantasy-title text-2xl text-[var(--text-primary)] bg-[var(--glass-bg)] border border-burnished-gold/40 rounded-lg px-3 py-1 outline-none focus:border-burnished-gold/70 focus:shadow-[var(--glow-gold)]"
                        />
                        <Button type="submit" size="sm" disabled={updateHorseMutation.isPending}>
                          {updateHorseMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsEditing(false)}
                        >
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h1 className="fantasy-title text-3xl text-[var(--text-primary)]">
                          {horse.name}
                        </h1>
                        {horse.displayedHealth && (
                          <HealthBadge
                            band={horse.displayedHealth}
                            showCriticalWarning={horse.displayedHealth === 'critical'}
                          />
                        )}
                        {/* Equoria-8xfo (31F-FE-2) — Conformation title ribbon.
                            Hidden when never-shown (titlePoints === 0 || currentTitle === null).
                            Tooltip surfaces breedingValueBoost as +X%. */}
                        {horse.currentTitle && (horse.titlePoints ?? 0) > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--gold-dim)] text-[var(--bg-midnight)]"
                            title={
                              horse.breedingValueBoost && horse.breedingValueBoost > 0
                                ? `${horse.currentTitle} — Breeding value +${(
                                    horse.breedingValueBoost * 100
                                  ).toFixed(0)}%`
                                : (horse.currentTitle ?? '')
                            }
                            data-testid="horse-detail-title-ribbon"
                          >
                            <span aria-hidden="true">🏆</span>
                            {horse.currentTitle}
                          </span>
                        ) : null}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 text-sm fantasy-body text-[var(--text-secondary)]">
                      <span>Breed: {getBreedName(horse.breed)}</span>
                      <span>•</span>
                      {/* Equoria-lsi5 + Equoria-iwy3 — mirror HorseCard.tsx:130
                          fallback chain. phenotype.colorName is the canonical
                          genetics-derived color; finalDisplayColor is the
                          vestigial pre-31E column (NULL for all canonical DB
                          horses). Per frontend-integration-backlog.md doctrine
                          (line 258), legacy horses (phenotype: null,
                          finalDisplayColor: null) must NEVER render the literal
                          string 'Unknown'. 'not recorded' is the honest
                          fallback. */}
                      <span data-testid="horse-detail-color">
                        Color:{' '}
                        {horse.phenotype?.colorName ?? horse.finalDisplayColor ?? 'not recorded'}
                      </span>
                      <span>•</span>
                      <span>Age: {horse.age}</span>
                      <span>•</span>
                      <span>Gender: {horse.gender}</span>
                      <span>•</span>
                      <span>Health: {horse.healthStatus}</span>
                    </div>
                    {/* Equoria-8k7k + Equoria-876o — temperament line w/ reference modal trigger */}
                    <div
                      className="flex flex-wrap items-center gap-2 text-sm fantasy-body text-[var(--text-secondary)] mt-1"
                      data-testid="horse-temperament-line"
                    >
                      <span>
                        Temperament:{' '}
                        <span
                          className="font-medium text-[var(--text-primary)]"
                          data-testid="horse-temperament-value"
                        >
                          {/* Equoria-1k4n — legacy horses have null
                              temperament; 'not recorded' is the honest
                              fallback per the Equoria-iwy3 convention,
                              consistent with the color readout above (this
                              line previously rendered the literal 'Unknown',
                              contradicting the same-block doctrine comment). */}
                          {horse.temperament ?? 'not recorded'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowTemperamentReference(true)}
                        className="text-xs text-burnished-gold hover:underline"
                        data-testid="temperament-reference-open"
                        aria-label="Open temperament reference"
                      >
                        Learn more
                      </button>
                    </div>
                    {horse.forSale && (
                      <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-emerald-900/30 border border-emerald-500/40 text-emerald-400 text-xs w-fit">
                        <ShoppingCart className="w-3 h-3" />
                        For Sale — {(horse.salePrice ?? 0).toLocaleString()} coins
                      </div>
                    )}
                    {/* Equoria-ga5g — render markings (face / legs / advanced / modifiers) */}
                    <MarkingsPanel markings={horse.markings} />
                  </div>
                  <button
                    onClick={() => {
                      if (!isEditing) setEditName(horse.name);
                      setIsEditing(!isEditing);
                    }}
                    className="p-2 hover:bg-[var(--btn-gold-bg)] rounded transition-colors"
                    aria-label={isEditing ? 'Cancel editing' : 'Edit horse name'}
                  >
                    {isEditing ? (
                      <X className="w-5 h-5 text-white/60" />
                    ) : (
                      <Edit className="w-5 h-5 text-[var(--text-secondary)]" />
                    )}
                  </button>
                </div>

                {/* Description */}
                {horse.description && (
                  <p className="fantasy-body text-[var(--text-primary)] mb-4">
                    {horse.description}
                  </p>
                )}

                {/* In-foal panel — feed-system redesign 2026-04-29 (B6, Equoria-ta4s). */}
                {horse.inFoalSinceDate && (
                  <div className="mb-4">
                    <PregnancyFeedingPanel
                      inFoalSinceDate={horse.inFoalSinceDate}
                      feedings={horse.pregnancyFeedingsByTier ?? {}}
                      sireName={sireHorse?.name ?? null}
                      pregnancySireId={horse.pregnancySireId ?? null}
                    />
                  </div>
                )}

                {/* Quick Stats Summary */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {Object.entries(horse.stats).map(([statName, value]) => (
                    <div
                      key={statName}
                      className="flex flex-col items-center p-3 bg-[var(--bg-midnight)] rounded border border-[var(--glass-border)]"
                    >
                      <div className={`mb-1 ${getStatColor(value)}`}>{getStatIcon(statName)}</div>
                      <span className="text-xs fantasy-caption text-[var(--text-secondary)] capitalize">
                        {statName}
                      </span>
                      <span className="text-lg fantasy-title text-[var(--text-primary)]">
                        {value}
                      </span>
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
            className="flex border-b border-[var(--glass-hover)] overflow-x-auto rounded-t-lg bg-[var(--bg-midnight)]"
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
                    ? 'bg-[var(--glass-border)] text-[var(--text-primary)] border-b-2 border-burnished-gold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--glass-border)] hover:text-[var(--text-primary)]'
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
            {activeTab === 'genetics' && (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-burnished-gold" />
                  </div>
                }
              >
                <GeneticsTab horse={horse} />
              </Suspense>
            )}
            {activeTab === 'coat' && (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-burnished-gold" />
                  </div>
                }
              >
                <CoatTab horseId={horse.id} />
              </Suspense>
            )}
            {activeTab === 'conformation' && <ConformationTab horseId={horse.id} />}
            {activeTab === 'gaits' && <GaitsTab horseId={horse.id} />}
            {activeTab === 'progression' && <ProgressionTab horse={horse} />}
            {activeTab === 'training' && (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-burnished-gold" />
                  </div>
                }
              >
                <TrainingTab horse={horse} />
              </Suspense>
            )}
            {activeTab === 'competition' && (
              <CompetitionHistory
                horseId={horse.id}
                horseName={horse.name}
                data={isCompHistoryLoading ? undefined : competitionHistoryData}
                isLoading={isCompHistoryLoading}
              />
            )}
            {activeTab === 'pedigree' && <PedigreeTab horse={horse} />}
            {activeTab === 'health' && <HealthVetTab horse={horse} />}
            {activeTab === 'tack' && <TackTab horse={horse} />}
            {activeTab === 'stud-sale' && (
              <StudSaleTab
                horse={horse}
                onListForSale={() => setShowListModal(true)}
                onDelist={() =>
                  delistHorseMutation.mutate(horse.id, { onSuccess: () => refetch() })
                }
                isDelisting={delistHorseMutation.isPending}
              />
            )}
          </div>
        </div>
      </div>

      {/* Equoria-876o — Temperament Reference Modal */}
      <TemperamentReferenceModal
        isOpen={showTemperamentReference}
        onClose={() => setShowTemperamentReference(false)}
        highlightTemperament={horse.temperament ?? null}
      />

      {/* Rider Picker Modal (Story 15-5) */}
      {showRiderPicker && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[var(--z-modal)]"
          onClick={() => setShowRiderPicker(false)}
          data-testid="rider-picker-modal"
        >
          <div
            className="glass-panel-heavy rounded-xl shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="fantasy-title text-lg text-[var(--text-primary)] mb-4">
              Assign Rider to {horse.name}
            </h3>
            {ridersLoading && (
              <p className="text-sm text-[var(--text-secondary)] text-center py-4">
                Loading riders…
              </p>
            )}
            {!ridersLoading && (!riders || riders.length === 0) && (
              <div className="text-center py-4">
                <p className="text-sm text-[var(--text-secondary)] mb-3">No riders hired yet.</p>
                <Button asChild>
                  <Link to="/riders" onClick={() => setShowRiderPicker(false)}>
                    Browse Rider Marketplace
                  </Link>
                </Button>
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
                  className="w-full text-left glass-panel hover:border-burnished-gold/40 disabled:opacity-50"
                >
                  <p className="font-bold text-[var(--text-primary)] text-sm">
                    {rider.firstName} {rider.lastName}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] capitalize">
                    {rider.skillLevel} · {rider.personality}
                  </p>
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => setShowRiderPicker(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Story 12-5 — Sticky Bottom Action Bar (portal to escape stacking context) */}
      {createPortal(
        <div
          className="fixed bottom-0 left-0 right-0 z-[var(--z-modal)] bg-[var(--bg-deep-space)]/95 border-t border-burnished-gold/40 backdrop-blur-sm"
          data-testid="horse-action-bar"
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-3 overflow-x-auto">
            <span className="text-xs fantasy-caption text-[var(--text-secondary)] whitespace-nowrap mr-1 flex-shrink-0">
              Quick Actions:
            </span>
            {(() => {
              // Feed-system redesign 2026-04-29 (A16): Feed button now calls
              // POST /api/v1/horses/:id/feed via useFeedHorse mutation.
              // Disabled when no feed equipped, already-fed-today, or retired.
              const isAlreadyFedToday = horse.lastFedDate
                ? new Date(horse.lastFedDate).toISOString().slice(0, 10) ===
                  new Date().toISOString().slice(0, 10)
                : false;
              const feedDisabledReason = !horse.equippedFeedType
                ? 'No feed selected. Click Equip first.'
                : isAlreadyFedToday
                  ? 'Fed today. Available again at UTC midnight.'
                  : horse.feedHealth === 'retired'
                    ? 'Retired.'
                    : null;
              const handleFeed = () => {
                feedHorseMutation.mutate(undefined, {
                  onSuccess: (result) => {
                    if (result.skipped === 'retired') {
                      toast.info(`${horse.name} is retired and doesn't need to be fed.`);
                      return;
                    }
                    const feedName = result.feed?.name ?? 'feed';
                    const remaining = result.remainingUnits ?? 0;
                    const statSuffix = result.statBoost
                      ? ` +1 ${result.statBoost.stat.charAt(0).toUpperCase() + result.statBoost.stat.slice(1)}!`
                      : '';
                    toast.success(
                      `Fed ${result.horse.name} with ${feedName}. ${remaining} units left.${statSuffix}`,
                      { duration: result.statBoost ? 5000 : 3000 }
                    );
                  },
                  onError: (err) =>
                    toast.error((err as { message?: string })?.message ?? 'Feeding failed.'),
                });
              };
              return (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleFeed}
                  disabled={feedDisabledReason !== null || feedHorseMutation.isPending}
                  title={feedDisabledReason ?? 'Feed this horse'}
                  data-testid="action-feed"
                >
                  <span aria-hidden="true">🌾</span>
                  {feedHorseMutation.isPending ? 'Feeding…' : 'Feed'}
                </Button>
              );
            })()}
            <Button
              type="button"
              size="sm"
              onClick={() => navigate(`/training?horseId=${horse.id}`)}
              data-testid="action-train"
            >
              <Dumbbell className="w-3.5 h-3.5" />
              Train
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => navigate(`/breeding?horseId=${horse.id}`)}
              data-testid="action-breed"
            >
              <Heart className="w-3.5 h-3.5" />
              Breed
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowRiderPicker(true)}
              title="Assign a rider to this horse"
              data-testid="action-assign-rider"
            >
              <Users className="w-3.5 h-3.5" />
              Assign Rider
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => navigate(`/grooms?horseId=${horse.id}`)}
              title="Assign a groom to this horse"
              data-testid="action-assign-groom"
            >
              <span aria-hidden="true">🧹</span>
              Assign Groom
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => navigate(`/horses/${horse.id}/equip`)}
              title="Manage tack and feed for this horse"
              data-testid="action-equip"
            >
              <span aria-hidden="true">🎒</span>
              Equip
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => navigate(`/farrier?horseId=${horse.id}`)}
              title="Shoe this horse"
              data-testid="action-shoe-horse"
            >
              <span aria-hidden="true">🔧</span>
              Shoe Horse
            </Button>
            {horse.forSale ? (
              <Button
                type="button"
                size="sm"
                onClick={() => delistHorseMutation.mutate(horse.id, { onSuccess: () => refetch() })}
                disabled={delistHorseMutation.isPending}
                data-testid="action-delist"
              >
                <X className="w-3.5 h-3.5" />
                Delist
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setShowListModal(true)}
                data-testid="action-list-for-sale"
              >
                <Tag className="w-3.5 h-3.5" />
                List for Sale
              </Button>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* List for Sale Modal */}
      {showListModal && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-panel-heavy rounded-xl p-6 shadow-2xl">
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
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowListModal(false);
                  setListPrice('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
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
              >
                {listHorseMutation.isPending ? 'Listing…' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{ horse: Horse }> = ({ horse }) => (
  <div className="space-y-6" data-testid="horse-detail-overview">
    <div>
      <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-3">Current Status</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-[var(--bg-midnight)] rounded border border-[var(--glass-border)]">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Health Status</p>
          <p className="fantasy-body text-[var(--text-primary)]">{horse.healthStatus}</p>
        </div>
        <div className="p-4 bg-[var(--bg-midnight)] rounded border border-[var(--glass-border)]">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Age</p>
          <p className="fantasy-body text-[var(--text-primary)]">{horse.age} years old</p>
        </div>
        <div className="p-4 bg-[var(--bg-midnight)] rounded border border-[var(--glass-border)]">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Date of Birth</p>
          <p className="fantasy-body text-[var(--text-primary)]">
            {typeof horse.dateOfBirth === 'string' && !isNaN(new Date(horse.dateOfBirth).getTime())
              ? new Date(horse.dateOfBirth).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Not recorded'}
          </p>
        </div>
        <div className="p-4 bg-[var(--bg-midnight)] rounded border border-[var(--glass-border)]">
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1">Gender</p>
          <p className="fantasy-body text-[var(--text-primary)] capitalize">{horse.gender}</p>
        </div>
      </div>
    </div>

    {horse.traits && horse.traits.length > 0 && (
      <div>
        <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-3">Traits</h3>
        <div className="flex flex-wrap gap-2">
          {horse.traits.map((trait, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-burnished-gold/20 text-[var(--text-primary)] rounded-full text-sm fantasy-body border border-burnished-gold/40"
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
        <p className="fantasy-body text-[var(--text-secondary)]">
          This horse has not trained in any disciplines yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-4">Discipline Scores</h3>
      {disciplines.map(([discipline, score]) => (
        <div key={discipline} className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="fantasy-body text-[var(--text-primary)]">{discipline}</span>
            <span className={`fantasy-title ${getStatColor(score)}`}>{score}</span>
          </div>
          <div className="h-3 bg-[var(--glass-surface-subtle-bg)] rounded-full overflow-hidden border border-[var(--glass-border)]">
            <div
              className={`h-full transition-all ${
                score >= 90
                  ? 'bg-burnished-gold'
                  : score >= 75
                    ? 'bg-emerald-500'
                    : score >= 60
                      ? 'bg-aged-bronze'
                      : 'bg-[var(--text-secondary)]'
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      ))}
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

// Pedigree Tab Component — Story 12-4
const PedigreeTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const hasSire = Boolean(horse.parentIds?.sireId);
  const hasDam = Boolean(horse.parentIds?.damId);
  const _hasAnyParent = hasSire || hasDam;

  return (
    <div className="space-y-6" data-testid="pedigree-tab">
      <div>
        <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-3">Family Tree</h3>
        <p className="fantasy-body text-[var(--text-secondary)] text-sm mb-6">
          Parentage and bloodline information for {horse.name}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sire */}
        <div
          className="p-5 bg-[var(--bg-midnight)] rounded-lg border border-[var(--glass-border)]"
          data-testid="pedigree-sire"
        >
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1 text-xs uppercase tracking-wider">
            Sire (Father)
          </p>
          {hasSire ? (
            <Link
              to={`/horses/${horse.parentIds!.sireId}`}
              className="fantasy-title text-lg text-burnished-gold hover:text-[var(--text-primary)] transition-colors flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4" />
              View Sire Profile
            </Link>
          ) : (
            <p className="fantasy-title text-lg text-[var(--text-secondary)]">Store Horse</p>
          )}
        </div>

        {/* Dam */}
        <div
          className="p-5 bg-[var(--bg-midnight)] rounded-lg border border-[var(--glass-border)]"
          data-testid="pedigree-dam"
        >
          <p className="fantasy-caption text-[var(--text-secondary)] mb-1 text-xs uppercase tracking-wider">
            Dam (Mother)
          </p>
          {hasDam ? (
            <Link
              to={`/horses/${horse.parentIds!.damId}`}
              className="fantasy-title text-lg text-burnished-gold hover:text-[var(--text-primary)] transition-colors flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4" />
              View Dam Profile
            </Link>
          ) : (
            <p className="fantasy-title text-lg text-[var(--text-secondary)]">Store Horse</p>
          )}
        </div>
      </div>

      {/* Offspring section — future expansion */}
      <div className="p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)]">
        <p className="fantasy-caption text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-1">
          Offspring
        </p>
        <p className="fantasy-body text-[var(--text-secondary)] text-sm italic">
          Offspring records are displayed once this horse has produced foals through the breeding
          system.
        </p>
      </div>
    </div>
  );
};

// Health & Vet Tab Component — Story 12-4
interface VetRecord {
  date: string;
  type: string;
  result: string;
  vet: string;
}

const vetHistory: VetRecord[] = [];

const HealthVetTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const healthColor =
    horse.healthStatus?.toLowerCase() === 'healthy'
      ? 'text-emerald-400'
      : horse.healthStatus?.toLowerCase().includes('injured')
        ? 'text-burnished-gold'
        : 'text-[var(--text-secondary)]';

  return (
    <div className="space-y-6" data-testid="health-vet-tab">
      {/* Current Status */}
      <div>
        <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-3">
          Current Health Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[var(--bg-midnight)] rounded-lg border border-[var(--glass-border)]">
            <p className="fantasy-caption text-[var(--text-secondary)] mb-1 text-xs uppercase tracking-wider">
              Status
            </p>
            <p className={`fantasy-title text-xl ${healthColor}`}>{horse.healthStatus}</p>
          </div>
          <div className="p-4 bg-[var(--bg-midnight)] rounded-lg border border-[var(--glass-border)]">
            <p className="fantasy-caption text-[var(--text-secondary)] mb-1 text-xs uppercase tracking-wider">
              Next Recommended Check
            </p>
            <p className="fantasy-body text-[var(--text-primary)]">6 weeks from last visit</p>
          </div>
        </div>
      </div>

      {/* Vet History */}
      <div>
        <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-3">
          Veterinary History
        </h3>
        {vetHistory.length === 0 ? (
          <div className="text-center py-8 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)]">
            <Stethoscope className="w-8 h-8 text-[var(--text-secondary)]/40 mx-auto mb-2" />
            <p className="fantasy-body text-[var(--text-secondary)]">No vet records on file.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vetHistory.map((record, idx) => (
              <div
                key={idx}
                className="p-4 bg-[var(--bg-midnight)] rounded-lg border border-[var(--glass-border)] hover:border-burnished-gold/40 transition-colors"
                data-testid={`vet-record-${idx}`}
              >
                <div className="flex items-start justify-between mb-1">
                  <p className="fantasy-title text-[var(--text-primary)] text-sm">{record.type}</p>
                  <span className="text-xs fantasy-caption text-[var(--text-secondary)] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(record.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="fantasy-body text-[var(--text-primary)] text-sm mb-1">
                  {record.result}
                </p>
                <p className="fantasy-caption text-[var(--text-secondary)] text-xs">
                  Vet: {record.vet}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Book Appointment CTA */}
      <div className="p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)] flex items-center justify-between">
        <div>
          <p className="fantasy-title text-[var(--text-primary)] text-sm">
            Need a Vet Appointment?
          </p>
          <p className="fantasy-body text-[var(--text-secondary)] text-sm">
            Visit the Vet Clinic to book a health check or treatment.
          </p>
        </div>
        <Button asChild>
          <Link to="/vet">Go to Vet Clinic</Link>
        </Button>
      </div>
    </div>
  );
};

// Stud / Sale Tab Component — Story 12-4 / 15-5 / Equoria-q072
const StudSaleTab: React.FC<{
  horse: Horse;
  onListForSale: () => void;
  onDelist: () => void;
  isDelisting: boolean;
}> = ({ horse, onListForSale, onDelist, isDelisting }) => {
  const isMale =
    horse.gender?.toLowerCase() === 'stallion' || horse.gender?.toLowerCase() === 'male';
  const isFemale =
    horse.gender?.toLowerCase() === 'mare' || horse.gender?.toLowerCase() === 'female';

  // Equoria-q072: real stud listing wiring (replaces toast.info placeholder)
  const listAtStud = useListAtStud();
  const unlistAtStud = useUnlistAtStud();
  const [showStudForm, setShowStudForm] = useState(false);
  const [studFeeInput, setStudFeeInput] = useState('');
  const isAtStud = typeof horse.studStatus === 'string' && horse.studStatus !== 'Not at Stud';

  const handleSubmitStudListing = (e: React.FormEvent) => {
    e.preventDefault();
    const fee = Number(studFeeInput);
    if (!Number.isInteger(fee) || fee < 0) {
      toast.error('Stud fee must be a non-negative integer');
      return;
    }
    listAtStud.mutate(
      { horseId: horse.id, studFee: fee },
      {
        onSuccess: () => {
          setShowStudForm(false);
          setStudFeeInput('');
        },
      }
    );
  };

  return (
    <div className="space-y-6" data-testid="stud-sale-tab">
      <div>
        <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-2">Listing Options</h3>
        <p className="fantasy-body text-[var(--text-secondary)] text-sm">
          List {horse.name} for outright sale, manage active listings, and browse the marketplace.
        </p>
      </div>

      {/* Current Listing Status */}
      <div className="p-4 bg-[var(--bg-midnight)] rounded-lg border border-[var(--glass-border)]">
        <p className="fantasy-caption text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-1">
          Current Status
        </p>
        <p className="fantasy-title text-lg text-[var(--text-primary)]">
          {horse.forSale
            ? `Listed for ${(horse.salePrice ?? 0).toLocaleString()} coins`
            : 'Not Listed'}
        </p>
        {isAtStud && (
          <p
            className="fantasy-body text-[var(--text-secondary)] text-sm mt-1"
            data-testid="stud-current-status"
          >
            At stud · Fee: {(horse.studFee ?? 0).toLocaleString()} coins
          </p>
        )}
      </div>

      {/* Equoria-8xfo (31F-FE-2) — Conformation Titles block.
          Surfaces titlePoints, currentTitle, and breedingValueBoost so
          prospective stud-fee buyers see the +breedingValueBoost. Hidden when
          horse has never been entered in a conformation show
          (titlePoints === 0 && currentTitle == null). */}
      {((horse.titlePoints ?? 0) > 0 || horse.currentTitle) && (
        <div
          className="p-4 bg-[var(--bg-midnight)] rounded-lg border border-[var(--gold-dim)]"
          data-testid="conformation-titles-block"
        >
          <p className="fantasy-caption text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-2">
            Conformation Titles
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="fantasy-caption text-[var(--text-secondary)] text-[0.65rem] uppercase">
                Current Title
              </p>
              <p
                className="fantasy-title text-lg text-[var(--gold-light)]"
                data-testid="conformation-current-title"
              >
                {horse.currentTitle ?? '—'}
              </p>
            </div>
            <div>
              <p className="fantasy-caption text-[var(--text-secondary)] text-[0.65rem] uppercase">
                Title Points
              </p>
              <p
                className="fantasy-title text-lg text-[var(--text-primary)]"
                data-testid="conformation-title-points"
              >
                {(horse.titlePoints ?? 0).toLocaleString()}
              </p>
            </div>
            {horse.breedingValueBoost && horse.breedingValueBoost > 0 ? (
              <div>
                <p className="fantasy-caption text-[var(--text-secondary)] text-[0.65rem] uppercase">
                  Breeding Value Boost
                </p>
                <p
                  className="fantasy-title text-lg text-emerald-400"
                  data-testid="conformation-breeding-boost"
                >
                  +{(horse.breedingValueBoost * 100).toFixed(0)}%
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Listing Type Buttons */}
      <div className="space-y-3">
        {isMale && !isAtStud && !showStudForm && (
          <button
            type="button"
            onClick={() => setShowStudForm(true)}
            className="w-full flex items-center justify-between p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)] text-left hover:border-[var(--glass-hover)] transition-colors"
            title="List this stallion at public stud"
            data-testid="stud-listing-btn"
          >
            <div>
              <p className="fantasy-title text-[var(--text-primary)] text-sm">
                Offer as Stud Service
              </p>
              <p className="fantasy-body text-[var(--text-secondary)] text-xs mt-0.5">
                Other players can pay a breeding fee to use {horse.name}
              </p>
            </div>
            <span className="text-xs fantasy-caption text-[var(--text-secondary)]">Breeding</span>
          </button>
        )}

        {isMale && showStudForm && (
          <form
            onSubmit={handleSubmitStudListing}
            className="p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)] space-y-3"
            data-testid="stud-listing-form"
          >
            <label className="block">
              <span className="fantasy-caption text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                Stud fee (coins)
              </span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={studFeeInput}
                onChange={(e) => setStudFeeInput(e.target.value)}
                placeholder="e.g. 5000"
                className="mt-1 w-full p-2 bg-[var(--bg-midnight)] rounded border border-[var(--glass-border)] text-[var(--text-primary)]"
                data-testid="stud-fee-input"
                required
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={listAtStud.isPending}
                className="flex-1 px-3 py-2 bg-[var(--accent-primary)] text-white rounded fantasy-title text-sm disabled:opacity-50"
                data-testid="stud-listing-submit"
              >
                {listAtStud.isPending ? 'Listing…' : 'List at Stud'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowStudForm(false);
                  setStudFeeInput('');
                }}
                disabled={listAtStud.isPending}
                className="flex-1 px-3 py-2 bg-[var(--glass-surface-subtle-bg)] rounded fantasy-title text-sm border border-[var(--glass-border)]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {isMale && isAtStud && (
          <button
            type="button"
            onClick={() => unlistAtStud.mutate(horse.id)}
            disabled={unlistAtStud.isPending}
            className="w-full flex items-center justify-between p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)] text-left hover:border-[var(--glass-hover)] transition-colors"
            title="Remove stud listing"
            data-testid="stud-unlist-btn"
          >
            <div>
              <p className="fantasy-title text-[var(--text-primary)] text-sm">
                Remove Stud Listing
              </p>
              <p className="fantasy-body text-[var(--text-secondary)] text-xs mt-0.5">
                Take {horse.name} off the public stud roster
              </p>
            </div>
            <span className="text-xs fantasy-caption text-[var(--text-secondary)]">
              {unlistAtStud.isPending ? 'Saving…' : 'Unlist'}
            </span>
          </button>
        )}

        {!isFemale && !isMale && (
          <div className="p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)]">
            <p className="fantasy-body text-[var(--text-secondary)] text-sm italic">
              Stud listing is only available for stallions.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={horse.forSale ? onDelist : onListForSale}
          disabled={isDelisting}
          className="w-full flex items-center justify-between p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)] text-left hover:border-[var(--glass-hover)] transition-colors"
          title={horse.forSale ? 'Remove marketplace listing' : 'List horse for sale'}
          data-testid="sale-listing-btn"
        >
          <div>
            <p className="fantasy-title text-[var(--text-primary)] text-sm">
              {horse.forSale ? 'Remove Sale Listing' : 'List for Sale'}
            </p>
            <p className="fantasy-body text-[var(--text-secondary)] text-xs mt-0.5">
              {horse.forSale
                ? 'Take this horse off the Marketplace'
                : `Place ${horse.name} on the Marketplace for other players to purchase`}
            </p>
          </div>
          <span className="text-xs fantasy-caption text-[var(--text-secondary)]">
            {isDelisting ? 'Saving...' : horse.forSale ? 'Delist' : 'Set Price'}
          </span>
        </button>
      </div>

      {/* Marketplace Link */}
      <div className="p-4 bg-[var(--glass-surface-subtle-bg)] rounded-lg border border-[var(--glass-border)] flex items-center justify-between">
        <div>
          <p className="fantasy-title text-[var(--text-primary)] text-sm">Browse the Marketplace</p>
          <p className="fantasy-body text-[var(--text-secondary)] text-sm">
            See horses listed for sale by other players.
          </p>
        </div>
        <Button asChild>
          <Link to="/marketplace/horses">Marketplace</Link>
        </Button>
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

// Tack Tab Component — lists equipped items. Tack does not degrade with use,
// so no condition / repair UI here.
const TackTab: React.FC<{ horse: Horse }> = ({ horse }) => {
  const tack = horse.tack;

  const equippedItems = TACK_DISPLAY_CATEGORIES.filter(
    ({ key }) => tack && typeof tack[key] === 'string'
  );

  if (!tack || equippedItems.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="w-10 h-10 text-[var(--text-secondary)]/40 mx-auto mb-4" />
        <p className="fantasy-body text-[var(--text-secondary)] mb-2">No tack equipped</p>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Visit the Tack Shop to equip saddles, bridles, and more.
        </p>
        <Link
          to="/tack-shop"
          className="text-sm text-burnished-gold hover:text-[var(--text-primary)] underline transition-colors"
        >
          Go to Tack Shop →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="fantasy-title text-xl text-[var(--text-primary)] mb-4">Equipped Tack</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {equippedItems.map(({ key, label }) => {
          const itemId = tack[key] as string;
          return (
            <div
              key={key}
              className="p-4 bg-[var(--bg-midnight)] rounded border border-[var(--glass-border)]"
              data-testid={`tack-equipped-${key}`}
            >
              <span className="fantasy-caption text-[var(--text-secondary)] capitalize block mb-1">
                {label}
              </span>
              <p className="fantasy-body text-[var(--text-primary)] text-sm truncate">{itemId}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-right">
        <Link
          to="/tack-shop"
          className="text-sm text-burnished-gold hover:text-[var(--text-primary)] underline transition-colors"
        >
          Manage tack in Tack Shop →
        </Link>
      </div>
    </div>
  );
};

export default HorseDetailPage;
