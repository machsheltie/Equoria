/**
 * Horse Detail Page
 *
 * Displays comprehensive information about a specific horse including:
 * - Basic profile (name, age, breed, image)
 * - Detailed statistics
 * - Discipline scores
 * - Genetic traits
 * - Training system with discipline selection and session management
 * - Competition history (CompetitionHistory + CompetitionResultsModal —
 *   real data via useHorseCompetitionHistory; not a placeholder)
 *
 * Story 3.2: Horse Detail View - AC-1 through AC-5
 * Story 4-1: Training Session Interface - Task 6
 * Equoria-kdduk (2026-05-29): per-tab files extracted to
 *   `pages/horse-detail/` and `max-lines: 600` is enforced on
 *   `pages/**\/*.tsx` to prevent re-bloat.
 */

import React, { lazy, Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Star,
  Trophy,
  ArrowLeft,
  Award,
  Users,
  AlertCircle,
  Loader2,
  Ruler,
  GitBranch,
  Stethoscope,
  Tag,
  ShoppingCart,
  Wind,
  Eye,
  Dumbbell,
  TrendingUp,
} from 'lucide-react';
import { useHorse } from '../hooks/api/useHorses';
// Canonical Radix-backed tabs (Equoria-o5hub.11, DECISIONS.md §6)
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';
import ConformationTab from '../components/horse/ConformationTab';
// Equoria-aa6b — walk/trot/canter/gallop + breed-specific gait scores tab
import GaitsTab from '../components/horse/GaitsTab';
// Equoria-876o — reference modal for the 11 temperament definitions
import TemperamentReferenceModal from '../components/horse/TemperamentReferenceModal';
import { SkeletonBase } from '@/components/ui/SkeletonCard';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRiders } from '@/hooks/api/useRiders';
import { useDelistHorse } from '@/hooks/api/useMarketplace';
// Competition history (Story 5-3)
import CompetitionHistory from '@/components/competition/CompetitionHistory';
import { useHorseCompetitionHistory } from '@/hooks/api/useHorseCompetitionHistory';
import { useHorseUltraRareTraits } from '@/hooks/api/useUltraRareTraits';
import CinematicMoment from '@/components/feedback/CinematicMoment';
import { hasSeenEvent, markEventSeen } from '@/lib/traitEventSeen';
// Shared types for page + lazy tabs
import type { Horse, HorseStats } from './horse-detail/HorseDetailPageTypes';
// Equoria-kdduk — small per-tab components extracted to keep this page <600 lines
import { type TabType } from './horse-detail/statHelpers';
import HorseProfileCard from './horse-detail/HorseProfileCard';
import OverviewTab from './horse-detail/OverviewTab';
import DisciplinesTab from './horse-detail/DisciplinesTab';
import ProgressionTab from './horse-detail/ProgressionTab';
import PedigreeTab from './horse-detail/PedigreeTab';
import HealthVetTab from './horse-detail/HealthVetTab';
import TackTab from './horse-detail/TackTab';
import StudSaleTab from './horse-detail/StudSaleTab';
import RiderPickerModal from './horse-detail/RiderPickerModal';
import HorseActionBar from './horse-detail/HorseActionBar';
import ListForSaleModal from './horse-detail/ListForSaleModal';
// Equoria-o5hub.5 (D-24) — contextual bottom-action slot owned by
// DashboardLayout. Falls back to in-place rendering when no layout provider
// is mounted (direct page renders in tests).
import { ContextualBottomActions } from '@/components/layout/ContextualBottomActions';

// Heavy tab sub-panels — lazy loaded so they only enter the bundle when first selected
const GeneticsTab = lazy(() => import('./horse-detail/GeneticsTab'));
// Equoria-ea3n + Equoria-oovy — 31E-4 dedicated Color & Genetics panel sourced
// from the GET /horses/:id/color and /horses/:id/genetics endpoints (not the
// main horse payload).
const CoatTab = lazy(() => import('./horse-detail/CoatTab'));
const TrainingTab = lazy(() => import('./horse-detail/TrainingTab'));

