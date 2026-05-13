import { describe, it, expect } from '@jest/globals';
import { addDocumentationHeaders } from '../../../middleware/swaggerSetup.mjs';

function makeReq() {
  return { method: 'GET', path: '/' };
}

function makeRes() {
  const headers = {};
  return {
    _headers: headers,
    setHeader(key, value) {
      headers[key] = value;
    },
  };
}

// ─── addDocumentationHeaders ─────────────────────────────────────────────────

describe('addDocumentationHeaders', () => {
  it('returns a function', () => {
    expect(typeof addDocumentationHeaders()).toBe('function');
  });

  it('calls next()', () => {
    const mw = addDocumentationHeaders();
    let called = false;
    mw(makeReq(), makeRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('sets X-API-Docs header to /api-docs', () => {
    const mw = addDocumentationHeaders();
    const res = makeRes();
    mw(makeReq(), res, () => {});
    expect(res._headers['X-API-Docs']).toBe('/api-docs');
  });

  it('sets X-API-Spec-JSON header to /api-docs/swagger.json', () => {
    const mw = addDocumentationHeaders();
    const res = makeRes();
    mw(makeReq(), res, () => {});
    expect(res._headers['X-API-Spec-JSON']).toBe('/api-docs/swagger.json');
  });

  it('sets X-API-Spec-YAML header to /api-docs/swagger.yaml', () => {
    const mw = addDocumentationHeaders();
    const res = makeRes();
    mw(makeReq(), res, () => {});
    expect(res._headers['X-API-Spec-YAML']).toBe('/api-docs/swagger.yaml');
  });

  it('sets all three headers in one call', () => {
    const mw = addDocumentationHeaders();
    const res = makeRes();
    mw(makeReq(), res, () => {});
    expect(Object.keys(res._headers)).toHaveLength(3);
  });

  it('each invocation is independent (no shared state)', () => {
    const mw = addDocumentationHeaders();
    const res1 = makeRes();
    const res2 = makeRes();
    mw(makeReq(), res1, () => {});
    mw(makeReq(), res2, () => {});
    expect(res1._headers['X-API-Docs']).toBe('/api-docs');
    expect(res2._headers['X-API-Docs']).toBe('/api-docs');
  });
});
