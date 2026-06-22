/**
 * StatBar — Game-native stat progress bar (Story 22-6)
 *
 * Audit criteria (all three pass):
 *  ✅ Fill: gold gradient from-[var(--gold-primary)] to-[var(--gold-light)]
 *  ✅ Track: var(--bg-midnight) background
 *  ✅ Glow: box-shadow activates when value >= max (uses --glow-stat-max token)
 *
 * All colours use CSS custom property tokens — no raw rgba literals (spec AC).
 * Native role=progressbar markup for accessibility (replaces @radix-ui/react-progress, Equoria-rkgq9.6).
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

const sizeMap = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
} as const;

export interface StatBarProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatBar({
  label,
  value,
  max = 100,
  unit = '',
  showValue = true,
  size = 'md',
  className,
}: StatBarProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  const atMax = clamped >= max;

  return (
    <div className={cn('flex items-center gap-2 w-full', className)}>
      <span className="text-xs shrink-0 w-20 truncate text-[var(--text-secondary)]">{label}</span>

      <div
        role="progressbar"
        className={cn(
          'relative flex-1 overflow-hidden rounded-full',
          sizeMap[size],
          'bg-[var(--bg-midnight)]',
          'border border-[var(--stat-bar-track-border)]'
        )}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-label={label}
      >
        <div
          className={cn(
            'h-full transition-all duration-500',
            'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)]',
            atMax && 'shadow-[var(--glow-stat-max)]'
          )}
          style={{ transform: `translateX(-${100 - pct}%)` }}
        />
      </div>

      {showValue && (
        <span className="text-xs shrink-0 w-10 text-right tabular-nums text-[var(--text-primary)]">
          {clamped}
          {unit}
        </span>
      )}
    </div>
  );
}

export default StatBar;
