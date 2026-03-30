/**
 * StatBar Component
 *
 * Reusable progress bar for displaying numeric stats (0–100 scale).
 * Fully accessible: renders with role="progressbar" and ARIA value attributes.
 * Token-driven colors — pass any CSS custom property or literal value.
 *
 * Props:
 *   label       — visible label left of bar
 *   value       — current numeric value
 *   max         — maximum value (default: 100)
 *   unit        — optional suffix appended to value (e.g. "%", " pts")
 *   fillColor   — CSS value for the filled segment (default: --celestial-primary)
 *   showValue   — show numeric value to the right of bar (default: true)
 *   size        — bar height variant: sm (4px) | md (8px, default) | lg (12px)
 *
 * Story UI-3: GlassPanel + StatBar Primitives
 */

import React from 'react';

export interface StatBarProps {
  /** Accessible label describing what this stat represents */
  label: string;
  /** Current value */
  value: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Optional unit suffix (e.g. "%", " XP") */
  unit?: string;
  /**
   * CSS value for the fill color.
   * Defaults to var(--celestial-primary).
   * Use semantic tokens: var(--status-success), var(--status-warning), etc.
   */
  fillColor?: string;
  /** Show the numeric value to the right of the bar (default: true) */
  showValue?: boolean;
  /** Bar height variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class for the container */
  className?: string;
}

const barHeights = {
  sm: '4px',
  md: '8px',
  lg: '12px',
} as const;

const StatBar: React.FC<StatBarProps> = ({
  label,
  value,
  max = 100,
  unit = '',
  fillColor = 'var(--gradient-stat-bar)',
  showValue = true,
  size = 'md',
  className = '',
}) => {
  const clamped = Math.min(Math.max(value, 0), max);
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  const barHeight = barHeights[size];

  return (
    <div className={`flex items-center gap-2 w-full ${className}`}>
      {/* Label */}
      <span className="text-xs shrink-0 w-20 truncate" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>

      {/* Track + fill */}
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{
          height: barHeight,
          background: 'var(--bg-surface)',
        }}
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: fillColor,
            transition: `width var(--duration-reveal) var(--ease-out)`,
          }}
        />
      </div>

      {/* Numeric value */}
      {showValue && (
        <span
          className="text-xs shrink-0 w-10 text-right tabular-nums"
          style={{ color: 'var(--text-primary)' }}
        >
          {clamped}
          {unit}
        </span>
      )}
    </div>
  );
};

export default StatBar;
