/**
 * Stud service between two players, end to end (Equoria-e7tgc.11).
 *
 * Two real players, each registered and onboarded over the real API
 * (createSeededPlayerSession), each with real cookies in their own browser
 * context. No bypass header, no route interception, no test-only route.
 *
 * Built to the owner's rulings, which replace the 2026-07 issue text:
 *   - q105 (2026-10-27): breeding and the requests list live on the stallion's
 *     own page, Stud / Sale area. There is no Breeding Hall and no inbox page;
 *     a mare's sent requests are listed on her page.
 *   - q91/q94 + "just a game" (2026-10-26): "Breed to <name> (<fee>)", a mare
 *     picker, one click. No confirm page, no receipt, no balance preview, so
 *     the request flow has no fee-snapshot modal.
 *   - q108: Reject sends no note.
 *   - A non-owner answering another player's request gets 404, not 403: the
 *     server does not reveal that another player's request exists
 *     (studRequestController.approveStudRequest).
 *
 * Flows: Public Stud booking moves the fee once; Private Stud request ->
 * accept moves the fee once and puts the mare in foal; reject moves nothing;
 * one waiting request per mare is shown in the picker and freed by Withdraw;
 * a mare already in foal is refused with her real reason; the visitor has no
 * answer controls and the API refuses her.
 *
 * Fixtures: TestFixture-named horses on two throwaway players; everything
 * is seeded before either browser opens a page. Assertions are scoped to the
 * horses and requests this spec created; no list order or count is assumed.
 */

import { test as base, expect, type Browser, type Page } from '@playwright/test';
import { createSeededPlayerSession, type SeededPlayerSession } from './fixtures/seededPlayer';
import { seedOwnedHorses, type SeededHorse } from './fixtures/ownedHorses';
import { csrfMutate } from './helpers/api';

type Players = { stallionOwner: SeededPlayerSession; mareOwner: SeededPlayerSession };

const test = base.extend<object, Players>({
  stallionOwner: [
    async ({ browser }, use) => {
      const player = await createSeededPlayerSession(browser);
      await use(player);
      await player.context.close();
    },
    { scope: 'worker' },
  ],
  mareOwner: [
    async ({ browser }, use) => {
      const player = await createSeededPlayerSession(browser);
      await use(player);
      await player.context.close();
    },
    { scope: 'worker' },
  ],
});

test.describe.configure({ mode: 'serial' });

const stamp = `${Date.now()}`.slice(-7);
const publicFee = 150;
const privateFee = 100;

let publicSire: SeededHorse;
let privateSire: SeededHorse;
let mareForPublic: SeededHorse;
let mareToAccept: SeededHorse;
let mareToReject: SeededHorse;
let mareToWithdraw: SeededHorse;

async function firstBreedId(player: SeededPlayerSession): Promise<number> {
  const response = await player.request.get('/api/v1/breeds');
  expect(response.ok(), `GET /api/v1/breeds returned ${response.status()}`).toBe(true);
  const json = (await response.json()) as { data?: Array<{ id: number }> } | Array<{ id: number }>;
  const breeds = Array.isArray(json) ? json : (json.data ?? []);
  expect(breeds.length, 'at least one breed').toBeGreaterThan(0);
  return breeds[0].id;
}

async function moneyOf(player: SeededPlayerSession): Promise<number> {
  const response = await player.request.get('/api/v1/auth/profile');
  expect(response.ok(), `GET /api/v1/auth/profile returned ${response.status()}`).toBe(true);
  const json = (await response.json()) as { data?: { user?: { money?: number } } };
  const money = json.data?.user?.money;
  expect(typeof money, 'profile carries the coin balance').toBe('number');
  return money as number;
}

async function horseRow(player: SeededPlayerSession, horseId: number) {
  const response = await player.request.get(`/api/v1/horses/${horseId}`);
  expect(response.ok(), `GET /api/v1/horses/${horseId} returned ${response.status()}`).toBe(true);
  const json = (await response.json()) as { data?: { inFoalSinceDate?: string | null } };
  return json.data ?? {};
}

type RequestRow = { id: number; status: string; dam: { id: number | null } };

async function requestsFor(player: SeededPlayerSession, query: string): Promise<RequestRow[]> {
  const response = await player.request.get(`/api/v1/studs/requests?${query}&limit=100`);
  expect(response.ok(), `GET /api/v1/studs/requests?${query} returned ${response.status()}`).toBe(
    true
  );
  const json = (await response.json()) as { data?: { requests?: RequestRow[] } };
  return json.data?.requests ?? [];
}

