/**
 * Validation refusals on the groom doors do not hand over the game's internal
 * value lists (Equoria-bdpvw; owner ruling 2026-10-23: players never see raw
 * code names, they hint at exploits).
 *
 * Defect: 'interactionType must be one of: <every stored interaction code>' and
 * the three hire-field equivalents spelled every valid stored value into the
 * response body, visible in the network tab to anyone who sent a bad value.
 *
 * Real DB, real HTTP, real auth, real CSRF. One scoped user, removed fail-loud.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { GROOM_CONFIG } from '../../../config/groomConfig.mjs';
import {
  GROOM_PERSONALITY_VALUES,
  GROOM_SKILL_LEVEL_VALUES,
  GROOM_SPECIALTY_VALUES,
} from '../../../constants/schema.mjs';

const ORIGIN = 'http://localhost:3000';

describe('groom validation refusals carry no value lists (Equoria-bdpvw)', () => {
  const cleanup = createCleanupTracker();
  let user;
  let token;
  let csrf;

  beforeAll(async () => {
    const suffix = `bdpvw-${randomBytes(5).toString('hex')}`;
    user = await prisma.user.create({
      data: {
        email: `${suffix}@test.com`,
        username: suffix,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Test',
        lastName: 'Lists',
        money: 5000,
      },
    });
    cleanup.add(() => prisma.user.delete({ where: { id: user?.id } }), 'user');
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
  }, 60000);

  afterAll(async () => {
    await cleanup.run();
  });

  const post = path =>
    request(app)
      .post(path)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('X-CSRF-Token', csrf.csrfToken)
      .set('Cookie', csrf.cookieHeader);

  it('a bad interactionType is refused without listing the valid interaction codes', async () => {
    const res = await post('/api/v1/grooms/interact').send({
      foalId: 1,
      groomId: 1,
      interactionType: 'not-a-real-interaction',
      duration: 30,
    });

    expect(res.status).toBe(400);
    const body = JSON.stringify(res.body);
    expect(body).toMatch(/interactionType/);
    expect(body).not.toMatch(/must be one of/i);
    expect(body).not.toContain(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS.join(', '));
  });

  it('bad hire fields are refused without listing the valid specialities, skill levels or personalities', async () => {
    const res = await post('/api/v1/grooms/hire').send({
      name: 'Nobody',
      speciality: 'not-a-speciality',
      skill_level: 'not-a-skill',
      personality: 'not-a-personality',
    });

    expect(res.status).toBe(400);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/must be one of/i);
    expect(body).not.toContain(GROOM_SPECIALTY_VALUES.join(', '));
    expect(body).not.toContain(GROOM_SKILL_LEVEL_VALUES.join(', '));
    expect(body).not.toContain(GROOM_PERSONALITY_VALUES.join(', '));
  });
});
