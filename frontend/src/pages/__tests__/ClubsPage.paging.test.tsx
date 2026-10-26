/**
 * Club lists read on past a hundred (Equoria-uob0o).
 *
 * The server answers at most 100 clubs, memberships or elections at a time and
 * hands back pageInfo.nextCursor. Real useClubs / useMyClubs hooks through the
 * real api-client and real providers; MSW answers only the network, and checks
 * the cursor the page sends is the one the server issued.
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

const club = (id: number, type = 'discipline') => ({
  id,
  name: `Club number ${id}`,
  type,
  category: 'Dressage',
  description: 'A club.',
  memberCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
  leader: { id: 'user-9', username: 'clublead' },
});

const page = (clubs: unknown[], nextCursor: string | null) => ({
  success: true,
  data: { clubs, pageInfo: { nextCursor, hasMore: nextCursor !== null } },
});

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

describe('ClubsPage paging (Equoria-uob0o)', () => {
  it('offers the next page by the server cursor and joins it to the clubs on screen', async () => {
    const cursorsSeen: (string | null)[] = [];
    server.use(
      http.get(CLUBS, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('type') === 'discipline') {
          const cursor = url.searchParams.get('cursor');
          cursorsSeen.push(cursor);
          return HttpResponse.json(
            cursor === 'cursor-from-server'
              ? page([club(1)], null)
              : page([club(2), club(3)], 'cursor-from-server')
          );
        }
        return HttpResponse.json(page([], null));
      }),
      http.get(`${CLUBS}/mine`, () =>
        HttpResponse.json({
          success: true,
          data: { memberships: [], pageInfo: { nextCursor: null, hasMore: false } },
        })
      )
    );
    const user = userEvent.setup();
    renderPage();

    const grid = await screen.findByTestId('discipline-clubs-grid');
    expect(await within(grid).findByText('Club number 2')).toBeInTheDocument();
    expect(within(grid).queryByText('Club number 1')).toBeNull();

    await user.click(await screen.findByRole('button', { name: 'Show more clubs' }));

    expect(await within(grid).findByText('Club number 1')).toBeInTheDocument();
    expect(within(grid).getByText('Club number 2')).toBeInTheDocument();
    expect(cursorsSeen).toEqual([null, 'cursor-from-server']);
    expect(screen.queryByRole('button', { name: 'Show more clubs' })).toBeNull();
  });

  it('offers nothing more when the list fits one page', async () => {
    server.use(
      http.get(CLUBS, () => HttpResponse.json(page([club(5)], null))),
      http.get(`${CLUBS}/mine`, () =>
        HttpResponse.json({
          success: true,
          data: { memberships: [], pageInfo: { nextCursor: null, hasMore: false } },
        })
      )
    );
    renderPage();
    expect(await screen.findByText('Club number 5')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show more/i })).toBeNull();
  });

  it('keeps the clubs shown and says so when the next page fails', async () => {
    server.use(
      http.get(CLUBS, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('type') !== 'discipline') return HttpResponse.json(page([], null));
        return url.searchParams.get('cursor')
          ? HttpResponse.json({ success: false, message: 'RAW-SERVER-TEXT' }, { status: 500 })
          : HttpResponse.json(page([club(2)], 'c2'));
      }),
      http.get(`${CLUBS}/mine`, () =>
        HttpResponse.json({
          success: true,
          data: { memberships: [], pageInfo: { nextCursor: null, hasMore: false } },
        })
      )
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Show more clubs' }));
    expect(await screen.findByText(/more clubs didn't load/i)).toBeInTheDocument();
    expect(screen.getByText('Club number 2')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('RAW-SERVER-TEXT');
  });

  it('pages My Clubs by the server cursor too', async () => {
    const cursorsSeen: (string | null)[] = [];
    const member = (id: number) => ({
      id,
      club: club(id),
      role: 'member',
      joinedAt: '2026-02-01T00:00:00Z',
    });
    server.use(
      http.get(CLUBS, () => HttpResponse.json(page([], null))),
      http.get(`${CLUBS}/mine`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursorsSeen.push(cursor);
        const memberships = cursor ? [member(8)] : [member(9)];
        return HttpResponse.json({
          success: true,
          data: {
            memberships,
            pageInfo: cursor
              ? { nextCursor: null, hasMore: false }
              : { nextCursor: 'm2', hasMore: true },
          },
        });
      })
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByTestId('tab-my-club'));
    expect((await screen.findAllByText('Club number 9')).length).toBeGreaterThan(0);
    await user.click(await screen.findByRole('button', { name: 'Show more of your clubs' }));
    expect((await screen.findAllByText('Club number 8')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Club number 9').length).toBeGreaterThan(0);
    expect(cursorsSeen).toEqual([null, 'm2']);
  });
});
