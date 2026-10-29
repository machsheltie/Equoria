/**
 * The Steward's Office returns to check-in when an ACTION is refused because
 * this browser's check-in has lapsed (STAFF-RR-11, Equoria-pwucl).
 *
 * Reads already did (StewardsOfficePage.test.tsx). A filing, reply, status
 * change, role change or conduct action refused with 403
 * staffCheckinRequired left the office on screen with an error, so the
 * steward kept retrying an action that could only fail.
 *
 * Boundary-level: the real staff hooks over the real apiClient, the HTTP
 * boundary stubbed by MSW. No vi.mock.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, MockAuthProvider, Routes, Route } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StewardGate from '@/components/staff/StewardGate';
import { checkinRequiredCode } from '@/hooks/api/useStaff';
import StewardsOfficePage from '../StewardsOfficePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

const moderatorMe = {
  role: 'moderator',
  capabilities: ['warn', 'ticket.file', 'log.view.own'],
  trusted: true,
};
const ownerMe = {
  role: 'owner',
  capabilities: ['warn', 'ticket.resolve', 'log.view.all', 'roles.manage'],
  trusted: true,
};

const json = (body: unknown, status = 200) => HttpResponse.json(body as object, { status });
const lapsed = () =>
  json({ success: false, code: checkinRequiredCode, message: 'Check in first' }, 403);

function stubReads(me: object) {
  server.use(
    http.get(`${STAFF}/me`, () => json(me)),
    http.get(`${STAFF}/log`, () => json({ entries: [], nextCursor: null })),
    http.get(`${STAFF}/log/actors`, () => json({ actors: [] })),
    http.get(`${STAFF}/roles`, () =>
      json({ staff: [{ id: 'mod-2', username: 'Willow', role: 'moderator' }] })
    ),
    http.get(`${STAFF}/tickets`, () => json({ tickets: [] }))
  );
}

describe("The Steward's Office after an action's check-in has lapsed", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: 'owner-1', username: 'Stacey' } as never}>
          <MemoryRouter initialEntries={['/steward']}>
            <Routes>
              <Route
                path="/steward"
                element={
                  <StewardGate>
                    <StewardsOfficePage />
                  </StewardGate>
                }
              />
            </Routes>
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  it('a filing refused for a lapsed check-in returns the page to check-in', async () => {
    stubReads(moderatorMe);
    server.use(http.post(`${STAFF}/tickets`, lapsed));
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Their username'), 'Mara');
    await user.type(screen.getByLabelText('Category'), 'Spam');
    await user.type(screen.getByLabelText('Note'), 'Selling coins');
    await user.click(screen.getByRole('button', { name: 'File ticket' }));

    expect(await screen.findByRole('heading', { name: 'Check in' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Note')).not.toBeInTheDocument();
  });

  it('a role change refused for a lapsed check-in returns the page to check-in', async () => {
    stubReads(ownerMe);
    server.use(http.post(`${STAFF}/roles/mod-2`, lapsed));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Revoke Willow' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/reason/i), 'Stepped away');
    await user.click(within(dialog).getByRole('button', { name: 'Revoke role' }));

    expect(await screen.findByRole('heading', { name: 'Check in' })).toBeInTheDocument();
  });

  // Reply, status and conduct actions share the office's one watcher: any
  // ['staff', ...] mutation refused this way returns the page to check-in.
  it.each(['reply', 'set-status', 'conduct-act'])(
    'a %s action refused for a lapsed check-in returns the page to check-in',
    async (action) => {
      stubReads(ownerMe);
      renderPage();
      expect(await screen.findByRole('heading', { name: 'Ledger' })).toBeInTheDocument();

      await act(async () => {
        const mutation = queryClient.getMutationCache().build(queryClient, {
          mutationKey: ['staff', action],
          mutationFn: () =>
            Promise.reject({ statusCode: 403, code: checkinRequiredCode, message: 'x' }),
        });
        await mutation.execute(undefined).catch(() => undefined);
      });

      expect(await screen.findByRole('heading', { name: 'Check in' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Ledger' })).not.toBeInTheDocument();
    }
  );

  it('an action refused for another reason leaves the office open', async () => {
    stubReads(moderatorMe);
    server.use(http.post(`${STAFF}/tickets`, () => json({ message: 'boom' }, 500)));
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Their username'), 'Mara');
    await user.type(screen.getByLabelText('Category'), 'Spam');
    await user.type(screen.getByLabelText('Note'), 'Selling coins');
    await user.click(screen.getByRole('button', { name: 'File ticket' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Check in' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Note')).toHaveValue('Selling coins');
  });
});
