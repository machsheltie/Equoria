/**
 * horseUpdateParentageHijack — integration tests (Equoria-hg62v)
 *
 * Sentinel coverage for the parentage-hijack vulnerability on PUT /horses/:id:
 *   horseRoutes.mjs:159-167 update allowlist includes sireId and damId. Without
 *   an ownership check on the new parent IDs, a malicious owner of HorseA can
 *   PUT /horses/A with { sireId: <victim-stallion-id> } and silently rewrite
 *   genealogy of their own horse to point at another player's horse. Corrupts
 *   pedigree, legacy-score, breeding-data, and lineage-analysis endpoints.
 *
 * AC #2 (sentinel): user A attempts PUT with user B's horse as sireId → 404,
 * not 200. AC #1: validate via findOwnedResource. AC #3 dam parallel covered.
 *
 * UPDATED owner ruling 2026-09-30, Equoria-bvddn.2:
 * OLD contract: cross-user / missing parents were refused 404 by an ownership
 * check while an owned sireId was accepted (200). NEW contract: sireId and damId
 * can NEVER be edited (pedigree is fixed by breeding), so the allow-list is empty
 * and EVERY sireId/damId PUT is refused 400 with the genealogy untouched. The
 * hijack is now closed more strictly: no parent id of any kind is accepted.
 *
 * Real-DB integration. No mocks (per CLAUDE.md §3, "Tests exist to detect
 * real failures"). Cleanup is scoped by id.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import { createMockToken } from '../../../__tests__/factories/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

describe('PUT /horses/:id — parentage hijack guard (Equoria-hg62v)', () => {
  let __csrf__;
  let userA;
  let userB;
  let tokenA;
  let horseA; // userA's own horse (target of update)
  let horseAOriginalSire; // userA-owned stallion — a legitimate sire reassignment
  let victimSire; // userB-owned stallion — must NOT be assignable as horseA's sire
  let victimDam; // userB-owned mare — must NOT be assignable as horseA's dam
  const createdHorseIds = [];
  const createdUserIds = [];

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';

    const suffix = randomBytes(6).toString('hex');

    userA = await prisma.user.create({
      data: {
        email: `hg62v-A-${suffix}@test.invalid`,
        username: `hg62v-A-${suffix}`,
        password: 'hashed',
        firstName: 'HijackA',
        lastName: 'Test',
        emailVerified: true,
      },
    });
    userB = await prisma.user.create({
      data: {
        email: `hg62v-B-${suffix}@test.invalid`,
        username: `hg62v-B-${suffix}`,
        password: 'hashed',
        firstName: 'HijackB',
        lastName: 'Test',
        emailVerified: true,
      },
    });
    createdUserIds.push(userA.id, userB.id);

    tokenA = createMockToken(userA.id, {
      payload: { email: userA.email, role: userA.role || 'user' },
    });

    // Per-user CSRF binding (Equoria-plw0h): the PUT /horses/:id mutations
    // authenticate via tokenA, so their sessionIdentifier resolves to userA.id.
    // Issue the CSRF token under the same identifier (pass the access cookie) so
    // the legitimate owner PUTs (200 cases) pass doubleCsrf instead of 403ing.
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${tokenA}`] });

    const dob = new Date();
    dob.setUTCFullYear(dob.getUTCFullYear() - 5);

    horseA = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-hg62v-A-${suffix}`,
        userId: userA.id,
        sex: 'Mare',
        dateOfBirth: dob,
      },
    });
    horseAOriginalSire = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-hg62v-A-sire-${suffix}`,
        userId: userA.id,
        sex: 'Stallion',
        dateOfBirth: dob,
      },
    });
    victimSire = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-hg62v-victim-sire-${suffix}`,
        userId: userB.id,
        sex: 'Stallion',
        dateOfBirth: dob,
      },
    });
    victimDam = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-hg62v-victim-dam-${suffix}`,
        userId: userB.id,
        sex: 'Mare',
        dateOfBirth: dob,
      },
    });
    createdHorseIds.push(horseA.id, horseAOriginalSire.id, victimSire.id, victimDam.id);
  }, 120000);

  afterAll(async () => {
    if (createdHorseIds.length > 0) {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }, 120000);

  it('rejects PUT with cross-user sireId — 400, no genealogy mutation (sentinel-positive)', async () => {
    // Sentinel: this is the exact failure mode hg62v describes. Before the
    // fix this returned 200 and the row's sireId became victimSire.id.
    const response = await request(app)
      .put(`/api/v1/horses/${horseA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ sireId: victimSire.id });

    expect(response.status).toBe(400); // OLD: 404 (owner ruling 2026-09-30, Equoria-bvddn.2)
    expect(response.body.success).toBe(false);

    // Genealogy must NOT have been touched.
    const after = await prisma.horse.findUnique({
      where: { id: horseA.id },
      select: { sireId: true, damId: true },
    });
    expect(after.sireId).toBeNull();
    expect(after.damId).toBeNull();
  });

  it('rejects PUT with cross-user damId — 400, no genealogy mutation', async () => {
    const response = await request(app)
      .put(`/api/v1/horses/${horseA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ damId: victimDam.id });

    expect(response.status).toBe(400); // OLD: 404 (owner ruling 2026-09-30, Equoria-bvddn.2)
    expect(response.body.success).toBe(false);

    const after = await prisma.horse.findUnique({
      where: { id: horseA.id },
      select: { sireId: true, damId: true },
    });
    expect(after.sireId).toBeNull();
    expect(after.damId).toBeNull();
  });

  it('rejects PUT with cross-user sireId+damId combo — 400', async () => {
    const response = await request(app)
      .put(`/api/v1/horses/${horseA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ sireId: victimSire.id, damId: victimDam.id });

    expect(response.status).toBe(400); // OLD: 404 (owner ruling 2026-09-30, Equoria-bvddn.2)
    const after = await prisma.horse.findUnique({
      where: { id: horseA.id },
      select: { sireId: true, damId: true },
    });
    expect(after.sireId).toBeNull();
    expect(after.damId).toBeNull();
  });

  it('rejects PUT with non-existent sireId — 400', async () => {
    // Same 404 as cross-user case to prevent enumeration disclosure.
    const response = await request(app)
      .put(`/api/v1/horses/${horseA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ sireId: 2_147_483_640 }); // far above any real id

    expect(response.status).toBe(400); // OLD: 404 (owner ruling 2026-09-30, Equoria-bvddn.2)
  });

  it('refuses PUT with own-owned sireId — 400, sireId unchanged', async () => {
    // OLD CONTRACT: the owner could reassign a sire to their own stallion (200,
    // persisted). NEW RULING (owner ruling 2026-09-30, Equoria-bvddn.2): pedigree is fixed by
    // breeding; even the owner's own horse is refused and nothing changes.
    const response = await request(app)
      .put(`/api/v1/horses/${horseA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ sireId: horseAOriginalSire.id });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    const after = await prisma.horse.findUnique({
      where: { id: horseA.id },
      select: { sireId: true },
    });
    expect(after.sireId).toBeNull();
  });

  it('no longer allows PUT with non-genealogy fields (sex) — Equoria-bvddn.2', async () => {
    // OLD CONTRACT: `name` (pre-Equoria-4fnro), then `sex` (Equoria-4fnro) was
    // "a non-genealogy field PUT still permits", asserted here as a 200. NEW
    // RULING (Equoria-bvddn.2, audit finding 2026-09-25): `sex`, `gender` and
    // `dateOfBirth` are off the allow-list too — sireId/damId were the
    // ONLY fields PUT accepted (since removed too, owner ruling 2026-09-30, Equoria-bvddn.2). This case now proves the opposite: `sex` is
    // rejected and nothing is mutated. Full sentinel coverage for this class
    // of finding lives in horseUpdateSexDobMassAssign.sentinel.test.mjs.
    const before = await prisma.horse.findUnique({
      where: { id: horseA.id },
      select: { name: true, sex: true },
    });

    const response = await request(app)
      .put(`/api/v1/horses/${horseA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ sex: 'mare' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    const after = await prisma.horse.findUnique({
      where: { id: horseA.id },
      select: { name: true, sex: true },
    });
    expect(after.sex).toBe(before.sex);
    expect(after.name).toBe(before.name);
  });
});
