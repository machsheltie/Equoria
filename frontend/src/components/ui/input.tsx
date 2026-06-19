/** Input — Naked Radix forwarder. Canonical styled control: ui/form/Input.tsx (D-13). */
import * as React from 'react';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={className} ref={ref} {...props} />
  )
);
Input.displayName = 'Input';

export { Input };
