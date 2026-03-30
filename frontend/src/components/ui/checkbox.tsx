/** Checkbox — Celestial Night gold checkmark, navy bg (Task 22-6) */
import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-5 w-5 shrink-0 rounded-sm',
      'border border-[rgba(100,130,165,0.5)]',
      'bg-[var(--celestial-navy-800)]',
      'transition-colors duration-150',
      // Checked state — gold bg
      'data-[state=checked]:bg-[var(--gold-700)] data-[state=checked]:border-[var(--gold-500)]',
      // Focus ring
      'focus-visible:outline-none focus-visible:ring-2',
      'focus-visible:ring-[var(--gold-bright)] focus-visible:ring-offset-1',
      'focus-visible:ring-offset-[var(--bg-deep-space)]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-[var(--celestial-navy-900)]">
      <Check className="h-3.5 w-3.5 stroke-[3]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
