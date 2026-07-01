import { chromium, expect, type FullConfig } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

// ── Prisma client resolution (mirrors tests/e2e/fixtures/coatGenotypeHorses.ts) ──
// The conformation-entry seed (Equoria-6yu1m) writes directly through Prisma
// because the public show/health/assignment shapes the entry flow needs
// (early runDate, fresh feed/vet dates, a backdated groom assignment) are not
// expressible through the HTTP API alone. Resolve prismaClient.mjs from the
// worktree root so this works regardless of Playwright's launch cwd.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// global-setup.ts lives at tests/e2e/ → two levels up is the worktree root.
const projectRoot = path.resolve(__dirname, '..', '..');
const prismaClientPath = path.join(projectRoot, 'packages', 'database', 'prismaClient.mjs');

async function getPrisma(): Promise<Record<string, unknown>> {
  const mod = await import(/* @vite-ignore */ prismaClientPath);
  const client = mod.default;
  if (!client) {
    throw new Error('Could not resolve prisma client from packages/database/prismaClient.mjs');
  }
  return client;
}

// Story 21-8 AC1 (Equoria-4m96): credentials are no longer written to
// tests/e2e/test-credentials.json. They are written to process.env keys
// (E2E_TEST_EMAIL, E2E_TEST_PASSWORD, E2E_TEST_USERNAME, E2E_TEST_HORSE_ID).
// Playwright forks test workers AFTER globalSetup returns, so env mutations
// here propagate to every worker. Tests must read via the helper in
// tests/e2e/helpers/credentials.ts (or process.env directly).

