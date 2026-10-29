/**
 * Sentinel test: horse purchase creates horsePurchased (buyer) and horseSold
 * (seller) Notification rows.
 *
 * The old code never wrote to the Notification table, so this test fails
 * before the marketplaceController fix.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf, attachCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const ORIGIN = 'http://localhost:3000';

describe('SENTINEL: marketplace purchase → horsePurchased + horseSold Notifications', () => {
  let seller;
  let buyer;
  let horse;
  let buyerToken;
  let csrf;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    // Scoped, fail-loud cleanup (Equoria-9jv9c). Deletes run in dependency
    // order (notifications + sale rows before the horse/users they reference);
    // a failure now fails the suite instead of being swallowed.
    cleanup.add(
      () => prisma.notification.deleteMany({ where: { userId: { in: [seller?.id, buyer?.id].filter(Boolean) } } }),
      'notifications',
    );
    cleanup.add(() => prisma.horseSale.deleteMany({ where: { horseId: horse.id } }), 'horseSale');
    cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
    cleanup.add(
      () => prisma.user.deleteMany({ where: { id: { in: [seller?.id, buyer?.id].filter(Boolean) } } }),
      'users',
    );

    seller = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `mp_seller_${Date.now()}@test.com`,
        username: `mp_seller_${Date.now()}`,
        password: 'irrelevant',
        firstName: 'Mp',
        lastName: 'Seller',
        money: 1000,
      },
    });

    buyer = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `mp_buyer_${Date.now()}@test.com`,
        username: `mp_buyer_${Date.now()}`,
        password: 'irrelevant',
        firstName: 'Mp',
        lastName: 'Buyer',
        money: 99999,
      },
    });

    horse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `TestFixture-MpNotifHorse-${Date.now()}`,
        sex: 'Stallion',
        dateOfBirth: new Date('2019-01-01'),
        age: 6,
        userId: seller.id,
        forSale: true,
        salePrice: 500,
      }),
    });

    buyerToken = generateTestToken({ id: buyer.id, email: buyer.email, role: 'user' });
    csrf = await fetchCsrf(app);
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('creates horsePurchased (buyer) and horseSold (seller) Notification rows', async () => {
    const res = await attachCsrf(
      request(app)
        .post(`/api/v1/marketplace/buy/${horse.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('Origin', ORIGIN),
      csrf,
    );

    expect(res.status).toBe(200);

    const buyerNotif = await prisma.notification.findFirst({
      where: { userId: buyer.id, type: 'horsePurchased' },
    });
    expect(buyerNotif).not.toBeNull();
    expect(buyerNotif.payload).toHaveProperty('horseName');
    expect(buyerNotif.payload).toHaveProperty('salePrice');

    const sellerNotif = await prisma.notification.findFirst({
      where: { userId: seller.id, type: 'horseSold' },
    });
    expect(sellerNotif).not.toBeNull();
    expect(sellerNotif.payload).toHaveProperty('horseName');
    expect(sellerNotif.payload).toHaveProperty('salePrice');
  }, 30000);
});
