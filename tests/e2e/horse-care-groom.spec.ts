/**
 * Horse care — "Groom Horse" end to end (Equoria-j765w.2; owner ruling q67)
 *
 * The care action was impossible for a player before this epic, so this spec
 * proves a player can do it, through the real UI against the real backend:
 *
 *  1. Home: tonight's grooming reminder lists the horse (it has a groom and has
 *     not been groomed this Eastern game day).
 *  2. The reminder opens that horse's page, where tonight's care is OPEN: the
 *     Quick Actions "Groom Horse" press is available.
 *  3. One press, no confirm page: POST /api/v1/grooms/care/:horseId/groom
 *     succeeds and the care is CLOSED: the press reads "Groomed Today" and is
 *     disabled, and the server agrees (groomedToday, cannot groom again).
 *  4. Home again: the reminder no longer lists the horse.
 *
 * Contract note (owner ruling 2026-10-28, Equoria-7dje4): the "Tonight's Care"
 * block that bef677bd6 put in the middle of the horse page is gone. Old
 * contract: the open/closed care showed there. Now: it is the Groom Horse
 * button in the Quick Actions bar (data-testid="action-groom-horse"); the home
 * reminder (data-testid="grooming-reminder") is unchanged.
 *
 * Fixtures: the spec runs as its own disposable player
 * (tests/e2e/fixtures/seededPlayer.ts) so no other spec's horses or grooms are
 * in the reminder. The player's onboarding starter horse (age 3, an adult, so
 * no foal activity picker) gets a groom through the same real routes
 * global-setup.ts uses: POST /api/v1/groom-marketplace/hire, then
 * POST /api/v1/grooms/assign. Grooming itself is only ever done through the
 * button: grooms never work on their own and no test route does it for them.
 *
 * No route interception, no bypass headers, no test.skip. Real backend, real DB.
 */
import { test as base, expect } from '@playwright/test';
import { createSeededPlayerSession, type SeededPlayerSession } from './fixtures/seededPlayer';
import { csrfMutate } from './helpers/api';

type CareHorse = { horseId: number; horseName: string; groomId: number };

type CareStatusBody = {
  data?: {
    horseName?: string;
    groomedToday?: boolean;
    canGroomToday?: boolean;
    groom?: { id?: number } | null;
  };
};

const test = base.extend<object, { seededPlayer: SeededPlayerSession; careHorse: CareHorse }>({
  seededPlayer: [
    async ({ browser }, use) => {
      const player = await createSeededPlayerSession(browser);
      await use(player);
      await player.context.close();
    },
    { scope: 'worker' },
  ],
  careHorse: [
    async ({ seededPlayer }, use) => {
      const horseId = seededPlayer.starterHorseId;

      // Hire a groom from the marketplace (players never build grooms) ...
      const marketRes = await seededPlayer.request.get('/api/v1/groom-marketplace');
      expect(
        marketRes.ok(),
        `GET /api/v1/groom-marketplace returned ${marketRes.status()}: ${await marketRes.text()}`
      ).toBe(true);
      const market = (await marketRes.json()) as {
        data?: { grooms?: Array<{ marketplaceId?: string }> };
      };
      const offerId = market.data?.grooms?.[0]?.marketplaceId;
      expect(offerId, 'the groom marketplace must offer at least one groom').toBeTruthy();

      const hireRes = await csrfMutate(seededPlayer, 'POST', '/api/v1/groom-marketplace/hire', {
        marketplaceId: offerId,
      });
      expect(
        hireRes.ok(),
        `POST /api/v1/groom-marketplace/hire returned ${hireRes.status()}: ${await hireRes.text()}`
      ).toBe(true);
      const hired = (await hireRes.json()) as { data?: { groom?: { id?: number } } };
      const groomId = hired.data?.groom?.id;
      expect(Number.isInteger(groomId), 'hire must return the new groom id').toBe(true);

      // ... and assign that groom to the starter horse.
      const assignRes = await csrfMutate(seededPlayer, 'POST', '/api/v1/grooms/assign', {
        foalId: horseId,
        groomId,
      });
      expect(
        assignRes.ok(),
        `POST /api/v1/grooms/assign returned ${assignRes.status()}: ${await assignRes.text()}`
      ).toBe(true);

      // Tonight's care starts open: groomed nowhere yet, and the server says it can be.
      const statusRes = await seededPlayer.request.get(`/api/v1/grooms/care/${horseId}`);
      expect(statusRes.ok(), `GET care status returned ${statusRes.status()}`).toBe(true);
      const status = ((await statusRes.json()) as CareStatusBody).data;
      expect(status?.groom?.id, 'the assigned groom must be the horse’s groom').toBe(groomId);
      expect(status?.groomedToday, 'a fresh horse has not been groomed today').toBe(false);
      expect(status?.canGroomToday, 'a horse with a working groom can be groomed').toBe(true);
      expect(typeof status?.horseName).toBe('string');

      await use({ horseId, horseName: status!.horseName!, groomId: groomId! });
    },
    { scope: 'worker' },
  ],
  storageState: async ({ seededPlayer, careHorse: _careHorse }, use) => {
    // Depends on careHorse so the groom is assigned before the page opens.
    await use(seededPlayer.storageStatePath);
  },
});

test.describe('Horse care — Groom Horse (Equoria-j765w.2)', () => {
  test('a player sees care open, presses Groom Horse, sees it closed, and the home reminder follows', async ({
    page,
    seededPlayer,
    careHorse,
  }) => {
    test.setTimeout(90_000);
    const { horseId, horseName } = careHorse;
    const reminderLink = page.getByTestId(`grooming-reminder-horse-${horseId}`);

    // 1. Home: the horse is waiting to be groomed tonight.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('grooming-reminder')).toBeVisible({ timeout: 20_000 });
    await expect(reminderLink).toBeVisible();
    await expect(reminderLink).toHaveText(horseName);

    // 2. The reminder opens that horse's page at its care press; care is open.
    await reminderLink.click();
    await expect(page).toHaveURL(new RegExp(`/horses/${horseId}#care$`), { timeout: 20_000 });
    const press = page.getByTestId('action-groom-horse');
    await expect(press).toBeVisible({ timeout: 20_000 });
    await expect(press).toBeEnabled({ timeout: 15_000 });
    await expect(press).toContainText('Groom Horse');

    // 3. One press grooms the horse through the real route, and care closes.
    const groomResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/v1/grooms/care/${horseId}/groom`) &&
        resp.request().method() === 'POST',
      { timeout: 20_000 }
    );
    await press.click();
    expect((await groomResponse).ok()).toBe(true);
    await expect(press).toContainText('Groomed Today', { timeout: 15_000 });
    await expect(press).toBeDisabled();

    // The server agrees: groomed today, and not again until tomorrow.
    const afterRes = await seededPlayer.request.get(`/api/v1/grooms/care/${horseId}`);
    expect(afterRes.ok(), `GET care status returned ${afterRes.status()}`).toBe(true);
    const after = ((await afterRes.json()) as CareStatusBody).data;
    expect(after?.groomedToday).toBe(true);
    expect(after?.canGroomToday).toBe(false);

    // 4. Home again: nobody is waiting any more.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('grooming-reminder-empty')).toBeVisible({ timeout: 20_000 });
    await expect(reminderLink).toHaveCount(0);
  });
});
