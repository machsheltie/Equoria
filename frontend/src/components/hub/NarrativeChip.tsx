/**
 * NarrativeChip (Task 23-2)
 *
 * Small contextual chip showing horse/stable state micro-stories.
 * Examples: "Ready to compete!", "2 foals developing", "Training cooldown: 3d 4h"
 *
 * Attach to HorseCard and stable summary cards.
 * Color-coded by urgency: gold=action-ready, blue=in-progress, muted=neutral.
 */

import { cn } from '@/lib/utils';
import { getOrdinal } from '@/lib/activity-utils';
import { isBadHealth } from '@/lib/healthWords';

type ChipVariant = 'ready' | 'active' | 'cooldown' | 'neutral' | 'warning';

interface NarrativeChipProps {
  text: string;
  variant?: ChipVariant;
  className?: string;
}

const VARIANT_STYLES: Record<ChipVariant, string> = {
  ready: [
    'bg-[var(--alpha-gold-ember-15)] border border-[var(--gold-primary)]',
    'text-[var(--gold-light)]',
  ].join(' '),
  active: [
    'bg-[rgba(58,111,221,0.15)] border border-[var(--status-info)]',
    'text-[var(--status-info)]',
  ].join(' '),
  cooldown: [
    'bg-[rgba(100,130,165,0.1)] border border-[rgba(100,130,165,0.3)]',
    'text-[var(--text-muted)]',
  ].join(' '),
  warning: [
    'bg-[var(--alpha-gold-primary-12)] border border-[var(--status-warning)]',
    'text-[var(--status-warning)]',
  ].join(' '),
  neutral: [
    'bg-transparent border border-[rgba(100,130,165,0.2)]',
    'text-[var(--text-muted)]',
  ].join(' '),
};

export function NarrativeChip({ text, variant = 'neutral', className }: NarrativeChipProps) {
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full',
        'text-xs font-medium font-[var(--font-body)]',
        'whitespace-nowrap',
        VARIANT_STYLES[variant],
        className
      )}
    >
      {text}
    </span>
  );
}

/**
 * Derive a NarrativeChip from raw horse/stable state.
 * Callers provide the data; this returns variant + text.
 */
interface HorseChipData {
  trainingCooldownEndsAt?: string | null;
  breedingCooldownEndsAt?: string | null;
  isEligibleForCompetition?: boolean;
  hasFoalsInDevelopment?: number;
  /** Any health value: the displayedHealth band or a stored healthStatus (healthWords.ts). */
  health?: string | null;
}

/** The chapter for a horse in Bad health (Equoria-2uqdg; health words per Equoria-u0jop). */
const badHealthChapter = 'In Bad health — needs feeding and the vet';

