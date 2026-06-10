/**
 * NumberInput — Input[type=number] with optional stepper buttons (Equoria-o5hub.12 / D-13)
 *
 * Optional inc/dec stepper buttons at 44px touch targets.
 * Clamping to [min, max] happens on blur and on stepper click.
 * step prop threads through to both the native input and the stepper delta.
 */
import * as React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BASE_FIELD_CLASSES } from './fieldStyles';

export interface NumberInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange'
> {
  /** Show +/− stepper buttons alongside the input */
  showSteppers?: boolean;
  min?: number;
  max?: number;
  step?: number;
  value?: number | string;
  onChange?: (value: number | string) => void;
}

function clampValue(value: number, min?: number, max?: number): number {
  let v = value;
  if (min !== undefined && v < min) v = min;
  if (max !== undefined && v > max) v = max;
  return v;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    { className, showSteppers = false, min, max, step = 1, value, onChange, onBlur, ...props },
    ref
  ) => {
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const raw = parseFloat(e.target.value);
      if (!isNaN(raw)) {
        const clamped = clampValue(raw, min, max);
        if (clamped !== raw) {
          onChange?.(clamped);
        }
      }
      onBlur?.(e);
    };

    const handleStep = (direction: 1 | -1) => {
      const current = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
      const next = isNaN(current)
        ? direction > 0
          ? (min ?? 0) + step
          : (max ?? 0) - step
        : clampValue(current + direction * step, min, max);
      onChange?.(next);
    };

    const stepperButtonClass = cn(
      'flex items-center justify-center',
      'min-h-[22px] w-7',
      'text-[var(--text-muted)] hover:text-[var(--gold-primary)]',
      'transition-colors duration-150',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold-primary)]',
      'disabled:opacity-40 disabled:cursor-not-allowed'
    );

    const inputElement = (
      <input
        ref={ref}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={handleBlur}
        className={cn(
          BASE_FIELD_CLASSES.join(' '),
          // Hide browser spinners — we have our own
          showSteppers &&
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          showSteppers && 'rounded-r-none border-r-0',
          className
        )}
        {...props}
      />
    );

    if (!showSteppers) return inputElement;

    return (
      <div className="flex">
        {inputElement}
        <div
          className={cn(
            'flex flex-col shrink-0',
            'border border-l-0 border-[var(--glass-border)]',
            'rounded-r-[var(--radius-md)]',
            'bg-[var(--glass-bg)]',
            'overflow-hidden'
          )}
        >
          <button
            type="button"
            aria-label="Increment"
            onClick={() => handleStep(1)}
            disabled={max !== undefined && Number(value) >= max}
            className={cn(stepperButtonClass, 'border-b border-[var(--glass-border)]')}
          >
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Decrement"
            onClick={() => handleStep(-1)}
            disabled={min !== undefined && Number(value) <= min}
            className={stepperButtonClass}
          >
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }
);
NumberInput.displayName = 'NumberInput';

export { NumberInput };
