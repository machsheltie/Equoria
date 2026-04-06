/** Label — Naked Radix forwarder. Visual styling lives in game/GameLabel.tsx (Story 22-6) */
import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={className} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
