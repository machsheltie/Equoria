/**
 * Equoria-v58ta — sentinel for horse FK Restrict semantics.
 *
 * Structural assertion: pg_constraint shows horses_userId_fkey,
 * horses_sireId_fkey, horses_damId_fkey are all ON DELETE RESTRICT.
 *
 * Sentinel-positive (OPTIMAL_FIX_DISCIPLINE §2):
 *   1. Deleting a User that owns a horse must FAIL with FK error;
 *      after deleting the horse, the user delete must succeed.
 *   2. Deleting a horse that is a sire/dam of another horse must FAIL.
 *
 * Cleanup is scoped by collected ids only; never bare deleteMany().
 */

import prisma from '../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from './helpers/createTestHorse.mjs';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

const PREFIX = 'TestFixture-v58ta';
const randHex = () => randomBytes(4).toString('hex');

describe('Equoria-v58ta — horse FK Restrict integrity', () => {
  const createdHorseIds = [];
  const createdUserIds = [];

  afterAll(async () => {
    // Clean horses first (FKs into User are Restrict — must remove before users)
    await cleanupTestHorses(prisma, createdHorseIds).catch(err => console.warn(`[cleanup] horses: ${err.message}`));
    if (createdUserIds.length > 0) {
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(err => console.warn(`[cleanup] users: ${err.message}`));
    }
    await prisma.$disconnect();
  });

  it('STRUCTURAL: horses_userId_fkey, sireId_fkey, damId_fkey are all ON DELETE RESTRICT', async () => {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT tc.constraint_name, rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.table_name = 'horses' AND tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.constraint_name;
    `);
    const byName = Object.fromEntries(rows.map(r => [r.constraint_name, r.delete_rule]));
    expect(byName.horses_userId_fkey).toBe('RESTRICT');
    expect(byName.horses_sireId_fkey).toBe('RESTRICT');
    expect(byName.horses_damId_fkey).toBe('RESTRICT');
  });

  it('SENTINEL: deleting a User that owns a horse fails with FK error; user delete succeeds after the horse is removed', async () => {
    const tag = randHex();
    const user = await prisma.user.create({
      data: {
        username: `${PREFIX}-owner-${tag}`,
        email: `${PREFIX}-owner-${tag}@test.local`,
        password: await bcrypt.hash('test-password-not-real', 4),
        firstName: 'Test',
        lastName: 'v58ta',
      },
    });
    createdUserIds.push(user.id);

    const horse = await createTestHorse(
      prisma,
      {
        name: `${PREFIX}-h-${tag}`,
        sex: 'Mare',
        dateOfBirth: new Date('2024-01-01'),
        userId: user.id,
      },
      createdHorseIds,
    );

    // Attempt to delete user while they own a horse — must reject (P2003)
    let caught = null;
    try {
      await prisma.user.delete({ where: { id: user.id } });
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    // Prisma surfaces FK violations as P2003 OR the underlying PG 23503 message
    const isFkError = caught?.code === 'P2003' || /foreign key|restrict|violates/i.test(caught?.message ?? '');
    expect(isFkError).toBe(true);

    // Confirm user still exists (delete was rejected, not partial)
    const stillThere = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stillThere).not.toBeNull();

    // Now remove the horse, then the user delete must succeed
    await prisma.horse.delete({ where: { id: horse.id } });
    // Remove the id from the collector so afterAll doesn't try to re-delete
    const idx = createdHorseIds.indexOf(horse.id);
    if (idx >= 0) createdHorseIds.splice(idx, 1);

    await prisma.user.delete({ where: { id: user.id } });
    const gone = await prisma.user.findUnique({ where: { id: user.id } });
    expect(gone).toBeNull();
    const userIdx = createdUserIds.indexOf(user.id);
    if (userIdx >= 0) createdUserIds.splice(userIdx, 1);
  });

  it('SENTINEL: deleting a horse that is a sire of another horse fails with FK error', async () => {
    const tag = randHex();
    const user = await prisma.user.create({
      data: {
        username: `${PREFIX}-sireown-${tag}`,
        email: `${PREFIX}-sireown-${tag}@test.local`,
        password: await bcrypt.hash('test-password-not-real', 4),
        firstName: 'Test',
        lastName: 'v58ta',
      },
    });
    createdUserIds.push(user.id);

    const sire = await createTestHorse(
      prisma,
      {
        name: `${PREFIX}-sire-${tag}`,
        sex: 'Stallion',
        dateOfBirth: new Date('2020-01-01'),
        userId: user.id,
      },
      createdHorseIds,
    );
    const foal = await createTestHorse(
      prisma,
      {
        name: `${PREFIX}-foal-${tag}`,
        sex: 'Filly',
        dateOfBirth: new Date('2024-01-01'),
        userId: user.id,
        sireId: sire.id,
      },
      createdHorseIds,
    );

    let caught = null;
    try {
      await prisma.horse.delete({ where: { id: sire.id } });
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    const isFkError = caught?.code === 'P2003' || /foreign key|restrict|violates/i.test(caught?.message ?? '');
    expect(isFkError).toBe(true);

    // Sire still present
    const stillThere = await prisma.horse.findUnique({ where: { id: sire.id } });
    expect(stillThere).not.toBeNull();

    // After foal is removed, sire deletion succeeds
    await prisma.horse.delete({ where: { id: foal.id } });
    const foalIdx = createdHorseIds.indexOf(foal.id);
    if (foalIdx >= 0) createdHorseIds.splice(foalIdx, 1);
    await prisma.horse.delete({ where: { id: sire.id } });
    const sireIdx = createdHorseIds.indexOf(sire.id);
    if (sireIdx >= 0) createdHorseIds.splice(sireIdx, 1);
  });
});
