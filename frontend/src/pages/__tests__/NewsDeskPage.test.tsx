/**
 * NewsDeskPage — staff write News (Equoria-wbt8l, owner rulings 2026-10-23).
 *
 * The real page and form, real hooks, React Query and apiClient (CSRF
 * included), with the network boundary stubbed by MSW.
 *
 * - Anyone without admin-level access sees the ordinary not-found page.
 * - The post TYPE is chosen first, from the types the server allows this
 *   writer, and decides the fields.
 * - An Admin writes only their own letter; the draft is kept on a refusal.
 * - A seasonal event takes a month and up to four captioned tiles uploaded at
 *   the desk; when picture storage is not set up the desk says so.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import type { NewsDesk, NewsDeskPost } from '@/lib/api/news';
import NewsDeskPage from '../NewsDeskPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const deskPath = `${base}/api/v1/admin/news`;

function desk(overrides: Partial<NewsDesk>): NewsDesk {
  return {
    allowedTypes: ['adminLetter'],
    signature: { name: 'Wren', roleLabel: 'Admin' },
    imageUploadsReady: false,
    today: '2026-10-23',
    posts: [],
    ...overrides,
  };
}

function deskPost(overrides: Partial<NewsDeskPost>): NewsDeskPost {
  return {
    id: 41,
    postType: 'adminLetter',
    title: 'Hello riders',
    body: 'Words.',
    tiles: [],
    authorName: 'Wren',
    authorRoleLabel: 'Admin',
    linkPath: null,
    publishAt: '2026-10-23T12:00:00.000Z',
    gameDate: '2026-10-23',
    endsAt: null,
    lastGameDate: null,
    scheduled: false,
    month: null,
    closesOn: null,
    canChange: true,
    ...overrides,
  };
}

function renderDesk(role: 'user' | 'moderator' | 'admin') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider userOverrides={{ role }}>
        <BrowserRouter>
          <NewsDeskPage />
        </BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('NewsDeskPage', () => {
  it.each(['user', 'moderator'] as const)(
    'is not found for a %s, and asks the server nothing',
    async (role) => {
      let asked = false;
      server.use(
        http.get(deskPath, () => {
          asked = true;
          return HttpResponse.json({ success: true, data: desk({}) });
        })
      );
      renderDesk(role);
      expect(screen.queryByRole('heading', { name: 'The News Desk' })).not.toBeInTheDocument();
      expect(asked).toBe(false);
    }
  );

  it('lets an Admin write their own letter: type first, then the words', async () => {
    const sent: unknown[] = [];
    let posts: NewsDeskPost[] = [];
    server.use(
      http.get(deskPath, () => HttpResponse.json({ success: true, data: desk({ posts }) })),
      http.post(deskPath, async ({ request }) => {
        const body = (await request.json()) as Record<string, string>;
        sent.push(body);
        const post = deskPost({ title: body.title, body: body.body });
        posts = [post];
        return HttpResponse.json({ success: true, data: { post } }, { status: 201 });
      })
    );
    renderDesk('admin');

    const choice = await screen.findByRole('radio', { name: /from admin wren/i });
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument();

    await userEvent.click(choice);
    await userEvent.click(screen.getByRole('button', { name: 'Post to News' }));
    expect(await screen.findByText('Give the post a title.')).toBeInTheDocument();
    expect(sent).toHaveLength(0);

    await userEvent.type(screen.getByLabelText(/title/i), 'Hello riders');
    await userEvent.type(screen.getByLabelText(/words/i), 'See you in the ring.');
    await userEvent.click(screen.getByRole('button', { name: 'Post to News' }));

    expect(await screen.findByText('Posted to News.')).toBeInTheDocument();
    expect(sent).toEqual([
      { postType: 'adminLetter', title: 'Hello riders', body: 'See you in the ring.' },
    ]);
    expect(await screen.findByText('Hello riders')).toBeInTheDocument();
  });

  it('keeps the draft and says why when the server refuses the post', async () => {
    server.use(
      http.get(deskPath, () => HttpResponse.json({ success: true, data: desk({}) })),
      http.post(deskPath, () =>
        HttpResponse.json({ success: false, message: 'no' }, { status: 403 })
      )
    );
    renderDesk('admin');

    await userEvent.click(await screen.findByRole('radio', { name: /from admin wren/i }));
    await userEvent.type(screen.getByLabelText(/title/i), 'Kept title');
    await userEvent.type(screen.getByLabelText(/words/i), 'Kept words');
    await userEvent.click(screen.getByRole('button', { name: 'Post to News' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your staff role can’t write or change this kind of post.'
    );
    expect(screen.getByLabelText(/title/i)).toHaveValue('Kept title');
    expect(screen.getByLabelText(/words/i)).toHaveValue('Kept words');
  });

  it('says plainly when picture storage is not set up for a seasonal event', async () => {
    server.use(
      http.get(deskPath, () =>
        HttpResponse.json({
          success: true,
          data: desk({
            allowedTypes: ['seasonalEvent', 'headAdminLetter', 'update', 'contest'],
            signature: { name: 'Stacey', roleLabel: 'Head Admin' },
          }),
        })
      )
    );
    renderDesk('admin');

    expect(await screen.findAllByRole('radio')).toHaveLength(4);
    await userEvent.click(screen.getByRole('radio', { name: /seasonal events/i }));
    expect(screen.getByLabelText(/^month/i)).toBeInTheDocument();
    expect(screen.getByText(/picture storage isn’t set up yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add a picture tile/i })).not.toBeInTheDocument();
  });

  it('uploads a tile picture at the desk and schedules the event with it', async () => {
    const sent: Record<string, unknown>[] = [];
    let uploadType: string | null = null;
    server.use(
      http.get(deskPath, () =>
        HttpResponse.json({
          success: true,
          data: desk({
            allowedTypes: ['seasonalEvent', 'headAdminLetter', 'update', 'contest'],
            signature: { name: 'Stacey', roleLabel: 'Head Admin' },
            imageUploadsReady: true,
          }),
        })
      ),
      http.post(`${deskPath}/images`, ({ request }) => {
        uploadType = request.headers.get('content-type');
        return HttpResponse.json(
          { success: true, data: { imageUrl: 'https://cdn.example.com/news/abc.png' } },
          { status: 201 }
        );
      }),
      http.post(deskPath, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        sent.push(body);
        return HttpResponse.json(
          {
            success: true,
            data: {
              post: deskPost({ postType: 'seasonalEvent', scheduled: true, month: '2026-11' }),
            },
          },
          { status: 201 }
        );
      })
    );
    renderDesk('admin');

    await userEvent.click(await screen.findByRole('radio', { name: /seasonal events/i }));
    // jsdom sanitizes a month input typed character by character; set it whole.
    fireEvent.change(screen.getByLabelText(/^month/i), { target: { value: '2026-11' } });
    await userEvent.type(screen.getByLabelText(/title/i), 'Festival Of Lights');
    await userEvent.type(screen.getByLabelText(/words/i), 'All of November.');
    await userEvent.click(screen.getByRole('button', { name: /add a picture tile/i }));
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'tack.png', {
      type: 'image/png',
    });
    await userEvent.upload(screen.getByLabelText('Tile 1 picture'), file);
    await waitFor(() => expect(uploadType).toBe('image/png'));
    await userEvent.type(screen.getByLabelText('Tile 1 caption'), 'Limited Edition Tack');
    await userEvent.click(screen.getByRole('button', { name: 'Schedule the event' }));

    expect(
      await screen.findByText(/scheduled\. it goes out at the start of the 1st/i)
    ).toBeInTheDocument();
    expect(sent).toEqual([
      {
        postType: 'seasonalEvent',
        title: 'Festival Of Lights',
        body: 'All of November.',
        month: '2026-11',
        tiles: [
          { imageUrl: 'https://cdn.example.com/news/abc.png', caption: 'Limited Edition Tack' },
        ],
      },
    ]);
  });
});
