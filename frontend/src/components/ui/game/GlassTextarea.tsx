/**
 * GlassTextarea — Frosted glass multiline input (Story 22-6)
 *
 * Owns all visual styling for textarea inputs. Naked textarea.tsx is a plain forwarder.
 * Matches GlassInput styling exactly. Resizable vertically only.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';

const GlassTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <Textarea
      ref={ref}
      className={cn(
        'celestial-input',
        'rounded-lg px-3 py-2 min-h-[80px] text-sm resize-y',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
GlassTextarea.displayName = 'GlassTextarea';

export type GlassTextareaProps = TextareaProps;
export { GlassTextarea };
