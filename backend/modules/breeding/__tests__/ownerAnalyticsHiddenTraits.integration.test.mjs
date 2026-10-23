/**
 * The owner-only genetics analytics never use or name an unrevealed hidden
 * trait (Equoria-3867b).
 *
 * Owner ruling (Stacey, 2026-10-16/19, S-Q9): an UNREVEALED hidden trait stays
 * hidden from everyone, the horse's owner included; only revealed traits are
 * public. studPredictionAccess.integration.test.mjs proves that for the five
 * pair endpoints the breeding page calls. These three owner-only endpoints
 * compute over the caller's own horses and were the part of 3867b still
 * unproven at the real-DB level:
 *
 *   POST /breeding/breeding-recommendations
 *   POST /genetics/optimal-breeding
 *   GET  /genetics/population-health/:userId
 *
 * Leak-proof method, as in the pair test: (1) no unrevealed trait NAME appears
 * anywhere in the response JSON; (2) nothing can be INFERRED — the response is
 * identical, value for value, to the one after every hidden list is emptied.
 * Each case also asserts a 200 so an error body cannot pass by accident, and
 * asserts the revealed trait still counts (the test is not vacuous).
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { sharedBreed, makePlayer, makeHorse, sendJson } from './helpers/studBookingFixtures.mjs';

const PREFIX = 'TestFixture-3867b-owner';
const SECRETS = ['t3867bStallionSecret', 't3867bMareSecret', 't3867bThirdSecret', 't3867bSharedSecret'];

// Every horse also carries one revealed and one hidden trait in COMMON, so the
// population analytics (which name a trait only when most of the herd shares
// it) have something to name: the guard must let the revealed one through and
// keep the hidden one out.
const mods = (revealed, secret) => ({
  positive: [revealed, 't3867bSharedRevealed'],
  negative: [],
  hidden: [secret, 't3867bSharedSecret'],
});

/** Drop values that legitimately change between two identical calls. */
function stable(body) {
  return JSON.parse(
    JSON.stringify(body, (key, value) =>
      ['timestamp', 'generatedAt', 'analyzedAt', 'calculatedAt', 'createdAt', 'updatedAt'].includes(key)
        ? undefined
        : value,
    ),
  );
}

describe('owner-only genetics analytics: unrevealed hidden traits stay out (Equoria-3867b)', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let stallion;
  let mare;
  let third;

  const endpoints = () => ({
    breedingRecommendations: () =>
      sendJson('post', '/api/v1/breeding/breeding-recommendations', owner.token, {
        stallionId: stallion.id,
        mareId: mare.id,
      }),
    optimalBreeding: () =>
      sendJson('post', '/api/v1/genetics/optimal-breeding', owner.token, {
        horseIds: [stallion.id, mare.id, third.id],
      }),
    populationHealth: () => sendJson('get', `/api/v1/genetics/population-health/${owner.user.id}`, owner.token),
  });

  async function clearAllHidden() {
    for (const h of [stallion, mare, third]) {
      const row = await prisma.horse.findUnique({ where: { id: h.id }, select: { epigeneticModifiers: true } });
      await prisma.horse.update({
        where: { id: h.id },
        data: { epigeneticModifiers: { ...row.epigeneticModifiers, hidden: [] } },
      });
    }
  }

  beforeEach(async () => {
    const breed = await sharedBreed();
    owner = await makePlayer(PREFIX, 'owner', 1000);
    const userId = owner.user.id;
    const make = spec => makeHorse(PREFIX, { ownerId: userId, breedId: breed.id, ...spec });
    stallion = await make({ sex: 'Stallion', epigeneticModifiers: mods('t3867bStallionRevealed', SECRETS[0]) });
    mare = await make({ sex: 'Mare', epigeneticModifiers: mods('t3867bMareRevealed', SECRETS[1]) });
    third = await make({ sex: 'Mare', epigeneticModifiers: mods('t3867bThirdRevealed', SECRETS[2]) });
    const ids = [stallion.id, mare.id, third.id];
    cleanup.add(
      () => prisma.horse.updateMany({ where: { id: { in: ids } }, data: { sireId: null, damId: null } }),
      'lineage',
    );
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'user');
  });

  afterEach(async () => {
    await cleanup.run();
  });

  it.each(['breedingRecommendations', 'optimalBreeding', 'populationHealth'])(
    '%s: no unrevealed trait name in the response, and the response equals the one with every hidden list emptied',
    async name => {
      const withHidden = await endpoints()[name]();
      expect(withHidden.status).toBe(200);
      const text = JSON.stringify(withHidden.body);
      for (const secret of SECRETS) {
        expect(text).not.toContain(secret);
      }

      await clearAllHidden();
      const withoutHidden = await endpoints()[name]();

      expect(withoutHidden.status).toBe(200);
      expect(stable(withHidden.body)).toEqual(stable(withoutHidden.body));
    },
  );

  it('population health still names the REVEALED trait the herd shares, and not the hidden one (the comparison above is not vacuous)', async () => {
    const res = await endpoints().populationHealth();

    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).toContain('t3867bSharedRevealed');
    expect(text).not.toContain('t3867bSharedSecret');
  });
});
