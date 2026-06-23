/**
 * Rider + Trainer Unassign — real end-to-end MUTATION (Equoria-phv9p)
 *
 * WHAT THE RTL TWINS ALREADY COVER (do NOT re-do here):
 *   frontend/src/components/rider/__tests__/RiderAssignmentCard.confirmDialog.test.tsx
 *   frontend/src/components/trainer/__tests__/TrainerAssignmentCard.confirmDialog.test.tsx
 *   — the pure GameDialog INTERACTION contract: confirm fires onUnassign(id),
 *     cancel does NOT, and the trigger is disabled while isUnassigning. Those
 *     run against a STUB onUnassign prop with NO network. They prove the
 *     client-side branch logic, nothing about the real backend.
 *
 * WHAT THIS SPEC ADDS (the gap the RTL twins explicitly defer — see their
 * header comments, "E2E-deferred Equoria-o5hub.34-e2e-1"):
 *   The REAL end-to-end mutation on the live dashboard:
 *     dashboard renders a real assignment
 *       -> click the unassign trigger
 *       -> confirm "Remove Rider"/"Remove Trainer" in the real GameDialog
 *       -> assert the REAL DELETE /api/v1/{riders,trainers}/assignments/:id fires (2xx)
 *       -> assert the assignment row is GONE from the dashboard after the
 *          real GET /api/v1/{riders,trainers}/assignments refetch.
 *
 * VERIFIED ENDPOINTS (quoted from frontend/src/lib/api/{riders,trainers}.ts):
 *   DELETE /api/v1/riders/assignments/:id    (ridersApi.deleteAssignment)
 *   DELETE /api/v1/trainers/assignments/:id  (trainersApi.deleteAssignment)
 *   refetch GET /api/v1/riders/assignments   (useRiderAssignments → invalidate)
 *   refetch GET /api/v1/trainers/assignments (useTrainerAssignments → invalidate)
 *
 * PRECONDITION STRATEGY (self-contained create-then-unassign — no DB shortcut,
 * no residue beyond a deactivated assignment + one hired staff member):
 *   An unassign needs an EXISTING active assignment first. We build it through
 *   the REAL app API (not Prisma) using the storageState-authed request context:
 *     1. GET /api/v1/{riders,trainers}/marketplace  (refresh force=true if empty)
 *     2. POST .../marketplace/hire { marketplaceId }   → hired staff id
 *     3. GET  /api/v1/horses                           → the onboarded starter horse
 *     4. POST .../assignments { riderId|trainerId, horseId } → active assignment id
 *   Then the UI test unassigns it. Setup runs through csrfMutate() so it
 *   exercises the same real CSRF round-trip the browser uses (NODE_ENV=beta).
 *
 * CONSTITUTION COMPLIANCE (CLAUDE.md §2/§3):
 *   - Real credentials (storageState), real backend, real DB, real CSRF.
 *   - No bypass headers, no test.skip / conditional skip on this beta path.
 *   - The mutation under test is the real DELETE, asserted via waitForResponse.
 *   - Cleanup is scoped: only the assignment created here is unassigned; the
 *     hired staff member is left on the account (a benign owned record, the
 *     same residue a real player's hire leaves) — no broad deleteMany.
 */

import { test, expect, type APIRequestContext, type Browser } from '@playwright/test';
import { createAuthedSession, csrfMutate, type AuthedSession } from './helpers/api';

// Pull the data array out of the API envelope ({ success, data } or bare array).
function unwrap<T = unknown>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

async function getJson(request: APIRequestContext, url: string): Promise<unknown> {
  const res = await request.get(url);
  expect(res.ok(), `GET ${url} expected 2xx, got ${res.status()} — ${await res.text()}`).toBe(true);
  return res.json();
}

/** The onboarded starter horse id for the storageState user. */
async function getStarterHorseId(request: APIRequestContext): Promise<number> {
  const horses = unwrap<Array<{ id: number; name: string }>>(
    await getJson(request, '/api/v1/horses')
  );
  expect(
    Array.isArray(horses) && horses.length > 0,
    'Expected the storageState user to own at least one horse (the onboarding starter horse). ' +
      'Did tests/e2e/global-setup.ts complete onboarding?'
  ).toBe(true);
  return horses[0].id;
}