export function deriveHorseChip(
  data: HorseChipData
): { text: string; variant: ChipVariant } | null {
  const now = Date.now();

  if (isBadHealth(data.health)) {
    return { text: badHealthChapter, variant: 'warning' };
  }

  if (data.trainingCooldownEndsAt) {
    const cooldownMs = new Date(data.trainingCooldownEndsAt).getTime() - now;
    if (cooldownMs > 0) {
      const days = Math.floor(cooldownMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((cooldownMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const label = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
      return { text: `Training: ${label}`, variant: 'cooldown' };
    }
  }

  if (data.isEligibleForCompetition) {
    return { text: 'Ready to compete!', variant: 'ready' };
  }

  if (data.hasFoalsInDevelopment) {
    return {
      text: `${data.hasFoalsInDevelopment} foal${data.hasFoalsInDevelopment > 1 ? 's' : ''} developing`,
      variant: 'active',
    };
  }

  return null;
}

/**
 * "Latest chapter" derivation (Equoria-pqzmf, Spec 11.3.12).
 *
 * The spec wants each hub stable card to show the horse's latest one-line
 * story. The richest source ("Won 2nd place in yesterday's show") is the
 * per-horse competition history. Equoria-55bo.5 added a batched
 * `latestEvent` field to the HorseSummary list serializer (one query for
 * the whole page — NOT an N+1), so competition narratives are now a real
 * source here alongside the REAL per-horse care fields (health, in-foal
 * state, most recent care / training timestamp). A competition event is
 * preferred when it is more recent than the latest care event.
 *
 * States (Spec 11.3.12):
 *   - current : a real event within the last 7 days
 *   - stale   : the most recent real event is > 7 days old (card fades it)
 *   - none    : no recorded events -> "Just arrived at the stable"
 */
export interface LatestChapterInput {
  /**
   * The derived health band the list serializer sends (Excellent / Very Good /
   * Good / Fair / Bad). Preferred over the stored healthStatus when present.
   */
  displayedHealth?: string | null;
  /** The stored health value; read only when no displayedHealth is sent. */
  healthStatus?: string | null;
  inFoalSinceDate?: string | null;
  lastFedDate?: string | null;
  lastGroomed?: string | null;
  lastShod?: string | null;
  lastVettedDate?: string | null;
  trainingCooldown?: string | null;
  /**
   * Equoria-55bo.5: most-recent competition result from the batched
   * HorseSummary.latestEvent field (NOT an N+1 fetch). When present and
   * more recent than the latest care event, it becomes the chapter.
   */
  latestEvent?: {
    type: 'competition';
    showName: string;
    discipline: string;
    /** The 1-based rank (Equoria-f46tb: an integer, no longer '1st'). */
    placement: number | null;
    date: string | null;
  } | null;
}

export interface LatestChapter {
  text: string;
  variant: ChipVariant;
  /** True when the most recent real event is older than 7 days. */
  stale: boolean;
}

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function chapterTs(value?: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export function deriveLatestChapter(
  data: LatestChapterInput,
  now: number = Date.now()
): LatestChapter {
  // Health and in-foal are "current" status narratives (not time-faded).
  // Bad health is the one health story (owner ruling 2026-10-23, Equoria-u0jop):
  // a horse in Fair health or better tells its latest event instead.
  if (isBadHealth(data.displayedHealth ?? data.healthStatus)) {
    return { text: badHealthChapter, variant: 'warning', stale: false };
  }

  const inFoalAt = chapterTs(data.inFoalSinceDate);
  if (inFoalAt !== null) {
    return { text: 'Expecting a foal', variant: 'active', stale: false };
  }

  // Build a competition-event chapter from the real batched latestEvent
  // (Equoria-55bo.5). Placement-aware copy mirrors Spec 11.3.12 examples.
  let competitionEvent: { label: string; at: number; isCompetition: true } | null = null;
  if (data.latestEvent && data.latestEvent.type === 'competition') {
    const at = chapterTs(data.latestEvent.date);
    if (at !== null) {
      const place = data.latestEvent.placement;
      const disc = data.latestEvent.discipline;
      const label =
        place === 1
          ? `Won the ${disc} show`
          : place
            ? `Placed ${getOrdinal(place)} in ${disc}`
            : `Competed in ${disc}`;
      competitionEvent = { label, at, isCompetition: true };
    }
  }

  // Pick the single most recent real care/training event.
  const careEvents: Array<{ label: string; at: number | null }> = [
    { label: 'Last fed', at: chapterTs(data.lastFedDate) },
    { label: 'Freshly groomed', at: chapterTs(data.lastGroomed) },
    { label: 'Newly shod', at: chapterTs(data.lastShod) },
    { label: 'Visited the vet', at: chapterTs(data.lastVettedDate) },
    { label: 'Wrapped up training', at: chapterTs(data.trainingCooldown) },
  ];
  const latestCare = careEvents
    .filter((e): e is { label: string; at: number } => e.at !== null)
    .sort((a, b) => b.at - a.at)[0];

  // Prefer the competition event when it is more recent than the latest
  // care event (or when there is no care event at all).
  const candidates: Array<{ label: string; at: number; isCompetition?: boolean }> = [];
  if (competitionEvent) candidates.push(competitionEvent);
  if (latestCare) candidates.push(latestCare);
  const latest = candidates.sort((a, b) => b.at - a.at)[0];

  if (!latest) {
    return { text: 'Just arrived at the stable', variant: 'neutral', stale: false };
  }

  const stale = now - latest.at > STALE_AFTER_MS;
  // A fresh competition win/placement is an "active" highlight; a fresh
  // care event keeps the existing cooldown styling.
  const freshVariant: ChipVariant = latest.isCompetition ? 'active' : 'cooldown';
  return { text: latest.label, variant: stale ? 'neutral' : freshVariant, stale };
}
