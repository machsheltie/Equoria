/**
 * Select — Styled native <select> with unified field recipe (Equoria-o5hub.12 / D-13)
 *
 * @radix-ui/react-select is NOT installed (checked package.json). Using a styled
 * native <select> with the canonical field recipe. A future Radix-backed upgrade can
 * swap this without changing the external API.
 *
 * The native <select> is styled with the same glass/gold tokens as Input.
 * The chevron arrow is injected via the style prop to avoid twMerge colliding
 * the SVG data-URI background-image with bg-[var(--glass-bg)] from fieldStyles.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { BASE_FIELD_CLASSES } from './fieldStyles';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[];
  placeholder?: string;
}

// SVG chevron data-URI for the custom dropdown arrow (gold, 12×12)
const CHEVRON_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23c8a84e' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\") no-repeat right 0.75rem center";

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, style, children, options, placeholder, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        BASE_FIELD_CLASSES.join(' '),
        'appearance-none',
        'pr-8',
        '[&>option]:bg-[var(--bg-midnight)]',
        '[&>option]:text-[var(--text-primary)]',
        className
      )}
      style={{
        // The chevron is injected here to keep it from conflicting with
        // bg-[var(--glass-bg)] in Tailwind class merging.
        backgroundImage: CHEVRON_BG,
        ...style,
      }}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  )
);
Select.displayName = 'FormSelect';

export { Select };
