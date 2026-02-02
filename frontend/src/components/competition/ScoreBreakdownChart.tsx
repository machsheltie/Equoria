/**
 * ScoreBreakdownChart Component
 *
 * Visualizes the score breakdown for a horse's competition performance
 * using a horizontal bar chart. Each bar represents a score component
 * with color coding: positive values in green, negative in red,
 * and base score in blue.
 *
 * Features:
 * - Horizontal bar chart showing each score component
 * - Color-coded bars (positive: green, negative: red, base: blue)
 * - Component labels on left with point values on bars
 * - Hover tooltips explaining each component
 * - Responsive sizing
 * - Legend explaining colors (optional)
 *
 * Story 5-2: Competition Results Display - Performance Breakdown
 */

import React, { memo, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LabelList,
  Cell,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

/**
 * Individual trait bonus in the score breakdown
 */
export interface TraitBonus {
  trait: string;
  bonus: number;
}

/**
 * Score breakdown data structure
 * Contains all components that contribute to the final competition score
 */
export interface ScoreBreakdown {
  /** Base stats contribution (speed/stamina/agility with 50/30/20 weighting) */
  baseScore: {
    speed: number;
    stamina: number;
    agility: number;
    total: number;
  };
  /** Training bonus points */
  trainingBonus: number;
  /** List of trait bonuses (can be positive or negative) */
  traitBonuses: TraitBonus[];
  /** Equipment bonus breakdown */
  equipmentBonuses: {
    saddle: number;
    bridle: number;
    total: number;
  };
  /** Rider effect (can be positive bonus or negative penalty) */
  riderEffect: number;
  /** Health modifier (percentage adjustment based on rating) */
  healthModifier: number;
  /** Random luck factor (plus or minus 9%) */
  randomLuck: number;
  /** Total final score */
  total: number;
}

/**
 * Props for ScoreBreakdownChart component
 */
export interface ScoreBreakdownChartProps {
  /** The score breakdown data to visualize */
  breakdown: ScoreBreakdown;
  /** Height of the chart in pixels (default: 300) */
  height?: number;
  /** Whether to show the legend (default: false) */
  showLegend?: boolean;
  /** Enable tooltips and hover interactions (default: true) */
  interactive?: boolean;
  /** Additional CSS class for the container */
  className?: string;
}

/**
 * Data structure for each bar in the chart
 */
interface ChartDataPoint {
  name: string;
  value: number;
  color: string;
  description: string;
}

/**
 * Color constants for different score component types
 */
const COLORS = {
  base: '#3b82f6', // blue-500
  positive: '#22c55e', // green-500
  positiveLight: '#4ade80', // green-400
  negative: '#ef4444', // red-500
  negativeLight: '#f87171', // red-400
  neutral: '#94a3b8', // slate-400
};

/**
 * Get color based on value and component type
 * @param value - The numeric value
 * @param isBase - Whether this is the base score component
 * @returns Hex color string
 */
const getBarColor = (value: number, isBase: boolean = false): string => {
  if (isBase) return COLORS.base;
  if (value > 0) return COLORS.positive;
  if (value < 0) return COLORS.negative;
  return COLORS.neutral;
};

/**
 * Custom tooltip component for the bar chart
 * Displays detailed information about each score component
 */
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload as ChartDataPoint;
    const isPositive = data.value > 0;
    const valueColor = data.value === 0 ? 'text-slate-600' : isPositive ? 'text-green-600' : 'text-red-600';

    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg max-w-xs">
        <p className="font-semibold text-slate-900 mb-1">{data.name}</p>
        <p className={`font-medium ${valueColor}`}>
          {isPositive ? '+' : ''}{data.value.toFixed(1)} points
        </p>
        <p className="text-sm text-slate-600 mt-1">{data.description}</p>
      </div>
    );
  }
  return null;
};

/**
 * Custom label component for bar values
 */
const CustomLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  const isPositive = value > 0;
  const displayValue = value === 0 ? '0' : (isPositive ? `+${value.toFixed(1)}` : value.toFixed(1));

  // Position label at the end of the bar
  const labelX = width > 0 ? x + width + 5 : x - 5;
  const textAnchor = width > 0 ? 'start' : 'end';

  return (
    <text
      x={labelX}
      y={y + height / 2}
      fill={value > 0 ? COLORS.positive : value < 0 ? COLORS.negative : COLORS.neutral}
      textAnchor={textAnchor}
      dominantBaseline="middle"
      fontSize={12}
      fontWeight={500}
    >
      {displayValue}
    </text>
  );
};

/**
 * ScoreBreakdownChart Component
 *
 * Renders a horizontal bar chart showing the breakdown of score components
 * that contribute to a horse's final competition score.
 *
 * @example
 * ```tsx
 * <ScoreBreakdownChart
 *   breakdown={scoreBreakdown}
 *   height={400}
 *   showLegend={true}
 *   interactive={true}
 * />
 * ```
 */
const ScoreBreakdownChart: React.FC<ScoreBreakdownChartProps> = ({
  breakdown,
  height = 300,
  showLegend = false,
  interactive = true,
  className = '',
}) => {
  // Transform breakdown data into chart format
  const chartData: ChartDataPoint[] = useMemo(() => {
    const data: ChartDataPoint[] = [];

    // Base Score (always first, blue color)
    data.push({
      name: 'Base Stats',
      value: breakdown.baseScore.total,
      color: COLORS.base,
      description: `Speed (${breakdown.baseScore.speed} x 50%) + Stamina (${breakdown.baseScore.stamina} x 30%) + Agility (${breakdown.baseScore.agility} x 20%)`,
    });

    // Training Bonus
    data.push({
      name: 'Training',
      value: breakdown.trainingBonus,
      color: getBarColor(breakdown.trainingBonus),
      description: 'Bonus from discipline-specific training',
    });

    // Combined Trait Bonuses
    const totalTraitBonus = breakdown.traitBonuses.reduce((sum, tb) => sum + tb.bonus, 0);
    const traitNames = breakdown.traitBonuses.map((tb) => tb.trait).join(', ');
    data.push({
      name: 'Traits',
      value: totalTraitBonus,
      color: getBarColor(totalTraitBonus),
      description: traitNames || 'No trait bonuses',
    });

    // Equipment Bonuses
    data.push({
      name: 'Equipment',
      value: breakdown.equipmentBonuses.total,
      color: getBarColor(breakdown.equipmentBonuses.total),
      description: `Saddle (+${breakdown.equipmentBonuses.saddle}) + Bridle (+${breakdown.equipmentBonuses.bridle})`,
    });

    // Rider Effect
    data.push({
      name: 'Rider',
      value: breakdown.riderEffect,
      color: getBarColor(breakdown.riderEffect),
      description: breakdown.riderEffect >= 0 ? 'Rider bonus percentage' : 'Rider penalty percentage',
    });

    // Health Modifier
    data.push({
      name: 'Health',
      value: breakdown.healthModifier,
      color: getBarColor(breakdown.healthModifier),
      description: 'Adjustment based on horse health rating',
    });

    // Random Luck
    data.push({
      name: 'Luck',
      value: breakdown.randomLuck,
      color: getBarColor(breakdown.randomLuck),
      description: 'Random variance factor (max plus/minus 9%)',
    });

    return data;
  }, [breakdown]);

  // Calculate min/max for X axis domain
  const domain = useMemo(() => {
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const padding = Math.max(Math.abs(min), Math.abs(max)) * 0.1;
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [chartData]);

  // Hidden description for screen readers
  const descriptionId = 'breakdown-chart-description';
  const descriptionText = `Horizontal bar chart showing score breakdown components. Total score: ${breakdown.total.toFixed(1)} points.`;

  return (
    <div className={className} data-testid="score-breakdown-chart-container">
      {/* Hidden description for accessibility */}
      <span id={descriptionId} className="sr-only">
        {descriptionText}
      </span>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 60, left: 80, bottom: 10 }}
          aria-label="Score breakdown bar chart"
          aria-describedby={descriptionId}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            domain={domain}
            tick={{ fontSize: 11 }}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={70}
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="3 3" />
          {interactive && <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />}
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="square"
            />
          )}
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
              />
            ))}
            <LabelList
              dataKey="value"
              content={<CustomLabel />}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default memo(ScoreBreakdownChart);
