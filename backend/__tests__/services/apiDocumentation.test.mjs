/**
 * 🧪 API Documentation Service Tests
 *
 * Comprehensive test suite for API documentation service including:
 * - OpenAPI specification loading and validation
 * - Endpoint registration and management
 * - Schema registration and validation
 * - Documentation generation and metrics
 * - Health monitoring and analytics
 *
 * Testing Approach: TDD with NO MOCKING
 * - Real file system operations with test specifications
 * - Authentic OpenAPI validation
 * - Genuine documentation generation
 * - Production-like documentation scenarios
 */

// jest import removed - not used in this file
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  getApiDocumentationService,
  registerEndpoint,
  registerSchema,
  generateDocumentation,
  getDocumentationMetrics,
  getDocumentationHealth,
} from '../../services/apiDocumentationService.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('API Documentation Service', () => {
  let docService;
  let testSwaggerPath;

  beforeEach(() => {
    // Create a test swagger file
    testSwaggerPath = join(__dirname, 'test-swagger.yaml');
    const testSpec = `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
  description: Test API specification
paths:
  /test:
    get:
      tags:
        - Test
      summary: Test endpoint
      description: A test endpoint
      responses:
        '200':
          description: Success
components:
  schemas:
    TestSchema:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
`;

    writeFileSync(testSwaggerPath, testSpec.trim());

    // Create service instance with test path
    docService = getApiDocumentationService();
    docService.swaggerPath = testSwaggerPath;
  });

  afterEach(() => {
    // Cleanup test file
    if (existsSync(testSwaggerPath)) {
      unlinkSync(testSwaggerPath);
    }

    // Reset service state
    docService.endpointRegistry.clear();
    docService.schemaRegistry.clear();
  });

  describe('Specification Loading and Saving', () => {
    test('loads OpenAPI specification correctly', () => {
      const spec = docService.loadSpecification();

      expect(spec).toBeDefined();
      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info.title).toBe('Test API');
      expect(spec.info.version).toBe('1.0.0');
      expect(spec.paths).toBeDefined();
      expect(spec.paths['/test']).toBeDefined();
    });

    test('saves OpenAPI specification correctly', () => {
      const spec = docService.loadSpecification();
      spec.info.description = 'Updated description';

      docService.saveSpecification(spec);

      const reloadedSpec = docService.loadSpecification();
      expect(reloadedSpec.info.description).toBe('Updated description');
    });

    test('throws error when specification file not found', () => {
      unlinkSync(testSwaggerPath);

      expect(() => {
        docService.loadSpecification();
      }).toThrow('OpenAPI specification file not found');
    });
  });

  describe('Endpoint Registration', () => {
    test('registers endpoint correctly', () => {
      const endpointInfo = docService.registerEndpoint('POST', '/api/users', {
        summary: 'Create user',
        description: 'Create a new user account',
        tags: ['Users'],
        parameters: [],
        responses: {
          '201': { description: 'User created' },
          '400': { description: 'Validation error' },
        },
      });

      expect(endpointInfo).toBeDefined();
      expect(endpointInfo.method).toBe('POST');
      expect(endpointInfo.path).toBe('/api/users');
      expect(endpointInfo.summary).toBe('Create user');
      expect(endpointInfo.tags).toEqual(['Users']);
      expect(endpointInfo.registeredAt).toBeDefined();

      expect(docService.endpointRegistry.has('POST /api/users')).toBe(true);
    });

    test('registers multiple endpoints correctly', () => {
      docService.registerEndpoint('GET', '/api/users', {
        summary: 'List users',
        tags: ['Users'],
      });

      docService.registerEndpoint('POST', '/api/users', {
        summary: 'Create user',
        tags: ['Users'],
      });

      docService.registerEndpoint('GET', '/api/horses', {
        summary: 'List horses',
        tags: ['Horses'],
      });

      expect(docService.endpointRegistry.size).toBe(3);
      expect(docService.endpointRegistry.has('GET /api/users')).toBe(true);
      expect(docService.endpointRegistry.has('POST /api/users')).toBe(true);
      expect(docService.endpointRegistry.has('GET /api/horses')).toBe(true);
    });

    test('handles endpoint registration with minimal options', () => {
      const endpointInfo = docService.registerEndpoint('GET', '/api/test');

      expect(endpointInfo.method).toBe('GET');
      expect(endpointInfo.path).toBe('/api/test');
      expect(endpointInfo.summary).toBe('');
      expect(endpointInfo.description).toBe('');
      expect(endpointInfo.tags).toEqual([]);
      expect(endpointInfo.parameters).toEqual([]);
      expect(endpointInfo.responses).toEqual({});
    });
  });

  describe('Schema Registration', () => {
    test('registers schema correctly', () => {
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
        required: ['id', 'name', 'email'],
      };

      docService.registerSchema('User', schema);

      expect(docService.schemaRegistry.has('User')).toBe(true);
      const registeredSchema = docService.schemaRegistry.get('User');
      expect(registeredSchema.type).toBe('object');
      expect(registeredSchema.properties.id.format).toBe('uuid');
      expect(registeredSchema.registeredAt).toBeDefined();
    });

    test('registers multiple schemas correctly', () => {
      docService.registerSchema('User', { type: 'object' });
      docService.registerSchema('Horse', { type: 'object' });
      docService.registerSchema('Competition', { type: 'object' });

      expect(docService.schemaRegistry.size).toBe(3);
      expect(docService.schemaRegistry.has('User')).toBe(true);
      expect(docService.schemaRegistry.has('Horse')).toBe(true);
      expect(docService.schemaRegistry.has('Competition')).toBe(true);
    });
  });

  describe('Documentation Generation', () => {
    test('generates documentation with registered endpoints', () => {
      docService.registerEndpoint('GET', '/api/users', {
        summary: 'List users',
        description: 'Retrieve a list of users',
        tags: ['Users'],
        responses: { '200': { description: 'Success' } },
      });

      docService.registerEndpoint('POST', '/api/horses', {
        summary: 'Create horse',
        description: 'Create a new horse',
        tags: ['Horses'],
        responses: { '201': { description: 'Created' } },
      });

      const spec = docService.generateDocumentation();

      expect(spec.paths['/api/users']).toBeDefined();
      expect(spec.paths['/api/users'].get).toBeDefined();
      expect(spec.paths['/api/users'].get.summary).toBe('List users');
      expect(spec.paths['/api/users'].get.tags).toEqual(['Users']);

      expect(spec.paths['/api/horses']).toBeDefined();
      expect(spec.paths['/api/horses'].post).toBeDefined();
      expect(spec.paths['/api/horses'].post.summary).toBe('Create horse');
      expect(spec.paths['/api/horses'].post.tags).toEqual(['Horses']);
    });

    test('generates documentation with registered schemas', () => {
      docService.registerSchema('User', {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      });

      docService.registerSchema('Horse', {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          breed: { type: 'string' },
        },
      });

      const spec = docService.generateDocumentation();

      expect(spec.components.schemas.User).toBeDefined();
      expect(spec.components.schemas.User.type).toBe('object');
      expect(spec.components.schemas.User.properties.name.type).toBe('string');

      expect(spec.components.schemas.Horse).toBeDefined();
      expect(spec.components.schemas.Horse.properties.breed.type).toBe('string');
    });

    test('adds generation metadata to specification', () => {
      docService.registerEndpoint('GET', '/api/test', { summary: 'Test' });
      docService.registerSchema('TestSchema', { type: 'object' });

      const spec = docService.generateDocumentation();

      expect(spec.info['x-generated']).toBeDefined();
      expect(spec.info['x-generated'].timestamp).toBeDefined();
      expect(spec.info['x-generated'].endpointCount).toBe(1);
      expect(spec.info['x-generated'].schemaCount).toBe(1);
      expect(spec.info['x-generated'].generator).toBe('ApiDocumentationService');
    });
  });

  describe('Specification Validation', () => {
    test('validates correct specification', () => {
      const validation = docService.validateSpecification();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.timestamp).toBeDefined();
    });

    test('detects missing responses', () => {
      // Create spec with missing responses
      const invalidSpec = `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  /test:
    get:
      summary: Test endpoint
      tags: ['Test']
      # Missing responses
`;
      writeFileSync(testSwaggerPath, invalidSpec.trim());

      const validation = docService.validateSpecification();

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Missing responses'))).toBe(true);
    });

    test('detects missing summaries', () => {
      const invalidSpec = `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  /test:
    get:
      # Missing summary
      tags: ['Test']
      responses:
        '200':
          description: Success
`;
      writeFileSync(testSwaggerPath, invalidSpec.trim());

      const validation = docService.validateSpecification();

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Missing summary'))).toBe(true);
    });

    test('detects missing tags', () => {
      const invalidSpec = `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  /test:
    get:
      summary: Test endpoint
      # Missing tags
      responses:
        '200':
          description: Success
`;
      writeFileSync(testSwaggerPath, invalidSpec.trim());

      const validation = docService.validateSpecification();

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Missing tags'))).toBe(true);
    });
  });

  describe('Metrics and Analytics', () => {
    test('calculates metrics correctly', () => {
      // Add some test data to the spec
      docService.registerEndpoint('GET', '/api/users', {
        summary: 'List users',
        description: 'Get all users',
        tags: ['Users'],
        responses: { '200': { description: 'Success' } },
      });

      docService.registerEndpoint('POST', '/api/users', {
        summary: 'Create user',
        // Missing description
        tags: ['Users'],
        responses: { '201': { description: 'Created' } },
      });

      docService.registerSchema('User', { type: 'object' });
      docService.generateDocumentation();

      const metrics = docService.getMetrics();

      expect(metrics.totalEndpoints).toBe(3); // 2 registered + 1 from test spec
      expect(metrics.documentedEndpoints).toBe(2); // Only fully documented ones
      expect(metrics.coverage).toBeCloseTo(66.67, 1); // 2/3 * 100
      expect(metrics.schemaCount).toBe(2); // 1 registered + 1 from test spec
      expect(metrics.lastUpdated).toBeDefined();
    });

    test('generates health report correctly', () => {
      docService.registerEndpoint('GET', '/api/test', {
        summary: 'Test',
        description: 'Test endpoint',
        tags: ['Test'],
        responses: { '200': { description: 'Success' } },
      });
      docService.generateDocumentation();

      const health = docService.getHealthReport();

      expect(health.status).toBeDefined();
      expect(['healthy', 'needs_attention']).toContain(health.status);
      expect(health.metrics).toBeDefined();
      expect(health.validation).toBeDefined();
      expect(health.recommendations).toBeDefined();
      expect(Array.isArray(health.recommendations)).toBe(true);
      expect(health.timestamp).toBeDefined();
    });

    test('provides recommendations based on metrics', () => {
      // Create scenario with low coverage
      docService.registerEndpoint('GET', '/api/test1', { summary: 'Test 1' }); // Missing description
      docService.registerEndpoint('GET', '/api/test2', { summary: 'Test 2' }); // Missing description
      docService.generateDocumentation();

      const health = docService.getHealthReport();

      expect(health.recommendations.length).toBeGreaterThan(0);
      expect(health.recommendations.some(r => r.includes('coverage'))).toBe(true);
    });
  });

  describe('Example Generation', () => {
    test('generates string examples correctly', () => {
      const stringSchema = { type: 'string', example: 'test value' };
      const example = docService.generateSchemaExample(stringSchema);
      expect(example).toBe('test value');
    });

    test('generates email format examples', () => {
      const emailSchema = { type: 'string', format: 'email' };
      const example = docService.generateSchemaExample(emailSchema);
      expect(example).toBe('user@example.com');
    });

    test('generates UUID format examples', () => {
      const uuidSchema = { type: 'string', format: 'uuid' };
      const example = docService.generateSchemaExample(uuidSchema);
      expect(example).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    test('generates object examples correctly', () => {
      const objectSchema = {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'John Doe' },
          age: { type: 'integer', example: 30 },
          active: { type: 'boolean', example: true },
        },
      };

      const example = docService.generateSchemaExample(objectSchema);

      expect(example).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        age: 30,
        active: true,
      });
    });

    test('generates array examples correctly', () => {
      const arraySchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
      };

      const example = docService.generateSchemaExample(arraySchema);

      expect(Array.isArray(example)).toBe(true);
      expect(example).toHaveLength(1);
      expect(example[0]).toHaveProperty('id');
      expect(example[0]).toHaveProperty('name');
    });
  });

  describe('Helper Functions', () => {
    test('registerEndpoint helper function works', () => {
      const endpointInfo = registerEndpoint('GET', '/api/helper-test', {
        summary: 'Helper test',
        tags: ['Test'],
      });

      expect(endpointInfo).toBeDefined();
      expect(endpointInfo.method).toBe('GET');
      expect(endpointInfo.path).toBe('/api/helper-test');
    });

    test('registerSchema helper function works', () => {
      registerSchema('HelperTestSchema', {
        type: 'object',
        properties: { id: { type: 'string' } },
      });

      const service = getApiDocumentationService();
      expect(service.schemaRegistry.has('HelperTestSchema')).toBe(true);
    });

    test('getDocumentationMetrics helper function works', () => {
      const metrics = getDocumentationMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalEndpoints).toBeDefined();
      expect(metrics.coverage).toBeDefined();
    });

    test('getDocumentationHealth helper function works', () => {
      const health = getDocumentationHealth();

      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(health.metrics).toBeDefined();
      expect(health.validation).toBeDefined();
    });
  });
});
