/**
 * RiderPersonalityBadge Component
 *
 * Compact badge showing a rider's personality type with icon and label.
 * Used in RiderList, MyRidersDashboard, and horse profile assigned rider display.
 *
 * Mirrors GroomPersonalityBadge.tsx for the Rider System (Epic 9C).
 */

import React from 'react';
import { getRiderPersonalityInfo } from '@/types/riderPersonality';

interface RiderPersonalityBadgeProps {
  personality: string;
  size?: 'sm' | 'md';
}

const RiderPersonalityBadge: React.FC<RiderPersonalityBadgeProps> = ({
  personality,
  size = 'md',
}) => {
  const info = getRiderPersonalityInfo(personality);

  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold ${sizeClasses} ${info.badgeClass}`}
      title={info.description}
      data-testid="rider-personality-badge"
    >
      <span>{info.icon}</span>
      <span>{info.label}</span>
    </span>
  );
};

export default RiderPersonalityBadge;
