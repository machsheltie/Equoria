/**
 * CardGrid — canonical responsive grid for card-list pages.
 *
 * Uses auto-fill minmax so columns scale gracefully across viewports without
 * fixed breakpoint overrides: 1 col on mobile, 2 on tablet, 3-4 on desktop,
 * 5+ on ultrawide. Same min track width across Inventory, Equip, shops,
 * services, horse pickers — keeps cards-per-row consistent everywhere.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardGridProps {
  children: ReactNode;
  /** Override the min track width (default 260px). Use sparingly. */
  minTrack?: string;
  className?: string;
  'aria-label'?: string;
}

export function CardGrid({
  children,
  minTrack = '260px',
  className,
  'aria-label': ariaLabel,
}: CardGridProps) {
  return (
    <div
      className={cn('grid gap-4', className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minTrack}, 1fr))` }}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

export default CardGrid;
