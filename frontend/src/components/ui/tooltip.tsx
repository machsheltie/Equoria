/**
 * Tooltip — Native hover/focus tooltip (Equoria-rkgq9.3)
 *
 * Replaces the former @radix-ui/react-tooltip forwarder with an in-house,
 * dependency-free implementation. The public API is preserved 1:1 so existing
 * consumers (GameTooltip, IconButton) and tests are untouched:
 *
 *   - TooltipProvider — context provider that supplies a default `delayDuration`
 *   - Tooltip          — Root; owns open/close state for one trigger+content pair
 *   - TooltipTrigger   — the hoverable/focusable element (supports `asChild`)
 *   - TooltipContent   — the popup, `role="tooltip"`, aria-wired to the trigger
 *
 * Behaviour (a11y-correct):
 *   - Shows on pointer hover AND keyboard focus.
 *   - Hides on blur, mouseleave, or Escape.
 *   - `aria-describedby` links the trigger to the content; content has
 *     `role="tooltip"`.
 *   - Respects `delayDuration` (from props or the Provider's default) on the
 *     show transition; hide is immediate.
 *   - Positioning is CSS-based (absolutely positioned relative to the trigger),
 *     honouring `side` / `align` / `sideOffset` — no positioning library.
 */
import * as React from 'react';

type Side = 'top' | 'right' | 'bottom' | 'left';
type Align = 'start' | 'center' | 'end';

const DEFAULT_DELAY_DURATION = 700;

/* -------------------------------------------------------------------------- */
/* Provider context                                                           */
/* -------------------------------------------------------------------------- */

interface TooltipProviderContextValue {
  delayDuration: number;
}

const TooltipProviderContext = React.createContext<TooltipProviderContextValue>({
  delayDuration: DEFAULT_DELAY_DURATION,
});

export interface TooltipProviderProps {
  children?: React.ReactNode;
  /** Default open-delay (ms) inherited by descendant Tooltips. */
  delayDuration?: number;
  /** Accepted for Radix API parity (no-op in the native impl). */
  skipDelayDuration?: number;
  /** Accepted for Radix API parity (no-op in the native impl). */
  disableHoverableContent?: boolean;
}

const TooltipProvider = ({
  children,
  delayDuration = DEFAULT_DELAY_DURATION,
}: TooltipProviderProps) => {
  const value = React.useMemo(() => ({ delayDuration }), [delayDuration]);
  return (
    <TooltipProviderContext.Provider value={value}>{children}</TooltipProviderContext.Provider>
  );
};
TooltipProvider.displayName = 'TooltipProvider';

/* -------------------------------------------------------------------------- */
/* Root context                                                               */
/* -------------------------------------------------------------------------- */

interface TooltipContextValue {
  open: boolean;
  contentId: string;
  triggerId: string;
  delayDuration: number;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  show: () => void;
  hide: () => void;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function useTooltipContext(component: string): TooltipContextValue {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) {
    throw new Error(`${component} must be used within a <Tooltip>`);
  }
  return ctx;
}

export interface TooltipProps {
  children?: React.ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Default open state for the uncontrolled case. */
  defaultOpen?: boolean;
  /** Open-change callback. */
  onOpenChange?: (open: boolean) => void;
  /** Open-delay (ms); falls back to the Provider's default. */
  delayDuration?: number;
}

const Tooltip = ({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  delayDuration: delayProp,
}: TooltipProps) => {
  const provider = React.useContext(TooltipProviderContext);
  const delayDuration = delayProp ?? provider.delayDuration;

  const reactId = React.useId();
  const contentId = `tooltip-content-${reactId}`;
  const triggerId = `tooltip-trigger-${reactId}`;

  const triggerRef = React.useRef<HTMLElement | null>(null);
  const showTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = isControlled ? (openProp as boolean) : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const clearShowTimer = React.useCallback(() => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  }, []);

  const show = React.useCallback(() => {
    clearShowTimer();
    if (delayDuration <= 0) {
      setOpen(true);
      return;
    }
    showTimer.current = setTimeout(() => setOpen(true), delayDuration);
  }, [clearShowTimer, delayDuration, setOpen]);

  const hide = React.useCallback(() => {
    clearShowTimer();
    setOpen(false);
  }, [clearShowTimer, setOpen]);

  React.useEffect(() => clearShowTimer, [clearShowTimer]);

  const value = React.useMemo<TooltipContextValue>(
    () => ({ open, contentId, triggerId, delayDuration, triggerRef, show, hide }),
    [open, contentId, triggerId, delayDuration, show, hide]
  );

  // A relatively-positioned inline wrapper so the absolutely-positioned
  // TooltipContent anchors to the trigger area without a positioning library.
  return (
    <TooltipContext.Provider value={value}>
      <span style={{ position: 'relative', display: 'inline-block' }}>{children}</span>
    </TooltipContext.Provider>
  );
};
Tooltip.displayName = 'Tooltip';

