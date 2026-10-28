/**
 * FarrierPage — Basic Shoes with a horse dropdown (owner ruling 2026-10-26, q78,
 * Equoria-zz14s).
 *
 * Old contract (retired with FarrierPage.bookingSuccess): a horse-card grid and
 * one "Shoe horse — 50 coins" button. New ruling: no My Horses format; the shoe
 * types are a data list (Basic Shoes, 50 for now), each a centred box with a
 * dropdown of the player's horses. A horse shod within the week is greyed out;
 * retired horses are not listed (the server leaves them out). The weekly
 * "Shoe horse" action (Equoria-zmqzf) is unchanged.
 *
 * Real page, real hooks, real apiClient; the HTTP boundary is stubbed by MSW.
 * apiClient unwraps the `{ success, data }` envelope, so the success handler
 * returns the real controller shape.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import FarrierPage from '../FarrierPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SERVICES = `${base}/api/v1/farrier/shoe-types`;
const HORSES = `${base}/api/v1/farrier/horses`;
const SHOE = `${base}/api/v1/farrier/shoe-horse`;

const services = [
  {
    id: 'basic-shoes',
    name: 'Basic Shoes',
    description: 'A standard set of shoes.',
    cost: 50,
    actionLabel: 'Shoe Horse',
  },
];
const horses = [
  { id: 1, name: 'Starlight', shod: false },
  { id: 2, name: 'Fresh Shoes', shod: true },
];

function stub(opts: { servicesBody?: unknown; horsesBody?: unknown } = {}) {
  server.use(
    http.get(SERVICES, () =>
      HttpResponse.json({ success: true, data: opts.servicesBody ?? services })
    ),
    http.get(HORSES, () => HttpResponse.json({ success: true, data: opts.horsesBody ?? horses }))
  );
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <FarrierPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FarrierPage (Equoria-zz14s)', () => {
  beforeEach(() => stub());

  it('offers the Basic Shoes service at 50 and no old service names or tabs', async () => {
    renderPage();
    const box = await screen.findByTestId('service-box-basic-shoes');
    expect(within(box).getByRole('heading', { name: 'Basic Shoes' })).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: /shoe horse/i })).toHaveTextContent('50');
    expect(screen.getAllByTestId(/^service-box-/)).toHaveLength(1);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText(/hoof trim|corrective|emergency/i)).not.toBeInTheDocument();
  });

  it('greys out a horse shod this week and keeps the others selectable', async () => {
    renderPage();
    const box = await screen.findByTestId('service-box-basic-shoes');
    expect(
      (within(box).getByRole('option', { name: /Starlight/ }) as HTMLOptionElement).disabled
    ).toBe(false);
    const fresh = within(box).getByRole('option', { name: /Fresh Shoes/ }) as HTMLOptionElement;
    expect(fresh.disabled).toBe(true);
    expect(fresh).toHaveTextContent(/already shod this week/i);
  });

  it('keeps the button disabled until a horse is chosen, then shows the success message', async () => {
    let body: unknown;
    server.use(
      http.post(SHOE, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          success: true,
          message: 'Starlight has been shod',
          data: {
            horse: { id: 1, name: 'Starlight', lastShod: '2026-10-26T14:00:00.000Z' },
            statGained: 'speed',
            cost: 50,
            remainingMoney: 950,
          },
        });
      })
    );
    const user = userEvent.setup();
    renderPage();
    const box = await screen.findByTestId('service-box-basic-shoes');
    const button = within(box).getByRole('button', { name: /shoe horse/i });
    expect(button).toBeDisabled();

    await user.selectOptions(within(box).getByRole('combobox'), 'Starlight');
    await user.click(button);

    // Old contract: the line ended "Remaining balance: 950 coins." Owner ruling 2026-10-26
    // (no receipts or before/after balances, as on the Veterinarian page): one line, no
    // balance (Equoria-6xm6b).
    expect(
      await within(box).findByText(/^Starlight has been shod and gained \+1 Speed\.$/)
    ).toBeInTheDocument();
    expect(within(box).queryByText(/balance/i)).not.toBeInTheDocument();
    expect(within(box).queryByRole('alert')).not.toBeInTheDocument();
    expect(body).toEqual({ horseId: 1, serviceId: 'basic-shoes' });
  });

  it('tells the player when the horse was already shod this week (409)', async () => {
    server.use(
      http.post(SHOE, () =>
        HttpResponse.json({ success: false, message: 'already shod', data: null }, { status: 409 })
      )
    );
    const user = userEvent.setup();
    renderPage();
    const box = await screen.findByTestId('service-box-basic-shoes');
    await user.selectOptions(within(box).getByRole('combobox'), 'Starlight');
    await user.click(within(box).getByRole('button', { name: /shoe horse/i }));
    expect(await within(box).findByRole('alert')).toHaveTextContent(
      'Shoeing failed: That horse has already been shod this week.'
    );
  });

  it('shows an honest empty state when the player has no horses', async () => {
    stub({ horsesBody: [] });
    renderPage();
    expect(await screen.findByText('No horses to shoe')).toBeInTheDocument();
  });
});
