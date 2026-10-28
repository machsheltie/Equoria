/**
 * Horse Detail Page
 *
 * Displays comprehensive information about a specific horse including:
 * - Basic profile (name, age, breed, image)
 * - Detailed statistics
 * - Discipline scores
 * - Genetic traits
 * - Training system with discipline selection and session management
 * - Show Results tab (ShowResultsTab — the horse's show record, paged)
 *
 * Story 3.2: Horse Detail View - AC-1 through AC-5
 * Story 4-1: Training Session Interface - Task 6
 * Equoria-kdduk (2026-05-29): per-tab files extracted to
 *   `pages/horse-detail/` and `max-lines: 600` is enforced on
 *   `pages/**\/*.tsx` to prevent re-bloat.
 */

import React, { lazy, Suspense, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import { ErrorState } from '@/components/ui/state';
import {
  Star,
  Trophy,
  Award,
  Users,
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
// Equoria-q4uem.9 (owner ruling q90): another player's horse opens this same
// page in visitor mode — public facts and revealed traits only.
import { useHorseVisit } from '../hooks/api/useStuds';
import HorseVisitorView from './horse-detail/stud/HorseVisitorView';
// Canonical Radix-backed tabs (Equoria-o5hub.11, DECISIONS.md §6)
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';
import ConformationTab from '../components/horse/ConformationTab';
// Equoria-aa6b — walk/trot/canter/gallop + breed-specific gait scores tab
import GaitsTab from '../components/horse/GaitsTab';
// Equoria-876o — reference modal for the 12 temperament definitions
import TemperamentReferenceModal from '../components/horse/TemperamentReferenceModal';
import { SkeletonBase } from '@/components/ui/SkeletonCard';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRiders } from '@/hooks/api/useRiders';
import { useDelistHorse } from '@/hooks/api/useMarketplace';
// Competition history (Story 5-3)
import ShowResultsTab from './horse-detail/ShowResultsTab';
import { isUnnamed } from '@/lib/horseNamePolicy';
// Shared types for page + lazy tabs
import type { Horse } from './horse-detail/HorseDetailPageTypes';
import { normalizeHorseDetail } from './horse-detail/normalizeHorseDetail';
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
// Tonight's care: the daily 'Groom horse' press (Equoria-j765w.2, owner ruling q67)
import CareArea from './horse-detail/CareArea';
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
    <Loader2 className="w-8 h-8 animate-spin text-[var(--gold-primary)]" />
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

  // Not the player's own horse (the owner-only read answers 404): read the
  // visitor view instead. A missing horse is 404 there too.
  const notOwn = isError && error?.statusCode === 404;
  const visit = useHorseVisit(Number(id), notOwn);

  // Sire lookup for the in-foal panel (B6, Equoria-ta4s). useHorse() is
  // disabled when its argument is falsy (`enabled: Boolean(horseId)`), so
  // 0 here means "not pregnant or sire not yet known — skip the fetch."
  const pregnancySireId = horseRaw?.pregnancySireId ?? 0;
  const { data: sireHorse } = useHorse(Number(pregnancySireId) || 0);

  // Loading state — detail page skeleton (portrait left + tab area right)
  if (isLoading || (notOwn && visit.isPending)) {
    return (
      <div className="min-h-screen" aria-label="Loading horse details">
        <PageContainer variant="wide">
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
        </PageContainer>
      </div>
    );
  }

  // Error state — canonical ErrorState (D-16). retry/backLink labels flow
  // through to ErrorCard (Equoria-o5hub ratchet: retryLabel/goHomeLabel
  // passthrough), so this flow keeps its "Retry" / "Back to Horse List" copy.
  // Retry is omitted for the 404 case (retrying a non-existent id is a no-op).
  if (notOwn && visit.data) {
    return (
      <div className="min-h-screen">
        <PageContainer variant="wide">
          <HorseVisitorView horse={visit.data} />
        </PageContainer>
      </div>
    );
  }

  if (isError || !horseRaw) {
    // A horse that is not hers was looked up as a visitor: only that read's
    // own 404 means the horse does not exist.
    const isNotFound = notOwn
      ? visit.error?.statusCode === 404
      : error?.message === 'Horse not found';
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <ErrorState
          severity="page"
          title={isNotFound ? 'Horse Not Found' : 'Error Loading Horse'}
          message={
            isNotFound
              ? 'The horse you are looking for does not exist or has been removed.'
              : 'An error occurred while loading the horse details. Please try again.'
          }
          retry={
            isNotFound
              ? undefined
              : { label: 'Retry', onClick: () => (notOwn ? visit.refetch() : refetch()) }
          }
          backLink={{ label: 'Back to Horse List', onClick: () => navigate('/stable') }}
          className="w-full"
        />
      </div>
    );
  }

  // Normalize horse data — produces a NEW object so the React Query cache is never mutated.
  // Shadows `horseRaw` so all downstream JSX references stay unchanged.
  const horse: Horse = normalizeHorseDetail(horseRaw);

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
    { id: 'show-results', label: 'Show Results', icon: <Award className="w-4 h-4" /> },
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
      {/* PageContainer wide (D §1): replaces the local max-w-7xl + px wrapper —
          horizontal gutters belong to the DashboardLayout shell. */}
      <PageContainer variant="wide">
        {/* Header — the back link now renders inside HorseProfileCard's
            EntityHeader (D-01 identity header). */}
        <div className="mb-6">
          {/* Horse Profile Card */}
          <HorseProfileCard
            horse={horse}
            sireName={sireHorse?.name ?? null}
            isEditing={isEditing}
            editName={editName}
            onStartEdit={() => {
              // Equoria-4fnro: an unnamed horse opens an EMPTY field.
              setEditName(isUnnamed(horse.name) ? '' : horse.name);
              setIsEditing(true);
            }}
            onCancelEdit={() => setIsEditing(false)}
            onChangeEditName={setEditName}
            refetch={refetch}
          />
        </div>

        {/* Quick Actions Bar — the ONE sanctioned exception to D-08 / the One Gold
            Action Rule: Train and Enter Competition are both gold primaries here,
            because a horse's two co-equal destinations are training and competing
            and ranking one above the other misrepresents the product. View Parents
            stays secondary, and a third gold on this bar would still be wrong.
            Recorded in DESIGN.md under The One Gold Action Rule (user directive,
            confirmed 2026-08-14) — do not "fix" this to a single primary. */}
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

        {/* Tonight's care, at every age: one horse page for life (owner rulings
            q67 / q71, 2026-10-26). Home reminders link here with #care. */}
        <CareArea horseId={horse.id} horseName={horse.name} />

        {/* Tab Navigation + Content — CanonicalTabs underline variant (Equoria-o5hub.11).
            Radix unmounts inactive TabsContent by default, preserving the prior
            lazy "render only the active tab" behavior. */}
        <Surface variant="panel" className="p-0 mb-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              const next = tabs.find((tab) => tab.id === v);
              if (next) setActiveTab(next.id);
            }}
          >
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
              <OverviewTab
                horse={horse}
                onOpenTemperamentReference={() => setShowTemperamentReference(true)}
              />
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
            <TabsContent value="show-results" className="mt-0 p-6">
              <ShowResultsTab horseId={horse.id} />
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
        </Surface>
      </PageContainer>

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
