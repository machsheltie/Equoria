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
      <div className="rounded-md border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.4)] px-4 py-3 text-sm text-[rgb(148,163,184)] shadow-sm">
        Select a horse above to view discipline status and training history.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.4)] p-4 shadow-sm">
      <h4 className="text-base font-semibold text-[rgb(220,235,255)]">Discipline Status</h4>
      <p className="text-sm text-[rgb(148,163,184)]">
        Snapshot of each discipline for this horse. Updates after every session.
      </p>

      {isLoading && <div className="mt-2 text-sm text-[rgb(148,163,184)]">Loading status…</div>}
      {error && (
        <div className="mt-2 rounded-md border border-amber-500/30 bg-[rgba(212,168,67,0.1)] px-3 py-2 text-sm text-amber-400">
          {error.message}
        </div>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {data?.map((entry) => (
          <div
            key={`${entry.discipline}-${entry.nextEligibleDate ?? 'ready'}`}
            className="rounded-lg border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.3)] px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[rgb(220,235,255)]">
                {entry.discipline.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-[rgb(148,163,184)]">
                Score: {entry.score !== undefined ? entry.score : '—'}
              </span>
            </div>
            <div className="text-xs text-[rgb(148,163,184)]">
              {entry.nextEligibleDate
                ? `Cooldown until ${new Date(entry.nextEligibleDate).toLocaleString()}`
                : 'Ready to train'}
            </div>
          </div>
        ))}

        {!isLoading && !error && (!data || data.length === 0) && (
          <div className="rounded-md border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.4)] px-3 py-2 text-sm text-[rgb(148,163,184)]">
            No discipline data available yet.
          </div>
        )}
      </div>

      <div className="mt-4">
        <h5 className="text-sm font-semibold text-[rgb(220,235,255)]">Training History</h5>
        {historyLoading && <div className="text-sm text-[rgb(148,163,184)]">Loading history…</div>}
        {historyError && (
          <div className="mt-1 rounded-md border border-amber-500/30 bg-[rgba(212,168,67,0.1)] px-3 py-2 text-sm text-amber-400">
            {historyError.message}
          </div>
        )}
        <div className="mt-2 space-y-2">
          {history?.map((entry) => (
            <div
              key={`${entry.id ?? entry.trainedAt ?? entry.discipline ?? crypto.randomUUID()}`}
              className="rounded-md border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.4)] px-3 py-2 text-sm text-[rgb(220,235,255)] shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{entry.discipline ?? 'Discipline'}</span>
                <span className="text-xs text-[rgb(148,163,184)]">
                  {entry.trainedAt
                    ? new Date(entry.trainedAt).toLocaleString()
                    : 'Timestamp pending'}
                </span>
              </div>
              <div className="text-xs text-[rgb(148,163,184)]">
                Score: {entry.score !== undefined ? entry.score : '—'}{' '}
                {entry.notes ? `• ${entry.notes}` : ''}
              </div>
            </div>
          ))}
          {!historyLoading && !historyError && (!history || history.length === 0) && (
            <div className="rounded-md border border-[rgba(37,99,235,0.3)] bg-[rgba(15,35,70,0.4)] px-3 py-2 text-sm text-[rgb(148,163,184)] shadow-sm">
              No training history available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrainingHistoryPanel;
