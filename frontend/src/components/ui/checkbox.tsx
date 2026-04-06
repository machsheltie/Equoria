/** Checkbox — Naked Radix forwarder. Visual styling lives in game/GameCheckbox.tsx (Story 22-6) */
import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root ref={ref} className={className} {...props}>
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      <Check className="h-3.5 w-3.5 stroke-[3]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
