/**
 * dialogPresence — behavioural hooks/utilities for the native Dialog primitive
 * (Equoria-rkgq9.1 / Equoria-mased). Extracted from dialog.tsx (file-size
 * doctrine ratchet) so dialog.tsx can stay the React component layer while this
 * module owns the imperative/behavioural machinery it imports:
 *
 *   - the open-modal stack (topmost-only Escape / outside dismissal for nesting)
 *   - reference-counted body scroll lock
 *   - the exit-animation presence layer (`usePresence`)
 *   - focusable-element discovery for the focus trap
 *
 * Pure move + import — no behaviour change. Focus-management / scroll-lock /
 * portal approach mirrors the existing native BaseModal pattern
 * (.claude/rules/PATTERN_LIBRARY.md → Modal Patterns).
 */
import * as React from 'react';
import { mergeRefs, composeEventHandlers } from '@/lib/ref-utils';

/* -------------------------------------------------------------------------- */
/* Native Slot — single-child render-merge for asChild (Trigger/Close).       */
/* Same merge contract as button.tsx's Slot: child props win on conflict,     */
/* className merged, handlers composed (child first, defaultPrevented-aware),  */
/* refs fanned out via mergeRefs.                                             */
/* -------------------------------------------------------------------------- */

export type AnyProps = Record<string, unknown>;

export function mergeSlotProps(
  slotProps: AnyProps,
  forwardedRef: React.Ref<unknown>,
  child: React.ReactElement<AnyProps> & { ref?: React.Ref<unknown> }
): AnyProps {
  const childProps = child.props as AnyProps;
  const merged: AnyProps = { ...slotProps, ...childProps };

  // className: slot first, child second → child's own classes are preserved
  // alongside the slot's (parity with Radix Slot, which keeps both).
  const slotClass = slotProps.className as string | undefined;
  const childClass = childProps.className as string | undefined;
  if (slotClass || childClass) {
    merged.className = [slotClass, childClass].filter(Boolean).join(' ');
  }

  // Compose every event handler present on either side (child runs first).
  for (const key of Object.keys(slotProps)) {
    if (/^on[A-Z]/.test(key)) {
      const slotHandler = slotProps[key];
      const childHandler = childProps[key];
      if (typeof slotHandler === 'function' || typeof childHandler === 'function') {
        merged[key] = composeEventHandlers(
          childHandler as ((e: { defaultPrevented?: boolean }) => void) | undefined,
          slotHandler as ((e: { defaultPrevented?: boolean }) => void) | undefined
        );
      }
    }
  }

  merged.ref = mergeRefs(forwardedRef, child.ref as React.Ref<unknown> | undefined);
  return merged;
}

/* -------------------------------------------------------------------------- */
/* Open-modal stack — topmost-only Escape/outside dismissal for nesting.       */
/* Equoria-mased: the document-level keydown listeners run in capture phase, so */
/* without this ALL open dialogs would close on a single Escape (the outer one's */
/* capture listener fires too). Each open modal content pushes a token on mount  */
/* and pops it on close; only the token at the top of the stack acts on Escape / */
/* outside-pointer dismissal, so a single Escape closes ONLY the topmost dialog  */
/* and nested focus restoration can thread level-by-level.                       */
/* -------------------------------------------------------------------------- */

const openModalStack: symbol[] = [];

export function pushModal(token: symbol): void {
  openModalStack.push(token);
}

export function popModal(token: symbol): void {
  const idx = openModalStack.lastIndexOf(token);
  if (idx !== -1) openModalStack.splice(idx, 1);
}

export function isTopmostModal(token: symbol): boolean {
  return openModalStack.length > 0 && openModalStack[openModalStack.length - 1] === token;
}

/* -------------------------------------------------------------------------- */
/* Scroll lock — reference counted so nested dialogs don't fight over it.     */
/* -------------------------------------------------------------------------- */

let openDialogCount = 0;

