/**
 * AsidePanel — legacy desktop utility rail with stable summary and cooldowns.
 *
 * The former Section 07 is retired. This component is migration debt, not a
 * reusable layout pattern or authority for new sidebars.
 * Visible on desktop (1024px+), hidden on smaller screens.
 * Wired to live horse data via useHorses hook.
 */

import { useAuth } from '@/contexts/AuthContext';
import { useHorses } from '@/hooks/api/useHorses';
import { CooldownTimer } from '@/components/common/CooldownTimer';
import { useReadyToTrainCount } from '@/hooks/api/useTraining';
import { horseNeedsCare } from '@/lib/utils/care-status-utils';

export function AsidePanel() {
  const { user } = useAuth();
  const { data: horses } = useHorses();

  // Unknown balance is "—", never a believable 0 (Equoria-bvddn.39); a real 0 stays 0.
  const balance = user?.money?.toLocaleString() ?? '—';
  const horseList = (Array.isArray(horses) ? horses : []) as unknown as Record<string, unknown>[];
  // Unknown until the list has loaded: an empty `horseList` also stands in for
  // "still loading" and "failed", and must not read as zero horses
  // (Equoria-pm0gu, doctrine §4).
  const rosterKnown = Array.isArray(horses);
  const totalHorses = horseList.length;
  // The server's verdict (Equoria-aycdv); null = unknown. Shown as "—" while either
  // it or the roster is unknown, so a failed roster never sits beside a count.
  const readyCount = useReadyToTrainCount(user?.id);
  const needsCareCount = horseList.filter(horseNeedsCare).length;

  return (
    <aside className="hidden lg:block w-[280px] flex-shrink-0 pt-6 space-y-4">
      {/* Stable Summary */}
      <div className="bg-[var(--glass-bg)] border border-[rgba(200,168,78,0.2)] rounded-[var(--radius-lg)] p-4 [backdrop-filter:blur(10px)_saturate(1.3)_brightness(1.2)] shadow-[0_0_12px_rgba(200,168,78,0.06)]">
        <h3
          className="text-[0.85rem] font-semibold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--glass-border)]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Stable Summary
        </h3>
        <div className="space-y-0">
          <AsideStat label="Total Horses" value={rosterKnown ? String(totalHorses) : '—'} />
          <AsideStat label="Balance" value={`${balance} 🪙`} variant="gold" />
          <AsideStat
            label="Ready to Train"
            value={rosterKnown && readyCount !== null ? String(readyCount) : '—'}
            variant="success"
          />
          <AsideStat
            label="Needs Care"
            value={rosterKnown ? String(needsCareCount) : '—'}
            variant={needsCareCount > 0 ? 'warning' : undefined}
          />
        </div>
      </div>

      {/* Cooldown Timers */}
      <div className="bg-[var(--glass-bg)] border border-[rgba(200,168,78,0.2)] rounded-[var(--radius-lg)] p-4 [backdrop-filter:blur(10px)_saturate(1.3)_brightness(1.2)] shadow-[0_0_12px_rgba(200,168,78,0.06)]">
        <h3
          className="text-[0.85rem] font-semibold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--glass-border)]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Cooldown Timers
        </h3>
        {!rosterKnown ? (
          <p className="text-xs text-[var(--text-muted)]">—</p>
        ) : horseList.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">No horses yet</p>
        ) : (
          <div className="space-y-2">
            {horseList.map((h) => (
              <div key={h.id as number} className="flex items-center justify-between py-1">
                <span className="text-xs text-[var(--text-secondary)]">{h.name as string}</span>
                <CooldownTimer
                  endsAt={(h.trainingCooldown as string) ?? null}
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
          style={{ fontFamily: 'var(--font-body)' }}
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
