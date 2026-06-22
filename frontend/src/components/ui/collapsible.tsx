/**
 * Collapsible — Native disclosure primitive (Equoria-rkgq9.5).
 *
 * Replaces @radix-ui/react-collapsible with an in-house implementation that
 * preserves the prior public API exactly: Collapsible (Root), CollapsibleTrigger,
 * CollapsibleContent. Supports controlled (`open`/`onOpenChange`) and uncontrolled
 * (`defaultOpen`) modes, `disabled`, refs, and the `data-state="open|closed"`
 * attributes that GameCollapsible's CSS (`[&[data-state=open]>svg]` chevron flip,
 * `data-[state=...]` content animations) and tests rely on.
 *
 * Visual styling lives in game/GameCollapsible.tsx.
 */
import * as React from 'react';

/* ------------------------------------------------------------------ context */

interface CollapsibleContextValue {
  open: boolean;
  disabled: boolean;
  contentId: string;
  triggerId: string;
  toggle: () => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null);

function useCollapsibleContext(component: string): CollapsibleContextValue {
  const context = React.useContext(CollapsibleContext);
  if (!context) {
    throw new Error(`\`${component}\` must be used within a \`Collapsible\``);
  }
  return context;
}

/* --------------------------------------------------------------------- root */

interface CollapsibleProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Controlled open state. When provided, the component is controlled. */
  open?: boolean;
  /** Uncontrolled initial open state. */
  defaultOpen?: boolean;
  /** Called whenever the open state is requested to change. */
  onOpenChange?: (open: boolean) => void;
  /** When true, the trigger is disabled and toggling is prevented. */
  disabled?: boolean;
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  (
    { open: openProp, defaultOpen = false, onOpenChange, disabled = false, children, ...props },
    ref
  ) => {
    const isControlled = openProp !== undefined;
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
    const open = isControlled ? (openProp as boolean) : uncontrolledOpen;

    const reactId = React.useId();
    const contentId = `collapsible-content-${reactId}`;
    const triggerId = `collapsible-trigger-${reactId}`;

    const toggle = React.useCallback(() => {
      if (disabled) {
        return;
      }
      const next = !open;
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    }, [disabled, open, isControlled, onOpenChange]);

    const contextValue = React.useMemo<CollapsibleContextValue>(
      () => ({ open, disabled, contentId, triggerId, toggle }),
      [open, disabled, contentId, triggerId, toggle]
    );

    return (
      <CollapsibleContext.Provider value={contextValue}>
        <div
          ref={ref}
          data-state={open ? 'open' : 'closed'}
          data-disabled={disabled ? '' : undefined}
          {...props}
        >
          {children}
        </div>
      </CollapsibleContext.Provider>
    );
  }
);
Collapsible.displayName = 'Collapsible';

/* ------------------------------------------------------------------ trigger */

const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'>
>(({ className, children, onClick, ...props }, ref) => {
  const { open, disabled, contentId, triggerId, toggle } =
    useCollapsibleContext('CollapsibleTrigger');

  return (
    <button
      ref={ref}
      type="button"
      id={triggerId}
      aria-expanded={open}
      aria-controls={contentId}
      data-state={open ? 'open' : 'closed'}
      data-disabled={disabled ? '' : undefined}
      disabled={disabled}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          toggle();
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
});
CollapsibleTrigger.displayName = 'CollapsibleTrigger';

/* ------------------------------------------------------------------ content */

const CollapsibleContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
  ({ className, children, ...props }, ref) => {
    const { open, contentId, triggerId } = useCollapsibleContext('CollapsibleContent');

    return (
      <div
        ref={ref}
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        data-state={open ? 'open' : 'closed'}
        hidden={!open}
        className={className}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CollapsibleContent.displayName = 'CollapsibleContent';

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
