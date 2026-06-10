/**
 * CanonicalTabs — Canonical Radix-backed Tabs for Equoria's Celestial Night design system.
 *
 * Source of truth: docs/design-system/DECISIONS.md §6 (Equoria-o5hub.11)
 *
 * This component supersedes GoldTabs and CelestialTabs:
 * - GoldTabs is the styling base used internally here; it is not deprecated.
 * - CelestialTabs (deprecated adapter) was deleted 2026-06-10 after all
 *   consumers migrated here (Equoria-o5hub.11).
 *
 * Two presentation variants:
 *   - `underline` (default) — transparent bg list with 2px gold underline active indicator.
 *     Matches GoldTabs visuals. Use for page/section tabs (entity detail, results).
 *   - `segmented` — pill-row look for compact mode switches (2–4 options, toolbar contexts).
 *     bg-[var(--glass-surface-subtle-bg)] container, active trigger uses gold button tokens,
 *     inactive trigger uses text-role-secondary.
 *
 * Both a composable primitive API (Tabs/TabsList/TabsTrigger/TabsContent) and an array
 * convenience API (`tabs` prop) are supported, with controlled and uncontrolled modes.
 *
 * Overflow: tab list scrolls horizontally on mobile (overflow-x-auto, no wrap).
 * Edge-fade affordance (DECISIONS.md §6 overflow rule): when the list overflows,
 * the clipped edge fades out via a CSS mask on the list itself (works on any
 * surface background — no overlay color to mismatch). Recomputed on scroll and
 * resize; no fade when content fits.
 *
 * All colors via CSS custom property tokens — zero raw rgba/palette literals.
 */

import * as React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { GoldTabs, GoldTabsList, GoldTabsTrigger, GoldTabsContent } from './GoldTabs';

// ─── Variant type ────────────────────────────────────────────────────────────

export type TabsVariant = 'underline' | 'segmented';

// ─── Context (variant propagation) ───────────────────────────────────────────

const TabsVariantContext = React.createContext<TabsVariant>('underline');

// ─── Composable primitives ────────────────────────────────────────────────────

/**
 * Tabs root. Wraps Radix Tabs via GoldTabs.
 *
 * @param variant  'underline' (default) | 'segmented'
 * @param value    Controlled active tab value
 * @param defaultValue  Uncontrolled default tab
 * @param onValueChange  Called when tab changes
 */
const Tabs = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof GoldTabs> & { variant?: TabsVariant }
>(({ variant = 'underline', className, ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <GoldTabs ref={ref} className={cn('w-full', className)} {...props} />
  </TabsVariantContext.Provider>
));
Tabs.displayName = 'Tabs';

// ─── Edge-fade affordance ────────────────────────────────────────────────────

const FADE_PX = 24;

/** Build the CSS mask for the overflowing edge(s). `null` = no mask. */
function edgeFadeMask(left: boolean, right: boolean): string | null {
  if (left && right) {
    return `linear-gradient(to right, transparent, black ${FADE_PX}px, black calc(100% - ${FADE_PX}px), transparent)`;
  }
  if (right) {
    return `linear-gradient(to right, black, black calc(100% - ${FADE_PX}px), transparent)`;
  }
  if (left) {
    return `linear-gradient(to right, transparent, black ${FADE_PX}px, black)`;
  }
  return null;
}

/**
 * TabsList — the tab trigger row.
 *
 * `underline`: transparent bg, bottom border, scrollable on mobile.
 * `segmented`: rounded pill container with subtle surface bg.
 *
 * Edge-fade: when the list overflows horizontally, the clipped edge(s) fade
 * out via a CSS mask (DECISIONS.md §6 overflow rule). State is recomputed on
 * scroll and resize. Purely visual — aria/keyboard behavior is untouched.
 */
const TabsList = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof GoldTabsList>
>(({ className, style, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const [fade, setFade] = React.useState<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });

  const updateFade = React.useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  React.useEffect(() => {
    updateFade();
    const el = innerRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', updateFade, { passive: true });
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateFade()) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateFade);
      ro?.disconnect();
    };
  }, [updateFade]);

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref]
  );

  const mask = edgeFadeMask(fade.left, fade.right);
  const maskStyle = mask
    ? ({ maskImage: mask, WebkitMaskImage: mask } as React.CSSProperties)
    : undefined;

  return (
    <GoldTabsList
      ref={setRefs}
      className={cn(
        // Shared: horizontal scroll on mobile, no wrap
        'overflow-x-auto flex-nowrap',
        variant === 'underline' &&
          [
            // GoldTabs underline variant (preserves GoldTabsList base classes)
          ],
        variant === 'segmented' && [
          // Segmented pill container
          'border-none bg-[var(--glass-surface-subtle-bg)] rounded-[var(--radius-md)] p-1 gap-1',
          'inline-flex items-center w-auto',
        ],
        className
      )}
      style={{ ...style, ...maskStyle }}
      {...props}
    />
  );
});
TabsList.displayName = 'TabsList';