/** A page signed in as this player (their own cookie jar). */
async function openAs(browser: Browser, player: SeededPlayerSession): Promise<Page> {
  const context = await browser.newContext({ storageState: player.storageStatePath });
  return context.newPage();
}

async function openStudSale(page: Page, horse: SeededHorse): Promise<void> {
  await page.goto(`/horses/${horse.id}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: horse.name }).first()).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('tab', { name: 'Stud / Sale' }).first().click();
}

/** The stallion owner stands her stallion at Public or Private Stud through the real control. */
async function standAtStud(
  page: Page,
  stallion: SeededHorse,
  mode: 'Public Stud' | 'Private Stud',
  fee: number
): Promise<void> {
  await openStudSale(page, stallion);
  await page.getByRole('radio', { name: mode }).click();
  await page.getByLabel('Stud fee').fill(String(fee));
  await page.locator('form.stud-feeset').getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByText(`${stallion.name} stands at ${mode} for ${fee.toLocaleString('en-US')}.`)
  ).toBeVisible();
}

/** The mare owner presses "Breed to <name> (<fee>)" and picks her mare: the one click. */
async function breedTo(page: Page, stallion: SeededHorse, fee: number, mare: SeededHorse) {
  await openStudSale(page, stallion);
  await page
    .getByRole('button', { name: `Breed to ${stallion.name} (${fee.toLocaleString('en-US')})` })
    .click();
  await page.getByLabel('Choose one of your mares').selectOption(String(mare.id));
}

async function openRequests(page: Page, horse: SeededHorse) {
  await openStudSale(page, horse);
  await page.getByRole('button', { name: 'Breeding requests' }).click();
}

function requestEntry(page: Page, name: string) {
  return page.locator('li.stud-request').filter({ hasText: name });
}

async function expectCoinsShown(page: Page, money: number) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('coins-display')).toContainText(money.toLocaleString('en-US'));
}

test.beforeAll(async ({ stallionOwner, mareOwner }) => {
  const breedId = await firstBreedId(stallionOwner);
  [publicSire, privateSire] = await seedOwnedHorses(stallionOwner, [
    { breedId, name: `TestFixture Lantern Sire ${stamp}`, sex: 'Stallion', age: 6 },
    { breedId, name: `TestFixture Hollow Sire ${stamp}`, sex: 'Stallion', age: 6 },
  ]);
  [mareForPublic, mareToAccept, mareToReject, mareToWithdraw] = await seedOwnedHorses(mareOwner, [
    { breedId, name: `TestFixture Wren ${stamp}`, sex: 'Mare', age: 5 },
    { breedId, name: `TestFixture Linnet ${stamp}`, sex: 'Mare', age: 5 },
    { breedId, name: `TestFixture Sorrel ${stamp}`, sex: 'Mare', age: 5 },
    { breedId, name: `TestFixture Bramble ${stamp}`, sex: 'Mare', age: 5 },
  ]);
});

test('Public Stud: the mare owner breeds at once and the fee moves once', async ({
  browser,
  stallionOwner,
  mareOwner,
}) => {
  const owner = await openAs(browser, stallionOwner);
  await standAtStud(owner, publicSire, 'Public Stud', publicFee);

  const ownerBefore = await moneyOf(stallionOwner);
  const mareBefore = await moneyOf(mareOwner);

  const visitor = await openAs(browser, mareOwner);
  await breedTo(visitor, publicSire, publicFee, mareForPublic);
  await expect(
    visitor.getByText(
      `${mareForPublic.name} is in foal to ${publicSire.name}. The foal is due in 7 days.`
    )
  ).toBeVisible();

  expect((await horseRow(mareOwner, mareForPublic.id)).inFoalSinceDate).toBeTruthy();
  expect(await moneyOf(mareOwner)).toBe(mareBefore - publicFee);
  expect(await moneyOf(stallionOwner)).toBe(ownerBefore + publicFee);
  await expectCoinsShown(visitor, mareBefore - publicFee);
  await expectCoinsShown(owner, ownerBefore + publicFee);

  await owner.context().close();
  await visitor.context().close();
});

test('Private Stud: a request waits on the stallion page; Accept moves the fee once and the mare is in foal', async ({
  browser,
  stallionOwner,
  mareOwner,
}) => {
  const owner = await openAs(browser, stallionOwner);
  await standAtStud(owner, privateSire, 'Private Stud', privateFee);

  const ownerBefore = await moneyOf(stallionOwner);
  const mareBefore = await moneyOf(mareOwner);

  const visitor = await openAs(browser, mareOwner);
  await breedTo(visitor, privateSire, privateFee, mareToAccept);
  await expect(
    visitor.getByText(`Your request for ${mareToAccept.name} is with ${stallionOwner.username}.`)
  ).toBeVisible();
  // Nothing moves until the stallion owner answers.
  expect(await moneyOf(mareOwner)).toBe(mareBefore);

  await openRequests(visitor, mareToAccept);
  await expect(
    requestEntry(visitor, `${mareToAccept.name} to ${privateSire.name}`).getByText(
      'Waiting for a reply'
    )
  ).toBeVisible();

  await openRequests(owner, privateSire);
  const row = requestEntry(owner, mareToAccept.name);
  await expect(row.getByText('Waiting on you')).toBeVisible();
  await row
    .getByRole('button', {
      name: `Accept ${mareToAccept.name} (${privateFee.toLocaleString('en-US')})`,
    })
    .click();
  await expect(
    row.getByText(
      `${mareToAccept.name} is in foal to ${privateSire.name}. ${mareOwner.username} has been told.`
    )
  ).toBeVisible();
  await expect(row.getByText('Accepted', { exact: true })).toBeVisible();

  expect((await horseRow(mareOwner, mareToAccept.id)).inFoalSinceDate).toBeTruthy();
  expect(await moneyOf(mareOwner)).toBe(mareBefore - privateFee);
  expect(await moneyOf(stallionOwner)).toBe(ownerBefore + privateFee);

  await openRequests(visitor, mareToAccept);
  await expect(
    requestEntry(visitor, `${mareToAccept.name} to ${privateSire.name}`).getByText(
      'Accepted, in foal'
    )
  ).toBeVisible();
  await expectCoinsShown(visitor, mareBefore - privateFee);

  await owner.context().close();
  await visitor.context().close();
});

test('Reject: no note, no money moves, and the mare owner reads Declined', async ({
  browser,
  stallionOwner,
  mareOwner,
}) => {
  const visitor = await openAs(browser, mareOwner);
  await breedTo(visitor, privateSire, privateFee, mareToReject);
  await expect(visitor.getByText(`Your request for ${mareToReject.name}`)).toBeVisible();

  const ownerBefore = await moneyOf(stallionOwner);
  const mareBefore = await moneyOf(mareOwner);

  const owner = await openAs(browser, stallionOwner);
  await openRequests(owner, privateSire);
  const row = requestEntry(owner, mareToReject.name);
  await row.getByRole('button', { name: 'Reject' }).click();
  await expect(
    row.getByText(`You declined ${mareToReject.name}. ${mareOwner.username} has been told.`)
  ).toBeVisible();
  await expect(owner.getByRole('textbox')).toHaveCount(0);

  expect(await moneyOf(mareOwner)).toBe(mareBefore);
  expect(await moneyOf(stallionOwner)).toBe(ownerBefore);
  expect((await horseRow(mareOwner, mareToReject.id)).inFoalSinceDate ?? null).toBeNull();

  await openRequests(visitor, mareToReject);
  await expect(
    requestEntry(visitor, `${mareToReject.name} to ${privateSire.name}`).getByText('Declined', {
      exact: true,
    })
  ).toBeVisible();

  await owner.context().close();
  await visitor.context().close();
});

test('One waiting request per mare: the picker says so, and Withdraw frees her', async ({
  browser,
  mareOwner,
}) => {
  const visitor = await openAs(browser, mareOwner);
  await breedTo(visitor, privateSire, privateFee, mareToWithdraw);
  await expect(visitor.getByText(`Your request for ${mareToWithdraw.name}`)).toBeVisible();

  // Back on the stallion: her option is greyed out with the reason.
  await openStudSale(visitor, privateSire);
  await visitor
    .getByRole('button', { name: `Breed to ${privateSire.name} (${privateFee})` })
    .click();
  const waiting = visitor
    .getByLabel('Choose one of your mares')
    .locator(`option[value="${mareToWithdraw.id}"]`);
  await expect(waiting).toHaveText(`${mareToWithdraw.name} · a request is already waiting`);
  await expect(waiting).toBeDisabled();

  await openRequests(visitor, mareToWithdraw);
  const row = requestEntry(visitor, `${mareToWithdraw.name} to ${privateSire.name}`);
  await row.getByRole('button', { name: 'Withdraw request' }).click();
  await expect(row.getByText('Withdrawn', { exact: true })).toBeVisible();

  await openStudSale(visitor, privateSire);
  await visitor
    .getByRole('button', { name: `Breed to ${privateSire.name} (${privateFee})` })
    .click();
  const freed = visitor
    .getByLabel('Choose one of your mares')
    .locator(`option[value="${mareToWithdraw.id}"]`);
  await expect(freed).toBeEnabled();
  await expect(freed).not.toContainText('a request is already waiting');

  await visitor.context().close();
});

test('A mare already in foal is refused with her real reason, on screen and from the server', async ({
  browser,
  mareOwner,
}) => {
  const visitor = await openAs(browser, mareOwner);
  await openStudSale(visitor, publicSire);
  await visitor.getByRole('button', { name: `Breed to ${publicSire.name} (${publicFee})` }).click();
  const inFoal = visitor
    .getByLabel('Choose one of your mares')
    .locator(`option[value="${mareForPublic.id}"]`);
  await expect(inFoal).toHaveText(`${mareForPublic.name} · already in foal`);
  await expect(inFoal).toBeDisabled();

  // The server is the authority: a booking sent anyway is refused with a reason, never a 5xx.
  const mareBefore = await moneyOf(mareOwner);
  const refused = await csrfMutate(mareOwner, 'POST', `/api/v1/studs/${publicSire.id}/bookings`, {
    damId: mareForPublic.id,
    expectedStudFee: publicFee,
  });
  expect(refused.status(), await refused.text()).toBeGreaterThanOrEqual(400);
  expect(refused.status()).toBeLessThan(500);
  const body = (await refused.json()) as { success?: boolean; message?: string };
  expect(body.success).toBe(false);
  expect((body.message ?? '').length).toBeGreaterThan(0);
  expect(await moneyOf(mareOwner)).toBe(mareBefore);

  await visitor.context().close();
});

test("A visitor has no answer controls on another player's stallion, and the API refuses her", async ({
  browser,
  stallionOwner,
  mareOwner,
}) => {
  // A fresh waiting request from the mare owner to the Private Stud stallion.
  const sent = await csrfMutate(mareOwner, 'POST', `/api/v1/studs/${privateSire.id}/requests`, {
    damId: mareToWithdraw.id,
    expectedStudFee: privateFee,
  });
  expect(sent.status(), await sent.text()).toBe(201);
  const pending = (await requestsFor(stallionOwner, `role=incoming&sireId=${privateSire.id}`)).find(
    (row) => row.dam.id === mareToWithdraw.id && row.status === 'PENDING'
  );
  expect(pending, 'the stallion owner sees the waiting request').toBeTruthy();

  const visitor = await openAs(browser, mareOwner);
  await openStudSale(visitor, privateSire);
  await expect(visitor.getByRole('heading', { name: /Standing at stud/ })).toBeVisible();
  await expect(visitor.getByRole('button', { name: 'Breeding requests' })).toHaveCount(0);
  await expect(visitor.getByRole('button', { name: /^Accept / })).toHaveCount(0);
  await expect(visitor.getByRole('button', { name: 'Reject' })).toHaveCount(0);
  await expect(visitor.getByRole('radio', { name: 'Public Stud' })).toHaveCount(0);

  for (const answer of ['approve', 'reject'] as const) {
    const refused = await csrfMutate(
      mareOwner,
      'POST',
      `/api/v1/studs/requests/${pending!.id}/${answer}`,
      {}
    );
    expect(refused.status(), `${answer} by the mare owner: ${await refused.text()}`).toBe(404);
  }
  const stillWaiting = (
    await requestsFor(stallionOwner, `role=incoming&sireId=${privateSire.id}`)
  ).find((row) => row.id === pending!.id);
  expect(stillWaiting?.status).toBe('PENDING');

  // Leave nothing waiting: the mare owner withdraws her own request.
  const withdrawn = await csrfMutate(
    mareOwner,
    'POST',
    `/api/v1/studs/requests/${pending!.id}/cancel`,
    {}
  );
  expect(withdrawn.ok(), await withdrawn.text()).toBe(true);

  await visitor.context().close();
});
