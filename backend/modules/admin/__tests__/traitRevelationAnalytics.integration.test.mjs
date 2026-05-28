/**
 * Admin trait-revelation analytics endpoint — real-DB integration (Equoria-yznve).
 *
 * GET /api/v1/admin/traits/analytics aggregates TraitHistoryLog into operator
 * revelation stats: counts by traitName, by definitional category
 * (positive/negative/rare/unknown), by UTC calendar day, plus a grand total.
 *
 * This suite proves (no mocks — real Express app, real DB, real JWT):
 *   (a) the aggregate reflects PLANTED TraitHistoryLog rows exactly
 *       (per-trait, per-category, per-day, total) — sentinel-positive;
 *   (b) the endpoint is ADMIN-ONLY (non-admin → 403) — auth-scoping sentinel;
 *   (c) date-range filtering narrows the result to the in-window rows;
 *   (d) the empty case (a window with no rows) returns zeroed aggregates.
 *
 * Data is planted directly into TraitHistoryLog for horses owned by TWO
 * different users; the admin report is GLOBAL (cross-horse, cross-user) per the
 * issue AC — so seeing both users' rows is correct behavior, while a non-admin
 * is rejected outright. Cleanup is SCOPED to collected horse/user ids; deleting
 * a horse cascade-deletes its TraitHistoryLog rows (onDelete: Cascade), so the
 * planted history is removed with the horses.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';

const ROUTE = '/api/v1/admin/traits/analytics';

// A sourceType unique to this suite so the date-window assertions can scope to
// ONLY this suite's planted rows and never see unrelated real-DB drift.
const SUITE_SOURCE = `TestFixture-yznve-${randomBytes(8).toString('hex')}`;

// Fixed UTC days so the byDate buckets are deterministic.
const DAY_1 = '2024-01-10';
const DAY_2 = '2024-01-12';

const createdHorseIds = [];
const createdUserIds = [];

async function makeUser(label) {
  const uid = `${label}_${randomBytes(8).toString('hex')}`;
  const user = await prisma.user.create({
    data: {
      username: `TestFixture-yznve-${uid}`,
      email: `testfixture_yznve_${uid}@example.com`,
      password: 'x'.repeat(60), // not used (token is signed directly)
      firstName: 'Test',
      lastName: 'Fixture',
    },
  });
  createdUserIds.push(user.id);
  return user;
}

async function makeHorse(userId, name) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-yznve-${name}-${randomBytes(6).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2023-01-01T00:00:00.000Z'),
      user: { connect: { id: userId } },
    },
  });
  createdHorseIds.push(horse.id);
  return horse;
}

async function plantTrait(horseId, traitName, dayKey) {
  await prisma.traitHistoryLog.create({
    data: {
      horseId,
      traitName,
      sourceType: SUITE_SOURCE,
      isEpigenetic: true,
      ageInDays: 5,
      timestamp: new Date(`${dayKey}T12:00:00.000Z`),
    },
  });
}

describe('Admin trait-revelation analytics (Equoria-yznve)', () => {
  let adminToken;
  let nonAdminToken;

  beforeAll(async () => {
    const adminUser = await makeUser('admin');
    adminToken = generateTestToken({ id: adminUser.id, role: 'admin' });

    const plainUser = await makeUser('user');
    nonAdminToken = generateTestToken({ id: plainUser.id, role: 'user' });

    // Two owners → proves the admin report aggregates across users (global).
    const ownerA = await makeUser('ownerA');
    const ownerB = await makeUser('ownerB');
    const horseA = await makeHorse(ownerA.id, 'horseA');
    const horseB = await makeHorse(ownerB.id, 'horseB');

    // Plant a known distribution, scoped by SUITE_SOURCE:
    //   intelligent (positive) × 2  → DAY_1, DAY_2
    //   bold        (positive) × 1  → DAY_1
    //   nervous     (negative) × 2  → DAY_1 (ownerA), DAY_2 (ownerB)
    //   legendaryBloodline (rare) × 1 → DAY_2
    // Totals: 6 rows; positive 3, negative 2, rare 1, unknown 0.
    //   DAY_1: intelligent, bold, nervous            → 3
    //   DAY_2: intelligent, nervous, legendaryBloodline → 3
    await plantTrait(horseA.id, 'intelligent', DAY_1);
    await plantTrait(horseA.id, 'intelligent', DAY_2);
    await plantTrait(horseA.id, 'bold', DAY_1);
    await plantTrait(horseA.id, 'nervous', DAY_1);
    await plantTrait(horseB.id, 'nervous', DAY_2);
    await plantTrait(horseB.id, 'legendaryBloodline', DAY_2);
  }, 120000);

  afterAll(async () => {
    // Scoped cleanup — never a bare deleteMany. Deleting horses cascade-deletes
    // their TraitHistoryLog rows; users are deleted by collected id.
    if (createdHorseIds.length > 0) {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }, 60000);

  it('rejects a non-admin user with 403 (auth-scoping sentinel)', async () => {
    const res = await request(app).get(ROUTE).set('Authorization', `Bearer ${nonAdminToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get(ROUTE);
    expect(res.status).toBe(401);
  });

  it('aggregates planted rows exactly (sentinel-positive), scoped by sourceType', async () => {
    const res = await request(app)
      .get(ROUTE)
      .query({ sourceType: SUITE_SOURCE })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { data } = res.body;

    // Total reflects exactly the 6 planted rows for this suite's sourceType.
    expect(data.total).toBe(6);

    // By traitName
    expect(data.byTraitName.intelligent).toBe(2);
    expect(data.byTraitName.bold).toBe(1);
    expect(data.byTraitName.nervous).toBe(2);
    expect(data.byTraitName.legendaryBloodline).toBe(1);

    // By definitional category (intelligent+bold=positive, nervous=negative,
    // legendaryBloodline=rare). Hidden runtime flag is not persisted — category
    // is by trait definition (documented data-reality limitation).
    expect(data.byCategory.positive).toBe(3);
    expect(data.byCategory.negative).toBe(2);
    expect(data.byCategory.rare).toBe(1);
    expect(data.byCategory.unknown).toBe(0);

    // Category counts reconcile to the total.
    const catSum =
      data.byCategory.positive +
      data.byCategory.negative +
      data.byCategory.rare +
      data.byCategory.unknown;
    expect(catSum).toBe(data.total);

    // Over-time buckets (UTC calendar day) — the data DOES support time-series.
    expect(data.byDate[DAY_1]).toBe(3);
    expect(data.byDate[DAY_2]).toBe(3);

    // sourceType echoed back.
    expect(data.sourceType).toBe(SUITE_SOURCE);
  });

  it('date-range filter narrows to in-window rows', async () => {
    // Window covering only DAY_1.
    const res = await request(app)
      .get(ROUTE)
      .query({
        sourceType: SUITE_SOURCE,
        startDate: '2024-01-10T00:00:00.000Z',
        endDate: '2024-01-10T23:59:59.999Z',
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.total).toBe(3); // DAY_1 only: intelligent, bold, nervous
    expect(data.byTraitName.intelligent).toBe(1);
    expect(data.byTraitName.bold).toBe(1);
    expect(data.byTraitName.nervous).toBe(1);
    expect(data.byTraitName.legendaryBloodline).toBeUndefined();
    expect(data.byDate[DAY_1]).toBe(3);
    expect(data.byDate[DAY_2]).toBeUndefined();
  });

  it('empty window returns zeroed aggregates (empty case)', async () => {
    const res = await request(app)
      .get(ROUTE)
      .query({
        sourceType: SUITE_SOURCE,
        startDate: '2000-01-01T00:00:00.000Z',
        endDate: '2000-01-02T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.total).toBe(0);
    expect(data.byTraitName).toEqual({});
    expect(data.byCategory).toEqual({ positive: 0, negative: 0, rare: 0, unknown: 0 });
    expect(data.byDate).toEqual({});
  });

  it('rejects an unparseable startDate with 400', async () => {
    const res = await request(app)
      .get(ROUTE)
      .query({ startDate: 'not-a-date' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});
