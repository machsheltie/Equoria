/**
 * 🧪 INTEGRATION TEST: /progress Game-Statistics fields (Equoria-oey96.2)
 *
 * Audit finding [P1-1] — docs/audits/2026-07-02-spec-vs-code-audit.md:
 * ProfilePage "Game Statistics" cards (Horses Owned / Competitions Won /
 * Breeding Count / Win Rate) always rendered 0 because the /progress endpoint
 * never returned totalHorses / totalCompetitions / winRate / breedingCount —
 * the frontend read fields the backend didn't send, so they resolved
 * undefined → 0 (Constitution §2: "Unknown/0 values masquerading as real
 * data").
 *
 * This is the failing-first sentinel: it seeds a user with 2 owned horses
 * (one a bred foal with both parents, one plain), 2 competition results
 * (one 1st-place win, one 4th), then asserts GET /api/v1/users/:id/progress
 * returns the four real values. BEFORE the fix the four fields are undefined
 * and every assertion below fails.
 *
 * 🔄 REAL-DB (no mocks). Scoped, FK-ordered id-based cleanup in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, createTestShow } from '../../../tests/helpers/testAuth.mjs';

describe('🎯 INTEGRATION: /progress returns real Game-Statistics fields (Equoria-oey96.2)', () => {
  let user;
  let token;
  let sireId;
  let damId;
  let foalId;
  let plainId;
  const createdShowIds = [];
  const createdResultIds = [];
  const createdUserIds = [];

  beforeAll(async () => {
    const uid = `${Date.now()}_${process.pid}`;

    const created = await createTestUser({
      username: `TestFixture_prog_${uid}`.slice(0, 30),
      email: `testfixture_prog_${uid}@example.com`,
    });
    user = created.user;
    token = created.token;
    createdUserIds.push(user.id);

    // Two UNOWNED parent horses (userId null) — they satisfy the sire/dam FK on
    // the foal but do NOT count toward the user's totalHorses. This lets
    // totalHorses stay exactly 2 (the two owned horses) while breedingCount can
    // still be a meaningful non-zero count.
    const sire = await createTestHorse({ name: `TestFixture-sire-${uid}`, sex: 'Stallion' });
    const dam = await createTestHorse({ name: `TestFixture-dam-${uid}`, sex: 'Mare' });
    sireId = sire.id;
    damId = dam.id;

    // Owned bred foal: has BOTH parents → counts toward breedingCount. The
    // test Prisma client persists lineage via the relation-connect syntax
    // (not scalar sireId/damId), mirroring createTestHorse's breed connect.
    const foal = await createTestHorse({
      name: `TestFixture-foal-${uid}`,
      sex: 'Colt',
      userId: user.id,
      sire: { connect: { id: sire.id } },
      dam: { connect: { id: dam.id } },
    });
    foalId = foal.id;

    // Owned plain horse: no parents → does NOT count toward breedingCount.
    const plain = await createTestHorse({ name: `TestFixture-plain-${uid}`, userId: user.id });
    plainId = plain.id;

    // Two distinct shows (UNIQUE(showId, horseId) forbids two results for the
    // same horse in one show). Both results are on the plain horse.
    const show1 = await createTestShow({ name: `TestFixture-progshow1-${uid}` });
    const show2 = await createTestShow({ name: `TestFixture-progshow2-${uid}` });
    createdShowIds.push(show1.id, show2.id);

    const r1 = await prisma.competitionResult.create({
      data: {
        score: 95.5,
        placement: '1st', // a win
        discipline: 'Racing',
        runDate: new Date(Date.now() - 86400000),
        showName: show1.name,
        horseId: plain.id,
        showId: show1.id,
        prizeWon: 500,
      },
    });
    const r2 = await prisma.competitionResult.create({
      data: {
        score: 61,
        placement: '4th', // not a win
        discipline: 'Racing',
        runDate: new Date(Date.now() - 2 * 86400000),
        showName: show2.name,
        horseId: plain.id,
        showId: show2.id,
        prizeWon: 0,
      },
    });
    createdResultIds.push(r1.id, r2.id);
  }, 120000);

  afterAll(async () => {
    // FK-ordered, id-scoped cleanup. Delete results first, then the child
    // horses (foal + plain) BEFORE the parent horses (sire/dam) — the foal's
    // sireId/damId FKs are onDelete: Restrict (v58ta), so parents cannot be
    // removed while the foal still references them.
    if (createdResultIds.length) {
      await prisma.competitionResult.deleteMany({ where: { id: { in: createdResultIds } } });
    }
    await prisma.horse.deleteMany({ where: { id: { in: [foalId, plainId].filter(Boolean) } } });
    await prisma.horse.deleteMany({ where: { id: { in: [sireId, damId].filter(Boolean) } } });
    if (createdShowIds.length) {
      await prisma.show.deleteMany({ where: { id: { in: createdShowIds } } });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }, 120000);

  it('returns totalHorses, totalCompetitions, winRate, and breedingCount as real values', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${user.id}/progress`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const { data } = res.body;

    // AC2: non-zero totalHorses and totalCompetitions for a seeded user.
    expect(data.totalHorses).toBe(2); // foal + plain (parents are unowned)
    expect(data.totalCompetitions).toBe(2); // two seeded results

    // winRate matches getUserCompetitionStats semantics: wins / entries * 100
    // → 1 win of 2 entries = 50.
    expect(data.winRate).toBe(50);

    // breedingCount = owned horses with BOTH parents set → only the foal.
    expect(data.breedingCount).toBe(1);

    // Existing fields must remain intact (additive change).
    expect(data.userId).toBe(user.id);
    expect(typeof data.progressPercentage).toBe('number');
  });
});
