/**
 * CompatibilityPreview Component Tests
 *
 * Tests the 4-tab breeding compatibility display.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { CompatibilityPreview, type CompatibilityData } from '../CompatibilityPreview';

// Mock recharts to avoid rendering issues
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
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
  pedigreeOverlap: [{ ancestorName: 'Eclipse', generations: 3 }],
};

const highInbreedingData: CompatibilityData = {
  ...sampleData,
  inbreedingCoefficient: 0.2, // > 12.5% threshold
};

describe('CompatibilityPreview', () => {
  it('renders the component with correct testid', () => {
    render(<CompatibilityPreview mareName="Luna" stallionName="Atlas" data={sampleData} />);
    expect(screen.getByTestId('compatibility-preview')).toBeInTheDocument();
  });

  it('displays mare and stallion names', () => {
    render(<CompatibilityPreview mareName="Luna" stallionName="Atlas" data={sampleData} />);
    // Names appear in a combined text node: "Luna × Atlas"
    expect(screen.getByText(/Luna/)).toBeInTheDocument();
    expect(screen.getByText(/Atlas/)).toBeInTheDocument();
  });

  it('renders all 4 tab buttons', () => {
    render(<CompatibilityPreview mareName="Luna" stallionName="Atlas" data={sampleData} />);
    const tabList = screen.getByRole('tablist');
    expect(tabList).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Stats' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Traits' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Inbreeding' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pedigree' })).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    const { container } = render(
      <CompatibilityPreview mareName="Luna" stallionName="Atlas" data={null} isLoading />
    );
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows loading skeleton when data is null', () => {
    const { container } = render(
      <CompatibilityPreview mareName="Luna" stallionName="Atlas" data={null} />
    );
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  describe('Tab switching', () => {
    it('shows Stats tab content by default', () => {
      render(<CompatibilityPreview mareName="Luna" stallionName="Atlas" data={sampleData} />);
      // Stats tab should show the radar chart
      expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
    });

    it('switches to Traits tab on click', async () => {
      const user = userEvent.setup();
      render(<CompatibilityPreview mareName="Luna" stallionName="Atlas" data={sampleData} />);
      await user.click(screen.getByRole('tab', { name: 'Traits' }));
      expect(screen.getByText('Speed Demon')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('switches to Inbreeding tab on click', async () => {
      const user = userEvent.setup();
      render(<CompatibilityPreview mareName="Luna" stallionName="Atlas" data={sampleData} />);
      await user.click(screen.getByRole('tab', { name: 'Inbreeding' }));
      expect(screen.getByText('5%')).toBeInTheDocument();
      expect(screen.getByText('Inbreeding coefficient')).toBeInTheDocument();
    });

    it('switches to Pedigree tab on click', async () => {
      const user = userEvent.setup();
      render(<CompatibilityPreview mareName="Luna" stallionName="Atlas" data={sampleData} />);
      await user.click(screen.getByRole('tab', { name: 'Pedigree' }));
      expect(screen.getByText('Eclipse')).toBeInTheDocument();
      expect(screen.getByText('3 gens back')).toBeInTheDocument();
    });
  });

  describe('Inbreeding warning', () => {
    it('shows warning when coefficient >= 12.5%', async () => {
      const user = userEvent.setup();
      render(
        <CompatibilityPreview mareName="Luna" stallionName="Atlas" data={highInbreedingData} />
      );
      await user.click(screen.getByRole('tab', { name: 'Inbreeding' }));
      expect(screen.getByText(/High inbreeding coefficient/)).toBeInTheDocument();
    });

    it('shows healthy message when coefficient < 12.5%', async () => {
      const user = userEvent.setup();
      render(<CompatibilityPreview mareName="Luna" stallionName="Atlas" data={sampleData} />);
      await user.click(screen.getByRole('tab', { name: 'Inbreeding' }));
      expect(screen.getByText(/Low inbreeding/)).toBeInTheDocument();
    });
  });

  describe('Pedigree', () => {
    it('shows "no common ancestors" when overlap is empty and no tree', async () => {
      const user = userEvent.setup();
      const noOverlapData: CompatibilityData = {
        ...sampleData,
        pedigreeOverlap: [],
      };
      render(<CompatibilityPreview mareName="Luna" stallionName="Atlas" data={noOverlapData} />);
      await user.click(screen.getByRole('tab', { name: 'Pedigree' }));
      expect(screen.getByText('No common ancestors')).toBeInTheDocument();
    });

    // Equoria-55bo.2: when a real 3-generation tree is present the Pedigree
    // tab must render the recursive ancestor tree, NOT the flat overlap.
    it('renders the real 3-generation ancestor tree when pedigreeTree is present', async () => {
      const user = userEvent.setup();
      const treeData: CompatibilityData = {
        ...sampleData,
        pedigreeOverlap: [],
        pedigreeTree: {
          stallion: {
            id: 1,
            name: 'Atlas',
            generation: 0,
            sire: {
              id: 11,
              name: 'Atlas Sire',
              generation: 1,
              sire: {
                id: 111,
                name: 'Atlas GrandSire',
                generation: 2,
                sire: null,
                dam: null,
              },
              dam: null,
            },
            dam: { id: 12, name: 'Atlas Dam', generation: 1, sire: null, dam: null },
          },
          mare: {
            id: 2,
            name: 'Luna',
            generation: 0,
            sire: { id: 21, name: 'Luna Sire', generation: 1, sire: null, dam: null },
            dam: null,
          },
        },
      };
      render(<CompatibilityPreview mareName="Luna" stallionName="Atlas" data={treeData} />);
      await user.click(screen.getByRole('tab', { name: 'Pedigree' }));

      // Real tree container present; flat "no common ancestors" NOT shown
      expect(screen.getByTestId('pedigree-tree')).toBeInTheDocument();
      expect(screen.queryByText('No common ancestors')).not.toBeInTheDocument();

      // 3 generations of real ancestors rendered (proves recursive tree)
      expect(screen.getByText('Atlas Sire')).toBeInTheDocument();
      expect(screen.getByText('Atlas Dam')).toBeInTheDocument();
      expect(screen.getByText('Atlas GrandSire')).toBeInTheDocument();
      expect(screen.getByText('Luna Sire')).toBeInTheDocument();
      expect(screen.getByTestId('pedigree-root-sire')).toBeInTheDocument();
      expect(screen.getByTestId('pedigree-root-dam')).toBeInTheDocument();
    });
  });
});
