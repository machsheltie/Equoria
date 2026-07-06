/**
 * buyStoreHorse — money+horse atomicity sentinel (Equoria-gumnp).
 *
 * Locks the fix for the P2 MONEY defect: the store-horse purchase used to debit
 * coins in one committed `$transaction` and then create the horse AFTER it,
 * opening two partial-failure windows —
 *   (1) horse created, a later step throws -> catch refunds AND the horse
 *       persists (free horse + refund);
 *   (2) process dies between debit-commit and createHorse -> charged, no horse,
 *       no refund.
 * The fix pulls `createHorse` (+ the unvetted-flag update) INSIDE the same
 * transaction as the debit and DELETES the compensating-refund saga, so the
 * charge and the horse commit-or-roll-back atomically.
 *
 * Two sentinels, both RED before the fix / GREEN after:
 *
 *   1. MECHANISM (real-DB, no mocks): the fix hinges on `createHorse` honoring
 *      an injected Prisma client. This test drives `createHorse(data, tx)`
 *      inside a `$transaction` the TEST owns, throws AFTER createHorse (the
 *      "boundary you own" from the issue's test spec), and asserts BOTH the
 *      horse row and the debit roll back. Before the fix, createHorse ignored
 *      the 2nd arg and wrote via the global `prisma` singleton — an
 *      auto-committed insert on a separate connection that survives the tx
 *      rollback (a leaked free horse). That surviving row is what turns this
 *      test RED before the signature change.
 *
 *   2. STRUCTURE (source-text): buyStoreHorse must call `createHorse(..., tx)`
 *      inside its `$transaction`, and the refund saga (`coinDeducted`, the
 *      `horse_trader_purchase_refund` reversal tx, the dead `err.nameCollision`
 *      branch) must be gone. The HTTP happy-path + money-conservation are
 *      already locked by buyStoreHorseSystemAccountPair.integration.test.mjs,
 *      which runs under the same `npm test -- marketplace` selector.
 *
 * Real-DB only. Cleanup is id-scoped to the fixtures this suite creates
 * (CLAUDE.md §3 / CONTRIBUTING fixture discipline).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createHorse } from '../../horses/index.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STORE_PRICE = 1000; // mirrors marketplaceController.STORE_PRICE

function uniqueEmail() {
  return `gumnp-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`;
}
function uniqueUsername() {
  return `gumnp${randomBytes(6).toString('hex')}`;
}

let realBreedId;

beforeAll(async () => {
  const statsPath = resolve(__dirname, '../../../data/breedStarterStats.json');
  const validBreedNames = Object.keys(JSON.parse(readFileSync(statsPath, 'utf8')));
  const breed = await prisma.breed.findFirst({
    where: { name: { in: validBreedNames } },
    select: { id: true },
  });
  realBreedId = breed?.id ?? null;
  // Fail LOUD, do not graceful-skip (Constitution §2): this suite asserts a
  // real-DB atomicity invariant that requires a seeded breed.
  if (!realBreedId) {
    throw new Error(
      'buyStoreHorseAtomicity requires a seeded breed in the test DB ' +
        '(run `npm run seed:breeds`); none found. Refusing to skip silently.',
    );
  }
}, 30000);

describe('buyStoreHorse — money+horse atomicity (Equoria-gumnp)', () => {
  let user;
  const createdHorseIds = [];
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    createdHorseIds.length = 0;
    user = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'GUMNP',
        lastName: 'Tester',
        money: 5000,
        settings: {},
      },
    });
    const userId = user.id;
    // Horses before user (store horses RESTRICT-block user deletion since v58ta).
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  // ─── MECHANISM SENTINEL (RED before the createHorse signature change) ───────

  it('createHorse enlists in the caller tx: a post-createHorse throw rolls back BOTH the horse and the charge', async () => {
    const before = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });

    let createdId = null;

    // The `$transaction` callback is the boundary this test owns. It debits the
    // wallet, creates the horse ON THE TX CLIENT, then throws AFTER createHorse.
    // If createHorse honors `tx`, the insert is part of this transaction and the
    // rollback removes it. If it ignores `tx` (pre-fix), the insert
    // auto-commits on the global connection and survives — a free horse.
    await expect(
      prisma.$transaction(async tx => {
        await tx.user.update({
          where: { id: user.id },
          data: { money: { decrement: STORE_PRICE } },
        });

        const horse = await createHorse(
          {
            ...fixtureColor(),
            name: `TestFixture-gumnp-${randomBytes(4).toString('hex')}`,
            breedId: realBreedId,
            sex: 'Mare',
            age: 3,
            dateOfBirth: new Date().toISOString(),
            userId: user.id,
            healthStatus: 'Excellent',
          },
          tx,
        );
        createdId = horse.id; // captured before the throw for rollback assertion + cleanup

        // Injected post-createHorse, in-tx failure (the issue's test spec).
        throw new Error('injected post-createHorse failure');
      }),
    ).rejects.toThrow('injected post-createHorse failure');

    // Track any id we saw so the RED run (where the horse leaks) cleans up.
    if (createdId !== null) {
      createdHorseIds.push(createdId);
    }

    // No free horse: the row created inside the aborted tx must not exist.
    const horseAfter = createdId !== null ? await prisma.horse.findUnique({ where: { id: createdId } }) : null;
    expect(horseAfter).toBeNull();

    // No orphan charge: the debit rolled back with the horse.
    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(Number(after.money)).toBe(Number(before.money));
  }, 60000);

  it('createHorse still works with the default client (single-arg call is unchanged)', async () => {
    // Backward-compatibility guard for the optional-client signature change:
    // foalingService.mjs calls createHorse(horseData) with one arg and must
    // keep committing on the global client.
    const horse = await createHorse({
      ...fixtureColor(),
      name: `TestFixture-gumnp-default-${randomBytes(4).toString('hex')}`,
      breedId: realBreedId,
      sex: 'Mare',
      age: 3,
      dateOfBirth: new Date().toISOString(),
      userId: user.id,
      healthStatus: 'Excellent',
    });
    createdHorseIds.push(horse.id);

    const persisted = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(persisted).not.toBeNull();
    expect(persisted.phenotype).not.toBeNull(); // colorGenotype/phenotype invariant
  }, 60000);

  // ─── STRUCTURE SENTINEL (RED before the controller restructure) ─────────────

  it('CODE SENTINEL: buyStoreHorse creates the horse inside the debit tx and has no refund saga', () => {
    const controllerPath = resolve(__dirname, '..', 'controllers', 'marketplaceController.mjs');
    const source = readFileSync(controllerPath, 'utf8');

    const start = source.indexOf('export async function buyStoreHorse');
    expect(start).toBeGreaterThan(-1);
    const after = source.slice(start + 1);
    const nextExportRel = after.indexOf('\nexport ');
    const body = nextExportRel === -1 ? after : after.slice(0, nextExportRel);

    // (1) createHorse must be called WITH the tx client — i.e. inside the tx,
    //     enlisting the insert in the debit transaction.
    expect(body).toMatch(/createHorse\(\s*\{[\s\S]*?\},\s*tx\b/);

    // (2) The compensating-refund saga must be gone. `coinDeducted`, the
    //     `horse_trader_purchase_refund` reversal, and the dead
    //     `err.nameCollision` branch were all part of the saga this fix removes.
    expect(body).not.toMatch(/coinDeducted/);
    expect(body).not.toMatch(/horse_trader_purchase_refund/);
    expect(body).not.toMatch(/err\.nameCollision/);

    // (3) Exactly one $transaction remains (the atomic debit+horse tx). The
    //     second one used to be the refund saga.
    const txCount = (body.match(/\$transaction\(/g) || []).length;
    expect(txCount).toBe(1);
  });
});
