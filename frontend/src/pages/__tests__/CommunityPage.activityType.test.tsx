/**
 * CommunityPage reads the community feed's camelCase activity types
 * (Equoria-pjvp8.4, phase 3k; owner ruling 2026-10-21: Equoria names are
 * camelCase, string values included).
 *
 * GET /api/v1/users/community/activity sends type competitionWin for a show
 * win (forumPost and clubCreated for the rest). A win must read as a
 * Competition, not fall back to an Achievement. (The page also reads the old
 * server's COMPETITION_WIN during a deploy; phase 6 removes that.)
 *
 * Real page, real hooks and apiClient; only the HTTP boundary is MSW.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import CommunityPage from '../CommunityPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function stubHub(activity: unknown[]) {
  server.use(
    http.get(`${base}/api/v1/forum/threads`, () =>
      HttpResponse.json({ success: true, data: { threads: [], total: 0, page: 1 } })
    ),
    http.get(`${base}/api/v1/clubs`, () =>
      HttpResponse.json({ success: true, data: { clubs: [] } })
    ),
    http.get(`${base}/api/v1/messages/unread-count`, () =>
      HttpResponse.json({ success: true, data: { count: 0 } })
    ),
    http.get(`${base}/api/v1/messages/conversations-count`, () =>
      HttpResponse.json({ success: true, data: { count: 0 } })
    ),
    http.get(`${base}/api/v1/clubs/elections/open-count`, () =>
      HttpResponse.json({ success: true, data: { count: 0 } })
    ),
    http.get(`${base}/api/v1/users/community/activity`, () =>
      HttpResponse.json({ success: true, data: activity })
    ),
    http.get(`${base}/api/v1/hall-of-fame`, () =>
      HttpResponse.json({ success: true, data: { rounds: [], inductees: [] } })
    )
  );
}

describe('CommunityPage — community feed activity types (Equoria-pjvp8.4)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('reads a competitionWin as a Competition and a forumPost as an Achievement', async () => {
    stubHub([
      {
        id: 'win-1',
        type: 'competitionWin',
        description: "Rider's horse Comet won the Spring Classic!",
        timestamp: '2026-10-27T12:00:00.000Z',
        metadata: { horseId: 1, score: 88 },
      },
      {
        id: 'thread-2',
        type: 'forumPost',
        description: 'Rider started a new thread: "Hello"',
        timestamp: '2026-10-26T12:00:00.000Z',
        metadata: { threadId: 2, section: 'general' },
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: 7, username: 'FeedReader' }}>
          <MemoryRouter initialEntries={['/community']}>
            <CommunityPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    const items = await screen.findAllByTestId('activity-feed-item');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Competition')).toBeInTheDocument();
    expect(within(items[1]).getByText('Achievement')).toBeInTheDocument();
  });
});
