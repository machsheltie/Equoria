/**
 * FenceJumpBar Component — Story 18-2
 *
 * A thematic XP/progress bar where a tiny horse icon jumps over
 * fence markers at 25/50/75/100% milestones.
 *
 * - Fence markers: thin gold dividers at threshold positions
 * - Horse icon: follows current value, jumps when crossing a threshold
 * - Jump animation: fence-jump keyframe (defined in index.css)
 * - Fill track: celestial-primary gradient, same visual as StatBar
 */

import { useEffect, useRef, useState } from 'react';

interface FenceJumpBarProps {
  /** Progress value 0–100 */
  value: number;
  /** Accessible label for the progressbar role */
  label?: string;
  /** Show numeric value below bar */
  showValue?: boolean;
  className?: string;
}

const FENCE_THRESHOLDS = [25, 50, 75, 100] as const;

export default function FenceJumpBar({
  value,
  label,
  showValue,
  className = '',
}: FenceJumpBarProps) {
  const prevValueRef = useRef(value);
  const [isJumping, setIsJumping] = useState(false);

  // Trigger jump animation when value crosses a fence threshold
  useEffect(() => {
    const prev = prevValueRef.current;
    const crossed = FENCE_THRESHOLDS.some((t) => prev < t && value >= t);
    if (crossed) {
      setIsJumping(true);
      const timer = setTimeout(() => setIsJumping(false), 380);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
    prevValueRef.current = value;
  }, [value]);

  const clamped = Math.min(Math.max(value, 0), 100);

  return (
    <div className={`relative ${className}`}>
      {/* Outer wrapper — reference for absolute positioning of markers + icon */}
      <div className="relative h-6 w-full">
        {/* Fill track — overflow-hidden clips the fill bar */}
        <div
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label ?? `Progress: ${clamped}%`}
          className="h-full w-full overflow-hidden rounded-full bg-[rgba(15,35,70,0.5)]"
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${clamped}%`,
              background:
                'linear-gradient(90deg, var(--celestial-primary, #3b82f6), var(--celestial-secondary, #10b981))',
            }}
          />
        </div>

        {/* Fence markers and horse — positioned over the track, not clipped */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {FENCE_THRESHOLDS.map((threshold) => (
            <div
              key={threshold}
              className="absolute top-1/2 w-[2px] rounded-sm"
              style={{
                left: `${threshold}%`,
                height: '18px',
                transform: 'translateX(-50%) translateY(-50%)',
                background: 'var(--gold-500, #d4a017)',
                opacity: clamped >= threshold ? 0.9 : 0.45,
                transition: 'opacity 0.3s',
              }}
            />
          ))}

          {/* Horse icon — jumps on threshold crossing */}
          <span
            className="absolute top-1/2 text-xs leading-none select-none"
            style={{
              left: `${clamped}%`,
              transform: 'translateX(-50%) translateY(-50%)',
              animation: isJumping
                ? 'fence-jump 0.38s var(--ease-bounce, cubic-bezier(0.34,1.56,0.64,1)) forwards'
                : undefined,
              zIndex: 1,
            }}
          >
            🐎
          </span>
        </div>
      </div>

      {showValue && (
        <div className="mt-1 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
          {clamped}%
        </div>
      )}
    </div>
  );
}
