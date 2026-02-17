/**
 * GroomPersonalityBadge Component
 *
 * Compact badge showing a groom's personality type with icon, label,
 * and tooltip description. Used in marketplace cards and dashboard listings.
 */

import React from 'react';
import { getPersonalityInfo } from '../../types/groomPersonality';

interface GroomPersonalityBadgeProps {
  personality: string;
  /** Show the description as a native tooltip */
  showTooltip?: boolean;
  /** Badge size variant */
  size?: 'sm' | 'md';
}

const GroomPersonalityBadge: React.FC<GroomPersonalityBadgeProps> = ({
  personality,
  showTooltip = true,
  size = 'sm',
}) => {
  const info = getPersonalityInfo(personality);

  const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeClass} ${info.badgeClass}`}
      aria-label={`Personality: ${info.label}`}
      title={showTooltip ? info.description : undefined}
      data-testid="personality-badge"
    >
      <span role="img" aria-hidden="true">
        {info.icon}
      </span>
      <span>{info.label}</span>
    </span>
  );
};

export default GroomPersonalityBadge;
