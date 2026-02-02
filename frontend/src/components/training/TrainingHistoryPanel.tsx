import { useTrainingOverview } from '@/hooks/api/useTraining';
import { useHorseTrainingHistory } from '@/hooks/api/useHorses';

interface TrainingHistoryPanelProps {
  horseId?: number;
}

const TrainingHistoryPanel = ({ horseId }: TrainingHistoryPanelProps) => {
  // Only query when we have a valid horseId - hooks have enabled guards
  const { data, isLoading, error } = useTrainingOverview(horseId || 0);
  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
  } = useHorseTrainingHistory(horseId || 0);

  // Early return if no horse selected - queries won't execute due to enabled guards
  if (!horseId) {
    return (
      <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        Select a horse above to view discipline status and training history.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-base font-semibold text-slate-900">Discipline Status</h4>
      <p className="text-sm text-slate-600">
        Snapshot of each discipline for this horse. Updates after every session.
      </p>

      {isLoading && <div className="mt-2 text-sm text-slate-600">Loading status…</div>}
      {error && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error.message}
        </div>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {data?.map((entry) => (
          <div
            key={`${entry.discipline}-${entry.nextEligibleDate ?? 'ready'}`}
            className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">
                {entry.discipline.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-slate-500">
                Score: {entry.score !== undefined ? entry.score : '—'}
              </span>
            </div>
            <div className="text-xs text-slate-600">
              {entry.nextEligibleDate
                ? `Cooldown until ${new Date(entry.nextEligibleDate).toLocaleString()}`
                : 'Ready to train'}
            </div>
          </div>
        ))}

        {!isLoading && !error && (!data || data.length === 0) && (
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            No discipline data available yet.
          </div>
        )}
      </div>

      <div className="mt-4">
        <h5 className="text-sm font-semibold text-slate-900">Training History</h5>
        {historyLoading && <div className="text-sm text-slate-600">Loading history…</div>}
        {historyError && (
          <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {historyError.message}
          </div>
        )}
        <div className="mt-2 space-y-2">
          {history?.map((entry) => (
            <div
              key={`${entry.id ?? entry.trainedAt ?? entry.discipline ?? crypto.randomUUID()}`}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{entry.discipline ?? 'Discipline'}</span>
                <span className="text-xs text-slate-500">
                  {entry.trainedAt
                    ? new Date(entry.trainedAt).toLocaleString()
                    : 'Timestamp pending'}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                Score: {entry.score !== undefined ? entry.score : '—'}{' '}
                {entry.notes ? `• ${entry.notes}` : ''}
              </div>
            </div>
          ))}
          {!historyLoading && !historyError && (!history || history.length === 0) && (
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
              No training history available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrainingHistoryPanel;
