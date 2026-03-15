/**
 * WhileYouWereGone (Task 24-2 / 24-3)
 *
 * Return overlay shown when user has been away for 4+ hours.
 * Glass panel overlay with prioritized activity summary (max 8 items).
 * Dismissible via: "Continue" button, Escape key, or backdrop click.
 *
 * Trigger detection (Task 24-3):
 *   - lastVisit stored in localStorage on beforeunload
 *   - On mount: if delta > 4 hours AND completedOnboarding === true → fetch + show
 *
 * Does NOT appear for new users (completedOnboarding === false).
 */

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Trophy, MessageCircle, Star, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useWhileYouWereGone, type WYAGItem } from '@/hooks/api/useWhileYouWereGone';

const ABSENCE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours
const LAST_VISIT_KEY = 'equoria-last-visit';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function getLastVisit(): string | null {
  try {
    return localStorage.getItem(LAST_VISIT_KEY);
  } catch {
    return null;
  }
}

function setLastVisit() {
  try {
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
}

function isLongAbsence(lastVisit: string | null): boolean {
  if (!lastVisit) return false;
  return Date.now() - new Date(lastVisit).getTime() > ABSENCE_THRESHOLD_MS;
}

const TYPE_ICONS: Record<WYAGItem['type'], React.ReactNode> = {
  'competition-result': <Trophy className="w-4 h-4 text-[var(--gold-primary)]" />,
  'foal-milestone': <Star className="w-4 h-4 text-[var(--status-info)]" />,
  message: <MessageCircle className="w-4 h-4 text-[var(--text-primary)]" />,
  'club-activity': <Star className="w-4 h-4 text-[var(--text-muted)]" />,
  'training-complete': <Trophy className="w-4 h-4 text-[var(--status-success)]" />,
  'market-sale': <Trophy className="w-4 h-4 text-[var(--gold-primary)]" />,
};

/* ─── WYAGItem row ───────────────────────────────────────────────────────── */
function WYAGRow({ item, onClose }: { item: WYAGItem; onClose: () => void }) {
  const content = (
    <div className="flex items-start gap-3 py-3 border-b border-[rgba(201,162,39,0.1)] last:border-0">
      <span className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(10,22,40,0.5)] flex items-center justify-center">
        {TYPE_ICONS[item.type]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">{item.title}</p>
        {item.description && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{item.description}</p>
        )}
      </div>
      {item.actionUrl && (
        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
      )}
    </div>
  );

  if (item.actionUrl) {
    return (
      <Link
        to={item.actionUrl}
        onClick={onClose}
        className="block hover:bg-[rgba(201,162,39,0.05)] rounded-lg px-2 -mx-2 transition-colors"
      >
        {content}
      </Link>
    );
  }
  return <div className="px-2 -mx-2">{content}</div>;
}

/* ─── Main overlay ───────────────────────────────────────────────────────── */
export function WhileYouWereGone() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [since, setSince] = useState<string | null>(null);

  const { data, isLoading } = useWhileYouWereGone(since, visible);

  // On mount: detect absence, update lastVisit, store beforeunload handler
  useEffect(() => {
    if (!user?.completedOnboarding) return;

    const lastVisit = getLastVisit();
    if (isLongAbsence(lastVisit)) {
      setSince(lastVisit);
      setVisible(true);
    }
    setLastVisit();

    const handleUnload = () => setLastVisit();
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [user?.completedOnboarding]);

  // Escape key to dismiss
  const close = useCallback(() => setVisible(false), []);
  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, close]);

  if (!visible) return null;

  const items = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="While you were away"
      className="fixed inset-0 z-[var(--z-celebration)] flex items-end sm:items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--bg-deep-space)]/70"
        onClick={close}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-md glass-panel-heavy p-6',
          'animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--gold-primary)] font-[var(--font-heading)]">
              While You Were Away
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Here's what happened in your stable
            </p>
          </div>
          <button
            onClick={close}
            aria-label="Dismiss"
            className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[rgba(201,162,39,0.1)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 glass-panel-subtle rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-4 text-center">
            Nothing new since your last visit. Your stable is resting peacefully.
          </p>
        ) : (
          <div>
            {items.map((item, i) => (
              <WYAGRow key={`${item.type}-${i}`} item={item} onClose={close} />
            ))}
            {hasMore && (
              <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
                + more activity — explore your stable
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <button onClick={close} className="mt-5 w-full btn-cobalt text-sm font-medium py-2.5">
          Continue to Stable
        </button>
      </div>
    </div>,
    document.body
  );
}
