import React from 'react';
import { cn } from '@/lib/utils';

interface Point {
  x: number;
  y: number;
}

// Simplified horse constellation points (normalized 0-100)
const HORSE_POINTS: Point[] = [
  { x: 70, y: 20 }, // Nose
  { x: 60, y: 15 }, // Forehead
  { x: 55, y: 10 }, // Ear tip
  { x: 50, y: 20 }, // Jaw
  { x: 40, y: 30 }, // Neck top
  { x: 45, y: 50 }, // Neck bottom/Chest
  { x: 30, y: 40 }, // Wither
  { x: 20, y: 50 }, // Back
  { x: 10, y: 45 }, // Rump
  { x: 5, y: 60 }, // Tail start
  { x: 40, y: 70 }, // Front leg knee
  { x: 35, y: 90 }, // Front hoof
  { x: 15, y: 75 }, // Back leg hock
  { x: 10, y: 95 }, // Back hoof
];

// Connections between points to form shape
const CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [1, 3],
  [3, 5],
  [1, 4],
  [4, 6],
  [6, 7],
  [7, 8],
  [8, 9],
  [5, 10],
  [10, 11],
  [8, 12],
  [12, 13],
  [6, 5], // Neck/Chest connection
  [5, 7], // Chest/Body connection
];

interface ConstellationProps {
  className?: string;
  opacity?: number;
}

export const Constellation: React.FC<ConstellationProps> = ({ className, opacity = 0.3 }) => {
  return (
    <div className={cn('absolute inset-0 pointer-events-none z-[-1]', className)}>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full opacity-0 animate-fade-in-slow"
        style={{ animationDuration: '3s', opacity }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connecting Lines */}
        {CONNECTIONS.map(([startIdx, endIdx], i) => {
          const start = HORSE_POINTS[startIdx];
          const end = HORSE_POINTS[endIdx];
          return (
            <line
              key={`line-${i}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="white"
              strokeWidth="0.2"
              strokeOpacity="0.4"
              className="animate-draw"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          );
        })}

        {/* Stars */}
        {HORSE_POINTS.map((point, i) => (
          <g key={`star-${i}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="0.8"
              fill="white"
              filter="url(#glow)"
              className="animate-pulse"
              style={{ animationDuration: `${2 + Math.random() * 2}s` }}
            />
            {/* Larger glow for key points */}
            {[0, 2, 6, 8, 11, 13].includes(i) && (
              <circle
                cx={point.x}
                cy={point.y}
                r="0.3"
                fill="#FACC15" // Celestial gold
                className="animate-twinkle"
              />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
