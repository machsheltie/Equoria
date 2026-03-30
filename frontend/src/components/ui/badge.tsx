/** Badge — Celestial Night discipline-specific accents (Task 22-6) */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
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
        /** Gold accent — general status, unlocked, active */
        default: [
          'bg-[rgba(200,168,78,0.15)] border-[var(--gold-primary)]',
          'text-[var(--gold-light)]',
        ].join(' '),
        /** Muted — secondary labels, categories */
        secondary: [
          'bg-[var(--bg-twilight)]/20 border-[var(--glass-border)]',
          'text-[var(--text-secondary)]',
        ].join(' '),
        /** Red — destructive, ineligible, overdue */
        destructive: [
          'bg-[rgba(239,68,68,0.15)] border-[var(--status-danger)]',
          'text-[var(--status-danger)]',
        ].join(' '),
        /** Success — eligible, completed, healthy */
        success: [
          'bg-[rgba(34,197,94,0.15)] border-[var(--status-success)]',
          'text-[var(--status-success)]',
        ].join(' '),
        /** Warning — cooldown, care needed */
        warning: [
          'bg-[rgba(245,158,11,0.15)] border-[var(--status-warning)]',
          'text-[var(--status-warning)]',
        ].join(' '),
        /** Electric blue — primary type, discipline */
        primary: [
          'bg-[rgba(59,130,246,0.15)] border-[var(--status-info)]',
          'text-[var(--status-info)]',
        ].join(' '),
        /** Outline — transparent bg, subtle border */
        outline: ['bg-transparent border-[var(--glass-border)]', 'text-[var(--text-primary)]'].join(
          ' '
        ),
        /** Common rarity — muted slate */
        common: [
          'bg-[rgba(138,155,186,0.15)] border-[var(--rarity-common)]',
          'text-[var(--rarity-common)]',
        ].join(' '),
        /** Uncommon rarity — green */
        uncommon: [
          'bg-[rgba(34,197,94,0.15)] border-[var(--rarity-uncommon)]',
          'text-[var(--rarity-uncommon)]',
        ].join(' '),
        /** Rare rarity — blue-violet */
        rare: [
          'bg-[rgba(167,139,250,0.2)] border-[var(--status-rare)]',
          'text-[var(--status-rare)]',
        ].join(' '),
        /** Ultra-rare rarity — gold */
        'ultra-rare': [
          'bg-[rgba(200,168,78,0.2)] border-[var(--rarity-ultra-rare)]',
          'text-[var(--gold-bright)]',
        ].join(' '),
        /** Legendary rarity — bright gold glow */
        legendary: [
          'bg-[rgba(245,230,163,0.15)] border-[var(--status-legendary)]',
          'text-[var(--status-legendary)]',
        ].join(' '),
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
