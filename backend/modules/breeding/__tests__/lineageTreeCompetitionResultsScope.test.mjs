/**
 * Lineage tree — competition results arrive in one batched read, not through an
 * include on every horse row (Equoria-cmw85.15), and every horse's show records
 * are in the tree (owner ruling 2026-10-19, decision 14).
 *
 * generateLineageTree() once loaded `competitionResults: true` (no select, no
 * limit) with the root horses, every ancestor and every generation row.
 * Equoria-cmw85.15 scoped the read to the VIEWER's own horses because
 * toPredictionView() then blanked every other player's records (design §0,
 * Equoria-q4uem.9 slice 4b). OLD CONTRACT: other players' records were `[]`.
 * NEW RULING (Stacey, 2026-10-19, decision 14): show records are ALWAYS PUBLIC,
 * including other players' horses in breeding predictions, so the withholding
 * is gone and the records are loaded for every horse in the tree.
 *
 * Contract this pins: no horse read pulls results in through an include; the
 * results are read in batched `horseId in [...]` reads (never one read per
 * horse); and every horse of the tree — the viewer's own and a foreign
 * ancestor alike — carries its records.
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

describe('generateLineageTree() competition results (Equoria-cmw85.15; public records, decision 14)', () => {
  it('reads every horse’s results in batched reads and the tree shows own and foreign records alike', async () => {
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
      tree = await generateLineageTree(stallion.id, mare.id, 3);
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
    // Results come from batched reads: a horse id list, several horses at once
    // somewhere in the tree, and the foreign ancestor's records are among them.
    expect(resultReads.length).toBeGreaterThanOrEqual(1);
    for (const read of resultReads) {
      expect(Array.isArray(read.where.horseId.in)).toBe(true);
    }
    const requested = resultReads.flatMap(read => read.where.horseId.in);
    expect(requested).toEqual(expect.arrayContaining([stallion.id, foreignSire.id]));

    // Response shape: the own horse and the foreign ancestor both keep their record.
    const stallionNode = tree.root.stallion;
    expect(stallionNode.competitionResults).toHaveLength(1);
    expect(stallionNode.competitionResults[0].showName).toBe(`${SCOPE}-own-result-${RUN}`);
    expect(tree.root.mare.competitionResults).toEqual([]);
    const foreignNode = findNode(stallionNode, foreignSire.id);
    expect(foreignNode.competitionResults).toHaveLength(1);
    expect(foreignNode.competitionResults[0].showName).toBe(`${SCOPE}-foreign-result-${RUN}`);
    for (const generation of tree.generations) {
      for (const horse of generation.horses) {
        expect(Array.isArray(horse.competitionResults)).toBe(true);
        expect(horse.competitionResults).toHaveLength(horse.id === mare.id ? 0 : 1);
      }
    }
  }, 60_000);
});
