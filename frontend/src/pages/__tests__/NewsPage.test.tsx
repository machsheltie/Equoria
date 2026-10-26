/**
 * NewsPage — the Night Road (Equoria-wbt8l, owner rulings 2026-10-23).
 *
 * The real page, real useNewsFeed hook, real React Query and apiClient, with
 * the network boundary stubbed by MSW (no module mocks). Auth comes from the
 * real AuthContext through MockAuthProvider.
 *
 * Covers the honest states (loading, error with a working "Try again", empty
 * only after success), the road (Ahead, Tonight, earlier nights, quiet-night
 * gaps, rows that link into the game), the owner's letters and her large
 * seasonal-event format (kicker, Basteleur title, captioned tiles, signature),
 * the neutral "Equoria Staff" signature once an author's account is gone,
 * walking further back, and the staff-only desk link.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import type { NewsItem, NewsPage as NewsPageData } from '@/lib/api/news';
import NewsPage from '../NewsPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const newsPath = `${base}/api/v1/news`;

let nextId = 1;
function entry(overrides: Partial<NewsItem>): NewsItem {
  nextId += 1;
  return {
    id: nextId,
    postType: 'clubNews',
    title: 'An entry',
    body: '',
    tiles: [],
    authorName: null,
    authorRoleLabel: null,
    linkPath: null,
    publishAt: '2026-10-23T04:02:00.000Z',
    gameDate: '2026-10-23',
    endsAt: null,
    lastGameDate: null,
    ...overrides,
  };
}

function page(overrides: Partial<NewsPageData>): NewsPageData {
  return { today: '2026-10-23', items: [], nextCursor: null, ahead: [], ...overrides };
}

function stubFeed(handler: (before: string | null) => NewsPageData | Response | Promise<Response>) {
  server.use(
    http.get(newsPath, ({ request }) => {
      const result = handler(new URL(request.url).searchParams.get('before'));
      return result instanceof Response || result instanceof Promise
        ? result
        : HttpResponse.json({ success: true, data: result });
    })
  );
}

function renderNews(role: 'user' | 'admin' = 'user') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider userOverrides={{ role }}>
        <BrowserRouter>
          <NewsPage />
        </BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('NewsPage — honest states', () => {
  it('shows that the news is on its way while it loads', async () => {
    stubFeed(async () => {
      await delay('infinite');
      return HttpResponse.json({});
    });
    renderNews();
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/fetching the news/i);
    expect(screen.queryByText(/nothing new under the stars/i)).not.toBeInTheDocument();
  });

  it('says the news did not arrive, never "nothing new", and Try again reloads it', async () => {
    let calls = 0;
    stubFeed(() => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ success: false, message: 'boom' }, { status: 500 })
        : page({ items: [entry({ title: 'Polls open at Moonridge Hunter Club' })] });
    });
    renderNews();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/the news didn't arrive/i);
    expect(screen.queryByText(/nothing new under the stars/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Polls open at Moonridge Hunter Club')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('shows the empty state only after a successful load with no news', async () => {
    stubFeed(() => page({}));
    renderNews();
    expect(await screen.findByText('Nothing new under the stars')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('NewsPage — the Night Road', () => {
  it('walks from Ahead through Tonight to earlier nights, skipping quiet ones', async () => {
    stubFeed(() =>
      page({
        ahead: [
          entry({
            title: 'Polls open at Silver Birch Dressage Club',
            endsAt: '2026-10-26T22:00:00.000Z',
            lastGameDate: '2026-10-26',
          }),
        ],
        items: [
          entry({
            title: 'Run-off decided at Moonridge Hunter Club',
            body: 'Juniper Hale wins the vote for President.',
            linkPath: '/clubs',
          }),
          entry({
            postType: 'newItem',
            title: 'New at the Tack Shop: Hunter Saddle',
            body: 'Made for the Hunter ring.',
            gameDate: '2026-10-22',
            publishAt: '2026-10-22T04:02:00.000Z',
            linkPath: '/tack-shop',
          }),
          entry({
            postType: 'update',
            title: 'The arena has new lights',
            body: 'Shows now run after dark.',
            authorName: 'Stacey',
            authorRoleLabel: 'Head Admin',
            gameDate: '2026-10-18',
            publishAt: '2026-10-18T12:00:00.000Z',
          }),
        ],
      })
    );
    renderNews();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Equoria News' })
    ).toBeInTheDocument();
    // The page title shows at once; the road arrives with the response.
    expect(await screen.findByRole('heading', { level: 2, name: /ahead/i })).toBeInTheDocument();
    expect(screen.getByText('Polls close Monday 26 October')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /tonight.*friday 23 october/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /thursday.*22 october/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /sunday.*18 october/i })
    ).toBeInTheDocument();
    // 22 → 18 October: the quiet nights between are marked, not listed.
    expect(screen.getAllByText('quiet nights')).toHaveLength(1);

    expect(
      screen.getByRole('link', { name: /run-off decided at moonridge hunter club/i })
    ).toHaveAttribute('href', '/clubs');
    expect(
      screen.getByRole('link', { name: /new at the tack shop: hunter saddle/i })
    ).toHaveAttribute('href', '/tack-shop');
    expect(screen.getByText('Posted by Stacey, Head Admin')).toBeInTheDocument();
  });

  it('frames an Admin’s letter, signed with their name and role', async () => {
    stubFeed(() =>
      page({
        items: [
          entry({
            postType: 'adminLetter',
            title: 'Welcome in, closed-beta riders',
            body: 'Thank you for testing.\n\nGood luck in the ring.',
            authorName: 'Wren',
            authorRoleLabel: 'Admin',
          }),
        ],
      })
    );
    renderNews();

    const letter = await screen.findByRole('article', { name: 'Welcome in, closed-beta riders' });
    expect(within(letter).getByText('From Admin Wren')).toBeInTheDocument();
    expect(within(letter).getByText('Thank you for testing.')).toBeInTheDocument();
    expect(within(letter).getByText('Good luck in the ring.')).toBeInTheDocument();
    expect(within(letter).getByText('Wren')).toBeInTheDocument();
    expect(within(letter).getByText('Admin')).toBeInTheDocument();
  });

  it('gives a seasonal event the large format: kicker, title, words, captioned tiles, signature', async () => {
    const festival = entry({
      postType: 'seasonalEvent',
      title: 'Festival Of Lights',
      body: 'Welcome to the November seasonal event.',
      tiles: [
        { imageUrl: 'https://cdn.example.com/news/tack.png', caption: 'Limited Edition Tack' },
        { imageUrl: 'https://cdn.example.com/news/cookies.png', caption: 'Festive Horse Cookies' },
      ],
      authorName: 'Stacey',
      authorRoleLabel: 'Head Admin',
      gameDate: '2026-11-01',
      publishAt: '2026-11-01T04:00:00.000Z',
      endsAt: '2026-12-01T05:00:00.000Z',
      lastGameDate: '2026-11-30',
    });
    stubFeed(() => page({ today: '2026-11-23', items: [festival], ahead: [festival] }));
    renderNews();

    const post = await screen.findByRole('article', { name: 'Festival Of Lights' });
    expect(within(post).getByText('Seasonal Event')).toBeInTheDocument();
    expect(
      within(post).getByRole('heading', { level: 3, name: 'Festival Of Lights' })
    ).toBeInTheDocument();
    expect(within(post).getByText('Welcome to the November seasonal event.')).toBeInTheDocument();
    const tiles = within(post).getAllByRole('figure');
    expect(tiles.map((t) => t.textContent)).toEqual([
      'Limited Edition Tack',
      'Festive Horse Cookies',
    ]);
    expect(tiles[0].querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/news/tack.png'
    );
    expect(within(post).getByText('Stacey')).toBeInTheDocument();
    expect(within(post).getByText('Head Admin')).toBeInTheDocument();

    // The month's ribbon names it, counts the nights left, and leads to it.
    const ribbon = screen.getByRole('region', { name: 'Festival Of Lights' });
    expect(ribbon).toHaveTextContent('November’s seasonal event · 8 nights remain');
    expect(within(ribbon).getByRole('link', { name: /read the announcement/i })).toHaveAttribute(
      'href',
      `#news-item-${festival.id}`
    );
    // The event is in the ribbon, so it is not listed again under Ahead.
    expect(screen.queryByRole('heading', { level: 2, name: /ahead/i })).not.toBeInTheDocument();
  });

  it('signs a post whose author’s account is gone as "Equoria Staff"', async () => {
    stubFeed(() =>
      page({
        items: [
          entry({
            postType: 'adminLetter',
            title: 'An older letter',
            body: 'Hello.',
            authorName: null,
            authorRoleLabel: null,
          }),
        ],
      })
    );
    renderNews();
    const letter = await screen.findByRole('article', { name: 'An older letter' });
    expect(within(letter).getByText('Equoria Staff')).toBeInTheDocument();
    expect(within(letter).getByText('From Equoria Staff')).toBeInTheDocument();
  });

  it('walks further back one page at a time', async () => {
    const requested: (string | null)[] = [];
    stubFeed((before) => {
      requested.push(before);
      return before
        ? page({
            items: [
              entry({
                title: 'An older night',
                gameDate: '2026-10-01',
                publishAt: '2026-10-01T04:02:00.000Z',
              }),
            ],
            ahead: null,
          })
        : page({ items: [entry({ title: 'Tonight’s news' })], nextCursor: '1792728120000.7' });
    });
    renderNews();

    await screen.findByText('Tonight’s news');
    await userEvent.click(screen.getByRole('button', { name: 'Walk further back' }));
    expect(await screen.findByText('An older night')).toBeInTheDocument();
    expect(requested).toEqual([null, '1792728120000.7']);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Walk further back' })).not.toBeInTheDocument()
    );
  });
});

describe('NewsPage — the desk link', () => {
  it('shows "Write for the News" to an Admin and not to a player', async () => {
    stubFeed(() => page({ items: [entry({ title: 'Something' })] }));
    const { unmount } = renderNews('admin');
    expect(await screen.findByRole('link', { name: 'Write for the News' })).toHaveAttribute(
      'href',
      '/news/desk'
    );
    unmount();

    renderNews('user');
    await screen.findByText('Something');
    expect(screen.queryByRole('link', { name: 'Write for the News' })).not.toBeInTheDocument();
  });
});

describe('NewsPage hero (Equoria-vcpbq)', () => {
  it('shows the news banner in a panel below the title, with the gold divider', async () => {
    stubFeed(() => page({ items: [entry({ title: 'Something' })] }));
    renderNews();
    await screen.findByText('Something');

    const heading = screen.getByRole('heading', { level: 1, name: 'Equoria News' });
    const hero = heading.closest('header') as HTMLElement;
    expect(within(hero).getByTestId('page-hero-divider')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /equoria news/i })).toHaveAttribute(
      'src',
      '/images/equorianews.jpg'
    );
  });
});
