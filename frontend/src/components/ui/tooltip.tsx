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
 *   - Lightweight viewport collision handling (Equoria-rkgq9.3.1): on open (and
 *     on scroll/resize while open) the content's rect is measured against the
 *     viewport; if the preferred `side` would clip and the opposite side fits
 *     better, the content flips to that side, and a cross-axis pixel shift keeps
 *     it inside the viewport. `data-side` reflects the EFFECTIVE side so the
 *     consumer's animation classes follow the flip. No positioning library.
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

/* -------------------------------------------------------------------------- */
/* Collision (viewport flip + cross-axis shift) — pure, framework-agnostic     */
/* -------------------------------------------------------------------------- */

export interface Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface CollisionResult {
  /** Effective side after a possible flip. */
  side: Side;
  /**
   * Extra cross-axis pixel correction to keep the content inside the viewport,
   * applied on top of the align-based CSS position. Positive X nudges right,
   * positive Y nudges down. Zero when no shift is needed.
   */
  shiftX: number;
  shiftY: number;
}

const OPPOSITE: Record<Side, Side> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

/**
 * Decide the effective side + cross-axis shift for a tooltip, given the trigger
 * rect, the (already-measured) content rect, the viewport, the preferred side
 * and the side offset. Pure: no DOM, no React — directly unit-testable (jsdom's
 * getBoundingClientRect returns zeros, so the layout-dependent flip path is
 * proven here rather than through a rendered component).
 *
 * Rules:
 *  - Compute how much the content would overflow the viewport on the preferred
 *    side. If it overflows AND the opposite side has strictly more room for the
 *    content, flip to the opposite side. Otherwise keep the preferred side
 *    (respect the consumer's choice when it fits — or when neither side fits,
 *    keep the side with the most room).
 *  - On the cross axis, clamp the content back inside the viewport with a pixel
 *    shift (works for both align=center and align=start/end overflow).
 */
export function resolveCollision(
  triggerRect: Rect,
  contentRect: Rect,
  viewport: Viewport,
  preferredSide: Side,
  sideOffset: number
): CollisionResult {
  const { width: cw, height: ch } = contentRect;

  // Available space (px) for the content between the trigger edge and the
  // viewport edge on a given side, minus the offset gap.
  const spaceFor = (side: Side): number => {
    switch (side) {
      case 'top':
        return triggerRect.top - sideOffset;
      case 'bottom':
        return viewport.height - triggerRect.bottom - sideOffset;
      case 'left':
        return triggerRect.left - sideOffset;
      case 'right':
        return viewport.width - triggerRect.right - sideOffset;
    }
  };

  const isVertical = preferredSide === 'top' || preferredSide === 'bottom';
  const neededMain = isVertical ? ch : cw;

  const opposite = OPPOSITE[preferredSide];
  const preferredSpace = spaceFor(preferredSide);
  const oppositeSpace = spaceFor(opposite);

  // Flip only when the preferred side cannot fit the content AND the opposite
  // side has strictly more room. If neither fits, take whichever has more room.
  let side: Side = preferredSide;
  if (preferredSpace < neededMain && oppositeSpace > preferredSpace) {
    side = opposite;
  }

  // Cross-axis clamp. The content is centered/aligned on the trigger's
  // perpendicular edge; compute where it would land and shift it back in-bounds.
  let shiftX = 0;
  let shiftY = 0;
  const effectiveVertical = side === 'top' || side === 'bottom';

  if (effectiveVertical) {
    // Horizontal cross axis: content centered on the trigger's horizontal centre.
    const centerX = triggerRect.left + triggerRect.width / 2;
    let contentLeft = centerX - cw / 2;
    let contentRight = contentLeft + cw;
    if (contentLeft < 0) {
      shiftX = -contentLeft;
    } else if (contentRight > viewport.width) {
      shiftX = viewport.width - contentRight;
    }
    // Re-check the far edge after shifting (content wider than viewport stays
    // pinned to the left rather than oscillating).
    contentLeft += shiftX;
    contentRight += shiftX;
    if (contentLeft < 0) shiftX += -contentLeft;
  } else {
    // Vertical cross axis: content centered on the trigger's vertical centre.
    const centerY = triggerRect.top + triggerRect.height / 2;
    let contentTop = centerY - ch / 2;
    let contentBottom = contentTop + ch;
    if (contentTop < 0) {
      shiftY = -contentTop;
    } else if (contentBottom > viewport.height) {
      shiftY = viewport.height - contentBottom;
    }
    contentTop += shiftY;
    contentBottom += shiftY;
    if (contentTop < 0) shiftY += -contentTop;
  }

  return { side, shiftX, shiftY };
}

