/**
 * BreedingPredictionsPanel Tests
 *
 * Verifies the panel uses real horsesApi.get calls and does not show beta exclusions.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 * Equoria-f12xy: Migrated off the api-client module mock to MSW at the
 *   network (fetch) boundary. The panel self-fetches the sire + dam via
 *   horsesApi.get → GET /api/v1/horses/:id and renders ColorPredictionChart,
 *   which posts to /api/v1/horses/breeding/color-prediction. MSW intercepts
 *   both at the fetch layer, exercising the real api-client request/unwrap
 *   path. MSW does not mock the api-client module, so the eslint
 *   no-restricted-imports api-client-mock rule stays clean.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../../test/msw/server';
import BreedingPredictionsPanel from '../BreedingPredictionsPanel';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** Default happy-path handlers for the two horses + the color-prediction chart. */
function useDefaultHandlers() {
  server.use(
    http.get(`${base}/api/v1/horses/:id`, ({ params }) => {
      const id = Number(params.id);
      return HttpResponse.json({
        success: true,
        data: {
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
        },
      });
    }),
    // ColorPredictionChart (rendered by the panel) posts here. Provide a
    // benign empty-distribution payload so the nested query resolves cleanly
    // rather than tripping MSW's onUnhandledRequest:'error'.
    http.post(`${base}/api/v1/horses/breeding/color-prediction`, () =>
      HttpResponse.json({
        success: true,
        data: {
          possibleColors: [],
          totalCombinations: 0,
          lethalCombinationsFiltered: 0,
        },
      })
    )
  );
}

const makeWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('BreedingPredictionsPanel', () => {
  beforeEach(() => {
    useDefaultHandlers();
  });

  it('shows loading state initially', () => {
    // Override the horse handler with a never-resolving response so the
    // panel stays in its loading state for the assertion.
    server.use(http.get(`${base}/api/v1/horses/:id`, () => new Promise(() => {})));

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

  it('does not show beta-exclusion copy for advanced predictions', async () => {
    render(<BreedingPredictionsPanel sireId={1} damId={2} />, {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByTestId('breeding-predictions-panel')).toBeInTheDocument();
    });

    expect(screen.queryByText(/not available in this beta/i)).not.toBeInTheDocument();
  });

  it('shows error state when horsesApi fails', async () => {
    // Override with a 500 so the api-client surfaces an error to the query.
    server.use(
      http.get(`${base}/api/v1/horses/:id`, () =>
        HttpResponse.json({ status: 'error', message: 'Network error' }, { status: 500 })
      )
    );

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