/**
 * Pick a hireable marketplace listing id, refreshing (force=true) once if the
 * current offer set is empty. Returns the marketplaceId to hire.
 */
async function pickMarketplaceListingId(
  session: AuthedSession,
  staff: 'riders' | 'trainers'
): Promise<string> {
  const collection = staff === 'riders' ? 'riders' : 'trainers';
  const readOffers = (body: unknown): Array<{ id?: string; marketplaceId?: string }> => {
    const data = unwrap<{ riders?: unknown[]; trainers?: unknown[] }>(body);
    const arr = (data?.riders ?? data?.trainers ?? []) as Array<{
      id?: string;
      marketplaceId?: string;
    }>;
    return arr;
  };

  let offers = readOffers(await getJson(session.request, `/api/v1/${collection}/marketplace`));
  if (offers.length === 0) {
    const refreshRes = await csrfMutate(
      session,
      'POST',
      `/api/v1/${collection}/marketplace/refresh`,
      { force: true }
    );
    expect(
      refreshRes.ok(),
      `POST /api/v1/${collection}/marketplace/refresh expected 2xx, got ${refreshRes.status()} — ${await refreshRes.text()}`
    ).toBe(true);
    offers = readOffers(await refreshRes.json());
  }

  expect(
    offers.length,
    `Expected at least one ${staff} marketplace listing after refresh — the account may have ` +
      'insufficient funds to refresh, or the marketplace generator returned no offers.'
  ).toBeGreaterThan(0);

  const id = offers[0].marketplaceId ?? offers[0].id;
  expect(typeof id, `${staff} marketplace listing must carry a marketplaceId/id`).toBe('string');
  return id as string;
}

/**
 * Hire one staff member + assign to the starter horse via the real API.
 * Returns the created active assignment id (what the dashboard renders).
 */
async function createAssignmentViaApi(
  session: AuthedSession,
  staff: 'riders' | 'trainers',
  horseId: number
): Promise<number> {
  const collection = staff === 'riders' ? 'riders' : 'trainers';
  const idField = staff === 'riders' ? 'riderId' : 'trainerId';

  const marketplaceId = await pickMarketplaceListingId(session, staff);

  const hireRes = await csrfMutate(session, 'POST', `/api/v1/${collection}/marketplace/hire`, {
    marketplaceId,
  });
  expect(
    hireRes.ok(),
    `POST /api/v1/${collection}/marketplace/hire expected 2xx, got ${hireRes.status()} — ${await hireRes.text()}. ` +
      'Most likely insufficient funds on the test account.'
  ).toBe(true);
  const hired = unwrap<{ rider?: { id: number }; trainer?: { id: number } }>(await hireRes.json());
  const staffId = hired?.rider?.id ?? hired?.trainer?.id;
  expect(typeof staffId, `hire response must include the new ${staff} id`).toBe('number');

  const assignRes = await csrfMutate(session, 'POST', `/api/v1/${collection}/assignments`, {
    [idField]: staffId,
    horseId,
  });
  expect(
    assignRes.ok(),
    `POST /api/v1/${collection}/assignments expected 2xx, got ${assignRes.status()} — ${await assignRes.text()}`
  ).toBe(true);
  const assignment = unwrap<{ id: number }>(await assignRes.json());
  expect(typeof assignment?.id, `assign response must include the new assignment id`).toBe(
    'number'
  );
  return assignment.id;
}

