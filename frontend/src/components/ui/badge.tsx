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
    'focus:outline-none focus:ring-2 focus:ring-[var(--electric-blue-300)]',
  ].join(' '),
  {
    variants: {
      variant: {
        /** Gold accent — general status, unlocked, active */
        default: [
          'bg-[rgba(201,162,39,0.15)] border-[var(--gold-500)]',
          'text-[var(--gold-400)]',
        ].join(' '),
        /** Muted — secondary labels, categories */
        secondary: [
          'bg-[rgba(100,130,165,0.15)] border-[rgba(100,130,165,0.4)]',
          'text-[var(--text-muted)]',
        ].join(' '),
        /** Red — destructive, ineligible, overdue */
        destructive: [
          'bg-[rgba(224,90,90,0.15)] border-[var(--status-error)]',
          'text-[var(--status-error)]',
        ].join(' '),
        /** Success — eligible, completed, healthy */
        success: [
          'bg-[rgba(76,175,130,0.15)] border-[var(--status-success)]',
          'text-[var(--status-success)]',
        ].join(' '),
        /** Warning — cooldown, care needed */
        warning: [
          'bg-[rgba(212,168,67,0.15)] border-[var(--status-warning)]',
          'text-[var(--status-warning)]',
        ].join(' '),
        /** Electric blue — primary type, discipline */
        primary: [
          'bg-[rgba(58,111,221,0.15)] border-[var(--electric-blue-500)]',
          'text-[var(--electric-blue-300)]',
        ].join(' '),
        outline: ['bg-transparent border-[rgba(100,130,165,0.4)]', 'text-[var(--cream)]'].join(' '),
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
