/**
 * ScoreBreakdownRadar Component Tests
 *
 * Tests the Recharts RadarChart wrapper with Celestial Night styling.
 * Recharts is mocked to capture passed data/props.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

let lastRadarChartProps: any = null;
let radarComponents: any[] = [];
let legendRendered = false;

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children, height }: any) => (
    <div data-testid="responsive-container" data-height={height}>
      {children}
    </div>
  ),
  RadarChart: ({ children, data, ...props }: any) => {
    lastRadarChartProps = { data, ...props };
    return (
      <svg data-testid="radar-chart" data-chart-data={JSON.stringify(data)}>
        {children}
      </svg>
    );
  },
  PolarGrid: () => <g data-testid="polar-grid" />,
  PolarAngleAxis: ({ dataKey }: any) => <g data-testid="polar-angle-axis" data-datakey={dataKey} />,
  PolarRadiusAxis: ({ domain }: any) => (
    <g data-testid="polar-radius-axis" data-domain={JSON.stringify(domain)} />
  ),
  Radar: ({ name, dataKey }: any) => {
    radarComponents.push({ name, dataKey });
    return <g data-testid={`radar-${name}`} data-name={name} data-datakey={dataKey} />;
  },
  Tooltip: ({ content }: any) => <g data-testid="tooltip" />,
  Legend: () => {
    legendRendered = true;
    return <g data-testid="legend" />;
  },
}));

import { ScoreBreakdownRadar } from '../ScoreBreakdownRadar';

beforeEach(() => {
  lastRadarChartProps = null;
  radarComponents = [];
  legendRendered = false;
});

const sampleStats = {
  speed: 80,
  stamina: 75,
  agility: 70,
  balance: 65,
  precision: 60,
};

describe('ScoreBreakdownRadar', () => {
  it('renders the radar chart', () => {
    render(<ScoreBreakdownRadar stats={sampleStats} />);
    expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
  });

  it('passes correctly formatted data to RadarChart', () => {
    render(<ScoreBreakdownRadar stats={sampleStats} />);
    const data = lastRadarChartProps?.data;
    expect(data).toHaveLength(5);
    expect(data[0]).toEqual(expect.objectContaining({ subject: 'Speed', Current: 80 }));
    expect(data[1]).toEqual(expect.objectContaining({ subject: 'Stamina', Current: 75 }));
  });

  it('renders a single Radar for current stats', () => {
    render(<ScoreBreakdownRadar stats={sampleStats} />);
    expect(radarComponents).toHaveLength(1);
    expect(radarComponents[0].name).toBe('Current');
  });

  it('renders two Radars when personalBest is provided', () => {
    const personalBest = { speed: 90, stamina: 85, agility: 80, balance: 75, precision: 70 };
    render(<ScoreBreakdownRadar stats={sampleStats} personalBest={personalBest} />);
    expect(radarComponents).toHaveLength(2);
    expect(radarComponents.find((r) => r.name === 'Personal Best')).toBeDefined();
    expect(radarComponents.find((r) => r.name === 'Current')).toBeDefined();
  });

  it('includes Personal Best values in chart data', () => {
    const personalBest = { speed: 90, stamina: 85, agility: 80, balance: 75, precision: 70 };
    render(<ScoreBreakdownRadar stats={sampleStats} personalBest={personalBest} />);
    const data = lastRadarChartProps?.data;
    expect(data[0]).toEqual(
      expect.objectContaining({ subject: 'Speed', Current: 80, 'Personal Best': 90 })
    );
  });

  it('renders legend when personalBest is provided', () => {
    const personalBest = { speed: 90, stamina: 85, agility: 80, balance: 75, precision: 70 };
    render(<ScoreBreakdownRadar stats={sampleStats} personalBest={personalBest} />);
    expect(legendRendered).toBe(true);
  });

  it('does not render legend when personalBest is not provided', () => {
    render(<ScoreBreakdownRadar stats={sampleStats} />);
    expect(legendRendered).toBe(false);
  });

  it('displays the title when provided', () => {
    render(<ScoreBreakdownRadar stats={sampleStats} title="Horse Performance" />);
    expect(screen.getByText('Horse Performance')).toBeInTheDocument();
  });

  it('does not display title when not provided', () => {
    render(<ScoreBreakdownRadar stats={sampleStats} />);
    expect(screen.queryByText('Horse Performance')).not.toBeInTheDocument();
  });

  it('passes custom height to ResponsiveContainer', () => {
    render(<ScoreBreakdownRadar stats={sampleStats} height={400} />);
    expect(screen.getByTestId('responsive-container')).toHaveAttribute('data-height', '400');
  });

  it('uses default height of 280', () => {
    render(<ScoreBreakdownRadar stats={sampleStats} />);
    expect(screen.getByTestId('responsive-container')).toHaveAttribute('data-height', '280');
  });
});
