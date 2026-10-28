/**
 * createHorse / getHorseById contract (Equoria-q4uem.7 S2, real DB).
 *
 * createHorse is the one horse-insert command; getHorseById the one by-id read.
 * Pinned here:
 *   - every accepted breed / owner / stable input shape persists the same
 *     relations, whatever the horse is called (the production code once had
 *     'Test Horse' and 'Full Horse' name branches that wrote scalar FKs beside
 *     relation connects, which Prisma rejects);
 *   - createHorse(data, tx) enlists in the caller's transaction (a rollback
 *     leaves no row);
 *   - neither function loads the owner's user row (it carries the password
 *     hash and MFA secret, and no caller reads it).
 * Imports go through the horses barrel, whose exported names are the contract.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createHorse, getHorseById } from '../index.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const TOKEN = randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
let owner;
let breed;
let stable;

function base(name) {
  return { ...fixtureColor(), name, age: 4, sex: 'Mare', dateOfBirth: '2020-04-01T00:00:00.000Z' };
}

async function persisted(id) {
  return prisma.horse.findUnique({
    where: { id },
    select: { breedId: true, userId: true, stableId: true },
  });
}

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `hc-${TOKEN}@test.com`,
      username: `hc${TOKEN}`,
      password: 'irrelevant-hash',
      firstName: 'Horse',
      lastName: 'Creation',
      money: 0,
    },
  });
  breed = await prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: 'Shared test breed' },
  });
  stable = await prisma.stable.create({ data: { name: `HC Stable ${TOKEN}` } });
  // Horses before user and stable for the FK ordering.
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: owner.id } }), 'horses');
  // Ownerless horses are found through the test's own stable.
  cleanup.add(() => prisma.horse.deleteMany({ where: { stableId: stable.id } }), 'ownerless horses');
  cleanup.add(() => prisma.stable.delete({ where: { id: stable.id } }), 'stable');
  cleanup.add(() => prisma.user.delete({ where: { id: owner.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('createHorse input shapes persist the same relations for any name', () => {
  const shapes = [
    ['breedId + ownerId + stableId', () => ({ breedId: breed.id, ownerId: owner.id, stableId: stable.id })],
    [
      'breed.connect + userId + stableId',
      () => ({ breed: { connect: { id: breed.id } }, userId: owner.id, stableId: stable.id }),
    ],
    ['breed as a number + ownerId + stableId', () => ({ breed: breed.id, ownerId: owner.id, stableId: stable.id })],
    [
      'breed.connect + stableId, no owner',
      () => ({ breed: { connect: { id: breed.id } }, stableId: stable.id }),
      () => null,
    ],
  ];
  const names = ['Ordinary', 'Test Horse', 'Full Horse'];

  for (const [label, shape, expectedOwner = () => owner.id] of shapes) {
    for (const name of names) {
      it(`${label}, named '${name}'`, async () => {
        const horse = await createHorse({ ...base(name), ...shape() });
        expect(await persisted(horse.id)).toEqual({
          breedId: breed.id,
          userId: expectedOwner(),
          stableId: stable.id,
        });
      });
    }
  }

  it('still refuses a horse with no breed', async () => {
    await expect(createHorse({ ...base(`NoBreed ${TOKEN}`), ownerId: owner.id })).rejects.toMatchObject({
      message: expect.stringContaining('Either breedId or breed connection is required'),
    });
  });
});

describe('createHorse on a transaction client', () => {
  it('rolls back with the caller transaction', async () => {
    const name = `Rollback ${TOKEN}`;
    await expect(
      prisma.$transaction(async tx => {
        await createHorse({ ...base(name), breedId: breed.id, ownerId: owner.id }, tx);
        throw new Error('caller aborts');
      }),
    ).rejects.toMatchObject({ message: 'caller aborts' });
    expect(await prisma.horse.count({ where: { name, userId: owner.id } })).toBe(0);
  });
});

describe('the owner user row is never loaded', () => {
  it('createHorse returns breed and stable but no user', async () => {
    const horse = await createHorse({
      ...base(`NoUser ${TOKEN}`),
      breedId: breed.id,
      ownerId: owner.id,
      stableId: stable.id,
    });
    expect(horse.breed.id).toBe(breed.id);
    expect(horse.stable.id).toBe(stable.id);
    expect(horse.userId).toBe(owner.id);
    expect(horse).not.toHaveProperty('user');
  });

  it('getHorseById returns breed and stable but no user', async () => {
    const created = await createHorse({
      ...base(`ById ${TOKEN}`),
      breedId: breed.id,
      ownerId: owner.id,
      stableId: stable.id,
    });
    const horse = await getHorseById(created.id);
    expect(horse.id).toBe(created.id);
    expect(horse.breed.id).toBe(breed.id);
    expect(horse.stable.id).toBe(stable.id);
    expect(horse.userId).toBe(owner.id);
    expect(horse).not.toHaveProperty('user');
  });
});
