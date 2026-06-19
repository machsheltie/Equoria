/** Textarea — Naked Radix forwarder. Canonical styled control: ui/form/Textarea.tsx (D-13). */
import * as React from 'react';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => <textarea className={className} ref={ref} {...props} />
);
Textarea.displayName = 'Textarea';

export { Textarea };
