import { describe, it, expect } from '@jest/globals';
import {
  handlePing,
  handleHealthCheck,
  handleRedisHealthCheck,
} from '../../../modules/health/controllers/pingController.mjs';

// ── Minimal Express harness ──────────────────────────────────────────────────
function makeReq(overrides = {}) {
  return { query: {}, ...overrides };
}

function makeRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  return res;
}

// ── handlePing ───────────────────────────────────────────────────────────────

describe('handlePing', () => {
  it('returns "pong" when no name param', () => {
    const res = makeRes();
    handlePing(makeReq(), res);
    expect(res._body.success).toBe(true);
    expect(res._body.message).toBe('pong');
    expect(typeof res._body.timestamp).toBe('string');
  });

  it('returns "pong, <name>!" when name query param is provided', () => {
    const res = makeRes();
    handlePing(makeReq({ query: { name: 'Equoria' } }), res);
    expect(res._body.message).toBe('pong, Equoria!');
    expect(res._body.success).toBe(true);
  });

  it('timestamp is a valid ISO string', () => {
    const res = makeRes();
    handlePing(makeReq(), res);
    expect(() => new Date(res._body.timestamp)).not.toThrow();
    expect(new Date(res._body.timestamp).toISOString()).toBe(res._body.timestamp);
  });
});

// ── handleHealthCheck ────────────────────────────────────────────────────────

describe('handleHealthCheck', () => {
  it('responds 200 with healthy status and services.database', async () => {
    const res = makeRes();
    await handleHealthCheck(makeReq(), res);
    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    expect(res._body.data).toHaveProperty('status');
    expect(res._body.data.services).toHaveProperty('database');
  });

  it('database service has healthy status', async () => {
    const res = makeRes();
    await handleHealthCheck(makeReq(), res);
    expect(res._body.data.services.database.status).toBe('healthy');
    expect(res._body.data.services.database.responseTime).toMatch(/^\d+ms$/);
  });

  it('redis service is present in response', async () => {
    const res = makeRes();
    await handleHealthCheck(makeReq(), res);
    expect(res._body.data.services).toHaveProperty('redis');
    expect(typeof res._body.data.services.redis.available).toBe('boolean');
  });

  it('overall status is either healthy or degraded (not unhealthy with real DB)', async () => {
    const res = makeRes();
    await handleHealthCheck(makeReq(), res);
    expect(['healthy', 'degraded']).toContain(res._body.data.status);
  });

  it('response includes uptime as a number', async () => {
    const res = makeRes();
    await handleHealthCheck(makeReq(), res);
    expect(typeof res._body.data.uptime).toBe('number');
  });
});

// ── handleRedisHealthCheck ───────────────────────────────────────────────────

describe('handleRedisHealthCheck', () => {
  it('responds with a status field and cache stats', async () => {
    const res = makeRes();
    await handleRedisHealthCheck(makeReq(), res);
    expect(res._body.data).toHaveProperty('status');
    expect(res._body.data).toHaveProperty('redis');
    expect(res._body.data).toHaveProperty('cache');
  });

  it('in test env Redis is unavailable → status is "unavailable", httpStatus 503', async () => {
    const res = makeRes();
    await handleRedisHealthCheck(makeReq(), res);
    // In test mode Redis is skipped, so status should be "unavailable"
    expect(res._body.data.status).toBe('unavailable');
    expect(res._status).toBe(503);
    expect(res._body.success).toBe(false);
  });

  it('cache stats shape: hits/misses/hitRate/errors/invalidations', async () => {
    const res = makeRes();
    await handleRedisHealthCheck(makeReq(), res);
    const cache = res._body.data.cache;
    expect(typeof cache.hits).toBe('number');
    expect(typeof cache.misses).toBe('number');
    expect(typeof cache.hitRate).toBe('string');
    expect(cache.hitRate).toMatch(/^\d+\.\d+%$/);
    expect(typeof cache.errors).toBe('number');
  });

  it('timestamp is present in response data', async () => {
    const res = makeRes();
    await handleRedisHealthCheck(makeReq(), res);
    expect(typeof res._body.data.timestamp).toBe('string');
  });
});
