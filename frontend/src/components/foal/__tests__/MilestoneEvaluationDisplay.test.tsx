/**
 * MilestoneEvaluationDisplay Tests
 *
 * Verifies the component uses real breedingApi.getFoalDevelopment and real empty states.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MilestoneEvaluationDisplay from '../MilestoneEvaluationDisplay';

// Mock the real API boundary
vi.mock('@/lib/api-client', () => ({
  breedingApi: {
    getFoalDevelopment: vi.fn(async (foalId: number) => ({
      foalId,
      currentDay: 14,
      maxDay: 180,
      bondingLevel: 65,
      stressLevel: 20,
      stage: 'early',
    })),
  },
}));

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('MilestoneEvaluationDisplay', () => {
  it('shows loading state initially', () => {
    render(<MilestoneEvaluationDisplay foalId={1} />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('milestone-evaluation-loading')).toBeInTheDocument();
  });

  it('renders development data after load', async () => {
    render(<MilestoneEvaluationDisplay foalId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('milestone-evaluation-display')).toBeInTheDocument();
    });

    expect(screen.getByText('14 / 180')).toBeInTheDocument();
    expect(screen.getByText('65')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('early')).toBeInTheDocument();
  });

  it('does not show beta-exclusion copy for evaluation history', async () => {
    render(<MilestoneEvaluationDisplay foalId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('milestone-evaluation-display')).toBeInTheDocument();
    });

    expect(screen.queryByText(/not available in this beta/i)).not.toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    const { breedingApi } = await import('@/lib/api-client');
    (breedingApi.getFoalDevelopment as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error')
    );

    render(<MilestoneEvaluationDisplay foalId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('milestone-evaluation-error')).toBeInTheDocument();
    });
  });

  it('shows empty state when API returns null', async () => {
    const { breedingApi } = await import('@/lib/api-client');
    (breedingApi.getFoalDevelopment as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    render(<MilestoneEvaluationDisplay foalId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('milestone-evaluation-empty')).toBeInTheDocument();
    });
  });

  it('does not render mock evaluation history (no mockApi)', async () => {
    render(<MilestoneEvaluationDisplay foalId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('milestone-evaluation-display')).toBeInTheDocument();
    });

    // Old mock data should NOT appear
    expect(screen.queryByText(/Socialization Complete/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Imprinting/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('evaluation-item-socialization')).not.toBeInTheDocument();
  });
});
