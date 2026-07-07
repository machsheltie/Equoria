/**
 * Groom Talent Tree — view + allocate + persist — E2E (Equoria-oey96.6)
 *
 * Proves the flagship Epic-7 false-closure fix: the GroomTalentTree component
 * (Story 7-6) is now REACHABLE and WIRED to the live backend. A beta tester can
 * open a groom's detail panel, see the talent tree sourced from the REAL
 * backend, allocate an available talent, and the selection PERSISTS across a
 * full page reload (real DB write via POST /grooms/:id/talents/select).
 *
 * Real everything: real auth (storageState from tests/e2e/global-setup.ts),
 * real backend under NODE_ENV=beta (full CSRF round-trip), real Postgres. No
 * bypass headers, no route interception, no mocked endpoints — per CLAUDE.md
 * Constitution §3, the E2E is the proof, not a vitest mock.
 *
 * Seeding: the talent tree needs a groom of a personality that HAS a tree
 * (backend TALENT_TREES is keyed calm|energetic|methodical) at a level that
 * unlocks a tier (tier1 >= level 3). We seed one directly through Prisma
 * (mirroring global-setup.ts) — personality 'energetic' (the canonical
 * personality that also has a tree), level 5 — owned by the shared E2E user,
 * with a TestFixture- name and an id-scoped afterAll cleanup (Constitution §3).
 *
 * AC5 (backend validation respected): a locked-tier selection (tier3 on a
 * level-5 groom) is rejected by the real backend with HTTP 400 — asserted here
 * against the live endpoint (with the real CSRF token). The UI-surfaces-the-
 * error half of AC5 is covered by the GroomDetailPanel component test
 * (groom-talent-select-error-<id>, role=alert) — the UI correctly gates locked
 * tiers so there is no natural click path to a locked-tier request.
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';

// ── Prisma client resolution (mirrors tests/e2e/global-setup.ts) ──
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const prismaClientPath = path.join(projectRoot, 'packages', 'database', 'prismaClient.mjs');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPrisma(): Promise<any> {
  const mod = await import(/* @vite-ignore */ prismaClientPath);
  const client = mod.default;
  if (!client) {
    throw new Error('Could not resolve prisma client from packages/database/prismaClient.mjs');
  }
  return client;
}

// Backend TALENT_TREES.energetic tier1 talents: playtime_pro / enthusiasm_boost.
const SEED_PERSONALITY = 'energetic';
const SEED_LEVEL = 5; // tier1 (>=3) unlocked; tier2 (>=5) unlocked-but-prereq-gated; tier3 (>=8) locked
const TIER1_TALENT_ID = 'playtime_pro';
const LOCKED_TIER3_TALENT_ID = 'inspiration_master'; // energetic tier3 (needs level 8)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prisma: any;
let groomId: number;

