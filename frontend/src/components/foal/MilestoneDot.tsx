/**
 * MilestoneDot Component
 *
 * Custom Recharts dot component for milestone timeline visualization.
 * Color-coded dots indicate milestone status: completed (green), current (blue), pending (gray).
 *
 * Story 6-2: Foal Milestone Timeline - Subcomponent
 */

import React from 'react';

/**
 * Props passed by Recharts to custom dot components
 */
export interface MilestoneDotProps {
  cx?: number; // Center X coordinate
  cy?: number; // Center Y coordinate
  payload?: {
    completed: boolean;
    current: boolean;
    status: 'completed' | 'current' | 'pending';
    name: string;
  };
  dataKey?: string;
  index?: number;
}

/**
 * Get dot fill color based on milestone status
 */
function getDotColor(completed: boolean, current: boolean): string {
  if (completed) return '#10b981'; // green-500 - completed
  if (current) return '#3b82f6'; // blue-500 - current
  return '#9ca3af'; // gray-400 - pending
}

/**
 * MilestoneDot Component
 *
 * Custom dot for Recharts Line chart representing milestone status
 */
const MilestoneDot: React.FC<MilestoneDotProps> = (props) => {
  const { cx, cy, payload } = props;

  // Return null if no position data
  if (cx === undefined || cy === undefined || !payload) {
    return null;
  }

  const { completed = false, current = false, name = '' } = payload;
  const fill = getDotColor(completed, current);

  // Larger dot for current milestone
  const radius = current ? 8 : 6;

  return (
    <g>
      {/* Outer circle (white stroke for contrast) */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={fill}
        stroke="#ffffff"
        strokeWidth={2}
        className="transition-all duration-300"
      />

      {/* Inner ring for current milestone */}
      {current && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 4}
          fill="none"
          stroke={fill}
          strokeWidth={2}
          opacity={0.3}
          className="animate-pulse"
        />
      )}

      {/* Checkmark for completed milestones */}
      {completed && (
        <g>
          <path
            d={`M ${cx - 3} ${cy} L ${cx - 1} ${cy + 2} L ${cx + 3} ${cy - 2}`}
            stroke="#ffffff"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {/* Accessibility: invisible larger circle for better click target */}
      <circle
        cx={cx}
        cy={cy}
        r={radius + 6}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        aria-label={`${name} milestone`}
      />
    </g>
  );
};

export default MilestoneDot;
