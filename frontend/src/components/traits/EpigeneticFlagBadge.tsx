/**
 * EpigeneticFlagBadge Component
 *
 * Displays an epigenetic flag badge with color coding, icon, and tooltip.
 * Shows how a trait was acquired or expressed (stress-induced, care-influenced,
 * milestone-triggered, or genetic-only).
 *
 * Story 6-6: Epigenetic Trait System
 */

import React, { useState } from 'react';
import type { EpigeneticFlag } from '@/types/traits';
import { getEpigeneticFlagDisplay } from '@/types/traits';

export interface EpigeneticFlagBadgeProps {
  flag: EpigeneticFlag;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  showTooltip?: boolean;
}

/**
 * EpigeneticFlagBadge Component
 */
const EpigeneticFlagBadge: React.FC<EpigeneticFlagBadgeProps> = ({
  flag,
  size = 'medium',
  showLabel = true,
  showTooltip = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const flagDisplay = getEpigeneticFlagDisplay(flag);

  // Size-based styling
  const sizeClasses = {
    small: {
      badge: 'px-2 py-0.5 text-xs',
      icon: 'text-xs',
      label: 'text-xs',
      tooltip: 'text-xs',
    },
    medium: {
      badge: 'px-3 py-1 text-sm',
      icon: 'text-sm',
      label: 'text-sm',
      tooltip: 'text-sm',
    },
    large: {
      badge: 'px-4 py-2 text-base',
      icon: 'text-base',
      label: 'text-base',
      tooltip: 'text-sm',
    },
  };

  const classes = sizeClasses[size];

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Badge */}
      <span
        className={`inline-flex items-center gap-1.5 ${classes.badge} ${flagDisplay.color} rounded border font-medium`}
      >
        <span className={classes.icon}>{flagDisplay.icon}</span>
        {showLabel && <span className={classes.label}>{flagDisplay.label}</span>}
      </span>

      {/* Tooltip */}
      {showTooltip && isHovered && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64">
          <div className="bg-slate-900 text-white rounded-lg px-3 py-2 shadow-xl">
            <p className={`${classes.tooltip} leading-relaxed`}>{flagDisplay.tooltip}</p>
            {/* Tooltip arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full">
              <div className="border-8 border-transparent border-t-slate-900" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EpigeneticFlagBadge;
