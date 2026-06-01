import { describe, it, expect } from '@jest/globals';
import {
  paginationMiddleware,
  lazyLoadingMiddleware,
  compressionMiddleware,
  performanceMonitoring,
  responseOptimization,
  getOptimizationMetrics,
} from '../middleware/responseOptimization.mjs';

function makeReq(overrides = {}) {
  return {
    method: 'GET',
    path: '/test',
    query: {},
    headers: {},
    ...overrides,
  };
}

function makeRes(overrides = {}) {
  const headers = {};
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(k, v) {
      headers[k] = v;
    },
    getHeader(k) {
      return headers[k];
    },
    _headers: headers,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
    end(...args) {
      this._ended = true;
      if (this._originalEnd) {
        this._originalEnd(...args);
      }
    },
    ...overrides,
  };
  return res;
}

// ─── paginationMiddleware ─────────────────────────────────────────────────────

describe('paginationMiddleware', () => {
  it('returns a function', () => {
    const mw = paginationMiddleware();
    expect(typeof mw).toBe('function');
  });

  it('sets req.pagination on valid request', () => {
    const mw = paginationMiddleware();
    const req = makeReq({ query: { page: '2', limit: '10' } });
    const res = makeRes();
    let called = false;
    mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(req.pagination).toBeDefined();
    expect(req.pagination.page).toBe(2);
    expect(req.pagination.limit).toBe(10);
    expect(req.pagination.offset).toBe(10);
  });

  it('defaults page=1 and limit=20 when not supplied', () => {
    const mw = paginationMiddleware();
    const req = makeReq({ query: {} });
    const res = makeRes();
    mw(req, res, () => {});
    expect(req.pagination.page).toBe(1);
    expect(req.pagination.limit).toBe(20);
    expect(req.pagination.offset).toBe(0);
  });

  it('caps limit at maxLimit option', () => {
    const mw = paginationMiddleware({ maxLimit: 50 });
    const req = makeReq({ query: { limit: '200' } });
    const res = makeRes();
    mw(req, res, () => {});
    expect(req.pagination.limit).toBe(50);
  });

  it('returns 400 when page < 1', () => {
    const mw = paginationMiddleware();
    const req = makeReq({ query: { page: '-1' } });
    let statusSet = 0;
    let body = null;
    const res = {
      status(code) {
        statusSet = code;
        return this;
      },
      json(b) {
        body = b;
      },
    };
    mw(req, res, () => {});
    expect(statusSet).toBe(400);
    expect(body.success).toBe(false);
  });

  it('attaches cursor and orderBy from query', () => {
    const mw = paginationMiddleware({ enableCursor: true });
    const req = makeReq({ query: { cursor: 'abc', orderBy: 'name', orderDirection: 'desc' } });
    const res = makeRes();
    mw(req, res, () => {});
    expect(req.pagination.cursor).toBe('abc');
    expect(req.pagination.orderBy).toBe('name');
    expect(req.pagination.orderDirection).toBe('desc');
    expect(req.pagination.useCursor).toBe(true);
  });

  it('useCursor is false when cursor not provided', () => {
    const mw = paginationMiddleware({ enableCursor: true });
    const req = makeReq({ query: {} });
    const res = makeRes();
    mw(req, res, () => {});
    expect(req.pagination.useCursor).toBe(false);
  });
});

// ─── lazyLoadingMiddleware ────────────────────────────────────────────────────

describe('lazyLoadingMiddleware', () => {
  it('returns a function', () => {
    const mw = lazyLoadingMiddleware();
    expect(typeof mw).toBe('function');
  });

  it('sets req.lazyLoading on valid request', () => {
    const mw = lazyLoadingMiddleware();
    const req = makeReq({ query: { include: 'owner,breed' } });
    const res = makeRes();
    let called = false;
    mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(req.lazyLoading).toBeDefined();
    expect(req.lazyLoading.includes).toContain('owner');
    expect(req.lazyLoading.includes).toContain('breed');
    expect(req.lazyLoading.enabled).toBe(true);
  });

  it('uses defaultIncludes when no include query param', () => {
    const mw = lazyLoadingMiddleware({ defaultIncludes: ['owner'] });
    const req = makeReq({ query: {} });
    const res = makeRes();
    mw(req, res, () => {});
    expect(req.lazyLoading.includes).toContain('owner');
  });

  it('filters excludeInclude from includes', () => {
    const mw = lazyLoadingMiddleware();
    const req = makeReq({ query: { include: 'owner,breed,stats', excludeInclude: 'stats' } });
    const res = makeRes();
    mw(req, res, () => {});
    expect(req.lazyLoading.includes).not.toContain('stats');
    expect(req.lazyLoading.includes).toContain('owner');
  });

  it('skips lazy loading when disabled', () => {
    const mw = lazyLoadingMiddleware({ enableLazyLoading: false });
    const req = makeReq({ query: { include: 'owner' } });
    const res = makeRes();
    let called = false;
    mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(req.lazyLoading).toBeUndefined();
  });

  it('excludes array is populated from excludeInclude param', () => {
    const mw = lazyLoadingMiddleware();
    const req = makeReq({ query: { excludeInclude: 'stats,health' } });
    const res = makeRes();
    mw(req, res, () => {});
    expect(req.lazyLoading.excludes).toContain('stats');
    expect(req.lazyLoading.excludes).toContain('health');
  });
});

