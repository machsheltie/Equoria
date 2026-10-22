/**
 * Club elections — a failed fetch is never shown as "empty" (Equoria-1rsb7;
 * FRONTEND_ASYNC_STATE_DOCTRINE §1/§4).
 *
 * Boundary-level: the REAL useClubElections / useElectionResults hooks run
 * through the REAL api-client; only the network is stubbed (MSW). The defects:
 * a failed elections fetch rendered "No active elections in <club>." and a
 * failed results fetch rendered "No candidates yet.", and both said so while
 * the request was still loading.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import ClubsPage from '../ClubsPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const CLUBS = `${base}/api/v1/clubs`;
const refusal = (status: number) =>
  HttpResponse.json({ success: false, message: 'RAW-SERVER-TEXT leak' }, { status });

const sampleClub = {
  id: 101,
  name: 'Dressage Enthusiasts',
  type: 'discipline',
  category: 'Dressage',
  description: 'For lovers of dressage.',
  memberCount: 12,
  createdAt: '2026-01-01T00:00:00Z',
  leader: { id: 'user-9', username: 'clublead' },
};
const membership = { id: 1, club: sampleClub, role: 'member', joinedAt: '2026-02-01T00:00:00Z' };
const election = {
  id: 7,
  clubId: 101,
  position: 'President',
  status: 'open',
  startsAt: '2026-10-01T00:00:00Z',
  endsAt: '2026-11-01T00:00:00Z',
};
const candidate = { id: 55, user: { id: 'u-4', username: 'rival' }, statement: '', voteCount: 2 };

function stubMembership() {
  server.use(
    http.get(CLUBS, () => HttpResponse.json({ clubs: [sampleClub] })),
    http.get(`${CLUBS}/mine`, () => HttpResponse.json({ memberships: [membership] }))
  );
}

async function openMyClubTab() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider userOverrides={{ id: 3, username: 'ClubTester' }}>
        <MemoryRouter initialEntries={['/clubs']}>
          <ClubsPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
  await user.click(await screen.findByTestId('tab-my-club'));
  return { user, tab: await screen.findByTestId('my-club-tab') };
}

describe('ClubElectionsSection fetch states (Equoria-1rsb7)', () => {
  it('a failed elections fetch shows an error with retry, not "No active elections"', async () => {
    stubMembership();
    server.use(http.get(`${CLUBS}/101/elections`, () => refusal(500)));
    const { tab } = await openMyClubTab();

    const alert = await within(tab).findByRole('alert');
    expect(alert).toHaveTextContent(/something went wrong/i);
    expect(within(tab).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(within(tab).queryByText(/no active elections/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('retry refetches the elections and recovers', async () => {
    stubMembership();
    let failing = true;
    server.use(
      http.get(`${CLUBS}/101/elections`, () =>
        failing ? refusal(500) : HttpResponse.json({ elections: [election] })
      ),
      http.get(`${CLUBS}/elections/7/results`, () =>
        HttpResponse.json({ election, candidates: [candidate] })
      )
    );
    const { user, tab } = await openMyClubTab();

    const retry = await within(tab).findByRole('button', { name: /try again/i });
    failing = false;
    await user.click(retry);

    expect(await screen.findByTestId('election-7')).toBeInTheDocument();
    expect(within(tab).queryByText(/no active elections/i)).not.toBeInTheDocument();
  });

  it('does not claim "No active elections" while the elections are still loading', async () => {
    stubMembership();
    server.use(
      http.get(`${CLUBS}/101/elections`, async () => {
        await delay(150);
        return HttpResponse.json({ elections: [election] });
      }),
      http.get(`${CLUBS}/elections/7/results`, () =>
        HttpResponse.json({ election, candidates: [candidate] })
      )
    );
    const { tab } = await openMyClubTab();

    expect(within(tab).queryByText(/no active elections/i)).not.toBeInTheDocument();
    expect(await screen.findByTestId('election-7')).toBeInTheDocument();
  });

  it('a successful empty elections list is the honest "No active elections"', async () => {
    stubMembership();
    server.use(http.get(`${CLUBS}/101/elections`, () => HttpResponse.json({ elections: [] })));
    const { tab } = await openMyClubTab();

    expect(await within(tab).findByText(/no active elections/i)).toBeInTheDocument();
    expect(within(tab).queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ElectionCard candidates fetch states (Equoria-1rsb7)', () => {
  function stubElections() {
    stubMembership();
    server.use(
      http.get(`${CLUBS}/101/elections`, () => HttpResponse.json({ elections: [election] }))
    );
  }

  it('a failed results fetch shows an error with retry, not "No candidates yet."', async () => {
    stubElections();
    server.use(http.get(`${CLUBS}/elections/7/results`, () => refusal(500)));
    await openMyClubTab();
    const card = await screen.findByTestId('election-7');

    const alert = await within(card).findByRole('alert');
    expect(alert).toHaveTextContent(/something went wrong/i);
    expect(within(card).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(within(card).queryByText(/no candidates yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('retry refetches the results and shows the candidates', async () => {
    stubElections();
    let failing = true;
    server.use(
      http.get(`${CLUBS}/elections/7/results`, () =>
        failing ? refusal(500) : HttpResponse.json({ election, candidates: [candidate] })
      )
    );
    const { user } = await openMyClubTab();
    const card = await screen.findByTestId('election-7');

    const retry = await within(card).findByRole('button', { name: /try again/i });
    failing = false;
    await user.click(retry);

    expect(await within(card).findByText('rival')).toBeInTheDocument();
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not claim "No candidates yet." while the results are still loading', async () => {
    stubElections();
    server.use(
      http.get(`${CLUBS}/elections/7/results`, async () => {
        await delay(150);
        return HttpResponse.json({ election, candidates: [candidate] });
      })
    );
    await openMyClubTab();
    const card = await screen.findByTestId('election-7');

    expect(within(card).queryByText(/no candidates yet/i)).not.toBeInTheDocument();
    expect(await within(card).findByText('rival')).toBeInTheDocument();
  });

  it('a successful empty candidate list is the honest "No candidates yet."', async () => {
    stubElections();
    server.use(
      http.get(`${CLUBS}/elections/7/results`, () =>
        HttpResponse.json({ election, candidates: [] })
      )
    );
    await openMyClubTab();
    const card = await screen.findByTestId('election-7');

    expect(await within(card).findByText(/no candidates yet/i)).toBeInTheDocument();
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument();
  });
});
