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
 * Owner rulings 2026-10-28 (Equoria-2xxvd): q229 replaced the groom's old 1-10
 * level with the star level, and q244 says stars give no bonus for now, so no
 * talent tier opens for any groom until staff growth (Equoria-xlw03). Old
 * contract: a level-5 groom allocated a tier-1 talent here and it persisted.
 * This spec now proves the tree is still reachable from the live backend, that
 * it offers no choice even to an Expert groom, and that the backend refuses a
 * tier-1 choice (the one tier with no prerequisite) with HTTP 400.
 *
 * Seeding: a groom of a personality that HAS a tree (backend TALENT_TREES is
 * keyed calm|energetic|methodical), personality 'energetic', at Expert stars,
 * owned by the shared E2E user, seeded directly through Prisma (mirroring
 * global-setup.ts) with a TestFixture- name and an id-scoped afterAll cleanup
 * (Constitution §3).
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

// Backend TALENT_TREES.energetic tier1 talents: playtimePro / enthusiasmBoost.
const SEED_PERSONALITY = 'energetic';
const SEED_STAR_LEVEL = 'expert'; // the top level; still opens no tier (q244)
const TIER1_TALENT_ID = 'playtimePro';

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

test.describe
  .serial('Groom Talent Tree — reachable, no tier open yet (Equoria-oey96.6, Equoria-2xxvd)', () => {
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
        speciality: 'foalCare',
        personality: SEED_PERSONALITY,
        starLevel: SEED_STAR_LEVEL,
        skillLevel: 'master',
        userId: user.id,
        isActive: true,
      },
      select: { id: true, personality: true, starLevel: true },
    });
    groomId = groom.id;
    // Preconditions must hold or the tree test is meaningless.
    expect(groom.personality, 'seeded groom personality must have a talent tree').toBe(
      SEED_PERSONALITY
    );
    expect(groom.starLevel, 'seeded groom must be at the top level').toBe(SEED_STAR_LEVEL);
  });

  test.afterAll(async () => {
    if (!prisma || !groomId) return;
    // Scoped, id-based cleanup (Constitution §3). Delete selections then the
    // groom (GroomTalentSelections also cascades, but we scope-delete both).
    await prisma.groomTalentSelections.deleteMany({ where: { groomId } });
    await prisma.groom.delete({ where: { id: groomId } });
  });

  test('views the talent tree from the live backend; an Expert groom is offered no talent (q244)', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await openSeededGroomDetail(page);

    const tree = page.locator('[data-testid="groom-talent-tree"]');
    await expect(tree).toBeVisible({ timeout: 15_000 });
    await expect(tree.locator('[data-testid="talent-allocated-count"]')).toHaveText(
      '0 / 3 allocated'
    );
    for (const tier of ['tier1', 'tier2', 'tier3']) {
      await expect(tree.locator(`[data-testid="tier-requirement-${tier}"]`)).toHaveText(
        'Not open yet'
      );
    }
    await expect(tree.locator(`[data-testid="talent-select-btn-${TIER1_TALENT_ID}"]`)).toHaveCount(
      0
    );
    await expect(tree.getByText(/Level \d/)).toHaveCount(0);
  });

  test('the backend refuses a tier-1 talent choice: stars open no tier for now (q244)', async ({
    page,
  }) => {
    const csrfRes = await page.request.get('/api/v1/auth/csrf-token');
    expect(csrfRes.ok(), 'CSRF token fetch must succeed').toBe(true);
    const csrfJson = await csrfRes.json();
    const csrfToken: string = csrfJson?.data?.csrfToken ?? csrfJson?.csrfToken ?? '';
    expect(csrfToken, 'CSRF token must be present').toBeTruthy();

    const res = await page.request.post(`/api/v1/grooms/${groomId}/talents/select`, {
      data: { tier: 'tier1', talentId: TIER1_TALENT_ID },
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    });
    expect(res.status(), 'a tier-1 choice must be refused with 400').toBe(400);
    const body = await res.json();
    expect(body?.success, 'rejection envelope must be success:false').toBe(false);
    expect(await prisma.groomTalentSelections.count({ where: { groomId } })).toBe(0);
  });
});
