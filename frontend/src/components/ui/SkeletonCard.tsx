/**
 * Skeleton Loading Components
 *
 * Shape-matched shimmer placeholders for content that is loading.
 * Uses --skeleton-shimmer-* tokens for the animated gradient.
 * Animation is automatically disabled when prefers-reduced-motion is active
 * (--skeleton-shimmer-duration is zeroed in tokens.css media query).
 *
 * Exports:
 *   SkeletonBase           — raw shimmer block, composable primitive
 *   SkeletonHorseCard      — matches HorseCard layout (portrait + stats)
 *   SkeletonLocationCard   — matches LocationCard layout (painting + label)
 *   SkeletonTraitBadge     — matches TraitBadge pill shape
 *
 * Story UI-5: Skeleton Loading Screens
 */

import React from 'react';
import { cn } from '@/lib/utils';

/* ─── Base shimmer block ─────────────────────────────────────────────────── */

interface SkeletonBaseProps {
  className?: string;
  style?: React.CSSProperties;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const radiusMap = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-card)',
  lg: 'var(--radius-panel)',
  full: 'var(--radius-pill)',
} as const;

export const SkeletonBase: React.FC<SkeletonBaseProps> = ({ className, style, rounded = 'md' }) => (
  <div
    className={cn('skeleton-shimmer', className)}
    style={{
      borderRadius: radiusMap[rounded],
      background: 'var(--skeleton-base)',
      backgroundImage: `linear-gradient(
        90deg,
        var(--skeleton-shimmer-from) 0%,
        var(--skeleton-shimmer-via) 50%,
        var(--skeleton-shimmer-to) 100%
      )`,
      backgroundSize: '200% 100%',
      animation: `skeleton-sweep var(--skeleton-shimmer-duration) ease-in-out infinite`,
      ...style,
    }}
    aria-hidden="true"
  />
);

/* ─── HorseCard skeleton ─────────────────────────────────────────────────── */

export const SkeletonHorseCard: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn('flex flex-col overflow-hidden', className)}
    style={{
      borderRadius: 'var(--radius-card)',
      border: '1px solid var(--border-muted)',
      background: 'var(--glass-surface-bg)',
      minHeight: '220px',
    }}
    role="status"
    aria-label="Loading horse card"
  >
    {/* Portrait area */}
    <SkeletonBase className="flex-1" style={{ borderRadius: '0', minHeight: '140px' }} />

    {/* Info area */}
    <div className="p-3 space-y-2">
      {/* Horse name */}
      <SkeletonBase className="h-4 w-3/4" rounded="full" />
      {/* Breed / level */}
      <SkeletonBase className="h-3 w-1/2" rounded="full" />
      {/* Stat row */}
      <div className="flex gap-1 mt-1">
        {[...Array(4)].map((_, i) => (
          <SkeletonBase key={i} className="h-2 flex-1" rounded="full" />
        ))}
      </div>
    </div>
  </div>
);

/* ─── LocationCard skeleton ──────────────────────────────────────────────── */

export const SkeletonLocationCard: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn('flex flex-col overflow-hidden', className)}
    style={{
      borderRadius: 'var(--radius-card)',
      border: '1px solid var(--border-muted)',
      background: 'var(--glass-surface-bg)',
      minHeight: '220px',
    }}
    role="status"
    aria-label="Loading location card"
  >
    {/* Painting area with icon placeholder */}
    <div
      className="flex-1 flex items-center justify-center"
      style={{ minHeight: '130px', background: 'var(--bg-surface)' }}
    >
      <SkeletonBase className="w-12 h-12" rounded="full" />
    </div>

    {/* Glass label area */}
    <div
      className="px-4 pb-4 pt-3 space-y-2"
      style={{ background: 'var(--glass-surface-heavy-bg)' }}
    >
      <SkeletonBase className="h-4 w-2/3" rounded="full" />
      <SkeletonBase className="h-3 w-full" rounded="full" />
      <SkeletonBase className="h-3 w-4/5" rounded="full" />
      <SkeletonBase className="h-3 w-1/4 mt-1" rounded="full" />
    </div>
  </div>
);

/* ─── TraitBadge skeleton ────────────────────────────────────────────────── */

export const SkeletonTraitBadge: React.FC<{ className?: string }> = ({ className }) => (
  <SkeletonBase
    className={cn('h-6 w-24 inline-block', className)}
    rounded="full"
    style={{ display: 'inline-block' }}
    aria-label="Loading trait badge"
  />
);

/* ─── Default export: SkeletonHorseCard (most common use) ─────────────────── */
export default SkeletonHorseCard;
