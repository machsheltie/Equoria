import { describe, it, expect } from '@jest/globals';
import ApiResponse, { responseHandler } from '../../../utils/apiResponse.mjs';
import express from 'express';
import request from 'supertest';

describe('ApiResponse', () => {
  describe('constructor', () => {
    it('sets success, message, and timestamp', () => {
      const r = new ApiResponse(true, 'ok');
      expect(r.success).toBe(true);
      expect(r.message).toBe('ok');
      expect(typeof r.timestamp).toBe('string');
    });

    it('omits data key when data is null', () => {
      const r = new ApiResponse(true, 'ok', null);
      expect('data' in r).toBe(false);
    });

    it('includes data when provided', () => {
      const r = new ApiResponse(true, 'ok', { id: 1 });
      expect(r.data).toEqual({ id: 1 });
    });

    it('omits meta key when meta is null', () => {
      const r = new ApiResponse(true, 'ok', null, null);
      expect('meta' in r).toBe(false);
    });

    it('includes meta when provided', () => {
      const r = new ApiResponse(true, 'ok', null, { statusCode: 201 });
      expect(r.meta).toEqual({ statusCode: 201 });
    });
  });

  describe('ApiResponse.success', () => {
    it('returns success=true with message', () => {
      const r = ApiResponse.success('done');
      expect(r.success).toBe(true);
      expect(r.message).toBe('done');
    });

    it('passes data and meta through', () => {
      const r = ApiResponse.success('done', [1, 2], { total: 2 });
      expect(r.data).toEqual([1, 2]);
      expect(r.meta).toEqual({ total: 2 });
    });
  });

  describe('ApiResponse.error', () => {
    it('returns success=false', () => {
      const r = ApiResponse.error('boom');
      expect(r.success).toBe(false);
      expect(r.message).toBe('boom');
    });
  });

  describe('ApiResponse.created', () => {
    it('sets statusCode 201 in meta', () => {
      const r = ApiResponse.created('created');
      expect(r.meta.statusCode).toBe(201);
    });
  });

  describe('ApiResponse.notFound', () => {
    it('sets statusCode 404 and success=false', () => {
      const r = ApiResponse.notFound('not found');
      expect(r.success).toBe(false);
      expect(r.meta.statusCode).toBe(404);
    });
  });

  describe('ApiResponse.badRequest', () => {
    it('sets statusCode 400', () => {
      const r = ApiResponse.badRequest('bad');
      expect(r.meta.statusCode).toBe(400);
    });
  });

  describe('ApiResponse.unauthorized', () => {
    it('sets statusCode 401', () => {
      const r = ApiResponse.unauthorized();
      expect(r.meta.statusCode).toBe(401);
    });
  });

  describe('ApiResponse.forbidden', () => {
    it('sets statusCode 403', () => {
      const r = ApiResponse.forbidden();
      expect(r.meta.statusCode).toBe(403);
    });
  });

  describe('ApiResponse.conflict', () => {
    it('sets statusCode 409', () => {
      const r = ApiResponse.conflict();
      expect(r.meta.statusCode).toBe(409);
    });
  });

  describe('ApiResponse.validationError', () => {
    it('sets statusCode 400 and includes validationErrors', () => {
      const r = ApiResponse.validationError('invalid', ['field required']);
      expect(r.meta.statusCode).toBe(400);
      expect(r.meta.validationErrors).toEqual(['field required']);
      expect(r.success).toBe(false);
    });
  });

  describe('ApiResponse.serverError', () => {
    it('sets statusCode 500', () => {
      const r = ApiResponse.serverError();
      expect(r.meta.statusCode).toBe(500);
    });
  });

  describe('ApiResponse.paginated', () => {
    it('builds pagination meta correctly', () => {
      const r = ApiResponse.paginated('ok', [1, 2], { page: 1, limit: 2, total: 10 });
      const p = r.meta.pagination;
      expect(p.page).toBe(1);
      expect(p.limit).toBe(2);
      expect(p.total).toBe(10);
      expect(p.totalPages).toBe(5);
      expect(p.hasNext).toBe(true);
      expect(p.hasPrev).toBe(false);
    });

    it('hasPrev is true on page 2', () => {
      const r = ApiResponse.paginated('ok', [], { page: 2, limit: 10, total: 25 });
      expect(r.meta.pagination.hasPrev).toBe(true);
    });

    it('hasNext is false on last page', () => {
      const r = ApiResponse.paginated('ok', [], { page: 3, limit: 10, total: 25 });
      expect(r.meta.pagination.hasNext).toBe(false);
    });
  });
});

