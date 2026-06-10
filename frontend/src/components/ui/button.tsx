/**
 * Button component — Celestial Night hierarchy
 *
 * Shape rule (DECISIONS.md §3/§5):
 *   Base shape is rounded-[var(--radius-button)] = --radius-md = 12px (rounded rectangle).
 *   Pill shape opts in via the `pill` prop → rounded-[var(--radius-pill)] = 9999px.
 *   The `link` variant retains rounded-none + px-0 at all times (compoundVariant
 *   enforces rounded-none when pill=true; twMerge resolves to rounded-none as winner).
 *
 * Variant tiers:
 *   default     → Gold gradient (primary CTAs: "Enter Competition", "Breed", "Save")
 *   secondary   → Frosted glass (supporting actions: "View Details", "Cancel")
 *   outline     → Navy outline (tertiary: "Back", "Dismiss")
 *   ghost       → Text only, underline on hover (inline links, icon buttons)
 *   link        → Text link with underline
 *   destructive → Red dark bg (irreversible: "Delete", "Remove")
 *   glass       → Glass panel surface (nav items, contextual overlay buttons)
 *
 * Pending state (D-07):
 *   `pending` prop: sets disabled + aria-busy="true", renders a Loader2 spinner centred
 *   over invisible children (dimensions preserved). When `asChild` is true and `pending`
 *   is set, the spinner injection is skipped (Radix Slot must receive exactly one child);
 *   disabled + aria-busy are still forwarded via spread props.
 *
 * All variants include visible focus ring for keyboard accessibility (WCAG 2.1 AA).
 * Horseshoe arc decorations on `default` via btn-cobalt class pattern.
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base: flex layout, typography, accessibility, disabled state (40% per spec §11)
  // Shape: --radius-button = --radius-md = 12px (DECISIONS.md §3/§5; was rounded-full)
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-[var(--radius-button)] font-medium transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-[var(--gold-bright)] focus-visible:ring-offset-2',
    'focus-visible:ring-offset-[var(--bg-deep-space)]',
    'disabled:pointer-events-none disabled:opacity-40 disabled:text-[var(--text-muted)]',
    'font-[var(--font-body)]',
  ].join(' '),
  {
    variants: {
      variant: {
        /** Primary — gold gradient, Cinzel heading font; horseshoe arc decorations via btn-cobalt */
        default: [
          'btn-cobalt',
          'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)]',
          'text-[var(--bg-deep-space)] font-semibold tracking-wide',
          'font-[var(--font-heading)]',
          'shadow-[var(--btn-default-shadow)]',
          'hover:brightness-110 hover:shadow-[var(--btn-default-shadow-hover)]',
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
         *  Uses --gold-light (7.1:1) — --gold-primary (4.2:1) is forbidden for body-size text.
         *  Retains rounded-none px-0 regardless of pill prop (twMerge last-wins). */
        link: [
          'bg-transparent text-[var(--gold-light)]',
          'underline underline-offset-4',
          'hover:text-[var(--gold-bright)]',
          'rounded-none px-0',
        ].join(' '),

        /** Destructive — red bg; for irreversible actions */
        destructive: [
          'bg-[var(--btn-destructive-bg)] border border-[var(--status-error)]',
          'text-[var(--status-error)] font-semibold',
          'hover:bg-[var(--btn-destructive-bg-hover)]',
          'active:scale-[0.98]',
        ].join(' '),

        /** Glass — glass panel surface; for nav items, overlay actions */
        glass: [
          'glass-panel',
          'text-[var(--cream)] border-[var(--btn-glass-border)]',
          'hover:border-[var(--btn-glass-border-hover)]',
          // No transform suppression needed — .glass-panel no longer has a global hover lift.
          // The lift lives on .glass-panel-interactive only (D-05, DECISIONS.md §4).
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
      /**
       * pill — opt-in pill shape (DECISIONS.md §3/§5).
       * Use for compact filter chips, segmented options, toggles where a
       * true pill is semantically correct. NOT the default button shape.
       * Note: the `link` variant's rounded-none is enforced via a compoundVariant
       * (link + pill = rounded-none) which CVA appends last so twMerge resolves
       * correctly — see compoundVariants below.
       */
      pill: {
        true: 'rounded-[var(--radius-pill)]',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      pill: false,
    },
    /**
     * compoundVariants — enforce link+pill override.
     * CVA appends compoundVariants AFTER individual variants, so twMerge
     * resolves `rounded-none` as the winner over both the base
     * rounded-[var(--radius-button)] and the pill rounded-[var(--radius-pill)].
     */
    compoundVariants: [
      {
        variant: 'link',
        pill: true,
        class: 'rounded-none',
      },
    ],
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * pending — loading/submitting state (D-07).
   * When true: sets disabled + aria-busy="true" and renders a centred Loader2
   * spinner while keeping children in the DOM (invisible) so button dimensions
   * are preserved.
   *
   * asChild limitation: when asChild is true the Slot primitive must receive
   * exactly one child element. In that mode the spinner is NOT injected;
   * disabled + aria-busy are still forwarded via props so assistive technology
   * still announces the pending state.
   */
  pending?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, pill, asChild = false, pending = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    // Merge pending semantics into props
    const pendingProps = pending ? { disabled: true, 'aria-busy': 'true' as const } : {};

    // When asChild, Slot must get exactly one child — skip spinner injection
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, pill, className }))}
          ref={ref}
          {...pendingProps}
          {...props}
        />
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, pill, className }))}
        ref={ref}
        {...pendingProps}
        {...props}
      >
        {pending ? (
          // Preserve dimensions: children stay in DOM but invisible;
          // spinner is absolutely centred so layout is unchanged.
          <span className="relative inline-flex items-center justify-center">
            <span className="invisible">{props.children}</span>
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            </span>
          </span>
        ) : (
          props.children
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
