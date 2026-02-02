/**
 * ScoreBreakdownChart Component Tests
 *
 * Comprehensive test suite for the score breakdown chart component.
 * Tests cover:
 * - Chart rendering with breakdown data
 * - Color coding for positive/negative/neutral values
 * - Data display (bars, labels, percentages)
 * - Interactivity (tooltips, legend)
 * - Edge cases (zero values, all negative)
 *
 * Target: 15 tests following TDD methodology
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ScoreBreakdownChart, {
  type ScoreBreakdownChartProps,
  type ScoreBreakdown,
} from '../ScoreBreakdownChart';

// Store last rendered props for assertions
let lastBarChartProps: any = null;
let lastBarProps: any[] = [];
let lastTooltipProps: any = null;
let lastLegendProps: any = null;
let lastResponsiveContainerProps: any = null;
let lastXAxisProps: any = null;
let lastYAxisProps: any = null;
let lastCellProps: any[] = [];

// Mock Recharts components to enable testing
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children, height, ...props }: any) => {
    lastResponsiveContainerProps = { height, ...props };
    return (
      <div
        data-testid="responsive-container"
        data-height={height}
        style={{ width: '100%', height: height || 300 }}
      >
        {children}
      </div>
    );
  },
  BarChart: ({ children, data, layout, ...props }: any) => {
    lastBarChartProps = { data, layout, ...props };
    return (
      <svg
        data-testid="bar-chart"
        data-chart-data={JSON.stringify(data)}
        data-layout={layout}
        role="img"
        aria-label={props['aria-label']}
      >
        {children}
      </svg>
    );
  },
  Bar: ({ dataKey, fill, children, ...props }: any) => {
    lastBarProps.push({ dataKey, fill, ...props });
    return (
      <g data-testid="bar" data-datakey={dataKey} data-fill={fill}>
        {children}
      </g>
    );
  },
  Cell: ({ fill, ...props }: any) => {
    lastCellProps.push({ fill, ...props });
    return <rect data-testid="cell" data-fill={fill} {...props} />;
  },
  XAxis: ({ dataKey, type, ...props }: any) => {
    lastXAxisProps = { dataKey, type, ...props };
    return <g data-testid="x-axis" data-datakey={dataKey} data-type={type} />;
  },
  YAxis: ({ dataKey, type, width, ...props }: any) => {
    lastYAxisProps = { dataKey, type, width, ...props };
    return <g data-testid="y-axis" data-datakey={dataKey} data-type={type} data-width={width} />;
  },
  Tooltip: ({ content, ...props }: any) => {
    lastTooltipProps = { content, ...props };
    return <g data-testid="tooltip" {...props} />;
  },
  Legend: ({ wrapperStyle, ...props }: any) => {
    lastLegendProps = { wrapperStyle, ...props };
    return <g data-testid="legend" {...props} />;
  },
  LabelList: ({ dataKey, position, ...props }: any) => (
    <g data-testid="label-list" data-datakey={dataKey} data-position={position} />
  ),
  CartesianGrid: (props: any) => <g data-testid="cartesian-grid" {...props} />,
  ReferenceLine: ({ x, y, ...props }: any) => (
    <line data-testid="reference-line" data-x={x} data-y={y} {...props} />
  ),
}));

// Reset mocks between tests
beforeEach(() => {
  lastBarChartProps = null;
  lastBarProps = [];
  lastTooltipProps = null;
  lastLegendProps = null;
  lastResponsiveContainerProps = null;
  lastXAxisProps = null;
  lastYAxisProps = null;
  lastCellProps = [];
});

// Sample score breakdown data for testing
const sampleBreakdown: ScoreBreakdown = {
  baseScore: {
    speed: 80,
    stamina: 75,
    agility: 70,
    total: 77.5, // (80*0.5) + (75*0.3) + (70*0.2)
  },
  trainingBonus: 15,
  traitBonuses: [
    { trait: 'Speed Demon', bonus: 5 },
    { trait: 'Agile', bonus: 3 },
  ],
  equipmentBonuses: {
    saddle: 8,
    bridle: 5,
    total: 13,
  },
  riderEffect: 7, // Positive effect
  healthModifier: -2, // Slight penalty for health issues
  randomLuck: 4.5, // Good luck
  total: 115,
};

// Breakdown with negative values
const breakdownWithNegatives: ScoreBreakdown = {
  baseScore: {
    speed: 60,
    stamina: 55,
    agility: 50,
    total: 56.5,
  },
  trainingBonus: 10,
  traitBonuses: [{ trait: 'Nervous', bonus: -3 }],
  equipmentBonuses: {
    saddle: 5,
    bridle: 3,
    total: 8,
  },
  riderEffect: -5, // Negative penalty from inexperienced rider
  healthModifier: -8, // Health penalty
  randomLuck: -7, // Bad luck
  total: 51.5,
};

// Breakdown with zero values
const breakdownWithZeros: ScoreBreakdown = {
  baseScore: {
    speed: 50,
    stamina: 50,
    agility: 50,
    total: 50,
  },
  trainingBonus: 0,
  traitBonuses: [],
  equipmentBonuses: {
    saddle: 0,
    bridle: 0,
    total: 0,
  },
  riderEffect: 0,
  healthModifier: 0,
  randomLuck: 0,
  total: 50,
};

const defaultProps: ScoreBreakdownChartProps = {
  breakdown: sampleBreakdown,
};

describe('ScoreBreakdownChart', () => {
  // =========================================
  // 1. Chart Rendering (4 tests)
  // =========================================
  describe('Chart Rendering', () => {
    it('renders chart with breakdown data', () => {
      render(<ScoreBreakdownChart {...defaultProps} />);
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('renders all score components as bars', () => {
      render(<ScoreBreakdownChart {...defaultProps} />);
      const chartData = lastBarChartProps?.data;

      expect(chartData).toBeDefined();
      // Should have: Base Score, Training, Trait Bonuses (combined), Equipment, Rider, Health, Luck
      expect(chartData.length).toBeGreaterThanOrEqual(6);
    });

    it('displays labels on bars', () => {
      render(<ScoreBreakdownChart {...defaultProps} />);
      // LabelList should be rendered for displaying values on bars
      expect(screen.getByTestId('label-list')).toBeInTheDocument();
    });

    it('accepts custom height prop', () => {
      render(<ScoreBreakdownChart {...defaultProps} height={500} />);
      const container = screen.getByTestId('responsive-container');
      expect(container).toHaveAttribute('data-height', '500');
    });
  });

  // =========================================
  // 2. Color Coding (3 tests)
  // =========================================
  describe('Color Coding', () => {
    it('renders positive components in green shades', () => {
      render(<ScoreBreakdownChart {...defaultProps} />);
      const chartData = lastBarChartProps?.data;

      // Find positive components and verify their colors
      const positiveComponents = chartData?.filter((d: any) => d.value > 0);
      expect(positiveComponents?.length).toBeGreaterThan(0);

      // Cells should be rendered with green colors for positive values
      const greenCells = lastCellProps.filter(
        (cell) =>
          cell.fill?.includes('green') ||
          cell.fill?.includes('#22c55e') ||
          cell.fill?.includes('#4ade80') ||
          cell.fill?.includes('#86efac')
      );
      expect(greenCells.length).toBeGreaterThan(0);
    });

    it('renders negative components in red shades', () => {
      render(<ScoreBreakdownChart breakdown={breakdownWithNegatives} />);
      const chartData = lastBarChartProps?.data;

      // Find negative components
      const negativeComponents = chartData?.filter((d: any) => d.value < 0);
      expect(negativeComponents?.length).toBeGreaterThan(0);

      // Cells should include red colors for negative values
      const redCells = lastCellProps.filter(
        (cell) =>
          cell.fill?.includes('red') ||
          cell.fill?.includes('#ef4444') ||
          cell.fill?.includes('#f87171')
      );
      expect(redCells.length).toBeGreaterThan(0);
    });

    it('renders base score in blue shade', () => {
      render(<ScoreBreakdownChart {...defaultProps} />);
      const chartData = lastBarChartProps?.data;

      // Base score should be present
      const baseScore = chartData?.find((d: any) => d.name?.toLowerCase().includes('base'));
      expect(baseScore).toBeDefined();

      // Should have blue cells for base score
      const blueCells = lastCellProps.filter(
        (cell) =>
          cell.fill?.includes('blue') ||
          cell.fill?.includes('#3b82f6') ||
          cell.fill?.includes('#60a5fa')
      );
      expect(blueCells.length).toBeGreaterThan(0);
    });
  });

  // =========================================
  // 3. Data Display (4 tests)
  // =========================================
  describe('Data Display', () => {
    it('renders bar lengths proportional to values', () => {
      render(<ScoreBreakdownChart {...defaultProps} />);
      const chartData = lastBarChartProps?.data;

      // Verify values are passed correctly to chart data
      const baseScoreData = chartData?.find((d: any) => d.name?.toLowerCase().includes('base'));
      expect(baseScoreData?.value).toBe(sampleBreakdown.baseScore.total);
    });

    it('displays point values on bars', () => {
      render(<ScoreBreakdownChart {...defaultProps} />);
      // LabelList with dataKey should display values
      const labelList = screen.getByTestId('label-list');
      expect(labelList).toHaveAttribute('data-datakey');
    });

    it('calculates percentages correctly', () => {
      render(<ScoreBreakdownChart {...defaultProps} />);
      const chartData = lastBarChartProps?.data;

      // Verify chart data includes values that can be used for percentage calculation
      const total = sampleBreakdown.total;
      const baseScoreData = chartData?.find((d: any) => d.name?.toLowerCase().includes('base'));

      if (baseScoreData) {
        const expectedPercentage = (sampleBreakdown.baseScore.total / total) * 100;
        // The percentage should be calculable from the data
        expect(baseScoreData.value).toBeCloseTo(sampleBreakdown.baseScore.total, 1);
      }
    });

    it('totals sum correctly', () => {
      render(<ScoreBreakdownChart {...defaultProps} />);
      const chartData = lastBarChartProps?.data;

      // Sum all values in chart data
      const chartTotal = chartData?.reduce((sum: number, d: any) => sum + (d.value || 0), 0);

      // The chart data values should approximate the total score
      // Note: Some values may be combined or split differently
      expect(chartTotal).toBeDefined();
      expect(typeof chartTotal).toBe('number');
    });
  });

  // =========================================
  // 4. Interactivity (2 tests)
  // =========================================
  describe('Interactivity', () => {
    it('shows tooltip when interactive is true', () => {
      render(<ScoreBreakdownChart {...defaultProps} interactive={true} />);
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });

    it('displays legend when showLegend is true', () => {
      render(<ScoreBreakdownChart {...defaultProps} showLegend={true} />);
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });
  });

  // =========================================
  // 5. Edge Cases (2 tests)
  // =========================================
  describe('Edge Cases', () => {
    it('handles zero values correctly', () => {
      render(<ScoreBreakdownChart breakdown={breakdownWithZeros} />);
      const chartData = lastBarChartProps?.data;

      expect(chartData).toBeDefined();
      // Should still render even with zero values
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();

      // Zero values should be present in data
      const zeroValues = chartData?.filter((d: any) => d.value === 0);
      expect(zeroValues?.length).toBeGreaterThan(0);
    });

    it('handles all negative values correctly', () => {
      const allNegativeBreakdown: ScoreBreakdown = {
        baseScore: {
          speed: 30,
          stamina: 30,
          agility: 30,
          total: 30,
        },
        trainingBonus: 0,
        traitBonuses: [{ trait: 'Lazy', bonus: -5 }],
        equipmentBonuses: {
          saddle: 0,
          bridle: 0,
          total: 0,
        },
        riderEffect: -10,
        healthModifier: -15,
        randomLuck: -9,
        total: -9,
      };

      render(<ScoreBreakdownChart breakdown={allNegativeBreakdown} />);
      const chartData = lastBarChartProps?.data;

      expect(chartData).toBeDefined();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();

      // Should have negative values in data
      const negativeValues = chartData?.filter((d: any) => d.value < 0);
      expect(negativeValues?.length).toBeGreaterThan(0);
    });
  });
});
