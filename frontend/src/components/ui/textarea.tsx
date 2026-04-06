/** Textarea — Naked Radix forwarder. Visual styling lives in game/GlassTextarea.tsx (Story 22-6) */
import * as React from 'react';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => <textarea className={className} ref={ref} {...props} />
);
Textarea.displayName = 'Textarea';

export { Textarea };