async function globalSetup(config: FullConfig) {
  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', (msg) => console.log(`BROWSER LOG: ${msg.text()}`));
  page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));

  // Unique credentials per run
  const timestamp = Date.now();
  const username = `e2e_user_${timestamp}`;
  const email = `e2e_${timestamp}@example.com`;
  const password = 'Password123!';

  try {
    // ── 1. Register test user via UI ─────────────────────────────────────────
    // Auth rate limiter uses skipSuccessfulRequests:true with max:200 failed attempts.
    // Successful registrations/logins are never counted, so no bypass needed.
    console.log('Navigating to:', baseURL + '/register');
    // Use 'load' (not 'networkidle') — Vite's HMR WebSocket keeps the page permanently
    // "active" so networkidle never fires, causing a 60-second timeout per navigation.
    await page.goto(baseURL + '/register', { waitUntil: 'load', timeout: 60000 });

    console.log('Registering user:', username);
    await page.fill('input[name="firstName"]', 'E2E');
    await page.fill('input[name="lastName"]', 'Tester');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    // Equoria-iqzn / Equoria-9tlha: registration now requires a DOB that
    // passes the server-authoritative COPPA age gate (>= 13 real years).
    // Use a fixed adult date so the shared E2E user can be created.
    await page.fill('input[name="dateOfBirth"]', '1990-01-01');
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);

    console.log('Clicking Submit...');
    await page.click('button[type="submit"]');

    // ── 2. Wait for post-registration redirect ──────────────────────────────
    // New users may land on / or /onboarding (OnboardingGuard redirects new users)
    console.log('Waiting for navigation after registration...');
    try {
      await page.waitForURL(
        new RegExp(`^${baseURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(onboarding)?$`),
        { timeout: 30000 }
      );
    } catch (e) {
      console.log('Navigation after registration failed/timed out, current URL:', page.url());
      await page.screenshot({ path: 'setup-failure.png' });
      throw e;
    }

    // If redirected to /onboarding, complete it so the user is fully set up
    if (page.url().includes('/onboarding')) {
      console.log('Completing onboarding wizard...');

      // Step 0 (Welcome) → click Continue
      await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });
      await page.locator('[data-testid="onboarding-next"]').click();

      // Step 1 (Choose Your Horse) → select breed, gender, name, then click Continue
      await expect(page.locator('h1')).toContainText('Choose Your Horse', { timeout: 10000 });
      // Equoria-zanq / Spec 11.3.4: the onboarding breed picker was redesigned
      // from a plain <select data-testid="breed-select"> into a WAI-ARIA
      // radiogroup (BreedSelector — grid of button[role="radio"] cards, each
      // tagged with data-breed-option="<breedId>"). Drive the real radiogroup.
      const breedSelector = page.locator('[data-testid="breed-selector"]');
      await breedSelector.waitFor({ state: 'visible', timeout: 15000 });
      const breedRadioGroup = breedSelector.locator(
        '[role="radiogroup"][aria-label="Horse breeds"]'
      );
      const firstBreedOption = breedRadioGroup.locator('[role="radio"][data-breed-option]').first();
      await firstBreedOption.waitFor({ state: 'visible', timeout: 15000 });
      await firstBreedOption.click();
      await expect(firstBreedOption).toHaveAttribute('aria-checked', 'true');
      // Gender + name live inside the same BreedSelector. The Mare button
      // renders as "♀ Mare"; accessible name still matches /Mare/i. Scope to
      // the selector so we never pick up an unrelated control.
      await breedSelector.getByRole('button', { name: /Mare/i }).click();
      // Enter horse name
      await page.locator('[data-testid="horse-name-input"]').fill(`E2E Setup Horse ${timestamp}`);
      // Step 1's Next is disabled until breed+gender+name are all set (see
      // OnboardingPage isStep1Complete). Wait for it to enable before clicking
      // so the click can't race the React state update.
      const setupStep1Next = page.locator('[data-testid="onboarding-next"]');
      await expect(setupStep1Next).toBeEnabled();
      await setupStep1Next.click();

      // Step 2 (Ready) -> click "Begin" to customize the starter horse via advance-onboarding.
      await expect(page.locator('h1')).toContainText("You're Ready!", { timeout: 10000 });
      await page.locator('[data-testid="onboarding-next"]').click();

      // After onboarding completes, the wizard navigates to /stable. If we do
      // NOT land there, onboarding did not complete — most commonly because the
      // final advance-onboarding mutation 403'd (stale anonymous CSRF token,
      // Equoria-f6wfa). FAIL LOUD per the no-graceful-skip doctrine: a silent
      // log here let a half-onboarded shared E2E user ship, so OnboardingGuard
      // redirected every authenticated spec back to /onboarding and those specs
      // silently exercised the wrong page instead of failing.
      try {
        await page.waitForURL(
          new RegExp(`${baseURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/stable`),
          { timeout: 20000 }
        );
        console.log('Onboarding complete — landed on /stable');
      } catch (navError) {
        await page.screenshot({ path: 'setup-onboarding-failure.png' });
        throw new Error(
          `Onboarding did not complete: expected to land on /stable but URL is "${page.url()}". ` +
            'This usually means the final advance-onboarding mutation failed (e.g. a CSRF 403). ' +
            `Original wait error: ${(navError as Error).message}`,
          { cause: navError }
        );
      }
    }

    // ── 3. Save storageState (auth cookies) for all authenticated tests ──────
    await page.context().storageState({ path: storageState as string });
    console.log('Storage state saved.');

    // ── 4. Persist credentials in process.env so worker tests can read them ─
    // (Equoria-4m96, Story 21-8 AC1: no test-credentials.json file I/O.)
    process.env.E2E_TEST_EMAIL = email;
    process.env.E2E_TEST_PASSWORD = password;
    process.env.E2E_TEST_USERNAME = username;
    console.log('Credentials saved to process.env (E2E_TEST_*).');

    // ── 5. Reuse the real starter horse created by registration/onboarding ───
    // Equoria-f6wfa: the horses collection is versioned at /api/v1/horses. The
    // previous unversioned /api/horses path 404'd, so E2E_TEST_HORSE_ID was
    // never set and the silent warn let dependent specs run without it. FAIL
    // LOUD on both a non-OK response and an empty result — onboarding must have
    // created exactly one starter horse for the freshly-registered E2E user.
    console.log('Fetching starter horse created during onboarding...');
    const horsesRes = await page.request.get(`${baseURL}/api/v1/horses`);
    if (!horsesRes.ok()) {
      throw new Error(
        `Starter horse lookup failed: GET /api/v1/horses returned ${horsesRes.status()} — ${await horsesRes.text()}`
      );
    }
    const horsesJson = await horsesRes.json();
    const horses = horsesJson?.data ?? horsesJson ?? [];
    const starterHorse = Array.isArray(horses) ? horses[0] : null;
    if (!starterHorse?.id) {
      throw new Error(
        'Starter horse lookup returned no horse for the freshly-onboarded E2E user. ' +
          'Onboarding should have created exactly one starter horse. ' +
          `Response: ${JSON.stringify(horsesJson).slice(0, 300)}`
      );
    }
    console.log('Starter horse id:', starterHorse.id);
    process.env.E2E_TEST_HORSE_ID = String(starterHorse.id);

    // ── 6. Seed Show rows for AC5 Competition Entry tests ──────────────────────
    // CompetitionBrowserPage renders cards only when Show rows exist.
    // Without seeded shows the page shows an empty-state and AC5 tests fail.
    // Equoria-kyrf: seeding here ensures shows are present before any test worker starts.
    console.log('Seeding Show rows for AC5...');
    const csrfTokenRes = await page.request.get(`${baseURL}/api/v1/auth/csrf-token`);
    const csrfTokenJson = await csrfTokenRes.json();
    const setupCsrfToken: string = csrfTokenJson?.data?.csrfToken ?? csrfTokenJson?.csrfToken ?? '';
    if (setupCsrfToken) {
      const showsToSeed = [
        { name: `E2E Dressage Show ${timestamp}`, discipline: 'Dressage' },
        { name: `E2E Show Jumping Show ${timestamp}`, discipline: 'Show Jumping' },
        { name: `E2E Racing Show ${timestamp}`, discipline: 'Racing' },
      ];
      for (const show of showsToSeed) {
        const res = await page.request.post(`${baseURL}/api/v1/shows/create`, {
          data: { ...show, entryFee: 0 },
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': setupCsrfToken },
        });
        if (res.ok()) {
          const j = await res.json();
          console.log(`Show seeded: ${show.discipline} (id=${j?.data?.show?.id})`);
        } else {
          console.warn(`Show seed failed for ${show.discipline}:`, res.status(), await res.text());
        }
      }
    } else {
      console.warn('CSRF token unavailable — AC5 Show seeding skipped');
    }

    // ── 7. Seed the conformation-entry preconditions (Equoria-6yu1m) ───────────
    // The conformation-entry E2E spec drives the REAL eligibility + entry POST.
    // For the eligible branch to fire it needs, against the canonical DB:
    //   (a) an OPEN conformation show that lands on PAGE 1 of GET /api/v1/competition.
    //       That feed is paginated to 20 rows, orderBy: { runDate: 'asc' },
    //       filtered where: { status: 'open' }. Every existing open ridden show
    //       uses runDate 2025-06-01 (a PAST date). A future runDate sorts AFTER
    //       all of them and falls off page 1 → the show-select stays empty. THE
    //       FIX is an EARLY runDate (2020-01-01) so the show sorts to the TOP of
    //       the asc feed and appears on page 1. runDate does NOT gate entry —
    //       entry checks status:'open' + showType:'conformation' + eligibility,
    //       never runDate (the existing ridden shows are likewise past-dated +
    //       open).
    //   (b) the E2E horse in Excellent health with FRESH lastFedDate AND
    //       lastVettedDate. The entry POST gate is getDisplayedHealth(horse) ===
    //       'critical' (conformationShowController). getDisplayedHealth = worse-of
    //       feedHealth + vetHealth; feedHealth is 'critical' when lastFedDate is
    //       null regardless of healthStatus, so BOTH dates must be set fresh.
    //   (c) a groom assigned to the horse whose GroomAssignment.createdAt is
    //       older than MIN_GROOM_ASSIGNMENT_DAYS (= 2). assignGroupToFoal stamps
    //       createdAt = now(), so we backdate it to >= 3 days ago.
    // Fail-loud: throw if any precondition cannot be created. Scoped writes only;
    // no broad deleteMany.
    console.log('Seeding conformation-entry preconditions (Equoria-6yu1m)...');
    {
      const prisma = await getPrisma();

      // (1) Resolve the E2E user id from the authed profile.
      const profileRes = await page.request.get(`${baseURL}/api/v1/auth/profile`);
      if (!profileRes.ok()) {
        throw new Error(
          `[conformation-seed] profile lookup failed: GET /api/v1/auth/profile returned ${profileRes.status()} — ${await profileRes.text()}`
        );
      }
      const profileJson = await profileRes.json();
      const e2eUserId: string | undefined = profileJson?.data?.user?.id ?? profileJson?.data?.id;
      if (!e2eUserId) {
        throw new Error(
          `[conformation-seed] could not resolve E2E user id from profile response: ${JSON.stringify(
            profileJson
          ).slice(0, 300)}`
        );
      }
      console.log('[conformation-seed] E2E user id:', e2eUserId);

      const horseId = Number(process.env.E2E_TEST_HORSE_ID);
      if (!Number.isInteger(horseId) || horseId <= 0) {
        throw new Error(
          `[conformation-seed] E2E_TEST_HORSE_ID is not a positive integer: "${process.env.E2E_TEST_HORSE_ID}"`
        );
      }

      // (2) Find-or-create the OPEN conformation show (unique by name).
      //     Show.name is @unique, so upsert keys cleanly on it.
      const conformationShowName = `E2E-Conformation-${e2eUserId}`;
      const EARLY_RUN_DATE = new Date('2020-01-01'); // THE FIX — page-1 asc sort.
      const conformationShow = await prisma.show.upsert({
        where: { name: conformationShowName },
        update: {
          showType: 'conformation',
          status: 'open',
          discipline: 'Dressage',
          runDate: EARLY_RUN_DATE,
          entryFee: 0,
          prize: 0,
          levelMin: 1,
          levelMax: 10,
          hostUserId: e2eUserId,
          createdByUserId: e2eUserId,
        },
        create: {
          name: conformationShowName,
          // Cosmetic — conformation scoring is discipline-agnostic; mirrors the
          // discipline value the existing seeds use.
          discipline: 'Dressage',
          showType: 'conformation',
          status: 'open',
          runDate: EARLY_RUN_DATE,
          entryFee: 0,
          prize: 0,
          levelMin: 1,
          levelMax: 10,
          hostUserId: e2eUserId,
          createdByUserId: e2eUserId,
        },
      });
      if (conformationShow.status !== 'open' || conformationShow.showType !== 'conformation') {
        throw new Error(
          `[conformation-seed] seeded show is not open+conformation: status=${conformationShow.status} showType=${conformationShow.showType}`
        );
      }
      console.log(
        `[conformation-seed] conformation show ready: id=${conformationShow.id} name="${conformationShowName}" ` +
          `status=${conformationShow.status} showType=${conformationShow.showType} runDate=${conformationShow.runDate.toISOString()}`
      );

      // (3) Make the E2E horse healthy + fed + vetted so it is NOT critical.
      const now = new Date();
      const updatedHorse = await prisma.horse.update({
        where: { id: horseId },
        data: {
          healthStatus: 'Excellent',
          lastFedDate: now,
          lastVettedDate: now,
          stressLevel: 0,
        },
        select: { id: true, healthStatus: true, lastFedDate: true, lastVettedDate: true },
      });
      console.log(
        `[conformation-seed] horse ${horseId} set healthy: healthStatus=${updatedHorse.healthStatus} ` +
          `lastFedDate=${updatedHorse.lastFedDate?.toISOString()} lastVettedDate=${updatedHorse.lastVettedDate?.toISOString()}`
      );

      // (4) Hire a groom (POST /api/v1/grooms/hire) — snake_case body fields per
      //     the route's express-validator chain.
      const seedCsrfRes = await page.request.get(`${baseURL}/api/v1/auth/csrf-token`);
      const seedCsrfJson = await seedCsrfRes.json();
      const seedCsrfToken: string = seedCsrfJson?.data?.csrfToken ?? seedCsrfJson?.csrfToken ?? '';
      if (!seedCsrfToken) {
        throw new Error('[conformation-seed] could not obtain CSRF token for groom hire/assign');
      }
      const seedHeaders = {
        'Content-Type': 'application/json',
        'X-CSRF-Token': seedCsrfToken,
      };

      const hireRes = await page.request.post(`${baseURL}/api/v1/grooms/hire`, {
        data: {
          name: `E2E Conformation Handler ${timestamp}`,
          speciality: 'foal_care',
          skill_level: 'expert',
          personality: 'gentle',
        },
        headers: seedHeaders,
      });
      if (!hireRes.ok()) {
        throw new Error(
          `[conformation-seed] groom hire failed: POST /api/v1/grooms/hire returned ${hireRes.status()} — ${await hireRes.text()}`
        );
      }
      const hireJson = await hireRes.json();
      const groomId: number | undefined = hireJson?.data?.id;
      if (!Number.isInteger(groomId)) {
        throw new Error(
          `[conformation-seed] groom hire returned no groom id: ${JSON.stringify(hireJson).slice(0, 300)}`
        );
      }
      console.log(`[conformation-seed] groom hired: id=${groomId}`);

      // (5) Assign the groom to the E2E horse (POST /api/v1/grooms/assign).
      const assignRes = await page.request.post(`${baseURL}/api/v1/grooms/assign`, {
        data: { foalId: horseId, groomId, priority: 1 },
        headers: seedHeaders,
      });
      if (!assignRes.ok()) {
        throw new Error(
          `[conformation-seed] groom assign failed: POST /api/v1/grooms/assign returned ${assignRes.status()} — ${await assignRes.text()}`
        );
      }
      const assignJson = await assignRes.json();
      const assignmentId: number | undefined = assignJson?.data?.id;
      if (!Number.isInteger(assignmentId)) {
        throw new Error(
          `[conformation-seed] groom assign returned no assignment id: ${JSON.stringify(
            assignJson
          ).slice(0, 300)}`
        );
      }
      console.log(`[conformation-seed] groom assignment created: id=${assignmentId}`);

      // (6) Backdate the assignment createdAt to >= 3 days ago so it clears
      //     MIN_GROOM_ASSIGNMENT_DAYS (= 2). Scoped to the single assignment id.
      const backdated = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const backdatedAssignment = await prisma.groomAssignment.update({
        where: { id: assignmentId },
        data: { createdAt: backdated },
        select: { id: true, createdAt: true, isActive: true },
      });
      const ageDays =
        (now.getTime() - new Date(backdatedAssignment.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < 2) {
        throw new Error(
          `[conformation-seed] backdated assignment age ${ageDays.toFixed(2)}d is below the 2-day minimum`
        );
      }
      console.log(
        `[conformation-seed] assignment ${assignmentId} backdated: createdAt=${new Date(
          backdatedAssignment.createdAt
        ).toISOString()} age=${ageDays.toFixed(2)}d isActive=${backdatedAssignment.isActive}`
      );
      console.log('[conformation-seed] conformation-entry preconditions seeded OK.');
    }

    console.log('Global setup complete.');
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