export function lockBodyScroll(): () => void {
  openDialogCount += 1;
  if (openDialogCount === 1) {
    document.body.style.overflow = 'hidden';
    // Mirror Radix/react-remove-scroll's `data-scroll-locked` body marker so
    // consumers/tests that assert the lock via the attribute keep working.
    document.body.setAttribute('data-scroll-locked', '1');
  }
  return () => {
    openDialogCount -= 1;
    if (openDialogCount <= 0) {
      openDialogCount = 0;
      document.body.style.overflow = '';
      document.body.removeAttribute('data-scroll-locked');
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Presence — keep the subtree mounted for one close-animation frame.         */
/* Equoria-mased: the native portal unmounts synchronously on close, so the    */
/* `data-[state=closed]:animate-out` exit classes never play. usePresence keeps */
/* `present` true after `open` flips to false until the registered exit node's  */
/* `animationend` fires, THEN unmounts. Reduced-motion / no-animation never     */
/* hangs mounted: a 0ms-or-missing animation is detected (rAF probe + a short    */
/* fallback timeout) so the node unmounts on the very next frame.               */
/* -------------------------------------------------------------------------- */

/** Hard cap so a stuck/never-firing animation can never pin the dialog open. */
const EXIT_ANIMATION_FALLBACK_MS = 1000;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** True when the node has at least one running CSS animation we should await. */
function hasRunningAnimation(node: HTMLElement | null): boolean {
  if (!node) return false;
  // getAnimations is the reliable signal in real browsers; jsdom lacks it (and
  // lacks CSS animation entirely), so absence → treat as "no animation".
  if (typeof (node as HTMLElement & { getAnimations?: unknown }).getAnimations !== 'function') {
    return false;
  }
  try {
    return node.getAnimations().some((a) => a.playState === 'running');
  } catch {
    return false;
  }
}

export interface PresenceState {
  present: boolean;
  state: 'open' | 'closed';
  registerExitNode: (node: HTMLElement | null) => void;
}

export function usePresence(open: boolean): PresenceState {
  // `present` mirrors `open` immediately on open; on close it stays true until
  // the exit animation finishes (or the no-animation fast-path fires).
  const [present, setPresent] = React.useState(open);
  const exitNodeRef = React.useRef<HTMLElement | null>(null);
  const registerExitNode = React.useCallback((node: HTMLElement | null) => {
    exitNodeRef.current = node;
  }, []);

  React.useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    // Closing transition: only run the exit dance if we were actually present.
    if (!present) return;

    let cancelled = false;
    const node = exitNodeRef.current;

    const unmount = () => {
      if (!cancelled) setPresent(false);
    };

    // Synchronous fast-path: when the environment can't run a CSS exit animation
    // (no animated node, reduced-motion, or no `getAnimations` support — e.g.
    // jsdom under test), there is nothing to await. Unmount in the same tick so
    // the node disappears immediately, exactly as it did before the presence
    // layer existed (preserves the instant-close contract every consumer relies
    // on). Only real browsers with a running animation take the deferred path.
    const canAnimate =
      !!node &&
      !prefersReducedMotion() &&
      typeof (node as HTMLElement & { getAnimations?: unknown }).getAnimations === 'function';
    if (!canAnimate) {
      unmount();
      return () => {
        cancelled = true;
      };
    }

    const onAnimationEnd = (event: AnimationEvent) => {
      // Ignore bubbled animationend from descendants — only the panel's own
      // exit animation should trigger unmount.
      if (event.target === node) unmount();
    };
    node.addEventListener('animationend', onAnimationEnd);
    node.addEventListener('animationcancel', onAnimationEnd);

    // Probe AFTER a frame: the `data-state="closed"` className change has to land
    // before the browser starts the exit animation. If nothing is running by then,
    // there is no exit animation to await — unmount immediately.
    const raf =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(() => {
            if (!hasRunningAnimation(node)) unmount();
          })
        : (setTimeout(() => {
            if (!hasRunningAnimation(node)) unmount();
          }, 0) as unknown as number);

    // Absolute backstop: even if animationend never fires (interrupted layout,
    // detached node, exotic env), force-unmount after the cap.
    const fallback = setTimeout(unmount, EXIT_ANIMATION_FALLBACK_MS);

    return () => {
      cancelled = true;
      node.removeEventListener('animationend', onAnimationEnd);
      node.removeEventListener('animationcancel', onAnimationEnd);
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
    // We react to `open` transitions only; the close-branch reads the latest
    // `present` via closure at effect-run time (intentionally not a dependency).
  }, [open]);

  return {
    present: open || present,
    state: open ? 'open' : 'closed',
    registerExitNode,
  };
}

/* -------------------------------------------------------------------------- */
/* Focusable-element discovery for the focus trap.                            */
/* -------------------------------------------------------------------------- */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getFocusable(container: HTMLElement): HTMLElement[] {
  // The selector already excludes disabled controls and tabindex="-1". We avoid
  // a geometry-based visibility filter (offsetParent / getClientRects) because
  // jsdom does not lay elements out, so such a filter would wrongly return [] in
  // tests. Skip only elements explicitly hidden via attribute.
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true'
  );
}
