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

type ChipVariant = 'ready' | 'active' | 'cooldown' | 'neutral' | 'warning';

interface NarrativeChipProps {
  text: string;
  variant?: ChipVariant;
  className?: string;
}

const VARIANT_STYLES: Record<ChipVariant, string> = {
  ready: [
    'bg-[rgba(201,162,39,0.15)] border border-[var(--gold-primary)]',
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
    'bg-[rgba(212,168,67,0.12)] border border-[var(--status-warning)]',
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
  healthStatus?: 'healthy' | 'injured' | 'recovering';
}

export function deriveHorseChip(
  data: HorseChipData
): { text: string; variant: ChipVariant } | null {
  const now = Date.now();

  if (data.healthStatus === 'injured') {
    return { text: 'Injured — needs vet', variant: 'warning' };
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
