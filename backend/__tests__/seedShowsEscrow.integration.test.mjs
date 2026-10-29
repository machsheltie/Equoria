/**
 * The dev show seed funds its prizes like a hosted show (Equoria-law5w follow-up).
 *
 * The defect: seed/seedShows.mjs wrote shows with a random prize and no escrow.
 * Since a show pays prizes only from escrow (owner ruling q52), every seeded show
 * would settle paying nothing, so the seed no longer modelled real shows. A
 * hosted show's prize is 10x its entry fee (owner ruling 2026-10-23), held in
 * Show.prizeEscrow and credited to SystemAccount[showEscrow] together.
 *
 * Real DB; the seed's own createShow; scoped fixtures released fail-loud.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { createShow } from '../seed/seedShows.mjs';
import { createEscrowedDevShow } from '../seed/seedDevData.mjs';
import { releaseShowEscrow } from './helpers/releaseShowEscrow.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const showIds = [];

afterAll(async () => {
  const cleanup = createCleanupTracker();
  cleanup.add(() => releaseShowEscrow(showIds), 'releaseShowEscrow');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'show');
  await cleanup.run();
}, 30000);

async function escrowBalance() {
  const row = await prisma.systemAccount.findUnique({
    where: { name: 'showEscrow' },
    select: { balance: true },
  });
  return Number(row.balance);
}

describe('seedShows createShow escrows the prize (Equoria-law5w)', () => {
  it('stores prize = 10x the entry fee, held in escrow, whatever prize the data carries', async () => {
    const before = await escrowBalance();
    const show = await createShow({
      name: `TestFixture-seedEscrow-${randomBytes(4).toString('hex')}`,
      discipline: 'Dressage',
      levelMin: 1,
      levelMax: 3,
      entryFee: 120,
      prize: 777,
      runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    expect(show).not.toBeNull();
    showIds.push(show.id);

    const stored = await prisma.show.findUnique({
      where: { id: show.id },
      select: { prize: true, prizeEscrow: true, feeEscrow: true },
    });
    expect(stored).toEqual({ prize: 1200, prizeEscrow: 1200, feeEscrow: 0 });
    // The escrow account was credited by exactly the prize, in the same transaction.
    expect((await escrowBalance()) - before).toBe(1200);
  });
});

describe('seedDevData createEscrowedDevShow escrows the prize (Equoria-law5w)', () => {
  it('stores prize = 10x the entry fee, held in escrow, and credits the escrow account by it', async () => {
    const before = await escrowBalance();
    const show = await createEscrowedDevShow({
      name: `TestFixture-devSeedEscrow-${randomBytes(4).toString('hex')}`,
      discipline: 'Reining',
      levelMin: 1,
      levelMax: 5,
      entryFee: 150,
      runDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
    showIds.push(show.id);
    expect({ prize: show.prize, prizeEscrow: show.prizeEscrow, feeEscrow: show.feeEscrow }).toEqual({
      prize: 1500,
      prizeEscrow: 1500,
      feeEscrow: 0,
    });
    expect(show.closeDate).toEqual(show.runDate);
    expect((await escrowBalance()) - before).toBe(1500);
  });
});
