/**
 * RewardToastProvider — trigger layer for RewardToast (Equoria-vcar, Spec 11.3.10)
 *
 * RewardToast.tsx was fully built but ORPHANED — never exported, never
 * rendered. This provider is the missing trigger layer:
 *
 *   - owns a sequential FIFO queue (one toast visible at a time)
 *   - enforces the spec's "meaningful-only" policy: callers pass
 *     `meaningful: boolean`; non-meaningful (routine +5 XP, standard
 *     participation XP, daily groom completion) are dropped — no toast
 *   - 0.5s gap between consecutive toasts (Spec 11.3.10 "queued")
 *   - renders the real RewardToast (role=status, aria-live=polite,
 *     auto-dismiss + manual dismiss already implemented in the component)
 *
 * Consumption: `const { notify } = useRewardToast();` then call
 *   notify({ type, title, message, meaningful })
 * from real meaningful-progress sites (XP threshold cross, approaching
 * level-up, trait discovery, personal milestone). The provider is mounted
 * once globally in App.tsx so any authenticated screen can fire rewards.
 *
 * Why a provider+queue (not per-site <RewardToast> like CinematicMoment):
 * RewardToast events originate from many disparate sources (XP bar, trait
 * panel, competition result, breeding) and the spec mandates sequential
 * queueing with a gap. A per-site copy can't coordinate a global queue or
 * dedupe a burst. CinematicMoment is per-site because it is a deliberate
 * full-screen interrupt with no queueing requirement — different contract.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import RewardToast, { type RewardType } from './RewardToast';

export interface RewardNotification {
  type: RewardType;
  title: string;
  message?: string;
  /**
   * Spec 11.3.10 meaningful-only policy. `true` for FenceJumpBar threshold
   * crossed, approaching level-up, first-time XP source, trait discovery,
   * personal milestone. `false` for routine gains — those are dropped.
   */
  meaningful: boolean;
  /** Optional auto-dismiss override (ms) — default 4000 (RewardToast default) */
  duration?: number;
}

interface RewardToastContextValue {
  /** Enqueue a reward notification. Non-meaningful items are silently dropped. */
  notify: (n: RewardNotification) => void;
}

const RewardToastContext = createContext<RewardToastContextValue | null>(null);

/** Gap between one toast dismissing and the next appearing (Spec 11.3.10). */
const INTER_TOAST_GAP_MS = 500;

/**
 * Auto-dismiss duration. Spec 11.3.10 states "visible (3 seconds)", so the
 * trigger layer passes 3000ms by default (the RewardToast component's own
 * default is 4000ms and is left unchanged for any other direct callers).
 */
const DEFAULT_VISIBLE_MS = 3000;

export function RewardToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<RewardNotification | null>(null);
  const queueRef = useRef<RewardNotification[]>([]);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift();
    setCurrent(next ?? null);
  }, []);

  const handleDismiss = useCallback(() => {
    setCurrent(null);
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    if (queueRef.current.length > 0) {
      gapTimerRef.current = setTimeout(showNext, INTER_TOAST_GAP_MS);
    }
  }, [showNext]);

  const notify = useCallback((n: RewardNotification) => {
    // Spec 11.3.10: routine gains must NOT toast.
    if (!n.meaningful) return;
    queueRef.current.push(n);
    // If nothing is showing and no gap timer is pending, show immediately.
    setCurrent((prev) => {
      if (prev !== null) return prev; // a toast is up — stay queued
      return queueRef.current.shift() ?? null;
    });
  }, []);

  const value = useMemo<RewardToastContextValue>(() => ({ notify }), [notify]);

  return (
    <RewardToastContext.Provider value={value}>
      {children}
      {current && (
        <RewardToast
          // Key forces a fresh mount per notification so the auto-dismiss
          // timer + slide-in animation restart for each queued item.
          key={`${current.type}-${current.title}-${queueRef.current.length}`}
          type={current.type}
          title={current.title}
          message={current.message}
          duration={current.duration ?? DEFAULT_VISIBLE_MS}
          onDismiss={handleDismiss}
        />
      )}
    </RewardToastContext.Provider>
  );
}

let warnedNoProvider = false;

/**
 * Access the reward-toast trigger.
 *
 * RewardToast is an OPTIONAL, non-critical feedback enhancement. The provider
 * is mounted once globally in App.tsx, so every production route has it. When
 * a component is rendered in isolation WITHOUT the provider (e.g. a focused
 * unit test that mounts a single page), this returns a safe no-op `notify`
 * and emits a one-time dev warning — a missing optional-enhancement provider
 * must never crash a page (it would turn a "nice toast" into a hard failure).
 *
 * This is graceful degradation of a non-essential layer, NOT a silenced
 * error in a critical path: no progress data is lost (the bar/level/trait UI
 * still renders from real data), only the celebratory toast is skipped.
 */
const NOOP_REWARD_TOAST: RewardToastContextValue = { notify: () => {} };

export function useRewardToast(): RewardToastContextValue {
  const ctx = useContext(RewardToastContext);
  if (!ctx) {
    if (!warnedNoProvider && import.meta.env.MODE !== 'test') {
      warnedNoProvider = true;
      console.warn(
        'useRewardToast() called outside a RewardToastProvider — reward toasts disabled. ' +
          'Mount <RewardToastProvider> (App.tsx does this globally).'
      );
    }
    return NOOP_REWARD_TOAST;
  }
  return ctx;
}

export default RewardToastProvider;
