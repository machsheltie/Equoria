/**
 * StableView player strip — secondary-query failure is not 0 coins / level 1
 * (Equoria-rbso5)
 *
 * The strip reads useProfile. When the profile request failed it rendered
 * 0 coins, 0 XP, level 1 and an empty XP bar: plausible, false numbers. The
 * strip must show an honest "—" instead, while the roster (a separate query)
 * stays intact. The horse count is likewise unknown — not 0 — until the
 * roster has actually loaded.
 *
 * Real page + real hooks + real apiClient; MSW only at the HTTP boundary.
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { server } from '@/test/msw/server';
import StableView from '../StableView';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <StableView />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const profileOk = {
  status: 'success',
  data: {
    user: {
      id: 7,
      username: 'StripTester',
      email: 's@example.com',
      role: 'user',
      money: 12345,
      xp: 250,
      level: 4,
    },
  },
};

describe('StableView player strip (Equoria-rbso5)', () => {
  it('shows "—" (not 0 coins / level 1) when the profile request fails, roster intact', async () => {
    server.use(
      http.get(`${base}/api/v1/auth/profile`, () =>
        HttpResponse.json({ status: 'error', message: 'profile boom' }, { status: 500 })
      )
    );

    renderPage();

    // The roster (independent query) still renders.
    expect(await screen.findByText('Storm Runner')).toBeInTheDocument();

    const strip = screen.getByTestId('stable-player-info');
    expect(within(strip).getByLabelText(/unknown amount/i)).toBeInTheDocument();
    expect(within(strip).getAllByText('—').length).toBeGreaterThanOrEqual(2); // XP + level
    // No fabricated level 1 / zero XP.
    expect(within(strip).queryByText('1')).not.toBeInTheDocument();
    expect(within(strip).queryByText('0')).not.toBeInTheDocument();
  });

  it('shows the real coins, XP and level when the profile loads', async () => {
    server.use(http.get(`${base}/api/v1/auth/profile`, () => HttpResponse.json(profileOk)));

    renderPage();
    await screen.findByText('Storm Runner');

    const strip = screen.getByTestId('stable-player-info');
    expect(await within(strip).findByText('4')).toBeInTheDocument();
    expect(within(strip).getByText('250')).toBeInTheDocument();
    expect(strip).toHaveTextContent('12,345');
  });

  it('does not show a horse count of 0 while the roster is still loading', async () => {
    server.use(
      http.get(`${base}/api/v1/auth/profile`, () => HttpResponse.json(profileOk)),
      http.get(`${base}/api/v1/horses`, async () => {
        await delay(150);
        return HttpResponse.json({ success: true, data: [] });
      })
    );

    renderPage();

    const strip = screen.getByTestId('stable-player-info');
    const horsesLabel = within(strip).getByText('Horses');
    expect(horsesLabel.nextElementSibling).toHaveTextContent('—');
    expect(horsesLabel.nextElementSibling).not.toHaveTextContent('0');
  });
});