function sideStyles(
  side: Side,
  align: Align,
  sideOffset: number,
  shiftX = 0,
  shiftY = 0
): React.CSSProperties {
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
  // A collision shift (px) composes with the centre-translate via a combined
  // translate() so an aligned tooltip can be nudged back inside the viewport.
  const isVertical = side === 'top' || side === 'bottom';
  const translateParts: string[] = [];
  if (isVertical) {
    if (align === 'start') style.left = 0;
    else if (align === 'end') style.right = 0;
    else {
      style.left = '50%';
      translateParts.push('translateX(-50%)');
    }
  } else {
    if (align === 'start') style.top = 0;
    else if (align === 'end') style.bottom = 0;
    else {
      style.top = '50%';
      translateParts.push('translateY(-50%)');
    }
  }

  if (shiftX !== 0 || shiftY !== 0) {
    translateParts.push(`translate(${shiftX}px, ${shiftY}px)`);
  }
  if (translateParts.length > 0) {
    style.transform = translateParts.join(' ');
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

function toRect(domRect: DOMRect): Rect {
  return {
    top: domRect.top,
    right: domRect.right,
    bottom: domRect.bottom,
    left: domRect.left,
    width: domRect.width,
    height: domRect.height,
  };
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  (
    { className, side = 'top', align = 'center', sideOffset = 6, style, children, ...props },
    ref
  ) => {
    const ctx = useTooltipContext('TooltipContent');
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const mergedRef = React.useMemo(() => mergeRefs<HTMLDivElement>(ref, contentRef), [ref]);

    // Effective placement after collision resolution. Starts at the preferred
    // side with no shift; recomputed once measured.
    const [placement, setPlacement] = React.useState<CollisionResult>({
      side,
      shiftX: 0,
      shiftY: 0,
    });

    // Reset to the preferred side whenever the consumer's props change so a
    // stale flip from a previous open doesn't leak.
    React.useLayoutEffect(() => {
      setPlacement({ side, shiftX: 0, shiftY: 0 });
    }, [side, align, sideOffset]);

    React.useLayoutEffect(() => {
      if (!ctx.open) return;

      const recompute = () => {
        const triggerEl = ctx.triggerRef.current;
        const contentEl = contentRef.current;
        if (!triggerEl || !contentEl) return;
        if (
          typeof triggerEl.getBoundingClientRect !== 'function' ||
          typeof contentEl.getBoundingClientRect !== 'function'
        ) {
          return;
        }

        const triggerRect = toRect(triggerEl.getBoundingClientRect());
        const contentRect = toRect(contentEl.getBoundingClientRect());

        // jsdom (and any environment without real layout) returns all-zero
        // rects; there is nothing to collide against, so keep the preferred
        // side. The pure resolveCollision() helper is what proves the flip.
        const noLayout =
          contentRect.width === 0 &&
          contentRect.height === 0 &&
          triggerRect.width === 0 &&
          triggerRect.height === 0;
        if (noLayout) return;

        const viewport: Viewport = {
          width: window.innerWidth || document.documentElement.clientWidth || 0,
          height: window.innerHeight || document.documentElement.clientHeight || 0,
        };
        if (viewport.width === 0 || viewport.height === 0) return;

        const next = resolveCollision(triggerRect, contentRect, viewport, side, sideOffset);
        setPlacement((prev) =>
          prev.side === next.side && prev.shiftX === next.shiftX && prev.shiftY === next.shiftY
            ? prev
            : next
        );
      };

      recompute();

      // Recompute while open as the viewport / scroll position changes.
      window.addEventListener('scroll', recompute, true);
      window.addEventListener('resize', recompute);
      return () => {
        window.removeEventListener('scroll', recompute, true);
        window.removeEventListener('resize', recompute);
      };
    }, [ctx.open, ctx.triggerRef, side, sideOffset, align]);

    if (!ctx.open) {
      return null;
    }

    const effectiveSide = placement.side;

    return (
      <div
        ref={mergedRef}
        id={ctx.contentId}
        role="tooltip"
        data-state={ctx.open ? 'open' : 'closed'}
        data-side={effectiveSide}
        data-align={align}
        className={className}
        style={{
          ...sideStyles(effectiveSide, align, sideOffset, placement.shiftX, placement.shiftY),
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
