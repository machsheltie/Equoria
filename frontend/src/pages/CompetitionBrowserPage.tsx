/**
 * Competition Browser Page — The Arena
 *
 * Browse and filter available competitions. Competitive mood — gold trophies
 * and racing red accents set the tone.
 */

import { type JSX, useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { useCompetitions } from '@/hooks/api/useCompetitions';
import { useHorses } from '@/hooks/api/useHorses';
import { useAuth } from '@/contexts/AuthContext';
import { competitionsApi, ApiError } from '@/lib/api-client';
import CompetitionFilters, {
  type DisciplineFilter,
  type DateRangeFilter,
  type EntryFeeFilter,
} from '@/components/competition/CompetitionFilters';
import { CompetitionList } from '@/components/competition';
import CompetitionDetailModal, {
  type Competition as ModalCompetition,
} from '@/components/competition/CompetitionDetailModal';
import ConformationShowsPanel from '@/components/competition/ConformationShowsPanel';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionLoading, ErrorState } from '@/components/ui/state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/game';
import { useShowField } from '@/hooks/api/useShowField';

// Equoria-8g4n (31F-FE-3): the unified browser exposes ridden and
// conformation shows as tabs so testers reach both from one surface. Tab
// state lives in the ?tab= search param so /conformation-shows can redirect
// to /competitions?tab=conformation and deep-link straight to the panel.
type BrowserTab = 'ridden' | 'conformation';

