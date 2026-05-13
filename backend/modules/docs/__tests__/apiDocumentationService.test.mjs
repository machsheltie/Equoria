import { describe, it, expect } from '@jest/globals';
import {
  getApiDocumentationService,
  registerEndpoint,
  registerSchema,
  getDocumentationMetrics,
  getDocumentationHealth,
} from '../../../services/apiDocumentationService.mjs';

// ─── Singleton ────────────────────────────────────────────────────────────────

describe('getApiDocumentationService (singleton)', () => {
  it('returns an object', () => {
    const svc = getApiDocumentationService();
    expect(typeof svc).toBe('object');
    expect(svc).not.toBeNull();
  });

  it('returns the same instance on repeated calls', () => {
    const a = getApiDocumentationService();
    const b = getApiDocumentationService();
    expect(a).toBe(b);
  });

  it('instance has expected method signatures', () => {
    const svc = getApiDocumentationService();
    expect(typeof svc.registerEndpoint).toBe('function');
    expect(typeof svc.registerSchema).toBe('function');
    expect(typeof svc.generateSchemaExample).toBe('function');
    expect(typeof svc.getStatusDescription).toBe('function');
    expect(typeof svc.getMetrics).toBe('function');
    expect(typeof svc.generateRecommendations).toBe('function');
  });
});

// ─── registerEndpoint ─────────────────────────────────────────────────────────

describe('registerEndpoint', () => {
  it('returns an object with method and path', () => {
    const info = registerEndpoint('GET', '/api/test');
    expect(info.method).toBe('GET');
    expect(info.path).toBe('/api/test');
  });

  it('uppercases the HTTP method', () => {
    const info = registerEndpoint('post', '/api/lower');
    expect(info.method).toBe('POST');
  });

  it('stores summary and description from options', () => {
    const info = registerEndpoint('GET', '/api/doc-test', {
      summary: 'My summary',
      description: 'My description',
    });
    expect(info.summary).toBe('My summary');
    expect(info.description).toBe('My description');
  });

  it('defaults tags, parameters, responses, security to empty collections', () => {
    const info = registerEndpoint('DELETE', '/api/no-opts');
    expect(Array.isArray(info.tags)).toBe(true);
    expect(Array.isArray(info.parameters)).toBe(true);
    expect(typeof info.responses).toBe('object');
    expect(Array.isArray(info.security)).toBe(true);
  });

  it('stores in endpoint registry (instance side effect)', () => {
    const svc = getApiDocumentationService();
    registerEndpoint('PATCH', '/api/registry-check');
    expect(svc.endpointRegistry.has('PATCH /api/registry-check')).toBe(true);
  });

  it('includes registeredAt ISO timestamp', () => {
    const info = registerEndpoint('GET', '/api/ts-check');
    expect(typeof info.registeredAt).toBe('string');
    expect(() => new Date(info.registeredAt)).not.toThrow();
  });
});

// ─── registerSchema ───────────────────────────────────────────────────────────

describe('registerSchema', () => {
  it('stores schema in schemaRegistry', () => {
    const svc = getApiDocumentationService();
    const schema = { type: 'object', properties: { id: { type: 'integer' } } };
    registerSchema('TestEntity', schema);
    expect(svc.schemaRegistry.has('TestEntity')).toBe(true);
  });

  it('stores schema with registeredAt metadata', () => {
    const svc = getApiDocumentationService();
    const schema = { type: 'string' };
    registerSchema('SimpleSchema', schema);
    const stored = svc.schemaRegistry.get('SimpleSchema');
    expect(stored.type).toBe('string');
    expect(stored).toHaveProperty('registeredAt');
  });
});

// ─── generateSchemaExample ────────────────────────────────────────────────────

