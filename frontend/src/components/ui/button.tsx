/**
 * Button component — Celestial Night hierarchy (Task 22-5)
 *
 * Variant tiers:
 *   default   → Gold gradient (primary CTAs: "Enter Competition", "Breed", "Save")
 *   secondary → Frosted glass (supporting actions: "View Details", "Cancel")
 *   outline   → Navy outline (tertiary: "Back", "Dismiss")
 *   ghost     → Text only, underline on hover (inline links, icon buttons)
 *   link      → Text link with underline
 *   destructive → Red dark bg (irreversible: "Delete", "Remove")
 *   glass     → Glass panel surface (nav items, contextual overlay buttons)
 *
 * All variants include visible focus ring for keyboard accessibility (WCAG 2.1 AA).
 * Horseshoe arc decorations on `default` via btn-cobalt class pattern.
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base: flex layout, typography, accessibility, disabled state (40% per spec §11)
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-full font-medium transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-[var(--gold-bright)] focus-visible:ring-offset-2',
    'focus-visible:ring-offset-[var(--bg-deep-space)]',
    'disabled:pointer-events-none disabled:opacity-40',
    'font-[var(--font-body)]',
  ].join(' '),
  {
    variants: {
      variant: {
        /** Primary — gold gradient, Cinzel heading font, horseshoe arcs; max ONE per screen */
        default: [
          'btn-cobalt',
          'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)]',
          'text-[var(--bg-deep-space)] font-semibold tracking-wide',
          'font-[var(--font-heading)]',
          'shadow-[0_4px_20px_rgba(201,162,39,0.4)]',
          'hover:brightness-110 hover:shadow-[0_6px_28px_rgba(201,162,39,0.55)]',
          'active:scale-[0.98]',
        ].join(' '),

        /** Secondary — frosted glass; for supporting actions */
        secondary: [
          'glass-panel-subtle',
          'text-[var(--cream)] border border-[rgba(201,162,39,0.3)]',
          'hover:border-[rgba(201,162,39,0.55)] hover:bg-[rgba(10,22,40,0.65)]',
          'active:scale-[0.98]',
        ].join(' '),

        /** Outline — navy outline; for tertiary/back actions */
        outline: [
          'bg-transparent border border-[var(--celestial-navy-100)]',
          'text-[var(--cream)]',
          'hover:border-[var(--gold-400)] hover:text-[var(--gold-400)]',
          'active:scale-[0.98]',
        ].join(' '),

        /** Ghost — text only; for icon buttons, inline list actions */
        ghost: [
          'bg-transparent text-[var(--cream)]',
          'hover:bg-[rgba(201,162,39,0.08)] hover:text-[var(--gold-400)]',
          'underline-offset-4',
        ].join(' '),

        /** Link — underline text link (gold per Celestial Night identity) */
        link: [
          'bg-transparent text-[var(--gold-primary)]',
          'underline underline-offset-4',
          'hover:text-[var(--gold-light)]',
          'rounded-none px-0',
        ].join(' '),

        /** Destructive — red bg; for irreversible actions */
        destructive: [
          'bg-[rgba(224,90,90,0.15)] border border-[var(--status-error)]',
          'text-[var(--status-error)] font-semibold',
          'hover:bg-[rgba(224,90,90,0.25)]',
          'active:scale-[0.98]',
        ].join(' '),

        /** Glass — glass panel surface; for nav items, overlay actions */
        glass: [
          'glass-panel',
          'text-[var(--cream)] border-[rgba(201,162,39,0.2)]',
          'hover:border-[rgba(201,162,39,0.5)]',
          'active:scale-[0.98]',
        ].join(' '),
      },
      size: {
        default: 'h-10 px-5 py-2 text-sm',
        sm: 'h-8 px-3 py-1 text-xs',
        lg: 'h-12 px-8 py-3 text-base',
        xl: 'h-14 px-10 py-4 text-lg',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
