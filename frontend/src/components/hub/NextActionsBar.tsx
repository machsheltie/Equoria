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

import { Link } from 'react-router-dom';
import { Dumbbell, Trophy, Heart, Star, Coins, Stethoscope, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNextActions } from '@/hooks/api/useNextActions';
import type { NextAction } from '@/hooks/api/useNextActions';

/* ─── Narrative copy for each action type ───────────────────────────────── */
const NARRATIVES: Record<NextAction['type'], (a: NextAction) => string> = {
  train: (a) => (a.horseName ? `${a.horseName} is ready to train!` : 'A horse is ready to train'),
  compete: (a) => (a.horseName ? `Enter ${a.horseName} in a show` : 'Browse open competitions'),
  breed: (a) => (a.horseName ? `${a.horseName} is ready to breed` : 'Check breeding pairs'),
  'groom-foal': (a) => (a.horseName ? `${a.horseName} needs enrichment` : 'A foal needs care'),
  'claim-prize': () => 'You have unclaimed prizes!',
  'check-results': () => 'Competition results are in',
  'visit-vet': (a) => (a.horseName ? `${a.horseName} needs veterinary care` : 'A horse needs care'),
};

const ICONS: Record<NextAction['type'], React.ReactNode> = {
  train: <Dumbbell className="w-5 h-5" />,
  compete: <Trophy className="w-5 h-5" />,
  breed: <Heart className="w-5 h-5" />,
  'groom-foal': <Star className="w-5 h-5" />,
  'claim-prize': <Coins className="w-5 h-5" />,
  'check-results': <Trophy className="w-5 h-5" />,
  'visit-vet': <Stethoscope className="w-5 h-5" />,
};

const ACTION_LINKS: Record<NextAction['type'], string> = {
  train: '/training',
  compete: '/competitions',
  breed: '/breeding',
  'groom-foal': '/grooms',
  'claim-prize': '/competitions',
  'check-results': '/competitions',
  'visit-vet': '/veterinarian',
};

/* ─── ActionCard ────────────────────────────────────────────────────────── */
interface ActionCardProps {
  action: NextAction;
  isTopPriority: boolean;
}

function ActionCard({ action, isTopPriority }: ActionCardProps) {
  const narrative = NARRATIVES[action.type]?.(action) ?? action.type;
  const icon = ICONS[action.type];
  const href = action.horseId
    ? `${ACTION_LINKS[action.type]}?horseId=${action.horseId}`
    : ACTION_LINKS[action.type];

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
              'border border-[var(--gold-primary)] bg-[rgba(201,162,39,0.1)]',
              'hover:bg-[rgba(201,162,39,0.18)] hover:shadow-[0_0_16px_rgba(201,162,39,0.3)]',
            ].join(' ')
          : [
              'glass-panel-subtle',
              'hover:border-[rgba(201,162,39,0.4)] hover:bg-[rgba(10,22,40,0.6)]',
            ].join(' ')
      )}
      aria-label={narrative}
    >
      <span
        className={cn(
          'rounded-lg p-2',
          isTopPriority
            ? 'text-[var(--gold-primary)] bg-[rgba(201,162,39,0.15)]'
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

/* ─── NextActionsBar ────────────────────────────────────────────────────── */
export function NextActionsBar() {
  const { data: actions, isLoading, error } = useNextActions();

  if (isLoading) {
    return (
      <div
        className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible"
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

  if (error || !actions?.length) {
    return null;
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
