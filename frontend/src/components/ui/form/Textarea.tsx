/**
 * Textarea — Canonical styled multiline input (Equoria-o5hub.12 / D-13)
 *
 * Same visual recipe as Input (celestial-input derived, tokenised).
 * Defaults to resize-y. Extends the naked textarea.tsx forwarder.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { baseFieldClasses } from './fieldStyles';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(baseFieldClasses.join(' '), 'min-h-[80px]', 'resize-y', className)}
      {...props}
    />
  )
);
Textarea.displayName = 'FormTextarea';

export { Textarea };
