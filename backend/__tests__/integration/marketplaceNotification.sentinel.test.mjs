/**
 * Sentinel test: horse purchase creates horse_purchased (buyer) and horse_sold
 * (seller) Notification rows.
 *
 * The old code never wrote to the Notification table, so this test fails
 * before the marketplaceController fix.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf, attachCsrf } from '../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

describe('SENTINEL: marketplace purchase → horse_purchased + horse_sold Notifications', () => {
  let seller;
  let buyer;
  let horse;
  let buyerToken;
  let csrf;

  beforeAll(async () => {
    seller = await prisma.user.create({
      data: {
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
        email: `mp_buyer_${Date.now()}@test.com`,
        username: `mp_buyer_${Date.now()}`,
        password: 'irrelevant',
        firstName: 'Mp',
        lastName: 'Buyer',
        money: 99999,
      },
    });

    horse = await prisma.horse.create({
      data: {
        name: `TestFixture-MpNotifHorse-${Date.now()}`,
        sex: 'Stallion',
        dateOfBirth: new Date('2019-01-01'),
        age: 6,
        userId: seller.id,
        forSale: true,
        salePrice: 500,
      },
    });

    buyerToken = generateTestToken({ id: buyer.id, email: buyer.email, role: 'user' });
    csrf = await fetchCsrf(app);
  }, 30000);

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: seller.id } });
    await prisma.notification.deleteMany({ where: { userId: buyer.id } });
    await prisma.horseSale.deleteMany({ where: { horseId: horse.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: seller.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: buyer.id } }).catch(() => {});
  }, 30000);

  it('creates horse_purchased (buyer) and horse_sold (seller) Notification rows', async () => {
    const res = await attachCsrf(
      request(app)
        .post(`/api/marketplace/buy/${horse.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('Origin', ORIGIN),
      csrf,
    );

    expect(res.status).toBe(200);

    const buyerNotif = await prisma.notification.findFirst({
      where: { userId: buyer.id, type: 'horse_purchased' },
    });
    expect(buyerNotif).not.toBeNull();
    expect(buyerNotif.payload).toHaveProperty('horseName');
    expect(buyerNotif.payload).toHaveProperty('salePrice');

    const sellerNotif = await prisma.notification.findFirst({
      where: { userId: seller.id, type: 'horse_sold' },
    });
    expect(sellerNotif).not.toBeNull();
    expect(sellerNotif.payload).toHaveProperty('horseName');
    expect(sellerNotif.payload).toHaveProperty('salePrice');
  }, 30000);
});
