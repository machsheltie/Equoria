/**
 * notFoundHandler — the app-level catch-all for undefined routes.
 *
 * Regression: the handler is mounted with `app.use('*', ...)`. Under a mounted
 * path Express rewrites `req.path` relative to the mount, so inside the
 * handler `req.path` is always '/'. The original guard tested `req.path`, so
 * in production EVERY unknown API route (e.g. GET /api/v1/horses/5/age) was
 * answered with the SPA's index.html instead of a JSON 404. The frontend then
 * failed with `Unexpected token '<', "<!doctype "... is not valid JSON`.
 *
 * The request objects below mirror what Express hands the handler: `path`
 * is '/', `baseUrl` is the matched prefix, and `originalUrl` is the real URL.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createNotFoundHandler } from '../../middleware/notFoundHandler.mjs';

const SPA_HTML = '<!doctype html><html><body>spa</body></html>';

function mockReq(originalUrl, method = 'GET') {
  const [pathOnly] = originalUrl.split('?');
  return { originalUrl, baseUrl: pathOnly, path: '/', method, ip: '127.0.0.1' };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    contentType: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    setHeader(name, value) {
      res.headers[name] = value;
      return res;
    },
    type(value) {
      res.contentType = value;
      return res;
    },
    json(data) {
      res.contentType = 'json';
      res.body = data;
      return res;
    },
    send(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

const silentLogger = { warn: () => {} };

describe('notFoundHandler', () => {
  let savedNodeEnv;

  beforeAll(() => {
    savedNodeEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    if (savedNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = savedNodeEnv;
    }
  });

  describe('production with SPA html available', () => {
    let handler;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      handler = createNotFoundHandler({ spaHtml: SPA_HTML, logger: silentLogger });
    });

    it('returns a JSON 404 for an unknown /api route, never the SPA html', () => {
      const res = mockRes();
      handler(mockReq('/api/v1/horses/5/age'), res);

      expect(res.statusCode).toBe(404);
      expect(res.contentType).toBe('json');
      expect(res.body).toEqual({
        success: false,
        message: 'Route not found',
        path: '/api/v1/horses/5/age',
        method: 'GET',
      });
    });

    it('still returns JSON 404 for an unknown /api route with a query string', () => {
      const res = mockRes();
      handler(mockReq('/api/v1/horses/5/stats?t=123'), res);

      expect(res.statusCode).toBe(404);
      expect(res.contentType).toBe('json');
      expect(res.body.path).toBe('/api/v1/horses/5/stats?t=123');
    });

    it.each(['/health/deep', '/api-docs/missing'])('returns JSON 404 for unknown backend path %s', url => {
      const res = mockRes();
      handler(mockReq(url), res);

      expect(res.statusCode).toBe(404);
      expect(res.contentType).toBe('json');
    });

    it('serves the SPA html for a client-side route with no-store caching', () => {
      const res = mockRes();
      handler(mockReq('/horses/5'), res);

      expect(res.statusCode).toBe(200);
      expect(res.contentType).toBe('html');
      expect(res.body).toBe(SPA_HTML);
      expect(res.headers['Cache-Control']).toBe('no-store');
    });
  });

  describe('outside production', () => {
    it('returns JSON 404 for a client-side route even when SPA html is available', () => {
      process.env.NODE_ENV = 'development';
      const handler = createNotFoundHandler({ spaHtml: SPA_HTML, logger: silentLogger });
      const res = mockRes();
      handler(mockReq('/horses/5'), res);

      expect(res.statusCode).toBe(404);
      expect(res.contentType).toBe('json');
    });
  });

  describe('production without SPA html', () => {
    it('returns JSON 404 for a client-side route', () => {
      process.env.NODE_ENV = 'production';
      const handler = createNotFoundHandler({ spaHtml: null, logger: silentLogger });
      const res = mockRes();
      handler(mockReq('/horses/5'), res);

      expect(res.statusCode).toBe(404);
      expect(res.contentType).toBe('json');
    });
  });
});
