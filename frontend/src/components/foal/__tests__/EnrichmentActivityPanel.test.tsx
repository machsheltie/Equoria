/**
 * EnrichmentActivityPanel Tests
 *
 * Verifies the component uses real breedingApi.getFoalActivities and shows
 * honest beta-readonly notice for interactive enrichment features.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EnrichmentActivityPanel from '../EnrichmentActivityPanel';
import type { Foal } from '@/types/foal';

// Mock the real API boundary
vi.mock('@/lib/api-client', () => ({
  breedingApi: {
    getFoalActivities: vi.fn(async () => [
      { id: 1, activity: 'Gentle Touch', createdAt: '2026-04-10T10:00:00Z' },
      { id: 2, activity: 'Sound Exposure', createdAt: '2026-04-09T10:00:00Z' },
    ]),
  },
}));

// Mock BetaExcludedNotice to simplify assertions
vi.mock('@/components/beta/BetaExcludedNotice', () => ({
  default: ({ testId, message }: { testId?: string; message?: string }) => (
    <div data-testid={testId ?? 'beta-excluded-notice'}>{message}</div>
  ),
}));

const mockFoal: Foal = {
  id: 1,
  name: 'Test Foal',
  age: 15,
  birthdate: '2024-01-01',
  sex: 'male',
  developmentStage: 'critical',
  bondingLevel: 50,
  stressLevel: 25,
};

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('EnrichmentActivityPanel', () => {
  it('shows loading state initially', () => {
    render(<EnrichmentActivityPanel foal={mockFoal} />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('enrichment-activity-loading')).toBeInTheDocument();
  });

  it('renders panel with activity history after load', async () => {
    render(<EnrichmentActivityPanel foal={mockFoal} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('enrichment-activity-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('enrichment-activity-history')).toBeInTheDocument();
    expect(screen.getByText('Gentle Touch')).toBeInTheDocument();
    expect(screen.getByText('Sound Exposure')).toBeInTheDocument();
  });

  it('shows beta-readonly notice for interactive enrichment features', async () => {
    render(<EnrichmentActivityPanel foal={mockFoal} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('enrichment-activity-beta-notice')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Interactive enrichment activities are not available in this beta/i)
    ).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    const { breedingApi } = await import('@/lib/api-client');
    (breedingApi.getFoalActivities as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error')
    );

    render(<EnrichmentActivityPanel foal={mockFoal} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('enrichment-activity-error')).toBeInTheDocument();
    });
  });

  it('shows empty history state when no activities returned', async () => {
    const { breedingApi } = await import('@/lib/api-client');
    (breedingApi.getFoalActivities as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    render(<EnrichmentActivityPanel foal={mockFoal} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('enrichment-activity-empty')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('enrichment-activity-history')).not.toBeInTheDocument();
  });

  it('does not render mock enrichment status (no mockApi)', async () => {
    render(<EnrichmentActivityPanel foal={mockFoal} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('enrichment-activity-panel')).toBeInTheDocument();
    });

    // Old mock data structures should NOT appear
    expect(screen.queryByText('1 / 5')).not.toBeInTheDocument();
    expect(screen.queryByText('Daily Activities Completed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activity-card-gentle-touch')).not.toBeInTheDocument();
    expect(screen.queryByTestId('category-filter')).not.toBeInTheDocument();
  });
});
