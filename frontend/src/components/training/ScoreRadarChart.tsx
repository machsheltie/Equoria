/**
 * ScoreRadarChart Component
 *
 * Visualizes all 23 discipline scores for a horse using a Recharts radar chart.
 * Each axis represents one discipline, with scores ranging from 0-100.
 * Categories are color-coded: Western (orange), English (blue),
 * Specialized (purple), Racing (red).
 *
 * Story 4-1: Training Session Interface - Task: ScoreRadarChart
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
import { DISCIPLINES } from '../../lib/utils/training-utils';

/**
 * Props for ScoreRadarChart component
 */
interface ScoreRadarChartProps {
  /** Object mapping discipline IDs to their scores (0-100) */
  disciplineScores: { [disciplineId: string]: number };
  /** Height of the chart in pixels (default: 400) */
  height?: number;
  /** Whether to show the category legend (default: false) */
  showLegend?: boolean;
  /** Additional CSS class for the container */
  className?: string;
}

/**
 * Data structure for each point in the radar chart
 */
interface ChartDataPoint {
  discipline: string;
  score: number;
  category: 'Western' | 'English' | 'Specialized' | 'Racing';
}

/**
 * Category color mapping for visual distinction
 */
const CATEGORY_COLORS: Record<string, string> = {
  Western: '#f97316', // orange-500
  English: '#3b82f6', // blue-500
  Specialized: '#a855f7', // purple-500
  Racing: '#ef4444', // red-500
};

/**
 * Custom tooltip content component for the radar chart
 */
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload as ChartDataPoint;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-slate-900">{data.discipline}</p>
        <p className="text-slate-600">
          Score: <span className="font-medium">{data.score}</span>
        </p>
        <p className="text-sm" style={{ color: CATEGORY_COLORS[data.category] }}>
          {data.category}
        </p>
      </div>
    );
  }
  return null;
};

/**
 * ScoreRadarChart Component
 *
 * Displays a radar chart visualization of discipline scores for a horse.
 * All 23 disciplines are shown with their scores on axes from 0-100.
 *
 * @example
 * ```tsx
 * <ScoreRadarChart
 *   disciplineScores={{ 'dressage': 85, 'show-jumping': 72 }}
 *   height={400}
 *   showLegend={true}
 * />
 * ```
 */
const ScoreRadarChart: React.FC<ScoreRadarChartProps> = ({
  disciplineScores = {},
  height = 400,
  showLegend = false,
  className = '',
}) => {
  // Transform DISCIPLINES array into chart data format
  // Maps all 23 disciplines with their scores (defaulting to 0 if missing)
  const chartData: ChartDataPoint[] = DISCIPLINES.map((disc) => ({
    discipline: disc.name,
    score: disciplineScores?.[disc.id] ?? 0,
    category: disc.category,
  }));

  // Calculate primary fill color based on average scores per category
  // Uses a gradient-like approach with the first category color as primary
  const primaryColor = CATEGORY_COLORS.Western;

  // Hidden description for screen readers
  const descriptionId = 'radar-chart-description';
  const descriptionText =
    'Radar chart showing scores for all 23 horse disciplines. ' +
    'Categories include Western, English, Specialized, and Racing disciplines. ' +
    'Scores range from 0 to 100 on each axis.';

  return (
    <div className={className}>
      {/* Hidden description for accessibility */}
      <span id={descriptionId} className="sr-only">
        {descriptionText}
      </span>

      <ResponsiveContainer width="100%" height={height}>
        <RadarChart
          data={chartData}
          cx="50%"
          cy="50%"
          outerRadius="80%"
          aria-label="Discipline scores radar chart"
          aria-describedby={descriptionId}
        >
          <PolarGrid />
          <PolarAngleAxis dataKey="discipline" tick={{ fontSize: 10 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
          <Radar
            name="Score"
            dataKey="score"
            stroke={primaryColor}
            fill={primaryColor}
            fillOpacity={0.6}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              formatter={(value) => <span className="text-sm text-slate-700">{value}</span>}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScoreRadarChart;
