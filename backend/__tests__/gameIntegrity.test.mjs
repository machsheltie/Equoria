import { describe, it, expect } from '@jest/globals';
import { validateStatChanges, preventDuplication, validateTimestamp } from '../middleware/gameIntegrity.mjs';

function makeReq(overrides = {}) {
  return {
    method: 'POST',
    body: {},
    query: {},
    params: {},
    user: { id: 'user-123' },
    ...overrides,
  };
}

function makeRes() {
  const res = {
    _statusCode: 200,
    _body: null,
    status(code) {
      this._statusCode = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  return res;
}

// ─── validateStatChanges ──────────────────────────────────────────────────────

describe('validateStatChanges', () => {
  it('returns a function', () => {
    expect(typeof validateStatChanges()).toBe('function');
  });

  it('calls next() when no protected stats in body', () => {
    const mw = validateStatChanges([]);
    const req = makeReq({ body: { name: 'Horse' } });
    const res = makeRes();
    let called = false;
    mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('returns 403 when protected stat is in body without permission', () => {
    const mw = validateStatChanges([]);
    const req = makeReq({ body: { speed: 100 } });
    const res = makeRes();
    mw(req, res, () => {});
    expect(res._statusCode).toBe(403);
    expect(res._body).toBeDefined();
  });

  it('allows explicitly allowed stat fields through', () => {
    const mw = validateStatChanges(['speed']);
    const req = makeReq({ body: { speed: 50 } });
    const res = makeRes();
    let called = false;
    mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('returns 400 when allowed stat is out of range (>100)', () => {
    const mw = validateStatChanges(['speed']);
    const req = makeReq({ body: { speed: 150 } });
    const res = makeRes();
    mw(req, res, () => {});
    expect(res._statusCode).toBe(400);
  });

  it('returns 400 when allowed stat is out of range (<0)', () => {
    const mw = validateStatChanges(['speed']);
    const req = makeReq({ body: { speed: -1 } });
    const res = makeRes();
    mw(req, res, () => {});
    expect(res._statusCode).toBe(400);
  });

  it('returns 400 when allowed stat is NaN', () => {
    const mw = validateStatChanges(['speed']);
    const req = makeReq({ body: { speed: 'notanumber' } });
    const res = makeRes();
    mw(req, res, () => {});
    expect(res._statusCode).toBe(400);
  });

  it('blocks precision, strength, agility, endurance, intelligence, personality, total_earnings, level', () => {
    const protectedFields = [
      'precision',
      'strength',
      'agility',
      'endurance',
      'intelligence',
      'personality',
      'total_earnings',
      'level',
    ];
    for (const field of protectedFields) {
      const mw = validateStatChanges([]);
      const req = makeReq({ body: { [field]: 50 } });
      const res = makeRes();
      mw(req, res, () => {});
      expect(res._statusCode).toBe(403);
    }
  });
});

// ─── preventDuplication ───────────────────────────────────────────────────────

describe('preventDuplication', () => {
  it('returns a function', () => {
    expect(typeof preventDuplication('horse')).toBe('function');
  });

  it('calls next() on first operation', async () => {
    const mw = preventDuplication('horse');
    const req = makeReq({ body: { action: `unique-${Date.now()}` } });
    const res = makeRes();
    let called = false;
    await mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('returns 429 when same operation is repeated within 5 seconds', async () => {
    const mw = preventDuplication('horse');
    const body = { action: `dup-test-${Date.now()}` };
    const req1 = makeReq({ body });
    const req2 = makeReq({ body });
    const res1 = makeRes();
    const res2 = makeRes();
    await mw(req1, res1, () => {});
    await mw(req2, res2, () => {});
    expect(res2._statusCode).toBe(429);
  });

  it('different users can perform the same operation', async () => {
    const mw = preventDuplication('horse');
    const body = { action: `shared-action-${Date.now()}` };
    const req1 = makeReq({ body, user: { id: 'user-A' } });
    const req2 = makeReq({ body, user: { id: 'user-B' } });
    const res1 = makeRes();
    const res2 = makeRes();
    let c1 = false,
      c2 = false;
    await mw(req1, res1, () => {
      c1 = true;
    });
    await mw(req2, res2, () => {
      c2 = true;
    });
    expect(c1).toBe(true);
    expect(c2).toBe(true);
  });
});

// ─── validateTimestamp ────────────────────────────────────────────────────────

describe('validateTimestamp', () => {
  it('is a function', () => {
    expect(typeof validateTimestamp).toBe('function');
  });

  it('calls next() when no timestamp in body or query', () => {
    const req = makeReq({ body: {}, query: {} });
    const res = makeRes();
    let called = false;
    validateTimestamp(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('sets req.serverTimestamp', () => {
    const req = makeReq({ body: {}, query: {} });
    const res = makeRes();
    validateTimestamp(req, res, () => {});
    expect(req.serverTimestamp).toBeInstanceOf(Date);
  });

  it('calls next() when timestamp is within 5 minutes', () => {
    const now = new Date().toISOString();
    const req = makeReq({ body: { timestamp: now } });
    const res = makeRes();
    let called = false;
    validateTimestamp(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('returns 400 when timestamp is more than 5 minutes off', () => {
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const req = makeReq({ body: { timestamp: old } });
    const res = makeRes();
    validateTimestamp(req, res, () => {});
    expect(res._statusCode).toBe(400);
  });

  it('accepts timestamp from query string', () => {
    const now = new Date().toISOString();
    const req = makeReq({ body: {}, query: { timestamp: now } });
    const res = makeRes();
    let called = false;
    validateTimestamp(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });
});