/* -------------------------------------------------------------------------- */
/* Trigger                                                                    */
/* -------------------------------------------------------------------------- */

type AnyProps = Record<string, unknown>;

function composeHandlers<E>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void
): (event: E) => void {
  return (event: E) => {
    theirs?.(event);
    if (!(event as unknown as { defaultPrevented?: boolean })?.defaultPrevented) {
      ours(event);
    }
  };
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    }
  };
}

export interface TooltipTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Merge trigger behaviour onto the single child element instead of a <button>. */
  asChild?: boolean;
}

const TooltipTrigger = React.forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  (
    { asChild = false, children, onMouseEnter, onMouseLeave, onFocus, onBlur, onKeyDown, ...props },
    ref
  ) => {
    const ctx = useTooltipContext('TooltipTrigger');

    const handleMouseEnter = composeHandlers(onMouseEnter, () => ctx.show());
    const handleMouseLeave = composeHandlers(onMouseLeave, () => ctx.hide());
    const handleFocus = composeHandlers(onFocus, () => ctx.show());
    const handleBlur = composeHandlers(onBlur, () => ctx.hide());
    const handleKeyDown = composeHandlers<React.KeyboardEvent>(
      onKeyDown as ((e: React.KeyboardEvent) => void) | undefined,
      (event) => {
        if (event.key === 'Escape' && ctx.open) {
          ctx.hide();
        }
      }
    );

    const sharedProps: AnyProps = {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      'aria-describedby': ctx.open ? ctx.contentId : undefined,
      'data-state': ctx.open ? 'open' : 'closed',
    };

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<AnyProps & { ref?: React.Ref<unknown> }>;
      const childProps = child.props;
      const mergedRef = mergeRefs(
        ref,
        ctx.triggerRef as unknown as React.Ref<HTMLButtonElement>,
        (child as { ref?: React.Ref<unknown> }).ref as React.Ref<HTMLButtonElement> | undefined
      );
      return React.cloneElement(child, {
        ...props,
        ...sharedProps,
        // Preserve the child's own handlers by composing them too.
        onMouseEnter: composeHandlers(childProps.onMouseEnter as never, () => ctx.show()),
        onMouseLeave: composeHandlers(childProps.onMouseLeave as never, () => ctx.hide()),
        onFocus: composeHandlers(childProps.onFocus as never, () => ctx.show()),
        onBlur: composeHandlers(childProps.onBlur as never, () => ctx.hide()),
        onKeyDown: composeHandlers(childProps.onKeyDown as never, (event: React.KeyboardEvent) => {
          if (event.key === 'Escape' && ctx.open) ctx.hide();
        }),
        ref: mergedRef,
      } as AnyProps);
    }

    return (
      <button
        type="button"
        ref={mergeRefs(ref, ctx.triggerRef as unknown as React.Ref<HTMLButtonElement>)}
        {...props}
        {...(sharedProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }
);
TooltipTrigger.displayName = 'TooltipTrigger';

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */

function sideStyles(side: Side, align: Align, sideOffset: number): React.CSSProperties {
  const style: React.CSSProperties = { position: 'absolute', margin: 0 };

  // Primary axis: which edge of the trigger the tooltip sits against.
  switch (side) {
    case 'top':
      style.bottom = `calc(100% + ${sideOffset}px)`;
      break;
    case 'bottom':
      style.top = `calc(100% + ${sideOffset}px)`;
      break;
    case 'left':
      style.right = `calc(100% + ${sideOffset}px)`;
      break;
    case 'right':
      style.left = `calc(100% + ${sideOffset}px)`;
      break;
  }

  // Cross axis: how the tooltip aligns along the trigger's perpendicular edge.
  const isVertical = side === 'top' || side === 'bottom';
  if (isVertical) {
    if (align === 'start') style.left = 0;
    else if (align === 'end') style.right = 0;
    else {
      style.left = '50%';
      style.transform = 'translateX(-50%)';
    }
  } else {
    if (align === 'start') style.top = 0;
    else if (align === 'end') style.bottom = 0;
    else {
      style.top = '50%';
      style.transform = 'translateY(-50%)';
    }
  }

  return style;
}

export interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Which edge of the trigger the content sits against. Default: 'top'. */
  side?: Side;
  /** Cross-axis alignment. Default: 'center'. */
  align?: Align;
  /** Gap (px) between trigger and content along the `side` axis. Default: 6. */
  sideOffset?: number;
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  (
    { className, side = 'top', align = 'center', sideOffset = 6, style, children, ...props },
    ref
  ) => {
    const ctx = useTooltipContext('TooltipContent');

    if (!ctx.open) {
      return null;
    }

    return (
      <div
        ref={ref}
        id={ctx.contentId}
        role="tooltip"
        data-state={ctx.open ? 'open' : 'closed'}
        data-side={side}
        data-align={align}
        className={className}
        style={{ ...sideStyles(side, align, sideOffset), ...style }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
