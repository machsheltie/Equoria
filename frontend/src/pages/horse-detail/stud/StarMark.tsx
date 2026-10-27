/**
 * A small gold five-point star: the stud plaque's mark and, for now, the
 * breeding notifications' icon (owner ruling q110, 2026-10-27).
 */

import React from 'react';

export const StarMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className ?? 'stud-star'}
    viewBox="0 0 20 20"
    width="16"
    height="16"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M10 1.6l2.47 5.2 5.7.72-4.2 3.94 1.08 5.64L10 14.34 4.95 17.1l1.08-5.64-4.2-3.94 5.7-.72z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0.6"
      strokeLinejoin="round"
    />
  </svg>
);

export default StarMark;
