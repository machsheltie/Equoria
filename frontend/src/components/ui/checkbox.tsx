/**
 * Checkbox — native checkbox primitive (Equoria-rkgq9.4, was @radix-ui/react-checkbox).
 *
 * Naked forwarder: renders a button[role=checkbox][aria-checked] (matching Radix's
 * rendered semantics) plus a visually-hidden real <input type=checkbox> for native
 * form participation / a11y tree, with a Check indicator overlay. Visual styling lives
 * in game/GameCheckbox.tsx and form/Checkbox.tsx (Story 22-6).
 *
 * Public API is identical to the prior Radix forwarder: controlled `checked`
 * (boolean | 'indeterminate'), uncontrolled `defaultChecked`, `onCheckedChange`,
 * `disabled`, `required`, `name`, `value`, `id`, ref to the button, `data-state`
 * ("checked" | "unchecked" | "indeterminate"), and the `data-[state=...]` Tailwind hooks.
 */
import * as React from 'react';
import { Check, Minus } from 'lucide-react';

export type CheckedState = boolean | 'indeterminate';

export interface CheckboxProps extends Omit<
  React.ComponentPropsWithoutRef<'button'>,
  'onChange' | 'checked' | 'defaultChecked' | 'type' | 'value'
> {
  checked?: CheckedState;
  defaultChecked?: CheckedState;
  onCheckedChange?: (checked: CheckedState) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
}

function dataState(checked: CheckedState): 'checked' | 'unchecked' | 'indeterminate' {
  if (checked === 'indeterminate') return 'indeterminate';
  return checked ? 'checked' : 'unchecked';
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      className,
      checked: checkedProp,
      defaultChecked,
      onCheckedChange,
      disabled,
      required,
      name,
      value = 'on',
      onClick,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const isControlled = checkedProp !== undefined;
    const [uncontrolled, setUncontrolled] = React.useState<CheckedState>(defaultChecked ?? false);
    const checked = isControlled ? (checkedProp as CheckedState) : uncontrolled;

    const inputRef = React.useRef<HTMLInputElement>(null);

    // Mirror indeterminate onto the hidden native input (the DOM property has no
    // attribute form) so assistive tech and the form value stay correct.
    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = checked === 'indeterminate';
      }
    }, [checked]);

    const toggle = React.useCallback(() => {
      if (disabled) return;
      // Radix semantics: indeterminate -> true, otherwise flip the boolean.
      const next: CheckedState = checked === 'indeterminate' ? true : !checked;
      if (!isControlled) setUncontrolled(next);
      onCheckedChange?.(next);
    }, [checked, disabled, isControlled, onCheckedChange]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      toggle();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      // Native checkbox semantics: Space toggles, Enter does NOT submit/toggle.
      if (e.key === 'Enter') {
        e.preventDefault();
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    };

    const state = dataState(checked);

    return (
      <button
        type="button"
        role="checkbox"
        ref={ref}
        aria-checked={checked === 'indeterminate' ? 'mixed' : checked}
        aria-required={required ? true : undefined}
        data-state={state}
        data-disabled={disabled ? '' : undefined}
        disabled={disabled}
        className={className}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {/* Visually-hidden real input for native form participation + a11y. */}
        <input
          ref={inputRef}
          type="checkbox"
          aria-hidden="true"
          tabIndex={-1}
          name={name}
          value={value}
          checked={checked === true}
          required={required}
          disabled={disabled}
          // Controlled by the button; onChange is a no-op to silence React warnings.
          onChange={() => {}}
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            opacity: 0,
            margin: 0,
            width: '100%',
            height: '100%',
          }}
        />
        {state !== 'unchecked' && (
          <span
            data-state={state}
            className="flex items-center justify-center text-current"
            style={{ pointerEvents: 'none' }}
          >
            {state === 'indeterminate' ? (
              <Minus className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
            )}
          </span>
        )}
      </button>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
