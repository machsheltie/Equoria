import { useTrainingOverview } from '@/hooks/api/useTraining';
import { useHorse, useHorseTrainingHistory } from '@/hooks/api/useHorses';
import { userMessageFor } from '@/lib/http/userMessage';
import { disciplineLabel } from '@/lib/utils/training-utils';
import type { DisciplineStatus } from '@/lib/api/types';

interface TrainingHistoryPanelProps {
  horseId?: number;
}

// Equoria-2dnd2: the krjw5 invalid-date guard + date+time formatting now come
// from the shared util. The prior bare toLocaleString() (locale-default
// "12/10/2025, 12:00:00 AM") is normalized to the canonical app format
// ("Dec 10, 2025, 12:00 AM"); the 'Date unavailable' fallback is preserved.
import { formatDateTime } from '@/lib/formatDate';

/**
 * The score a session recorded (Equoria-da2fw): before to after when both were
 * logged, the after-score alone when only it is known. Sessions logged before
 * scores were recorded carry neither, and read as an honest em dash.
 */
/**
 * A discipline's readiness line (Equoria-6m8zv): the cooldown while it runs,
 * otherwise the server's verdict. A horse the server refuses (too young,
 * retired, injured, no trainer) shows why, never "Ready to train".
 */
function readinessLabel(entry: DisciplineStatus): string {
  if (entry.nextEligibleDate) return `Cooldown until ${formatDateTime(entry.nextEligibleDate)}`;
  if (entry.eligible === false) return entry.reason || 'Cannot train right now';
  return 'Ready to train';
}

function sessionScoreLabel(before?: number | null, after?: number | null): string {
  if (typeof after !== 'number') return '—';
  return typeof before === 'number' ? `${before} → ${after}` : `${after}`;
}

const TrainingHistoryPanel = ({ horseId }: TrainingHistoryPanelProps) => {
  // Only query when we have a valid horseId - hooks have enabled guards
  const { data, isLoading, error } = useTrainingOverview(horseId || 0);
  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
  } = useHorseTrainingHistory(horseId || 0);
  // The status endpoint sends cooldowns, never scores; a discipline's current
  // score is the horse's own Horse.disciplineScores (keyed by discipline name).
  const { data: horse } = useHorse(horseId || 0);

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
          {userMessageFor(error).message}
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
                {disciplineLabel(entry.discipline)}
              </span>
              <span className="text-xs text-role-secondary">
                Score: {horse?.disciplineScores?.[entry.discipline] ?? '—'}
              </span>
            </div>
            <div className="text-xs text-role-secondary">{readinessLabel(entry)}</div>
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
            {userMessageFor(historyError).message}
          </div>
        )}
        <div className="mt-2 space-y-2">
          {history?.map((entry) => (
            <div
              key={`${entry.id ?? entry.trainedAt ?? entry.discipline ?? crypto.randomUUID()}`}
              className="rounded-md border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {entry.discipline ? disciplineLabel(entry.discipline) : 'Discipline'}
                </span>
                <span className="text-xs text-role-secondary">
                  {entry.trainedAt ? formatDateTime(entry.trainedAt) : 'Timestamp pending'}
                </span>
              </div>
              <div className="text-xs text-role-secondary">
                Score: {sessionScoreLabel(entry.scoreBefore, entry.scoreAfter)}
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
