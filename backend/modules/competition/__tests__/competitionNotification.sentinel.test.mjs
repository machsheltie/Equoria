/**
 * Sentinel test: competition placement creates a competition_stat_gain Notification row
 * when calculateStatGain fires (10% chance for 1st place).
 *
 * Flow: POST /enter (enters horse) → POST /execute (host runs competition) →
 * check Notification table. If no boost, delete the competition result so the
 * horse can re-enter, then repeat. P(no boost in 50 runs) ≈ 0.5%.
 *
 * The old JSONB code never wrote to the Notification table, so this test
 * fails before the executeEnhancedCompetition fix.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf, attachCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

describe('SENTINEL: competition placement → competition_stat_gain Notification', () => {
  let user;
  let horse;
  let show;
  let token;
  let csrf;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `comp_notif_${Date.now()}@test.com`,
        username: `comp_notif_${Date.now()}`,
        password: 'irrelevant',
        firstName: 'Comp',
        lastName: 'Notif',
        money: 100000,
      },
    });

    horse = await prisma.horse.create({
      data: {
        name: `TestFixture-CompNotifHorse-${Date.now()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2019-01-01'),
        age: 6,
        userId: user.id,
        // rider is required by hasValidRider() in enterAndRunShow, but we use
        // /enter + /execute which uses validateCompetitionEntry instead
      },
    });

    show = await prisma.show.create({
      data: {
        name: `TestFixture-CompNotifShow-${Date.now()}`,
        discipline: 'Dressage',
        runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        prize: 5000,
        entryFee: 0,
        levelMin: 0,
        levelMax: 100,
        status: 'open',
        hostUserId: user.id,
      },
    });

    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    csrf = await fetchCsrf(app);
  }, 30000);

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.competitionResult.deleteMany({ where: { showId: show.id } }).catch(() => {});
    await prisma.show.delete({ where: { id: show.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }, 30000);

  it('creates a competition_stat_gain Notification row when a stat boost fires', async () => {
    let boostFound = false;

    for (let i = 0; i < 50; i++) {
      // Enter the horse
      const enterRes = await attachCsrf(
        request(app)
          .post('/api/competition/enter')
          .send({ horseId: horse.id, showId: show.id })
          .set('Authorization', `Bearer ${token}`)
          .set('Origin', ORIGIN),
        csrf,
      );

      if (enterRes.status !== 201) {
        // Delete any stale result and retry
        await prisma.competitionResult.deleteMany({ where: { horseId: horse.id, showId: show.id } });
        continue;
      }

      // Execute the competition (user is host)
      const execRes = await attachCsrf(
        request(app)
          .post('/api/competition/execute')
          .send({ showId: show.id })
          .set('Authorization', `Bearer ${token}`)
          .set('Origin', ORIGIN),
        csrf,
      );

      if (execRes.status !== 200) {
        await prisma.competitionResult.deleteMany({ where: { horseId: horse.id, showId: show.id } });
        continue;
      }

      const rows = await prisma.notification.findMany({
        where: { userId: user.id, type: 'competition_stat_gain' },
      });

      if (rows.length > 0) {
        boostFound = true;
        expect(rows[0].payload).toHaveProperty('horseName');
        expect(rows[0].payload).toHaveProperty('stat');
        expect(rows[0].payload).toHaveProperty('amount');
        expect(rows[0].payload).toHaveProperty('placement');
        break;
      }

      // Reset: delete result so horse can re-enter
      await prisma.competitionResult.deleteMany({ where: { horseId: horse.id, showId: show.id } });
    }

    expect(boostFound).toBe(true);
  }, 300000);
});
