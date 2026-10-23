/**
 * NextActionsBar (Task 23-1)
 *
 * Constellation-model suggestion bar at the top of the Hub dashboard.
 * Server seeds action types + priority; client provides narrative copy.
 * Horizontal scroll on mobile, grid on desktop (1024px+).
 * Gold accent on highest-priority (priority === 1) action.
 *
 * API: GET /api/v1/next-actions  → NextAction[]
 * Hook: useNextActions()
 */

import { Link } from 'react-router';
import {
  Dumbbell,
  Trophy,
  Heart,
  Star,
  Coins,
  Medal,
  Stethoscope,
  Wheat,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNextActions } from '@/hooks/api/useNextActions';
import { ErrorState } from '@/components/ui/state';
import { userMessageFor } from '@/lib/http/userMessage';
import type { NextAction } from '@/hooks/api/useNextActions';

/* ─── Narrative copy for each action type ───────────────────────────────── */
const NARRATIVES: Record<NextAction['type'], (_a: NextAction) => string> = {
  train: (a) => (a.horseName ? `${a.horseName} is ready to train!` : 'A horse is ready to train'),
  compete: (a) => (a.horseName ? `Enter ${a.horseName} in a show` : 'Browse open competitions'),
  breed: (a) => (a.horseName ? `${a.horseName} is ready to breed` : 'Check breeding pairs'),
  'groom-foal': (a) => (a.horseName ? `${a.horseName} needs enrichment` : 'A foal needs care'),
  'claim-prize': () => 'You have unclaimed prizes!',
  // Equoria-oey96.28: the server sends how many results are still unread, so
  // the card can name what is actually waiting instead of announcing a flat fact.
  'check-results': (a) => {
    const count = typeof a.metadata?.count === 'number' ? a.metadata.count : 0;
    return count > 1 ? `${count} competition results are waiting` : 'Your results are in';
  },
  // Owner ruling 2026-10-23 (q28): the hub line names the bad health, and adds
  // "and fed" when the horse is hungry (the server sets needsFeeding).
  'visit-vet': (a) =>
    a.horseName
      ? `${a.horseName} is in bad health and needs to be vetted${a.metadata?.needsFeeding === true ? ' and fed' : ''}`
      : 'A horse needs care',
  // Equoria-cn6kt: a horse in critical health also needs feeding.
  feed: (a) => (a.horseName ? `${a.horseName} needs feeding` : 'A horse needs feeding'),
};

const ICONS: Record<NextAction['type'], React.ReactNode> = {
  train: <Dumbbell className="w-5 h-5" />,
  compete: <Trophy className="w-5 h-5" />,
  breed: <Heart className="w-5 h-5" />,
  'groom-foal': <Star className="w-5 h-5" />,
  'claim-prize': <Coins className="w-5 h-5" />,
  // A ribbon, not the trophy that compete already wears — the two cards can sit
  // side by side and must not read as the same errand.
  'check-results': <Medal className="w-5 h-5" />,
  'visit-vet': <Stethoscope className="w-5 h-5" />,
  feed: <Wheat className="w-5 h-5" />,
};

const ACTION_LINKS: Record<NextAction['type'], string> = {
  train: '/training',
  compete: '/competitions',
  breed: '/breeding',
  'groom-foal': '/grooms',
  'claim-prize': '/competitions',
  // Equoria-oey96.28: the results surface, not the browse-competitions list.
  'check-results': '/competition-results',
  'visit-vet': '/vet',
  // Feeding happens on the horse's own page (its action bar).
  feed: '/horses',
};

/* ─── ActionCard ────────────────────────────────────────────────────────── */
interface ActionCardProps {
  action: NextAction;
  isTopPriority: boolean;
}

function ActionCard({ action, isTopPriority }: ActionCardProps) {
  const narrative = NARRATIVES[action.type]?.(action) ?? action.type;
  const icon = ICONS[action.type];
  const href = !action.horseId
    ? ACTION_LINKS[action.type]
    : action.type === 'feed'
      ? `/horses/${action.horseId}`
      : `${ACTION_LINKS[action.type]}?horseId=${action.horseId}`;

  return (
    <Link
      to={href}
      className={cn(
        'flex-shrink-0 w-48 lg:w-auto',
        'flex flex-col items-start gap-2 p-4 rounded-xl',
        'transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--status-info)]',
        isTopPriority
          ? [
              'border border-[var(--gold-primary)] bg-[var(--alpha-gold-primary-10)]',
              'hover:bg-[var(--alpha-gold-ember-18)] hover:shadow-[0_0_16px_var(--alpha-gold-ember-30)]',
            ].join(' ')
          : [
              'glass-panel-subtle',
              'hover:border-[var(--alpha-gold-ember-40)] hover:bg-[rgba(10,22,40,0.6)]',
            ].join(' ')
      )}
      aria-label={narrative}
    >
      <span
        className={cn(
          'rounded-lg p-2',
          isTopPriority
            ? 'text-[var(--gold-primary)] bg-[var(--alpha-gold-ember-15)]'
            : 'text-[var(--status-info)] bg-[rgba(58,111,221,0.12)]'
        )}
      >
        {icon}
      </span>

      <p
        className={cn(
          'text-sm leading-snug',
          isTopPriority ? 'text-[var(--gold-light)] font-medium' : 'text-[var(--text-primary)]'
        )}
      >
        {narrative}
      </p>

      <ChevronRight
        className={cn(
          'w-4 h-4 self-end',
          isTopPriority ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)]'
        )}
      />
    </Link>
  );
}

export function NextActionsBar() {
  const { data: actions, isLoading, error, refetch } = useNextActions();

  if (isLoading) {
    return (
      <div
        className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible"
        role="status"
        aria-busy="true"
        aria-label="Loading next actions"
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 w-48 lg:w-auto h-28 glass-panel-subtle rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  // ERROR before EMPTY (doctrine §1): a failed read is not "nothing to suggest".
  // A failed 60s refresh keeps the last good list on screen rather than blanking it.
  if (error && !actions) {
    const { title, message, retryable } = userMessageFor(error);
    return (
      <section aria-label="Suggested next actions">
        <ErrorState
          title={title}
          message={message}
          retry={retryable ? { label: 'Try Again', onClick: () => void refetch() } : undefined}
          className="py-2"
          focusOnMount={false}
        />
      </section>
    );
  }

  // Genuine zero-action success: the resting line (Story 23.1 AC, literal copy).
  if (!actions?.length) {
    return (
      <section aria-label="Suggested next actions">
        <p className="glass-panel-subtle rounded-xl px-4 py-3 text-sm text-[var(--text-secondary)]">
          Your stable is resting — check back soon.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Suggested next actions">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3 font-[var(--font-body)]">
        Next Actions
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scroll-area-celestial lg:grid lg:grid-cols-4 lg:overflow-visible">
        {actions.map((action) => (
          <ActionCard
            key={`${action.type}-${action.horseId ?? 'global'}`}
            action={action}
            isTopPriority={action.priority === 1}
          />
        ))}
      </div>
    </section>
  );
}
