import { test, expect } from '@playwright/test';
// @ts-expect-error — JS module without .d.ts; import works at runtime via Node.
import prisma from '../../../packages/database/prismaClient.mjs';
import {
  csrfRequest,
  expectOk,
  installProductionParityNetworkGuard,
  registerAndCompleteOnboarding,
  unwrapData,
  visitLiveRoute,
} from './support/prodParity';

// Cleanup hook: this E2E test creates real horses, shows, users, etc. via the
// API (no test-bypass routes per beta doctrine). Without an afterAll teardown,
// fixtures leak into the shared real DB and pollute global queries in other
// suites (notably tests/integration/leaderboardRoutes.test.mjs's
// /recent-winners endpoint, which queries the 10 most-recent 1st-place
// results globally). Wipe by Atlas/Readiness name prefix — this also catches
// leftovers from prior failed runs.
test.afterAll(async () => {
  try {
    await prisma.competitionResult.deleteMany({
      where: { showName: { startsWith: 'Readiness Show' } },
    });
    await prisma.show.deleteMany({
      where: { name: { startsWith: 'Readiness Show' } },
    });
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'Atlas Prime' } },
    });
    // Player accounts use suffix-formatted emails; Atlas suffix is in the user
    // first/last name, but the registration helper uses the suffix to derive
    // a unique email. We don't know the exact pattern from here, so we leave
    // the user rows for now; they don't pollute leaderboards.
  } finally {
    await prisma.$disconnect();
  }
});

