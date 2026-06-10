/**
 * Checkbox — Radix-backed checkbox with canonical token recipe (Equoria-o5hub.12 / D-13)
 *
 * Restyled GameCheckbox pattern using the field recipe tokens.
 * Wraps the naked checkbox.tsx Radix forwarder.
 * Visual: --glass-bg unchecked, --gold-primary checked bg, --glass-border border,
 * gold focus ring.
 */
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
      // Unchecked: glass surface bg + glass border
      'bg-[var(--glass-bg)]',
      'border border-[var(--glass-border)]',
      'transition-colors duration-150',
      // Checked: gold background + gold border
      'data-[state=checked]:bg-[var(--gold-primary)]',
      'data-[state=checked]:border-[var(--gold-primary)]',
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
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-[var(--bg-deep-space)]">
      <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'FormCheckbox';

export { Checkbox };
