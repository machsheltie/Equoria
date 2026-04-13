/**
 * BreedingPredictionsPanel Tests
 *
 * Verifies the panel uses real horsesApi.get calls and shows honest
 * beta-readonly notice for advanced predictions.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BreedingPredictionsPanel from '../BreedingPredictionsPanel';

// Mock the horsesApi — real API boundary
vi.mock('@/lib/api-client', () => ({
  horsesApi: {
    get: vi.fn(async (id: number) => ({
      id,
      name: id === 1 ? 'Sire Horse' : 'Dam Horse',
      breed: 'Thoroughbred',
      age: 5,
      gender: 'Male',
      dateOfBirth: '2021-01-01',
      healthStatus: 'Healthy',
      stats: {
        precision: 80,
        strength: 75,
        speed: 85,
        agility: 90,
        endurance: 80,
        intelligence: 88,
        stamina: 82,
        balance: 78,
        boldness: 70,
        flexibility: 75,
        obedience: 85,
        focus: 80,
      },
      disciplineScores: {},
    })),
  },
}));

// Mock BetaExcludedNotice to simplify assertion
vi.mock('@/components/beta/BetaExcludedNotice', () => ({
  default: ({ testId, message }: { testId?: string; message?: string }) => (
    <div data-testid={testId ?? 'beta-excluded-notice'}>{message}</div>
  ),
}));

const makeWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('BreedingPredictionsPanel', () => {
  it('shows loading state initially', () => {
    render(<BreedingPredictionsPanel sireId={1} damId={2} />, {
      wrapper: makeWrapper(),
    });

    expect(screen.getByTestId('breeding-predictions-loading')).toBeInTheDocument();
  });

  it('renders panel with real horse names after data loads', async () => {
    render(<BreedingPredictionsPanel sireId={1} damId={2} />, {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId('breeding-predictions-panel')).toBeInTheDocument();
    });

    expect(screen.getByText(/Sire Horse/)).toBeInTheDocument();
    expect(screen.getByText(/Dam Horse/)).toBeInTheDocument();
  });

  it('shows beta-readonly notice for advanced predictions', async () => {
    render(<BreedingPredictionsPanel sireId={1} damId={2} />, {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId('breeding-predictions-beta-notice')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Advanced trait inheritance predictions.*not available in this beta/i)
    ).toBeInTheDocument();
  });

  it('shows error state when horsesApi fails', async () => {
    const { horsesApi } = await import('@/lib/api-client');
    (horsesApi.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    render(<BreedingPredictionsPanel sireId={1} damId={2} />, {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId('breeding-predictions-error')).toBeInTheDocument();
    });
  });

  it('does not render mock horse data (no mockApi)', async () => {
    render(<BreedingPredictionsPanel sireId={1} damId={2} />, {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId('breeding-predictions-panel')).toBeInTheDocument();
    });

    // Mock horse names from old mockApi should NOT appear
    expect(screen.queryByText(/Thunder/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lightning/)).not.toBeInTheDocument();
  });
});
