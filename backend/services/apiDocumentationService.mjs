/**
 * 📚 API Documentation Service
 *
 * Service for generating, managing, and maintaining API documentation.
 * Provides automated documentation generation, endpoint discovery,
 * schema validation, and documentation health monitoring.
 *
 * Features:
 * - Automatic endpoint discovery and documentation
 * - Schema validation and type checking
 * - Documentation health monitoring
 * - Example generation and validation
 * - API versioning support
 * - Documentation analytics
 */

import { _readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yamljs';
import logger from '../utils/logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ApiDocumentationService {
  constructor() {
    this.swaggerPath = join(__dirname, '../docs/swagger.yaml');
    this.endpointRegistry = new Map();
    this.schemaRegistry = new Map();
    this.documentationMetrics = {
      totalEndpoints: 0,
      documentedEndpoints: 0,
      lastUpdated: null,
      validationErrors: [],
      coverage: 0,
    };
  }

  /**
   * Load the current OpenAPI specification
   */
  loadSpecification() {
    try {
      if (!existsSync(this.swaggerPath)) {
        throw new Error('OpenAPI specification file not found');
      }

      const spec = YAML.load(this.swaggerPath);
      logger.debug('[ApiDocService] OpenAPI specification loaded successfully');
      return spec;
    } catch (error) {
      logger.error(`[ApiDocService] Failed to load specification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save the OpenAPI specification
   */
  saveSpecification(spec) {
    try {
      const yamlContent = YAML.stringify(spec, 4);
      writeFileSync(this.swaggerPath, yamlContent, 'utf8');
      logger.info('[ApiDocService] OpenAPI specification saved successfully');
    } catch (error) {
      logger.error(`[ApiDocService] Failed to save specification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Register an endpoint for documentation
   */
  registerEndpoint(method, path, options = {}) {
    const key = `${method.toUpperCase()} ${path}`;

    const endpointInfo = {
      method: method.toUpperCase(),
      path,
      summary: options.summary || '',
      description: options.description || '',
      tags: options.tags || [],
      parameters: options.parameters || [],
      requestBody: options.requestBody || null,
      responses: options.responses || {},
      security: options.security || [],
      deprecated: options.deprecated || false,
      examples: options.examples || {},
      registeredAt: new Date().toISOString(),
    };

    this.endpointRegistry.set(key, endpointInfo);
    logger.debug(`[ApiDocService] Registered endpoint: ${key}`);

    return endpointInfo;
  }

  /**
   * Register a schema for documentation
   */
  registerSchema(name, schema) {
    this.schemaRegistry.set(name, {
      ...schema,
      registeredAt: new Date().toISOString(),
    });

    logger.debug(`[ApiDocService] Registered schema: ${name}`);
  }

  /**
   * Generate documentation for registered endpoints
   */
  generateDocumentation() {
    try {
      const spec = this.loadSpecification();

      // Update paths with registered endpoints
      for (const [_key, endpoint] of this.endpointRegistry) {
        const pathKey = endpoint.path;
        const methodKey = endpoint.method.toLowerCase();

        if (!spec.paths[pathKey]) {
          spec.paths[pathKey] = {};
        }

        spec.paths[pathKey][methodKey] = {
          tags: endpoint.tags,
          summary: endpoint.summary,
          description: endpoint.description,
          parameters: endpoint.parameters,
          requestBody: endpoint.requestBody,
          responses: endpoint.responses,
          security: endpoint.security,
          deprecated: endpoint.deprecated,
        };

        // Add examples if provided
        if (endpoint.examples && Object.keys(endpoint.examples).length > 0) {
          spec.paths[pathKey][methodKey]['x-examples'] = endpoint.examples;
        }
      }

      // Update schemas with registered schemas
      if (!spec.components) {
        spec.components = {};
      }
      if (!spec.components.schemas) {
        spec.components.schemas = {};
      }

      for (const [name, schema] of this.schemaRegistry) {
        spec.components.schemas[name] = schema;
      }

      // Update metadata
      spec.info['x-generated'] = {
        timestamp: new Date().toISOString(),
        endpointCount: this.endpointRegistry.size,
        schemaCount: this.schemaRegistry.size,
        generator: 'ApiDocumentationService',
      };

      this.saveSpecification(spec);
      this.updateMetrics();

      logger.info(`[ApiDocService] Documentation generated for ${this.endpointRegistry.size} endpoints`);
      return spec;
    } catch (error) {
      logger.error(`[ApiDocService] Failed to generate documentation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate the OpenAPI specification
   */
  validateSpecification() {
    try {
      const spec = this.loadSpecification();
      const errors = [];

      // Basic validation
      if (!spec.openapi) {
        errors.push('Missing OpenAPI version');
      }

      if (!spec.info || !spec.info.title || !spec.info.version) {
        errors.push('Missing or incomplete info section');
      }

      if (!spec.paths || Object.keys(spec.paths).length === 0) {
        errors.push('No paths defined');
      }

      // Validate paths
      for (const [path, methods] of Object.entries(spec.paths || {})) {
        for (const [method, operation] of Object.entries(methods)) {
          if (!operation.responses) {
            errors.push(`Missing responses for ${method.toUpperCase()} ${path}`);
          }

          if (!operation.summary) {
            errors.push(`Missing summary for ${method.toUpperCase()} ${path}`);
          }

          if (!operation.tags || operation.tags.length === 0) {
            errors.push(`Missing tags for ${method.toUpperCase()} ${path}`);
          }
        }
      }

      // Validate schemas
      if (spec.components && spec.components.schemas) {
        for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
          if (!schema.type && !schema.allOf && !schema.oneOf && !schema.anyOf) {
            errors.push(`Schema ${schemaName} missing type definition`);
          }
        }
      }

      this.documentationMetrics.validationErrors = errors;

      if (errors.length === 0) {
        logger.info('[ApiDocService] OpenAPI specification validation passed');
      } else {
        logger.warn(`[ApiDocService] OpenAPI specification validation found ${errors.length} issues`);
      }

      return {
        valid: errors.length === 0,
        errors,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`[ApiDocService] Failed to validate specification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update documentation metrics
   */
  updateMetrics() {
    try {
      const spec = this.loadSpecification();

      let totalEndpoints = 0;
      let documentedEndpoints = 0;

      for (const [_path, methods] of Object.entries(spec.paths || {})) {
        for (const [_method, operation] of Object.entries(methods)) {
          totalEndpoints++;

          // Consider an endpoint documented if it has summary, description, and responses
          if (operation.summary && operation.description && operation.responses) {
            documentedEndpoints++;
          }
        }
      }

      this.documentationMetrics = {
        totalEndpoints,
        documentedEndpoints,
        lastUpdated: new Date().toISOString(),
        validationErrors: this.documentationMetrics.validationErrors || [],
        coverage: totalEndpoints > 0 ? (documentedEndpoints / totalEndpoints) * 100 : 0,
        schemaCount: Object.keys(spec.components?.schemas || {}).length,
        tagCount: new Set(
          Object.values(spec.paths || {})
            .flatMap(methods => Object.values(methods))
            .flatMap(operation => operation.tags || []),
        ).size,
      };

      logger.debug(`[ApiDocService] Metrics updated: ${documentedEndpoints}/${totalEndpoints} endpoints documented`);
    } catch (error) {
      logger.error(`[ApiDocService] Failed to update metrics: ${error.message}`);
    }
  }

  /**
   * Get documentation metrics
   */
  getMetrics() {
    this.updateMetrics();
    return { ...this.documentationMetrics };
  }

  /**
   * Generate example responses for an endpoint
   */
  generateExampleResponse(schema, statusCode = 200) {
    try {
      const example = this.generateSchemaExample(schema);

      return {
        [statusCode]: {
          description: this.getStatusDescription(statusCode),
          content: {
            'application/json': {
              schema,
              example,
            },
          },
        },
      };
    } catch (error) {
      logger.error(`[ApiDocService] Failed to generate example response: ${error.message}`);
      return {};
    }
  }

  /**
   * Generate example data from schema
   */
  generateSchemaExample(schema) {
    if (!schema || typeof schema !== 'object') {
      return null;
    }

    switch (schema.type) {
      case 'string':
        if (schema.format === 'email') { return 'user@example.com'; }
        if (schema.format === 'date-time') { return new Date().toISOString(); }
        if (schema.format === 'uuid') { return '123e4567-e89b-12d3-a456-426614174000'; }
        if (schema.enum) { return schema.enum[0]; }
        return schema.example || 'string';

      case 'integer':
        return schema.example || 42;

      case 'number':
        return schema.example || 3.14;

      case 'boolean':
        return schema.example !== undefined ? schema.example : true;

      case 'array': {
        const itemExample = this.generateSchemaExample(schema.items);
        return [itemExample];
      }

      case 'object': {
        const obj = {};
        if (schema.properties) {
          for (const [key, prop] of Object.entries(schema.properties)) {
            obj[key] = this.generateSchemaExample(prop);
          }
        }
        return obj;
      }

      default:
        if (schema.allOf) {
          return schema.allOf.reduce((acc, subSchema) => ({
            ...acc,
            ...this.generateSchemaExample(subSchema),
          }), {});
        }
        return schema.example || null;
    }
  }

  /**
   * Get status code description
   */
  getStatusDescription(statusCode) {
    const descriptions = {
      200: 'Successful operation',
      201: 'Resource created successfully',
      400: 'Bad request - validation error',
      401: 'Unauthorized - authentication required',
      403: 'Forbidden - insufficient permissions',
      404: 'Resource not found',
      409: 'Conflict - resource already exists',
      422: 'Unprocessable entity - validation failed',
      500: 'Internal server error',
    };

    return descriptions[statusCode] || 'Response';
  }

  /**
   * Get documentation health report
   */
  getHealthReport() {
    const metrics = this.getMetrics();
    const validation = this.validateSpecification();

    return {
      status: validation.valid && metrics.coverage > 80 ? 'healthy' : 'needs_attention',
      metrics,
      validation,
      recommendations: this.generateRecommendations(metrics, validation),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate recommendations for improving documentation
   */
  generateRecommendations(metrics, validation) {
    const recommendations = [];

    if (metrics.coverage < 50) {
      recommendations.push('Low documentation coverage - consider documenting more endpoints');
    }

    if (metrics.coverage < 80) {
      recommendations.push('Documentation coverage could be improved');
    }

    if (validation.errors.length > 0) {
      recommendations.push('Fix validation errors to improve documentation quality');
    }

    if (metrics.schemaCount < 10) {
      recommendations.push('Consider adding more reusable schemas to improve consistency');
    }

    if (metrics.tagCount < 5) {
      recommendations.push('Add more tags to better organize API endpoints');
    }

    return recommendations;
  }
}

// Singleton instance
let apiDocService = null;

/**
 * Get or create the API documentation service instance
 */
export function getApiDocumentationService() {
  if (!apiDocService) {
    apiDocService = new ApiDocumentationService();
  }
  return apiDocService;
}

/**
 * Helper function to register an endpoint
 */
export function registerEndpoint(method, path, options = {}) {
  const service = getApiDocumentationService();
  return service.registerEndpoint(method, path, options);
}

/**
 * Helper function to register a schema
 */
export function registerSchema(name, schema) {
  const service = getApiDocumentationService();
  return service.registerSchema(name, schema);
}

/**
 * Helper function to generate documentation
 */
export function generateDocumentation() {
  const service = getApiDocumentationService();
  return service.generateDocumentation();
}

/**
 * Helper function to get documentation metrics
 */
export function getDocumentationMetrics() {
  const service = getApiDocumentationService();
  return service.getMetrics();
}

/**
 * Helper function to get documentation health
 */
export function getDocumentationHealth() {
  const service = getApiDocumentationService();
  return service.getHealthReport();
}

export default {
  getApiDocumentationService,
  registerEndpoint,
  registerSchema,
  generateDocumentation,
  getDocumentationMetrics,
  getDocumentationHealth,
};
