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

/** Props Surface itself owns (everything else comes from the `as` element). */
interface SurfaceOwnProps {
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

/**
 * Polymorphic props: Surface's own props + everything the `as` element
 * accepts (e.g. `to` for Link, `type`/`onClick` for button). This is the
 * typing the JSDoc above always promised — consumers no longer need the
 * `{...{ to }}` spread workaround (Equoria-o5hub wave-1 finding).
 */
export type SurfacePolymorphicProps<T extends React.ElementType = 'div'> = SurfaceOwnProps & {
  as?: T;
} & Omit<React.ComponentPropsWithoutRef<T>, keyof SurfaceOwnProps>;

/** Back-compat alias for existing imports typed against the div default. */
export type SurfaceProps = SurfacePolymorphicProps<'div'>;

/*
 * NOTE (type-only repair, Equoria-o5hub.20 verification): the inner generic
 * must NOT include a `Record<string, unknown>` index signature — forwardRef's
 * `PropsWithoutRef` Omit collapses every prop to `unknown` when an index
 * signature is present (keyof becomes `string`), which made `Comp` untypable
 * as a JSX element. Extra runtime props still flow through `...rest` at the
 * JS level; the public typing is the generic cast below.
 */
const SurfaceInner = React.forwardRef<
  HTMLElement,
  SurfaceOwnProps & { children?: React.ReactNode }
>(
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
        className={cn(variantClasses[variant as SurfaceVariant], className as string)}
        data-testid={testId}
        {...rest}
      >
        {children as React.ReactNode}
      </Comp>
    );
  }
);

SurfaceInner.displayName = 'Surface';

/** Generic call signature so `<Surface as={Link} to=…>` typechecks. */
const Surface = SurfaceInner as unknown as (<T extends React.ElementType = 'div'>(
  props: SurfacePolymorphicProps<T> & { ref?: React.Ref<Element> }
) => React.ReactElement | null) & { displayName?: string };

Surface.displayName = 'Surface';

export { Surface };
