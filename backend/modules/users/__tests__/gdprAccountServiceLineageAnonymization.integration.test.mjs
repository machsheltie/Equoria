/**
 * gdprAccountServiceLineageAnonymization.integration.test.mjs
 *
 * Sentinel-positive test for Equoria-cugl9: GDPR right-to-erasure must
 * PRESERVE the breeding horse graph while removing user-identifying data
 * when a deleted user owns a breeding ANCESTOR of horses owned by OTHER
 * users.
 *
 * Pre-cugl9 behavior (the bug): eraseUserAccount() at lines 426-433 nulled
 * damId/sireId on EVERY horse pointing at the deleted user's horses, then
 * deleted the user's horses. For a multi-generation lineage where another
 * user's horse descends from the deleted user's ancestor, this DESTROYED
 * the descendant's lineage (damId/sireId NULL'd) — collateral damage to a
 * horse the deleted user never owned.
 *
 * Post-cugl9 behavior (the fix):
 *   1. A deleted user's horse that has at least one offspring owned by a
 *      DIFFERENT, surviving user is ANONYMIZED, not destroyed:
 *        - userId -> null (detached from the deleted user)
 *        - name   -> generic "Anonymized Horse #<id>" (PII scrub)
 *        - forSale/salePrice/studStatus/studFee reset (commercial attribution)
 *      The row SURVIVES so the descendant's damId/sireId stay intact.
 *   2. A deleted user's horse with NO surviving external descendant is
 *      hard-deleted as before (full erasure, no graph value to preserve).
 *   3. Descendants owned by OTHER users keep their lineage pointers intact
 *      (damId/sireId still reference the now-anonymized ancestor).
 *   4. Descendants owned by the DELETED user themselves are deleted in the
 *      same transaction (so their parent need not be preserved for them).
 *
 * Real DB, no mocks, id-scoped cleanup.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { eraseUserAccount } from '../services/gdprAccountService.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const FIXTURE_PREFIX = 'TestFixture-cugl9';

const createdUserIds = [];
const createdHorseIds = [];

async function makeUser(suffix) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const u = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${suffix}-${tag}`,
      email: `${FIXTURE_PREFIX}-${suffix}-${tag}@example.com`,
      password: pw,
      firstName: 'Cugl9',
      lastName: suffix,
    },
  });
  createdUserIds.push(u.id);
  return u;
}

async function makeHorse(ownerId, extra = {}) {
  const h = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${randomBytes(4).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-06-15'),
      age: 7,
      userId: ownerId,
      healthStatus: 'Good',
      speed: 60,
      stamina: 60,
      agility: 60,
      balance: 60,
      precision: 60,
      boldness: 60,
      ...extra,
    },
  });
  createdHorseIds.push(h.id);
  return h;
}

afterAll(async () => {
  // Break any surviving lineage pointers among our fixtures first so the
  // RESTRICT FKs don't block the scoped horse delete (Equoria-v58ta).
  if (createdHorseIds.length) {
    await prisma.horse
      .updateMany({
        where: { id: { in: createdHorseIds } },
        data: { sireId: null, damId: null },
      })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.horse
      .deleteMany({ where: { id: { in: createdHorseIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdUserIds.length) {
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  await prisma.$disconnect().catch(err => console.warn(`[cleanup] ${err.message}`));
}, 120000);

describe('INTEGRATION: GDPR lineage anonymization (Equoria-cugl9)', () => {
  it('anonymizes (does not destroy) a deleted user ancestor that has an offspring owned by another user, preserving the descendant lineage', async () => {
    // deletedOwner owns the sire AND the dam (the ancestors).
    // survivor owns the foal, which descends from both ancestors.
    const deletedOwner = await makeUser('owner');
    const survivor = await makeUser('survivor');

    const sire = await makeHorse(deletedOwner.id, {
      sex: 'Stallion',
      forSale: true,
      salePrice: 5000,
      studStatus: 'At Public Stud',
      studFee: 1200,
    });
    const dam = await makeHorse(deletedOwner.id, { sex: 'Mare' });

    // The survivor's foal descends from the deleted owner's sire + dam.
    const foal = await makeHorse(survivor.id, {
      sex: 'Colt',
      sireId: sire.id,
      damId: dam.id,
    });

    const result = await eraseUserAccount(deletedOwner.id);
    expect(result.deleted).toBe(true);

    // The deleted owner is gone.
    expect(await prisma.user.findUnique({ where: { id: deletedOwner.id } })).toBeNull();

    // The ancestors SURVIVE (not destroyed) because the foal descends from them.
    const sireAfter = await prisma.horse.findUnique({ where: { id: sire.id } });
    const damAfter = await prisma.horse.findUnique({ where: { id: dam.id } });
    expect(sireAfter).not.toBeNull();
    expect(damAfter).not.toBeNull();

    // ...but they are ANONYMIZED: detached from the deleted user + PII scrubbed.
    expect(sireAfter.userId).toBeNull();
    expect(damAfter.userId).toBeNull();
    expect(sireAfter.name).not.toContain(FIXTURE_PREFIX);
    expect(sireAfter.name).toMatch(/^Anonymized Horse #\d+$/);
    expect(damAfter.name).toMatch(/^Anonymized Horse #\d+$/);
    // Commercial attribution cleared on the anonymized sire.
    expect(sireAfter.forSale).toBe(false);
    expect(sireAfter.salePrice).toBe(0);
    expect(sireAfter.studStatus).toBe('Not at Stud');
    expect(sireAfter.studFee).toBe(0);

    // The survivor and their foal are untouched, and the foal STILL points
    // at the (now-anonymized) ancestors — lineage preserved.
    expect(await prisma.user.findUnique({ where: { id: survivor.id } })).not.toBeNull();
    const foalAfter = await prisma.horse.findUnique({ where: { id: foal.id } });
    expect(foalAfter).not.toBeNull();
    expect(foalAfter.userId).toBe(survivor.id);
    expect(foalAfter.sireId).toBe(sire.id);
    expect(foalAfter.damId).toBe(dam.id);
  }, 120000);

  it('hard-deletes a deleted user horse that has no surviving external descendant', async () => {
    const deletedOwner = await makeUser('owner2');

    // A childless horse owned by the deleted user — no graph value to keep.
    const childless = await makeHorse(deletedOwner.id);

    const result = await eraseUserAccount(deletedOwner.id);
    expect(result.deleted).toBe(true);

    // Fully erased.
    expect(await prisma.horse.findUnique({ where: { id: childless.id } })).toBeNull();
  }, 120000);

  it('deletes a descendant owned by the SAME deleted user (its ancestor need not be preserved for it)', async () => {
    // deletedOwner owns BOTH the ancestor and the descendant. Since the
    // descendant is being deleted too, the ancestor has no surviving
    // external offspring and is hard-deleted as well.
    const deletedOwner = await makeUser('owner3');

    const ancestor = await makeHorse(deletedOwner.id, { sex: 'Stallion' });
    const ownDescendant = await makeHorse(deletedOwner.id, {
      sex: 'Colt',
      sireId: ancestor.id,
    });

    const result = await eraseUserAccount(deletedOwner.id);
    expect(result.deleted).toBe(true);

    // Both gone — no external survivor depends on the ancestor.
    expect(await prisma.horse.findUnique({ where: { id: ancestor.id } })).toBeNull();
    expect(await prisma.horse.findUnique({ where: { id: ownDescendant.id } })).toBeNull();
  }, 120000);

  it('preserves a MULTI-GENERATION ancestry: grandparent + parent both owned by the deleted user are kept when a third-party foal descends from them transitively', async () => {
    // deletedOwner owns grandSire (A) AND parentSire (B), where B.sireId = A.
    // survivor owns foal (C), where C.sireId = B. The whole A<-B<-C chain must
    // survive (A and B anonymized) so C's lineage walks all the way up.
    const deletedOwner = await makeUser('owner_gen');
    const survivor = await makeUser('survivor_gen');

    const grandSire = await makeHorse(deletedOwner.id, { sex: 'Stallion' });
    const parentSire = await makeHorse(deletedOwner.id, {
      sex: 'Stallion',
      sireId: grandSire.id,
    });
    const foal = await makeHorse(survivor.id, {
      sex: 'Colt',
      sireId: parentSire.id,
    });

    const result = await eraseUserAccount(deletedOwner.id);
    expect(result.deleted).toBe(true);

    // Both ancestors survive and are anonymized.
    const grandAfter = await prisma.horse.findUnique({ where: { id: grandSire.id } });
    const parentAfter = await prisma.horse.findUnique({ where: { id: parentSire.id } });
    expect(grandAfter).not.toBeNull();
    expect(parentAfter).not.toBeNull();
    expect(grandAfter.userId).toBeNull();
    expect(parentAfter.userId).toBeNull();

    // The deeper lineage edge survives: parentSire STILL points at grandSire.
    expect(parentAfter.sireId).toBe(grandSire.id);

    // The foal's edge to its parent survives.
    const foalAfter = await prisma.horse.findUnique({ where: { id: foal.id } });
    expect(foalAfter.sireId).toBe(parentSire.id);
  }, 120000);

  it('anonymizes only the ancestor with external offspring; deletes the deleted user other childless horses in the same erasure', async () => {
    // Mixed case: deleted user owns an ancestor (kept+anonymized) AND a
    // separate childless horse (deleted). Proves the partition is per-horse.
    const deletedOwner = await makeUser('owner4');
    const survivor = await makeUser('survivor4');

    const keptAncestor = await makeHorse(deletedOwner.id, { sex: 'Mare' });
    const deletedChildless = await makeHorse(deletedOwner.id, { sex: 'Mare' });
    const survivorFoal = await makeHorse(survivor.id, {
      sex: 'Colt',
      damId: keptAncestor.id,
    });

    const result = await eraseUserAccount(deletedOwner.id);
    expect(result.deleted).toBe(true);

    // Ancestor with external offspring is kept + anonymized.
    const keptAfter = await prisma.horse.findUnique({ where: { id: keptAncestor.id } });
    expect(keptAfter).not.toBeNull();
    expect(keptAfter.userId).toBeNull();

    // The childless horse is gone.
    expect(await prisma.horse.findUnique({ where: { id: deletedChildless.id } })).toBeNull();

    // Survivor's foal keeps its dam pointer.
    const foalAfter = await prisma.horse.findUnique({ where: { id: survivorFoal.id } });
    expect(foalAfter.damId).toBe(keptAncestor.id);
  }, 120000);
});
