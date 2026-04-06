/**
 * GoldTabs — Transparent tab list with animated gold underline indicator (Story 22-6)
 *
 * Owns all visual styling for tabs. Naked tabs.tsx is the Radix forwarder.
 * Visual: transparent bg tab list, active tab --gold-400 + animated 2px underline (200ms ease),
 * inactive --text-muted, Cinzel font, no background-fill on active.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const GoldTabs = Tabs;

const GoldTabsList = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof TabsList>
>(({ className, ...props }, ref) => (
  <TabsList
    ref={ref}
    className={cn(
      'inline-flex items-center justify-start gap-1',
      'border-b border-[var(--dialog-header-border)] w-full',
      'bg-transparent',
      className
    )}
    {...props}
  />
));
GoldTabsList.displayName = 'GoldTabsList';

const GoldTabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof TabsTrigger>
>(({ className, ...props }, ref) => (
  <TabsTrigger
    ref={ref}
    className={cn(
      'relative inline-flex items-center justify-center whitespace-nowrap',
      'px-4 py-2.5 text-sm font-medium',
      'font-[var(--font-heading)] text-[var(--text-muted)]',
      'transition-colors duration-150',
      'hover:text-[var(--cream)]',
      'data-[state=active]:text-[var(--gold-400)]',
      'data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px]',
      'data-[state=active]:after:left-0 data-[state=active]:after:right-0',
      'data-[state=active]:after:h-[2px] data-[state=active]:after:bg-[var(--gold-500)]',
      'data-[state=active]:after:rounded-full',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)]',
      'disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
));
GoldTabsTrigger.displayName = 'GoldTabsTrigger';

const GoldTabsContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof TabsContent>
>(({ className, ...props }, ref) => (
  <TabsContent
    ref={ref}
    className={cn(
      'mt-4',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)]',
      className
    )}
    {...props}
  />
));
GoldTabsContent.displayName = 'GoldTabsContent';

export { GoldTabs, GoldTabsList, GoldTabsTrigger, GoldTabsContent };