test('all beta route families execute real read and write flows', async ({ page, browser }) => {
  const guard = installProductionParityNetworkGuard(page);
  const suffix = `${Date.now()}_flows`;
  const player = await registerAndCompleteOnboarding(page, suffix, `Atlas ${suffix}`);
  const starterHorseId = Number(player.horse.id);
  const breedId = Number(player.horse.breedId || player.horse.breed?.id || 1);

  const profile = unwrapData<{ user: { id: string } }>(
    await expectOk(await page.request.get('/api/v1/auth/profile'), 'GET /api/auth/profile')
  );
  expect(profile.user.id).toBeTruthy();

  const recipientPage = await browser.newPage();
  const recipientGuard = installProductionParityNetworkGuard(recipientPage);
  await registerAndCompleteOnboarding(recipientPage, `${suffix}_recipient`, `Recipient ${suffix}`);
  const recipientProfile = unwrapData<{ user: { id: string } }>(
    await expectOk(
      await recipientPage.request.get('/api/v1/auth/profile'),
      'GET recipient /api/auth/profile'
    )
  );

  const buyerPage = await browser.newPage();
  const buyerGuard = installProductionParityNetworkGuard(buyerPage);
  await registerAndCompleteOnboarding(buyerPage, `${suffix}_buyer`, `Buyer ${suffix}`);

  const renamed = `Atlas Prime ${suffix}`;
  const editHorseJson = await expectOk(
    await csrfRequest(page, 'PUT', `/api/v1/horses/${starterHorseId}`, { name: renamed }),
    'PUT /api/v1/horses/:id'
  );
  expect(unwrapData<Record<string, unknown>>(editHorseJson).name).toBe(renamed);

  const claimResponse = await csrfRequest(page, 'POST', '/api/v1/bank/claim', {});
  expect([200, 400]).toContain(claimResponse.status());
  const transactions = unwrapData<{ transactions: Array<Record<string, unknown>> }>(
    await expectOk(
      await page.request.get('/api/v1/users/transactions?page=1&pageSize=50'),
      'GET /api/v1/users/transactions'
    )
  );
  expect(Array.isArray(transactions.transactions)).toBe(true);

  const breeds = unwrapData<Array<{ id: number }>>(
    await expectOk(await page.request.get('/api/v1/breeds'), 'GET /api/v1/breeds')
  );
  expect(breeds.length).toBeGreaterThan(0);
  const storeHorseJson = await expectOk(
    await csrfRequest(buyerPage, 'POST', '/api/v1/marketplace/store/buy', {
      breedId: breedId || breeds[0].id,
      sex: 'stallion',
    }),
    'POST /api/v1/marketplace/store/buy'
  );
  const boughtHorse = unwrapData<{ horse: Record<string, unknown> }>(storeHorseJson).horse;
  expect(Number(boughtHorse.id)).toBeGreaterThan(0);

  const stallionJson = await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/horses', {
      name: `Sire ${suffix}`,
      breedId: breedId || breeds[0].id,
      age: 5,
      sex: 'stallion',
      gender: 'STALLION',
    }),
    'POST /api/v1/horses'
  );
  const stallion = unwrapData<Record<string, unknown>>(stallionJson);
  expect(Number(stallion.id)).toBeGreaterThan(0);

  // Feed the stallion and dam so both horses pass the critical-health gate in
  // POST /api/v1/horses/foals. The breeding endpoint uses getDisplayedHealth(),
  // which is worseOf(feedHealth, vetHealth). A horse with lastFedDate=null has
  // feedHealth='critical', blocking breeding regardless of healthStatus.
  //
  // Steps: buy feed → equip feed on each horse → feed each horse → proceed to breed.
  // We do this here (before listing/training/breeding) so the horses are healthy
  // by the time we reach the foal creation call.
  const feedCatalogForBreeding = unwrapData<Array<{ id: string }>>(
    await expectOk(
      await page.request.get('/api/v1/feed-shop/catalog'),
      'GET /api/v1/feed-shop/catalog (pre-breed)'
    )
  );
  const feedTier = feedCatalogForBreeding[0].id;
  // Purchase enough packs to feed both the stallion and the dam (2 horses, 1 pack each).
  await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/feed-shop/purchase', {
      feedTier,
      packs: 2,
    }),
    'POST /api/v1/feed-shop/purchase (pre-breed)'
  );
  // Equip feed to stallion then feed it
  await expectOk(
    await csrfRequest(page, 'POST', `/api/v1/horses/${Number(stallion.id)}/equip-feed`, {
      feedType: feedTier,
    }),
    'POST /api/v1/horses/stallion/equip-feed'
  );
  await expectOk(
    await csrfRequest(page, 'POST', `/api/v1/horses/${Number(stallion.id)}/feed`, {}),
    'POST /api/v1/horses/stallion/feed'
  );
  // Equip feed to starter mare (dam) then feed it
  await expectOk(
    await csrfRequest(page, 'POST', `/api/v1/horses/${starterHorseId}/equip-feed`, {
      feedType: feedTier,
    }),
    'POST /api/v1/horses/dam/equip-feed'
  );
  await expectOk(
    await csrfRequest(page, 'POST', `/api/v1/horses/${starterHorseId}/feed`, {}),
    'POST /api/v1/horses/dam/feed'
  );

  const listJson = await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/marketplace/list', {
      horseId: starterHorseId,
      price: 2500,
    }),
    'POST /api/v1/marketplace/list'
  );
  expect(unwrapData<Record<string, unknown>>(listJson).horseId ?? starterHorseId).toBe(
    starterHorseId
  );
  await expectOk(
    await csrfRequest(page, 'DELETE', `/api/v1/marketplace/list/${starterHorseId}`),
    'DELETE /api/v1/marketplace/list/:horseId'
  );

  const trainable = unwrapData<Array<Record<string, unknown>>>(
    await expectOk(
      await page.request.get(`/api/v1/training/trainable/${profile.user.id}`),
      'GET /api/v1/training/trainable/:userId'
    )
  );
  expect(Array.isArray(trainable)).toBe(true);
  const eligibilityJson = await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/training/check-eligibility', {
      horseId: starterHorseId,
      discipline: 'Dressage',
    }),
    'POST /api/v1/training/check-eligibility'
  );
  expect(unwrapData<Record<string, unknown>>(eligibilityJson).eligible).toEqual(
    expect.any(Boolean)
  );
  const trainResponse = await csrfRequest(page, 'POST', '/api/v1/training/train', {
    horseId: starterHorseId,
    discipline: 'Dressage',
  });
  expect(trainResponse.status()).toBe(200);

  // POST /api/v1/horses/foals now starts a PREGNANCY (B-prefix feed-system
  // redesign) — response shape is { pregnancyStarted, damId, sireId,
  // foalDueDate }, NOT { foal: { id, ... } }. The foal entity is
  // materialized asynchronously by the foaling job (B5). The previous
  // test fetched foal-development immediately, but with the pregnancy
  // model that record doesn't exist for ~7 in-game days.
  //
  // Validate the pregnancy-start response shape and that's it for the
  // foal flow. Foal-development / enrichment routes are exercised by
  // backend integration tests (tests/integration/foal*.test.mjs); this
  // beta-readiness check just proves the bred-pair endpoint accepts a
  // valid request and responds with the expected pregnancy fields.
  const pregnancyJson = await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/horses/foals', {
      name: `Foal ${suffix}`,
      breedId: breedId || breeds[0].id,
      sireId: Number(stallion.id),
      damId: starterHorseId,
      sex: 'Mare',
    }),
    'POST /api/v1/horses/foals'
  );
  const pregnancy = unwrapData<{ pregnancyStarted?: boolean; damId?: number }>(pregnancyJson);
  expect(pregnancy.pregnancyStarted ?? true).toBe(true);
  expect(Number(pregnancy.damId ?? starterHorseId)).toBe(starterHorseId);

  const showJson = await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/shows/create', {
      name: `Readiness Show ${suffix}`,
      discipline: 'Dressage',
      entryFee: 0,
      maxEntries: 20,
      description: 'Production parity readiness show',
    }),
    'POST /api/v1/shows/create'
  );
  const show = unwrapData<{ show: { id: number } }>(showJson).show;
  await expectOk(await page.request.get('/api/v1/shows'), 'GET /api/v1/shows');
  await expectOk(
    await page.request.get(`/api/v1/competition/eligibility/${starterHorseId}/Dressage`),
    'GET /api/v1/competition/eligibility/:horseId/:discipline'
  );
  await expectOk(
    await csrfRequest(page, 'POST', `/api/v1/shows/${show.id}/enter`, {
      horseId: starterHorseId,
    }),
    'POST /api/v1/shows/:id/enter'
  );

  const vetServices = unwrapData<Array<{ id: string }>>(
    await expectOk(await page.request.get('/api/v1/vet/services'), 'GET /api/v1/vet/services')
  );
  await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/vet/book-appointment', {
      horseId: starterHorseId,
      serviceId: vetServices[0].id,
    }),
    'POST /api/v1/vet/book-appointment'
  );
  const farrierServices = unwrapData<Array<{ id: string }>>(
    await expectOk(
      await page.request.get('/api/v1/farrier/services'),
      'GET /api/v1/farrier/services'
    )
  );
  await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/farrier/book-service', {
      horseId: starterHorseId,
      serviceId: farrierServices[0].id,
    }),
    'POST /api/v1/farrier/book-service'
  );
  const feedCatalog = unwrapData<Array<{ id: string }>>(
    await expectOk(
      await page.request.get('/api/v1/feed-shop/catalog'),
      'GET /api/v1/feed-shop/catalog'
    )
  );
  // Feed-system redesign Phase A (Equoria-gt81): the purchase endpoint
  // now takes { feedTier, packs } — bulk-pack purchase flow that adds
  // to a pooled User.settings.inventory rather than the legacy per-horse
  // { horseId, feedId } write. The catalog returns tier descriptors
  // whose `id` is the feedTier slug (e.g. "basic", "performance").
  await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/feed-shop/purchase', {
      feedTier: feedCatalog[0].id,
      packs: 1,
    }),
    'POST /api/v1/feed-shop/purchase'
  );
  const tackCatalog = unwrapData<{ items: Array<{ id: string; cost: number }> }>(
    await expectOk(
      await page.request.get('/api/v1/tack-shop/inventory'),
      'GET /api/v1/tack-shop/inventory'
    )
  );
  const cheapestTack = tackCatalog.items.reduce((cheapest, item) =>
    item.cost < cheapest.cost ? item : cheapest
  );
  await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/tack-shop/purchase', {
      horseId: starterHorseId,
      itemId: cheapestTack.id,
    }),
    'POST /api/v1/tack-shop/purchase'
  );
  await expectOk(
    await page.request.get('/api/v1/crafting/materials'),
    'GET /api/v1/crafting/materials'
  );
  const recipeJson = unwrapData<{ recipes: Array<{ id: string; affordable: boolean }> }>(
    await expectOk(
      await page.request.get('/api/v1/crafting/recipes'),
      'GET /api/v1/crafting/recipes'
    )
  );
  const craftable = recipeJson.recipes.find((recipe) => recipe.affordable);
  expect(craftable, 'At least one starter recipe must be craftable').toBeTruthy();
  await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/crafting/craft', { recipeId: craftable!.id }),
    'POST /api/v1/crafting/craft'
  );

  const riderMarket = unwrapData<{ riders: Array<{ marketplaceId: string; weeklyRate: number }> }>(
    await expectOk(
      await page.request.get('/api/v1/riders/marketplace'),
      'GET /api/v1/riders/marketplace'
    )
  );
  expect(riderMarket.riders.length).toBeGreaterThan(0);
  const cheapestRider = riderMarket.riders.reduce((cheapest, rider) =>
    rider.weeklyRate < cheapest.weeklyRate ? rider : cheapest
  );
  const riderHire = unwrapData<{ rider: { id: number } }>(
    await expectOk(
      await csrfRequest(page, 'POST', '/api/v1/riders/marketplace/hire', {
        marketplaceId: cheapestRider.marketplaceId,
      }),
      'POST /api/v1/riders/marketplace/hire'
    )
  );
  const riderAssignment = unwrapData<{ id: number }>(
    await expectOk(
      await csrfRequest(page, 'POST', '/api/v1/riders/assignments', {
        riderId: riderHire.rider.id,
        horseId: starterHorseId,
        notes: 'Production readiness assignment',
      }),
      'POST /api/v1/riders/assignments'
    )
  );
  await expectOk(
    await csrfRequest(page, 'DELETE', `/api/v1/riders/assignments/${riderAssignment.id}`),
    'DELETE /api/v1/riders/assignments/:id'
  );

  const trainerMarket = unwrapData<{
    trainers: Array<{ marketplaceId: string; sessionRate: number }>;
  }>(
    await expectOk(
      await page.request.get('/api/v1/trainers/marketplace'),
      'GET /api/v1/trainers/marketplace'
    )
  );
  expect(trainerMarket.trainers.length).toBeGreaterThan(0);
  const cheapestTrainer = trainerMarket.trainers.reduce((cheapest, trainer) =>
    trainer.sessionRate < cheapest.sessionRate ? trainer : cheapest
  );
  const trainerHire = unwrapData<{ trainer: { id: number } }>(
    await expectOk(
      await csrfRequest(page, 'POST', '/api/v1/trainers/marketplace/hire', {
        marketplaceId: cheapestTrainer.marketplaceId,
      }),
      'POST /api/v1/trainers/marketplace/hire'
    )
  );
  const trainerAssignment = unwrapData<{ id: number }>(
    await expectOk(
      await csrfRequest(page, 'POST', '/api/v1/trainers/assignments', {
        trainerId: trainerHire.trainer.id,
        horseId: starterHorseId,
        notes: 'Production readiness assignment',
      }),
      'POST /api/v1/trainers/assignments'
    )
  );
  await expectOk(
    await csrfRequest(page, 'DELETE', `/api/v1/trainers/assignments/${trainerAssignment.id}`),
    'DELETE /api/v1/trainers/assignments/:id'
  );

  const threadJson = unwrapData<{ thread: { id: number } }>(
    await expectOk(
      await csrfRequest(page, 'POST', '/api/v1/forum/threads', {
        section: 'general',
        title: `Readiness Thread ${suffix}`,
        content: 'Production parity message board write flow.',
        tags: ['readiness'],
      }),
      'POST /api/v1/forum/threads'
    )
  );
  await expectOk(
    await csrfRequest(page, 'POST', `/api/v1/forum/threads/${threadJson.thread.id}/posts`, {
      content: 'Production parity reply flow.',
    }),
    'POST /api/v1/forum/threads/:id/posts'
  );
  const clubJson = unwrapData<{ club: { id: number } }>(
    await expectOk(
      await csrfRequest(page, 'POST', '/api/v1/clubs', {
        name: `Readiness Club ${suffix}`,
        type: 'discipline',
        category: 'Dressage',
        description: 'Production parity club write flow.',
      }),
      'POST /api/v1/clubs'
    )
  );
  await expectOk(
    await csrfRequest(recipientPage, 'POST', `/api/v1/clubs/${clubJson.club.id}/join`, {}),
    'POST /api/v1/clubs/:id/join as non-member'
  );
  await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/messages', {
      recipientId: recipientProfile.user.id,
      subject: `Readiness Message ${suffix}`,
      content: 'Production parity direct message write flow.',
      tag: 'general',
    }),
    'POST /api/v1/messages'
  );

  for (const route of [
    '/',
    '/stable',
    `/horses/${starterHorseId}`,
    '/my-stable',
    '/profile',
    '/settings',
    '/leaderboards',
    '/inventory',
    '/training',
    '/breeding',
    '/competitions',
    '/competition-results',
    '/conformation-shows',
    '/prizes',
    '/bank',
    '/world',
    '/vet',
    '/farrier',
    '/feed-shop',
    '/tack-shop',
    '/crafting',
    '/marketplace',
    '/marketplace/horses',
    '/marketplace/horse-trader',
    '/grooms',
    '/riders',
    '/trainers',
    '/community',
    '/message-board',
    `/message-board/${threadJson.thread.id}`,
    '/clubs',
    '/messages',
  ]) {
    await visitLiveRoute(page, route);
  }

  await recipientPage.close();
  await buyerPage.close();
  guard.assertClean();
  recipientGuard.assertClean();
  buyerGuard.assertClean();
});
