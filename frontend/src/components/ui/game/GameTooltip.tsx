/**
 * GameTooltip — Glass panel tooltip (Story 22-6)
 *
 * Owns all visual styling for tooltips. Naked tooltip.tsx is the Radix forwarder.
 * Visual: --bg-midnight bg, --gold-dim border, --text-primary text.
 * No backdrop-filter (single-blur rule: only one blur layer active at a time).
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import type * as TooltipPrimitive from '@radix-ui/react-tooltip';

const GameTooltipProvider = TooltipProvider;
const GameTooltip = Tooltip;
const GameTooltipTrigger = TooltipTrigger;

const GameTooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipContent
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-[var(--z-tooltip)] max-w-[240px] px-3 py-2 text-xs',
      'bg-[var(--bg-midnight)] border border-[var(--gold-dim)] rounded-[var(--radius-md)]',
      'shadow-[var(--shadow-raised)]',
      'text-[var(--text-primary)] font-[var(--font-body)]',
      'animate-in fade-in-0 zoom-in-95',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
      'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
      'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className
    )}
    {...props}
  />
));
GameTooltipContent.displayName = 'GameTooltipContent';

export { GameTooltip, GameTooltipTrigger, GameTooltipContent, GameTooltipProvider };
