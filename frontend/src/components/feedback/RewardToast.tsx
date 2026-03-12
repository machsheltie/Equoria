/**
 * RewardToast (Epic 30-3)
 *
 * Gold-accented toast notification for meaningful in-game rewards.
 * Auto-dismisses after 4 seconds. Supports 5 reward types with distinct icons.
 *
 * Meaningful-only policy:
 *   Only use for first-time events, level-ups, unlocks, prize wins, or
 *   rare milestones — NOT for routine confirmations (those use success banners).
 *
 * Usage:
 *   <RewardToast
 *     type="level-up"
 *     title="Level Up!"
 *     message="You reached Level 5"
 *     onDismiss={() => setShow(false)}
 *   />
 *
 * Types: 'prize' | 'level-up' | 'trait' | 'foal-born' | 'milestone'
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, TrendingUp, Dna, Heart, Star, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type RewardType = 'prize' | 'level-up' | 'trait' | 'foal-born' | 'milestone';

export interface RewardToastProps {
  type: RewardType;
  title: string;
  message?: string;
  /** Auto-dismiss duration in ms — default 4000 */
  duration?: number;
  onDismiss: () => void;
}

// ── Icon + colour map ──────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  RewardType,
  { Icon: React.ElementType; accentColor: string; bgColor: string }
> = {
  prize: {
    Icon: Trophy,
    accentColor: 'var(--gold-400)',
    bgColor: 'rgba(201,162,39,0.1)',
  },
  'level-up': {
    Icon: TrendingUp,
    accentColor: '#60a5fa', // blue-400
    bgColor: 'rgba(96,165,250,0.08)',
  },
  trait: {
    Icon: Dna,
    accentColor: '#a78bfa', // violet-400
    bgColor: 'rgba(167,139,250,0.08)',
  },
  'foal-born': {
    Icon: Heart,
    accentColor: '#f472b6', // pink-400
    bgColor: 'rgba(244,114,182,0.08)',
  },
  milestone: {
    Icon: Star,
    accentColor: '#34d399', // emerald-400
    bgColor: 'rgba(52,211,153,0.08)',
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export function RewardToast({
  type,
  title,
  message,
  duration = 4000,
  onDismiss,
}: RewardToastProps) {
  const { Icon, accentColor, bgColor } = TYPE_CONFIG[type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, onDismiss]);

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-6 right-4 sm:right-6 z-[var(--z-modal)] w-72 sm:w-80 pointer-events-auto"
      style={{ animation: 'reward-toast-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both' }}
    >
      <div
        className="glass-panel-heavy rounded-2xl border px-4 py-3 flex items-start gap-3 shadow-xl"
        style={{
          borderColor: `${accentColor}33`,
          background: `${bgColor}`,
        }}
      >
        {/* Icon */}
        <div
          className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full border"
          style={{ borderColor: `${accentColor}4d`, background: `${accentColor}12` }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color: accentColor }} aria-hidden="true" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p
            className="text-sm font-bold text-[var(--cream)] leading-tight font-[var(--font-heading)] truncate"
            style={{ color: accentColor }}
          >
            {title}
          </p>
          {message && (
            <p className="mt-0.5 text-xs text-[var(--text-muted)] font-[var(--font-body)] leading-relaxed line-clamp-2">
              {message}
            </p>
          )}
        </div>

        {/* Dismiss */}
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--cream)] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className="mt-1 mx-1 h-0.5 rounded-full bg-[var(--celestial-navy-700)] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: '100%',
            background: accentColor,
            animation: `reward-toast-progress ${duration}ms linear forwards`,
          }}
        />
      </div>
    </div>,
    document.body
  );
}

export default RewardToast;
