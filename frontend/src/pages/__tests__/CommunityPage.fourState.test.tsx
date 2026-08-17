/**
 * CommunityPage — hub stats four-state tests (Equoria-r4cyk)
 *
 * Regression guard for the fabricated-stats defect: the hub used to render an
 * unconditional "Elections open" badge, hardcoded "…" stat literals with no
 * backing query (Conversations, Inductees, Total wins), a magic '5' sections
 * literal, and ellipsis-on-zero conflation (a real 0 rendered as "…"). Per
 * FRONTEND_ASYNC_STATE_DOCTRINE §1/§4 every stat now renders through the
 * four-state contract and the badge is gated on real election state.
 *
 * Boundary-level test (mirrors MessagesPage.fourState.test.tsx): the page
 * renders against the REAL hooks (real React Query + real api clients over
 * the real apiClient), with only the HTTP transport boundary stubbed by MSW.
 *
 * Verified real wire shapes (read from the backend controllers, not guessed):
 *   - GET /api/v1/forum/threads             → { success, data: { threads, total, page } }
 *   - GET /api/v1/clubs                     → { success, data: { clubs } }
 *   - GET /api/v1/messages/unread-count     → { success, data: { count } }
 *   - GET /api/v1/messages/conversations-count → { success, data: { count } }
 *   - GET /api/v1/clubs/elections/open-count   → { success, data: { count } }
 *   - GET /api/v1/users/community/activity  → { success, data: [...] }
 *   - GET /api/v1/horses (?t=)              → { success, data: [...] }
 *   - GET /api/v1/horses/:id/competition-history → BARE object (no envelope)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import CommunityPage from '../CommunityPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const THREADS = `${base}/api/v1/forum/threads`;
const CLUBS = `${base}/api/v1/clubs`;
const UNREAD = `${base}/api/v1/messages/unread-count`;
const CONVERSATIONS = `${base}/api/v1/messages/conversations-count`;
const OPEN_ELECTIONS = `${base}/api/v1/clubs/elections/open-count`;
const ACTIVITY = `${base}/api/v1/users/community/activity`;
const HORSES = `${base}/api/v1/horses`;
const HISTORY = `${base}/api/v1/horses/:id/competition-history`;

const club = (id: number, type: 'discipline' | 'breed') => ({
  id,
  name: `Club ${id}`,
  type,
  category: type === 'discipline' ? 'Dressage' : 'Thoroughbred',
  description: 'test club',
  leader: { id: 'u1', username: 'leader' },
  memberCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
});

const retiredHorse = {
  id: 42,
  name: 'Old Champ',
  breed: 'Thoroughbred',
  age: 22,
  ageYears: 22,
  gender: 'Mare',
  dateOfBirth: '2020-01-01T00:00:00Z',
  healthStatus: 'Excellent',
  stats: {},
  disciplineScores: {},
  totalEarnings: 0,
};

const activeHorse = { ...retiredHorse, id: 43, name: 'Young Star', age: 5, ageYears: 5 };

const historyFor = (horseId: number, wins: number) => ({
  horseId,
  horseName: `Horse ${horseId}`,
  statistics: { totalCompetitions: wins + 2, wins, placings: 0, totalEarnings: 0 },
  competitions: [],
});

/**
 * Stub every endpoint the hub touches with a successful, populated response.
 * Individual tests override the endpoint under test via server.use AFTER
 * calling this (last-registered handler wins in MSW).
 */
function stubHappy({
  total = 7,
  unread = 3,
  conversations = 4,
  openElections = 1,
  horses = [retiredHorse, activeHorse],
  wins = 5,
}: {
  total?: number;
  unread?: number;
  conversations?: number;
  openElections?: number;
  horses?: Array<Record<string, unknown>>;
  wins?: number;
} = {}) {
  server.use(
    http.get(THREADS, () =>
      HttpResponse.json({ success: true, data: { threads: [], total, page: 1 } })
    ),
    http.get(CLUBS, () =>
      HttpResponse.json({
        success: true,
        data: { clubs: [club(1, 'discipline'), club(2, 'discipline'), club(3, 'breed')] },
      })
    ),
    http.get(UNREAD, () => HttpResponse.json({ success: true, data: { count: unread } })),
    http.get(CONVERSATIONS, () =>
      HttpResponse.json({ success: true, data: { count: conversations } })
    ),
    http.get(OPEN_ELECTIONS, () =>
      HttpResponse.json({ success: true, data: { count: openElections } })
    ),
    http.get(ACTIVITY, () => HttpResponse.json({ success: true, data: [] })),
    http.get(HORSES, () => HttpResponse.json({ success: true, data: horses })),
    http.get(HISTORY, ({ params }) => HttpResponse.json(historyFor(Number(params.id), wins)))
  );
}

