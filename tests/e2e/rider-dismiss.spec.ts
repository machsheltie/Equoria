/**
 * Rider Dismiss — real end-to-end MUTATION (Equoria-oey96.27 — FR-RIDER-4)
 *
 * WHAT THE RTL TWIN ALREADY COVERS (do NOT re-do here):
 *   frontend/src/components/rider/__tests__/RiderDismissControl.test.tsx
 *   — the pure GameDialog INTERACTION contract: confirm fires onDismiss(id),
 *     cancel does NOT, and the trigger is disabled while isDismissing. That runs
 *     against a STUB onDismiss prop with NO network. It proves the client-side
 *     branch logic, nothing about the real backend.
 *
 * WHAT THIS SPEC ADDS (the real end-to-end mutation the RTL twin defers):
 *     dashboard renders a real hired+assigned rider
 *       -> click the "Dismiss Rider" trigger
 *       -> confirm "Dismiss Rider" in the real GameDialog
 *       -> assert the REAL DELETE /api/v1/riders/:id/dismiss fires (2xx)
 *       -> assert the rider row is GONE from the active roster after the real
 *          GET /api/v1/riders/user/:id refetch (getUserRiders filters retired:false)
 *       -> assert the rider's active assignment was DEACTIVATED by the dismiss
 *          (riderController.dismissRider deactivates active assignments before
 *          setting retired:true — assert THAT, per the issue's AC1).
 *
 * VERIFIED ENDPOINTS (quoted from frontend/src/lib/api/riders.ts + backend
 * modules/riders/routes/riderRoutes.mjs + controllers/riderController.mjs):
 *   DELETE /api/v1/riders/:id/dismiss        (ridersApi.dismissRider → dismissRider)
 *   refetch GET /api/v1/riders/user/:id      (useUserRiders → invalidate riderKeys.all)
 *   refetch GET /api/v1/riders/assignments   (useRiderAssignments → invalidate riderKeys.all)
 *
 * PRECONDITION STRATEGY (self-contained hire+assign-then-dismiss — no DB
 * shortcut) built through the REAL app API via the storageState-authed request
 * context and real CSRF round-trips (csrfMutate, NODE_ENV=beta):
 *     1. GET /api/v1/riders/marketplace  (refresh force=true if empty)
 *     2. POST /api/v1/riders/marketplace/hire { marketplaceId }  → hired rider id
 *     3. GET  /api/v1/horses                                     → starter horse
 *     4. POST /api/v1/riders/assignments { riderId, horseId }    → active assignment id
 *   Then the UI test dismisses the rider.
 *
 * CONSTITUTION COMPLIANCE (CLAUDE.md §2/§3):
 *   - Real credentials (storageState), real backend, real DB, real CSRF.
 *   - No bypass headers, no test.skip / conditional skip on this beta path.
 *   - The mutation under test is the real DELETE, asserted via waitForResponse.
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

/** Pick a hireable rider marketplace listing id, refreshing once if empty. */
async function pickRiderMarketplaceListingId(session: AuthedSession): Promise<string> {
  const readOffers = (body: unknown): Array<{ id?: string; marketplaceId?: string }> => {
    const data = unwrap<{ riders?: unknown[] }>(body);
    return (data?.riders ?? []) as Array<{ id?: string; marketplaceId?: string }>;
  };

  let offers = readOffers(await getJson(session.request, '/api/v1/riders/marketplace'));
  if (offers.length === 0) {
    const refreshRes = await csrfMutate(session, 'POST', '/api/v1/riders/marketplace/refresh', {
      force: true,
    });
    expect(
      refreshRes.ok(),
      `POST /api/v1/riders/marketplace/refresh expected 2xx, got ${refreshRes.status()} — ${await refreshRes.text()}`
    ).toBe(true);
    offers = readOffers(await refreshRes.json());
  }

  expect(
    offers.length,
    'Expected at least one rider marketplace listing after refresh — the account may have ' +
      'insufficient funds to refresh, or the marketplace generator returned no offers.'
  ).toBeGreaterThan(0);

  const id = offers[0].marketplaceId ?? offers[0].id;
  expect(typeof id, 'rider marketplace listing must carry a marketplaceId/id').toBe('string');
  return id as string;
}

/**
 * Hire one rider + assign to the starter horse via the real API.
 * Returns the hired rider id and the created active assignment id.
 */
async function hireAndAssignRider(
  session: AuthedSession,
  horseId: number
): Promise<{ riderId: number; assignmentId: number }> {
  const marketplaceId = await pickRiderMarketplaceListingId(session);

  const hireRes = await csrfMutate(session, 'POST', '/api/v1/riders/marketplace/hire', {
    marketplaceId,
  });
  expect(
    hireRes.ok(),
    `POST /api/v1/riders/marketplace/hire expected 2xx, got ${hireRes.status()} — ${await hireRes.text()}. ` +
      'Most likely insufficient funds on the test account.'
  ).toBe(true);
  const hired = unwrap<{ rider?: { id: number } }>(await hireRes.json());
  const riderId = hired?.rider?.id;
  expect(typeof riderId, 'hire response must include the new rider id').toBe('number');

  const assignRes = await csrfMutate(session, 'POST', '/api/v1/riders/assignments', {
    riderId,
    horseId,
  });
  expect(
    assignRes.ok(),
    `POST /api/v1/riders/assignments expected 2xx, got ${assignRes.status()} — ${await assignRes.text()}`
  ).toBe(true);
  const assignment = unwrap<{ id: number }>(await assignRes.json());
  expect(typeof assignment?.id, 'assign response must include the new assignment id').toBe(
    'number'
  );

  return { riderId: riderId as number, assignmentId: assignment.id };
}

test.describe('Rider Dismiss — real mutation (Equoria-oey96.27, FR-RIDER-4)', () => {
  test.beforeEach(() => {
    // Hire + assign + page load + real CSRF round-trips need headroom on a
    // possibly-contended local stack.
    test.setTimeout(90_000);
  });

  test('confirming dismiss on MyRidersDashboard fires the real DELETE, removes the rider, and deactivates its assignment', async ({
    page,
    browser,
  }: {
    page: import('@playwright/test').Page;
    browser: Browser;
  }) => {
    // ── Precondition: hire a rider and give it an active assignment via the real API ──
    const session = await createAuthedSession(browser);
    let riderId: number;
    let assignmentId: number;
    try {
      const horseId = await getStarterHorseId(session.request);
      ({ riderId, assignmentId } = await hireAndAssignRider(session, horseId));
    } finally {
      await session.context.close();
    }

    // ── Open the live Riders dashboard (Manage is the default tab) ──
    await page.goto('/riders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Rider Hall').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="my-riders-dashboard"]')).toBeVisible({
      timeout: 20_000,
    });

    // The freshly-hired rider card must be present before we act on it.
    const card = page.locator(`[data-testid="rider-card-${riderId}"]`);
    await expect(card).toBeVisible({ timeout: 20_000 });

    // ── Drive the real dismiss flow on the dashboard ──
    await card.locator(`[data-testid="dismiss-button-${riderId}"]`).click();

    const dialog = page.locator(`[data-testid="dismiss-rider-confirm-${riderId}"]`);
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Network-first: arm the real DELETE + the roster refetch GET BEFORE confirming.
    const deleteResp = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/v1/riders/${riderId}/dismiss`) &&
        resp.request().method() === 'DELETE',
      { timeout: 20_000 }
    );
    const refetchResp = page.waitForResponse(
      (resp) => /\/api\/v1\/riders\/user\//.test(resp.url()) && resp.request().method() === 'GET',
      { timeout: 20_000 }
    );

    await dialog.getByRole('button', { name: /dismiss rider/i }).click();

    // Real DELETE fired and succeeded.
    const del = await deleteResp;
    expect(del.status(), 'DELETE rider dismiss must return 2xx').toBeGreaterThanOrEqual(200);
    expect(del.status()).toBeLessThan(300);

    // Roster refetch ran (cache invalidation → useUserRiders re-queries).
    await refetchResp;

    // ── Assert the rider is GONE from the active roster after refetch ──
    // getUserRiders filters retired:false, so the dismissed rider drops out.
    await expect(card).toHaveCount(0, { timeout: 20_000 });

    // ── Assert the active assignment was deactivated by the dismiss ──
    const verify = await createAuthedSession(browser);
    try {
      const assignments = unwrap<Array<{ id: number; riderId: number; isActive: boolean }>>(
        await getJson(verify.request, '/api/v1/riders/assignments')
      );
      // getAssignments returns only isActive:true rows — the dismissed rider's
      // assignment must no longer appear there.
      expect(
        assignments.some((a) => a.id === assignmentId),
        'The dismissed rider’s previously-active assignment must be deactivated (absent from the active assignments list)'
      ).toBe(false);
      expect(
        assignments.some((a) => a.riderId === riderId),
        'No active assignment should remain for a dismissed rider'
      ).toBe(false);
    } finally {
      await verify.context.close();
    }
  });
});
