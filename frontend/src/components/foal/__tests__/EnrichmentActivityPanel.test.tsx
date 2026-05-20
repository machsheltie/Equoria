/**
 * EnrichmentActivityPanel Tests
 *
 * Verifies the component uses real breedingApi.getFoalActivities and real empty states.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 * Equoria-f12xy: Migrated off the api-client module mock to MSW at the
 *   network (fetch) boundary. The component self-fetches via
 *   breedingApi.getFoalActivities → GET /api/v1/foals/:id/activities, so MSW
 *   exercises the real api-client request/response/unwrap path while keeping
 *   the test hermetic. MSW does not mock the api-client module, so the
 *   eslint no-restricted-imports api-client-mock rule stays clean.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../../test/msw/server';
import EnrichmentActivityPanel from '../EnrichmentActivityPanel';
import type { Foal } from '@/types/foal';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

const twoActivities = [
  { id: 1, activity: 'Gentle Touch', createdAt: '2026-04-10T10:00:00Z' },
  { id: 2, activity: 'Sound Exposure', createdAt: '2026-04-09T10:00:00Z' },
];

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('EnrichmentActivityPanel', () => {
  it('shows loading state initially', () => {
    // Never-resolving handler keeps the query in flight so the loading state is observable.
    server.use(http.get(`${base}/api/v1/foals/:id/activities`, () => new Promise(() => {})));

    render(<EnrichmentActivityPanel foal={mockFoal} />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('enrichment-activity-loading')).toBeInTheDocument();
  });

  it('renders panel with activity history after load', async () => {
    server.use(
      http.get(`${base}/api/v1/foals/:id/activities`, () =>
        HttpResponse.json({ success: true, data: twoActivities })
      )
    );

    render(<EnrichmentActivityPanel foal={mockFoal} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('enrichment-activity-panel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('enrichment-activity-history')).toBeInTheDocument();
    expect(screen.getByText('Gentle Touch')).toBeInTheDocument();
    expect(screen.getByText('Sound Exposure')).toBeInTheDocument();
  });

  it('does not show beta-exclusion copy for interactive enrichment features', async () => {
    server.use(
      http.get(`${base}/api/v1/foals/:id/activities`, () =>
        HttpResponse.json({ success: true, data: twoActivities })
      )
    );

    render(<EnrichmentActivityPanel foal={mockFoal} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('enrichment-activity-panel')).toBeInTheDocument();
    });

    expect(screen.queryByText(/not available in this beta/i)).not.toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    server.use(
      http.get(`${base}/api/v1/foals/:id/activities`, () =>
        HttpResponse.json({ status: 'error', message: 'Network error' }, { status: 500 })
      )
    );

    render(<EnrichmentActivityPanel foal={mockFoal} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('enrichment-activity-error')).toBeInTheDocument();
    });
  });

  it('shows empty history state when no activities returned', async () => {
    server.use(
      http.get(`${base}/api/v1/foals/:id/activities`, () =>
        HttpResponse.json({ success: true, data: [] })
      )
    );

    render(<EnrichmentActivityPanel foal={mockFoal} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('enrichment-activity-empty')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('enrichment-activity-history')).not.toBeInTheDocument();
  });

  it('does not render mock enrichment status (no mockApi)', async () => {
    server.use(
      http.get(`${base}/api/v1/foals/:id/activities`, () =>
        HttpResponse.json({ success: true, data: twoActivities })
      )
    );

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
