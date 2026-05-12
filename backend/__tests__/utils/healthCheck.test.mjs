/**
 * healthCheck — unit + integration tests (Equoria-jkht)
 *
 * HealthCheck.checkMemoryUsage, getUptime, getSystemInfo are pure (no DB).
 * checkDatabase and performFullHealthCheck run against the real DB.
 * Handler tests use a minimal Express-style harness (no HTTP server needed).
 */

import { describe, it, expect } from '@jest/globals';
import { HealthCheck, healthCheckHandler, livenessHandler, readinessHandler } from '../../utils/healthCheck.mjs';

// ── Minimal Express harness ──────────────────────────────────────────────────
function makeReq() {
  return {};
}
function makeRes() {
  const res = {
    _status: null,
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

// ── HealthCheck.checkMemoryUsage ─────────────────────────────────────────────
describe('HealthCheck.checkMemoryUsage', () => {
  it('returns healthy or warning status with rss/heapUsed/heapTotal/external keys', async () => {
    const result = await HealthCheck.checkMemoryUsage();
    expect(['healthy', 'warning']).toContain(result.status);
    expect(['Memory usage normal', 'High memory usage detected']).toContain(result.message);
    expect(result.data).toHaveProperty('rss');
    expect(result.data).toHaveProperty('heapUsed');
    expect(result.data).toHaveProperty('heapTotal');
    expect(result.data).toHaveProperty('external');
    expect(result.data.rss).toMatch(/\d+MB/);
    expect(typeof result.timestamp).toBe('string');
  });

  it('data values are formatted as "<N>MB" strings', async () => {
    const result = await HealthCheck.checkMemoryUsage();
    for (const key of ['rss', 'heapUsed', 'heapTotal', 'external']) {
      expect(result.data[key]).toMatch(/^\d+MB$/);
    }
  });
});

// ── HealthCheck.getUptime ────────────────────────────────────────────────────
describe('HealthCheck.getUptime', () => {
  it('returns healthy status with uptime string and uptimeSeconds number', () => {
    const result = HealthCheck.getUptime();
    expect(result.status).toBe('healthy');
    expect(result.message).toBe('Server uptime');
    expect(typeof result.data.uptimeSeconds).toBe('number');
    expect(result.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    // Format: "Xd Xh Xm Xs"
    expect(result.data.uptime).toMatch(/^\d+d \d+h \d+m \d+s$/);
    expect(typeof result.timestamp).toBe('string');
  });

  it('uptimeSeconds is a finite integer', () => {
    const result = HealthCheck.getUptime();
    expect(Number.isFinite(result.data.uptimeSeconds)).toBe(true);
    expect(Number.isInteger(result.data.uptimeSeconds)).toBe(true);
  });
});

// ── HealthCheck.getSystemInfo ────────────────────────────────────────────────
describe('HealthCheck.getSystemInfo', () => {
  it('returns healthy status with node/platform/arch/environment/pid', async () => {
    const result = await HealthCheck.getSystemInfo();
    expect(result.status).toBe('healthy');
    expect(result.message).toBe('System information');
    expect(result.data.nodeVersion).toBe(process.version);
    expect(result.data.platform).toBe(process.platform);
    expect(result.data.arch).toBe(process.arch);
    expect(result.data.environment).toBe(process.env.NODE_ENV || 'development');
    expect(result.data.pid).toBe(process.pid);
    expect(typeof result.timestamp).toBe('string');
  });
});

// ── HealthCheck.checkDatabase ────────────────────────────────────────────────
describe('HealthCheck.checkDatabase', () => {
  it('returns healthy status against the real DB', async () => {
    const result = await HealthCheck.checkDatabase();
    expect(result.status).toBe('healthy');
    expect(result.message).toBe('Database connection successful');
    expect(typeof result.timestamp).toBe('string');
  });
});

// ── HealthCheck.performFullHealthCheck ──────────────────────────────────────
describe('HealthCheck.performFullHealthCheck', () => {
  it('returns overall healthy status with all four check keys', async () => {
    const result = await HealthCheck.performFullHealthCheck();
    expect(['healthy', 'warning', 'unhealthy']).toContain(result.status);
    expect(result.checks).toHaveProperty('database');
    expect(result.checks).toHaveProperty('memory');
    expect(result.checks).toHaveProperty('uptime');
    expect(result.checks).toHaveProperty('system');
    expect(typeof result.timestamp).toBe('string');
  });

  it('database check result inside full check is healthy', async () => {
    const result = await HealthCheck.performFullHealthCheck();
    expect(result.checks.database.status).toBe('healthy');
  });
});

// ── livenessHandler ──────────────────────────────────────────────────────────
describe('livenessHandler', () => {
  it('responds 200 with status alive', async () => {
    const res = makeRes();
    livenessHandler(makeReq(), res);
    expect(res._status).toBe(200);
    expect(res._body.status).toBe('alive');
    expect(res._body.message).toBe('Server is running');
    expect(typeof res._body.timestamp).toBe('string');
  });
});

// ── readinessHandler ─────────────────────────────────────────────────────────
describe('readinessHandler', () => {
  it('responds 200 with status ready when DB is healthy', async () => {
    const res = makeRes();
    await readinessHandler(makeReq(), res);
    expect(res._status).toBe(200);
    expect(res._body.status).toBe('ready');
    expect(res._body.message).toBe('Server is ready to accept requests');
  });
});

// ── healthCheckHandler ───────────────────────────────────────────────────────
describe('healthCheckHandler', () => {
  it('responds 200 with top-level status and checks object', async () => {
    const res = makeRes();
    await healthCheckHandler(makeReq(), res);
    expect(res._status).toBe(200);
    expect(['healthy', 'warning']).toContain(res._body.status);
    expect(res._body).toHaveProperty('checks');
  });
});
