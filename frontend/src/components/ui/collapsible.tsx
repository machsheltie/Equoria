/** Collapsible — Naked Radix forwarder. Visual styling lives in game/GameCollapsible.tsx (Story 22-6) */
import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleTrigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleTrigger>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleTrigger ref={ref} className={className} {...props}>
    {children}
  </CollapsiblePrimitive.CollapsibleTrigger>
));
CollapsibleTrigger.displayName = CollapsiblePrimitive.CollapsibleTrigger.displayName;

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(({ className, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleContent ref={ref} className={className} {...props} />
));
CollapsibleContent.displayName = CollapsiblePrimitive.CollapsibleContent.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
