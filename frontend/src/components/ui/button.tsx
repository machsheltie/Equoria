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
 * Pending state (D-07, hardened per handoff §6.3):
 *   `pending` prop: sets disabled + aria-busy="true", renders a Loader2 spinner centred
 *   over invisible children (dimensions preserved). Pending ALWAYS wins over caller
 *   props — passing disabled={false} cannot unlock a pending button (pending props are
 *   spread after caller props).
 *
 *   asChild + pending: the native Slot must receive exactly one child, so the spinner is
 *   not injected. Because the slotted child may be an anchor (which ignores the HTML
 *   `disabled` attribute), pending is enforced BEHAVIORALLY: aria-disabled +
 *   aria-busy are set, click and Enter/Space activation are suppressed in the capture
 *   phase (preventDefault before react-router Link handlers can navigate), and the
 *   disabled visual treatment + pointer-events-none are applied. The element stays
 *   focusable (aria-disabled convention) so focus is not lost mid-submit.
 *
 * asChild (Slot) — native implementation (Equoria-rkgq9.8, retire @radix-ui):
 *   Replaces `@radix-ui/react-slot`'s Slot. When asChild, render the single child
 *   element with the button's className/props/handlers/ref merged onto it instead
 *   of a real <button>. Consumers only ever pass a single <Link>/<a> child (no
 *   Slottable, no multi-child) so the native Slot mirrors exactly that contract:
 *   className via cn(child, button) so button styling wins; button props spread
 *   under child props so the child's explicit props win on conflict (Radix parity);
 *   event handlers composed (child's runs first, then button's, defaultPrevented-aware);
 *   refs merged (forwarded ref + child's own ref) via mergeRefs.
 *
 * All variants include visible focus ring for keyboard accessibility (WCAG 2.1 AA).
 * Horseshoe arc decorations on `default` via btn-arcs (compoundVariants:
 * default/lg/xl sizes only — never sm/icon, see Equoria-o5hub.27).
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mergeRefs, composeEventHandlers } from '@/lib/ref-utils';

/* -------------------------------------------------------------------------- */
/* Native Slot — in-house replacement for @radix-ui/react-slot (rkgq9.8).     */
/*                                                                            */
/* Renders the single child element with `slotProps` merged onto it. Merge   */
/* rules (Radix Slot parity for the surface Button consumers actually use):  */
/*   - className: cn(child.className, slot.className) → Tailwind last-wins so */
/*     the button's variant classes override the child's.                    */
/*   - props: child's own props win over slotProps on conflict (slotProps    */
/*     spread first, child props spread second), EXCEPT className/style/      */
/*     handlers/ref which are merged below.                                  */
/*   - style: shallow-merged ({ ...slot, ...child }).                        */
/*   - event handlers (on*): composed — child's runs first, then the slot's, */
/*     skipping the slot's if the child called preventDefault.               */
/*   - ref: forwarded ref + child's own ref fanned out via mergeRefs.        */
/* Slottable is intentionally NOT implemented: no Button consumer uses it    */
/* (grep confirmed zero `Slottable` usages in frontend/src).                 */
/* -------------------------------------------------------------------------- */
type SlotProps = React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode };

const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, ...slotProps }, forwardedRef) => {
    if (!React.isValidElement(children)) {
      // Radix throws on non-element children; Button always passes one element,
      // so fail loudly in dev rather than silently rendering nothing.
      if (process.env.NODE_ENV !== 'production' && React.Children.count(children) !== 1) {
        console.error('Slot expects a single React element child when used via asChild.');
      }
      return null;
    }

    const child = children as React.ReactElement<Record<string, unknown>> & {
      ref?: React.Ref<unknown>;
    };
    const childProps = child.props as Record<string, unknown>;

    const merged: Record<string, unknown> = { ...slotProps, ...childProps };

    // className: child first, button second → twMerge resolves button as winner.
    merged.className = cn(
      childProps.className as string | undefined,
      (slotProps as { className?: string }).className
    );

    // style: shallow merge, child wins on conflicting keys.
    if ((slotProps as { style?: React.CSSProperties }).style || childProps.style) {
      merged.style = {
        ...((slotProps as { style?: React.CSSProperties }).style ?? {}),
        ...((childProps.style as React.CSSProperties) ?? {}),
      };
    }

    // Compose every event handler present on either side (child runs first).
    for (const key of Object.keys(slotProps)) {
      if (/^on[A-Z]/.test(key)) {
        const slotHandler = (slotProps as Record<string, unknown>)[key];
        const childHandler = childProps[key];
        if (typeof slotHandler === 'function' || typeof childHandler === 'function') {
          merged[key] = composeEventHandlers(
            childHandler as ((e: { defaultPrevented?: boolean }) => void) | undefined,
            slotHandler as ((e: { defaultPrevented?: boolean }) => void) | undefined
          );
        }
      }
    }

    merged.ref = mergeRefs(
      forwardedRef as React.Ref<unknown>,
      child.ref as React.Ref<unknown> | undefined
    );

    return React.cloneElement(child, merged);
  }
);
Slot.displayName = 'Slot';

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
        /** Primary — gold gradient, Cinzel heading font. Horseshoe arc
         *  decorations (btn-arcs) are added per-size via compoundVariants:
         *  only default/lg/xl sizes get arcs. sm's 44px hit-area expander
         *  owns ::after (after:-inset-1), and arcs also style ::after — on
         *  sm the collision floats a gold circle above the button
         *  (Equoria-o5hub.27); icon is too small for arcs. */
        default: [
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
      // Horseshoe arcs (Equoria-o5hub.27): opt-in per size. NEVER on sm
      // (its after:-inset-1 hit-area owns ::after) or icon (too small).
      {
        variant: 'default',
        size: 'default',
        class: 'btn-arcs',
      },
      {
        variant: 'default',
        size: 'lg',
        class: 'btn-arcs',
      },
      {
        variant: 'default',
        size: 'xl',
        class: 'btn-arcs',
      },
    ],
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * pending — loading/submitting state (D-07, hardened per handoff §6.3).
   * When true: sets disabled + aria-busy="true" and renders a centred Loader2
   * spinner while keeping children in the DOM (invisible) so button dimensions
   * are preserved. Pending always wins: caller-supplied disabled={false} cannot
   * override the pending lock.
   *
   * asChild behavior: the native Slot must receive exactly one child
   * element, so the spinner is NOT injected. Pending is enforced behaviorally
   * instead — aria-disabled + aria-busy, capture-phase click/keyboard
   * suppression (an anchor child cannot navigate while pending), and the
   * disabled visual treatment.
   */
  pending?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, pill, asChild = false, pending = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    // When asChild, the native Slot must get exactly one child — skip spinner injection.
    // The child may be an anchor (ignores `disabled`), so enforce pending
    // behaviorally: capture-phase suppression runs before react-router Link
    // onClick (which checks defaultPrevented) and before any child handler.
    if (asChild) {
      const pendingGuards = pending
        ? {
            'aria-disabled': true,
            'aria-busy': true,
            'data-pending': '',
            onClickCapture: (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
            },
            onKeyDownCapture: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
              }
            },
          }
        : {};
      return (
        <Comp
          className={cn(
            buttonVariants({ variant, size, pill, className }),
            // Mirror the disabled: treatment — anchors never match disabled:*
            pending && 'pointer-events-none opacity-40 text-[var(--text-muted)]'
          )}
          ref={ref}
          {...props}
          {...pendingGuards}
        />
      );
    }

    // Pending semantics spread AFTER caller props so pending always wins —
    // a caller passing disabled={false} must not unlock a pending button.
    const pendingProps = pending
      ? { disabled: true, 'aria-busy': 'true' as const, 'data-pending': '' }
      : {};

    return (
      <button
        className={cn(buttonVariants({ variant, size, pill, className }))}
        ref={ref}
        {...props}
        {...pendingProps}
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
