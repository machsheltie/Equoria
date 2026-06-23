/**
 * Conformation Show ENTRY flow — E2E (Equoria-dqrlw)
 *
 * This spec is the residual "fire the real entry POST" slice that the sibling
 * read/gating spec (conformation-shows.spec.ts) explicitly defers in its file
 * header ("the actual entry POST flow … would mutate real DB state … entry
 * success is a separate workflow that requires a horse eligible for the chosen
 * show"). It exercises the REAL ConformationEntryModal eligibility + entry path
 * end-to-end against the live backend + real DB under NODE_ENV=beta:
 *
 *   (a) open a conformation show entry for an OWNED horse (real horse from
 *       /api/v1/horses, real conformation show from GET /api/v1/competition);
 *   (b) assert the REAL eligibility response reports the horse ELIGIBLE — the
 *       authority is GET /api/v1/competition/conformation/eligibility/:horseId.
 *       global-setup seeds every precondition (see below), so eligible === true
 *       is a hard assertion; if it is false the test fails with the backend's
 *       own error list so the exact rejected precondition is visible;
 *   (c) submit a REAL entry via POST /api/v1/competition/conformation/enter and
 *       assert the 201 success state + the durable DB side effect (a ShowEntry
 *       row, proven by the positive entryId in the response with matching
 *       showId/horseId, and by the duplicate-entry 409 the backend returns when
 *       the same horse+show is re-submitted).
 *
 * Why this is an E2E test (not a unit/integration test): it drives the real
 * React modal, the real CSRF round trip, the real eligibility query, and a real
 * mutation that writes a ShowEntry row to the canonical DB. No mocks, no bypass
 * headers, no route interception. The gate is exercised, never hidden.
 *
 * IMPORTANT — eligibility is backend-authoritative and NOT faked. The seed in
 * tests/e2e/global-setup.ts (Equoria-6yu1m) creates every precondition that
 * validateConformationEntry (conformationShowService.mjs) and the entry POST's
 * critical-health gate (getDisplayedHealth, horseHealth.mjs) require:
 *   - an OPEN conformation show with an EARLY runDate so it lands on page 1 of
 *     the paginated, runDate-asc GET /api/v1/competition feed;
 *   - the E2E horse in Excellent health with fresh lastFedDate AND
 *     lastVettedDate (a null lastFedDate alone forces displayedHealth=critical);
 *   - a groom hired + assigned to the horse, with the GroomAssignment.createdAt
 *     backdated past CONFORMATION_SHOW_CONFIG.MIN_GROOM_ASSIGNMENT_DAYS (= 2).
 * The eligibility endpoint still computes the verdict against the real DB — the
 * seed only arranges the real preconditions; it does not bypass the gate.
 *
 * Auth: Playwright storageState from tests/e2e/global-setup.ts (no manual
 * login, no test-credentials.json — Story 21-8 AC1 / Equoria-4m96).
 * Network-first waits on the real eligibility GET and entry POST.
 */
import { test, expect, type Page } from '@playwright/test';

const ELIGIBILITY_RE = /\/api\/v1\/competition\/conformation\/eligibility\/\d+/;
const ENTER_URL = '/api/v1/competition/conformation/enter';

interface EligibilityEnvelope {
  horseId: number;
  horseName: string;
  eligible: boolean;
  errors: string[];
  warnings: string[];
  ageClass: string;
  groomAssigned: boolean;
}

/**
 * Navigate to the conformation tab inside the unified competition browser and
 * wait for the panel + selectors to render against real /api/v1/competitions
 * and /api/v1/horses data.
 */
async function gotoConformationTab(page: Page): Promise<void> {
  await page.goto('/competitions?tab=conformation', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="conformation-tab-panel"]')).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator('[data-testid="conformation-shows-panel"]')).toBeVisible({
    timeout: 20000,
  });
}