/**
 * TabsTrigger — individual tab button.
 *
 * `underline`: inherits GoldTabsTrigger styles (gold underline active state).
 * `segmented`: pill-shaped trigger; active uses gold button bg token, inactive uses secondary text.
 */
const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof GoldTabsTrigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);

  if (variant === 'segmented') {
    return (
      <GoldTabsTrigger
        ref={ref}
        className={cn(
          // Segmented trigger base
          'relative inline-flex items-center justify-center whitespace-nowrap',
          'px-4 py-1.5 text-sm font-medium rounded-[var(--radius-md)]',
          'transition-all duration-150',
          // Inactive state
          'text-[var(--text-secondary)]',
          'data-[state=inactive]:text-[var(--text-secondary)]',
          // Active state: gold pill
          'data-[state=active]:bg-[var(--btn-gold-bg)]',
          'data-[state=active]:text-[var(--gold-light)]',
          'data-[state=active]:shadow-sm',
          // Override GoldTabsTrigger's underline pseudo-element (not used in segmented)
          'after:hidden',
          // Focus ring
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)]',
          'disabled:pointer-events-none disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }

  // underline variant: delegate entirely to GoldTabsTrigger styling
  return <GoldTabsTrigger ref={ref} className={cn(className)} {...props} />;
});
TabsTrigger.displayName = 'TabsTrigger';

/**
 * TabsContent — tab panel.
 */
const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof GoldTabsContent>
>(({ className, ...props }, ref) => (
  <GoldTabsContent ref={ref} className={cn(className)} {...props} />
));
TabsContent.displayName = 'TabsContent';

// ─── Array convenience API ────────────────────────────────────────────────────

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

export interface CanonicalTabsProps {
  tabs: TabItem[];
  /** Default selected tab (uncontrolled) */
  defaultValue?: string;
  /** Controlled active tab */
  value?: string;
  /** Called when active tab changes (controlled mode) */
  onValueChange?: (_value: string) => void;
  /** Visual variant: 'underline' (default) or 'segmented' */
  variant?: TabsVariant;
  /** Additional class on the root Tabs element */
  className?: string;
  /** Additional class on the TabsList */
  listClassName?: string;
}

/**
 * CanonicalTabs — array convenience API.
 *
 * Renders a complete tab set from a `tabs` array.
 * Supports both controlled (value + onValueChange) and uncontrolled (defaultValue) modes.
 *
 * @example
 * // Uncontrolled
 * <CanonicalTabs
 *   tabs={[
 *     { value: 'a', label: 'Alpha', content: <p>Alpha content</p> },
 *     { value: 'b', label: 'Beta', content: <p>Beta content</p> },
 *   ]}
 * />
 *
 * @example
 * // Controlled
 * const [tab, setTab] = useState('a');
 * <CanonicalTabs tabs={tabs} value={tab} onValueChange={setTab} />
 *
 * @example
 * // Segmented variant
 * <CanonicalTabs variant="segmented" tabs={modeSwitchTabs} />
 */
export const CanonicalTabs = ({
  tabs,
  defaultValue,
  value,
  onValueChange,
  variant = 'underline',
  className,
  listClassName,
}: CanonicalTabsProps) => {
  const [internalActive, setInternalActive] = useState(defaultValue ?? tabs[0]?.value);
  const isControlled = value !== undefined;
  const activeTab = isControlled ? value : internalActive;

  const handleValueChange = (next: string) => {
    if (!isControlled) setInternalActive(next);
    onValueChange?.(next);
  };

  return (
    <Tabs
      variant={variant}
      value={activeTab}
      onValueChange={handleValueChange}
      className={className}
    >
      <TabsList aria-label="Tabs" className={listClassName}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.icon && (
              <span className="inline-flex items-center mr-2" aria-hidden="true">
                {tab.icon}
              </span>
            )}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
};

// Re-export primitives for composable usage
export { Tabs, TabsList, TabsTrigger, TabsContent };
