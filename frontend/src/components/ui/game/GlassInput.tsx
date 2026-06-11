/**
 * GlassInput — Frosted glass text input (Story 22-6)
 *
 * @deprecated Prefer the canonical form control: `import { Input } from '@/components/ui/form'`.
 * Kept for the game/ layer barrel API; no production consumers remain (Equoria-o5hub
 * ratchet sweep, 2026-06-11). Visuals are re-platformed onto the tokenised
 * fieldStyles recipe (BASE_FIELD_CLASSES) — the legacy `.celestial-input` CSS
 * class is no longer referenced.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input, type InputProps } from '@/components/ui/input';
import { BASE_FIELD_CLASSES } from '@/components/ui/form/fieldStyles';

const GlassInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <Input
      ref={ref}
      className={cn(
        BASE_FIELD_CLASSES.join(' '),
        'h-10',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className
      )}
      {...props}
    />
  )
);
GlassInput.displayName = 'GlassInput';

export type GlassInputProps = InputProps;
export { GlassInput };
