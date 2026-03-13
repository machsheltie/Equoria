/**
 * CompatibilityPreview Component Tests
 *
 * Tests the 4-tab breeding compatibility display.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { CompatibilityPreview, type CompatibilityData } from '../CompatibilityPreview';

// Mock recharts to avoid rendering issues
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  RadarChart: ({ children }: any) => <svg data-testid="radar-chart">{children}</svg>,
  PolarGrid: () => <g />,
  PolarAngleAxis: () => <g />,
  PolarRadiusAxis: () => <g />,
  Radar: () => <g />,
  Tooltip: () => <g />,
  Legend: () => <g />,
}));

const sampleData: CompatibilityData = {
  statRanges: {
    speed: { min: 60, avg: 75, max: 90 },
    stamina: { min: 55, avg: 70, max: 85 },
  },
  traits: [
    { name: 'Speed Demon', probability: 0.6, source: 'sire' },
    { name: 'Gentle', probability: 0.4, source: 'dam' },
  ],
  inbreedingCoefficient: 0.05,
  pedigreeOverlap: [
    { ancestorName: 'Eclipse', generations: 3 },
  ],
};

const highInbreedingData: CompatibilityData = {
  ...sampleData,
  inbreedingCoefficient: 0.2, // > 12.5% threshold
};

describe('CompatibilityPreview', () => {
  it('renders the component with correct testid', () => {
    render(
      <CompatibilityPreview
        mareName="Luna"
        stallionName="Atlas"
        data={sampleData}
      />
    );
    expect(screen.getByTestId('compatibility-preview')).toBeInTheDocument();
  });

  it('displays mare and stallion names', () => {
    render(
      <CompatibilityPreview
        mareName="Luna"
        stallionName="Atlas"
        data={sampleData}
      />
    );
    // Names appear in a combined text node: "Luna × Atlas"
    expect(screen.getByText(/Luna/)).toBeInTheDocument();
    expect(screen.getByText(/Atlas/)).toBeInTheDocument();
  });

  it('renders all 4 tab buttons', () => {
    render(
      <CompatibilityPreview
        mareName="Luna"
        stallionName="Atlas"
        data={sampleData}
      />
    );
    const tabList = screen.getByRole('tablist');
    expect(tabList).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Stats' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Traits' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Inbreeding' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pedigree' })).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    const { container } = render(
      <CompatibilityPreview
        mareName="Luna"
        stallionName="Atlas"
        data={null}
        isLoading
      />
    );
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows loading skeleton when data is null', () => {
    const { container } = render(
      <CompatibilityPreview
        mareName="Luna"
        stallionName="Atlas"
        data={null}
      />
    );
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  describe('Tab switching', () => {
    it('shows Stats tab content by default', () => {
      render(
        <CompatibilityPreview
          mareName="Luna"
          stallionName="Atlas"
          data={sampleData}
        />
      );
      // Stats tab should show the radar chart
      expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
    });

    it('switches to Traits tab on click', () => {
      render(
        <CompatibilityPreview
          mareName="Luna"
          stallionName="Atlas"
          data={sampleData}
        />
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Traits' }));
      expect(screen.getByText('Speed Demon')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('switches to Inbreeding tab on click', () => {
      render(
        <CompatibilityPreview
          mareName="Luna"
          stallionName="Atlas"
          data={sampleData}
        />
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Inbreeding' }));
      expect(screen.getByText('5%')).toBeInTheDocument();
      expect(screen.getByText('Inbreeding coefficient')).toBeInTheDocument();
    });

    it('switches to Pedigree tab on click', () => {
      render(
        <CompatibilityPreview
          mareName="Luna"
          stallionName="Atlas"
          data={sampleData}
        />
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Pedigree' }));
      expect(screen.getByText('Eclipse')).toBeInTheDocument();
      expect(screen.getByText('3 gens back')).toBeInTheDocument();
    });
  });

  describe('Inbreeding warning', () => {
    it('shows warning when coefficient >= 12.5%', () => {
      render(
        <CompatibilityPreview
          mareName="Luna"
          stallionName="Atlas"
          data={highInbreedingData}
        />
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Inbreeding' }));
      expect(screen.getByText(/High inbreeding coefficient/)).toBeInTheDocument();
    });

    it('shows healthy message when coefficient < 12.5%', () => {
      render(
        <CompatibilityPreview
          mareName="Luna"
          stallionName="Atlas"
          data={sampleData}
        />
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Inbreeding' }));
      expect(screen.getByText(/Low inbreeding/)).toBeInTheDocument();
    });
  });

  describe('Pedigree', () => {
    it('shows "no common ancestors" when overlap is empty', () => {
      const noOverlapData: CompatibilityData = {
        ...sampleData,
        pedigreeOverlap: [],
      };
      render(
        <CompatibilityPreview
          mareName="Luna"
          stallionName="Atlas"
          data={noOverlapData}
        />
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Pedigree' }));
      expect(screen.getByText('No common ancestors')).toBeInTheDocument();
    });
  });
});
