/**
 * Sentinel test: foaling creates a foal_born Notification row.
 *
 * Calls createFoalFromPregnancy() directly (same code path as runFoalingJob)
 * and asserts that a foal_born Notification row is written to the DB.
 * The old code never touched the Notification table, so this test fails
 * before the foalingService fix.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createFoalFromPregnancy } from '../services/foalingService.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('SENTINEL: foal born → foal_born Notification', () => {
  let user;
  let sire;
  let dam;
  let foalId;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `foal_notif_${Date.now()}@test.com`,
        username: `foal_notif_${Date.now()}`,
        password: 'irrelevant',
        firstName: 'Foal',
        lastName: 'Notif',
      },
    });

    const breed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'sentinel test breed' },
    });

    const dob = new Date(Date.now() - 5 * 365 * DAY_MS);

    sire = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-FoalNotifSire-${Date.now()}`,
        sex: 'Stallion',
        dateOfBirth: dob,
        age: 5,
        breedId: breed.id,
        userId: user.id,
      },
    });

    dam = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-FoalNotifDam-${Date.now()}`,
        sex: 'Mare',
        dateOfBirth: dob,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
        pregnancySireId: sire.id,
        pregnancyFeedingsByTier: {},
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    if (foalId) {
      await prisma.horse.delete({ where: { id: foalId } }).catch(() => {});
    }
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'TestFixture-FoalNotif' }, userId: user.id },
    });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }, 30000);

  it('creates a foal_born Notification row when a foal is born', async () => {
    const result = await createFoalFromPregnancy({
      damId: dam.id,
      sireId: sire.id,
      options: { userId: user.id },
    });

    expect(result.foal).toBeDefined();
    foalId = result.foal.id;

    const rows = await prisma.notification.findMany({
      where: { userId: user.id, type: 'foal_born' },
    });

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].payload).toHaveProperty('foalName');
    expect(rows[0].payload).toHaveProperty('foalId');
    expect(rows[0].payload).toHaveProperty('damName');
    expect(rows[0].payload).toHaveProperty('sireName');
  }, 30000);
});
