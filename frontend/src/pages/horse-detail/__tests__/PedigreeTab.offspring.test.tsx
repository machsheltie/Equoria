/**
 * The pedigree tab lists a horse's real offspring (Equoria-oey96.55).
 *
 * Old behaviour: the Offspring section was a permanent placeholder sentence and
 * never asked the server, even for a horse with foals. Owner ruling 2026-10-23:
 * a backend offspring read; the tab lists each offspring's name as a link to
 * that horse, and exposes no private data.
 *
 * Real PedigreeTab and hook; GET /api/v1/horses/:id/offspring is answered by MSW.
 * Four states: loading, error with a working retry, honest empty, data.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import PedigreeTab from '../PedigreeTab';
import type { Horse } from '../HorseDetailPageTypes';
import { server } from '@/test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const OFFSPRING = `${base}/api/v1/horses/41/offspring`;

const horse = {
  id: 41,
  name: 'Starlit Meadow',
  parentIds: { sireId: 3, damId: 4 },
} as unknown as Horse;

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/horses/41']}>
        <Routes>
          <Route path="/horses/41" element={<PedigreeTab horse={horse} />} />
          <Route path="/horses/:id" element={<p>Another horse page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PedigreeTab offspring (Equoria-oey96.55)', () => {
  it("lists each offspring's name as a link to that horse", async () => {
    server.use(
      http.get(OFFSPRING, () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 90, name: 'Moonflower' },
            { id: 91, name: 'Halcyon Rose' },
          ],
        })
      )
    );
    renderTab();

    const section = await screen.findByTestId('pedigree-offspring');
    const moonflower = await within(section).findByRole('link', { name: 'Moonflower' });
    expect(moonflower).toHaveAttribute('href', '/horses/90');
    expect(within(section).getByRole('link', { name: 'Halcyon Rose' })).toHaveAttribute(
      'href',
      '/horses/91'
    );
    expect(
      within(section).queryByText(/once this horse has produced foals/i)
    ).not.toBeInTheDocument();
  });

  it('travels to the offspring when its name is chosen', async () => {
    server.use(
      http.get(OFFSPRING, () =>
        HttpResponse.json({ success: true, data: [{ id: 90, name: 'Moonflower' }] })
      )
    );
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('link', { name: 'Moonflower' }));
    expect(await screen.findByText('Another horse page')).toBeInTheDocument();
  });

  it('says honestly that a horse with no foals has none, only after the server answers', async () => {
    server.use(
      http.get(OFFSPRING, async () => {
        await delay(50);
        return HttpResponse.json({ success: true, data: [] });
      })
    );
    renderTab();

    const section = screen.getByTestId('pedigree-offspring');
    expect(within(section).getByRole('status')).toBeInTheDocument();
    expect(within(section).queryByText(/no foals yet/i)).not.toBeInTheDocument();

    expect(
      await within(section).findByText(/Starlit Meadow has no foals yet/i)
    ).toBeInTheDocument();
    expect(within(section).queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows a failure with a retry that really asks again, never a false empty', async () => {
    let calls = 0;
    server.use(
      http.get(OFFSPRING, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ success: false, message: 'boom' }, { status: 500 })
          : HttpResponse.json({ success: true, data: [{ id: 90, name: 'Moonflower' }] });
      })
    );
    const user = userEvent.setup();
    renderTab();

    const section = screen.getByTestId('pedigree-offspring');
    const alert = await within(section).findByRole('alert');
    expect(within(section).queryByText(/no foals yet/i)).not.toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: /try again/i }));
    expect(await within(section).findByRole('link', { name: 'Moonflower' })).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});
