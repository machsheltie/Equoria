/** Tabs — Celestial Night gold underline indicator (Task 22-6) */
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center justify-start gap-1',
      'border-b border-[rgba(201,162,39,0.2)] w-full',
      'bg-transparent',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative inline-flex items-center justify-center whitespace-nowrap',
      'px-4 py-2.5 text-sm font-medium',
      'font-[var(--font-heading)] text-[var(--text-muted)]',
      'transition-colors duration-150',
      'hover:text-[var(--cream)]',
      // Gold underline on active
      'data-[state=active]:text-[var(--gold-400)]',
      'data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px]',
      'data-[state=active]:after:left-0 data-[state=active]:after:right-0',
      'data-[state=active]:after:h-[2px] data-[state=active]:after:bg-[var(--gold-500)]',
      'data-[state=active]:after:rounded-full',
      // Focus
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--electric-blue-300)]',
      'disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--electric-blue-300)]',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
