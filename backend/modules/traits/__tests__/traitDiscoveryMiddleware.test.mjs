import { describe, it, expect } from '@jest/globals';
import {
  autoDiscoveryMiddleware,
  enrichmentDiscoveryMiddleware,
  trainingDiscoveryMiddleware,
  bondingDiscoveryMiddleware,
} from '../../../middleware/traitDiscoveryMiddleware.mjs';

function makeReq(overrides = {}) {
  return { params: {}, body: {}, path: '/test', route: null, ...overrides };
}

function makeRes() {
  const headers = {};
  return {
    statusCode: 200,
    _jsonCalled: false,
    _jsonArg: null,
    json(data) {
      this._jsonCalled = true;
      this._jsonArg = data;
      return this;
    },
    setHeader(k, v) {
      headers[k] = v;
    },
    _headers: headers,
  };
}

// ─── autoDiscoveryMiddleware ──────────────────────────────────────────────────

describe('autoDiscoveryMiddleware', () => {
  it('returns a function', () => {
    expect(typeof autoDiscoveryMiddleware()).toBe('function');
  });

  it('calls next() synchronously', async () => {
    const mw = autoDiscoveryMiddleware();
    let called = false;
    await mw(makeReq(), makeRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('accepts options without throwing', async () => {
    const mw = autoDiscoveryMiddleware({
      checkEnrichment: false,
      skipIfRecentlyChecked: false,
      recentCheckThreshold: 1000,
    });
    let called = false;
    await mw(makeReq(), makeRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('patches res.json with a new function', async () => {
    const mw = autoDiscoveryMiddleware();
    const res = makeRes();
    const originalJson = res.json;
    await mw(makeReq(), res, () => {});
    expect(res.json).not.toBe(originalJson);
    expect(typeof res.json).toBe('function');
  });

  it('patched res.json calls the original json and returns its result', async () => {
    const mw = autoDiscoveryMiddleware();
    const res = makeRes();
    await mw(makeReq(), res, () => {});
    res.json({ success: false, message: 'nope' });
    expect(res._jsonCalled).toBe(true);
    expect(res._jsonArg).toEqual({ success: false, message: 'nope' });
  });

  it('patched res.json works with success data and no horseId (no throw)', async () => {
    const mw = autoDiscoveryMiddleware();
    const res = makeRes();
    await mw(makeReq(), res, () => {});
    expect(() => res.json({ success: true, data: {} })).not.toThrow();
  });

  it('patched res.json works with success data containing horseId (no throw)', async () => {
    const mw = autoDiscoveryMiddleware();
    const res = makeRes();
    const req = makeReq({ params: { horseId: '42' } });
    await mw(req, res, () => {});
    expect(() => res.json({ success: true })).not.toThrow();
  });
});

// ─── enrichmentDiscoveryMiddleware ────────────────────────────────────────────

describe('enrichmentDiscoveryMiddleware', () => {
  it('returns a function', () => {
    expect(typeof enrichmentDiscoveryMiddleware()).toBe('function');
  });

  it('calls next()', async () => {
    const mw = enrichmentDiscoveryMiddleware();
    let called = false;
    await mw(makeReq(), makeRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('patches res.json', async () => {
    const mw = enrichmentDiscoveryMiddleware();
    const res = makeRes();
    const original = res.json;
    await mw(makeReq(), res, () => {});
    expect(res.json).not.toBe(original);
  });
});

// ─── trainingDiscoveryMiddleware ──────────────────────────────────────────────

describe('trainingDiscoveryMiddleware', () => {
  it('returns a function', () => {
    expect(typeof trainingDiscoveryMiddleware()).toBe('function');
  });

  it('calls next()', async () => {
    const mw = trainingDiscoveryMiddleware();
    let called = false;
    await mw(makeReq(), makeRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('patches res.json', async () => {
    const mw = trainingDiscoveryMiddleware();
    const res = makeRes();
    const original = res.json;
    await mw(makeReq(), res, () => {});
    expect(res.json).not.toBe(original);
  });
});

// ─── bondingDiscoveryMiddleware ───────────────────────────────────────────────

describe('bondingDiscoveryMiddleware', () => {
  it('returns a function', () => {
    expect(typeof bondingDiscoveryMiddleware()).toBe('function');
  });

  it('calls next()', async () => {
    const mw = bondingDiscoveryMiddleware();
    let called = false;
    await mw(makeReq(), makeRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('patches res.json', async () => {
    const mw = bondingDiscoveryMiddleware();
    const res = makeRes();
    const original = res.json;
    await mw(makeReq(), res, () => {});
    expect(res.json).not.toBe(original);
  });
});

// ─── horseId extraction via req.params ───────────────────────────────────────

describe('autoDiscoveryMiddleware — horseId extraction paths', () => {
  const sources = [
    ['horseId param', makeReq({ params: { horseId: '10' } })],
    ['foalId param', makeReq({ params: { foalId: '20' } })],
    ['id param', makeReq({ params: { id: '30' } })],
    ['body horseId', makeReq({ params: {}, body: { horseId: 40 } })],
    ['body foalId', makeReq({ params: {}, body: { foalId: 50 } })],
  ];

  for (const [label, req] of sources) {
    it(`does not throw with ${label}`, async () => {
      const mw = autoDiscoveryMiddleware();
      const res = makeRes();
      await mw(req, res, () => {});
      expect(() => res.json({ success: true })).not.toThrow();
    });
  }

  it('handles invalid horseId (NaN) gracefully', async () => {
    const mw = autoDiscoveryMiddleware();
    const res = makeRes();
    const req = makeReq({ params: { horseId: 'notanumber' } });
    await mw(req, res, () => {});
    expect(() => res.json({ success: true })).not.toThrow();
  });

  it('handles zero horseId (invalid) gracefully', async () => {
    const mw = autoDiscoveryMiddleware();
    const res = makeRes();
    const req = makeReq({ params: { horseId: '0' } });
    await mw(req, res, () => {});
    expect(() => res.json({ success: true })).not.toThrow();
  });
});
