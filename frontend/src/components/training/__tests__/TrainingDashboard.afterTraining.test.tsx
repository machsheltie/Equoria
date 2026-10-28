/**
 * Training Center: after a session the popup closes and the horse's row moves
 * on the page (owner ruling q173, 2026-10-28: success is the page itself
 * changing, no popups, no log).
 *
 * Old contract: a successful train turned the session popup into a "Training
 * Complete" results view (TrainingResultsDisplay, removed) that stayed open
 * until Close. Ruling: the popup closes, and the horse leaves "Ready to Train"
 * for the cooldown list from the server's own answer.
 *
 * The real TrainingDashboard, TrainingSessionModal, hooks and apiClient run;
 * only the network boundary is stubbed (MSW).
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { server } from '@/test/msw/server';
import TrainingDashboard from '../TrainingDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const userId = '11111111-1111-4111-8111-111111111111';
const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const filly = (trained: boolean) => ({
  id: 1,
  horseId: 1,
  name: 'Fit Filly',
  age: 6,
  ageYears: 6,
  breed: 'Thoroughbred',
  sex: 'Mare',
  trainableDisciplines: ['Dressage'],
  bestDisciplines: [],
  nextEligibleAt: trained ? nextWeek : null,
  canTrain: !trained,
  ineligibleReason: null,
});

describe('Training Center after a session (q173)', () => {
  it('closes the popup and moves the horse out of Ready to Train', async () => {
    let trained = false;
    server.use(
      http.get(`${base}/api/v1/training/trainable/${userId}`, () =>
        HttpResponse.json({ success: true, data: [filly(trained)] })
      ),
      http.post(`${base}/api/v1/training/train`, () => {
        trained = true;
        return HttpResponse.json({
          success: true,
          data: {
            updatedScore: 35,
            nextEligibleDate: nextWeek,
            discipline: 'Barrel Racing',
            horseId: 1,
            message: 'Training completed successfully',
          },
        });
      })
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TrainingDashboard userId={userId} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const ready = await screen.findByTestId('section-ready');
    expect(within(ready).getByText('Fit Filly')).toBeInTheDocument();
    await user.click(screen.getByTestId('train-button-1'));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /start training|train horse/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText(/training complete/i)).not.toBeInTheDocument();
    const cooldown = await screen.findByTestId('section-cooldown');
    expect(within(cooldown).getByText('Fit Filly')).toBeInTheDocument();
    expect(screen.queryByTestId('section-ready')).not.toBeInTheDocument();
  });
});
