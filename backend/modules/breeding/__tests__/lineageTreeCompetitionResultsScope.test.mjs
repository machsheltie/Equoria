/**
 * Lineage tree — competition results are not dragged in with every horse row
 * (Equoria-cmw85.15).
 *
 * generateLineageTree() loaded `competitionResults: true` (no select, no limit)
 * with the root horses, every ancestor and every generation row — then
 * toPredictionView() blanked the records of every horse the viewer does not own
 * (design §0, Equoria-q4uem.9 slice 4b). The records of an established ancestor
 * were read from the results table only to be thrown away.
 *
 * Contract this pins (response shape unchanged — studPredictionAccess keeps the
 * privacy rule): the viewer's OWN horses still carry their results in the tree;
 * everyone else's are `[]`; and the only competition_results read is scoped to
 * horses the viewer owns, never an include on a horse row.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { generateLineageTree } from '../services/lineageTree.mjs';

const SCOPE = 'TestFixture-LineageResults';
const RUN = randomBytes(6).toString('hex');

const cleanup = createCleanupTracker();
const userIds = [];
const horseIds = [];
let viewer;
let other;
let stallion;
let mare;
let foreignSire;
let showId;

async function makeUser(tag) {
  const user = await prisma.user.create({
    data: {
      email: `lineageres-${tag}-${RUN}@test.com`,
      username: `lineageres${tag}${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Lineage',
      lastName: 'Results',
      money: 0,
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeHorse(key, owner, sex, sireId = null, damId = null) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${SCOPE}-${key}-${RUN}`,
      sex,
      dateOfBirth: new Date('2018-01-01'),
      age: 5,
      userId: owner.id,
      sireId,
      damId,
    },
  });
  horseIds.push(horse.id);
  return horse;
}

async function addResult(horseId, showName) {
  await prisma.competitionResult.create({
    data: {
      horseId,
      showId,
      showName,
      discipline: 'Racing',
      placement: 1,
      prizeWon: 0,
      score: 80,
      runDate: new Date(),
    },
  });
}

beforeAll(async () => {
  viewer = await makeUser('v');
  other = await makeUser('o');

  foreignSire = await makeHorse('foreignSire', other, 'Stallion');
  stallion = await makeHorse('stallion', viewer, 'Stallion', foreignSire.id, null);
  mare = await makeHorse('mare', viewer, 'Mare');

  const show = await prisma.show.create({
    data: {
      name: `${SCOPE}-show-${RUN}`,
      discipline: 'Racing',
      levelMin: 1,
      levelMax: 20,
      entryFee: 0,
      prize: 100,
      runDate: new Date(Date.now() - 86400000),
    },
  });
  showId = show.id;
  // @@unique([showId, horseId]): one result per horse in the one show.
  await addResult(stallion.id, `${SCOPE}-own-result-${RUN}`);
  await addResult(foreignSire.id, `${SCOPE}-foreign-result-${RUN}`);

  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId } }), 'results');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: showId } }), 'show');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

function findNode(node, id) {
  if (!node) {
    return null;
  }
  return node.id === id ? node : (findNode(node.sire, id) ?? findNode(node.dam, id));
}

describe('generateLineageTree() competition results (Equoria-cmw85.15)', () => {
  it('reads results only for the viewer’s own horses and leaves the tree unchanged', async () => {
    const horseReads = [];
    const resultReads = [];
    const originals = {
      findUnique: prisma.horse.findUnique,
      findMany: prisma.horse.findMany,
      results: prisma.competitionResult.findMany,
    };
    prisma.horse.findUnique = (...args) => {
      horseReads.push(args[0]);
      return originals.findUnique.apply(prisma.horse, args);
    };
    prisma.horse.findMany = (...args) => {
      horseReads.push(args[0]);
      return originals.findMany.apply(prisma.horse, args);
    };
    prisma.competitionResult.findMany = (...args) => {
      resultReads.push(args[0]);
      return originals.results.apply(prisma.competitionResult, args);
    };

    let tree;
    try {
      tree = await generateLineageTree(stallion.id, mare.id, 3, { viewerId: viewer.id });
    } finally {
      prisma.horse.findUnique = originals.findUnique;
      prisma.horse.findMany = originals.findMany;
      prisma.competitionResult.findMany = originals.results;
    }

    // No horse read pulls results in through an include.
    expect(horseReads.length).toBeGreaterThanOrEqual(2);
    for (const read of horseReads) {
      expect(read?.include?.competitionResults).toBeUndefined();
    }
    // The only results reads are scoped to horses the viewer owns.
    expect(resultReads.length).toBeGreaterThanOrEqual(1);
    for (const read of resultReads) {
      const scoped = read.where.horseId.in;
      expect(scoped).not.toContain(foreignSire.id);
      expect(scoped.every(id => [stallion.id, mare.id].includes(id))).toBe(true);
    }

    // Response shape: own horse keeps its record, others are [].
    const stallionNode = tree.root.stallion;
    expect(stallionNode.competitionResults).toHaveLength(1);
    expect(stallionNode.competitionResults[0].showName).toBe(`${SCOPE}-own-result-${RUN}`);
    expect(tree.root.mare.competitionResults).toEqual([]);
    expect(findNode(stallionNode, foreignSire.id).competitionResults).toEqual([]);
    for (const generation of tree.generations) {
      for (const horse of generation.horses) {
        expect(Array.isArray(horse.competitionResults)).toBe(true);
        expect(horse.competitionResults).toHaveLength(horse.id === stallion.id ? 1 : 0);
      }
    }
    expect(JSON.stringify(tree)).not.toContain(`${SCOPE}-foreign-result-${RUN}`);
  }, 60_000);
});
