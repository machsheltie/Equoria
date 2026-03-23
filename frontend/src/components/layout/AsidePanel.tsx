/**
 * AsidePanel — desktop sidebar with stable summary, cooldowns, activity (Section 07)
 *
 * Visible on desktop (1024px+), hidden on smaller screens.
 * Wired to live horse data via useHorses hook.
 */

import { useAuth } from '@/contexts/AuthContext';
import { useHorses } from '@/hooks/api/useHorses';
import { CooldownTimer } from '@/components/common/CooldownTimer';

/* ─── Care status helpers (same thresholds as Index.tsx horse cards) ────── */
function careStatus(
  dateStr: unknown,
  warnDays: number,
  errorDays: number
): 'good' | 'warn' | 'bad' {
  if (!dateStr) return 'bad';
  const ts =
    typeof dateStr === 'string'
      ? new Date(dateStr).getTime()
      : typeof dateStr === 'object' && dateStr !== null
        ? new Date(dateStr as string).getTime()
        : 0;
  if (!ts) return 'bad';
  const daysAgo = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (daysAgo >= errorDays) return 'bad';
  if (daysAgo >= warnDays) return 'warn';
  return 'good';
}

function horseNeedsCare(horse: Record<string, unknown>): boolean {
  return (
    careStatus(horse.lastFedDate, 1, 3) !== 'good' ||
    careStatus(horse.lastShod, 7, 14) !== 'good' ||
    careStatus(horse.lastGroomed, 3, 7) !== 'good' ||
    careStatus(horse.lastVettedDate, 7, 14) !== 'good'
  );
}

function isReadyToTrain(horse: Record<string, unknown>): boolean {
  if (!horse.trainingCooldown) return true;
  return new Date(horse.trainingCooldown as string).getTime() <= Date.now();
}

export function AsidePanel() {
  const { user } = useAuth();
  const { data: horses } = useHorses();

  const balance = user?.money?.toLocaleString() ?? '0';
  const horseList = (Array.isArray(horses) ? horses : []) as Record<string, unknown>[];
  const totalHorses = horseList.length;
  const readyCount = horseList.filter(isReadyToTrain).length;
  const needsCareCount = horseList.filter(horseNeedsCare).length;

  // Horses with active training cooldowns
  const horsesWithCooldown = horseList
    .filter((h) => {
      if (!h.trainingCooldown) return false;
      return new Date(h.trainingCooldown as string).getTime() > Date.now();
    })
    .map((h) => ({
      id: h.id as number,
      name: h.name as string,
      cooldown: h.trainingCooldown as string,
    }));

  return (
    <aside className="hidden lg:block w-[280px] flex-shrink-0 pt-6 space-y-4">
      {/* Stable Summary */}
      <div className="bg-[var(--glass-bg)] border border-[rgba(200,168,78,0.2)] rounded-[var(--radius-lg)] p-4 [backdrop-filter:blur(10px)_saturate(1.3)_brightness(1.2)] shadow-[0_0_12px_rgba(200,168,78,0.06)]">
        <h3
          className="text-[0.85rem] font-semibold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--glass-border)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Stable Summary
        </h3>
        <div className="space-y-0">
          <AsideStat label="Total Horses" value={String(totalHorses)} />
          <AsideStat label="Balance" value={`${balance} 🪙`} variant="gold" />
          <AsideStat label="Ready to Train" value={String(readyCount)} variant="success" />
          <AsideStat
            label="Needs Care"
            value={needsCareCount > 0 ? String(needsCareCount) : '0'}
            variant={needsCareCount > 0 ? 'warning' : undefined}
          />
        </div>
      </div>

      {/* Cooldown Timers */}
      <div className="bg-[var(--glass-bg)] border border-[rgba(200,168,78,0.2)] rounded-[var(--radius-lg)] p-4 [backdrop-filter:blur(10px)_saturate(1.3)_brightness(1.2)] shadow-[0_0_12px_rgba(200,168,78,0.06)]">
        <h3
          className="text-[0.85rem] font-semibold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--glass-border)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Cooldown Timers
        </h3>
        {horsesWithCooldown.length === 0 ? (
          <div className="space-y-2">
            {horseList.length > 0 ? (
              horseList.map((h) => (
                <div key={h.id as number} className="flex items-center justify-between py-1">
                  <span className="text-xs text-[var(--text-secondary)]">{h.name as string}</span>
                  <CooldownTimer
                    endsAt={h.trainingCooldown as string | null}
                    label="Training"
                    compact
                  />
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No horses yet</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {horseList.map((h) => (
              <div key={h.id as number} className="flex items-center justify-between py-1">
                <span className="text-xs text-[var(--text-secondary)]">{h.name as string}</span>
                <CooldownTimer
                  endsAt={h.trainingCooldown as string | null}
                  label="Training"
                  compact
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-[var(--glass-bg)] border border-[rgba(200,168,78,0.2)] rounded-[var(--radius-lg)] p-4 [backdrop-filter:blur(10px)_saturate(1.3)_brightness(1.2)] shadow-[0_0_12px_rgba(200,168,78,0.06)]">
        <h3
          className="text-[0.85rem] font-semibold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--glass-border)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Recent Activity
        </h3>
        <p className="text-xs text-[var(--text-muted)]">No recent activity</p>
      </div>
    </aside>
  );
}

/** Stat row inside aside panels */
function AsideStat({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: 'gold' | 'success' | 'warning';
}) {
  const colorClass =
    variant === 'gold'
      ? 'text-[var(--gold-light)]'
      : variant === 'success'
        ? 'text-[var(--status-success)]'
        : variant === 'warning'
          ? 'text-[var(--status-warning)]'
          : 'text-[var(--text-primary)]';

  return (
    <div className="flex justify-between py-1.5 text-[0.8rem]">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className={`font-semibold ${colorClass}`}>{value}</span>
    </div>
  );
}