// Shared Suspense fallback for the lazy-loaded tab panels
const lazyTabFallback = (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-8 h-8 animate-spin text-burnished-gold" />
  </div>
);

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

  const delistHorseMutation = useDelistHorse();

  // Auth — needed to fetch user's riders
  const { user } = useAuth();

  // Rider assignment (Story 15-5) — list query lives here so the page can
  // show the picker quickly; the assign-mutation lives inside RiderPickerModal.
  const { data: riders, isLoading: ridersLoading } = useUserRiders(user?.id ?? 0);

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
    /* No bottom padding here: while HorseActionBar is registered, the
       DashboardLayout contextual slot reserves nav+actions space via
       --content-bottom-reserve (Equoria-o5hub.5) — the old pb-20 was the
       manual clearance for the bar's former fixed positioning. */
    <div className="min-h-screen">
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
          <HorseProfileCard
            horse={horse}
            sireName={sireHorse?.name ?? null}
            isEditing={isEditing}
            editName={editName}
            onStartEdit={() => {
              setEditName(horse.name);
              setIsEditing(true);
            }}
            onCancelEdit={() => setIsEditing(false)}
            onChangeEditName={setEditName}
            onOpenTemperamentReference={() => setShowTemperamentReference(true)}
            refetch={refetch}
          />
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

        {/* Tab Navigation + Content — CanonicalTabs underline variant (Equoria-o5hub.11).
            Controlled: activeTab also gates the competition-history query above.
            Radix unmounts inactive TabsContent by default, preserving the prior
            lazy "render only the active tab" behavior. */}
        <div className="glass-panel rounded-lg mb-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
            <TabsList aria-label="Horse details tabs">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  <span className="inline-flex items-center mr-2" aria-hidden="true">
                    {tab.icon}
                  </span>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="overview" className="mt-0 p-6">
              <OverviewTab horse={horse} />
            </TabsContent>
            <TabsContent value="disciplines" className="mt-0 p-6">
              <DisciplinesTab horse={horse} />
            </TabsContent>
            <TabsContent value="genetics" className="mt-0 p-6">
              <Suspense fallback={lazyTabFallback}>
                <GeneticsTab horse={horse} />
              </Suspense>
            </TabsContent>
            <TabsContent value="coat" className="mt-0 p-6">
              <Suspense fallback={lazyTabFallback}>
                <CoatTab horseId={horse.id} />
              </Suspense>
            </TabsContent>
            <TabsContent value="conformation" className="mt-0 p-6">
              <ConformationTab horseId={horse.id} />
            </TabsContent>
            <TabsContent value="gaits" className="mt-0 p-6">
              <GaitsTab horseId={horse.id} />
            </TabsContent>
            <TabsContent value="progression" className="mt-0 p-6">
              <ProgressionTab horse={horse} />
            </TabsContent>
            <TabsContent value="training" className="mt-0 p-6">
              <Suspense fallback={lazyTabFallback}>
                <TrainingTab horse={horse} />
              </Suspense>
            </TabsContent>
            <TabsContent value="competition" className="mt-0 p-6">
              <CompetitionHistory
                horseId={horse.id}
                horseName={horse.name}
                data={isCompHistoryLoading ? undefined : competitionHistoryData}
                isLoading={isCompHistoryLoading}
              />
            </TabsContent>
            <TabsContent value="pedigree" className="mt-0 p-6">
              <PedigreeTab horse={horse} />
            </TabsContent>
            <TabsContent value="health" className="mt-0 p-6">
              <HealthVetTab horse={horse} />
            </TabsContent>
            <TabsContent value="tack" className="mt-0 p-6">
              <TackTab horse={horse} />
            </TabsContent>
            <TabsContent value="stud-sale" className="mt-0 p-6">
              <StudSaleTab
                horse={horse}
                onListForSale={() => setShowListModal(true)}
                onDelist={() =>
                  delistHorseMutation.mutate(horse.id, { onSuccess: () => refetch() })
                }
                isDelisting={delistHorseMutation.isPending}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Equoria-876o — Temperament Reference Modal */}
      <TemperamentReferenceModal
        isOpen={showTemperamentReference}
        onClose={() => setShowTemperamentReference(false)}
        highlightTemperament={horse.temperament ?? null}
      />

      {/* Rider Picker Modal (Story 15-5) */}
      <RiderPickerModal
        isOpen={showRiderPicker}
        onClose={() => setShowRiderPicker(false)}
        horseId={horse.id}
        horseName={horse.name}
        riders={riders}
        isLoading={ridersLoading}
      />

      {/* Story 12-5 — Bottom Action Bar, registered into the DashboardLayout
          contextual slot (Equoria-o5hub.5 / D-24). The slot positions it above
          BottomNav on mobile and at the viewport bottom on desktop; without a
          provider (test renders) the bar renders here in place. */}
      <ContextualBottomActions>
        <HorseActionBar
          horse={horse}
          onAssignRider={() => setShowRiderPicker(true)}
          onListForSale={() => setShowListModal(true)}
          refetch={refetch}
        />
      </ContextualBottomActions>

      {/* List for Sale Modal */}
      <ListForSaleModal
        isOpen={showListModal}
        onClose={() => setShowListModal(false)}
        horseId={horse.id}
        horseName={horse.name}
        onSuccess={refetch}
      />
    </div>
  );
};

// Tab components are extracted to ./horse-detail/* (Equoria-kdduk).

export default HorseDetailPage;