describe('ApiDocumentationService — generateSchemaExample', () => {
  const svc = getApiDocumentationService();

  it('returns null for null schema', () => {
    expect(svc.generateSchemaExample(null)).toBeNull();
  });

  it('returns null for non-object schema', () => {
    expect(svc.generateSchemaExample('string')).toBeNull();
  });

  it('returns "string" for { type: "string" }', () => {
    expect(svc.generateSchemaExample({ type: 'string' })).toBe('string');
  });

  it('returns email example for string format email', () => {
    const example = svc.generateSchemaExample({ type: 'string', format: 'email' });
    expect(example).toBe('user@example.com');
  });

  it('returns UUID example for string format uuid', () => {
    const example = svc.generateSchemaExample({ type: 'string', format: 'uuid' });
    expect(example).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('returns ISO date string for string format date-time', () => {
    const example = svc.generateSchemaExample({ type: 'string', format: 'date-time' });
    expect(typeof example).toBe('string');
    expect(() => new Date(example)).not.toThrow();
  });

  it('returns first enum value for string with enum', () => {
    const example = svc.generateSchemaExample({ type: 'string', enum: ['alpha', 'beta', 'gamma'] });
    expect(example).toBe('alpha');
  });

  it('returns custom example when provided for string', () => {
    const example = svc.generateSchemaExample({ type: 'string', example: 'custom-val' });
    expect(example).toBe('custom-val');
  });

  it('returns 42 for { type: "integer" }', () => {
    expect(svc.generateSchemaExample({ type: 'integer' })).toBe(42);
  });

  it('returns 3.14 for { type: "number" }', () => {
    expect(svc.generateSchemaExample({ type: 'number' })).toBe(3.14);
  });

  it('returns true for { type: "boolean" }', () => {
    expect(svc.generateSchemaExample({ type: 'boolean' })).toBe(true);
  });

  it('returns false for { type: "boolean", example: false }', () => {
    expect(svc.generateSchemaExample({ type: 'boolean', example: false })).toBe(false);
  });

  it('returns an array for { type: "array", items: { type: "string" } }', () => {
    const example = svc.generateSchemaExample({ type: 'array', items: { type: 'string' } });
    expect(Array.isArray(example)).toBe(true);
    expect(example[0]).toBe('string');
  });

  it('returns an object for { type: "object", properties: {...} }', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
    };
    const example = svc.generateSchemaExample(schema);
    expect(typeof example).toBe('object');
    expect(example.id).toBe(42);
    expect(example.name).toBe('string');
  });

  it('merges allOf subschemas', () => {
    const schema = {
      allOf: [
        { type: 'object', properties: { a: { type: 'integer' } } },
        { type: 'object', properties: { b: { type: 'string' } } },
      ],
    };
    const example = svc.generateSchemaExample(schema);
    expect(typeof example).toBe('object');
    expect(example.a).toBe(42);
    expect(example.b).toBe('string');
  });

  it('returns null for unknown type with no example', () => {
    expect(svc.generateSchemaExample({ type: 'unknown-type' })).toBeNull();
  });
});

// ─── getStatusDescription ─────────────────────────────────────────────────────

describe('ApiDocumentationService — getStatusDescription', () => {
  const svc = getApiDocumentationService();

  it('returns "Successful operation" for 200', () => {
    expect(svc.getStatusDescription(200)).toBe('Successful operation');
  });

  it('returns "Resource created successfully" for 201', () => {
    expect(svc.getStatusDescription(201)).toBe('Resource created successfully');
  });

  it('returns "Bad request - validation error" for 400', () => {
    expect(svc.getStatusDescription(400)).toBe('Bad request - validation error');
  });

  it('returns "Unauthorized - authentication required" for 401', () => {
    expect(svc.getStatusDescription(401)).toBe('Unauthorized - authentication required');
  });

  it('returns "Forbidden - insufficient permissions" for 403', () => {
    expect(svc.getStatusDescription(403)).toBe('Forbidden - insufficient permissions');
  });

  it('returns "Resource not found" for 404', () => {
    expect(svc.getStatusDescription(404)).toBe('Resource not found');
  });

  it('returns "Internal server error" for 500', () => {
    expect(svc.getStatusDescription(500)).toBe('Internal server error');
  });

  it('returns "Response" for unknown status code', () => {
    expect(svc.getStatusDescription(999)).toBe('Response');
  });
});

// ─── generateRecommendations ──────────────────────────────────────────────────

