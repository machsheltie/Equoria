/**
 * ClubsPage — discipline / breed club-grid four-state tests (Equoria-l22ki)
 *
 * Regression guard for the "swallow-fetch-error-as-false-empty" defect: the
 * page used to destructure only `{ data, isLoading }` from useClubs('discipline')
 * / useClubs('breed'), and ClubGrid had no error branch — so a FAILED fetch
 * rendered the honest empty state ("No clubs yet"), indistinguishable from a
 * genuinely-empty result. Per FRONTEND_ASYNC_STATE_DOCTRINE §1 the states are
 * LOADING → ERROR (visible + retry) → EMPTY (only via success) → SUCCESS.
 *
 * Boundary-level test: real useClubs / useMyClubs hooks over the real apiClient,
 * HTTP boundary stubbed by MSW. No vi.mock of the hooks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import ClubsPage from '../ClubsPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const CLUBS = `${base}/api/v1/clubs`;
const MY_CLUBS = `${base}/api/v1/clubs/mine`;

const sampleClub = {
  id: 101,
  name: 'Dressage Enthusiasts',
  type: 'discipline',
  category: 'Dressage',
  description: 'For lovers of dressage.',
  memberCount: 12,
  leader: { id: 'user-9', username: 'clublead' },
};

/**
 * useClubs('discipline') → GET /clubs?type=discipline
 * useClubs('breed')      → GET /clubs?type=breed
 * useClubs()             → GET /clubs         (feeds the leaderboard + count)
 * All share the SAME URL path; the handler branches on the `type` param, and
 * React Query keys them separately so each is its own cache entry.
 */
function stubClubsBy(handler: (type: string | null) => Response) {
  server.use(
    http.get(CLUBS, ({ request }) => {
      const type = new URL(request.url).searchParams.get('type');
      return handler(type);
    }),
    http.get(MY_CLUBS, () => HttpResponse.json({ memberships: [] }))
  );
}

describe('ClubsPage — discipline grid four-state (Equoria-l22ki)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: 3, username: 'ClubTester' }}>
          <MemoryRouter initialEntries={['/clubs']}>
            <ClubsPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  // LOADING — while pending, the empty lie must not appear.
  it('shows a loading region while the discipline-clubs fetch is pending', async () => {
    stubClubsBy(() => HttpResponse.json({ clubs: [] }) as unknown as Response);
    // Override the discipline query with a delayed response.
    server.use(
      http.get(CLUBS, async ({ request }) => {
        const type = new URL(request.url).searchParams.get('type');
        if (type === 'discipline') {
          await delay(150);
        }
        return HttpResponse.json({ clubs: [] });
      })
    );

    renderPage();

    expect(await screen.findByRole('status', { name: /loading clubs/i })).toBeInTheDocument();
    expect(screen.queryByText('No clubs yet')).not.toBeInTheDocument();
  });

  // ERROR — the key assertion: a failed discipline fetch renders error+retry,
  // NEVER the false "No clubs yet" empty state.
  it('renders an error state with retry (not a false empty) when the fetch fails', async () => {
    stubClubsBy((type) => {
      if (type === 'discipline') {
        return HttpResponse.json(
          { status: 'error', message: 'club boom detail' },
          { status: 500 }
        ) as unknown as Response;
      }
      return HttpResponse.json({ clubs: [] }) as unknown as Response;
    });

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText('No clubs yet')).not.toBeInTheDocument();
    expect(screen.queryByText(/club boom detail/i)).not.toBeInTheDocument();
  });

  // EMPTY — reachable ONLY through a successful, genuinely-empty fetch.
  it('renders the honest empty state on a successful but empty discipline fetch', async () => {
    stubClubsBy(() => HttpResponse.json({ clubs: [] }) as unknown as Response);

    renderPage();

    expect(await screen.findByText('No clubs yet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // SUCCESS — real club cards render.
  it('renders club cards on a successful discipline fetch with data', async () => {
    stubClubsBy(
      (type) =>
        HttpResponse.json({
          clubs: type === 'discipline' ? [sampleClub] : [],
        }) as unknown as Response
    );

    renderPage();

    expect(await screen.findByText('Dressage Enthusiasts')).toBeInTheDocument();
    expect(screen.queryByText('No clubs yet')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // RETRY WIRING — clicking Try Again re-fetches and renders cards.
  it('retry re-fetches and renders cards (refetch is wired to the error retry)', async () => {
    let disciplineCalls = 0;
    server.use(
      http.get(MY_CLUBS, () => HttpResponse.json({ memberships: [] })),
      http.get(CLUBS, ({ request }) => {
        const type = new URL(request.url).searchParams.get('type');
        if (type === 'discipline') {
          disciplineCalls += 1;
          if (disciplineCalls === 1) {
            return HttpResponse.json({ status: 'error', message: 'boom' }, { status: 500 });
          }
          return HttpResponse.json({ clubs: [sampleClub] });
        }
        return HttpResponse.json({ clubs: [] });
      })
    );

    const user = userEvent.setup();
    renderPage();

    const retryBtn = await screen.findByRole('button', { name: /try again/i });
    await user.click(retryBtn);

    expect(await screen.findByText('Dressage Enthusiasts')).toBeInTheDocument();
    expect(disciplineCalls).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('No clubs yet')).not.toBeInTheDocument();
  });
});
