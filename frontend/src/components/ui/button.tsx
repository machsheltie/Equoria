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
    'disabled:pointer-events-none disabled:opacity-40 disabled:text-[var(--text-muted)]',
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
          'text-[var(--cream)] border border-[var(--btn-secondary-border)]',
          'hover:border-[var(--btn-secondary-border-hover)] hover:bg-[var(--btn-secondary-bg-hover)]',
          'active:scale-[0.98]',
        ].join(' '),

        /** Outline — navy outline; for tertiary/back actions */
        outline: [
          'bg-transparent border border-[var(--celestial-navy-100)]',
          'text-[var(--cream)]',
          'hover:border-[var(--gold-400)] hover:text-[var(--gold-400)]',
          'active:scale-[0.98]',
        ].join(' '),

        /** Ghost — text only; for icon buttons, inline list actions.
         *  Uses --gold-light (7.1:1) not --gold-primary (4.2:1) per AC contrast requirement. */
        ghost: [
          'bg-transparent text-[var(--gold-light)]',
          'hover:underline underline-offset-4',
          'active:opacity-80',
        ].join(' '),

        /** Link — underline text link.
         *  Uses --gold-light (7.1:1) — --gold-primary (4.2:1) is forbidden for body-size text. */
        link: [
          'bg-transparent text-[var(--gold-light)]',
          'underline underline-offset-4',
          'hover:text-[var(--gold-bright)]',
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
          'text-[var(--cream)] border-[var(--btn-glass-border)]',
          'hover:border-[var(--btn-glass-border-hover)]',
          'active:scale-[0.98]',
        ].join(' '),
      },
      size: {
        // h-11 = 44px minimum touch target (WCAG 2.1 SC 2.5.5)
        default: 'h-11 px-4 py-2 text-sm',
        // h-9 = 36px visual; after:-inset-1 expands hit area to 44px
        sm: 'h-9 px-3 text-xs relative after:absolute after:-inset-1 after:content-[""]',
        lg: 'h-12 px-8 py-3 text-base',
        xl: 'h-14 px-10 py-4 text-lg',
        // h-11 w-11 = 44x44px minimum touch target
        icon: 'h-11 w-11 p-0',
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
