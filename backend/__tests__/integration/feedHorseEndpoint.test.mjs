/**
 * Feed horse endpoint integration tests (Equoria-l5kf, parent: Equoria-3gqg).
 *
 * Spec §6.x: POST /api/horses/:id/feed performs the daily feed action — runs
 * a transactional inventory decrement on the user's pooled feed inventory
 * (User.settings.inventory), sets Horse.lastFedDate, optionally rolls a stat
 * boost (per-tier statRollPct), and auto-clears equippedFeedType when the
 * inventory row reaches 0 units.
 *
 * Real DB, real auth, real CSRF — no bypass headers, no API mocks.
 *
 * Ownership of the horse is enforced via requireOwnership('horse')
 * middleware (CWE-639 disclosure resistance — see commit 892fc812). The
 * service performs a defense-in-depth owner check inside its transaction
 * and returns 404 (not 403) on mismatch to preserve the byte-identical
 * "not found" envelope.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';

describe('POST /api/horses/:id/feed', () => {
  let user;
  let token;
  let horseId;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        username: `feed${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
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
              quantity: 5,
            },
          ],
        },
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const horse = await prisma.horse.create({
      data: {
        name: `Fed${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId: user.id,
        equippedFeedType: 'elite',
        speed: 50,
      },
    });
    horseId = horse.id;
  });

  afterEach(async () => {
    await prisma.horse.delete({ where: { id: horseId } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });

  it('happy path: decrements unit, sets lastFedDate, returns horse', async () => {
    const csrf = await fetchCsrf(app);

    const res = await request(app)
      .post(`/api/horses/${horseId}/feed`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.horse.lastFedDate).toBeTruthy();
    expect(res.body.data.feed.tier).toBe('elite');
    expect(res.body.data.remainingUnits).toBe(4);

    // DB read-back: inventory was actually decremented (sentinel: don't trust the response)
    const u = await prisma.user.findUnique({ where: { id: user.id } });
    const inv = u.settings.inventory.find(i => i.id === 'feed-elite');
    expect(inv).toBeDefined();
    expect(inv.quantity).toBe(4);

    // DB read-back: lastFedDate was actually persisted
    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.lastFedDate).toBeTruthy();
  });

  it('rejects when no feed equipped (400, message matches /no feed currently selected/i)', async () => {
    await prisma.horse.update({ where: { id: horseId }, data: { equippedFeedType: null } });

    const csrf = await fetchCsrf(app);

    const res = await request(app)
      .post(`/api/horses/${horseId}/feed`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/no feed currently selected/i);

    // Inventory must NOT have been decremented
    const u = await prisma.user.findUnique({ where: { id: user.id } });
    const inv = u.settings.inventory.find(i => i.id === 'feed-elite');
    expect(inv.quantity).toBe(5);
  });

  it('rejects when out of feed and auto-clears equippedFeedType (DB read-back)', async () => {
    // Set inventory quantity to 0 — feed action should reject AND clear equippedFeedType
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
      .post(`/api/horses/${horseId}/feed`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/out of/i);

    // Sentinel-positive: equippedFeedType MUST have been auto-cleared on the
    // actual horse row in the DB (not just promised in the response body).
    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.equippedFeedType).toBeNull();
    // lastFedDate must NOT have been set (operation should have rolled back stat changes)
    expect(fresh.lastFedDate).toBeNull();
  });

  it('rejects already-fed-today (400, message matches /already fed today/i)', async () => {
    await prisma.horse.update({
      where: { id: horseId },
      data: { lastFedDate: new Date() },
    });

    const csrf = await fetchCsrf(app);

    const res = await request(app)
      .post(`/api/horses/${horseId}/feed`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already fed today/i);

    // Inventory must NOT have been decremented
    const u = await prisma.user.findUnique({ where: { id: user.id } });
    const inv = u.settings.inventory.find(i => i.id === 'feed-elite');
    expect(inv.quantity).toBe(5);
  });

  it('retired horse (age >= 21): no-op success, no decrement', async () => {
    await prisma.horse.update({ where: { id: horseId }, data: { age: 22 } });

    const csrf = await fetchCsrf(app);

    const res = await request(app)
      .post(`/api/horses/${horseId}/feed`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.skipped).toBe('retired');

    // Inventory must NOT have been decremented for a retired horse
    const u = await prisma.user.findUnique({ where: { id: user.id } });
    const inv = u.settings.inventory.find(i => i.id === 'feed-elite');
    expect(inv.quantity).toBe(5);
  });
});

describe('Stat-boost roll determinism (POST /api/horses/:id/feed)', () => {
  // The service accepts an optional rng for testability. The controller
  // uses Math.random; to test boost outcomes deterministically we exercise
  // the service directly in service-level tests (Task A9), not via HTTP.
  it.todo('moved to feedHorseService.test.mjs');
});
