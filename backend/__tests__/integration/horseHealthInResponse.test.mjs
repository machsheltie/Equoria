/**
 * Horse JSON includes feedHealth / vetHealth / displayedHealth (Equoria-77v5,
 * parent: Equoria-3gqg).
 *
 * Spec §5.4: derived health bands must be exposed on horse responses so
 * the frontend can render the Horse Care Status Strip and the Feed/Vet
 * gauges without recomputing locally.
 *
 * Two endpoints carry horse JSON for the beta surface:
 *   - GET /api/horses        (list — full row select)
 *   - GET /api/horses/:id/overview (detail — custom select)
 *
 * Both must include the three derived bands. Real DB, real auth — no
 * bypass headers, no API mocks. GET endpoints, no CSRF needed.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';

describe('Horse JSON includes feedHealth / vetHealth / displayedHealth', () => {
  let user;
  let token;
  let horseId;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: `health-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        username: `health${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        password: 'irrelevant-test-hash',
        firstName: 'Test',
        lastName: 'User',
        money: 0,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const horse = await prisma.horse.create({
      data: {
        name: `Healthy${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId: user.id,
        lastFedDate: new Date(),
        lastVettedDate: new Date(),
      },
    });
    horseId = horse.id;
  });

  afterEach(async () => {
    await prisma.horse.delete({ where: { id: horseId } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });

  describe('GET /api/horses (list endpoint)', () => {
    it('includes all three derived bands on each horse', async () => {
      const res = await request(app)
        .get(`/api/horses?userId=${user.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const horses = res.body.data;
      expect(Array.isArray(horses)).toBe(true);
      const fresh = horses.find(h => h.id === horseId);
      expect(fresh).toBeDefined();
      expect(fresh.feedHealth).toBe('excellent');
      expect(fresh.vetHealth).toBe('excellent');
      expect(fresh.displayedHealth).toBe('excellent');
    });

    it('reflects stale lastFedDate (10 days = critical)', async () => {
      await prisma.horse.update({
        where: { id: horseId },
        data: { lastFedDate: new Date(Date.now() - 10 * 86_400_000) },
      });

      const res = await request(app)
        .get(`/api/horses?userId=${user.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`);

      const fresh = res.body.data.find(h => h.id === horseId);
      expect(fresh.feedHealth).toBe('critical');
      // displayedHealth = worseOf(feedHealth='critical', vetHealth='excellent')
      expect(fresh.displayedHealth).toBe('critical');
    });

    it('reflects healthStatus override on vetHealth', async () => {
      // Vet-finding override: any non-null healthStatus wins over the
      // weekly-decay band, per getVetHealth().
      await prisma.horse.update({
        where: { id: horseId },
        data: { healthStatus: 'poor' },
      });

      const res = await request(app)
        .get(`/api/horses?userId=${user.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`);

      const fresh = res.body.data.find(h => h.id === horseId);
      expect(fresh.vetHealth).toBe('poor');
      // displayedHealth = worseOf('excellent', 'poor') === 'poor'
      expect(fresh.displayedHealth).toBe('poor');
    });
  });

  describe('GET /api/horses/:id/overview (detail endpoint)', () => {
    it('includes all three derived bands', async () => {
      const res = await request(app)
        .get(`/api/horses/${horseId}/overview`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.feedHealth).toBe('excellent');
      expect(res.body.data.vetHealth).toBe('excellent');
      expect(res.body.data.displayedHealth).toBe('excellent');
    });

    it('reflects stale lastFedDate on overview detail', async () => {
      await prisma.horse.update({
        where: { id: horseId },
        data: { lastFedDate: new Date(Date.now() - 10 * 86_400_000) },
      });

      const res = await request(app)
        .get(`/api/horses/${horseId}/overview`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.data.feedHealth).toBe('critical');
      expect(res.body.data.displayedHealth).toBe('critical');
    });

    it('retired horse (age >= 21) is reported as retired on all three bands', async () => {
      // Retirement is a terminal state, not a degradation: per worseOf(),
      // 'retired' wins over any other band.
      await prisma.horse.update({
        where: { id: horseId },
        data: { age: 22 },
      });

      const res = await request(app)
        .get(`/api/horses/${horseId}/overview`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.data.feedHealth).toBe('retired');
      expect(res.body.data.vetHealth).toBe('retired');
      expect(res.body.data.displayedHealth).toBe('retired');
    });
  });
});