/** Open the seeded groom's detail panel on the Manage tab (real auth). */
async function openSeededGroomDetail(page: Page): Promise<void> {
  await page.goto('/grooms', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Groom Quarters').first()).toBeVisible({ timeout: 20_000 });

  const manageTab = page.locator('[data-testid="manage-tab"]');
  await expect(manageTab).toBeVisible({ timeout: 15_000 });
  await manageTab.click();

  // The seeded groom must render on the Manage tab (real GET /grooms/user/:id).
  const card = page.locator(`[data-testid="groom-card-${groomId}"]`);
  await expect(card).toBeVisible({ timeout: 20_000 });

  // Expand the Performance & History / Talents detail panel.
  await page.locator(`[data-testid="groom-detail-toggle-${groomId}"]`).click();
  await expect(page.locator(`[data-testid="groom-talents-section-${groomId}"]`)).toBeVisible({
    timeout: 15_000,
  });
}

test.describe.serial('Groom Talent Tree — reachable + allocatable (Equoria-oey96.6)', () => {
  test.beforeAll(async () => {
    prisma = await getPrisma();

    const email = process.env.E2E_TEST_EMAIL;
    if (!email) {
      throw new Error(
        'E2E_TEST_EMAIL missing — tests/e2e/global-setup.ts must run before this spec.'
      );
    }
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user?.id) {
      throw new Error(`Could not resolve E2E user id for ${email}`);
    }

    const groom = await prisma.groom.create({
      data: {
        name: `TestFixture-TalentGroom-${crypto.randomBytes(4).toString('hex')}`,
        speciality: 'foal_care',
        personality: SEED_PERSONALITY,
        level: SEED_LEVEL,
        skillLevel: 'expert',
        userId: user.id,
        isActive: true,
      },
      select: { id: true, personality: true, level: true },
    });
    groomId = groom.id;
    // Preconditions must hold or the tree test is meaningless.
    expect(groom.personality, 'seeded groom personality must have a talent tree').toBe(
      SEED_PERSONALITY
    );
    expect(groom.level, 'seeded groom level must unlock tier1').toBeGreaterThanOrEqual(3);
  });

  test.afterAll(async () => {
    if (!prisma || !groomId) return;
    // Scoped, id-based cleanup (Constitution §3). Delete selections then the
    // groom (GroomTalentSelections also cascades, but we scope-delete both).
    await prisma.groomTalentSelections.deleteMany({ where: { groomId } });
    await prisma.groom.delete({ where: { id: groomId } });
  });

  test('views the talent tree, allocates a tier-1 talent, and it persists after reload', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await openSeededGroomDetail(page);

    // The tree renders from BACKEND-sourced state (initially no selections).
    const tree = page.locator('[data-testid="groom-talent-tree"]');
    await expect(tree).toBeVisible({ timeout: 15_000 });
    await expect(tree.locator('[data-testid="talent-allocated-count"]')).toHaveText(
      '0 / 3 allocated'
    );

    // tier1 talent is AVAILABLE (level 5, no prerequisite) → has a Select button.
    const selectBtn = tree.locator(`[data-testid="talent-select-btn-${TIER1_TALENT_ID}"]`);
    await expect(selectBtn).toBeVisible({ timeout: 10_000 });

    // ── Allocate → assert the REAL select POST fires and returns 200 ──
    const selectResp = page.waitForResponse(
      (r) =>
        r.url().includes(`/grooms/${groomId}/talents/select`) && r.request().method() === 'POST',
      { timeout: 20_000 }
    );
    await selectBtn.click();
    const resp = await selectResp;
    expect(resp.status(), 'POST /talents/select must return 200 for a valid allocation').toBe(200);

    // The selection is now reflected in the tree (react-query refetch after the
    // mutation invalidated the talents key).
    await expect(
      tree.locator(`[data-testid="talent-selected-badge-${TIER1_TALENT_ID}"]`)
    ).toBeVisible({ timeout: 15_000 });
    await expect(tree.locator('[data-testid="talent-allocated-count"]')).toHaveText(
      '1 / 3 allocated'
    );

    // ── Persistence: full page reload, re-open, selection is STILL there ──
    // This is the real-DB-write proof — the selection came back from the
    // backend, not from an in-memory optimistic cache.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openSeededGroomDetail(page);

    const treeAfter = page.locator('[data-testid="groom-talent-tree"]');
    await expect(
      treeAfter.locator(`[data-testid="talent-selected-badge-${TIER1_TALENT_ID}"]`)
    ).toBeVisible({ timeout: 15_000 });
    await expect(treeAfter.locator('[data-testid="talent-allocated-count"]')).toHaveText(
      '1 / 3 allocated'
    );
  });

  test('the backend rejects a locked-tier selection (AC5 — validation respected)', async ({
    page,
  }) => {
    // The UI correctly gates locked tiers (no Select button renders for tier3 on
    // a level-5 groom), so we prove the backend REJECTION directly against the
    // real endpoint with the real CSRF token. A level-5 groom cannot select
    // tier3 (needs level 8) → HTTP 400, not a silent success.
    const csrfRes = await page.request.get('/api/v1/auth/csrf-token');
    expect(csrfRes.ok(), 'CSRF token fetch must succeed').toBe(true);
    const csrfJson = await csrfRes.json();
    const csrfToken: string = csrfJson?.data?.csrfToken ?? csrfJson?.csrfToken ?? '';
    expect(csrfToken, 'CSRF token must be present').toBeTruthy();

    const res = await page.request.post(`/api/v1/grooms/${groomId}/talents/select`, {
      data: { tier: 'tier3', talentId: LOCKED_TIER3_TALENT_ID },
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    });
    expect(res.status(), 'locked-tier selection must be rejected with 400').toBe(400);
    const body = await res.json();
    expect(body?.success, 'rejection envelope must be success:false').toBe(false);
    expect(
      String(body?.message ?? ''),
      'rejection message must name the validation reason'
    ).toContain('insufficient_level');
  });
});
