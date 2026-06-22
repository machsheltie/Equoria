/**
 * Tabs — native, dependency-free tab primitives (Equoria-rkgq9.2).
 *
 * Drop-in replacement for the former `@radix-ui/react-tabs` forwarder. The public
 * API is byte-for-byte compatible with the Radix surface every consumer used:
 *
 *   <Tabs value|defaultValue onValueChange orientation activationMode dir>
 *     <TabsList>            role="tablist"   + aria-orientation, data-orientation
 *       <TabsTrigger value> role="tab"       + aria-selected/-controls, data-state, roving tabIndex
 *     <TabsContent value>   role="tabpanel"  + aria-labelledby, data-state (hidden when inactive)
 *
 * Behaviour preserved from Radix defaults:
 *   - Controlled (`value` + `onValueChange`) AND uncontrolled (`defaultValue`).
 *   - `data-state="active|inactive"` on triggers AND content (the design system's
 *     `data-[state=active]:` Tailwind selectors + the tab tests depend on this).
 *   - `data-orientation="horizontal|vertical"` on list/trigger/content.
 *   - Automatic activation (`activationMode="automatic"`, the default): arrow keys
 *     move focus AND select. `activationMode="manual"` moves focus only; Enter/Space
 *     or click selects.
 *   - Roving tabindex: the active trigger is tabIndex 0, the rest -1, so the tab
 *     row is a single Tab stop and arrows move within it.
 *   - Inactive panels are unmounted (not just hidden) — Radix's default. Tests rely
 *     on `queryByText(...)` returning null for the inactive panel.
 *   - Keyboard: ArrowLeft/Right (horizontal) or ArrowUp/Down (vertical) move to the
 *     prev/next ENABLED trigger and wrap; Home/End jump to first/last enabled.
 *
 * No CSS / styling lives here — that's GoldTabs.tsx → CanonicalTabs.tsx. This file
 * is the naked, accessible primitive only.
 */
import * as React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Orientation = 'horizontal' | 'vertical';
type ActivationMode = 'automatic' | 'manual';

