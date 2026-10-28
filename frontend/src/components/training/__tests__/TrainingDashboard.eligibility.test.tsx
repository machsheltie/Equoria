/**
 * TrainingDashboard never calls a horse the server refuses "ready"
 * (Equoria-du9bn).
 *
 * The dashboard used to re-derive eligibility on the client from age (3+) and
 * cooldown only, so a retired (21+) horse, or one the server refuses for its
 * health, sat under "Ready to Train" and then failed when trained. It now
 * honours the server's refusal (`ineligibleReason`) and the active-age window.
 *
 * The real component, hooks, apiClient envelope unwrap and eligibility
 * utilities are driven; only the network boundary is stubbed (MSW) with the
 * exact trainable-horses payload shape the backend returns.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/test/msw/server';
import TrainingDashboard from '../TrainingDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const userId = '11111111-1111-4111-8111-111111111111';

const horse = (id: number, name: string, ageYears: number, extra: object = {}) => ({
  id,
  horseId: id,
  name,
  age: ageYears,
  ageYears,
  breed: 'Thoroughbred',
  sex: 'Mare',
  trainableDisciplines: ['Dressage'],
  bestDisciplines: [],
  nextEligibleAt: null,
  canTrain: true,
  ineligibleReason: null,
  ...extra,
});

describe('TrainingDashboard eligibility is the server truth (Equoria-du9bn)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    server.use(
      http.get(`${base}/api/v1/training/trainable/${userId}`, () =>
        HttpResponse.json({
          success: true,
          data: [
            horse(1, 'Fit Filly', 6),
            horse(2, 'Old Elder', 21, {
              canTrain: false,
              ineligibleReason: 'Horse is too old to train',
            }),
            horse(3, 'Unwell Mare', 8, {
              canTrain: false,
              ineligibleReason:
                'Unwell Mare is in Bad health and cannot train. Feed and vet her first.',
            }),
          ],
        })
      )
    );
  });

  function renderDashboard() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TrainingDashboard userId={userId} />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it('lists only the horse the server will train under Ready, and the others as ineligible', async () => {
    renderDashboard();

    const ready = await screen.findByTestId('section-ready');
    expect(within(ready).getByText('Fit Filly')).toBeInTheDocument();
    expect(within(ready).queryByText('Old Elder')).not.toBeInTheDocument();
    expect(within(ready).queryByText('Unwell Mare')).not.toBeInTheDocument();
    expect(screen.getByText('Ready to Train (1)')).toBeInTheDocument();

    const ineligible = screen.getByTestId('section-ineligible');
    expect(within(ineligible).getByText('Old Elder')).toBeInTheDocument();
    expect(within(ineligible).getByText('Unwell Mare')).toBeInTheDocument();
    expect(within(ineligible).getByText('Too Old')).toBeInTheDocument();
    expect(within(ineligible).getByText('Not Fit to Train')).toBeInTheDocument();

    // No Train button for a horse the server refuses.
    expect(screen.getByTestId('train-button-1')).toBeInTheDocument();
    expect(screen.queryByTestId('train-button-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('train-button-3')).not.toBeInTheDocument();
  });

  // Owner ruling 2026-10-28 (q227, Equoria-vtgeh): no horse-wide Level on the training
  // list; a level exists only per discipline.
  it('shows no horse-wide level, even if an old payload still sends one', async () => {
    server.use(
      http.get(`${base}/api/v1/training/trainable/${userId}`, () =>
        HttpResponse.json({ success: true, data: [horse(1, 'Fit Filly', 6, { level: 7 })] })
      )
    );
    renderDashboard();

    await screen.findByText('Fit Filly');
    expect(screen.queryByText(/Level 7/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Level\b/)).not.toBeInTheDocument();
  });
});