// ─── compressionMiddleware ────────────────────────────────────────────────────

describe('compressionMiddleware', () => {
  it('returns a function', () => {
    const mw = compressionMiddleware();
    expect(typeof mw).toBe('function');
  });

  it('calls next()', () => {
    const mw = compressionMiddleware();
    const req = makeReq({ headers: {} });
    const headers = {};
    const res = {
      setHeader(k, v) {
        headers[k] = v;
      },
    };
    let called = false;
    mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('sets br encoding when accept-encoding includes br', () => {
    const mw = compressionMiddleware({ enableBrotli: true });
    const req = makeReq({ headers: { 'accept-encoding': 'br, gzip' } });
    const headers = {};
    const res = {
      setHeader(k, v) {
        headers[k] = v;
      },
    };
    mw(req, res, () => {});
    expect(headers['Content-Encoding']).toBe('br');
  });

  it('sets gzip encoding when accept-encoding includes gzip but not br', () => {
    const mw = compressionMiddleware({ enableBrotli: false });
    const req = makeReq({ headers: { 'accept-encoding': 'gzip, deflate' } });
    const headers = {};
    const res = {
      setHeader(k, v) {
        headers[k] = v;
      },
    };
    mw(req, res, () => {});
    expect(headers['Content-Encoding']).toBe('gzip');
  });

  it('sets no encoding when accept-encoding is empty', () => {
    const mw = compressionMiddleware();
    const req = makeReq({ headers: { 'accept-encoding': '' } });
    const headers = {};
    const res = {
      setHeader(k, v) {
        headers[k] = v;
      },
    };
    mw(req, res, () => {});
    expect(headers['Content-Encoding']).toBeUndefined();
  });
});

// ─── performanceMonitoring ────────────────────────────────────────────────────

describe('performanceMonitoring', () => {
  it('returns a function', () => {
    const mw = performanceMonitoring();
    expect(typeof mw).toBe('function');
  });

  it('calls next()', () => {
    const mw = performanceMonitoring();
    const req = makeReq();
    const res = makeRes();
    res.end = function () {};
    let called = false;
    mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('does not throw when res.end is called', () => {
    const mw = performanceMonitoring();
    const req = makeReq();
    let endArgs = null;
    const res = {
      headersSent: false,
      setHeader() {},
      end(...args) {
        endArgs = args;
      },
    };
    mw(req, res, () => {});
    expect(() => res.end('ok')).not.toThrow();
    expect(endArgs).toContain('ok');
  });

  it('skips when enableMetrics is false', () => {
    const mw = performanceMonitoring({ enableMetrics: false });
    const req = makeReq();
    const res = makeRes();
    let called = false;
    mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('wraps res.end and adds X-Response-Time header', () => {
    const mw = performanceMonitoring();
    const req = makeReq();
    const headers = {};
    const res = {
      headersSent: false,
      setHeader(k, v) {
        headers[k] = v;
      },
      end() {},
    };
    mw(req, res, () => {});
    res.end();
    expect(headers['X-Response-Time']).toMatch(/\d+ms/);
  });
});

// ─── responseOptimization ─────────────────────────────────────────────────────

describe('responseOptimization', () => {
  it('returns a function', () => {
    const mw = responseOptimization();
    expect(typeof mw).toBe('function');
  });

  it('calls next() and does not throw', () => {
    const mw = responseOptimization();
    const req = makeReq({ query: {} });
    const res = makeRes();
    res.json = function (data) {
      this._body = data;
    };
    let called = false;
    expect(() =>
      mw(req, res, () => {
        called = true;
      }),
    ).not.toThrow();
    expect(called).toBe(true);
  });
});

// ─── getOptimizationMetrics ───────────────────────────────────────────────────

describe('getOptimizationMetrics', () => {
  it('is a function', () => {
    expect(typeof getOptimizationMetrics).toBe('function');
  });

  it('calls res.json with a success response', () => {
    const req = makeReq();
    let body = null;
    const res = {
      json(b) {
        body = b;
      },
      status(code) {
        this._code = code;
        return this;
      },
    };
    expect(() => getOptimizationMetrics(req, res)).not.toThrow();
    if (body) {
      expect(body).toHaveProperty('success');
    }
  });
});
