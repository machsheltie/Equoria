/**
 * MyGroomsDashboard — the Release button (Equoria-hwboq).
 *
 * Owner ruling 2026-10-29 (q299, superseding q285's "only when the roster is full"): a
 * groom can be released any time, like riders. Every hired groom's card offers Release;
 * one click releases it (no confirmation page, no receipt) and the groom goes back to
 * the hiring pool.
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
const userId = 1;

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

function renderDashboard() {
  let released: number | null = null;
  server.use(
    http.get(`${base}/api/v1/grooms/user/${userId}`, () =>
      HttpResponse.json({ success: true, grooms: released === null ? [groom] : [] })
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
        <MyGroomsDashboard userId={userId} />
      </BrowserRouter>
    </QueryClientProvider>
  );
  return { releasedId: () => released };
}

describe('MyGroomsDashboard — Release (q299)', () => {
  it('a single hired groom, with plenty of room on the roster, still offers Release; one click releases it, with no confirmation', async () => {
    const user = userEvent.setup();
    const { releasedId } = renderDashboard();

    const card = await screen.findByTestId('groom-card-10');
    const release = await within(card).findByRole('button', { name: 'Release Alice Thornton' });
    await user.click(release);

    await waitFor(() => expect(releasedId()).toBe(10));
    // No confirmation dialog was asked for, and the roster refreshes without the groom.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText(/no grooms hired/i)).toBeInTheDocument();
  });
});
