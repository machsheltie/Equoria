/**
 * ConformationShowsPanel (Equoria-8g4n, 31F-FE-3)
 *
 * The conformation-show entry surface, extracted from the former standalone
 * ConformationShowsPage so it can render as a tab inside
 * CompetitionBrowserPage. Reuses `useCompetitions` (returns all open shows
 * including ridden + conformation) and filters by `showType === 'conformation'`.
 * Each selection opens `ConformationEntryModal` against the chosen horse.
 *
 * This is a pure presentational/data panel — no PageHero, no route concerns —
 * so it can be embedded under the unified competition browser tabs while the
 * standalone /conformation-shows route redirects here.
 */

import { type JSX, useMemo, useState } from 'react';
import { formatDate } from '@/lib/formatDate';
import { competitionDisciplineLabel } from '@/lib/utils/training-utils';
import { useCompetitions } from '@/hooks/api/useCompetitions';
import { useHorses } from '@/hooks/api/useHorses';
import ConformationEntryModal from '@/components/competition/ConformationEntryModal';
import Currency from '@/components/ui/Currency';
import { Button } from '@/components/ui/button';
import { InlineError, SectionLoading } from '@/components/ui/state';
import { userMessageFor } from '@/lib/http/userMessage';

interface SelectedEntry {
  show: { id: number; name: string; entryFee: number };
  horse: { id: number; name: string; sex?: string };
}

const ConformationShowsPanel = (): JSX.Element => {
  const {
    data: competitions = [],
    isLoading,
    error,
    refetch: refetchCompetitions,
    isFetching,
  } = useCompetitions();
  const { data: horses = [] } = useHorses();
  const [selectedShowId, setSelectedShowId] = useState<number | ''>('');
  const [selectedHorseId, setSelectedHorseId] = useState<number | ''>('');
  const [entry, setEntry] = useState<SelectedEntry | null>(null);

  const conformationShows = useMemo(
    () => competitions.filter((c) => c.showType === 'conformation'),
    [competitions]
  );

  const openEntryModal = () => {
    if (typeof selectedShowId !== 'number' || typeof selectedHorseId !== 'number') return;
    const show = conformationShows.find((s) => s.id === selectedShowId);
    const horse = horses.find((h) => h.id === selectedHorseId);
    if (!show || !horse) return;
    setEntry({
      show: { id: show.id, name: show.name, entryFee: show.entryFee },
      horse: { id: horse.id, name: horse.name, sex: horse.sex },
    });
  };

  return (
    <div data-testid="conformation-shows-panel">
      <p className="text-sm text-gray-700">
        Compete on the conformation circuit — judges score type, balance, and movement regardless of
        training discipline. Title points earned here add a permanent breeding-value boost to your
        horse.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700">Horse</span>
          <select
            value={selectedHorseId === '' ? '' : String(selectedHorseId)}
            onChange={(e) =>
              setSelectedHorseId(e.target.value === '' ? '' : Number(e.target.value))
            }
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
            data-testid="conformation-horse-select"
          >
            <option value="">Select a horse…</option>
            {horses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700">Conformation Show</span>
          <select
            value={selectedShowId === '' ? '' : String(selectedShowId)}
            onChange={(e) => setSelectedShowId(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={isLoading || conformationShows.length === 0}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
            data-testid="conformation-show-select"
          >
            <option value="">Select a show…</option>
            {conformationShows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {competitionDisciplineLabel(s.discipline)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <InlineError
            message={`Couldn't load the conformation shows. ${userMessageFor(error).message}`}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetchCompetitions()}
            pending={isFetching}
          >
            Try again
          </Button>
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={openEntryModal}
          disabled={typeof selectedShowId !== 'number' || typeof selectedHorseId !== 'number'}
          className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
          data-testid="conformation-open-entry"
        >
          Enter Show
        </button>
      </div>

      <section className="mt-8" aria-label="Open conformation shows">
        <h2 className="text-lg font-semibold text-gray-900">Open Shows</h2>
        {isLoading && <SectionLoading label="Loading conformation shows" minHeight="80px" />}
        {/* EMPTY only via a successful fetch — never over a failed one. */}
        {!isLoading && !error && conformationShows.length === 0 && (
          <p className="mt-2 text-sm text-gray-500" data-testid="conformation-empty-state">
            No open conformation shows. Check back later.
          </p>
        )}
        {!isLoading && conformationShows.length > 0 && (
          <ul className="mt-2 divide-y divide-gray-200 border border-gray-200 rounded-md">
            {conformationShows.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between px-4 py-2 text-sm"
                data-testid={`conformation-show-row-${s.id}`}
              >
                <div>
                  <div className="font-medium text-gray-900">{s.name}</div>
                  <div className="text-gray-500">
                    {competitionDisciplineLabel(s.discipline)} · {formatDate(s.date)}
                  </div>
                </div>
                {/* Equoria-wgfbf: entry debits this fee (Equoria-mwjst). */}
                <span className="text-gray-700" data-testid={`conformation-show-fee-${s.id}`}>
                  Entry: <Currency amount={s.entryFee} zeroLabel="Free" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {entry && (
        <ConformationEntryModal
          isOpen={true}
          onClose={() => setEntry(null)}
          show={entry.show}
          horse={entry.horse}
        />
      )}
    </div>
  );
};

export default ConformationShowsPanel;
