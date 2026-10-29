import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Groom-marketplace/refresh handler (no v1 mirror) + auth verification-status.
 * Registered after breeding, before user dashboard. First-match-wins order
 * preserved. The other groom routes live in the v1-mirror block (groomsV1Handlers).
 */
export const groomHandlers = [
  // Daily groom care (care agent contract v1; Equoria-j765w.2). Defaults: no
  // horse waiting tonight, and a horse with no groom yet. Tests override per case.
  // ungroomed-today is registered before :horseId so it is not read as an id.
  http.get(`${base}/api/v1/grooms/care/ungroomed-today`, () =>
    HttpResponse.json({ success: true, data: { horses: [] } })
  ),
  http.get(`${base}/api/v1/grooms/care/:horseId`, ({ params }) =>
    HttpResponse.json({
      success: true,
      data: {
        horseId: Number(params.horseId),
        horseName: 'TestFixture-Horse',
        bond: 0,
        lastGroomedAt: null,
        groomedToday: false,
        canGroomToday: false,
        refusal: {
          code: 'noGroomAssigned',
          message: 'This horse has no groom yet. Assign one to groom it.',
        },
        groom: null,
        foal: null,
      },
    })
  ),
  // Groom Management
  // (Equoria-0fw18) Deleted dead unversioned /api/grooms/user/:userId,
  // /api/groom-assignments (GET+POST), /api/groom-salaries/cost,
  // /api/groom-marketplace (GET), /api/groom-marketplace/hire — all served by
  // the v1 mirrors in the v1-mirror block below (groomsApi.* calls /api/v1/...).
  // /api/groom-marketplace/refresh is kept here, versioned to /api/v1/, because
  // it has no v1 mirror below (groomsApi.refreshMarketplace calls it).
  // Equoria-266h7: the grooms-for-hire pool on Groom Quarters' Hire tab; empty by default.
  http.get(`${base}/api/v1/groom-marketplace/free-agents`, () =>
    HttpResponse.json({ success: true, data: { grooms: [], total: 0 } })
  ),
  // Equoria-hwboq: the groom limit (q285). Default: room on the roster, so no Release.
  http.get(`${base}/api/v1/grooms/roster-cap`, () =>
    HttpResponse.json({ success: true, data: { rosterCap: 10, activeGrooms: 0 } })
  ),
  http.post(`${base}/api/v1/groom-marketplace/refresh`, () =>
    HttpResponse.json({
      success: true,
      data: {
        grooms: [
          {
            marketplaceId: 'mp-001',
            firstName: 'Alice',
            lastName: 'Thornton',
            specialty: 'Dressage',
            skillLevel: 'Expert',
            personality: 'Calm',
            experience: 8,
            sessionRate: 150,
            bio: 'Experienced dressage specialist.',
            availability: true,
          },
          {
            marketplaceId: 'mp-002',
            firstName: 'Ben',
            lastName: 'Marsh',
            specialty: 'Show Jumping',
            skillLevel: 'Intermediate',
            personality: 'Energetic',
            experience: 4,
            sessionRate: 100,
            bio: 'Show jumping enthusiast.',
            availability: true,
          },
        ],
        lastRefresh: '2026-02-25T00:00:00Z',
        nextFreeRefresh: '2026-03-04T00:00:00Z',
        refreshCost: 500,
        canRefreshFree: true,
        refreshCount: 4,
      },
    })
  ),
  // (Equoria-0fw18) Deleted dead unversioned POST /api/groom-assignments —
  // v1 twin POST /api/v1/groom-assignments below serves groomsApi.createAssignment.

  // Auth Status
  http.get(`${base}/api/v1/auth/verification-status`, () =>
    HttpResponse.json({
      success: true,
      data: {
        isEmailVerified: true,
        email: 'test@example.com',
      },
    })
  ),
];
