/**
 * The Steward's Office after a failed background staff check (Equoria-jqdho).
 *
 * Owner ruling 2026-10-28 (q263): if the background /staff/me re-check fails with
 * a server error (not a 404, lost access), the office stays open and checks again
 * on the steward's next action. Losing staff access still closes it.
 *
 * Boundary-level: the real staff hooks over the real apiClient, the HTTP
 * boundary stubbed by MSW. No vi.mock of the api-client module or hooks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, MockAuthProvider, Routes, Route } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StewardGate from '@/components/staff/StewardGate';
import StewardsOfficePage from '../StewardsOfficePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

const adminMe = {
  role: 'admin',
  capabilities: ['log.view.own', 'ticket.resolve', 'log.view.all', 'roles.manage'],
  trusted: true,
};
const staffList = {
  staff: [
    { id: 'admin-1', username: 'Stacey', role: 'admin' },
    { id: 'mod-2', username: 'Willow', role: 'moderator' },
  ],
};

const json = (body: unknown, status = 200) => HttpResponse.json(body as object, { status });

type MeAnswer = 'ok' | 'fail' | 'revoked';

/** Stub the office's reads; `/me` answers whatever `answer()` says at the time. */
function stubOffice(answer: () => MeAnswer, onMe: () => void = () => {}) {
  server.use(
    http.get(`${STAFF}/me`, () => {
      onMe();
      const now = answer();
      if (now === 'ok') return json(adminMe);
      if (now === 'fail') return json({ message: 'boom' }, 500);
      return json({ success: false, message: 'Not found' }, 404);
    }),
    http.get(`${STAFF}/log`, () => json({ entries: [], nextCursor: null })),
    http.get(`${STAFF}/log/actors`, () => json({ actors: [] })),
    http.get(`${STAFF}/roles`, () => json(staffList)),
    http.get(`${STAFF}/tickets`, () => json({ tickets: [] })),
    http.post(`${STAFF}/roles/mod-2`, () => json({ id: 'mod-2', username: 'Willow', role: 'user' }))
  );
}

describe("The Steward's Office re-checks staff access after a failed check (q263)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: 'admin-1', username: 'Stacey' } as never}>
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

  /** Open the revoke dialog with a typed reason, then let the background /me check fail. */
  async function openDialogThenFailCheck(setAnswer: (a: MeAnswer) => void) {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Revoke Willow' }));
    const dialog = await screen.findByRole('dialog');
    const reason = within(dialog).getByLabelText(/reason/i);
    await user.type(reason, 'Half-written reason');

    setAnswer('fail');
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['staff', 'me'] });
    });
    await waitFor(() => expect(queryClient.getQueryState(['staff', 'me'])?.status).toBe('error'));
    // Let the query observer's batched notification reach React before asserting.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    // The office, the dialog and its reason all stay.
    expect(screen.getByRole('heading', { name: 'Ledger' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(reason).toHaveValue('Half-written reason');
    return { user, dialog };
  }

  it('stays open on a server error, and the next action asks /me again', async () => {
    let answer: MeAnswer = 'ok';
    let meCalls = 0;
    stubOffice(
      () => answer,
      () => {
        meCalls += 1;
      }
    );
    renderPage();
    const { user, dialog } = await openDialogThenFailCheck((a) => {
      answer = a;
    });

    answer = 'ok';
    const callsBeforeAction = meCalls;
    await user.click(within(dialog).getByRole('button', { name: 'Revoke role' }));
    await waitFor(() => expect(meCalls).toBe(callsBeforeAction + 1));
    await waitFor(() => expect(queryClient.getQueryState(['staff', 'me'])?.status).toBe('success'));
    expect(screen.getByRole('heading', { name: 'Ledger' })).toBeInTheDocument();
  });

  it('closes the office when the next action finds staff access lost', async () => {
    let answer: MeAnswer = 'ok';
    stubOffice(() => answer);
    const { container } = renderPage();
    const { user, dialog } = await openDialogThenFailCheck((a) => {
      answer = a;
    });

    answer = 'revoked';
    await user.click(within(dialog).getByRole('button', { name: 'Revoke role' }));
    await waitFor(() =>
      expect(within(container).getByTestId('not-found-page')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('stewards-office')).not.toBeInTheDocument();
  });
});
