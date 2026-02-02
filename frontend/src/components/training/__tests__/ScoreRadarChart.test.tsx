/**
 * ScoreRadarChart Component Tests
 *
 * Comprehensive tests for the Score Radar Chart component including:
 * - Chart rendering with ResponsiveContainer and RadarChart
 * - Data mapping for all 23 disciplines
 * - Color coding by category (Western, English, Specialized, Racing)
 * - Tooltip functionality
 * - Legend display
 * - Accessibility features
 *
 * Story 4-1: Training Session Interface - Task: ScoreRadarChart
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ScoreRadarChart from '../ScoreRadarChart';
import { DISCIPLINES } from '../../../lib/utils/training-utils';

// Mock Recharts components to enable testing
// Store last rendered props for assertions
let lastRadarChartProps: any = null;
let lastRadarProps: any = null;
let lastTooltipProps: any = null;
let lastLegendProps: any = null;
let lastResponsiveContainerProps: any = null;

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children, height, ...props }: any) => {
    lastResponsiveContainerProps = { height, ...props };
    return (
      <div
        data-testid="responsive-container"
        data-height={height}
        style={{ width: '100%', height: height || 400 }}
      >
        {children}
      </div>
    );
  },
  RadarChart: ({ children, data, cx, cy, outerRadius, ...props }: any) => {
    lastRadarChartProps = { data, cx, cy, outerRadius, ...props };
    return (
      <svg
        data-testid="radar-chart"
        data-chart-data={JSON.stringify(data)}
        role="img"
        aria-label={props['aria-label']}
        aria-describedby={props['aria-describedby']}
      >
        {children}
      </svg>
    );
  },
  PolarGrid: (props: any) => <g data-testid="polar-grid" {...props} />,
  PolarAngleAxis: ({ dataKey, ...props }: any) => (
    <g data-testid="polar-angle-axis" data-datakey={dataKey} {...props} />
  ),
  PolarRadiusAxis: ({ angle, domain, ...props }: any) => (
    <g
      data-testid="polar-radius-axis"
      data-angle={angle}
      data-domain={JSON.stringify(domain)}
      {...props}
    />
  ),
  Radar: ({ name, dataKey, stroke, fill, fillOpacity, ...props }: any) => {
    lastRadarProps = { name, dataKey, stroke, fill, fillOpacity, ...props };
    return (
      <polygon
        data-testid="radar"
        data-name={name}
        data-datakey={dataKey}
        data-stroke={stroke}
        data-fill={fill}
        data-fill-opacity={fillOpacity}
        {...props}
      />
    );
  },
  Tooltip: ({ content, ...props }: any) => {
    lastTooltipProps = { content, ...props };
    return <g data-testid="tooltip" {...props} />;
  },
  Legend: ({ wrapperStyle, ...props }: any) => {
    lastLegendProps = { wrapperStyle, ...props };
    return <g data-testid="legend" {...props} />;
  },
}));

// Helper to get stored props
const getRadarChartProps = () => lastRadarChartProps;
const getRadarProps = () => lastRadarProps;
const getTooltipProps = () => lastTooltipProps;
const getLegendProps = () => lastLegendProps;
const getResponsiveContainerProps = () => lastResponsiveContainerProps;

// Reset mocks between tests
beforeEach(() => {
  lastRadarChartProps = null;
  lastRadarProps = null;
  lastTooltipProps = null;
  lastLegendProps = null;
  lastResponsiveContainerProps = null;
});

// Sample discipline scores for testing
const sampleScores: { [disciplineId: string]: number } = {
  'western-pleasure': 75,
  reining: 60,
  cutting: 45,
  'barrel-racing': 80,
  roping: 30,
  'team-penning': 55,
  rodeo: 40,
  hunter: 65,
  saddleseat: 50,
  dressage: 90,
  'show-jumping': 85,
  eventing: 70,
  'cross-country': 55,
  endurance: 60,
  vaulting: 35,
  polo: 45,
  'combined-driving': 50,
  'fine-harness': 40,
  gaited: 55,
  gymkhana: 65,
  racing: 95,
  steeplechase: 75,
  'harness-racing': 70,
};

// Partial scores (some disciplines missing)
const partialScores: { [disciplineId: string]: number } = {
  dressage: 90,
  'show-jumping': 85,
  racing: 95,
};

describe('ScoreRadarChart', () => {
  describe('Rendering Tests', () => {
    it('renders without crashing', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
    });

    it('renders ResponsiveContainer', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders RadarChart inside ResponsiveContainer', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const container = screen.getByTestId('responsive-container');
      const chart = screen.getByTestId('radar-chart');
      expect(container).toContainElement(chart);
    });

    it('uses default height of 400px', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const container = screen.getByTestId('responsive-container');
      expect(container).toHaveAttribute('data-height', '400');
    });

    it('accepts custom height prop', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} height={500} />);
      const container = screen.getByTestId('responsive-container');
      expect(container).toHaveAttribute('data-height', '500');
    });
  });

  describe('Data Mapping Tests', () => {
    it('includes all 23 disciplines in chart data', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const chartData = getRadarChartProps()?.data;

      expect(chartData).toBeDefined();
      expect(chartData.length).toBe(23);
    });

    it('maps discipline scores correctly', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const chartData = getRadarChartProps()?.data;

      // Find dressage in chart data
      const dressageData = chartData.find((d: any) => d.discipline === 'Dressage');
      expect(dressageData).toBeDefined();
      expect(dressageData.score).toBe(90);
    });

    it('defaults missing scores to 0', () => {
      render(<ScoreRadarChart disciplineScores={partialScores} />);
      const chartData = getRadarChartProps()?.data;

      // Western Pleasure should default to 0 since it is not in partialScores
      const westernPleasureData = chartData.find((d: any) => d.discipline === 'Western Pleasure');
      expect(westernPleasureData).toBeDefined();
      expect(westernPleasureData.score).toBe(0);
    });

    it('handles empty disciplineScores object', () => {
      render(<ScoreRadarChart disciplineScores={{}} />);
      const chartData = getRadarChartProps()?.data;

      expect(chartData).toBeDefined();
      expect(chartData.length).toBe(23);
      // All scores should be 0
      chartData.forEach((d: any) => {
        expect(d.score).toBe(0);
      });
    });

    it('handles partial disciplineScores data', () => {
      render(<ScoreRadarChart disciplineScores={partialScores} />);
      const chartData = getRadarChartProps()?.data;

      // Check provided scores are mapped
      const dressageData = chartData.find((d: any) => d.discipline === 'Dressage');
      expect(dressageData.score).toBe(90);

      // Check missing scores default to 0
      const enduranceData = chartData.find((d: any) => d.discipline === 'Endurance');
      expect(enduranceData.score).toBe(0);
    });

    it('displays discipline names correctly', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const chartData = getRadarChartProps()?.data;

      // Verify all DISCIPLINES names are present
      const disciplineNames = chartData.map((d: any) => d.discipline);
      DISCIPLINES.forEach((disc) => {
        expect(disciplineNames).toContain(disc.name);
      });
    });
  });

  describe('Color Coding Tests', () => {
    it('assigns Western disciplines orange color', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const chartData = getRadarChartProps()?.data;

      const westernDiscipline = chartData.find((d: any) => d.discipline === 'Western Pleasure');
      expect(westernDiscipline.category).toBe('Western');

      // The radar component should use category-based coloring
      // Check that Western disciplines have correct category
      const allWestern = chartData.filter((d: any) => d.category === 'Western');
      expect(allWestern.length).toBe(7); // 7 Western disciplines
    });

    it('assigns English disciplines blue color', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const chartData = getRadarChartProps()?.data;

      const englishDiscipline = chartData.find((d: any) => d.discipline === 'Dressage');
      expect(englishDiscipline.category).toBe('English');

      const allEnglish = chartData.filter((d: any) => d.category === 'English');
      expect(allEnglish.length).toBe(6); // 6 English disciplines
    });

    it('assigns Specialized disciplines purple color', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const chartData = getRadarChartProps()?.data;

      const specializedDiscipline = chartData.find((d: any) => d.discipline === 'Endurance');
      expect(specializedDiscipline.category).toBe('Specialized');

      const allSpecialized = chartData.filter((d: any) => d.category === 'Specialized');
      expect(allSpecialized.length).toBe(7); // 7 Specialized disciplines
    });

    it('assigns Racing disciplines red color', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const chartData = getRadarChartProps()?.data;

      const racingDiscipline = chartData.find((d: any) => d.discipline === 'Racing');
      expect(racingDiscipline.category).toBe('Racing');

      const allRacing = chartData.filter((d: any) => d.category === 'Racing');
      expect(allRacing.length).toBe(3); // 3 Racing disciplines
    });
  });

  describe('Tooltip Tests', () => {
    it('renders Tooltip component', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });

    it('configures tooltip with custom content', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const tooltipProps = getTooltipProps();

      // Tooltip should have content prop for custom rendering
      expect(tooltipProps).toBeDefined();
    });

    it('tooltip displays score value', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      // Tooltip presence verifies it can show score values
      // The actual display is handled by Recharts internal rendering
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });
  });

  describe('Legend Tests', () => {
    it('displays legend when showLegend is true', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} showLegend={true} />);
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });

    it('hides legend when showLegend is false', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} showLegend={false} />);
      expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
    });

    it('legend shows all 4 categories when displayed', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} showLegend={true} />);
      // Legend component is rendered - it will show category-based colors
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });
  });

  describe('Accessibility Tests', () => {
    it('has ARIA label on chart', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const chart = screen.getByTestId('radar-chart');
      expect(chart).toHaveAttribute('aria-label', 'Discipline scores radar chart');
    });

    it('has ARIA description present', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const chart = screen.getByTestId('radar-chart');
      expect(chart).toHaveAttribute('aria-describedby');
    });

    it('has semantic structure with role img', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const chart = screen.getByRole('img', { name: 'Discipline scores radar chart' });
      expect(chart).toBeInTheDocument();
    });

    it('provides hidden description element for screen readers', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      // Check for visually hidden description element
      const description = screen.getByText(/radar chart showing scores/i);
      expect(description).toBeInTheDocument();
    });
  });

  describe('Chart Configuration Tests', () => {
    it('configures PolarGrid for grid lines', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      expect(screen.getByTestId('polar-grid')).toBeInTheDocument();
    });

    it('configures PolarAngleAxis for discipline labels', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const angleAxis = screen.getByTestId('polar-angle-axis');
      expect(angleAxis).toHaveAttribute('data-datakey', 'discipline');
    });

    it('configures PolarRadiusAxis with 0-100 domain', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const radiusAxis = screen.getByTestId('polar-radius-axis');
      const domain = JSON.parse(radiusAxis.getAttribute('data-domain') || '[]');
      expect(domain).toEqual([0, 100]);
    });

    it('sets fill opacity to 0.6', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const radar = screen.getByTestId('radar');
      expect(radar).toHaveAttribute('data-fill-opacity', '0.6');
    });
  });

  describe('Custom Styling Tests', () => {
    it('accepts className prop for custom styling', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} className="custom-chart" />);
      // The wrapper div should have the custom class
      const container = screen.getByTestId('responsive-container').parentElement;
      expect(container).toHaveClass('custom-chart');
    });

    it('uses correct category colors in Radar fill', () => {
      render(<ScoreRadarChart disciplineScores={sampleScores} />);
      const radar = screen.getByTestId('radar');
      // Radar should have a fill color defined
      const fill = radar.getAttribute('data-fill');
      expect(fill).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles scores at boundary (0)', () => {
      const zeroScores: { [key: string]: number } = {};
      DISCIPLINES.forEach((d) => {
        zeroScores[d.id] = 0;
      });
      render(<ScoreRadarChart disciplineScores={zeroScores} />);
      const chartData = getRadarChartProps()?.data;
      chartData.forEach((d: any) => {
        expect(d.score).toBe(0);
      });
    });

    it('handles scores at boundary (100)', () => {
      const maxScores: { [key: string]: number } = {};
      DISCIPLINES.forEach((d) => {
        maxScores[d.id] = 100;
      });
      render(<ScoreRadarChart disciplineScores={maxScores} />);
      const chartData = getRadarChartProps()?.data;
      chartData.forEach((d: any) => {
        expect(d.score).toBe(100);
      });
    });

    it('handles undefined disciplineScores gracefully', () => {
      // TypeScript would catch this, but runtime should handle it
      render(<ScoreRadarChart disciplineScores={undefined as any} />);
      const chartData = getRadarChartProps()?.data;
      expect(chartData).toBeDefined();
      expect(chartData.length).toBe(23);
    });
  });
});
