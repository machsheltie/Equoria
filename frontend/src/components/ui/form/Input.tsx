/**
 * Input — Canonical styled text input (Equoria-o5hub.12 / D-13)
 *
 * Visual recipe from fieldStyles.ts (celestial-input derived, fully tokenised).
 * Extends the naked input.tsx forwarder with the unified field look.
 * Consumers in pages will import from @/components/ui/form, NOT from @/components/ui/input
 * (the naked forwarder stays untouched for the game/ layer consumers).
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { BASE_FIELD_CLASSES } from './fieldStyles';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        BASE_FIELD_CLASSES.join(' '),
        // File input needs less padding
        type === 'file' && 'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'FormInput';

export { Input };
