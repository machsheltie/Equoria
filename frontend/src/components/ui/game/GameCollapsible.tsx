/**
 * GameCollapsible — Chevron-animated collapsible with glass content area (Story 22-6)
 *
 * Owns all visual styling for collapsibles. Naked collapsible.tsx is the Radix forwarder.
 * Visual: chevron icon rotates 180° on open (CSS 200ms), content area uses glass-panel-subtle.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import type * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

const GameCollapsible = Collapsible;

const GameCollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleTrigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleTrigger>
>(({ className, children, ...props }, ref) => (
  <CollapsibleTrigger
    ref={ref}
    className={cn(
      'flex w-full items-center justify-between',
      'text-[var(--cream)] font-[var(--font-body)] text-sm font-medium',
      'hover:text-[var(--gold-400)] transition-colors duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-bright)]',
      '[&[data-state=open]>svg]:rotate-180',
      className
    )}
    {...props}
  >
    {children}
  </CollapsibleTrigger>
));
GameCollapsibleTrigger.displayName = 'GameCollapsibleTrigger';

const GameCollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(({ className, ...props }, ref) => (
  <CollapsibleContent
    ref={ref}
    className={cn(
      'glass-panel-subtle overflow-hidden',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      'data-[state=closed]:slide-up-from-top-2 data-[state=open]:slide-down-from-top-2',
      className
    )}
    {...props}
  />
));
GameCollapsibleContent.displayName = 'GameCollapsibleContent';

export { GameCollapsible, GameCollapsibleTrigger, GameCollapsibleContent };
