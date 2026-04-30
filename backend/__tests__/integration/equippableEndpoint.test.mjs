/**
 * Equippable view endpoint integration tests (Equoria-o0af, parent: Equoria-3gqg).
 *
 * Spec §6.x: GET /api/horses/:id/equippable returns the tack and feed
 * items the authenticated user can equip on the given horse. Tack items
 * already equipped to a DIFFERENT horse are excluded. Feed items are
 * always returned with a per-tier `isCurrentlyEquippedToThisHorse` flag.
 *
 * Real DB, real auth — no bypass headers, no API mocks. GET endpoint, so
 * no CSRF cookie/header pair required.
 *
 * Ownership uses requireOwnership('horse') middleware (CWE-639 disclosure
 * resistance pattern from commit 892fc812).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';

describe('GET /api/horses/:id/equippable', () => {
  let user;
  let token;
  let horseAId;
  let horseBId;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        username: `eq${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        password: 'irrelevant-test-hash',
        firstName: 'Test',
        lastName: 'User',
        money: 0,
        settings: {
          inventory: [
            {
              id: 'tack-saddle-basic',
              itemId: 'saddle-basic',
              category: 'saddle',
              name: 'Basic Saddle',
              quantity: 1,
              equippedToHorseId: null,
            },
            {
              id: 'tack-saddle-pro',
              itemId: 'saddle-pro',
              category: 'saddle',
              name: 'Pro Saddle',
              quantity: 1,
              equippedToHorseId: null,
            },
            {
              id: 'feed-basic',
              itemId: 'basic',
              category: 'feed',
              name: 'Basic Feed',
              quantity: 100,
            },
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

    const a = await prisma.horse.create({
      data: {
        name: `EqA${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId: user.id,
      },
    });
    const b = await prisma.horse.create({
      data: {
        name: `EqB${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId: user.id,
      },
    });
    horseAId = a.id;
    horseBId = b.id;

    // Mark Pro Saddle equipped to horse B (simulate what the equip flow does).
    const inventoryWithProSaddleOnB = [
      {
        id: 'tack-saddle-basic',
        itemId: 'saddle-basic',
        category: 'saddle',
        name: 'Basic Saddle',
        quantity: 1,
        equippedToHorseId: null,
      },
      {
        id: 'tack-saddle-pro',
        itemId: 'saddle-pro',
        category: 'saddle',
        name: 'Pro Saddle',
        quantity: 1,
        equippedToHorseId: horseBId,
      },
      {
        id: 'feed-basic',
        itemId: 'basic',
        category: 'feed',
        name: 'Basic Feed',
        quantity: 100,
      },
      {
        id: 'feed-elite',
        itemId: 'elite',
        category: 'feed',
        name: 'Elite Feed',
        quantity: 50,
      },
    ];
    await prisma.user.update({
      where: { id: user.id },
      data: { settings: { inventory: inventoryWithProSaddleOnB } },
    });
  });

  afterEach(async () => {
    await prisma.horse.deleteMany({ where: { id: { in: [horseAId, horseBId] } } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });

  it('returns tack equipped to nobody + tack equipped to this horse; excludes tack equipped to other horses', async () => {
    const res = await request(app)
      .get(`/api/horses/${horseAId}/equippable`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const tackIds = res.body.data.tack.map(t => t.id);
    expect(tackIds).toContain('tack-saddle-basic'); // nobody's
    expect(tackIds).not.toContain('tack-saddle-pro'); // equipped to B, must be excluded for A
  });

  it('includes tack equipped to THIS horse', async () => {
    // Move Pro Saddle from B → A.
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    const updatedInventory = fresh.settings.inventory.map(i =>
      i.id === 'tack-saddle-pro' ? { ...i, equippedToHorseId: horseAId } : i,
    );
    await prisma.user.update({
      where: { id: user.id },
      data: { settings: { ...fresh.settings, inventory: updatedInventory } },
    });

    const res = await request(app)
      .get(`/api/horses/${horseAId}/equippable`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const tackIds = res.body.data.tack.map(t => t.id);
    expect(tackIds).toContain('tack-saddle-pro');
  });

  it('returns ALL feed items regardless of which horse uses them', async () => {
    const res = await request(app)
      .get(`/api/horses/${horseAId}/equippable`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const feedIds = res.body.data.feed.map(f => f.feedType);
    expect(feedIds).toEqual(expect.arrayContaining(['basic', 'elite']));
  });

  it('flags isCurrentlyEquippedToThisHorse on the equipped feed tier', async () => {
    await prisma.horse.update({
      where: { id: horseAId },
      data: { equippedFeedType: 'elite' },
    });

    const res = await request(app)
      .get(`/api/horses/${horseAId}/equippable`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`);

    const elite = res.body.data.feed.find(f => f.feedType === 'elite');
    const basic = res.body.data.feed.find(f => f.feedType === 'basic');
    expect(elite).toBeDefined();
    expect(basic).toBeDefined();
    expect(elite.isCurrentlyEquippedToThisHorse).toBe(true);
    expect(basic.isCurrentlyEquippedToThisHorse).toBe(false);
  });

  it('excludes feed items with quantity <= 0', async () => {
    // Sentinel-positive: zeroed inventory rows must be filtered out.
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    const updatedInventory = fresh.settings.inventory.map(i => (i.id === 'feed-basic' ? { ...i, quantity: 0 } : i));
    await prisma.user.update({
      where: { id: user.id },
      data: { settings: { ...fresh.settings, inventory: updatedInventory } },
    });

    const res = await request(app)
      .get(`/api/horses/${horseAId}/equippable`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const feedIds = res.body.data.feed.map(f => f.feedType);
    expect(feedIds).toContain('elite');
    expect(feedIds).not.toContain('basic');
  });

  it('returns 404 for cross-user access (CWE-639 disclosure resistance)', async () => {
    // A separate user must not be able to query horse A's equippable list.
    const other = await prisma.user.create({
      data: {
        email: `eqother-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        username: `eqother${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        password: 'irrelevant-test-hash',
        firstName: 'Other',
        lastName: 'User',
        money: 0,
        settings: { inventory: [] },
      },
    });
    try {
      const otherToken = generateTestToken({ id: other.id, email: other.email, role: 'user' });

      const resNotOwned = await request(app)
        .get(`/api/horses/${horseAId}/equippable`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${otherToken}`);
      expect(resNotOwned.status).toBe(404);

      // CWE-639 sentinel: not-owned response equals not-found response.
      const resMissing = await request(app)
        .get(`/api/horses/999999999/equippable`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${otherToken}`);
      expect(resMissing.status).toBe(404);
      expect(resMissing.body).toEqual(resNotOwned.body);
    } finally {
      await prisma.user.delete({ where: { id: other.id } }).catch(() => {});
    }
  });
});
