import { describe, it, expect } from '@jest/globals';
import _request from 'supertest';
// import app from '../../../app.mjs';
import app from '../../../app_debug.mjs';
import _prisma from '../../../../packages/database/prismaClient.mjs';

describe('Rate Limit Enforcement Integration Tests', () => {
  it('should pass a dummy test with app', async () => {
    expect(app).toBeDefined();
  });
});
