/**
 * GlassTextarea — Frosted glass multiline input (Story 22-6)
 *
 * @deprecated Prefer the canonical form control: `import { Textarea } from '@/components/ui/form'`.
 * Kept for the game/ layer barrel API; no production consumers remain (Equoria-o5hub
 * ratchet sweep, 2026-06-11). Visuals are re-platformed onto the tokenised
 * fieldStyles recipe (BASE_FIELD_CLASSES) — the legacy `.celestial-input` CSS
 * class is no longer referenced. Matches GlassInput styling; resizable vertically only.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { BASE_FIELD_CLASSES } from '@/components/ui/form/fieldStyles';

const GlassTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <Textarea
      ref={ref}
      className={cn(BASE_FIELD_CLASSES.join(' '), 'min-h-[80px] resize-y', className)}
      {...props}
    />
  )
);
GlassTextarea.displayName = 'GlassTextarea';

export type GlassTextareaProps = TextareaProps;
export { GlassTextarea };