describe('responseHandler middleware', () => {
  const app = express();
  app.use(responseHandler);

  app.get('/success', (req, res) => res.apiSuccess('done', { val: 1 }));
  app.get('/error', (req, res) => res.apiError('boom', 500));
  app.get('/created', (req, res) => res.apiCreated('created', { id: 5 }));
  app.get('/not-found', (req, res) => res.apiNotFound('nope'));
  app.get('/bad', (req, res) => res.apiBadRequest('bad input'));
  app.get('/unauth', (req, res) => res.apiUnauthorized());
  app.get('/forbidden', (req, res) => res.apiForbidden());
  app.get('/conflict', (req, res) => res.apiConflict());
  app.get('/validation', (req, res) => res.apiValidationError('fail', ['x']));
  app.get('/paginated', (req, res) => res.apiPaginated('list', [1], { page: 1, limit: 1, total: 5 }));

  it('apiSuccess returns 200 with success:true', async () => {
    const res = await request(app).get('/success');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ val: 1 });
  });

  it('apiError returns specified status', async () => {
    const res = await request(app).get('/error');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('apiCreated returns 201', async () => {
    const res = await request(app).get('/created');
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ id: 5 });
  });

  it('apiNotFound returns 404', async () => {
    const res = await request(app).get('/not-found');
    expect(res.status).toBe(404);
  });

  it('apiBadRequest returns 400', async () => {
    const res = await request(app).get('/bad');
    expect(res.status).toBe(400);
  });

  it('apiUnauthorized returns 401', async () => {
    const res = await request(app).get('/unauth');
    expect(res.status).toBe(401);
  });

  it('apiForbidden returns 403', async () => {
    const res = await request(app).get('/forbidden');
    expect(res.status).toBe(403);
  });

  it('apiConflict returns 409', async () => {
    const res = await request(app).get('/conflict');
    expect(res.status).toBe(409);
  });

  it('apiValidationError returns 400 with errors', async () => {
    const res = await request(app).get('/validation');
    expect(res.status).toBe(400);
    expect(res.body.meta.validationErrors).toEqual(['x']);
  });

  it('apiPaginated returns 200 with pagination meta', async () => {
    const res = await request(app).get('/paginated');
    expect(res.status).toBe(200);
    expect(res.body.meta.pagination.total).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Default parameter branch coverage (lines 31-35, 51, 83-103, 123)
// ---------------------------------------------------------------------------
describe('ApiResponse static methods — default parameter branches', () => {
  it('notFound() with no args uses default message "Resource not found"', () => {
    const r = ApiResponse.notFound();
    expect(r.success).toBe(false);
    expect(r.message).toBe('Resource not found');
    expect(r.meta.statusCode).toBe(404);
  });

  it('badRequest() with no args uses default message "Bad request"', () => {
    const r = ApiResponse.badRequest();
    expect(r.success).toBe(false);
    expect(r.message).toBe('Bad request');
    expect(r.meta.statusCode).toBe(400);
  });

  it('validationError() with no args uses default message and empty errors array', () => {
    const r = ApiResponse.validationError();
    expect(r.success).toBe(false);
    expect(r.message).toBe('Validation failed');
    expect(r.meta.validationErrors).toEqual([]);
  });

  it('serverError() with no args uses default message', () => {
    const r = ApiResponse.serverError();
    expect(r.message).toBe('Internal server error');
  });
});

describe('responseHandler — default parameter branches for middleware methods', () => {
  const app2 = express();
  app2.use(responseHandler);

  app2.get('/default-not-found', (req, res) => res.apiNotFound());
  app2.get('/default-bad-request', (req, res) => res.apiBadRequest());
  app2.get('/default-unauthorized', (req, res) => res.apiUnauthorized());
  app2.get('/default-forbidden', (req, res) => res.apiForbidden());
  app2.get('/default-conflict', (req, res) => res.apiConflict());
  app2.get('/default-validation', (req, res) => res.apiValidationError());

  it('apiNotFound() uses default message', async () => {
    const res = await request(app2).get('/default-not-found');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Resource not found');
  });

  it('apiBadRequest() uses default message', async () => {
    const res = await request(app2).get('/default-bad-request');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Bad request');
  });

  it('apiUnauthorized() uses default message', async () => {
    const res = await request(app2).get('/default-unauthorized');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Unauthorized');
  });

  it('apiForbidden() uses default message', async () => {
    const res = await request(app2).get('/default-forbidden');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Forbidden');
  });

  it('apiConflict() uses default message', async () => {
    const res = await request(app2).get('/default-conflict');
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Resource conflict');
  });

  it('apiValidationError() uses default message and empty errors', async () => {
    const res = await request(app2).get('/default-validation');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.meta.validationErrors).toEqual([]);
  });
});

// ── responseHandler — default-param branches for apiSuccess/apiError/apiCreated ──
// Lines 83-93: these three methods have `data = null`, `meta = null`, `statusCode = 500`
// defaults that are only covered when the methods are called with fewer arguments.
describe('responseHandler — apiSuccess/apiError/apiCreated default params (Equoria-jkht)', () => {
  const app3 = express();
  app3.use(responseHandler);
  app3.get('/default-success', (req, res) => res.apiSuccess('done'));
  app3.get('/default-error', (req, res) => res.apiError('fail'));
  app3.get('/default-created', (req, res) => res.apiCreated('created'));

  it('apiSuccess() with no data/meta covers data=null and meta=null defaults', async () => {
    const res = await request(app3).get('/default-success');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('done');
  });

  it('apiError() with no statusCode defaults to 500', async () => {
    const res = await request(app3).get('/default-error');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('apiCreated() with no data/meta covers data=null and meta=null defaults', async () => {
    const res = await request(app3).get('/default-created');
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('created');
  });
});
