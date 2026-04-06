/**
 * GameBadge — Rarity-aware pill badge (Story 22-6)
 *
 * Owns all visual styling for badges. Naked badge.tsx is a plain div forwarder.
 * Rarity variants: common, uncommon, rare, ultra-rare, legendary.
 * Utility variants: default (gold), secondary, destructive, success, warning, primary, outline.
 * All colours use CSS custom property tokens — no raw rgba literals.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { type BadgeProps as NakedBadgeProps } from '@/components/ui/badge';

const gameBadgeVariants = cva(
  [
    'inline-flex items-center rounded-full px-2.5 py-0.5',
    'text-xs font-semibold tracking-wide uppercase',
    'font-[var(--font-body)] border',
    'transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-[var(--gold-bright)]',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-[var(--badge-gold-bg)] border-[var(--gold-primary)] text-[var(--gold-light)]',
        secondary:
          'bg-[var(--bg-twilight)]/20 border-[var(--glass-border)] text-[var(--text-secondary)]',
        destructive:
          'bg-[var(--badge-danger-bg)] border-[var(--status-danger)] text-[var(--status-danger)]',
        success:
          'bg-[var(--badge-success-bg)] border-[var(--status-success)] text-[var(--status-success)]',
        warning:
          'bg-[var(--badge-warning-bg)] border-[var(--status-warning)] text-[var(--status-warning)]',
        primary: 'bg-[var(--badge-info-bg)] border-[var(--status-info)] text-[var(--status-info)]',
        outline: 'bg-transparent border-[var(--glass-border)] text-[var(--text-primary)]',
        common:
          'bg-[var(--badge-common-bg)] border-[var(--rarity-common)] text-[var(--rarity-common)]',
        uncommon:
          'bg-[var(--badge-success-bg)] border-[var(--rarity-uncommon)] text-[var(--rarity-uncommon)]',
        rare: 'bg-[var(--badge-rare-bg)] border-[var(--status-rare)] text-[var(--status-rare)]',
        'ultra-rare':
          'bg-[var(--badge-ultra-rare-bg)] border-[var(--rarity-ultra-rare)] text-[var(--gold-bright)]',
        legendary:
          'bg-[var(--badge-legendary-bg)] border-[var(--status-legendary)] text-[var(--status-legendary)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface GameBadgeProps extends NakedBadgeProps, VariantProps<typeof gameBadgeVariants> {}

function GameBadge({ className, variant, ...props }: GameBadgeProps) {
  return <div className={cn(gameBadgeVariants({ variant }), className)} {...props} />;
}

export { GameBadge, gameBadgeVariants };
