import { useTrainingOverview } from '@/hooks/api/useTraining';
import { useHorseTrainingHistory } from '@/hooks/api/useHorses';

interface TrainingHistoryPanelProps {
  horseId?: number;
}

// Equoria-2dnd2: the krjw5 invalid-date guard + date+time formatting now come
// from the shared util. The prior bare toLocaleString() (locale-default
// "12/10/2025, 12:00:00 AM") is normalized to the canonical app format
// ("Dec 10, 2025, 12:00 AM"); the 'Date unavailable' fallback is preserved.
import { formatDateTime } from '@/lib/formatDate';

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
      <div className="rounded-md border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] px-4 py-3 text-sm text-role-secondary shadow-sm">
        Select a horse above to view discipline status and training history.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] p-4 shadow-sm">
      <h4 className="text-base font-semibold text-[var(--text-primary)]">Discipline Status</h4>
      <p className="text-sm text-role-secondary">
        Snapshot of each discipline for this horse. Updates after every session.
      </p>

      {isLoading && <div className="mt-2 text-sm text-role-secondary">Loading status…</div>}
      {error && (
        <div className="mt-2 rounded-md border border-[var(--role-warning-border)] bg-[var(--role-warning-bg)] px-3 py-2 text-sm text-[var(--role-warning-text)]">
          {error.message}
        </div>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {data?.map((entry) => (
          <div
            key={`${entry.discipline}-${entry.nextEligibleDate ?? 'ready'}`}
            className="rounded-lg border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {entry.discipline.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-role-secondary">
                Score: {entry.score !== undefined ? entry.score : '—'}
              </span>
            </div>
            <div className="text-xs text-role-secondary">
              {entry.nextEligibleDate
                ? `Cooldown until ${formatDateTime(entry.nextEligibleDate)}`
                : 'Ready to train'}
            </div>
          </div>
        ))}

        {!isLoading && !error && (!data || data.length === 0) && (
          <div className="rounded-md border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] px-3 py-2 text-sm text-role-secondary">
            No discipline data available yet.
          </div>
        )}
      </div>

      <div className="mt-4">
        <h5 className="text-sm font-semibold text-[var(--text-primary)]">Training History</h5>
        {historyLoading && <div className="text-sm text-role-secondary">Loading history…</div>}
        {historyError && (
          <div className="mt-1 rounded-md border border-[var(--role-warning-border)] bg-[var(--role-warning-bg)] px-3 py-2 text-sm text-[var(--role-warning-text)]">
            {historyError.message}
          </div>
        )}
        <div className="mt-2 space-y-2">
          {history?.map((entry) => (
            <div
              key={`${entry.id ?? entry.trainedAt ?? entry.discipline ?? crypto.randomUUID()}`}
              className="rounded-md border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{entry.discipline ?? 'Discipline'}</span>
                <span className="text-xs text-role-secondary">
                  {entry.trainedAt ? formatDateTime(entry.trainedAt) : 'Timestamp pending'}
                </span>
              </div>
              <div className="text-xs text-role-secondary">
                Score: {entry.score !== undefined ? entry.score : '—'}{' '}
                {entry.notes ? `• ${entry.notes}` : ''}
              </div>
            </div>
          ))}
          {!historyLoading && !historyError && (!history || history.length === 0) && (
            <div className="rounded-md border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] px-3 py-2 text-sm text-role-secondary shadow-sm">
              No training history available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrainingHistoryPanel;
