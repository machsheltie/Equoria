import { useMemo, useState } from 'react';
import { useTrainableHorses } from '@/hooks/api/useTraining';
import type { TrainableHorse } from '@/lib/api-client';
import TrainingSessionModal from './TrainingSessionModal';
import TrainingHistoryPanel from './TrainingHistoryPanel';

type EligibilityFilter = 'all' | 'ready' | 'cooldown';

interface TrainingDashboardProps {
  userId?: string | number;
}

const TrainingDashboard = ({ userId = 'me' }: TrainingDashboardProps) => {
  const [selectedHorse, setSelectedHorse] = useState<TrainableHorse | null>(null);
  const [filter, setFilter] = useState<EligibilityFilter>('all');
  const normalizedUserId = typeof userId === 'number' ? String(userId) : userId;
  const { data: horses, isLoading, error, refetch } = useTrainableHorses(normalizedUserId);

  // Filter horses based on eligibility
  const filteredHorses = useMemo(() => {
    if (!horses) return [];
    switch (filter) {
      case 'ready':
        return horses.filter((h) => !h.nextEligibleAt);
      case 'cooldown':
        return horses.filter((h) => Boolean(h.nextEligibleAt));
      default:
        return horses;
    }
  }, [horses, filter]);

  // Count ready vs cooldown horses
  const readyCount = useMemo(() => horses?.filter((h) => !h.nextEligibleAt).length ?? 0, [horses]);
  const cooldownCount = useMemo(
    () => horses?.filter((h) => Boolean(h.nextEligibleAt)).length ?? 0,
    [horses]
  );

  const renderHorseCard = (horse: TrainableHorse) => {
    const cooldown = horse.nextEligibleAt
      ? `Cooldown until ${new Date(horse.nextEligibleAt).toLocaleString()}`
      : 'Ready to train';

    return (
      <div
        key={horse.id}
        className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm"
      >
        <div>
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold text-slate-900">{horse.name}</div>
            <span className="text-sm text-slate-500">Level {horse.level ?? '—'}</span>
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Best: {horse.bestDisciplines?.join(', ') || 'TBD'}
          </div>
          <div className="mt-2 text-xs text-slate-500">{cooldown}</div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            {horse.breed ?? 'Unknown breed'}
          </span>
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            onClick={() => setSelectedHorse(horse)}
            disabled={Boolean(horse.nextEligibleAt)}
          >
            {horse.nextEligibleAt ? 'On Cooldown' : 'Train'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Training Dashboard</h2>
          <p className="text-sm text-slate-600">Track readiness, start sessions, and review gains.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        >
          Refresh
        </button>
      </div>

      {/* Eligibility Filter */}
      <div className="flex items-center gap-2" role="group" aria-label="Filter horses by eligibility">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          aria-pressed={filter === 'all'}
        >
          All ({horses?.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setFilter('ready')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === 'ready'
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
          aria-pressed={filter === 'ready'}
        >
          Ready ({readyCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter('cooldown')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === 'cooldown'
              ? 'bg-amber-600 text-white'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
          aria-pressed={filter === 'cooldown'}
        >
          On Cooldown ({cooldownCount})
        </button>
      </div>

      {isLoading && <div className="text-sm text-slate-600">Loading trainable horses…</div>}
      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error.message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredHorses.map(renderHorseCard)}
        {!isLoading && !error && filteredHorses.length === 0 && (
          <div className="rounded-md border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
            {horses && horses.length > 0
              ? `No ${filter === 'ready' ? 'ready' : filter === 'cooldown' ? 'cooldown' : ''} horses found.`
              : 'No trainable horses found.'}
          </div>
        )}
      </div>

      <TrainingHistoryPanel horseId={selectedHorse?.id} />

      {selectedHorse && (
        <TrainingSessionModal
          horse={selectedHorse}
          onClose={() => setSelectedHorse(null)}
          onCompleted={() => {
            setSelectedHorse(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default TrainingDashboard;
