import { describe, it, expect } from '@jest/globals';
import auditLogDefault, {
  auditLog,
  auditBreeding,
  auditTraining,
  auditTransaction,
  auditStatModification,
  auditAuth,
  auditAdmin,
} from '../../middleware/auditLog.mjs';

// All tests run in NODE_ENV=test, so auditLog middleware calls next() immediately.

function makeReq(overrides = {}) {
  return {
    method: 'GET',
    path: '/test',
    ip: '127.0.0.1',
    get: () => null,
    user: null,
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
}

function makeRes(overrides = {}) {
  return {
    statusCode: 200,
    send: function (data) {
      this._data = data;
    },
    ...overrides,
  };
}

// ─── auditLog factory ─────────────────────────────────────────────────────────

describe('auditLog factory', () => {
  it('returns a function', () => {
    const mw = auditLog('breeding', 'high');
    expect(typeof mw).toBe('function');
  });

  it('returned middleware is async', () => {
    const mw = auditLog('auth', 'medium');
    expect(mw.constructor.name).toBe('AsyncFunction');
  });

  it('calls next() in test mode without throwing', async () => {
    const mw = auditLog('training', 'medium');
    const req = makeReq();
    const res = makeRes();
    let called = false;
    await mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('does not modify res.send in test mode', async () => {
    const mw = auditLog('transaction', 'high');
    const req = makeReq();
    const originalSend = () => {};
    const res = makeRes({ send: originalSend });
    await mw(req, res, () => {});
    // In test mode, res.send is NOT overridden (next() called before override)
    expect(res.send).toBe(originalSend);
  });

  it('works with default sensitivityLevel', async () => {
    const mw = auditLog('any_operation');
    const req = makeReq();
    const res = makeRes();
    let called = false;
    await mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('works with req.user set', async () => {
    const mw = auditLog('authentication', 'high');
    const req = makeReq({ user: { id: 42, email: 'test@equoria.test', role: 'admin' } });
    const res = makeRes();
    await expect(mw(req, res, () => {})).resolves.toBeUndefined();
  });
});

// ─── Pre-built audit middlewares ──────────────────────────────────────────────

describe('Pre-built audit middlewares', () => {
  it('auditBreeding is a function', () => {
    expect(typeof auditBreeding).toBe('function');
  });

  it('auditTraining is a function', () => {
    expect(typeof auditTraining).toBe('function');
  });

  it('auditTransaction is a function', () => {
    expect(typeof auditTransaction).toBe('function');
  });

  it('auditStatModification is a function', () => {
    expect(typeof auditStatModification).toBe('function');
  });

  it('auditAuth is a function', () => {
    expect(typeof auditAuth).toBe('function');
  });

  it('auditAdmin is a function', () => {
    expect(typeof auditAdmin).toBe('function');
  });

  it('auditBreeding calls next() in test mode', async () => {
    let called = false;
    await auditBreeding(makeReq(), makeRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('auditAuth calls next() in test mode', async () => {
    let called = false;
    await auditAuth(makeReq(), makeRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('auditAdmin calls next() in test mode', async () => {
    let called = false;
    await auditAdmin(makeReq(), makeRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });
});

// ─── Default export ───────────────────────────────────────────────────────────

describe('auditLog default export', () => {
  it('is an object', () => {
    expect(typeof auditLogDefault).toBe('object');
    expect(auditLogDefault).not.toBeNull();
  });

  it('has auditLog property', () => {
    expect(typeof auditLogDefault.auditLog).toBe('function');
  });

  it('has auditBreeding property', () => {
    expect(typeof auditLogDefault.auditBreeding).toBe('function');
  });

  it('has auditTraining property', () => {
    expect(typeof auditLogDefault.auditTraining).toBe('function');
  });

  it('has auditTransaction property', () => {
    expect(typeof auditLogDefault.auditTransaction).toBe('function');
  });

  it('has auditStatModification property', () => {
    expect(typeof auditLogDefault.auditStatModification).toBe('function');
  });

  it('has auditAuth property', () => {
    expect(typeof auditLogDefault.auditAuth).toBe('function');
  });

  it('has auditAdmin property', () => {
    expect(typeof auditLogDefault.auditAdmin).toBe('function');
  });
});
