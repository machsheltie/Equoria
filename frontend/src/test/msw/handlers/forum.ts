import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Forum handlers (19B-1): thread list/detail, create thread, add post,
 * view count, pin. Registered after the v1-mirror block, before messages.
 * First-match-wins order preserved.
 */
export const forumHandlers = [
  // ── Forum (19B-1) ──────────────────────────────────────────────────────────

  http.get(`${base}/api/v1/forum/threads`, ({ request }) => {
    const url = new URL(request.url);
    const section = url.searchParams.get('section');
    const page = parseInt(url.searchParams.get('page') || '1', 10);

    const allThreads = [
      {
        id: 1,
        section: 'general',
        title: 'Welcome to Equoria Forums',
        author: { id: 'user-1', username: 'testuser' },
        tags: ['welcome', 'pinned'],
        isPinned: true,
        viewCount: 250,
        replyCount: 12,
        lastActivityAt: '2026-05-10T10:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 2,
        section: 'sales',
        title: 'Thoroughbred stallion for stud — excellent stats',
        author: { id: 'user-2', username: 'breeder99' },
        tags: ['stallion', 'stud'],
        isPinned: false,
        viewCount: 88,
        replyCount: 5,
        lastActivityAt: '2026-05-12T14:30:00Z',
        createdAt: '2026-05-11T09:00:00Z',
      },
      {
        id: 3,
        section: 'general',
        title: 'Tips for training young foals',
        author: { id: 'user-3', username: 'horsepro' },
        tags: ['training', 'foals'],
        isPinned: false,
        viewCount: 42,
        replyCount: 3,
        lastActivityAt: '2026-05-13T08:00:00Z',
        createdAt: '2026-05-12T16:00:00Z',
      },
    ];

    const filtered = section ? allThreads.filter((t) => t.section === section) : allThreads;
    const limit = 10;
    const start = (page - 1) * limit;
    const threads = filtered.slice(start, start + limit);

    return HttpResponse.json({ threads, total: filtered.length, page });
  }),

  http.get(`${base}/api/v1/forum/threads/:id`, ({ params }) => {
    const id = Number(params.id);
    if (id === 999) {
      return HttpResponse.json({ success: false, message: 'Thread not found' }, { status: 404 });
    }
    return HttpResponse.json({
      thread: {
        id,
        section: 'general',
        title: 'Welcome to Equoria Forums',
        author: { id: 'user-1', username: 'testuser' },
        tags: ['welcome'],
        isPinned: false,
        viewCount: 251,
        replyCount: 2,
        lastActivityAt: '2026-05-13T09:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
      },
      posts: [
        {
          id: 1,
          threadId: id,
          author: { id: 'user-1', username: 'testuser' },
          content: 'Welcome everyone! Glad to have you here.',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 2,
          threadId: id,
          author: { id: 'user-2', username: 'breeder99' },
          content: 'Thanks for setting this up!',
          createdAt: '2026-01-02T10:00:00Z',
        },
      ],
    });
  }),

  http.post(`${base}/api/v1/forum/threads`, async ({ request }) => {
    const body = (await request.json()) as {
      section: string;
      title: string;
      content: string;
      tags?: string[];
    };
    const now = new Date().toISOString();
    return HttpResponse.json(
      {
        thread: {
          id: 100,
          section: body.section,
          title: body.title,
          author: { id: 'user-1', username: 'testuser' },
          tags: body.tags ?? [],
          isPinned: false,
          viewCount: 1,
          replyCount: 1,
          lastActivityAt: now,
          createdAt: now,
        },
        firstPost: {
          id: 200,
          threadId: 100,
          author: { id: 'user-1', username: 'testuser' },
          content: body.content,
          createdAt: now,
        },
      },
      { status: 201 }
    );
  }),

  http.post(`${base}/api/v1/forum/threads/:id/posts`, async ({ request, params }) => {
    const body = (await request.json()) as { content: string };
    const now = new Date().toISOString();
    return HttpResponse.json(
      {
        post: {
          id: 300,
          threadId: Number(params.id),
          author: { id: 'user-1', username: 'testuser' },
          content: body.content,
          createdAt: now,
        },
      },
      { status: 201 }
    );
  }),

  http.post(`${base}/api/v1/forum/threads/:id/view`, () => HttpResponse.json({})),

  http.patch(`${base}/api/v1/forum/threads/:id/pin`, async ({ request, params }) => {
    const body = (await request.json()) as { isPinned?: boolean };
    return HttpResponse.json({
      thread: {
        id: Number(params.id),
        isPinned: body.isPinned ?? true,
      },
    });
  }),
];
