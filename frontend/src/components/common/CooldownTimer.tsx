/**
 * CooldownTimer (Epic 26-2)
 *
 * Real-time countdown with Celestial Night styling.
 * Shows days/hours/minutes. When expired: green "Ready!" glow state.
 * Used for training cooldown (7 days) and breeding cooldown (30d mare / 14d stallion).
 *
 * Updates every minute (normal) or every second (when < 60s remain).
 *
 * Props:
 *  - endsAt: ISO timestamp or null/undefined (null = no cooldown → Ready)
 *  - label?: contextual label (e.g. "Training cooldown", "Breeding cooldown")
 *  - compact?: render inline chip instead of full card
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Clock } from 'lucide-react';

// ── Types & helpers ────────────────────────────────────────────────────────────

interface TimeRemaining {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeRemaining(endsAt: string | null | undefined): TimeRemaining {
  if (!endsAt) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const endMs = new Date(endsAt).getTime();
  if (Number.isNaN(endMs)) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const total = endMs - Date.now();
  if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    total,
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
  };
}

function formatLabel(t: TimeRemaining): string {
  if (t.total <= 0) return 'Ready!';
  if (t.days > 0) return `${t.days}d ${t.hours}h`;
  if (t.hours > 0) return `${t.hours}h ${t.minutes}m`;
  if (t.minutes > 0) return `${t.minutes}m`;
  return `${t.seconds}s`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export interface CooldownTimerProps {
  /** ISO timestamp when cooldown ends. Null/undefined = no cooldown (Ready). */
  endsAt: string | null | undefined;
  /** Contextual label shown above the timer */
  label?: string;
  /** When true, renders as an inline chip instead of a card */
  compact?: boolean;
  className?: string;
}

export function CooldownTimer({
  endsAt,
  label,
  compact = false,
  className = '',
}: CooldownTimerProps) {
  const [time, setTime] = useState<TimeRemaining>(() => getTimeRemaining(endsAt));

  const tick = useCallback(() => {
    setTime(getTimeRemaining(endsAt));
  }, [endsAt]);

  useEffect(() => {
    tick();
    // Use 1s interval when < 60s remain; 60s otherwise to reduce redraws.
    // Re-run the effect when crossing the 60s threshold so the interval switches.
    const ms = time.total > 0 && time.total < 60_000 ? 1000 : 60_000;
    const interval = setInterval(tick, ms);
    return () => clearInterval(interval);
  }, [endsAt, tick, time.total < 60_000]);

  const isReady = time.total <= 0;
  const displayText = isReady ? 'Ready!' : formatLabel(time);

  if (compact) {
    return (
      <span
        data-testid="cooldown-timer"
        className={[
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all',
          isReady
            ? 'bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.35)] text-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.2)]'
            : 'bg-[rgba(10,22,50,0.5)] border-[rgba(100,130,165,0.25)] text-[var(--text-muted)]',
          className,
        ].join(' ')}
        aria-label={label ? `${label}: ${displayText}` : displayText}
      >
        <Clock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        {displayText}
      </span>
    );
  }

  return (
    <div
      data-testid="cooldown-timer"
      className={[
        'rounded-xl border p-4 transition-all duration-300',
        isReady
          ? 'bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.3)] shadow-[0_0_16px_rgba(34,197,94,0.12)]'
          : 'bg-[rgba(10,22,50,0.5)] border-[rgba(100,130,165,0.2)]',
        className,
      ].join(' ')}
      role="timer"
      aria-live={isReady ? 'assertive' : 'polite'}
      aria-label={label ? `${label}: ${displayText}` : displayText}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock
            className={[
              'w-4 h-4 flex-shrink-0',
              isReady ? 'text-emerald-400' : 'text-[var(--text-muted)]',
            ].join(' ')}
            aria-hidden="true"
          />
          {label && (
            <span className="text-xs text-[var(--text-muted)] font-[var(--font-body)] uppercase tracking-widest">
              {label}
            </span>
          )}
        </div>

        <span
          className={[
            'text-sm font-bold font-[var(--font-heading)] tabular-nums',
            isReady
              ? 'text-emerald-400 drop-shadow-[0_0_6px_rgba(34,197,94,0.6)]'
              : 'text-[var(--text-primary)]',
          ].join(' ')}
        >
          {displayText}
        </span>
      </div>

      {/* Breakdown when > 1 day */}
      {!isReady && time.days > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[
            { value: time.days, unit: 'days' },
            { value: time.hours, unit: 'hrs' },
            { value: time.minutes, unit: 'min' },
          ].map(({ value, unit }) => (
            <div
              key={unit}
              className="py-1.5 rounded-lg bg-[var(--bg-midnight)] border border-[rgba(100,130,165,0.15)]"
            >
              <p className="text-base font-bold text-[var(--text-primary)] font-[var(--font-heading)] tabular-nums leading-none">
                {String(value).padStart(2, '0')}
              </p>
              <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5 font-[var(--font-body)]">
                {unit}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* "Ready!" pulse indicator */}
      {isReady && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs text-emerald-400 font-[var(--font-body)]">Available now</span>
        </div>
      )}
    </div>
  );
}

export default CooldownTimer;
