/**
 * GameDialog — Cinematic overlay dialog (Story 22-6)
 *
 * Owns all visual styling for dialogs. Naked dialog.tsx is the Radix forwarder.
 * Visual: black/60 backdrop, glass-panel-heavy content, Cinzel title in --gold-400,
 * animated entrance (scale + fade). Close button with gold focus ring.
 */
import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';

const GameDialog = Dialog;
const GameDialogTrigger = DialogTrigger;
const GameDialogPortal = DialogPortal;
const GameDialogClose = DialogClose;

const GameDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
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

const GameDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <GameDialogPortal>
    <GameDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-[var(--z-modal)] w-full max-w-lg',
        'translate-x-[-50%] translate-y-[-50%]',
        'glass-panel-heavy p-6',
        'duration-200',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
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
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </GameDialogPortal>
));
GameDialogContent.displayName = 'GameDialogContent';

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
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
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
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
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
  GameDialogHeader,
  GameDialogFooter,
  GameDialogTitle,
  GameDialogDescription,
};
