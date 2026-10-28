/**
 * StaffLevelStars: a rider's, trainer's or groom's star level — the authored
 * label followed by its stars, e.g. "Advanced ★★★★" (owner ruling 2026-10-28,
 * Equoria-nawn5). Assistive technology hears "Advanced, 4 stars": the star
 * glyphs are hidden from it and a visually hidden ", 4 stars" follows the label.
 * An unknown level reads "Unrated", never the stored word.
 */

import React from 'react';
import { staffLevelLabel, staffLevelStars } from '@/lib/staffLevels';
import '@/styles/staffLevel.css';

const StaffLevelStars: React.FC<{ level: string | null | undefined; className?: string }> = ({
  level,
  className,
}) => {
  const stars = staffLevelStars(level);
  return (
    <span
      className={className ? `staff-level ${className}` : 'staff-level'}
      data-testid="staff-level"
    >
      <span>{staffLevelLabel(level)}</span>
      {stars > 0 && (
        <>
          <span aria-hidden="true" className="staff-level__stars">
            {'★'.repeat(stars)}
          </span>
          <span className="staff-level__phrase">{`, ${stars} ${stars === 1 ? 'star' : 'stars'}`}</span>
        </>
      )}
    </span>
  );
};

export default StaffLevelStars;
