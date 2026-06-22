import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Breeding / foals handlers that have NO v1 mirror (POST activity, PUT develop).
 * Registered after horses, before grooms. First-match-wins order preserved.
 */
export const breedingHandlers = [
  // Breeding / foals
  // (Equoria-0fw18) Deleted dead unversioned /api/horses/foals — the v1 twin
  // /api/v1/horses/foals (in the v1-mirror block below) serves the real
  // breedingApi.breed call. Contract: pregnancy-started response (B3 delayed
  // foaling) — `{ success, message, data: { pregnancyStarted, damId, sireId, foalDueDate } }`.
  // (Equoria-0fw18) Deleted dead /api/foals/breeding/breed handler — no
  // api-client call and no test referenced it; the real breeding flow posts
  // to /api/v1/horses/foals (handled above).
  // (Equoria-0fw18) Deleted dead unversioned /api/foals/:id, /development,
  // /activities, /enrich, /reveal-traits — the v1 mirrors below serve the real
  // breedingApi.* calls (/api/v1/foals/:id...). The POST /activity and PUT
  // /develop handlers are kept here, versioned to /api/v1/, because they have
  // no v1 mirror below (breedingApi.recordActivity / developFoal call them).
  http.post(`${base}/api/v1/foals/:id/activity`, async ({ request, params }) => {
    const body = (await request.json()) as { activityType?: string; activity?: string };
    return HttpResponse.json({
      success: true,
      data: {
        id: 2,
        activity: body.activityType ?? body.activity ?? 'activity',
        foalId: params.id,
      },
    });
  }),
  http.put(`${base}/api/v1/foals/:id/develop`, async ({ request, params }) => {
    const updates = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      data: { foalId: Number(params.id), ...updates },
    });
  }),
];
