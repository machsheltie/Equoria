/**
 * Hub card Bad health line (Equoria-2uqdg, owner ruling 2026-10-23, decisions q28):
 * "<name> is in bad health and needs to be vetted.", adding "and fed" when the
 * horse's hunger (feedHealth, sent by GET /api/v1/horses) is Fair or Bad.
 *
 * Real Index page + real providers; MSW only at the HTTP boundary.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import Index from '../Index';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function badHealthHorse(id: number, name: string, feedHealth: string) {
  return {
    id,
    name,
    breed: 'Thoroughbred',
    sex: 'Mare',
    age: 6,
    ageYears: 6,
    healthStatus: 'Excellent',
    vetHealth: 'Bad',
    feedHealth,
    displayedHealth: 'Bad',
    stats: {},
  };
}

describe('Hub horse card Bad health line (Equoria-2uqdg, q28)', () => {
  it('names the horse and adds "and fed" only when hunger is Fair or Bad', async () => {
    server.use(
      http.get(`${base}/api/v1/horses`, () =>
        HttpResponse.json({
          success: true,
          data: [
            badHealthHorse(21, 'Blaze', 'Good'),
            badHealthHorse(22, 'Ember', 'Fair'),
            badHealthHorse(23, 'Willow', 'Bad'),
          ],
        })
      )
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MockAuthProvider userOverrides={{ completedOnboarding: false }}>
          <MemoryRouter>
            <Index />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    const blaze = await screen.findByTestId('dashboard-horse-card-21');
    expect(
      within(blaze).getByText('Blaze is in bad health and needs to be vetted.')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('dashboard-horse-card-22')).getByText(
        'Ember is in bad health and needs to be vetted and fed.'
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('dashboard-horse-card-23')).getByText(
        'Willow is in bad health and needs to be vetted and fed.'
      )
    ).toBeInTheDocument();
  });
});
