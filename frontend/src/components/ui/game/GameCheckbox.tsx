/**
 * GameCheckbox — Gold checkmark checkbox (Story 22-6)
 *
 * Owns all visual styling for checkboxes. Naked checkbox.tsx is the Radix forwarder.
 * Visual: gold checkmark SVG on check, navy bg (--celestial-navy-800),
 * --gold-bright focus ring. Gold bg when checked.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import type * as CheckboxPrimitive from '@radix-ui/react-checkbox';

const GameCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <Checkbox
    ref={ref}
    className={cn(
      'peer h-5 w-5 shrink-0 rounded-sm',
      'border border-[var(--checkbox-border-color)]',
      'bg-[var(--celestial-navy-800)]',
      'transition-colors duration-150',
      'data-[state=checked]:bg-[var(--gold-700)] data-[state=checked]:border-[var(--gold-500)]',
      'focus-visible:outline-none focus-visible:ring-2',
      'focus-visible:ring-[var(--gold-bright)] focus-visible:ring-offset-1',
      'focus-visible:ring-offset-[var(--bg-deep-space)]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
GameCheckbox.displayName = 'GameCheckbox';

export { GameCheckbox };
