/**
 * ScoreBreakdownRadar (Epic 27-4)
 *
 * Recharts RadarChart with Celestial Night styling:
 *  - Navy background, gold data line for current horse
 *  - Electric-blue reference line for personal best (optional)
 *  - Responsive container, accessible title/description
 *
 * Props:
 *  - stats: Record<string, number> — current horse stats
 *  - personalBest?: Record<string, number> — personal best scores (electric-blue reference)
 *  - maxValue?: number — radar axis max (default 100)
 *  - title?: string
 */

import React from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ScoreBreakdownRadarProps {
  stats: Record<string, number>;
  personalBest?: Record<string, number>;
  maxValue?: number;
  title?: string;
  height?: number;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

const CelestialTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass-panel-heavy rounded-lg p-3 text-xs border border-[rgba(201,162,39,0.25)] min-w-[100px]">
      <p className="text-[var(--gold-400)] font-semibold mb-1 font-[var(--font-heading)]">
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[var(--text-muted)] font-[var(--font-body)]">{entry.name}:</span>
          <span className="text-[var(--cream)] font-bold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

export function ScoreBreakdownRadar({
  stats,
  personalBest,
  maxValue = 100,
  title,
  height = 280,
}: ScoreBreakdownRadarProps) {
  const chartId = `radar-${Math.random().toString(36).slice(2, 7)}`;

  // Build unified data array for all stat keys
  const keys = Object.keys(stats);
  const data = keys.map((key) => {
    const point: Record<string, string | number> = {
      subject: key.charAt(0).toUpperCase() + key.slice(1),
      Current: stats[key] ?? 0,
    };
    if (personalBest) {
      point['Personal Best'] = personalBest[key] ?? 0;
    }
    return point;
  });

  return (
    <figure aria-labelledby={title ? `${chartId}-title` : undefined} className="w-full">
      {title && (
        <figcaption
          id={`${chartId}-title`}
          className="text-sm text-[var(--cream)] font-semibold font-[var(--font-heading)] mb-2 text-center"
        >
          {title}
        </figcaption>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid gridType="polygon" stroke="rgba(100,130,165,0.2)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fill: 'var(--text-muted, #6b8093)',
              fontSize: 10,
              fontFamily: 'var(--font-body, Inter, sans-serif)',
            }}
          />
          <PolarRadiusAxis domain={[0, maxValue]} tick={false} axisLine={false} />

          {/* Personal best (electric blue — rendered first so gold sits on top) */}
          {personalBest && (
            <Radar
              name="Personal Best"
              dataKey="Personal Best"
              stroke="rgba(30,100,200,0.7)"
              fill="rgba(30,100,200,0.1)"
              fillOpacity={1}
              strokeWidth={1.5}
              dot={false}
            />
          )}

          {/* Current scores (gold) */}
          <Radar
            name="Current"
            dataKey="Current"
            stroke="var(--gold-400, #c9a227)"
            fill="rgba(201,162,39,0.18)"
            fillOpacity={1}
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--gold-400, #c9a227)', stroke: 'transparent' }}
          />

          <Tooltip content={<CelestialTooltip />} />

          {personalBest && (
            <Legend
              wrapperStyle={{
                fontSize: '10px',
                color: 'var(--text-muted, #6b8093)',
                fontFamily: 'var(--font-body, Inter, sans-serif)',
              }}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </figure>
  );
}

export default ScoreBreakdownRadar;
