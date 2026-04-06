/** ScrollArea — Naked Radix forwarder. Visual styling lives in game/GameScrollArea.tsx (Story 22-6) */
import * as React from 'react';

export type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement>;

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  )
);
ScrollArea.displayName = 'ScrollArea';

export { ScrollArea };
