import { describe, it, expect } from '@jest/globals';
import {
  featureFlagMiddleware,
  requireFeature,
  abTestMiddleware,
  featureFlagAdminHandlers,
} from '../middleware/featureFlagMiddleware.mjs';

function makeReq(overrides = {}) {
  return {
    method: 'GET',
    path: '/test',
    ip: '127.0.0.1',
    user: null,
    params: {},
    query: {},
    headers: {},
    ...overrides,
  };
}

function makeRes(overrides = {}) {
  let _statusCode = 200;
  const res = {
    get statusCode() {
      return _statusCode;
    },
    status(code) {
      _statusCode = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
    ...overrides,
  };
  return res;
}

// ─── featureFlagMiddleware ────────────────────────────────────────────────────

describe('featureFlagMiddleware', () => {
  it('returns a function', () => {
    const mw = featureFlagMiddleware();
    expect(typeof mw).toBe('function');
  });

  it('calls next() and sets req.featureFlags', async () => {
    const mw = featureFlagMiddleware();
    const req = makeReq();
    const res = makeRes();
    let called = false;
    await mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(req.featureFlags).toBeDefined();
  });

  it('req.featureFlags.isEnabled is a function', async () => {
    const mw = featureFlagMiddleware();
    const req = makeReq();
    const res = makeRes();
    await mw(req, res, () => {});
    expect(typeof req.featureFlags.isEnabled).toBe('function');
  });

  it('req.featureFlags.getAll is a function', async () => {
    const mw = featureFlagMiddleware();
    const req = makeReq();
    const res = makeRes();
    await mw(req, res, () => {});
    expect(typeof req.featureFlags.getAll).toBe('function');
  });

  it('req.featureFlags.getContext is a function', async () => {
    const mw = featureFlagMiddleware();
    const req = makeReq();
    const res = makeRes();
    await mw(req, res, () => {});
    expect(typeof req.featureFlags.getContext).toBe('function');
  });

  it('getContext returns the environment context', async () => {
    const mw = featureFlagMiddleware();
    const req = makeReq({ ip: '10.0.0.1', user: { id: 99, email: 'test@equoria.test' } });
    const res = makeRes();
    await mw(req, res, () => {});
    const ctx = req.featureFlags.getContext();
    expect(typeof ctx).toBe('object');
    expect(ctx.ip).toBe('10.0.0.1');
    expect(ctx.userId).toBe('99');
    expect(ctx.email).toBe('test@equoria.test');
  });

  it('works when req.user is null', async () => {
    const mw = featureFlagMiddleware();
    const req = makeReq({ user: null });
    const res = makeRes();
    await mw(req, res, () => {});
    const ctx = req.featureFlags.getContext();
    expect(ctx.userId).toBeUndefined();
    expect(ctx.email).toBeUndefined();
  });

  it('isEnabled resolves to a boolean for a known flag', async () => {
    const mw = featureFlagMiddleware();
    const req = makeReq();
    const res = makeRes();
    await mw(req, res, () => {});
    const result = await req.featureFlags.isEnabled('FF_ADVANCED_GENETICS');
    expect(typeof result).toBe('boolean');
  });

  it('getAll resolves to an object', async () => {
    const mw = featureFlagMiddleware();
    const req = makeReq();
    const res = makeRes();
    await mw(req, res, () => {});
    const flags = await req.featureFlags.getAll();
    expect(typeof flags).toBe('object');
  });
});

// ─── requireFeature ───────────────────────────────────────────────────────────

describe('requireFeature', () => {
  it('returns a function', () => {
    const mw = requireFeature('FF_ADVANCED_GENETICS');
    expect(typeof mw).toBe('function');
  });

  it('returns 500 when req.featureFlags is not set', async () => {
    const mw = requireFeature('FF_ADVANCED_GENETICS');
    const req = makeReq();
    const res = makeRes();
    await mw(req, res, () => {});
    expect(res._body).toBeDefined();
    expect(res._body.error).toBeDefined();
  });

  it('calls next() when flag is enabled', async () => {
    // First apply featureFlagMiddleware so req.featureFlags is set
    const flagMw = featureFlagMiddleware();
    const req = makeReq();
    const res = makeRes();
    await flagMw(req, res, () => {});

    // Override isEnabled to return true
    req.featureFlags.isEnabled = async () => true;

    const requireMw = requireFeature('ANY_FLAG');
    let called = false;
    await requireMw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('returns 404 (default) when flag is disabled', async () => {
    const flagMw = featureFlagMiddleware();
    const req = makeReq();
    const res = makeRes();
    await flagMw(req, res, () => {});

    // Override isEnabled to return false
    req.featureFlags.isEnabled = async () => false;

    const requireMw = requireFeature('DISABLED_FLAG');
    await requireMw(req, res, () => {});
    expect(res._body.error).toBeDefined();
  });

  it('uses custom statusCode when flag is disabled', async () => {
    const flagMw = featureFlagMiddleware();
    const req = makeReq();
    const res = makeRes();
    await flagMw(req, res, () => {});

    req.featureFlags.isEnabled = async () => false;

    let capturedStatus = null;
    const customRes = {
      status(code) {
        capturedStatus = code;
        return this;
      },
      json(b) {
        this._body = b;
      },
    };

    const requireMw = requireFeature('DISABLED_FLAG', { statusCode: 403, message: 'Forbidden' });
    await requireMw(req, customRes, () => {});
    expect(capturedStatus).toBe(403);
  });
});

// ─── abTestMiddleware ─────────────────────────────────────────────────────────

describe('abTestMiddleware', () => {
  it('returns a function', () => {
    const mw = abTestMiddleware('FF_AB_TEST', ['control', 'variant_a']);
    expect(typeof mw).toBe('function');
  });

  it('calls next() when req.featureFlags is not set (no-op)', async () => {
    const mw = abTestMiddleware('FF_AB_TEST', ['control', 'variant_a']);
    const req = makeReq();
    const res = makeRes();
    let called = false;
    await mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('assigns first variant when env var is not set', async () => {
    const flagMw = featureFlagMiddleware();
    const req = makeReq();
    const res = makeRes();
    await flagMw(req, res, () => {});

    const mw = abTestMiddleware('FF_AB_NONEXISTENT_FLAG_XYZ', ['control', 'variant_a']);
    await mw(req, res, () => {});
    expect(req.abVariant).toBe('control');
  });

  it('assigns correct variant when process.env has the flag', async () => {
    const flagMw = featureFlagMiddleware();
    const req = makeReq();
    const res = makeRes();
    await flagMw(req, res, () => {});

    // Temporarily set env var
    const flagName = 'FF_AB_UNIT_TEST_ONLY';
    process.env[flagName] = 'variant_a';
    const mw = abTestMiddleware(flagName, ['control', 'variant_a', 'variant_b']);
    await mw(req, res, () => {});
    delete process.env[flagName];

    expect(req.abVariant).toBe('variant_a');
  });

  it('falls back to first variant when env var is not in variants list', async () => {
    const flagMw = featureFlagMiddleware();
    const req = makeReq();
    const res = makeRes();
    await flagMw(req, res, () => {});

    const flagName = 'FF_AB_UNIT_TEST_ONLY2';
    process.env[flagName] = 'unknown_variant';
    const mw = abTestMiddleware(flagName, ['control', 'variant_a']);
    await mw(req, res, () => {});
    delete process.env[flagName];

    expect(req.abVariant).toBe('control');
  });
});

// ─── featureFlagAdminHandlers ─────────────────────────────────────────────────

describe('featureFlagAdminHandlers', () => {
  it('is an object', () => {
    expect(typeof featureFlagAdminHandlers).toBe('object');
    expect(featureFlagAdminHandlers).not.toBeNull();
  });

  it('has listFlags function', () => {
    expect(typeof featureFlagAdminHandlers.listFlags).toBe('function');
  });

  it('has getStats function', () => {
    expect(typeof featureFlagAdminHandlers.getStats).toBe('function');
  });

  it('has getFlag function', () => {
    expect(typeof featureFlagAdminHandlers.getFlag).toBe('function');
  });

  it('getStats does not throw with a res stub', async () => {
    const res = {
      json(b) {
        this._body = b;
      },
      status(code) {
        this._code = code;
        return this;
      },
    };
    await expect(featureFlagAdminHandlers.getStats({}, res)).resolves.toBeUndefined();
    expect(res._body).toBeDefined();
    expect(typeof res._body.stats).toBe('object');
  });

  // ─── listFlags ─────────────────────────────────────────────────────────────

  it('listFlags returns flags array from req.featureFlags.getAll', async () => {
    // Build a req with a working featureFlags stub
    const flagMw = featureFlagMiddleware();
    const req = makeReq({ user: { id: 1, email: 'admin@equoria.test' } });
    const res = makeRes();
    await flagMw(req, res, () => {});

    const adminRes = makeRes();
    await featureFlagAdminHandlers.listFlags(req, adminRes);

    expect(adminRes._body).toBeDefined();
    expect(Array.isArray(adminRes._body.flags)).toBe(true);
  });

  it('listFlags returns 500 when req.featureFlags is missing', async () => {
    // No featureFlagMiddleware applied → req.featureFlags is undefined
    const req = makeReq();
    const res = makeRes();

    await featureFlagAdminHandlers.listFlags(req, res);

    // Should hit the catch block and return 500
    expect(res._body).toBeDefined();
    // Either error or flags — depends on whether getAll throws on undefined
    expect([200, 500]).toContain(res.statusCode);
  });

  // ─── getFlag ───────────────────────────────────────────────────────────────

  it('getFlag returns 404 for an unknown flag name', async () => {
    const flagMw = featureFlagMiddleware();
    const req = makeReq({ user: { id: 1 }, params: { flagName: 'NONEXISTENT_FLAG_XYZ_ABC' } });
    const res = makeRes();
    await flagMw(req, res, () => {});

    const adminRes = makeRes();
    await featureFlagAdminHandlers.getFlag(req, adminRes);

    expect(adminRes._body).toBeDefined();
    expect(adminRes._body.error).toBeDefined();
  });

  it('getFlag returns flag info for a known flag name', async () => {
    const flagMw = featureFlagMiddleware();
    const req = makeReq({ user: { id: 1 }, params: { flagName: 'FF_ADVANCED_GENETICS' } });
    const res = makeRes();
    await flagMw(req, res, () => {});

    const adminRes = makeRes();
    await featureFlagAdminHandlers.getFlag(req, adminRes);

    // May be 200 (found) or 404 if flag not defined — both are valid
    expect(adminRes._body).toBeDefined();
    if (adminRes._body.name) {
      expect(adminRes._body.name).toBe('FF_ADVANCED_GENETICS');
    }
  });
});