test.describe('Rider + Trainer Unassign — real mutation (Equoria-phv9p)', () => {
  test.beforeEach(() => {
    // Hire + assign + page load + real CSRF round-trips need headroom on a
    // possibly-contended local stack.
    test.setTimeout(90_000);
  });

  test('Rider: confirming unassign on MyRidersDashboard fires the real DELETE and removes the row', async ({
    page,
    browser,
  }: {
    page: import('@playwright/test').Page;
    browser: Browser;
  }) => {
    // ── Precondition: build a real active rider assignment via the real API ──
    const session = await createAuthedSession(browser);
    let assignmentId: number;
    try {
      const horseId = await getStarterHorseId(session.request);
      assignmentId = await createAssignmentViaApi(session, 'riders', horseId);
    } finally {
      await session.context.close();
    }

    // ── Open the live Riders dashboard (Manage is the default tab) ──
    await page.goto('/riders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Rider Hall').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="my-riders-dashboard"]')).toBeVisible({
      timeout: 20_000,
    });

    // The freshly-created assignment card must be present before we act on it.
    const card = page.locator(`[data-testid="assignment-card-${assignmentId}"]`);
    await expect(card).toBeVisible({ timeout: 20_000 });

    // ── Drive the real unassign flow on the dashboard ──
    await card.getByRole('button', { name: /unassign rider/i }).click();

    const dialog = page.locator(`[data-testid="unassign-rider-confirm-${assignmentId}"]`);
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Network-first: arm the real DELETE + the refetch GET BEFORE clicking confirm.
    const deleteResp = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/v1/riders/assignments/${assignmentId}`) &&
        resp.request().method() === 'DELETE',
      { timeout: 20_000 }
    );
    const refetchResp = page.waitForResponse(
      (resp) =>
        /\/api\/v1\/riders\/assignments(?:\?|$)/.test(resp.url()) &&
        resp.request().method() === 'GET',
      { timeout: 20_000 }
    );

    await dialog.getByRole('button', { name: /remove rider/i }).click();

    // Real DELETE fired and succeeded.
    const del = await deleteResp;
    expect(del.status(), 'DELETE rider assignment must return 2xx').toBeGreaterThanOrEqual(200);
    expect(del.status()).toBeLessThan(300);

    // Refetch ran (cache invalidation → useRiderAssignments re-queries).
    await refetchResp;

    // ── Assert the assignment is GONE from the dashboard after refetch ──
    await expect(card).toHaveCount(0, { timeout: 20_000 });
  });

  test('Trainer: confirming unassign on MyTrainersDashboard fires the real DELETE and removes the row', async ({
    page,
    browser,
  }: {
    page: import('@playwright/test').Page;
    browser: Browser;
  }) => {
    // ── Precondition: build a real active trainer assignment via the real API ──
    const session = await createAuthedSession(browser);
    let assignmentId: number;
    try {
      const horseId = await getStarterHorseId(session.request);
      assignmentId = await createAssignmentViaApi(session, 'trainers', horseId);
    } finally {
      await session.context.close();
    }

    // ── Open the live Trainers dashboard (Manage is the default tab) ──
    await page.goto('/trainers', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Trainer Academy').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="my-trainers-dashboard"]')).toBeVisible({
      timeout: 20_000,
    });

    const card = page.locator(`[data-testid="assignment-card-${assignmentId}"]`);
    await expect(card).toBeVisible({ timeout: 20_000 });

    // ── Drive the real unassign flow on the dashboard ──
    await card.getByRole('button', { name: /unassign trainer/i }).click();

    const dialog = page.locator(`[data-testid="unassign-trainer-confirm-${assignmentId}"]`);
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const deleteResp = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/v1/trainers/assignments/${assignmentId}`) &&
        resp.request().method() === 'DELETE',
      { timeout: 20_000 }
    );
    const refetchResp = page.waitForResponse(
      (resp) =>
        /\/api\/v1\/trainers\/assignments(?:\?|$)/.test(resp.url()) &&
        resp.request().method() === 'GET',
      { timeout: 20_000 }
    );

    await dialog.getByRole('button', { name: /remove trainer/i }).click();

    const del = await deleteResp;
    expect(del.status(), 'DELETE trainer assignment must return 2xx').toBeGreaterThanOrEqual(200);
    expect(del.status()).toBeLessThan(300);

    await refetchResp;

    await expect(card).toHaveCount(0, { timeout: 20_000 });
  });
});
