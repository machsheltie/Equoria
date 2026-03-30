/**
 * CrescentDecoration — decorative gold crescent/moon SVG element (FR-CN2)
 *
 * Used as a visual accent on panel headers, section dividers, and modal titles.
 * Renders a filled crescent moon shape using overlapping circles in the Celestial Night theme.
 *
 * Props:
 *   size      — overall diameter in px (default: 24)
 *   color     — fill color CSS value (default: var(--gold-primary))
 *   className — additional classes for layout positioning
 *   aria-hidden — defaults to true (purely decorative)
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface CrescentDecorationProps {
  /** Diameter in px */
  size?: number;
  /** Fill color — any CSS value or token */
  color?: string;
  /** Additional Tailwind/CSS classes */
  className?: string;
  /** Defaults to true — override only if semantically meaningful */
  'aria-hidden'?: boolean | 'true' | 'false';
}

const CrescentDecoration: React.FC<CrescentDecorationProps> = ({
  size = 24,
  color = 'var(--gold-primary)',
  className,
  'aria-hidden': ariaHidden = true,
}) => {
  // Crescent formed by two overlapping circles:
  // Outer circle fills the full viewBox; inner circle (mask) punches out the negative space.
  // The inner circle is offset right to create the crescent bite.
  const r = size / 2;
  const offset = size * 0.28; // how far right the masking circle is displaced

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('inline-block shrink-0', className)}
      aria-hidden={ariaHidden}
    >
      <defs>
        <mask id={`crescent-mask-${size}`}>
          {/* White = show, black = hide */}
          <circle cx={r} cy={r} r={r} fill="white" />
          <circle cx={r + offset} cy={r - offset * 0.4} r={r * 0.72} fill="black" />
        </mask>
      </defs>
      <circle cx={r} cy={r} r={r} fill={color} mask={`url(#crescent-mask-${size})`} opacity={0.9} />
    </svg>
  );
};

export default CrescentDecoration;
