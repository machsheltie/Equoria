/** Progress — Celestial Night gold fill gradient with size variants (Task 22-6 fix) */
'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

const sizeClasses = {
  sm: 'h-2' /* 8px  — stat bars (horse attribute displays) */,
  md: 'h-3' /* 12px — XP bars, standard progress (default) */,
  lg: 'h-4' /* 16px — featured bars, hero progress displays */,
} as const;

export type ProgressSize = keyof typeof sizeClasses;

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorClassName?: string;
    /** Bar height variant: sm (8px) | md (12px, default) | lg (16px) */
    size?: ProgressSize;
    /**
     * Show the numeric value as an overlay centered on the filled portion.
     * Useful for wide bars (e.g. training score, competition result).
     */
    showValue?: boolean;
    /** Label for the numeric overlay (e.g. "%" suffix). Defaults to empty. */
    valueSuffix?: string;
  }
>(
  (
    {
      className,
      value,
      indicatorClassName,
      size = 'md',
      showValue = false,
      valueSuffix = '',
      ...props
    },
    ref
  ) => (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        'relative w-full overflow-hidden rounded-full',
        sizeClasses[size],
        'bg-[var(--bg-midnight)]',
        'border border-[rgba(100,130,165,0.2)]',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full flex-1 transition-all duration-500 relative',
          'bg-gradient-to-r from-[var(--gold-dim)] to-[var(--gold-light)]',
          (value ?? 0) >= 100 ? 'shadow-[0_0_8px_rgba(201,162,39,0.6)]' : '',
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      >
        {showValue && (
          <span
            className="absolute right-1 top-1/2 -translate-y-1/2 text-[0.6rem] font-semibold leading-none tabular-nums select-none"
            style={{
              color: 'var(--bg-deep-space)',
              textShadow: 'none',
              fontFamily: 'var(--font-body)',
            }}
          >
            {value ?? 0}
            {valueSuffix}
          </span>
        )}
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  )
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
