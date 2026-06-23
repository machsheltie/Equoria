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
 *       /api/v1/horses, real conformation show from /api/v1/competitions);
 *   (b) assert the REAL eligibility response gates the Confirm Entry button —
 *       GET /api/v1/competition/conformation/eligibility/:horseId is the
 *       authority, and the button is disabled whenever the backend reports the
 *       horse not eligible (eligData.eligible === false in the modal);
 *   (c) when — and ONLY when — the real eligibility endpoint reports the horse
 *       eligible, submit a REAL entry via POST
 *       /api/v1/competition/conformation/enter and assert the 201 success state
 *       + the durable DB side effect (a ShowEntry row, proven by the entryId in
 *       the response and by the duplicate-entry 409 the backend now returns for
 *       the same horse+show).
 *
 * Why this is an E2E test (not a unit/integration test): it drives the real
 * React modal, the real CSRF round trip, the real eligibility query, and a real
 * mutation that writes a ShowEntry row to the canonical DB. No mocks, no bypass
 * headers, no route interception. The gate is exercised, never hidden.
 *
 * IMPORTANT — eligibility is backend-authoritative and NOT faked:
 * validateConformationEntry (conformationShowService.mjs) requires, among other
 * things, an ACTIVE groom assignment that is at least
 * CONFORMATION_SHOW_CONFIG.MIN_GROOM_ASSIGNMENT_DAYS (= 2) days old, plus
 * Excellent/Good health. A freshly set-up E2E horse (global-setup creates the
 * starter horse with no groom assignment) is therefore reported NOT eligible by
 * the real endpoint, and the gating branch (b) runs. The mutation branch (c)
 * runs automatically the moment a guaranteed-eligible owned horse + open
 * conformation show exist for the E2E user — see the lead-precondition note in
 * the task report. We branch on the REAL eligibility response, never on a skip
 * and never by bypassing the gate.
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

  test('eligibility gates the Confirm Entry button and a real entry POSTs when eligible', async ({
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

    // ── Determine whether an OPEN conformation show exists ────────────────────
    // global-setup seeds ridden shows (Dressage / Show Jumping / Racing), none
    // of which are showType === 'conformation'. So a conformation show only
    // exists when the lead has seeded one for the E2E user (see report). If
    // none exists, the show select is disabled and the honest empty-state is
    // shown — we assert that real empty-state rather than fabricating a show.
    const showOptionValues = await showSelect
      .locator('option')
      .evaluateAll((opts) =>
        opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== '')
      );

    if (showOptionValues.length === 0) {
      // No open conformation show in the real DB — assert the honest empty-state
      // and that the Enter Show button stays gated. This is a REAL-DB-valid
      // outcome, not a graceful skip: there is genuinely nothing to enter.
      await expect(showSelect).toBeDisabled();
      const emptyState = page.locator('[data-testid="conformation-empty-state"]');
      await expect(emptyState).toBeVisible({ timeout: 10000 });
      await expect(emptyState).toContainText(/no open conformation shows/i);

      const openEntry = page.locator('[data-testid="conformation-open-entry"]');
      await expect(openEntry).toBeDisabled();
      return;
    }

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

    // The backend-sourced summary must render verbatim (no placeholder).
    const summary = page.locator('[data-testid="conformation-eligibility-summary"]');
    await expect(summary).toBeVisible({ timeout: 10000 });
    await expect(summary).toContainText(elig.eligible ? /eligible to enter/i : /not eligible/i);

    const submit = page.locator('[data-testid="conformation-entry-submit"]');
    const groomSelect = page.locator('[data-testid="conformation-groom-select"]');

    if (!elig.eligible) {
      // ── Gate assertion: not eligible → Confirm Entry MUST stay disabled ─────
      // This is the expected outcome for the default fixture (no aged groom
      // assignment). It proves the gate fires on the REAL failure mode: even if
      // a groom were selected, eligibilityBlocking keeps submit disabled.
      await expect(submit).toBeDisabled();

      // Pick a groom if one exists — the button must STILL be disabled because
      // the eligibility block is independent of groom selection.
      const groomValues = await groomSelect
        .locator('option')
        .evaluateAll((opts) =>
          opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== '')
        );
      if (groomValues.length > 0) {
        await groomSelect.selectOption(groomValues[0]);
        await expect(submit).toBeDisabled();
      }
      return;
    }

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
