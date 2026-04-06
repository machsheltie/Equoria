/** Progress — Naked Radix forwarder. Game stat bars use game/StatBar.tsx (Story 22-6) */
import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root ref={ref} className={className} value={value} {...props}>
    <ProgressPrimitive.Indicator style={{ transform: `translateX(-${100 - (value || 0)}%)` }} />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
