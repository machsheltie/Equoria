/**
 * StaffForumWords: the forum's blocked and review word lists (Equoria-puj1e.3,
 * owner rulings q380 and q381). Adding a word shows it in its list; removing it
 * takes it away; a refusal shows in words beside the control.
 *
 * The real hooks over the real apiClient; MSW stubs the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffForumWords from '../StaffForumWords';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WORDS = `${base}/api/v1/staff/forum/words`;

describe('StaffForumWords', () => {
  let queryClient: QueryClient;
  let lists: { blocked: { id: number; word: string }[]; review: { id: number; word: string }[] };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    lists = { blocked: [{ id: 1, word: 'cheat' }], review: [] };
    server.use(http.get(WORDS, () => HttpResponse.json(lists)));
  });

  const renderIt = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <StaffForumWords onCheckinRequired={() => undefined} />
      </QueryClientProvider>
    );

  it('shows both lists, with an honest empty list', async () => {
    renderIt();
    const blocked = await screen.findByTestId('forum-words-blocked');
    expect(within(blocked).getByText('cheat')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('forum-words-review')).getByText('No review words yet.')
    ).toBeInTheDocument();
  });

  it('adds a word to the review list and it appears there', async () => {
    let sent: unknown = null;
    server.use(
      http.post(WORDS, async ({ request }) => {
        sent = await request.json();
        lists = { ...lists, review: [{ id: 2, word: 'cheap coins' }] };
        return HttpResponse.json({ id: 2, list: 'review', word: 'cheap coins' });
      })
    );
    const user = userEvent.setup();
    renderIt();
    const review = await screen.findByTestId('forum-words-review');
    await user.type(
      within(review).getByRole('textbox', { name: 'Add to review words' }),
      'Cheap Coins'
    );
    await user.click(within(review).getByRole('button', { name: 'Add' }));
    expect(await within(review).findByText('cheap coins')).toBeInTheDocument();
    expect(sent).toEqual({ list: 'review', word: 'Cheap Coins' });
    expect(within(review).getByRole('textbox', { name: 'Add to review words' })).toHaveValue('');
  });

  it('says so beside the control when the word is already listed', async () => {
    server.use(
      http.post(WORDS, () =>
        HttpResponse.json(
          { success: false, code: 'forumWordExists', message: 'x' },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();
    renderIt();
    const blocked = await screen.findByTestId('forum-words-blocked');
    await user.type(
      within(blocked).getByRole('textbox', { name: 'Add to blocked words' }),
      'cheat'
    );
    await user.click(within(blocked).getByRole('button', { name: 'Add' }));
    expect(
      await within(blocked).findByText('That word is already on this list.')
    ).toBeInTheDocument();
  });

  it('removes a word and it leaves the list', async () => {
    let removed = false;
    server.use(
      http.post(`${WORDS}/1/remove`, () => {
        removed = true;
        lists = { ...lists, blocked: [] };
        return HttpResponse.json({ id: 1, removed: true });
      })
    );
    const user = userEvent.setup();
    renderIt();
    const blocked = await screen.findByTestId('forum-words-blocked');
    await user.click(within(blocked).getByRole('button', { name: 'Remove cheat' }));
    await waitFor(() => expect(within(blocked).queryByText('cheat')).toBeNull());
    expect(removed).toBe(true);
    expect(within(blocked).getByText('No blocked words yet.')).toBeInTheDocument();
  });
});
