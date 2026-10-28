/**
 * Train from a horse arrives with that horse chosen (Equoria-vlpz4, NAV-02).
 *
 * The horse page, its action bar and Next Actions send /training?horseId=<id>;
 * the Training Center read only ?horse=, so the player landed on the list with
 * nothing chosen. Real TrainingDashboard, hooks and apiClient; only the network
 * boundary is stubbed (MSW).
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { server } from '@/test/msw/server';
import TrainingDashboard from '../TrainingDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const userId = '11111111-1111-4111-8111-111111111111';

const horse = (id: number, name: string) => ({
  id,
  horseId: id,
  name,
  age: 6,
  ageYears: 6,
  breed: 'Thoroughbred',
  sex: 'Mare',
  trainableDisciplines: ['Dressage'],
  bestDisciplines: [],
  nextEligibleAt: null,
  canTrain: true,
  ineligibleReason: null,
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe" data-search={location.search} />;
}

function renderAt(url: string) {
  server.use(
    http.get(`${base}/api/v1/training/trainable/${userId}`, () =>
      HttpResponse.json({
        success: true,
        data: [horse(1, 'Fit Filly'), horse(2, 'Moonflower')],
      })
    )
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <TrainingDashboard userId={userId} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Training Center — ?horseId= from a horse (Equoria-vlpz4)', () => {
  it('opens the session for the horse the player came from', async () => {
    renderAt('/training?horseId=2');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText(/Moonflower/).length).toBeGreaterThan(0);
    expect(within(dialog).queryByText(/Fit Filly/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('location-probe').getAttribute('data-search')).toBe('')
    );
  });

  it('still honors the older ?horse= link', async () => {
    renderAt('/training?horse=2');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText(/Moonflower/).length).toBeGreaterThan(0);
    expect(within(dialog).queryByText(/Fit Filly/)).not.toBeInTheDocument();
  });
});
