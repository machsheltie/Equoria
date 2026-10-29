/**
 * MyGroomsDashboard — the Release button (Equoria-hwboq).
 *
 * Owner ruling 2026-10-29 (q285): when the groom roster is full, the player can release
 * a groom with one click (no confirmation page, no receipt); the groom goes back to
 * the hiring pool. With room on the roster there is no Release button.
 *
 * Real hooks and the real api-client; only the network is answered by MSW.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { server } from '@/test/msw/server';
import MyGroomsDashboard from '../MyGroomsDashboard';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const USER_ID = 1;

const groom = {
  id: 10,
  name: 'Alice Thornton',
  skillLevel: 'novice',
  starLevel: 'novice',
  specialty: 'general',
  personality: 'gentle',
  experience: 3,
  sessionRate: 15,
  isActive: true,
};

function renderDashboard(limit: { rosterCap: number; activeGrooms: number }) {
  let released: number | null = null;
  server.use(
    http.get(`${base}/api/v1/grooms/user/${USER_ID}`, () =>
      HttpResponse.json({ success: true, grooms: released === null ? [groom] : [] })
    ),
    http.get(`${base}/api/v1/grooms/roster-cap`, () =>
      HttpResponse.json({
        success: true,
        data: released === null ? limit : { ...limit, activeGrooms: limit.activeGrooms - 1 },
      })
    ),
    http.post(`${base}/api/v1/grooms/:id/release`, ({ params }) => {
      released = Number(params.id);
      return HttpResponse.json({ success: true, data: { groomId: released } });
    })
  );
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <MyGroomsDashboard userId={USER_ID} />
      </BrowserRouter>
    </QueryClientProvider>
  );
  return { releasedId: () => released };
}

describe('MyGroomsDashboard — Release (q285)', () => {
  it('a full roster offers Release on each groom; one click releases it, with no confirmation', async () => {
    const user = userEvent.setup();
    const { releasedId } = renderDashboard({ rosterCap: 10, activeGrooms: 10 });

    const card = await screen.findByTestId('groom-card-10');
    const release = await within(card).findByRole('button', { name: 'Release Alice Thornton' });
    await user.click(release);

    await waitFor(() => expect(releasedId()).toBe(10));
    // No confirmation dialog was asked for, and the roster refreshes without the groom.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText(/no grooms hired/i)).toBeInTheDocument();
  });

  it('with room on the roster there is no Release button', async () => {
    renderDashboard({ rosterCap: 10, activeGrooms: 1 });

    const card = await screen.findByTestId('groom-card-10');
    expect(within(card).queryByRole('button', { name: /release/i })).not.toBeInTheDocument();
  });
});