describe('ApiDocumentationService — generateRecommendations', () => {
  const svc = getApiDocumentationService();

  it('returns an array', () => {
    const recs = svc.generateRecommendations({ coverage: 100, schemaCount: 20, tagCount: 10 }, { errors: [] });
    expect(Array.isArray(recs)).toBe(true);
  });

  it('returns empty array for perfect metrics', () => {
    const recs = svc.generateRecommendations({ coverage: 100, schemaCount: 20, tagCount: 10 }, { errors: [] });
    expect(recs).toHaveLength(0);
  });

  it('recommends improving coverage when coverage < 50', () => {
    const recs = svc.generateRecommendations({ coverage: 30, schemaCount: 20, tagCount: 10 }, { errors: [] });
    expect(recs.some(r => r.includes('Low documentation coverage'))).toBe(true);
  });

  it('recommends improving coverage when coverage is 50-79', () => {
    const recs = svc.generateRecommendations({ coverage: 60, schemaCount: 20, tagCount: 10 }, { errors: [] });
    expect(recs.some(r => r.includes('coverage could be improved'))).toBe(true);
  });

  it('recommends fixing validation errors when errors present', () => {
    const recs = svc.generateRecommendations(
      { coverage: 100, schemaCount: 20, tagCount: 10 },
      { errors: ['some error'] },
    );
    expect(recs.some(r => r.includes('Fix validation errors'))).toBe(true);
  });

  it('recommends more schemas when schemaCount < 10', () => {
    const recs = svc.generateRecommendations({ coverage: 100, schemaCount: 5, tagCount: 10 }, { errors: [] });
    expect(recs.some(r => r.includes('reusable schemas'))).toBe(true);
  });

  it('recommends more tags when tagCount < 5', () => {
    const recs = svc.generateRecommendations({ coverage: 100, schemaCount: 20, tagCount: 2 }, { errors: [] });
    expect(recs.some(r => r.includes('tags'))).toBe(true);
  });
});

// ─── getMetrics ───────────────────────────────────────────────────────────────

describe('getDocumentationMetrics', () => {
  it('returns an object with expected fields', () => {
    const metrics = getDocumentationMetrics();
    expect(metrics).toHaveProperty('totalEndpoints');
    expect(metrics).toHaveProperty('documentedEndpoints');
    expect(metrics).toHaveProperty('coverage');
    expect(metrics).toHaveProperty('validationErrors');
  });

  it('coverage is a number', () => {
    const { coverage } = getDocumentationMetrics();
    expect(typeof coverage).toBe('number');
  });
});

// ─── getDocumentationHealth ───────────────────────────────────────────────────

describe('getDocumentationHealth', () => {
  it('returns an object with status, metrics, validation, recommendations, and timestamp', () => {
    const health = getDocumentationHealth();
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('metrics');
    expect(health).toHaveProperty('validation');
    expect(health).toHaveProperty('recommendations');
    expect(health).toHaveProperty('timestamp');
  });

  it('status is either "healthy" or "needs_attention"', () => {
    const { status } = getDocumentationHealth();
    expect(['healthy', 'needs_attention']).toContain(status);
  });

  it('recommendations is an array', () => {
    const { recommendations } = getDocumentationHealth();
    expect(Array.isArray(recommendations)).toBe(true);
  });
});

// ─── generateExampleResponse ──────────────────────────────────────────────────

describe('ApiDocumentationService — generateExampleResponse', () => {
  const svc = getApiDocumentationService();

  it('returns an object keyed by status code', () => {
    const schema = { type: 'string' };
    const response = svc.generateExampleResponse(schema, 200);
    expect(response).toHaveProperty('200');
  });

  it('includes description and content', () => {
    const schema = { type: 'integer' };
    const response = svc.generateExampleResponse(schema, 201);
    expect(response['201']).toHaveProperty('description');
    expect(response['201']).toHaveProperty('content');
  });

  it('default status code is 200', () => {
    const schema = { type: 'boolean' };
    const response = svc.generateExampleResponse(schema);
    expect(response).toHaveProperty('200');
  });

  it('description matches getStatusDescription', () => {
    const schema = { type: 'string' };
    const response = svc.generateExampleResponse(schema, 404);
    expect(response['404'].description).toBe('Resource not found');
  });
});
