/**
 * Admin API-doc handlers (Equoria-7osu4), moved out of adminController.mjs
 * unchanged (Equoria-puj1e.5) so that file stays under the size threshold.
 *
 *   POST /api/admin/docs/generate   — regenerate the OpenAPI spec
 *   POST /api/admin/docs/endpoints  — register an API endpoint for docs
 *   POST /api/admin/docs/schemas    — register a schema for docs
 *
 * All require the admin role (adminRouter in app.mjs).
 */

import {
  getDocumentationMetrics,
  registerEndpoint,
  registerSchema,
  generateDocumentation,
} from '../../../services/apiDocumentationService.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * POST /api/v1/admin/docs/generate (Equoria-7osu4)
 *
 * Regenerate the OpenAPI spec from the in-memory endpoint/schema registry.
 * This is a privileged, disk-writing mutation: `generateDocumentation()`
 * serializes the merged spec back to the curated `swagger.yaml`. It was
 * previously reachable on the PUBLIC /docs router with only a per-route
 * `authenticateToken` (no admin gating, no CSRF), so any authenticated
 * non-admin could force the disk write. It now lives ONLY here, behind the
 * adminRouter's authenticateToken + requireRole('admin') + csrfProtection chain.
 */
export async function generateApiDocumentation(req, res) {
  try {
    logger.info(
      '[adminController] POST /api/v1/admin/docs/generate — Generating API documentation',
    );

    const specification = generateDocumentation();
    const metrics = getDocumentationMetrics();

    return res.json({
      success: true,
      message: 'Documentation generated successfully',
      data: {
        endpointsGenerated: metrics.totalEndpoints,
        schemasGenerated: metrics.schemaCount,
        coverage: metrics.coverage,
        generatedAt: new Date().toISOString(),
        specificationVersion: specification.info.version,
      },
    });
  } catch (error) {
    logger.error(`[adminController] POST /api/v1/admin/docs/generate error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to generate documentation',
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/admin/docs/endpoints (Equoria-7osu4)
 *
 * Register an endpoint into the documentation registry. Relocated from the
 * PUBLIC /docs router (see generateApiDocumentation above for the same
 * privilege-escalation rationale). Validation is performed inline so this
 * handler keeps the same { success:false, message:'Validation failed', errors }
 * 400 contract the route previously returned.
 */
export async function registerApiEndpoint(req, res) {
  try {
    const {
      method,
      path,
      summary,
      description,
      tags,
      parameters,
      requestBody,
      responses,
      security,
    } = req.body || {};

    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const errors = [];
    if (!validMethods.includes(method)) {
      errors.push({ field: 'method', message: 'Invalid HTTP method' });
    }
    if (!path || typeof path !== 'string' || path.trim() === '') {
      errors.push({ field: 'path', message: 'Path is required' });
    }
    if (!summary || typeof summary !== 'string' || summary.trim() === '') {
      errors.push({ field: 'summary', message: 'Summary is required' });
    }
    if (description !== undefined && typeof description !== 'string') {
      errors.push({ field: 'description', message: 'Description must be a string' });
    }
    if (tags !== undefined && !Array.isArray(tags)) {
      errors.push({ field: 'tags', message: 'Tags must be an array' });
    }
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    logger.info(
      `[adminController] POST /api/v1/admin/docs/endpoints — Registering endpoint: ${method} ${path}`,
    );

    const endpointInfo = registerEndpoint(method, path, {
      summary,
      description,
      tags: tags || [],
      parameters: parameters || [],
      requestBody,
      responses: responses || {},
      security: security || [],
    });

    return res.status(201).json({
      success: true,
      message: 'Endpoint registered successfully',
      data: endpointInfo,
    });
  } catch (error) {
    logger.error(`[adminController] POST /api/v1/admin/docs/endpoints error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to register endpoint',
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/admin/docs/schemas (Equoria-7osu4)
 *
 * Register a schema into the documentation registry. Relocated from the
 * PUBLIC /docs router (same privilege-escalation rationale as above).
 */
export async function registerApiSchema(req, res) {
  try {
    const { name, schema } = req.body || {};

    const errors = [];
    if (!name || typeof name !== 'string' || name.trim() === '') {
      errors.push({ field: 'name', message: 'Schema name is required' });
    }
    if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
      errors.push({ field: 'schema', message: 'Schema must be an object' });
    }
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    logger.info(`[adminController] POST /api/v1/admin/docs/schemas — Registering schema: ${name}`);

    registerSchema(name, schema);

    return res.status(201).json({
      success: true,
      message: 'Schema registered successfully',
      data: {
        name,
        registeredAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`[adminController] POST /api/v1/admin/docs/schemas error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to register schema',
      error: error.message,
    });
  }
}
