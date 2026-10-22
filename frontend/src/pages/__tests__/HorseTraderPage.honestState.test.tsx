/**
 * HorseTraderPage — breeds-source failure and unknown balance (Equoria-si3m2)
 *
 * A failed breeds fetch used to re-enable the search input over an empty
 * dropdown with no message: the purchase flow silently dead-ended. It must say
 * what failed and offer a retry, and a successful-but-empty catalog must be
 * named rather than leaving an absent dropdown. While the profile has no
 * balance the page must not claim "Your balance: 0".
 *
 * Real page + real hooks + real apiClient; MSW only at the HTTP boundary.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import HorseTraderPage from '../HorseTraderPage';

const BREEDS = [
  { id: 1, name: 'Thoroughbred', description: 'A fast breed' },
  { id: 2, name: 'Arabian', description: 'An endurance breed' },
];

const breedsOk = (breeds = BREEDS) =>
  HttpResponse.json({ success: true, data: breeds, count: breeds.length });

function profileHandler(money?: number) {
  return http.get('*/api/v1/auth/profile', () =>
    HttpResponse.json({
      status: 'success',
      data: { user: { id: 1, username: 'tester', email: 't@example.com', role: 'user', money } },
    })
  );
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HorseTraderPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HorseTraderPage breeds source (Equoria-si3m2)', () => {
  it('shows an error with retry when the breeds request fails; no live-looking search', async () => {
    server.use(
      profileHandler(5000),
      http.get('*/api/v1/breeds', () =>
        HttpResponse.json({ status: 'error', message: 'breeds boom' }, { status: 500 })
      )
    );

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Breed')).toBeDisabled();
    expect(screen.queryByText(/breeds boom/i)).not.toBeInTheDocument();
  });

  it('retry re-fetches the breeds and enables the combobox', async () => {
    let calls = 0;
    server.use(
      profileHandler(5000),
      http.get('*/api/v1/breeds', () => {
        calls += 1;
        return calls === 1 ? HttpResponse.json({ status: 'error' }, { status: 500 }) : breedsOk();
      })
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /try again/i }));

    const input = screen.getByLabelText('Breed');
    await user.click(input);
    const list = await screen.findByTestId('breed-dropdown');
    expect(within(list).getByText('Arabian')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('names a successful but empty breed catalog instead of an absent dropdown', async () => {
    server.use(
      profileHandler(5000),
      http.get('*/api/v1/breeds', () => breedsOk([]))
    );

    renderPage();

    expect(await screen.findByText(/no breeds are available/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('HorseTraderPage balance (Equoria-si3m2)', () => {
  it('shows an unknown balance as "—", not 0, with no insufficient-funds warning', async () => {
    server.use(
      profileHandler(undefined),
      http.get('*/api/v1/breeds', () => breedsOk())
    );

    renderPage();

    const row = await screen.findByTestId('price-balance-row');
    // Wait for the profile to settle (the request resolves without a balance).
    await within(row).findByLabelText(/unknown amount/i);
    expect(row).not.toHaveTextContent('⚠');
  });
});
