/**
 * TrainingHistoryPanel shows the scores the API really sends (Equoria-da2fw).
 *
 * The panel read `entry.score` from the training history and the status
 * endpoint, neither of which ever carried one, so every row said "Score: —".
 * Since Equoria-ky2ob a session records scoreBefore/scoreAfter; the status
 * section's current score is the horse's own disciplineScores (keyed by name).
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import TrainingHistoryPanel from '../TrainingHistoryPanel';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const renderPanel = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TrainingHistoryPanel horseId={7} />
    </QueryClientProvider>
  );
};

describe('TrainingHistoryPanel scores (Equoria-da2fw)', () => {
  it('shows before to after for a recorded session, and a dash only for a legacy session', async () => {
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId`, () =>
        HttpResponse.json({ success: true, data: {} })
      ),
      http.get(`${base}/api/v1/horses/:id/training-history`, () =>
        HttpResponse.json({
          success: true,
          data: {
            trainingHistory: [
              {
                id: 1,
                discipline: 'Dressage',
                trainedAt: '2026-10-01T12:00:00Z',
                scoreBefore: 35,
                scoreAfter: 40,
              },
              {
                id: 2,
                discipline: 'Racing',
                trainedAt: '2026-09-01T12:00:00Z',
                scoreBefore: null,
                scoreAfter: null,
              },
            ],
            disciplineBalance: {},
            trainingFrequency: {},
          },
        })
      )
    );

    renderPanel();

    await waitFor(() => expect(screen.getByText('35 → 40', { exact: false })).toBeInTheDocument());
    expect(screen.getAllByText(/Score:/)).toHaveLength(2);
    expect(screen.getByText(/Score: —/)).toBeInTheDocument();
  });

  it("shows each discipline's current score from the horse, keyed by discipline name", async () => {
    server.use(
      http.get(`${base}/api/v1/training/status/:horseId`, () =>
        HttpResponse.json({
          success: true,
          data: {
            Dressage: { nextEligibleDate: null },
            'Show Jumping': { nextEligibleDate: null },
          },
        })
      ),
      http.get(`${base}/api/v1/horses/:id`, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: 7,
            name: 'TestFixture-Scored',
            breed: 'Thoroughbred',
            gender: 'mare',
            age: 5,
            ageYears: 5,
            dateOfBirth: '2020-01-01T00:00:00Z',
            healthStatus: 'Good',
            stats: {},
            disciplineScores: { Dressage: 40, 'Show Jumping': 12 },
          },
        })
      )
    );

    renderPanel();

    const dressage = await screen.findByText('Dressage');
    await waitFor(() =>
      expect(
        within(dressage.parentElement as HTMLElement).getByText('Score: 40')
      ).toBeInTheDocument()
    );
    const jumping = screen.getByText('Show Jumping');
    expect(within(jumping.parentElement as HTMLElement).getByText('Score: 12')).toBeInTheDocument();
  });
});
