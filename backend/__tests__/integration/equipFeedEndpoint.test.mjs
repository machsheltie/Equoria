/**
 * Equip / Unequip feed endpoint integration tests (Equoria-wr30, parent: Equoria-3gqg).
 *
 * Spec §6.x: POST /api/horses/:id/equip-feed sets Horse.equippedFeedType when the
 * authenticated user owns the horse and has at least 1 unit of the requested
 * feed tier in their pooled inventory (User.settings.inventory). POST
 * /api/horses/:id/unequip-feed clears equippedFeedType for owned horses.
 *
 * Real DB, real auth, real CSRF — no bypass headers, no API mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';

describe('Equip / Unequip feed endpoints', () => {
  let user;
  let token;
  let horseId;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: `equip-feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        username: `eqfeed${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        password: 'irrelevant-test-hash',
        firstName: 'Test',
        lastName: 'User',
        money: 0,
        settings: {
          inventory: [
            {
              id: 'feed-elite',
              itemId: 'elite',
              category: 'feed',
              name: 'Elite Feed',
              quantity: 50,
            },
          ],
        },
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const horse = await prisma.horse.create({
      data: {
        name: `EqHorse${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId: user.id,
      },
    });
    horseId = horse.id;
  });

  afterEach(async () => {
    await prisma.horse.delete({ where: { id: horseId } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });

  it('equip-feed sets equippedFeedType when user owns the tier', async () => {
    const csrf = await fetchCsrf(app);

    const res = await request(app)
      .post(`/api/horses/${horseId}/equip-feed`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ feedType: 'elite' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.equippedFeedType).toBe('elite');
  });

  it('equip-feed rejects (400) when user has 0 units of the requested tier', async () => {
    const csrf = await fetchCsrf(app);

    const res = await request(app)
      .post(`/api/horses/${horseId}/equip-feed`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ feedType: 'basic' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBeDefined();
    expect(res.body.message).toMatch(/don't own|do not own|out of|no .* feed/i);

    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.equippedFeedType).toBeNull();
  });

  it('unequip-feed clears equippedFeedType after first equipping', async () => {
    // Equip first
    const csrfEquip = await fetchCsrf(app);
    const equipRes = await request(app)
      .post(`/api/horses/${horseId}/equip-feed`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrfEquip.cookieHeader)
      .set('X-CSRF-Token', csrfEquip.csrfToken)
      .send({ feedType: 'elite' });
    expect(equipRes.status).toBe(200);

    // Fresh CSRF for the unequip POST
    const csrfUnequip = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horseId}/unequip-feed`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrfUnequip.cookieHeader)
      .set('X-CSRF-Token', csrfUnequip.csrfToken)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.equippedFeedType).toBeNull();
  });

  it('rejects equip when inventory quantity is zero', async () => {
    // Replace this user's inventory: entry exists for elite, but quantity is 0.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        settings: {
          inventory: [
            {
              id: 'feed-elite',
              itemId: 'elite',
              category: 'feed',
              name: 'Elite Feed',
              quantity: 0,
            },
          ],
        },
      },
    });

    const csrf = await fetchCsrf(app);

    const res = await request(app)
      .post(`/api/horses/${horseId}/equip-feed`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ feedType: 'elite' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBeDefined();
    expect(res.body.message).toMatch(/don't own|do not own|out of|no .* feed/i);

    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.equippedFeedType).toBeNull();
  });

  it('rejects equip when inventory quantity is non-numeric (string masquerading as number)', async () => {
    // Replace inventory: entry exists for elite, but quantity is a string ('50').
    // Without Number.isFinite(), '50' >= 1 would coerce to true and bypass the guard.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        settings: {
          inventory: [
            {
              id: 'feed-elite',
              itemId: 'elite',
              category: 'feed',
              name: 'Elite Feed',
              quantity: '50',
            },
          ],
        },
      },
    });

    const csrf = await fetchCsrf(app);

    const res = await request(app)
      .post(`/api/horses/${horseId}/equip-feed`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ feedType: 'elite' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBeDefined();
    expect(res.body.message).toMatch(/don't own|do not own|out of|no .* feed/i);

    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.equippedFeedType).toBeNull();
  });

  it('rejects cross-user equip with 404 (CWE-639 disclosure resistance)', async () => {
    // A horse owned by `user` must not be equippable by `other`. The middleware
    // (requireOwnership('horse')) returns 404 — not 403 — so an authenticated
    // attacker cannot enumerate which horse IDs exist by probing them with a
    // foreign token. The byte-identical-response sentinel below proves the
    // 404 envelope is the same whether the horse is missing or simply not-owned.
    const other = await prisma.user.create({
      data: {
        email: `other-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        username: `other${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        password: 'irrelevant-test-hash',
        firstName: 'Other',
        lastName: 'User',
        money: 0,
        settings: {
          inventory: [
            {
              id: 'feed-elite',
              itemId: 'elite',
              category: 'feed',
              name: 'Elite Feed',
              quantity: 50,
            },
          ],
        },
      },
    });

    try {
      const otherToken = generateTestToken({ id: other.id, email: other.email, role: 'user' });

      const csrfNotOwned = await fetchCsrf(app);
      const resNotOwned = await request(app)
        .post(`/api/horses/${horseId}/equip-feed`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${otherToken}`)
        .set('Cookie', csrfNotOwned.cookieHeader)
        .set('X-CSRF-Token', csrfNotOwned.csrfToken)
        .send({ feedType: 'elite' });

      expect(resNotOwned.status).toBe(404);
      expect(resNotOwned.body.success).toBe(false);

      // The owned horse must NOT have been mutated.
      const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
      expect(fresh.equippedFeedType).toBeNull();

      // CWE-639 sentinel: response for a horse the caller doesn't own must be
      // byte-identical to the response for a horse that doesn't exist at all.
      // If these diverge, the attacker can enumerate horse IDs.
      const csrfMissing = await fetchCsrf(app);
      const resMissing = await request(app)
        .post(`/api/horses/999999999/equip-feed`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${otherToken}`)
        .set('Cookie', csrfMissing.cookieHeader)
        .set('X-CSRF-Token', csrfMissing.csrfToken)
        .send({ feedType: 'elite' });

      expect(resMissing.status).toBe(404);
      expect(resMissing.body).toEqual(resNotOwned.body);
    } finally {
      await prisma.user.delete({ where: { id: other.id } }).catch(() => {});
    }
  });
});
