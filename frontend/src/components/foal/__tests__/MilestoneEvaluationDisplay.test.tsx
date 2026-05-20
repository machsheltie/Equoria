/**
 * MilestoneEvaluationDisplay Tests
 *
 * Verifies the component uses real breedingApi.getFoalDevelopment and real empty states.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 * Equoria-f12xy: Migrated off the api-client module mock to MSW at the
 *   network (fetch) boundary. The component self-fetches via
 *   breedingApi.getFoalDevelopment → GET /api/v1/foals/:id/development, so MSW
 *   exercises the real api-client request/response/unwrap path while keeping
 *   the test hermetic. MSW does not mock the api-client module, so the
 *   eslint no-restricted-imports api-client-mock rule stays clean.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../../test/msw/server';
import MilestoneEvaluationDisplay from '../MilestoneEvaluationDisplay';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('MilestoneEvaluationDisplay', () => {
  it('shows loading state initially', () => {
    // Never-resolving handler keeps the query in flight so the loading state is observable.
    server.use(
      http.get(`${base}/api/v1/foals/:id/development`, () => new Promise(() => {}))
    );

    render(<MilestoneEvaluationDisplay foalId={1} />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('milestone-evaluation-loading')).toBeInTheDocument();
  });

  it('renders development data after load', async () => {
    server.use(
      http.get(`${base}/api/v1/foals/:id/development`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            foalId: Number(params.id),
            currentDay: 14,
            maxDay: 180,
            bondingLevel: 65,
            stressLevel: 20,
            stage: 'early',
          },
        })
      )
    );

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
    server.use(
      http.get(`${base}/api/v1/foals/:id/development`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            foalId: Number(params.id),
            currentDay: 14,
            maxDay: 180,
            bondingLevel: 65,
            stressLevel: 20,
            stage: 'early',
          },
        })
      )
    );

    render(<MilestoneEvaluationDisplay foalId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('milestone-evaluation-display')).toBeInTheDocument();
    });

    expect(screen.queryByText(/not available in this beta/i)).not.toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    server.use(
      http.get(`${base}/api/v1/foals/:id/development`, () =>
        HttpResponse.json({ status: 'error', message: 'Network error' }, { status: 500 })
      )
    );

    render(<MilestoneEvaluationDisplay foalId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('milestone-evaluation-error')).toBeInTheDocument();
    });
  });

  it('shows empty state when API returns null', async () => {
    // api-client unwraps `data.data`; a null payload surfaces as `development === null`.
    server.use(
      http.get(`${base}/api/v1/foals/:id/development`, () =>
        HttpResponse.json({ success: true, data: null })
      )
    );

    render(<MilestoneEvaluationDisplay foalId={1} />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('milestone-evaluation-empty')).toBeInTheDocument();
    });
  });

  it('does not render mock evaluation history (no mockApi)', async () => {
    server.use(
      http.get(`${base}/api/v1/foals/:id/development`, ({ params }) =>
        HttpResponse.json({
          success: true,
          data: {
            foalId: Number(params.id),
            currentDay: 14,
            maxDay: 180,
            bondingLevel: 65,
            stressLevel: 20,
            stage: 'early',
          },
        })
      )
    );

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