const CompetitionBrowserPage = (): JSX.Element => {
  const { data, isLoading, error, refetch } = useCompetitions();
  const { data: horses = [] } = useHorses();
  const { refetchProfile } = useAuth();
  const queryClient = useQueryClient();

  const [disciplineFilter, setDisciplineFilter] = useState<DisciplineFilter>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('all');
  const [entryFeeFilter, setEntryFeeFilter] = useState<EntryFeeFilter>('all');
  const [selectedCompetition, setSelectedCompetition] = useState<ModalCompetition | null>(null);
  const [selectedHorseId, setSelectedHorseId] = useState<number | ''>('');
  const [entryError, setEntryError] = useState<string | undefined>();

  // Equoria-lfkw1: real scouting field for the open detail modal. Fetched
  // here (container) and passed into the presentational modal so the modal
  // stays QueryClient-free.
  const { data: fieldData, isLoading: fieldLoading } = useShowField(
    selectedCompetition?.id ?? null
  );

  // Equoria-ocn9: deep-link from /horses → /competitions?horse=ID. When the
  // user owns the horse referenced in the URL, pre-select it so the entry
  // modal opens with the correct horse already chosen. Runs once per mount
  // to avoid clobbering manual selections.
  //
  // Equoria-ocn9 review fix: strip the consumed ?horse= from the URL via
  // setSearchParams({}). Without this, a user who manually changed the
  // selection and then navigated away/back would see the original
  // deep-linked horse re-selected on remount.
  const [searchParams, setSearchParams] = useSearchParams();
  const horseQueryParam = searchParams.get('horse');
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (!horseQueryParam || !horses || horses.length === 0) return;
    const targetId = Number(horseQueryParam);
    if (!Number.isFinite(targetId)) return;
    if (horses.some((h) => h.id === targetId)) {
      setSelectedHorseId(targetId);
      autoSelectedRef.current = true;
      // Equoria-ocn9 re-review fix: only delete `horse`, preserve any other
      // params the URL was carrying (analytics utm_*, filters, etc.).
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('horse');
          return next;
        },
        { replace: true }
      );
    }
  }, [horseQueryParam, horses, setSearchParams]);

  const activeTab: BrowserTab =
    searchParams.get('tab') === 'conformation' ? 'conformation' : 'ridden';
  const selectTab = useCallback(
    (tab: BrowserTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'ridden') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const enterCompetition = useMutation<
    { entryId: number; horseId: number; showId: number; entryFee: number },
    ApiError,
    { competitionId: number; horseId: number }
  >({
    mutationFn: ({ competitionId, horseId }) => competitionsApi.enter({ competitionId, horseId }),
    onSuccess: async () => {
      setEntryError(undefined);
      setSelectedCompetition(null);
      await Promise.all([
        refetch(),
        refetchProfile(),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
    },
    onError: (apiError) => {
      setEntryError(apiError?.message ?? 'Failed to enter competition.');
    },
  });

  const handleClearFilters = useCallback(() => {
    setDisciplineFilter('all');
    setDateRangeFilter('all');
    setEntryFeeFilter('all');
  }, []);

  const handleCompetitionClick = useCallback(
    (competitionId: number) => {
      const found = (data ?? []).find((c) => c.id === competitionId);
      if (!found) return;
      setSelectedCompetition({
        id: found.id,
        name: found.name,
        discipline: found.discipline,
        date: found.date,
        prizePool: found.prizePool,
        entryFee: found.entryFee,
        description: found.description,
        location: found.location,
        maxParticipants: found.maxEntries,
        currentParticipants: found.currentEntries,
      });
      // Equoria-ocn9: preserve a pre-selected horse (from ?horse= deep link
      // or a previous modal session) when it's still in the user's roster.
      // Otherwise fall back to the first owned horse.
      setSelectedHorseId((current) => {
        if (current !== '' && horses.some((h) => h.id === current)) return current;
        return horses[0]?.id ?? '';
      });
      setEntryError(undefined);
    },
    [data, horses]
  );

  const handleEnterCompetition = useCallback(
    (competitionId: number) => {
      if (!selectedHorseId) {
        setEntryError('Choose a horse before entering this competition.');
        return;
      }
      enterCompetition.mutate({ competitionId, horseId: selectedHorseId });
    },
    [enterCompetition, selectedHorseId]
  );

  const handleTabChange = useCallback((next: string) => selectTab(next as BrowserTab), [selectTab]);

  // Equoria-8g4n: tab nav rendered in every state so the conformation tab is
  // reachable even while the ridden competition list is loading or errored
  // (the conformation panel manages its own loading/error from the same hook).
  // CanonicalTabs underline variant (Equoria-o5hub.11); tab state stays in the
  // ?tab= search param (controlled mode) so deep links keep working.
  const tabList = (
    <TabsList aria-label="Competition surfaces" data-testid="competition-browser-tabs">
      <TabsTrigger value="ridden" data-testid="tab-ridden">
        Ridden Shows
      </TabsTrigger>
      <TabsTrigger value="conformation" data-testid="tab-conformation">
        Conformation Shows
      </TabsTrigger>
    </TabsList>
  );

  // Shared operational header (canonical PageHeader — Equoria-o5hub.21; the
  // Arena has no location artwork, so it is not a hero surface).
  const pageHeader = (
    <PageHeader
      title="Competition Arena"
      subtitle="Browse and enter horse competitions to test your skills and earn prizes among the stars."
      icon={<Trophy className="w-6 h-6 text-[var(--gold-400)]" aria-hidden="true" />}
    />
  );

  // Loading state (ridden tab only — conformation panel self-manages).
  if (isLoading && activeTab === 'ridden') {
    return (
      <PageContainer variant="wide" padded={false} data-testid="competition-browser-page">
        {pageHeader}
        <main className="py-8" aria-label="Loading competitions">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">
            {tabList}
          </Tabs>
          <div data-testid="loading-spinner">
            <SectionLoading label="Loading competitions" minHeight="240px" />
          </div>
        </main>
      </PageContainer>
    );
  }

  // Error state (ridden tab only — conformation panel self-manages).
  if (error && activeTab === 'ridden') {
    return (
      <PageContainer variant="wide" padded={false} data-testid="competition-browser-page">
        {pageHeader}
        <main className="py-8">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">
            {tabList}
          </Tabs>
          <div data-testid="error-state">
            <ErrorState
              title="Failed to load competitions"
              message="Please check your connection and try again."
              retry={{ label: 'Try Again', onClick: () => refetch() }}
            />
          </div>
        </main>
      </PageContainer>
    );
  }

  // Success state
  return (
    <PageContainer variant="wide" padded={false} data-testid="competition-browser-page">
      {pageHeader}

      <main className="pb-12 pt-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          {tabList}

          <TabsContent value="conformation" data-testid="conformation-tab-panel">
            <ConformationShowsPanel />
          </TabsContent>
          <TabsContent value="ridden" data-testid="ridden-tab-panel">
            {/* Filters Section — legacy data-testid="page-header" wrapper removed:
                it now collides with the canonical PageHeader root testid. */}
            <CompetitionFilters
              disciplineFilter={disciplineFilter}
              dateRangeFilter={dateRangeFilter}
              entryFeeFilter={entryFeeFilter}
              onDisciplineChange={setDisciplineFilter}
              onDateRangeChange={setDateRangeFilter}
              onEntryFeeChange={setEntryFeeFilter}
              onClearFilters={handleClearFilters}
              className="mb-6"
            />

            {/* Competition List */}
            <CompetitionList
              competitions={data || []}
              isLoading={isLoading}
              onCompetitionClick={handleCompetitionClick}
              title="Available Competitions"
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Competition Detail Modal */}
      <CompetitionDetailModal
        isOpen={selectedCompetition !== null}
        onClose={() => setSelectedCompetition(null)}
        competition={selectedCompetition}
        onEnter={handleEnterCompetition}
        entryHorses={horses.map((horse) => ({ id: horse.id, name: horse.name }))}
        selectedHorseId={selectedHorseId}
        onSelectedHorseIdChange={setSelectedHorseId}
        isSubmitting={enterCompetition.isPending}
        error={entryError}
        fieldData={fieldData ?? null}
        fieldLoading={fieldLoading}
      />
    </PageContainer>
  );
};

export default CompetitionBrowserPage;
