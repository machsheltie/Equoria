/**
 * Skeleton — primitive shimmer building blocks (D-15)
 *
 * Three named shape primitives:
 *   Skeleton.Rect   — rectangular shimmer block (the workhorse)
 *   Skeleton.Line   — single text-line shimmer (height 1em, full width by default)
 *   Skeleton.Circle — circular avatar/icon placeholder
 *
 * All three delegates to `SkeletonBase` from SkeletonCard.tsx, which owns the
 * shimmer animation and tokens. This module adds:
 *   - Ergonomic shape aliases with sensible defaults
 *   - Reduced-motion assertion: `--skeleton-shimmer-duration` is zeroed in
 *     tokens.css under prefers-reduced-motion. SkeletonBase uses this token
 *     directly via `animation: skeleton-sweep var(--skeleton-shimmer-duration)…`,
 *     so the shimmer stops automatically. This file adds no additional
 *     motion handling — the token is the single source of truth.
 *
 * Re-exports `SkeletonBase` for callers that need full control.
 *
 * Usage:
 *   import { Skeleton } from '@/components/ui/state/Skeleton';
 *
 *   <Skeleton.Rect className="h-4 w-3/4" />
 *   <Skeleton.Line />
 *   <Skeleton.Circle size={48} />
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { SkeletonBase } from '../SkeletonCard';

export { SkeletonBase };

// ── Skeleton.Rect ──────────────────────────────────────────────────────────────

interface SkeletonRectProps {
  /** Tailwind classes for size, width, etc. */
  className?: string;
  /** Corner radius. Defaults to 'md' (--radius-card). */
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  style?: React.CSSProperties;
}

function SkeletonRect({ className, rounded = 'md', style }: SkeletonRectProps) {
  return <SkeletonBase className={className} rounded={rounded} style={style} />;
}

// ── Skeleton.Line ──────────────────────────────────────────────────────────────

interface SkeletonLineProps {
  /** Width as a Tailwind class or explicit CSS value. Defaults to 'w-full'. */
  className?: string;
}

function SkeletonLine({ className }: SkeletonLineProps) {
  return <SkeletonBase className={cn('h-[1em]', className ?? 'w-full')} rounded="full" />;
}

// ── Skeleton.Circle ────────────────────────────────────────────────────────────

interface SkeletonCircleProps {
  /** Diameter in pixels. Defaults to 40. */
  size?: number;
  className?: string;
}

function SkeletonCircle({ size = 40, className }: SkeletonCircleProps) {
  return (
    <SkeletonBase
      className={cn('flex-shrink-0', className)}
      rounded="full"
      style={{ width: size, height: size }}
    />
  );
}

// ── Namespace export ───────────────────────────────────────────────────────────

export const Skeleton = {
  Rect: SkeletonRect,
  Line: SkeletonLine,
  Circle: SkeletonCircle,
} as const;

export default Skeleton;
