/**
 * Competition Browser Page — The Arena
 *
 * Browse and filter available competitions. Competitive mood — gold trophies
 * and racing red accents set the tone.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
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
import PageHero from '@/components/layout/PageHero';
import { Button } from '@/components/ui/button';

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

  // Equoria-ocn9: deep-link from /horses → /competitions?horse=ID. When the
  // user owns the horse referenced in the URL, pre-select it so the entry
  // modal opens with the correct horse already chosen. Runs once per mount
  // to avoid clobbering manual selections.
  const [searchParams] = useSearchParams();
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
    }
  }, [horseQueryParam, horses]);

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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <PageHero
          title="Competition Arena"
          subtitle="Loading available competitions…"
          mood="competitive"
          icon={<Trophy className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
        />
        <main
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8"
          role="status"
          aria-label="Loading competitions"
        >
          <div
            className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center"
            data-testid="loading-spinner"
          >
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-[rgba(201,162,39,0.3)] border-t-[var(--gold-400)] mb-4" />
            <p className="text-sm text-[var(--text-muted)]">Loading competitions...</p>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen">
        <PageHero
          title="Competition Arena"
          subtitle="Something went wrong."
          mood="competitive"
          icon={<Trophy className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
        />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div
            className="glass-panel rounded-2xl border-[rgba(224,90,90,0.3)] p-8 text-center"
            data-testid="error-state"
            role="alert"
          >
            <Trophy className="mx-auto h-10 w-10 text-[var(--status-error)] opacity-50 mb-4" />
            <p className="text-base font-medium text-[var(--cream)] mb-2 font-[var(--font-heading)]">
              Failed to load competitions
            </p>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              Please check your connection and try again.
            </p>
            <Button type="button" onClick={() => refetch()} size="lg">
              Try Again
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen" data-testid="competition-browser-page">
      <PageHero
        title="Competition Arena"
        subtitle="Browse and enter horse competitions to test your skills and earn prizes among the stars."
        mood="competitive"
        icon={<Trophy className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        {/* Filters Section */}
        <div data-testid="page-header">
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
        </div>

        {/* Competition List */}
        <CompetitionList
          competitions={data || []}
          isLoading={isLoading}
          onCompetitionClick={handleCompetitionClick}
          title="Available Competitions"
        />
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
      />
    </div>
  );
};

export default CompetitionBrowserPage;
