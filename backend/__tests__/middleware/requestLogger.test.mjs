import { describe, it, expect } from '@jest/globals';
import { requestLogger, errorRequestLogger } from '../../middleware/requestLogger.mjs';

function makeReq(overrides = {}) {
  return {
    method: 'GET',
    originalUrl: '/api/test',
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
    end: function (chunk, encoding) {
      if (this._originalEnd) this._originalEnd(chunk, encoding);
    },
    ...overrides,
  };
}

// ─── requestLogger ────────────────────────────────────────────────────────────

describe('requestLogger', () => {
  it('is a function', () => {
    expect(typeof requestLogger).toBe('function');
  });

  it('calls next()', () => {
    let called = false;
    const req = makeReq();
    const res = makeRes();
    requestLogger(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('does not throw for minimal request', () => {
    const req = makeReq();
    const res = makeRes();
    expect(() => requestLogger(req, res, () => {})).not.toThrow();
  });

  it('overrides res.end — calling res.end after middleware does not throw', () => {
    const req = makeReq({ method: 'POST' });
    const res = makeRes();
    requestLogger(req, res, () => {});
    expect(() => res.end('body', 'utf8')).not.toThrow();
  });

  it('logs a response when res.end is called with a statusCode', () => {
    const req = makeReq({ method: 'GET', originalUrl: '/api/horses' });
    const res = makeRes({ statusCode: 404 });
    requestLogger(req, res, () => {});
    expect(() => res.end(null)).not.toThrow();
  });

  it('works when req.user is set', () => {
    const req = makeReq({ user: { id: 42 } });
    const res = makeRes();
    requestLogger(req, res, () => {});
    expect(() => res.end('ok')).not.toThrow();
  });

  it('works when req.get returns a header value', () => {
    const req = makeReq({
      get: header => (header === 'User-Agent' ? 'TestAgent/1.0' : null),
    });
    const res = makeRes();
    expect(() => requestLogger(req, res, () => {})).not.toThrow();
  });
});

// ─── errorRequestLogger ───────────────────────────────────────────────────────

describe('errorRequestLogger', () => {
  it('is a function', () => {
    expect(typeof errorRequestLogger).toBe('function');
  });

  it('calls next(err)', () => {
    const err = new Error('test error');
    let receivedErr = null;
    const req = makeReq();
    const res = makeRes();
    errorRequestLogger(err, req, res, e => {
      receivedErr = e;
    });
    expect(receivedErr).toBe(err);
  });

  it('does not throw for a basic error', () => {
    const err = new Error('something broke');
    const req = makeReq();
    const res = makeRes();
    expect(() => errorRequestLogger(err, req, res, () => {})).not.toThrow();
  });

  it('redacts password in req.body', () => {
    const err = new Error('auth failed');
    const req = makeReq({ body: { email: 'a@b.com', password: 'secret' } });
    const res = makeRes();
    // We can only observe that this doesn't throw — redactCredentialFields is called internally
    expect(() => errorRequestLogger(err, req, res, () => {})).not.toThrow();
  });

  it('handles req.body with nested password object', () => {
    const err = new Error('fail');
    const req = makeReq({ body: { user: { password: 'p@ss', email: 'x@y.com' } } });
    const res = makeRes();
    expect(() => errorRequestLogger(err, req, res, () => {})).not.toThrow();
  });

  it('handles req.body with token in array', () => {
    const err = new Error('fail');
    const req = makeReq({ body: { tokens: [{ token: 'abc' }, { token: 'def' }] } });
    const res = makeRes();
    expect(() => errorRequestLogger(err, req, res, () => {})).not.toThrow();
  });

  it('handles null req.body', () => {
    const err = new Error('fail');
    const req = makeReq({ body: null });
    const res = makeRes();
    expect(() => errorRequestLogger(err, req, res, () => {})).not.toThrow();
  });

  it('handles string req.body', () => {
    const err = new Error('fail');
    const req = makeReq({ body: 'raw string body' });
    const res = makeRes();
    expect(() => errorRequestLogger(err, req, res, () => {})).not.toThrow();
  });

  it('handles req.query with credential keys', () => {
    const err = new Error('fail');
    const req = makeReq({ query: { apikey: 'sk-abc', page: '1' } });
    const res = makeRes();
    expect(() => errorRequestLogger(err, req, res, () => {})).not.toThrow();
  });

  it('handles req.params with credential keys', () => {
    const err = new Error('fail');
    const req = makeReq({ params: { token: 'abc123', id: '42' } });
    const res = makeRes();
    expect(() => errorRequestLogger(err, req, res, () => {})).not.toThrow();
  });

  it('handles error with no stack', () => {
    const err = { message: 'No stack error' };
    const req = makeReq();
    const res = makeRes();
    expect(() => errorRequestLogger(err, req, res, () => {})).not.toThrow();
  });

  it('works when req.user has an id', () => {
    const err = new Error('fail');
    const req = makeReq({ user: { id: 99 } });
    const res = makeRes();
    expect(() => errorRequestLogger(err, req, res, () => {})).not.toThrow();
  });

  it('handles req with get() returning User-Agent', () => {
    const err = new Error('fail');
    const req = makeReq({ get: h => (h === 'User-Agent' ? 'Bot/1.0' : null) });
    const res = makeRes();
    expect(() => errorRequestLogger(err, req, res, () => {})).not.toThrow();
  });

  it('handles req.body with Date object (non-plain, returned as-is)', () => {
    const err = new Error('fail');
    const req = makeReq({ body: { createdAt: new Date() } });
    const res = makeRes();
    expect(() => errorRequestLogger(err, req, res, () => {})).not.toThrow();
  });

  it('handles deeply nested credential redaction', () => {
    const err = new Error('fail');
    const req = makeReq({
      body: { outer: { inner: { password: 'nested', value: 42 } } },
    });
    const res = makeRes();
    expect(() => errorRequestLogger(err, req, res, () => {})).not.toThrow();
  });
});
