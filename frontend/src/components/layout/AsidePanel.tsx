/**
 * AsidePanel — desktop sidebar with stable summary, cooldowns, activity (Section 07)
 *
 * Visible on desktop (1024px+), hidden on smaller screens.
 * Uses mock data initially — will be wired to live API hooks in Section 08.
 */

import { useAuth } from '@/contexts/AuthContext';

export function AsidePanel() {
  const { user } = useAuth();
  const balance = user?.money?.toLocaleString() ?? '0';

  return (
    <aside className="hidden lg:block w-[280px] flex-shrink-0 pt-6 space-y-4">
      {/* Stable Summary */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-[var(--radius-lg)] p-4">
        <h3
          className="text-[0.85rem] font-semibold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--glass-border)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Stable Summary
        </h3>
        <div className="space-y-0">
          <AsideStat label="Total Horses" value="--" />
          <AsideStat label="Balance" value={`${balance} 🪙`} variant="gold" />
          <AsideStat label="Ready to Train" value="--" variant="success" />
          <AsideStat label="Needs Care" value="--" variant="warning" />
        </div>
      </div>

      {/* Cooldown Timers */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-[var(--radius-lg)] p-4">
        <h3
          className="text-[0.85rem] font-semibold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--glass-border)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Cooldown Timers
        </h3>
        <p className="text-xs text-[var(--text-muted)]">No active cooldowns</p>
      </div>

      {/* Recent Activity */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-[var(--radius-lg)] p-4">
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
