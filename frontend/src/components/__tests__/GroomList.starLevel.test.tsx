/**
 * Groom marketplace cards show the groom's star level and put the hire fee on
 * the button (owner ruling 2026-10-28, Equoria-nawn5): Rookie 1 star 100 ...
 * Expert 5 stars 500, per week; hiring charges one week. An offer from before
 * star levels still shows the week it advertised (seven sessions).
 *
 * The real AuthProvider is seeded through the real api client, with MSW at the
 * network boundary.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { BrowserRouter } from '../../test/utils';
import { AuthProvider } from '../../contexts/AuthContext';
import { authApi, type MarketplaceData } from '../../lib/api-client';
import { server } from '../../test/msw/server';
import GroomList from '../GroomList';

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const offer = (overrides: Record<string, unknown>) => ({
  marketplaceId: 'groom-x',
  firstName: 'Nell',
  lastName: 'Ashby',
  specialty: 'general',
  skillLevel: 'intermediate',
  personality: 'patient',
  experience: 5,
  sessionRate: 30,
  bio: 'Steady hands',
  availability: true,
  ...overrides,
});

const marketplace = (grooms: unknown[]) => ({
  grooms,
  lastRefresh: new Date().toISOString(),
  nextFreeRefresh: new Date(Date.now() + 86400000).toISOString(),
  feePerHorsePerWeek: 70,
  maxHorsesPerGroom: 20,
  refreshCost: 0,
  canRefreshFree: true,
  refreshCount: 0,
});

async function renderList(grooms: unknown[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  server.use(
    http.get(`${apiBase}/api/v1/auth/profile`, () =>
      HttpResponse.json({
        status: 'success',
        data: { user: { id: 1, money: 5000, username: 'starshopper', email: 's@example.com' } },
      })
    )
  );
  await queryClient.fetchQuery({ queryKey: ['profile'], queryFn: authApi.getProfile });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <GroomList
            userId={1}
            marketplaceData={marketplace(grooms) as unknown as MarketplaceData}
          />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('GroomList star levels (Equoria-nawn5)', () => {
  it("shows the level and stars, and the week's fee from the level on the button", async () => {
    await renderList([offer({ starLevel: 'intermediate', weeklyFee: 300 })]);

    const card = await screen.findByTestId('groom-card-groom-x');
    expect(within(card).getByTestId('staff-level')).toHaveTextContent('Intermediate★★★, 3 stars');
    const hire = within(card).getByRole('button', { name: 'Hire Nell Ashby' });
    expect(hire).toHaveTextContent('300');
    expect(hire).not.toHaveTextContent('210');
    // Never the stored word.
    expect(within(card).queryByText('intermediate')).not.toBeInTheDocument();
  });

  it('an offer from before star levels shows the week it advertised', async () => {
    await renderList([offer({})]);

    const card = await screen.findByTestId('groom-card-groom-x');
    expect(within(card).getByRole('button', { name: 'Hire Nell Ashby' })).toHaveTextContent('210');
    expect(within(card).getByTestId('staff-level')).toHaveTextContent('Unrated');
  });
});
