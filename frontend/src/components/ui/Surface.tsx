/**
 * Surface — canonical surface primitive (DECISIONS.md §4 / Equoria-o5hub.7)
 *
 * Five variants cover the full surface hierarchy:
 *
 * | Variant     | CSS class(es)                              | Use                                                |
 * | ----------- | ------------------------------------------ | -------------------------------------------------- |
 * | page        | (none)                                     | Unframed band — spacing/typography only            |
 * | panel       | glass-panel                                | Framed tool; may blur only if outermost            |
 * | subtle      | glass-panel-subtle                         | Nested/secondary surface; NEVER blurs              |
 * | interactive | glass-panel glass-panel-interactive        | Clickable repeated item; the ONLY variant with     |
 * |             |                                            | hover lift/glow + focus-visible ring               |
 * | overlay     | glass-panel-heavy                          | Modal/popover surface; blur allowed                |
 *
 * Blur ownership rule (DECISIONS.md §4): blur is owned by `panel` and `overlay`
 * variants (via the `.celestial` progressive-enhancement scope) and by the layout
 * footer/nav primitives. Do not add `backdrop-blur-*` utilities to page-local
 * elements — use a `panel` or `overlay` Surface instead.
 *
 * Usage:
 *   <Surface variant="panel">…</Surface>
 *   <Surface variant="interactive" as="button" onClick={…}>…</Surface>
 *   <Surface variant="interactive" as={Link} to="/horses">…</Surface>
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export type SurfaceVariant = 'page' | 'panel' | 'subtle' | 'interactive' | 'overlay';

const variantClasses: Record<SurfaceVariant, string> = {
  page: '',
  panel: 'glass-panel',
  subtle: 'glass-panel-subtle',
  interactive: 'glass-panel glass-panel-interactive',
  overlay: 'glass-panel-heavy',
};

export interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
  /** Surface variant — controls visual treatment and blur ownership. Default: 'panel'. */
  variant?: SurfaceVariant;
  /**
   * Polymorphic `as` prop — render as any HTML element or React component.
   * Defaults to `div`. Use `button` or `a`/`Link` for interactive variants.
   */
  as?: React.ElementType;
  className?: string;
  /** Default testid; callers can override via the standard data-testid attribute. */
  'data-testid'?: string;
}

const Surface = React.forwardRef<HTMLElement, SurfaceProps>(
  (
    {
      variant = 'panel',
      as: Comp = 'div',
      className,
      'data-testid': testId = 'surface',
      children,
      ...rest
    },
    ref
  ) => {
    return (
      <Comp
        ref={ref}
        className={cn(variantClasses[variant], className)}
        data-testid={testId}
        {...rest}
      >
        {children}
      </Comp>
    );
  }
);

Surface.displayName = 'Surface';

export { Surface };
