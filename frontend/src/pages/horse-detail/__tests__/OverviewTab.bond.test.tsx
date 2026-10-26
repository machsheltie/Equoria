import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import OverviewTab from '../OverviewTab';
import type { Horse } from '../HorseDetailPageTypes';

/**
 * Owner ruling 2026-10-26 (Equoria-b76x0): bond stays and shows on every horse
 * page at every age. There is no stress.
 */

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const horseAged = (age: number, bondScore: number): Horse => ({
  id: 7,
  name: 'TestFixture-Comet',
  breed: 'Thoroughbred',
  age,
  gender: 'Mare',
  dateOfBirth: '2021-01-01T00:00:00Z',
  healthStatus: 'Excellent',
  stats: {} as Horse['stats'],
  disciplineScores: {},
  traits: [],
  displayedHealth: 'Good',
  feedHealth: 'Fair',
  bondScore,
});

const renderTab = (horse: Horse) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <OverviewTab horse={horse} />
    </QueryClientProvider>
  );
};

describe('OverviewTab bond (Equoria-b76x0)', () => {
  beforeEach(() => {
    server.use(
      http.get(`${base}/api/v1/horses/:id/overview`, () =>
        HttpResponse.json({
          success: true,
          data: { lastShod: null, lastTrainedAt: null, lastGroomed: null },
        })
      )
    );
  });

  it.each([0, 2, 9, 25])('shows the bond for a horse aged %i', (age) => {
    renderTab(horseAged(age, 42));
    const bond = screen.getByTestId('horse-bond');
    expect(within(bond).getByText('Bond')).toBeInTheDocument();
    expect(within(bond).getByRole('meter', { name: 'Bond' })).toHaveAttribute(
      'aria-valuenow',
      '42'
    );
    expect(bond).toHaveTextContent('42');
  });

  it('shows an unbonded horse as 0, not as missing', () => {
    renderTab(horseAged(5, 0));
    expect(screen.getByTestId('horse-bond')).toHaveTextContent('0');
  });

  it('never shows stress', () => {
    renderTab(horseAged(1, 80));
    expect(screen.queryByText(/stress/i)).not.toBeInTheDocument();
  });
});
