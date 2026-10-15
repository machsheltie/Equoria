import type { RequestHandler } from 'msw';

/**
 * Breeding / foals handlers that have NO v1 mirror. None remain: POST
 * /activity went with the removed player-run foal activities (Equoria-fr2kg)
 * and PUT /develop with the retired endpoint (Equoria-mwjst).
 * Registered after horses, before grooms. First-match-wins order preserved.
 */
export const breedingHandlers: RequestHandler[] = [
  // Breeding / foals
  // (Equoria-0fw18) Deleted dead unversioned /api/horses/foals — the v1 twin
  // /api/v1/horses/foals (in the v1-mirror block below) serves the real
  // breedingApi.breed call. Contract: pregnancy-started response (B3 delayed
  // foaling) — `{ success, message, data: { pregnancyStarted, damId, sireId, foalDueDate } }`.
  // (Equoria-0fw18) Deleted dead /api/foals/breeding/breed handler — no
  // api-client call and no test referenced it; the real breeding flow posts
  // to /api/v1/horses/foals (handled above).
  // (Equoria-0fw18) Deleted dead unversioned /api/foals/:id, /development,
  // /activities, /enrich, /reveal-traits — the v1 mirrors serve the real
  // breedingApi.* calls (/api/v1/foals/:id...).
];