describe('CommunityPage — hub stats four-state (Equoria-r4cyk)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: 7, username: 'HubTester' }}>
          <MemoryRouter initialEntries={['/community']}>
            <CommunityPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  // LOADING — pending fetches render skeleton loading regions, never the old
  // '…' stub literal and never a fabricated number.
  it('shows loading regions while stats are pending — no "…" stubs, no fake zeros', async () => {
    stubHappy();
    // Keep the two fetches pending for the whole test — the loading state
    // must be shown for as long as the data has not resolved.
    server.use(
      http.get(THREADS, async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: { threads: [], total: 7, page: 1 } });
      }),
      http.get(CONVERSATIONS, async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: { count: 4 } });
      })
    );

    renderPage();

    // Card ("Active threads") AND banner ("Active Threads") each announce a
    // loading region for the pending stat.
    const threadLoaders = await screen.findAllByRole('status', {
      name: /loading active threads/i,
    });
    expect(threadLoaders.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('status', { name: /loading conversations/i })).toBeInTheDocument();
    // The pre-fix stub literal must never render.
    expect(screen.queryByText('…')).not.toBeInTheDocument();
  });

  // SUCCESS — every stat shows its real API value; the sections stat comes
  // from the shared FORUM_SECTIONS constant (5), not a magic literal.
  it('renders real API values for every stat on success', async () => {
    stubHappy();

    renderPage();

    // Active threads (card + banner render the same real total).
    expect(await screen.findAllByText('7')).not.toHaveLength(0);
    // Discipline clubs = 2, breed clubs = 1 (+ Inductees also 1).
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    // Unread = 3, Conversations = 4, Total wins (retired horse's real wins) = 5.
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
    expect(await screen.findAllByText('4')).not.toHaveLength(0);
    expect(await screen.findAllByText('5')).not.toHaveLength(0);
    expect(screen.queryByText('…')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // SUCCESS + ZERO — a real 0 renders as "0", not as the old '…' conflation.
  it('renders a real 0 (not "…") when a stat is genuinely zero', async () => {
    stubHappy({ total: 0, unread: 0, conversations: 0, openElections: 0, horses: [] });
    server.use(http.get(CLUBS, () => HttpResponse.json({ success: true, data: { clubs: [] } })));

    renderPage();

    const zeros = await screen.findAllByText('0');
    // Sections(5) stays 5; everything else — threads, clubs ×2 (card+banner),
    // unread ×2, conversations, inductees, wins — is an honest zero.
    expect(zeros.length).toBeGreaterThanOrEqual(6);
    expect(screen.queryByText('…')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // BADGE — present only when the caller's clubs have a genuinely-open
  // election; absent on zero.
  it('shows the "Elections open" badge only when an election is really open', async () => {
    stubHappy({ openElections: 2 });

    renderPage();

    expect(await screen.findByText('Elections open')).toBeInTheDocument();
  });

  it('renders NO "Elections open" badge when no election is open', async () => {
    stubHappy({ openElections: 0 });

    renderPage();

    // Wait for load to settle on a real value, then assert absence.
    await screen.findAllByText('7');
    expect(screen.queryByText('Elections open')).not.toBeInTheDocument();
  });

  it('renders NO "Elections open" badge when the election query fails (error, not fake)', async () => {
    stubHappy();
    server.use(
      http.get(OPEN_ELECTIONS, () =>
        HttpResponse.json({ success: false, message: 'boom detail' }, { status: 500 })
      )
    );

    renderPage();

    // The failure surfaces in the shared stats error bar…
    const errorBar = await screen.findByTestId('community-stats-error');
    expect(within(errorBar).getByRole('alert')).toBeInTheDocument();
    // …and the badge is absent rather than fabricated.
    expect(screen.queryByText('Elections open')).not.toBeInTheDocument();
    // Raw server error text must never leak (doctrine §3).
    expect(screen.queryByText(/boom detail/i)).not.toBeInTheDocument();
  });

  // ERROR — a failed stat query renders "—" + a visible error bar with a
  // WIRED retry, never a fake number and never a silent fallback.
  it('renders an error bar with wired retry when the threads fetch fails', async () => {
    stubHappy();
    let calls = 0;
    server.use(
      http.get(THREADS, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ success: false, message: 'thread boom' }, { status: 500 });
        }
        return HttpResponse.json({ success: true, data: { threads: [], total: 7, page: 1 } });
      })
    );

    const user = userEvent.setup();
    renderPage();

    const errorBar = await screen.findByTestId('community-stats-error');
    expect(within(errorBar).getByRole('alert')).toBeInTheDocument();
    // Errored tiles render an honest em-dash, not a fabricated count.
    expect((await screen.findAllByText('—')).length).toBeGreaterThanOrEqual(1);

    await user.click(within(errorBar).getByRole('button', { name: /try again/i }));

    // Retry actually refetched and the real value arrived.
    expect(await screen.findAllByText('7')).not.toHaveLength(0);
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  // ACTIVITY — a failed activity fetch renders error + retry, never the
  // "community is quiet" empty lie.
  it('renders an error state (not the empty lie) when the activity fetch fails', async () => {
    stubHappy();
    server.use(
      http.get(ACTIVITY, () =>
        HttpResponse.json({ success: false, message: 'activity boom' }, { status: 500 })
      )
    );

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/community is quiet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/activity boom/i)).not.toBeInTheDocument();
  });
});