interface TabsContextValue {
  /** The active tab value. */
  value: string | undefined;
  /** Select a tab value (no-op if already active). */
  setValue: (value: string) => void;
  /** A stable id prefix so trigger/panel ids can be cross-wired. */
  baseId: string;
  orientation: Orientation;
  activationMode: ActivationMode;
  /** Ordered registry of trigger values, used for roving + arrow nav. */
  registerTrigger: (value: string, disabled: boolean) => void;
  unregisterTrigger: (value: string) => void;
  /** Move focus+selection (automatic) or focus only (manual) to a neighbour. */
  onTriggerKeyDown: (event: React.KeyboardEvent, currentValue: string) => void;
  /** Ref map of trigger value → DOM node, for programmatic focus. */
  triggerRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used within <Tabs>`);
  }
  return ctx;
}

let idCounter = 0;
function useId(provided?: string): string {
  // React 18's useId would suffice, but a local counter keeps SSR/jsdom ids
  // deterministic per mount order and avoids depending on the React version's
  // useId (which is also fine — this is just stable + simple).
  const [generated] = React.useState(() => `equoria-tabs-${++idCounter}`);
  return provided ?? generated;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'dir'> {
  /** Controlled active tab value. */
  value?: string;
  /** Uncontrolled initial active tab value. */
  defaultValue?: string;
  /** Called with the new value whenever the active tab changes. */
  onValueChange?: (value: string) => void;
  /** Layout orientation; drives arrow-key axis + aria/data-orientation. Default 'horizontal'. */
  orientation?: Orientation;
  /** 'automatic' (default): arrows select. 'manual': arrows move focus, Enter/Space/click selects. */
  activationMode?: ActivationMode;
  /** Reading direction; affects horizontal arrow direction. Default 'ltr'. */
  dir?: 'ltr' | 'rtl';
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      value: valueProp,
      defaultValue,
      onValueChange,
      orientation = 'horizontal',
      activationMode = 'automatic',
      dir = 'ltr',
      children,
      ...divProps
    },
    ref
  ) => {
    const isControlled = valueProp !== undefined;
    const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue);
    const value = isControlled ? valueProp : internalValue;

    const baseId = useId();
    // Ordered list of registered trigger values (registration order === DOM order
    // because effects run in mount order). Used to compute prev/next/first/last.
    const orderRef = React.useRef<string[]>([]);
    const disabledRef = React.useRef<Map<string, boolean>>(new Map());
    const triggerRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

    const setValue = React.useCallback(
      (next: string) => {
        if (next === value) return;
        if (!isControlled) setInternalValue(next);
        onValueChange?.(next);
      },
      [value, isControlled, onValueChange]
    );

    const registerTrigger = React.useCallback((triggerValue: string, disabled: boolean) => {
      if (!orderRef.current.includes(triggerValue)) {
        orderRef.current.push(triggerValue);
      }
      disabledRef.current.set(triggerValue, disabled);
    }, []);

    const unregisterTrigger = React.useCallback((triggerValue: string) => {
      orderRef.current = orderRef.current.filter((v) => v !== triggerValue);
      disabledRef.current.delete(triggerValue);
      triggerRefs.current.delete(triggerValue);
    }, []);

    const focusTrigger = React.useCallback(
      (triggerValue: string, select: boolean) => {
        const node = triggerRefs.current.get(triggerValue);
        node?.focus();
        if (select) setValue(triggerValue);
      },
      [setValue]
    );

    const onTriggerKeyDown = React.useCallback(
      (event: React.KeyboardEvent, currentValue: string) => {
        const order = orderRef.current;
        const enabled = order.filter((v) => !disabledRef.current.get(v));
        if (enabled.length === 0) return;

        const horizontalPrev = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
        const horizontalNext = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
        const prevKey = orientation === 'vertical' ? 'ArrowUp' : horizontalPrev;
        const nextKey = orientation === 'vertical' ? 'ArrowDown' : horizontalNext;

        const idx = enabled.indexOf(currentValue);

        let target: string | undefined;
        if (event.key === prevKey) {
          target = enabled[(idx - 1 + enabled.length) % enabled.length];
        } else if (event.key === nextKey) {
          target = enabled[(idx + 1) % enabled.length];
        } else if (event.key === 'Home') {
          target = enabled[0];
        } else if (event.key === 'End') {
          target = enabled[enabled.length - 1];
        } else {
          return;
        }

        event.preventDefault();
        if (target !== undefined) {
          // Automatic activation selects on move; manual only moves focus.
          focusTrigger(target, activationMode === 'automatic');
        }
      },
      [orientation, activationMode, dir, focusTrigger]
    );

    const contextValue = React.useMemo<TabsContextValue>(
      () => ({
        value,
        setValue,
        baseId,
        orientation,
        activationMode,
        registerTrigger,
        unregisterTrigger,
        onTriggerKeyDown,
        triggerRefs,
      }),
      [
        value,
        setValue,
        baseId,
        orientation,
        activationMode,
        registerTrigger,
        unregisterTrigger,
        onTriggerKeyDown,
      ]
    );

    return (
      <TabsContext.Provider value={contextValue}>
        <div ref={ref} data-orientation={orientation} dir={dir} {...divProps}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = 'Tabs';

// ─── List ─────────────────────────────────────────────────────────────────────

export type TabsListProps = React.HTMLAttributes<HTMLDivElement>;

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(({ className, ...props }, ref) => {
  const { orientation } = useTabsContext('TabsList');
  return (
    <div
      ref={ref}
      role="tablist"
      aria-orientation={orientation}
      data-orientation={orientation}
      className={className}
      {...props}
    />
  );
});
TabsList.displayName = 'TabsList';

// ─── Trigger ──────────────────────────────────────────────────────────────────

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The value this trigger selects; matched against the active Tabs value. */
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, disabled = false, className, onClick, onKeyDown, ...props }, ref) => {
    const ctx = useTabsContext('TabsTrigger');
    const {
      value: activeValue,
      setValue,
      baseId,
      orientation,
      registerTrigger,
      unregisterTrigger,
      onTriggerKeyDown,
      triggerRefs,
    } = ctx;
    const isActive = activeValue === value;

    // Register in the ordered roving registry; re-run if disabled toggles.
    React.useEffect(() => {
      registerTrigger(value, !!disabled);
      return () => unregisterTrigger(value);
    }, [value, disabled, registerTrigger, unregisterTrigger]);

    const setRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        if (node) triggerRefs.current.set(value, node);
        else triggerRefs.current.delete(value);
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      },
      [ref, triggerRefs, value]
    );

    return (
      <button
        ref={setRefs}
        type="button"
        role="tab"
        id={`${baseId}-trigger-${value}`}
        aria-selected={isActive}
        aria-controls={`${baseId}-content-${value}`}
        data-state={isActive ? 'active' : 'inactive'}
        data-orientation={orientation}
        // Roving tabindex: only the active trigger is in the Tab order.
        tabIndex={isActive ? 0 : -1}
        disabled={disabled}
        className={className}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && !disabled) setValue(value);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          onTriggerKeyDown(event, value);
        }}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

// ─── Content ──────────────────────────────────────────────────────────────────

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The value this panel belongs to; rendered only when it is the active tab. */
  value: string;
  /** Keep the panel mounted (hidden) when inactive. Default false — matches Radix default. */
  forceMount?: boolean;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, forceMount = false, className, children, ...props }, ref) => {
    const { value: activeValue, baseId, orientation } = useTabsContext('TabsContent');
    const isActive = activeValue === value;

    if (!isActive && !forceMount) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${baseId}-content-${value}`}
        aria-labelledby={`${baseId}-trigger-${value}`}
        data-state={isActive ? 'active' : 'inactive'}
        data-orientation={orientation}
        hidden={!isActive}
        // A tabpanel is focusable so Tab from the active trigger lands on its panel.
        tabIndex={0}
        className={className}
        {...props}
      >
        {isActive ? children : null}
      </div>
    );
  }
);
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
