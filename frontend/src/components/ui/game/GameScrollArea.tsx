/**
 * GameScrollArea — Thin gold scrollbar scroll container (Story 22-6)
 *
 * Owns all visual styling for scroll areas. Naked scroll-area.tsx is a plain forwarder.
 * Visual: scroll-area-celestial CSS class provides gold scrollbar thumb
 * (--gold-dim, hover → --gold-primary) with transparent track.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ScrollAreaProps } from '@/components/ui/scroll-area';

const GameScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => (
    <ScrollArea
      ref={ref}
      className={cn('relative overflow-auto scroll-area-celestial', className)}
      {...props}
    >
      {children}
    </ScrollArea>
  )
);
GameScrollArea.displayName = 'GameScrollArea';

export type GameScrollAreaProps = ScrollAreaProps;
export { GameScrollArea };
