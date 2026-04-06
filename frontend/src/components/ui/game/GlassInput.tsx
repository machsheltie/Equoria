/**
 * GlassInput — Frosted glass text input (Story 22-6)
 *
 * Owns all visual styling for text inputs. Naked input.tsx is a plain forwarder.
 * Visual: celestial-input CSS class (var(--glass-bg) background, var(--glass-border) border,
 * gold focus ring, var(--text-muted) placeholder).
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input, type InputProps } from '@/components/ui/input';

const GlassInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <Input
      ref={ref}
      className={cn(
        'celestial-input',
        'rounded-[var(--radius-md)] px-3 py-2 h-10 text-sm',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
GlassInput.displayName = 'GlassInput';

export type GlassInputProps = InputProps;
export { GlassInput };
