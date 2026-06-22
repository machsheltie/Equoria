/** Progress — native progressbar forwarder (replaces @radix-ui/react-progress, Equoria-rkgq9.6).
 *  Game stat bars use game/StatBar.tsx (Story 22-6). */
import * as React from 'react';

const DEFAULT_MAX = 100;

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}
function isValidMax(max: unknown): max is number {
  return isNumber(max) && !isNaN(max) && max > 0;
}
function isValidValue(value: unknown, max: number): value is number {
  return isNumber(value) && !isNaN(value) && value <= max && value >= 0;
}
function getProgressState(
  value: number | null,
  maxValue: number
): 'indeterminate' | 'complete' | 'loading' {
  return value == null ? 'indeterminate' : value === maxValue ? 'complete' : 'loading';
}

export interface ProgressProps extends React.ComponentPropsWithoutRef<'div'> {
  value?: number | null;
  max?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value: valueProp = null, max: maxProp, ...props }, ref) => {
    const max = isValidMax(maxProp) ? maxProp : DEFAULT_MAX;
    const value = isValidValue(valueProp, max) ? valueProp : null;
    const state = getProgressState(value, max);
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemax={max}
        aria-valuemin={0}
        aria-valuenow={isNumber(value) ? value : undefined}
        data-state={state}
        data-value={value ?? undefined}
        data-max={max}
        className={className}
        {...props}
      >
        <div
          data-state={state}
          data-value={value ?? undefined}
          data-max={max}
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };
