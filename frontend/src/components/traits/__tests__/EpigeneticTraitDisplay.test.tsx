/**
 * EpigeneticTraitDisplay Tests
 *
 * Verifies the component uses real useHorseEpigeneticInsights hook and real empty states.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the real genetics hook at the boundary
vi.mock('@/hooks/useHorseGenetics', () => ({
  useHorseEpigeneticInsights: vi.fn(() => ({
    data: {
      traits: [
        {
          name: 'Calm Temperament',
          type: 'epigenetic',
          description: 'Even-tempered in stressful situations.',
          rarity: 'common',
          strength: 70,
          impact: { stats: { boldness: 5 } },
        },
        {
          name: 'Resilient Spirit',
          type: 'epigenetic',
          description: 'Bounces back from setbacks quickly.',
          rarity: 'rare',
          strength: 85,
          impact: { disciplines: { cross_country: 3 } },
        },
      ],
    },
    isLoading: false,
    error: null,
  })),
}));

// Import after mocks are registered
import { useHorseEpigeneticInsights } from '@/hooks/useHorseGenetics';
import EpigeneticTraitDisplay from '../EpigeneticTraitDisplay';

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('EpigeneticTraitDisplay', () => {
  beforeEach(() => {
    vi.mocked(useHorseEpigeneticInsights).mockReturnValue({
      data: {
        traits: [
          {
            name: 'Calm Temperament',
            type: 'epigenetic',
            description: 'Even-tempered in stressful situations.',
            rarity: 'common',
            strength: 70,
            impact: { stats: { boldness: 5 } },
          },
          {
            name: 'Resilient Spirit',
            type: 'epigenetic',
            description: 'Bounces back from setbacks quickly.',
            rarity: 'rare',
            strength: 85,
            impact: { disciplines: { cross_country: 3 } },
          },
        ],
      },
      isLoading: false,
      error: null,
    } as never);
  });

  it('shows loading state when hook is loading', () => {
    vi.mocked(useHorseEpigeneticInsights).mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);

    render(<EpigeneticTraitDisplay horseId={1} />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('epigenetic-loading')).toBeInTheDocument();
  });

  it('shows error state when hook returns an error', () => {
    vi.mocked(useHorseEpigeneticInsights).mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      error: new Error('API failed'),
    } as never);

    render(<EpigeneticTraitDisplay horseId={1} />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('epigenetic-error')).toBeInTheDocument();
    expect(screen.getByText(/API failed/i)).toBeInTheDocument();
  });

  it('renders trait display with real trait names', async () => {
    render(<EpigeneticTraitDisplay horseId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('epigenetic-trait-display')).toBeInTheDocument();
    });

    expect(screen.getByTestId('epigenetic-traits-list')).toBeInTheDocument();
    expect(screen.getByText('Calm Temperament')).toBeInTheDocument();
    expect(screen.getByText('Resilient Spirit')).toBeInTheDocument();
  });

  it('shows rarity labels on trait cards', async () => {
    render(<EpigeneticTraitDisplay horseId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('epigenetic-traits-list')).toBeInTheDocument();
    });

    expect(screen.getByText('common')).toBeInTheDocument();
    expect(screen.getByText('rare')).toBeInTheDocument();
  });

  it('shows empty state when no traits discovered', () => {
    vi.mocked(useHorseEpigeneticInsights).mockReturnValueOnce({
      data: { traits: [] },
      isLoading: false,
      error: null,
    } as never);

    render(<EpigeneticTraitDisplay horseId={1} />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('epigenetic-traits-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('epigenetic-traits-list')).not.toBeInTheDocument();
  });

  it('does not show beta-exclusion copy for advanced trait features', () => {
    render(<EpigeneticTraitDisplay horseId={1} />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('epigenetic-trait-display')).toBeInTheDocument();
    expect(screen.queryByText(/not available in this beta/i)).not.toBeInTheDocument();
  });

  it('does not render mock trait data (no mockApi)', () => {
    render(<EpigeneticTraitDisplay horseId={1} />, { wrapper: makeWrapper() });

    // Old mock data should NOT appear
    expect(screen.queryByText(/Phoenix-Born/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('hidden-trait-indicator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trait-card-common-trait')).not.toBeInTheDocument();
  });

  it('shows trait count in header', () => {
    render(<EpigeneticTraitDisplay horseId={1} />, { wrapper: makeWrapper() });

    expect(screen.getByText(/2 traits on record/i)).toBeInTheDocument();
  });
});
