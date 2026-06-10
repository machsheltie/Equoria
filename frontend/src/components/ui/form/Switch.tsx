/**
 * Switch — Accessible button[role=switch] implementation (Equoria-o5hub.12 / D-13)
 *
 * @radix-ui/react-switch is NOT installed (checked package.json). Using the same
 * accessible button[role=switch] pattern as the settings Toggle (constants.tsx),
 * but as a standalone headless primitive.
 *
 * Visual: pill track (--radius-full), --glass-bg unchecked / --gold-primary checked,
 * thumb translates on state change. Matches Toggle in constants.tsx appearance.
 * Does NOT modify constants.tsx.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** aria-label is required for standalone Switch (no wrapping label) */
  'aria-label'?: string;
  /** aria-labelledby as alternative to aria-label */
  'aria-labelledby'?: string;
  className?: string;
  id?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked: controlledChecked,
      defaultChecked = false,
      onCheckedChange,
      disabled = false,
      className,
      ...ariaProps
    },
    ref
  ) => {
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : internalChecked;

    const handleClick = () => {
      if (disabled) return;
      const next = !checked;
      if (!isControlled) setInternalChecked(next);
      onCheckedChange?.(next);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          // Track
          'relative inline-flex h-5 w-9 shrink-0',
          'rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out',
          // Focus ring
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-[var(--gold-primary)]',
          'focus-visible:ring-offset-2',
          'focus-visible:ring-offset-[var(--bg-deep-space)]',
          // Checked/unchecked track colors
          checked ? 'bg-[var(--gold-primary)]' : 'bg-[rgba(148,163,184,0.25)]',
          // Disabled
          'disabled:opacity-40 disabled:cursor-not-allowed',
          className
        )}
        {...ariaProps}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full',
            'bg-[var(--bg-deep-space)]',
            'shadow transition-transform duration-200 ease-in-out',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
