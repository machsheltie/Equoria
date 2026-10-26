/**
 * VeterinarianPage — two services with horse dropdowns (owner ruling
 * 2026-10-26, q78, Equoria-7dmzp).
 *
 * Old contract (retired with this ruling, with VeterinarianPage.tabSwitch and
 * VeterinarianPage.fourState): My Horses / Services tabs, a horse-card grid and
 * four bookable services. New ruling: no tabs; exactly two centred service
 * boxes, "Vet Horse" and "Run Panel", each with a dropdown of the player's
 * horses. A horse already vetted or already tested is greyed out (disabled
 * option); retired horses are not listed (the server leaves them out).
 *
 * The four honest async states of the old fourState suite are kept: a failed or
 * empty fetch never leaves a permanent loading dead-end.
 *
 * Real page, real hooks, real apiClient; the HTTP boundary is stubbed by MSW.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import VeterinarianPage from '../VeterinarianPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SERVICES = `${base}/api/v1/vet/services`;
const HORSES = `${base}/api/v1/vet/horses`;
const BOOK = `${base}/api/v1/vet/book-appointment`;

const services = [
  {
    id: 'health-check',
    name: 'General Health Check',
    description: 'A full check of the horse.',
    cost: 100,
    actionLabel: 'Vet Horse',
  },
  {
    id: 'genetic-testing',
    name: 'Genetic Testing',
    description: 'A colour genetics panel.',
    cost: 500,
    actionLabel: 'Run Panel',
  },
];

const horses = [
  { id: 1, name: 'Due Mare', vetted: false, geneticsTested: false },
  { id: 2, name: 'Fresh Mare', vetted: true, geneticsTested: false },
  { id: 3, name: 'Tested Mare', vetted: false, geneticsTested: true },
];

function stub(
  opts: { servicesBody?: unknown; horsesBody?: unknown; servicesStatus?: number } = {}
) {
  server.use(
    http.get(SERVICES, () =>
      opts.servicesStatus
        ? HttpResponse.json({ success: false, message: 'down' }, { status: opts.servicesStatus })
        : HttpResponse.json({ success: true, data: opts.servicesBody ?? services })
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
      <MockAuthProvider>
        <MemoryRouter>
          <VeterinarianPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

const optionNamed = (box: HTMLElement, text: RegExp) =>
  within(box).getByRole('option', { name: text }) as HTMLOptionElement;

describe('VeterinarianPage (Equoria-7dmzp)', () => {
  beforeEach(() => stub());

  it('shows exactly two service boxes, no tabs and no My Horses', async () => {
    renderPage();
    const check = await screen.findByTestId('service-box-health-check');
    const panel = screen.getByTestId('service-box-genetic-testing');

    expect(
      within(check).getByRole('heading', { name: 'General Health Check' })
    ).toBeInTheDocument();
    expect(within(panel).getByRole('heading', { name: 'Genetic Testing' })).toBeInTheDocument();
    expect(screen.getAllByTestId(/^service-box-/)).toHaveLength(2);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText(/my horses/i)).not.toBeInTheDocument();
    expect(within(check).getByRole('button', { name: /vet horse/i })).toHaveTextContent('100');
    expect(within(panel).getByRole('button', { name: /run panel/i })).toHaveTextContent('500');
  });

  it('greys out horses already vetted in the health check and already tested in the panel', async () => {
    renderPage();
    const check = await screen.findByTestId('service-box-health-check');
    const panel = screen.getByTestId('service-box-genetic-testing');

    expect(optionNamed(check, /Due Mare/).disabled).toBe(false);
    expect(optionNamed(check, /Fresh Mare/).disabled).toBe(true);
    expect(optionNamed(check, /Fresh Mare/)).toHaveTextContent(/already vetted/i);
    expect(optionNamed(check, /Tested Mare/).disabled).toBe(false);

    expect(optionNamed(panel, /Due Mare/).disabled).toBe(false);
    expect(optionNamed(panel, /Fresh Mare/).disabled).toBe(false);
    expect(optionNamed(panel, /Tested Mare/).disabled).toBe(true);
    expect(optionNamed(panel, /Tested Mare/)).toHaveTextContent(/already tested/i);
  });

  it('lists only the horses the server sends, so a retired horse never appears', async () => {
    renderPage();
    await screen.findByTestId('service-box-health-check');
    expect(screen.queryByRole('option', { name: /Retired/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: /Due Mare/ })).toHaveLength(2);
  });

  it('keeps the button disabled until a horse is chosen, then books it', async () => {
    let body: unknown;
    server.use(
      http.post(BOOK, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          success: true,
          data: {
            horse: {
              id: 1,
              name: 'Due Mare',
              lastVettedDate: '2026-10-26',
              colorGeneticsTested: false,
            },
            service: services[0],
            cost: 100,
            remainingMoney: 900,
          },
        });
      })
    );
    const user = userEvent.setup();
    renderPage();
    const check = await screen.findByTestId('service-box-health-check');
    const button = within(check).getByRole('button', { name: /vet horse/i });
    expect(button).toBeDisabled();

    await user.selectOptions(within(check).getByRole('combobox'), 'Due Mare');
    expect(button).toBeEnabled();
    await user.click(button);

    expect(
      await within(check).findByText(/General Health Check done for Due Mare/)
    ).toBeInTheDocument();
    expect(within(check).getByText(/900 coins/)).toBeInTheDocument();
    expect(body).toEqual({ horseId: 1, serviceId: 'health-check' });
  });

  it('greys the horse out after it is vetted, once the list is refreshed', async () => {
    let vetted = false;
    server.use(
      http.get(HORSES, () =>
        HttpResponse.json({
          success: true,
          data: horses.map((h) => (h.id === 1 && vetted ? { ...h, vetted: true } : h)),
        })
      ),
      http.post(BOOK, () => {
        vetted = true;
        return HttpResponse.json({
          success: true,
          data: {
            horse: {
              id: 1,
              name: 'Due Mare',
              lastVettedDate: '2026-10-26',
              colorGeneticsTested: false,
            },
            service: services[0],
            cost: 100,
            remainingMoney: 900,
          },
        });
      })
    );
    const user = userEvent.setup();
    renderPage();
    const check = await screen.findByTestId('service-box-health-check');
    await user.selectOptions(within(check).getByRole('combobox'), 'Due Mare');
    await user.click(within(check).getByRole('button', { name: /vet horse/i }));
    await within(check).findByText(/done for Due Mare/);
    await screen.findByRole('option', { name: /Due Mare — already vetted/ });
    expect(within(check).getByRole('button', { name: /vet horse/i })).toBeDisabled();
  });

  it('tells the player when the server says the horse was already tested (409)', async () => {
    server.use(
      http.post(BOOK, () =>
        HttpResponse.json({ success: false, message: 'already' }, { status: 409 })
      )
    );
    const user = userEvent.setup();
    renderPage();
    const panel = await screen.findByTestId('service-box-genetic-testing');
    await user.selectOptions(within(panel).getByRole('combobox'), 'Due Mare');
    await user.click(within(panel).getByRole('button', { name: /run panel/i }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'That horse has already been tested.'
    );
  });
});

describe('VeterinarianPage honest async states', () => {
  it('shows an error with retry, not a loading dead-end, when the services fetch fails', async () => {
    stub({ servicesStatus: 500 });
    renderPage();
    expect(await screen.findByText('Unable to Load Services')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows an honest empty state when the clinic has no services', async () => {
    stub({ servicesBody: [] });
    renderPage();
    expect(await screen.findByText('The clinic is closed')).toBeInTheDocument();
  });

  it('shows an honest empty state when the player has no horses', async () => {
    stub({ horsesBody: [] });
    renderPage();
    expect(await screen.findByText('No horses to see')).toBeInTheDocument();
    expect(screen.queryByTestId('service-box-health-check')).not.toBeInTheDocument();
  });
});
