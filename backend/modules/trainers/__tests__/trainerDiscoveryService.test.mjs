/**
 * trainerDiscoveryService — typed Prisma path coverage (Equoria-0tqa).
 *
 * Verifies that readDiscoverySlots / writeDiscoverySlots work against
 * the typed Trainer.discoverySlots Prisma field (replacing the prior $queryRaw
 * / $executeRaw fallback that bypassed Prisma typing).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  readDiscoverySlots,
  writeDiscoverySlots,
} from '../services/trainerDiscoveryService.mjs';

let trainer;

beforeAll(async () => {
  trainer = await prisma.trainer.create({
    data: {
      firstName: 'TestFixture-Discovery',
      lastName: `T-${randomBytes(4).toString('hex')}`,
      personality: 'focused',
      skillLevel: 'expert',
      speciality: 'Dressage',
      level: 1,
    },
  });
});

afterAll(async () => {
  if (trainer?.id) {
    await prisma.trainer.delete({ where: { id: trainer.id } });
  }
});

describe('trainerDiscoveryService — typed Prisma path', () => {
  it('readDiscoverySlots returns [] for a fresh trainer (default JSONB)', async () => {
    const slots = await readDiscoverySlots(trainer.id);
    expect(Array.isArray(slots)).toBe(true);
    expect(slots).toEqual([]);
  });

  it('writeDiscoverySlots persists an array via the typed Prisma client', async () => {
    const payload = [
      { category: 'Dressage', slot: 1, label: 'Collection Mastery' },
      { category: 'Show Jumping', slot: 2, label: 'Distance Eye' },
    ];
    await writeDiscoverySlots(trainer.id, payload);

    const roundtrip = await readDiscoverySlots(trainer.id);
    expect(roundtrip).toEqual(payload);
  });

  it('reading via prisma.trainer.findUnique exposes the typed field', async () => {
    // Sentinel: if the schema field were removed, this query would throw
    // (Unknown field `discoverySlots`). Locks in the schema-prisma contract.
    const row = await prisma.trainer.findUnique({
      where: { id: trainer.id },
      select: { discoverySlots: true },
    });
    expect(row).toBeTruthy();
    expect(Array.isArray(row.discoverySlots)).toBe(true);
  });
});
