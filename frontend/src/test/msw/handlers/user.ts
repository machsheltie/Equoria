import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * User Dashboard & Progress + in-game notifications handlers.
 * Registered after grooms, before the competition block. First-match-wins
 * order preserved.
 */
export const userHandlers = [
  // User Dashboard & Progress
  // (Equoria-0fw18) Deleted dead unversioned /api/users/:id/progress,
  // /api/users/dashboard/:id, /api/users/:id/activity — v1 mirrors below serve
  // the real userProgressApi.* calls.
  // v1 user endpoints (userProgressApi calls /api/v1/users/...)
  http.get(`${base}/api/v1/users/:id/progress`, ({ params }) => {
    if (params.id === '999999') {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      data: {
        userId: params.id,
        username: 'testuser',
        level: 1,
        xp: 50,
        xpToNextLevel: 50,
        xpForNextLevel: 100,
        xpForCurrentLevel: 0,
        progressPercentage: 50,
        totalEarnings: 1000,
      },
    });
  }),
  http.get(`${base}/api/v1/users/dashboard/:id`, ({ params }) => {
    if (params.id === '999999') {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      data: {
        user: {
          id: params.id,
          username: 'testuser',
          level: 1,
          xp: 50,
          money: 1000,
        },
        horses: { total: 2, trainable: 1 },
        shows: { upcomingEntries: 0, nextShowRuns: [] },
        activity: { lastTrained: 'never', lastShowPlaced: 'never' },
      },
    });
  }),
  http.get(`${base}/api/v1/users/:id/activity`, () =>
    HttpResponse.json({
      success: true,
      data: [],
    })
  ),
  http.get(`${base}/api/v1/users/:id`, ({ params }) => {
    if (params.id === '999999') {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      data: {
        id: params.id,
        username: 'testuser',
        money: 1000,
        level: 1,
        currentHorses: 2,
        stableLimit: 10,
      },
    });
  }),

  // Game notifications (Equoria-sqyb) — called by useGameNotifications hook
  // used in MainNavigation.tsx and MessagesPage.tsx. Returns empty list by default;
  // tests needing populated data should server.use(...) a local override.
  http.get(`${base}/api/v1/users/me/game-notifications`, () =>
    HttpResponse.json({
      success: true,
      data: {
        notifications: [],
        unreadCount: 0,
      },
    })
  ),
  http.patch(`${base}/api/v1/users/me/game-notifications/read-all`, () =>
    HttpResponse.json({
      success: true,
      data: null,
    })
  ),

  // (Equoria-0fw18) Deleted dead unversioned /api/users/:id (useUser profile) —
  // the v1 mirror /api/v1/users/:id above serves the real call.
];
