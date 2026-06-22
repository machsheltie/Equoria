/**
 * Checkbox — native checkbox with canonical token recipe (Equoria-o5hub.12 / D-13)
 *
 * Restyled GameCheckbox pattern using the field recipe tokens.
 * Wraps the native checkbox.tsx forwarder (Equoria-rkgq9.4, was @radix-ui/react-checkbox).
 * Visual: --glass-bg unchecked, --gold-primary checked bg, --glass-border border,
 * gold focus ring.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Checkbox as CheckboxPrimitive } from '@/components/ui/checkbox';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive
    ref={ref}
    className={cn(
      'peer h-5 w-5 shrink-0 rounded-sm',
      // Unchecked: glass surface bg + glass border
      'bg-[var(--glass-bg)]',
      'border border-[var(--glass-border)]',
      'transition-colors duration-150',
      // Checked: gold background + gold border
      'data-[state=checked]:bg-[var(--gold-primary)]',
      'data-[state=checked]:border-[var(--gold-primary)]',
      // Checkmark color
      'text-[var(--bg-deep-space)]',
      // Focus ring — matches celestial-input gold focus
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-[var(--gold-primary)]',
      'focus-visible:ring-offset-1',
      'focus-visible:ring-offset-[var(--bg-deep-space)]',
      // Disabled
      'disabled:opacity-40',
      'disabled:cursor-not-allowed',
      className
    )}
    {...props}
  />
));
Checkbox.displayName = 'FormCheckbox';

export { Checkbox };
