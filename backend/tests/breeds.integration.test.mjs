/**
 * Breeds API — createBreed duplicate-name semantics (Equoria-jv7ur)
 *
 * Real-DB integration tests (no mocks) against the public POST /api/v1/breeds
 * route via supertest + the real Express app.
 *
 * CONTRACT (Equoria-jv7ur fix): creating a breed whose name already exists is a
 * CLIENT validation error, not a server error. The controller throws a
 * ValidationError (HTTP 400) inside its try block; the catch block must forward
 * that AppError UNCHANGED rather than re-wrapping it as a 500 DatabaseError.
 *
 * We also assert the dedup INVARIANT: a duplicate request must NOT create a
 * second row (single-row invariant), regardless of status code.
 *
 * Fixtures use the `TestFixture-` prefix and id-scoped cleanup per CLAUDE.md §2.
 * No bare deleteMany().
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../app.mjs';
import prisma from '../db/index.mjs';

const UNIQUE = randomBytes(6).toString('hex');
const BREED_NAME = `TestFixture-breed-${UNIQUE}`;
const createdBreedIds = [];

afterAll(async () => {
  if (createdBreedIds.length > 0) {
    await prisma.breed.deleteMany({ where: { id: { in: createdBreedIds } } });
  }
  // Defensive scoped sweep in case a create succeeded without us capturing the id.
  await prisma.breed.deleteMany({ where: { name: { startsWith: `TestFixture-breed-${UNIQUE}` } } });
});

describe('POST /api/v1/breeds — createBreed (real DB)', () => {
  it('creates a new breed with 201 and persists exactly one row', async () => {
    const res = await request(app)
      .post('/api/v1/breeds')
      .set('Origin', 'http://localhost:3000')
      .send({ name: BREED_NAME, description: 'jv7ur fixture breed' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name: BREED_NAME });
    createdBreedIds.push(res.body.data.id);

    const rows = await prisma.breed.findMany({ where: { name: BREED_NAME } });
    expect(rows).toHaveLength(1);
  });

  it('returns a 4xx (NOT 500) on duplicate breed name', async () => {
    const res = await request(app)
      .post('/api/v1/breeds')
      .set('Origin', 'http://localhost:3000')
      .send({ name: BREED_NAME, description: 'duplicate attempt' });

    // SENTINEL (Equoria-jv7ur): the bug was a 500. A duplicate name is a client
    // validation error and must be reported as 4xx — specifically 400 from the
    // forwarded ValidationError (consistent with the in-try throw and the sibling
    // breed controllers that forward AppError/NotFoundError unchanged).
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('does NOT create a second row on duplicate (single-row invariant)', async () => {
    // After the duplicate attempt above, the breed must still exist exactly once.
    const rows = await prisma.breed.findMany({ where: { name: BREED_NAME } });
    expect(rows).toHaveLength(1);
  });

  it('rejects a case-insensitive duplicate with 400 (no second row)', async () => {
    const res = await request(app)
      .post('/api/v1/breeds')
      .set('Origin', 'http://localhost:3000')
      .send({ name: BREED_NAME.toUpperCase(), description: 'case-insensitive duplicate' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    const rows = await prisma.breed.findMany({
      where: { name: { equals: BREED_NAME, mode: 'insensitive' } },
    });
    expect(rows).toHaveLength(1);
  });
});
