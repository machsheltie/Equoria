/**
 * ref-utils — shared helpers for native polymorphic ("asChild") components.
 *
 * Replaces the merge primitives that @radix-ui/react-slot used to provide
 * (Equoria-rkgq9.8 / parent Equoria-rkgq9: retire @radix-ui). Both the native
 * Slot in button.tsx and the existing tooltip.tsx asChild path want the same
 * two operations: fan a single forwarded ref out to several targets, and stack
 * one handler on top of another while honouring defaultPrevented.
 *
 * Keeping these in one place avoids each native primitive re-deriving the same
 * (subtly easy-to-get-wrong) logic. tooltip.tsx currently has private copies;
 * future cleanup can import these instead — out of scope for this issue.
 */
import type * as React from 'react';

/**
 * mergeRefs — fan a single node out to every supplied ref (callback or object).
 * Returns a stable-shaped RefCallback. `undefined`/`null` refs are skipped.
 */
export function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
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

/**
 * composeEventHandlers — run the child's handler first, then ours, unless the
 * child called preventDefault. Mirrors Radix Slot's handler-composition
 * semantics so a slotted child's own onClick/onKeyDown still fires alongside
 * the parent's, and a child that preventDefaults can opt out of the parent's.
 */
export function composeEventHandlers<E extends { defaultPrevented?: boolean }>(
  theirHandler: ((event: E) => void) | undefined,
  ourHandler: ((event: E) => void) | undefined
): (event: E) => void {
  return (event: E) => {
    theirHandler?.(event);
    if (!event?.defaultPrevented) {
      ourHandler?.(event);
    }
  };
}
