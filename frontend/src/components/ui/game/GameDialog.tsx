/**
 * GameDialog — Cinematic overlay dialog (Story 22-6 / Equoria-o5hub.13)
 *
 * Canonical dialog primitive per DECISIONS.md §8. Owns all visual styling for
 * dialogs; the native Dialog primitive (components/ui/dialog.tsx, Equoria-rkgq9.1)
 * supplies focus trap, Escape close, scroll-lock, and focus restoration — do not
 * re-implement those here.
 *
 * Visual: black/60 backdrop with single backdrop-blur-sm (DECISIONS §4),
 * glass-panel-heavy content with --radius-xl (DECISIONS §3/4), Cinzel title in
 * --gold-400, animated entrance (scale + fade). Close button with gold focus ring.
 *
 * Size variants mirror BaseModal's size table (DECISIONS §8 parity):
 *   sm   → max-w-md  (448px)   — narrow confirmations
 *   md   → max-w-2xl (672px)   — standard content
 *   lg   → max-w-4xl (896px)   — wide content
 *   xl   → max-w-6xl (1152px)  — data-rich
 *   full → max-w-[95vw]        — near-viewport
 * Default: max-w-lg (512px) — preserves existing consumers (InventoryPage, HorseEquipPage).
 */
import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  type DialogContentProps,
} from '@/components/ui/dialog';

/** Size variants available on GameDialogContent. Mirrors BaseModal's ModalSize. */
export type GameDialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/** Map GameDialogSize to Tailwind max-width class */
const sizeClass: Record<GameDialogSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-[95vw]',
};

const GameDialog = Dialog;
const GameDialogTrigger = DialogTrigger;
const GameDialogPortal = DialogPortal;
const GameDialogClose = DialogClose;

/**
 * GameDialogOverlay — backdrop with single blur layer (DECISIONS §4 single-blur rule).
 * Only this overlay should carry backdrop-blur; nested surfaces must not add blur.
 */
const GameDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogOverlay>,
  React.ComponentPropsWithoutRef<typeof DialogOverlay>
>(({ className, ...props }, ref) => (
  <DialogOverlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
GameDialogOverlay.displayName = 'GameDialogOverlay';

export interface GameDialogContentProps extends DialogContentProps {
  /**
   * Panel width variant. Defaults to `undefined` (max-w-lg) to preserve existing
   * InventoryPage / HorseEquipPage consumers unchanged.
   * See size table in file header for pixel widths.
   */
  size?: GameDialogSize;

  /**
   * Omit the built-in X close button (BaseModal showCloseButton={false} parity).
   * For dialogs that render their own close affordance (e.g. celebration
   * dialogs with a styled close button) or auto-dismiss. The dialog must still
   * be closable somehow — Escape/overlay remain unless the consumer prevents
   * them, and consumers providing their own close button keep it.
   */
  hideCloseButton?: boolean;

  /**
   * Set when this dialog intentionally renders NO GameDialogDescription.
   * Passes Radix's documented opt-out (`aria-describedby={undefined}`) so the
   * dev-console "Missing `Description`" warning is suppressed cleanly.
   * Default false — dialogs WITH a description are wired up by Radix exactly
   * as before (no prop is emitted, so existing consumers are unchanged).
   * Do NOT set this on a dialog that does render a description.
   */
  noDescription?: boolean;
}

/**
 * GameDialogContent — panel wrapper.
 *
 * Radius: rounded-[var(--radius-xl)] per DECISIONS §3/§4 (overlay surface → --radius-xl / 24px).
 * The .glass-panel-heavy utility sets border-radius: var(--radius-lg) in its base rule;
 * we override with rounded-[var(--radius-xl)] on the content element to match DECISIONS §4.
 * Visual delta vs. old: corners grow from 16px to 24px.
 *
 * Focus trap, Escape close, body scroll-lock, and focus restoration come from the
 * native Dialog primitive — this component must NOT re-implement them.
 */
const GameDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  GameDialogContentProps
>(
  (
    { className, children, size, hideCloseButton = false, noDescription = false, ...props },
    ref
  ) => (
    <GameDialogPortal>
      <GameDialogOverlay />
      <DialogContent
        ref={ref}
        className={cn(
          'fixed left-[50%] top-[50%] z-[var(--z-modal)] w-full',
          size ? sizeClass[size] : 'max-w-lg',
          'translate-x-[-50%] translate-y-[-50%]',
          // glass-panel-heavy sets radius-lg; override with radius-xl per DECISIONS §3/§4
          'glass-panel-heavy rounded-[var(--radius-xl)] p-6',
          'duration-200',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
          'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          className
        )}
        {...props}
        // Description-less opt-out: an EXPLICIT (even undefined) aria-describedby
        // key suppresses the native primitive's missing-Description dev warning
        // and skips its auto-wiring (parity with the prior Radix behaviour). The
        // key is emitted ONLY when noDescription is set, so dialogs WITH a
        // description keep the auto aria-describedby wiring untouched.
        {...(noDescription ? { 'aria-describedby': undefined } : {})}
      >
        {children}
        {!hideCloseButton && (
          <DialogClose
            className={cn(
              'absolute right-4 top-4 rounded-full p-1',
              'text-[var(--text-muted)] hover:text-[var(--cream)]',
              'hover:bg-[var(--dialog-close-hover-bg)] transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-[var(--gold-bright)]',
              'disabled:pointer-events-none'
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        )}
      </DialogContent>
    </GameDialogPortal>
  )
);
GameDialogContent.displayName = 'GameDialogContent';

/**
 * GameDialogBody — scrollable middle region for long content.
 *
 * Wraps children in an overflow-y-auto container with max-height so long content
 * scrolls inside the panel rather than pushing the panel off-screen.
 * Use between GameDialogHeader and GameDialogFooter.
 */
const GameDialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('overflow-y-auto max-h-[60vh] py-2', className)} {...props} />
);
GameDialogBody.displayName = 'GameDialogBody';

const GameDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <DialogHeader
    className={cn(
      'flex flex-col space-y-1.5 pb-4 border-b border-[var(--dialog-header-border)]',
      className
    )}
    {...props}
  />
);
GameDialogHeader.displayName = 'GameDialogHeader';

const GameDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <DialogFooter
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t border-[var(--dialog-footer-border)]',
      className
    )}
    {...props}
  />
);
GameDialogFooter.displayName = 'GameDialogFooter';

const GameDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogTitle>,
  React.ComponentPropsWithoutRef<typeof DialogTitle>
>(({ className, ...props }, ref) => (
  <DialogTitle
    ref={ref}
    className={cn(
      'text-xl font-semibold tracking-wide',
      'font-[var(--font-heading)] text-[var(--gold-400)]',
      className
    )}
    {...props}
  />
));
GameDialogTitle.displayName = 'GameDialogTitle';

const GameDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogDescription>,
  React.ComponentPropsWithoutRef<typeof DialogDescription>
>(({ className, ...props }, ref) => (
  <DialogDescription
    ref={ref}
    className={cn('text-sm text-[var(--text-muted)]', className)}
    {...props}
  />
));
GameDialogDescription.displayName = 'GameDialogDescription';

export {
  GameDialog,
  GameDialogPortal,
  GameDialogOverlay,
  GameDialogClose,
  GameDialogTrigger,
  GameDialogContent,
  GameDialogBody,
  GameDialogHeader,
  GameDialogFooter,
  GameDialogTitle,
  GameDialogDescription,
};