test.describe('Conformation Show Entry (real mutation)', () => {
  test.beforeEach(() => {
    test.setTimeout(60000);
  });

  test('seeded eligible horse: real eligibility is true, entry POSTs 201, duplicate is 409', async ({
    page,
  }) => {
    await gotoConformationTab(page);

    const horseSelect = page.locator('[data-testid="conformation-horse-select"]');
    const showSelect = page.locator('[data-testid="conformation-show-select"]');
    await expect(horseSelect).toBeVisible({ timeout: 20000 });
    await expect(showSelect).toBeVisible();

    // ── Pick a real owned horse (first non-placeholder option) ────────────────
    // The horse select is populated from /api/v1/horses (owned horses only).
    // The freshly-onboarded E2E user always has at least the starter horse.
    const horseOptionValues = await horseSelect
      .locator('option')
      .evaluateAll((opts) =>
        opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== '')
      );
    expect(
      horseOptionValues.length,
      'E2E user must own at least one horse (global-setup starter horse)'
    ).toBeGreaterThan(0);
    const horseId = horseOptionValues[0];

    // ── The seeded OPEN conformation show MUST be present (Equoria-6yu1m) ──────
    // global-setup seeds an OPEN conformation show with an EARLY runDate
    // (2020-01-01) so it sorts to the top of the page-1 asc feed and populates
    // this select. An empty show-select means the seed failed — that is a HARD
    // FAILURE here, never a graceful skip. There is genuinely something to enter,
    // so an empty select is a real defect, not a real-DB-valid empty state.
    const showOptionValues = await showSelect
      .locator('option')
      .evaluateAll((opts) =>
        opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== '')
      );
    expect(
      showOptionValues.length,
      'the seeded OPEN conformation show must populate the show-select; an empty ' +
        'select means the global-setup conformation seed (early-runDate show) failed'
    ).toBeGreaterThan(0);

    const showId = showOptionValues[0];

    // ── Select horse + show, then open the entry modal ────────────────────────
    await horseSelect.selectOption(horseId);
    await showSelect.selectOption(showId);

    const openEntry = page.locator('[data-testid="conformation-open-entry"]');
    await expect(openEntry).toBeEnabled();

    // Arm the real eligibility GET wait BEFORE opening the modal — the modal's
    // useConformationEligibility(horse.id) fires the request on mount.
    const eligibilityResponse = page.waitForResponse(
      (resp) => ELIGIBILITY_RE.test(resp.url()) && resp.request().method() === 'GET',
      { timeout: 20000 }
    );

    await openEntry.click();

    const modal = page.locator('[data-testid="conformation-entry-modal"]');
    await expect(modal).toBeVisible({ timeout: 20000 });

    // ── (b) Assert the REAL eligibility response drives the gate ──────────────
    const eligResp = await eligibilityResponse;
    expect(eligResp.status(), 'eligibility GET must return 200').toBe(200);
    const eligBody = (await eligResp.json()) as { success: boolean; data: EligibilityEnvelope };
    expect(eligBody.success).toBe(true);
    const elig = eligBody.data;

    // ── (b) The seed guarantees an ELIGIBLE horse — assert it, hard ───────────
    // global-setup seeds the E2E horse Excellent + freshly fed/vetted, hires a
    // groom, assigns it, and backdates the assignment past MIN_GROOM_ASSIGNMENT_DAYS.
    // So the REAL eligibility endpoint MUST report eligible. If it does not, the
    // backend's own error list is the diagnosis — surface it verbatim so the lead
    // sees exactly which precondition the backend rejected.
    expect(
      elig.eligible,
      `horse must be eligible after the conformation seed; backend errors: ${JSON.stringify(
        elig.errors
      )}`
    ).toBe(true);

    // The backend-sourced summary must render verbatim (no placeholder).
    const summary = page.locator('[data-testid="conformation-eligibility-summary"]');
    await expect(summary).toBeVisible({ timeout: 10000 });
    await expect(summary).toContainText(/eligible to enter/i);

    const submit = page.locator('[data-testid="conformation-entry-submit"]');
    const groomSelect = page.locator('[data-testid="conformation-groom-select"]');

    // ── (c) Eligible → fire the REAL entry POST and assert the side effect ────
    // A real entry requires a groom selection (handleSubmit rejects a missing
    // groom client-side; the backend also requires an owned groomId). An
    // eligible horse necessarily has groomAssigned === true, so the user owns
    // at least one groom to populate the select.
    expect(elig.groomAssigned, 'an eligible horse must have a groom assigned').toBe(true);
    const groomValues = await groomSelect
      .locator('option')
      .evaluateAll((opts) =>
        opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== '')
      );
    expect(
      groomValues.length,
      'eligible horse implies the user owns a groom to handle the entry'
    ).toBeGreaterThan(0);
    await groomSelect.selectOption(groomValues[0]);

    await expect(submit).toBeEnabled();

    // Arm the real entry POST wait BEFORE clicking Confirm Entry.
    const enterResponse = page.waitForResponse(
      (resp) => resp.url().includes(ENTER_URL) && resp.request().method() === 'POST',
      { timeout: 20000 }
    );

    await submit.click();

    const enterResp = await enterResponse;
    expect(enterResp.status(), 'entry POST must return 201 Created').toBe(201);
    const enterBody = (await enterResp.json()) as {
      success: boolean;
      data: { entryId: number; horseId: number; showId: number; ageClass: string };
    };
    expect(enterBody.success).toBe(true);
    // Durable DB side effect: a ShowEntry row was created (entryId is its PK).
    expect(
      Number.isInteger(enterBody.data.entryId) && enterBody.data.entryId > 0,
      'a real ShowEntry row must be created (positive entryId)'
    ).toBe(true);
    expect(enterBody.data.showId).toBe(Number(showId));
    expect(enterBody.data.horseId).toBe(Number(horseId));

    // On success the modal closes (handleSubmit → onSuccess → onClose).
    await expect(modal).toBeHidden({ timeout: 10000 });

    // ── Prove the side effect is persisted, not transient ─────────────────────
    // Re-opening the same horse+show and re-submitting must now hit the backend
    // duplicate-entry guard (409). This confirms the first POST actually wrote a
    // ShowEntry row to the real DB — a real, observable mutation side effect.
    await horseSelect.selectOption(horseId);
    await showSelect.selectOption(showId);
    await expect(openEntry).toBeEnabled();
    await openEntry.click();
    await expect(modal).toBeVisible({ timeout: 20000 });
    await groomSelect.selectOption(groomValues[0]);
    await expect(submit).toBeEnabled();

    const dupResponse = page.waitForResponse(
      (resp) => resp.url().includes(ENTER_URL) && resp.request().method() === 'POST',
      { timeout: 20000 }
    );
    await submit.click();
    const dupResp = await dupResponse;
    expect(
      dupResp.status(),
      'second entry of the same horse+show must be rejected as a duplicate (409)'
    ).toBe(409);
  });
});
