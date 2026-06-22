import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Groom-marketplace/refresh handler (no v1 mirror) + auth verification-status.
 * Registered after breeding, before user dashboard. First-match-wins order
 * preserved. The other groom routes live in the v1-mirror block (groomsV1Handlers).
 */
export const groomHandlers = [
  // Groom Management
  // (Equoria-0fw18) Deleted dead unversioned /api/grooms/user/:userId,
  // /api/groom-assignments (GET+POST), /api/groom-salaries/summary,
  // /api/groom-marketplace (GET), /api/groom-marketplace/hire — all served by
  // the v1 mirrors in the v1-mirror block below (groomsApi.* calls /api/v1/...).
  // /api/groom-marketplace/refresh is kept here, versioned to /api/v1/, because
  // it has no v1 mirror below (groomsApi.refreshMarketplace calls it).
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
