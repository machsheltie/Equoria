/**
 * ClubsPage — the My Club tab, the club count, and every club action tell the
 * truth (Equoria-lhkcl, Equoria-pqor7; FRONTEND_ASYNC_STATE_DOCTRINE §1/§2/§3/§4).
 *
 * Boundary-level: REAL useClubs / useMyClubs / mutation hooks through the REAL
 * api-client; only the network is stubbed (MSW). The defects: a failed clubs or
 * memberships fetch rendered the honest-looking empty states ("No clubs yet",
 * "Club Governance"); the header count showed a loading "…" forever after a
 * failure; join / create / nominate / vote failures were invisible, and the
 * nomination text was wiped before the server answered.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import ClubsPage from '../ClubsPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const CLUBS = `${base}/api/v1/clubs`;
const myClubsPath = `${base}/api/v1/clubs/mine`;
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

const membership = {
  id: 1,
  club: sampleClub,
  role: 'member',
  joinedAt: '2026-02-01T00:00:00Z',
};

/** GET /clubs answers per `type`; `all` is the unfiltered list (count + leaderboard). */
function stubClubs(opts: { all?: () => Response; discipline?: unknown[]; mine?: () => Response }) {
  server.use(
    http.get(CLUBS, ({ request }) => {
      const type = new URL(request.url).searchParams.get('type');
      if (type === 'discipline') {
        return HttpResponse.json({ clubs: opts.discipline ?? [] });
      }
      if (type === 'breed') return HttpResponse.json({ clubs: [] });
      return opts.all ? opts.all() : HttpResponse.json({ clubs: [] });
    }),
    http.get(myClubsPath, () => (opts.mine ? opts.mine() : HttpResponse.json({ memberships: [] })))
  );
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider userOverrides={{ id: 3, username: 'ClubTester' }}>
        <MemoryRouter initialEntries={['/clubs']}>
          <ClubsPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

async function openMyClubTab() {
  const user = userEvent.setup();
  renderPage();
  await user.click(await screen.findByTestId('tab-my-club'));
  return { user, tab: await screen.findByTestId('my-club-tab') };
}

describe('ClubsPage header count (Equoria-lhkcl)', () => {
  it('a failed all-clubs fetch shows an unavailable marker, not a forever-loading "…"', async () => {
    stubClubs({ all: () => refusal(500) });
    renderPage();

    expect(await screen.findByText('—')).toBeInTheDocument();
    expect(screen.queryByText('…')).not.toBeInTheDocument();
  });

  it('a settled zero is shown as 0, not "…"', async () => {
    stubClubs({});
    renderPage();

    expect(await screen.findByText(/^0 clubs total$/)).toBeInTheDocument();
    expect(screen.queryByText('…')).not.toBeInTheDocument();
  });
});

describe('MyClubTab fetch states (Equoria-lhkcl)', () => {
  it('a failed all-clubs fetch shows an error with retry in the leaderboard, not "No clubs yet"', async () => {
    stubClubs({ all: () => refusal(500) });
    const { tab } = await openMyClubTab();

    const alert = await within(tab).findByRole('alert');
    expect(alert).toHaveTextContent(/something went wrong/i);
    expect(within(tab).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(within(tab).queryByText('No clubs yet')).not.toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('a failed memberships fetch shows an error with retry, not the "Club Governance" empty', async () => {
    stubClubs({ mine: () => refusal(500) });
    const { tab } = await openMyClubTab();

    const alert = await within(tab).findByRole('alert');
    expect(alert).toHaveTextContent(/something went wrong/i);
    expect(within(tab).queryByText('Club Governance')).not.toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('retry on the failed leaderboard refetches and recovers', async () => {
    // Fails until the player presses retry (opening the tab alone must not heal it).
    let failing = true;
    stubClubs({
      all: () => (failing ? refusal(500) : HttpResponse.json({ clubs: [sampleClub] })),
    });
    const { user, tab } = await openMyClubTab();

    const retry = await within(tab).findByRole('button', { name: /try again/i });
    failing = false;
    await user.click(retry);

    expect(await within(tab).findByTestId('leaderboard-row-101')).toBeInTheDocument();
    expect(within(tab).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a successful empty memberships fetch is the honest "Club Governance" empty', async () => {
    stubClubs({});
    const { tab } = await openMyClubTab();

    expect(await within(tab).findByText('Club Governance')).toBeInTheDocument();
    expect(within(tab).queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('club actions report failure (Equoria-pqor7)', () => {
  it('a refused join says why, on the club that was tried', async () => {
    stubClubs({ discipline: [sampleClub] });
    server.use(http.post(`${CLUBS}/101/join`, () => refusal(409)));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('join-button-101'));

    const card = await screen.findByTestId('club-card-101');
    expect(await within(card).findByRole('alert')).toHaveTextContent(/already a member/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
    expect(within(card).getByTestId('join-button-101')).toBeEnabled();
  });

  it('a refused club creation says why and keeps the form as typed', async () => {
    stubClubs({});
    server.use(http.post(CLUBS, () => refusal(409)));
    const { user, tab } = await openMyClubTab();

    await user.click(within(tab).getByTestId('create-club-toggle'));
    await user.type(await within(tab).findByTestId('create-club-name'), 'Night Riders');
    await user.type(within(tab).getByTestId('create-club-category'), 'Dressage');
    await user.type(within(tab).getByTestId('create-club-description'), 'We ride at night.');
    await user.click(within(tab).getByTestId('create-club-submit'));

    expect(await within(tab).findByRole('alert')).toHaveTextContent(/name/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
    expect(within(tab).getByTestId('create-club-name')).toHaveValue('Night Riders');
    expect(within(tab).getByTestId('create-club-category')).toHaveValue('Dressage');
    expect(within(tab).getByTestId('create-club-description')).toHaveValue('We ride at night.');
  });

  describe('elections', () => {
    const election = {
      id: 7,
      clubId: 101,
      position: 'President',
      status: 'open',
      startsAt: '2026-10-01T00:00:00Z',
      endsAt: '2026-11-01T00:00:00Z',
    };
    const candidate = {
      id: 55,
      user: { id: 'u-4', username: 'rival' },
      statement: '',
      voteCount: 2,
    };

    function stubElection() {
      stubClubs({
        all: () => HttpResponse.json({ clubs: [sampleClub] }),
        mine: () => HttpResponse.json({ memberships: [membership] }),
      });
      server.use(
        http.get(`${CLUBS}/101/elections`, () => HttpResponse.json({ elections: [election] })),
        http.get(`${CLUBS}/elections/7/results`, () =>
          HttpResponse.json({ election, candidates: [candidate] })
        )
      );
    }

    it('a refused nomination says why and keeps the typed statement', async () => {
      stubElection();
      server.use(http.post(`${CLUBS}/elections/7/nominate`, () => refusal(409)));
      const { user } = await openMyClubTab();
      const card = await screen.findByTestId('election-7');

      await user.click(within(card).getByRole('button', { name: /^nominate$/i }));
      await user.type(within(card).getByLabelText(/nomination statement/i), 'Vote for me');
      await user.click(within(card).getByRole('button', { name: /submit nomination/i }));

      expect(await within(card).findByRole('alert')).toHaveTextContent(/already/i);
      expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
      expect(within(card).getByLabelText(/nomination statement/i)).toHaveValue('Vote for me');
    });

    it('a successful nomination closes the form and clears the statement', async () => {
      stubElection();
      server.use(
        http.post(`${CLUBS}/elections/7/nominate`, () => HttpResponse.json({ success: true }))
      );
      const { user } = await openMyClubTab();
      const card = await screen.findByTestId('election-7');

      await user.click(within(card).getByRole('button', { name: /^nominate$/i }));
      await user.type(within(card).getByLabelText(/nomination statement/i), 'Vote for me');
      await user.click(within(card).getByRole('button', { name: /submit nomination/i }));

      await screen.findByTestId('election-7');
      expect(within(card).queryByLabelText(/nomination statement/i)).not.toBeInTheDocument();
      expect(within(card).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('a refused vote says why beside the ballot', async () => {
      stubElection();
      server.use(http.post(`${CLUBS}/elections/7/vote`, () => refusal(409)));
      const { user } = await openMyClubTab();
      const card = await screen.findByTestId('election-7');

      await user.click(await within(card).findByRole('button', { name: /^vote$/i }));

      expect(await within(card).findByRole('alert')).toHaveTextContent(/already voted/i);
      expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
    });
  });
});
