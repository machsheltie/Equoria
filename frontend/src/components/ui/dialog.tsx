/**
 * Dialog — native modal primitive (Equoria-rkgq9.1, retire @radix-ui).
 *
 * In-house replacement for `@radix-ui/react-dialog`. Visual styling lives in
 * game/GameDialog.tsx (Story 22-6); this file owns behaviour only and keeps a
 * Radix-parity public API so every consumer + the o5hub.34 dialog tests stay
 * green without edits.
 *
 * Parity surface intentionally reproduced (the things consumers/tests depend on):
 *   - Root: controlled (`open`/`onOpenChange`) + uncontrolled (`defaultOpen`),
 *     `modal` (default true).
 *   - Trigger / Close: `asChild` (native Slot via lib/ref-utils mergeRefs +
 *     composeEventHandlers — same merge contract as button.tsx).
 *   - Portal to document.body.
 *   - Overlay: `data-state="open|closed"`, click-to-close (modal).
 *   - Content: `role="dialog"` `aria-modal`, focus trap (Tab/Shift+Tab cycle),
 *     focus-into on open + focus-restore to the opener on close, Escape close,
 *     `data-state`, and the Radix-compatible callbacks
 *     `onEscapeKeyDown` / `onInteractOutside` / `onPointerDownOutside` /
 *     `onOpenAutoFocus` / `onCloseAutoFocus` (each cancelable via
 *     `event.preventDefault()`).
 *   - Title/Description: auto-generated ids wired to `aria-labelledby` /
 *     `aria-describedby`; a dev-only "Missing `Description`" warning when a
 *     Content renders no Description and does not opt out via
 *     `aria-describedby={undefined}` (GameDialog's `noDescription` passes that).
 *   - Body scroll lock while any dialog is open (reference-counted for nesting).
 *
 * Focus-management / scroll-lock / portal approach mirrors the existing native
 * BaseModal pattern (.claude/rules/PATTERN_LIBRARY.md → Modal Patterns).
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import { mergeRefs, composeEventHandlers } from '@/lib/ref-utils';
import {
  pushModal,
  popModal,
  isTopmostModal,
  lockBodyScroll,
  usePresence,
  getFocusable,
  mergeSlotProps,
  type AnyProps,
} from './dialogPresence';

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

interface DialogContextValue {
  open: boolean;
  /** Request a state change; routed through onOpenChange + uncontrolled state. */
  setOpen: (next: boolean) => void;
  modal: boolean;
  /**
   * Presence/animation state for the portal subtree (Equoria-mased exit-animation).
   * - `present` is true while the dialog is open AND for one close-animation frame
   *   afterwards (so `data-[state=closed]:animate-out` can play before unmount).
   * - `state` is the value that should drive `data-state` on the overlay/content:
   *   `'open'` while open, `'closed'` during the exit-animation window.
   * - `registerExitNode` lets the animated content node register itself so the
   *   presence layer can listen for its `animationend` and unmount afterwards.
   */
  present: boolean;
  state: 'open' | 'closed';
  registerExitNode: (node: HTMLElement | null) => void;
  /** id used for aria-labelledby — set by the rendered DialogTitle. */
  titleId: string | undefined;
  setTitleId: (id: string | undefined) => void;
  /** id used for aria-describedby — set by the rendered DialogDescription. */
  descriptionId: string | undefined;
  setDescriptionId: (id: string | undefined) => void;
  /** Element to restore focus to when the dialog closes (the trigger). */
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  /** Stable id for the content node (for trigger aria-controls parity). */
  contentId: string;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(component: string): DialogContextValue {
  const ctx = React.useContext(DialogContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used within a <Dialog>.`);
  }
  return ctx;
}

/* -------------------------------------------------------------------------- */
/* Root                                                                       */
/* -------------------------------------------------------------------------- */

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When true (default), pressing outside / Escape closes; overlay is modal. */
  modal?: boolean;
  children?: React.ReactNode;
}

let dialogIdCounter = 0;
function useDialogId(prefix: string): string {
  const reactId = React.useId?.();
  const fallback = React.useRef<string | undefined>(undefined);
  if (reactId) return `${prefix}-${reactId.replace(/[:]/g, '')}`;
  if (!fallback.current) {
    dialogIdCounter += 1;
    fallback.current = `${prefix}-${dialogIdCounter}`;
  }
  return fallback.current;
}

const Dialog = ({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  modal = true,
  children,
}: DialogProps) => {
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = isControlled ? (openProp as boolean) : uncontrolledOpen;

  const [titleId, setTitleId] = React.useState<string | undefined>(undefined);
  const [descriptionId, setDescriptionId] = React.useState<string | undefined>(undefined);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentId = useDialogId('dialog-content');

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  // Presence keeps the portal subtree mounted for one close-animation frame
  // (Equoria-mased). `state`/`present`/`registerExitNode` flow down via context.
  const { present, state, registerExitNode } = usePresence(open);

  const value = React.useMemo<DialogContextValue>(
    () => ({
      open,
      setOpen,
      modal,
      titleId,
      setTitleId,
      descriptionId,
      setDescriptionId,
      triggerRef,
      contentId,
      present,
      state,
      registerExitNode,
    }),
    [open, setOpen, modal, titleId, descriptionId, contentId, present, state, registerExitNode]
  );

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
};

/* -------------------------------------------------------------------------- */
/* Trigger                                                                    */
/* -------------------------------------------------------------------------- */

export interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ asChild = false, onClick, children, ...props }, ref) => {
    const ctx = useDialogContext('DialogTrigger');

    const handleClick = composeEventHandlers(
      onClick as ((e: { defaultPrevented?: boolean }) => void) | undefined,
      () => ctx.setOpen(!ctx.open)
    );

    const stateProps = {
      type: 'button' as const,
      'aria-haspopup': 'dialog' as const,
      'aria-expanded': ctx.open,
      'aria-controls': ctx.open ? ctx.contentId : undefined,
      'data-state': ctx.open ? 'open' : 'closed',
      onClick: handleClick,
    };

    // The trigger is also the focus-restore target on close.
    const captureRef = (node: HTMLElement | null) => {
      ctx.triggerRef.current = node;
    };

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<AnyProps> & { ref?: React.Ref<unknown> };
      const merged = mergeSlotProps(
        { ...props, ...stateProps },
        mergeRefs(ref as React.Ref<unknown>, captureRef),
        child
      );
      // For a slotted element we cannot force type="button" onto arbitrary tags.
      delete merged.type;
      return React.cloneElement(child, merged);
    }

    return (
      <button ref={mergeRefs(ref, captureRef)} {...props} {...stateProps}>
        {children}
      </button>
    );
  }
);
DialogTrigger.displayName = 'DialogTrigger';

/* -------------------------------------------------------------------------- */
/* Close                                                                      */
/* -------------------------------------------------------------------------- */

export interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DialogClose = React.forwardRef<HTMLButtonElement, DialogCloseProps>(
  ({ asChild = false, onClick, children, ...props }, ref) => {
    const ctx = useDialogContext('DialogClose');

    const handleClick = composeEventHandlers(
      onClick as ((e: { defaultPrevented?: boolean }) => void) | undefined,
      () => ctx.setOpen(false)
    );

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<AnyProps> & { ref?: React.Ref<unknown> };
      const merged = mergeSlotProps(
        { ...props, onClick: handleClick },
        ref as React.Ref<unknown>,
        child
      );
      return React.cloneElement(child, merged);
    }

    return (
      <button type="button" ref={ref} {...props} onClick={handleClick}>
        {children}
      </button>
    );
  }
);
DialogClose.displayName = 'DialogClose';

/* -------------------------------------------------------------------------- */
/* Portal                                                                     */
/* -------------------------------------------------------------------------- */

export interface DialogPortalProps {
  children?: React.ReactNode;
  /** Optional explicit container (Radix parity); defaults to document.body. */
  container?: HTMLElement | null;
}

const DialogPortal = ({ children, container }: DialogPortalProps) => {
  const ctx = useDialogContext('DialogPortal');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Gate on `present` (open OR mid-exit-animation), not `open` — Equoria-mased.
  // Keeping the subtree mounted for the close-animation frame is what lets the
  // overlay/content `data-[state=closed]:animate-out` classes actually play.
  if (!ctx.present || !mounted) return null;
  const target = container ?? (typeof document !== 'undefined' ? document.body : null);
  if (!target) return null;
  return createPortal(children, target);
};
DialogPortal.displayName = 'DialogPortal';

/* -------------------------------------------------------------------------- */
/* Overlay                                                                    */
/* -------------------------------------------------------------------------- */

export type DialogOverlayProps = React.HTMLAttributes<HTMLDivElement>;

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogOverlayProps>(
  ({ className, ...props }, ref) => {
    const ctx = useDialogContext('DialogOverlay');
    // `ctx.state` is 'open' while open and 'closed' during the exit-animation
    // window — driving the fade-out class on close (Equoria-mased).
    return <div ref={ref} data-state={ctx.state} className={className} {...props} />;
  }
);
DialogOverlay.displayName = 'DialogOverlay';

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Radix-compatible synthetic events for the Content lifecycle callbacks. Each
 * is cancelable via preventDefault() — consumers (DeleteAccountModal,
 * BreedingConfirmationModal, etc.) call preventDefault() to block close/focus.
 */
interface CancelableEvent {
  preventDefault: () => void;
  defaultPrevented: boolean;
}

function makeCancelableEvent(detail?: Record<string, unknown>): CancelableEvent {
  const evt: CancelableEvent = {
    defaultPrevented: false,
    preventDefault() {
      evt.defaultPrevented = true;
    },
    ...detail,
  };
  return evt;
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Fired when focus is moved into the content on open; preventDefault to take over. */
  onOpenAutoFocus?: (event: CancelableEvent) => void;
  /** Fired when focus is about to restore on close; preventDefault to take over. */
  onCloseAutoFocus?: (event: CancelableEvent) => void;
  /** Fired on Escape; preventDefault to keep the dialog open. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** Fired on pointerdown outside the content; preventDefault to keep open. */
  onPointerDownOutside?: (event: CancelableEvent) => void;
  /** Fired on any outside interaction (pointer/focus); preventDefault to keep open. */
  onInteractOutside?: (event: CancelableEvent) => void;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  (allProps, forwardedRef) => {
    const {
      className,
      children,
      onOpenAutoFocus,
      onCloseAutoFocus,
      onEscapeKeyDown,
      onPointerDownOutside,
      onInteractOutside,
      'aria-describedby': ariaDescribedbyProp,
      'aria-labelledby': ariaLabelledbyProp,
      ...props
    } = allProps;
    const ctx = useDialogContext('DialogContent');
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    // Stable identity for this content's slot on the open-modal stack
    // (Equoria-mased topmost-only dismissal).
    const modalToken = React.useRef<symbol>(Symbol('dialog-modal')).current;

    // Caller passed `aria-describedby` EXPLICITLY (even as `undefined`) → opt out
    // of the auto-wiring + the missing-Description dev warning (parity with Radix
    // and with GameDialog's `noDescription`). The key-presence check on the raw
    // props object is the only reliable signal: an explicit `undefined` value is
    // indistinguishable from an absent key once destructured.
    const describedByExplicit = Object.prototype.hasOwnProperty.call(allProps, 'aria-describedby');

    // Body scroll lock + focus management for the lifetime of the open content.
    React.useEffect(() => {
      if (!ctx.open) return;

      const node = contentRef.current;
      const releaseScroll = lockBodyScroll();
      const opener = ctx.triggerRef.current ?? (document.activeElement as HTMLElement | null);

      // Move focus into the dialog (unless a consumer takes it over).
      const autoFocusEvent = makeCancelableEvent();
      onOpenAutoFocus?.(autoFocusEvent);
      if (!autoFocusEvent.defaultPrevented && node) {
        const focusables = getFocusable(node);
        (focusables[0] ?? node).focus();
      }

      return () => {
        releaseScroll();
        // Restore focus to the opener unless the consumer takes it over.
        const closeFocusEvent = makeCancelableEvent();
        onCloseAutoFocus?.(closeFocusEvent);
        if (!closeFocusEvent.defaultPrevented && opener && typeof opener.focus === 'function') {
          opener.focus();
        }
      };
      // We intentionally run this once per open/close transition.
    }, [ctx.open]);

    // Open-modal stack registration (Equoria-mased): a modal content occupies the
    // top of the stack while open so only it reacts to Escape / outside-dismiss.
    React.useEffect(() => {
      if (!ctx.open || !ctx.modal) return;
      pushModal(modalToken);
      return () => popModal(modalToken);
    }, [ctx.open, ctx.modal, modalToken]);

    // Keydown: Escape close + Tab focus-trap cycling.
    React.useEffect(() => {
      if (!ctx.open) return;
      const node = contentRef.current;

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          // Only the topmost open modal handles Escape — a single press closes
          // ONE level, enabling nested focus restoration (Equoria-mased). A
          // non-modal dialog never sits on the stack, so it keeps its prior
          // behaviour of always offering the cancel hook below.
          if (ctx.modal && !isTopmostModal(modalToken)) return;
          onEscapeKeyDown?.(event);
          if (!event.defaultPrevented && ctx.modal) {
            event.preventDefault();
            ctx.setOpen(false);
          }
          return;
        }
        if (event.key === 'Tab' && node) {
          const focusables = getFocusable(node);
          if (focusables.length === 0) {
            // Nothing focusable inside — keep focus on the container.
            event.preventDefault();
            node.focus();
            return;
          }
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const active = document.activeElement as HTMLElement | null;
          if (event.shiftKey) {
            if (active === first || active === node || !node.contains(active)) {
              event.preventDefault();
              last.focus();
            }
          } else if (active === last) {
            event.preventDefault();
            first.focus();
          }
        }
      };

      document.addEventListener('keydown', onKeyDown, true);
      return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [ctx.open, ctx.modal, ctx.setOpen, onEscapeKeyDown, modalToken]);

    // Outside-interaction dismissal (DismissableLayer parity). A document-level
    // pointerdown whose target is NOT inside the content panel is an "outside"
    // interaction — clicking the overlay backdrop included. Consumers may cancel
    // via onPointerDownOutside / onInteractOutside (DeleteAccountModal blocks
    // dismissal while a delete is in flight, etc.).
    React.useEffect(() => {
      if (!ctx.open || !ctx.modal) return;
      const node = contentRef.current;

      const onPointerDownDoc = (event: PointerEvent) => {
        // Only the topmost modal dismisses on an outside pointer, mirroring the
        // Escape gating (Equoria-mased) so a backdrop click can't collapse the
        // whole nested stack at once.
        if (!isTopmostModal(modalToken)) return;
        const target = event.target as Node | null;
        if (node && target && node.contains(target)) return; // inside — ignore

        const pointerEvent = makeCancelableEvent({ target });
        onPointerDownOutside?.(pointerEvent);
        const interactEvent = makeCancelableEvent({ target });
        if (!pointerEvent.defaultPrevented) onInteractOutside?.(interactEvent);
        if (!pointerEvent.defaultPrevented && !interactEvent.defaultPrevented) {
          ctx.setOpen(false);
        }
      };

      document.addEventListener('pointerdown', onPointerDownDoc, true);
      return () => document.removeEventListener('pointerdown', onPointerDownDoc, true);
    }, [ctx.open, ctx.modal, ctx.setOpen, onPointerDownOutside, onInteractOutside, modalToken]);

    // Dev-only parity warning: a Content with no Description and no explicit
    // opt-out should warn (the o5hub.34 sentinel-positive test relies on this).
    React.useEffect(() => {
      if (!ctx.open) return;
      if (process.env.NODE_ENV === 'production') return;
      if (!ctx.descriptionId && !describedByExplicit) {
        console.warn(
          'Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}.'
        );
      }
      // descriptionId becomes defined once a DialogDescription mounts.
    }, [ctx.open, ctx.descriptionId, describedByExplicit]);

    // Render while `present` (open OR mid-exit-animation), not only while open —
    // Equoria-mased. During the exit window `ctx.state` is 'closed', so the
    // `data-[state=closed]:animate-out` classes play before the presence layer
    // unmounts the node on `animationend`.
    if (!ctx.present) return null;

    const describedBy = describedByExplicit ? ariaDescribedbyProp : ctx.descriptionId;
    const labelledBy = ariaLabelledbyProp ?? ctx.titleId;

    return (
      <div
        ref={mergeRefs(forwardedRef, contentRef, ctx.registerExitNode)}
        role="dialog"
        aria-modal={ctx.modal ? true : undefined}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        id={ctx.contentId}
        tabIndex={-1}
        data-state={ctx.state}
        className={className}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DialogContent.displayName = 'DialogContent';

/* -------------------------------------------------------------------------- */
/* Header / Footer (layout-only divs, parity with the old shim)               */
/* -------------------------------------------------------------------------- */

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={className} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={className} {...props} />
);
DialogFooter.displayName = 'DialogFooter';

/* -------------------------------------------------------------------------- */
/* Title / Description — register their ids for aria wiring                    */
/* -------------------------------------------------------------------------- */

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, id: idProp, ...props }, ref) => {
    const ctx = useDialogContext('DialogTitle');
    const generatedId = useDialogId('dialog-title');
    const id = idProp ?? generatedId;
    React.useEffect(() => {
      ctx.setTitleId(id);
      return () => ctx.setTitleId(undefined);
    }, [ctx, id]);
    return <h2 ref={ref} id={id} className={className} {...props} />;
  }
);
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, id: idProp, ...props }, ref) => {
  const ctx = useDialogContext('DialogDescription');
  const generatedId = useDialogId('dialog-description');
  const id = idProp ?? generatedId;
  React.useEffect(() => {
    ctx.setDescriptionId(id);
    return () => ctx.setDescriptionId(undefined);
  }, [ctx, id]);
  return <p ref={ref} id={id} className={className} {...props} />;
});
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
