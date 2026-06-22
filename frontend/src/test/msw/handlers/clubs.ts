import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Clubs handlers (19B-3) + riders API handlers (interleaved between club
 * election routes — order is load-bearing and preserved exactly as it
 * appeared in the monolithic handlers.ts).
 *
 * NOTE: /clubs/mine and /clubs/elections/:id/* MUST be registered before
 * /clubs/:id to prevent MSW from matching "mine" or "elections" as :id.
 * Registered after messages, before the v1 training/grooms/foals mirrors.
 * First-match-wins order preserved.
 */
export const clubHandlers = [
  // ── Clubs (19B-3) ─────────────────────────────────────────────────────────
  // NOTE: /clubs/mine and /clubs/elections/:id/* MUST be registered before
  // /clubs/:id to prevent MSW from matching "mine" or "elections" as :id.

  http.get(`${base}/api/v1/clubs/mine`, () =>
    HttpResponse.json({
      memberships: [
        {
          id: 1,
          club: {
            id: 10,
            name: 'Dressage Enthusiasts',
            type: 'discipline',
            category: 'Dressage',
            description: 'For lovers of classical dressage.',
            leader: { id: 'user-3', username: 'horsepro' },
            memberCount: 42,
            createdAt: '2025-06-01T00:00:00Z',
          },
          role: 'member',
          joinedAt: '2026-01-15T00:00:00Z',
        },
      ],
    })
  ),

  http.get(`${base}/api/v1/clubs/elections/:id/results`, ({ params }) => {
    const id = Number(params.id);
    return HttpResponse.json({
      election: {
        id,
        clubId: 10,
        position: 'President',
        status: 'closed',
        startsAt: '2026-04-01T00:00:00Z',
        endsAt: '2026-04-07T00:00:00Z',
      },
      candidates: [
        {
          id: 1,
          user: { id: 'user-3', username: 'horsepro' },
          statement: 'I will grow this club!',
          voteCount: 15,
        },
        {
          id: 2,
          user: { id: 'user-2', username: 'breeder99' },
          statement: 'Experience matters.',
          voteCount: 8,
        },
      ],
    });
  }),

  http.post(`${base}/api/v1/clubs/elections/:id/nominate`, () =>
    HttpResponse.json({}, { status: 201 })
  ),

  http.post(`${base}/api/v1/clubs/elections/:id/vote`, () =>
    HttpResponse.json({}, { status: 201 })
  ),

  http.get(`${base}/api/v1/clubs`, ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');

    const allClubs = [
      {
        id: 10,
        name: 'Dressage Enthusiasts',
        type: 'discipline',
        category: 'Dressage',
        description: 'For lovers of classical dressage.',
        leader: { id: 'user-3', username: 'horsepro' },
        memberCount: 42,
        createdAt: '2025-06-01T00:00:00Z',
      },
      {
        id: 11,
        name: 'Arabian Breed Society',
        type: 'breed',
        category: 'Arabian',
        description: 'Dedicated to preserving and celebrating the Arabian breed.',
        leader: { id: 'user-5', username: 'arabianfan' },
        memberCount: 28,
        createdAt: '2025-08-15T00:00:00Z',
      },
      {
        id: 12,
        name: 'Show Jumping League',
        type: 'discipline',
        category: 'Show Jumping',
        description: 'Competitive show jumping community.',
        leader: { id: 'user-6', username: 'jumpmaster' },
        memberCount: 67,
        createdAt: '2025-03-20T00:00:00Z',
      },
    ];

    const clubs = type ? allClubs.filter((c) => c.type === type) : allClubs;
    return HttpResponse.json({ clubs });
  }),

  http.post(`${base}/api/v1/clubs`, async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      type: string;
      category: string;
      description: string;
    };
    const now = new Date().toISOString();
    return HttpResponse.json(
      {
        club: {
          id: 200,
          name: body.name,
          type: body.type,
          category: body.category,
          description: body.description,
          leader: { id: 'user-1', username: 'testuser' },
          memberCount: 1,
          createdAt: now,
        },
      },
      { status: 201 }
    );
  }),

  http.get(`${base}/api/v1/clubs/:id`, ({ params }) => {
    const id = Number(params.id);
    if (id === 999) {
      return HttpResponse.json({ success: false, message: 'Club not found' }, { status: 404 });
    }
    return HttpResponse.json({
      club: {
        id,
        name: 'Dressage Enthusiasts',
        type: 'discipline',
        category: 'Dressage',
        description: 'For lovers of classical dressage.',
        leader: { id: 'user-3', username: 'horsepro' },
        memberCount: 42,
        createdAt: '2025-06-01T00:00:00Z',
        members: [
          {
            id: 1,
            user: { id: 'user-3', username: 'horsepro' },
            role: 'president',
            joinedAt: '2025-06-01T00:00:00Z',
          },
          {
            id: 2,
            user: { id: 'user-1', username: 'testuser' },
            role: 'member',
            joinedAt: '2026-01-15T00:00:00Z',
          },
        ],
      },
    });
  }),

  http.post(`${base}/api/v1/clubs/:id/join`, ({ params }) =>
    HttpResponse.json(
      {
        membership: {
          id: 500,
          club: {
            id: Number(params.id),
            name: 'Dressage Enthusiasts',
            type: 'discipline',
            category: 'Dressage',
            description: 'For lovers of classical dressage.',
            leader: { id: 'user-3', username: 'horsepro' },
            memberCount: 43,
            createdAt: '2025-06-01T00:00:00Z',
          },
          role: 'member',
          joinedAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    )
  ),

  http.delete(`${base}/api/v1/clubs/:id/leave`, () => HttpResponse.json({ success: true })),

  http.patch(`${base}/api/v1/clubs/:id/transfer-leadership`, () =>
    HttpResponse.json({ success: true })
  ),

  http.get(`${base}/api/v1/clubs/:id/elections`, ({ params }) =>
    HttpResponse.json({
      elections: [
        {
          id: 1,
          clubId: Number(params.id),
          position: 'President',
          status: 'open',
          startsAt: '2026-05-10T00:00:00Z',
          endsAt: '2026-05-17T00:00:00Z',
        },
      ],
    })
  ),

  // Riders API (ridersApi.getUserRiders → GET /api/v1/riders/user/:userId)
  // Used by HorseDetailPage to fetch assigned riders.
  http.get(`${base}/api/v1/riders/user/:userId`, () => HttpResponse.json([])),
  http.get(`${base}/api/v1/riders/assignments`, () => HttpResponse.json([])),
  http.get(`${base}/api/v1/riders/marketplace`, () =>
    HttpResponse.json({ success: true, data: { riders: [], refreshedAt: null } })
  ),

  http.post(`${base}/api/v1/clubs/:id/elections`, async ({ request, params }) => {
    const body = (await request.json()) as {
      position: string;
      startsAt: string;
      endsAt: string;
    };
    return HttpResponse.json(
      {
        election: {
          id: 600,
          clubId: Number(params.id),
          position: body.position,
          status: 'upcoming',
          startsAt: body.startsAt,
          endsAt: body.endsAt,
        },
      },
      { status: 201 }
    );
  }),
];
