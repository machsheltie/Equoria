/**
 * 📚 Documentation Management Routes
 * 
 * REST API endpoints for managing and monitoring API documentation:
 * - Documentation health and metrics
 * - Specification validation and generation
 * - Endpoint registration and management
 * - Schema management and validation
 * - Documentation analytics and insights
 * 
 * Features:
 * - Real-time documentation metrics
 * - Specification validation
 * - Health monitoring
 * - Coverage analytics
 * - Automated recommendations
 */

import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import {
  getApiDocumentationService,
  getDocumentationMetrics,
  getDocumentationHealth,
  registerEndpoint,
  registerSchema,
  generateDocumentation,
} from '../services/apiDocumentationService.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

/**
 * Validation middleware
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * GET /api/docs/health
 * Get documentation health status and metrics
 */
router.get('/health',
  authenticateToken,
  async (req, res) => {
    try {
      logger.info('[DocumentationRoutes] Getting documentation health status');
      
      const healthReport = getDocumentationHealth();
      
      res.json({
        success: true,
        message: 'Documentation health retrieved successfully',
        data: healthReport,
      });
    } catch (error) {
      logger.error(`[DocumentationRoutes] Error getting documentation health: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve documentation health',
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/docs/metrics
 * Get detailed documentation metrics and analytics
 */
router.get('/metrics',
  authenticateToken,
  async (req, res) => {
    try {
      logger.info('[DocumentationRoutes] Getting documentation metrics');
      
      const metrics = getDocumentationMetrics();
      
      // Calculate additional analytics
      const analytics = {
        coverageGrade: getCoverageGrade(metrics.coverage),
        completionStatus: getCompletionStatus(metrics),
        qualityScore: calculateQualityScore(metrics),
        trends: {
          coverage: metrics.coverage,
          lastUpdated: metrics.lastUpdated,
          validationStatus: metrics.validationErrors.length === 0 ? 'passing' : 'failing',
        },
      };
      
      res.json({
        success: true,
        message: 'Documentation metrics retrieved successfully',
        data: {
          metrics,
          analytics,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error(`[DocumentationRoutes] Error getting documentation metrics: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve documentation metrics',
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/docs/validation
 * Validate the OpenAPI specification
 */
router.get('/validation',
  authenticateToken,
  async (req, res) => {
    try {
      logger.info('[DocumentationRoutes] Validating OpenAPI specification');
      
      const docService = getApiDocumentationService();
      const validationResult = docService.validateSpecification();
      
      const summary = {
        isValid: validationResult.valid,
        errorCount: validationResult.errors.length,
        severity: validationResult.errors.length === 0 ? 'none' : 
                 validationResult.errors.length < 5 ? 'low' : 
                 validationResult.errors.length < 10 ? 'medium' : 'high',
        recommendations: generateValidationRecommendations(validationResult.errors),
      };
      
      res.json({
        success: true,
        message: 'Specification validation completed',
        data: {
          validation: validationResult,
          summary,
        },
      });
    } catch (error) {
      logger.error(`[DocumentationRoutes] Error validating specification: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to validate specification',
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/docs/generate
 * Generate documentation from registered endpoints
 */
router.post('/generate',
  authenticateToken,
  async (req, res) => {
    try {
      logger.info('[DocumentationRoutes] Generating API documentation');
      
      const specification = generateDocumentation();
      const metrics = getDocumentationMetrics();
      
      res.json({
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
      logger.error(`[DocumentationRoutes] Error generating documentation: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to generate documentation',
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/docs/endpoints
 * Register a new endpoint for documentation
 */
router.post('/endpoints',
  authenticateToken,
  body('method').isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).withMessage('Invalid HTTP method'),
  body('path').notEmpty().withMessage('Path is required'),
  body('summary').notEmpty().withMessage('Summary is required'),
  body('description').optional().isString(),
  body('tags').optional().isArray(),
  validateRequest,
  async (req, res) => {
    try {
      const { method, path, summary, description, tags, parameters, requestBody, responses, security } = req.body;
      
      logger.info(`[DocumentationRoutes] Registering endpoint: ${method} ${path}`);
      
      const endpointInfo = registerEndpoint(method, path, {
        summary,
        description,
        tags: tags || [],
        parameters: parameters || [],
        requestBody,
        responses: responses || {},
        security: security || [],
      });
      
      res.status(201).json({
        success: true,
        message: 'Endpoint registered successfully',
        data: endpointInfo,
      });
    } catch (error) {
      logger.error(`[DocumentationRoutes] Error registering endpoint: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to register endpoint',
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/docs/schemas
 * Register a new schema for documentation
 */
router.post('/schemas',
  authenticateToken,
  body('name').notEmpty().withMessage('Schema name is required'),
  body('schema').isObject().withMessage('Schema must be an object'),
  validateRequest,
  async (req, res) => {
    try {
      const { name, schema } = req.body;
      
      logger.info(`[DocumentationRoutes] Registering schema: ${name}`);
      
      registerSchema(name, schema);
      
      res.status(201).json({
        success: true,
        message: 'Schema registered successfully',
        data: {
          name,
          registeredAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error(`[DocumentationRoutes] Error registering schema: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to register schema',
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/docs/coverage
 * Get documentation coverage analysis
 */
router.get('/coverage',
  authenticateToken,
  async (req, res) => {
    try {
      logger.info('[DocumentationRoutes] Getting documentation coverage analysis');
      
      const metrics = getDocumentationMetrics();
      const docService = getApiDocumentationService();
      const spec = docService.loadSpecification();
      
      // Analyze coverage by tag
      const coverageByTag = analyzeCoverageByTag(spec);
      
      // Analyze missing documentation
      const missingDocumentation = findMissingDocumentation(spec);
      
      const coverageAnalysis = {
        overall: {
          percentage: metrics.coverage,
          grade: getCoverageGrade(metrics.coverage),
          documented: metrics.documentedEndpoints,
          total: metrics.totalEndpoints,
        },
        byTag: coverageByTag,
        missing: missingDocumentation,
        recommendations: generateCoverageRecommendations(metrics.coverage, missingDocumentation),
      };
      
      res.json({
        success: true,
        message: 'Coverage analysis completed',
        data: coverageAnalysis,
      });
    } catch (error) {
      logger.error(`[DocumentationRoutes] Error analyzing coverage: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze coverage',
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/docs/analytics
 * Get comprehensive documentation analytics
 */
router.get('/analytics',
  authenticateToken,
  query('timeframe').optional().isIn(['1d', '7d', '30d']).withMessage('Invalid timeframe'),
  validateRequest,
  async (req, res) => {
    try {
      const timeframe = req.query.timeframe || '30d';
      
      logger.info(`[DocumentationRoutes] Getting documentation analytics for timeframe: ${timeframe}`);
      
      const metrics = getDocumentationMetrics();
      const health = getDocumentationHealth();
      
      const analytics = {
        summary: {
          totalEndpoints: metrics.totalEndpoints,
          documentedEndpoints: metrics.documentedEndpoints,
          coverage: metrics.coverage,
          qualityScore: calculateQualityScore(metrics),
          healthStatus: health.status,
        },
        trends: {
          timeframe,
          coverageTrend: 'stable', // Would be calculated from historical data
          qualityTrend: 'improving',
          lastUpdated: metrics.lastUpdated,
        },
        insights: {
          strengths: generateStrengths(metrics, health),
          improvements: generateImprovements(metrics, health),
          priorities: generatePriorities(metrics, health),
        },
      };
      
      res.json({
        success: true,
        message: 'Documentation analytics retrieved successfully',
        data: analytics,
      });
    } catch (error) {
      logger.error(`[DocumentationRoutes] Error getting analytics: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics',
        error: error.message,
      });
    }
  }
);

// Helper functions
function getCoverageGrade(coverage) {
  if (coverage >= 90) return 'A';
  if (coverage >= 80) return 'B';
  if (coverage >= 70) return 'C';
  if (coverage >= 60) return 'D';
  return 'F';
}

function getCompletionStatus(metrics) {
  if (metrics.coverage >= 95) return 'complete';
  if (metrics.coverage >= 80) return 'mostly_complete';
  if (metrics.coverage >= 50) return 'in_progress';
  return 'incomplete';
}

function calculateQualityScore(metrics) {
  let score = 0;
  
  // Coverage weight: 40%
  score += (metrics.coverage / 100) * 40;
  
  // Validation weight: 30%
  score += (metrics.validationErrors.length === 0 ? 1 : 0) * 30;
  
  // Schema count weight: 15%
  score += Math.min(metrics.schemaCount / 20, 1) * 15;
  
  // Tag organization weight: 15%
  score += Math.min(metrics.tagCount / 10, 1) * 15;
  
  return Math.round(score);
}

function generateValidationRecommendations(errors) {
  const recommendations = [];
  
  if (errors.some(e => e.includes('Missing responses'))) {
    recommendations.push('Add response definitions for all endpoints');
  }
  
  if (errors.some(e => e.includes('Missing summary'))) {
    recommendations.push('Add summaries to all endpoints for better documentation');
  }
  
  if (errors.some(e => e.includes('Missing tags'))) {
    recommendations.push('Organize endpoints with appropriate tags');
  }
  
  return recommendations;
}

function analyzeCoverageByTag(spec) {
  const tagCoverage = {};
  
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      const tags = operation.tags || ['untagged'];
      
      for (const tag of tags) {
        if (!tagCoverage[tag]) {
          tagCoverage[tag] = { total: 0, documented: 0 };
        }
        
        tagCoverage[tag].total++;
        
        if (operation.summary && operation.description && operation.responses) {
          tagCoverage[tag].documented++;
        }
      }
    }
  }
  
  // Calculate percentages
  for (const tag of Object.keys(tagCoverage)) {
    const { total, documented } = tagCoverage[tag];
    tagCoverage[tag].percentage = total > 0 ? (documented / total) * 100 : 0;
  }
  
  return tagCoverage;
}

function findMissingDocumentation(spec) {
  const missing = [];
  
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      const issues = [];
      
      if (!operation.summary) issues.push('summary');
      if (!operation.description) issues.push('description');
      if (!operation.responses) issues.push('responses');
      if (!operation.tags || operation.tags.length === 0) issues.push('tags');
      
      if (issues.length > 0) {
        missing.push({
          endpoint: `${method.toUpperCase()} ${path}`,
          missing: issues,
        });
      }
    }
  }
  
  return missing;
}

function generateCoverageRecommendations(coverage, missing) {
  const recommendations = [];
  
  if (coverage < 50) {
    recommendations.push('Focus on documenting core API endpoints first');
  }
  
  if (missing.length > 10) {
    recommendations.push('Prioritize adding summaries and descriptions to endpoints');
  }
  
  if (coverage < 80) {
    recommendations.push('Add comprehensive response documentation');
  }
  
  return recommendations;
}

function generateStrengths(metrics, health) {
  const strengths = [];
  
  if (metrics.coverage > 80) {
    strengths.push('High documentation coverage');
  }
  
  if (metrics.validationErrors.length === 0) {
    strengths.push('Valid OpenAPI specification');
  }
  
  if (metrics.schemaCount > 15) {
    strengths.push('Good schema reusability');
  }
  
  return strengths;
}

function generateImprovements(metrics, health) {
  const improvements = [];
  
  if (metrics.coverage < 80) {
    improvements.push('Increase documentation coverage');
  }
  
  if (metrics.validationErrors.length > 0) {
    improvements.push('Fix specification validation errors');
  }
  
  if (metrics.tagCount < 5) {
    improvements.push('Better organize endpoints with tags');
  }
  
  return improvements;
}

function generatePriorities(metrics, health) {
  const priorities = [];
  
  if (health.status === 'needs_attention') {
    priorities.push('Address documentation health issues');
  }
  
  if (metrics.coverage < 60) {
    priorities.push('Increase basic documentation coverage');
  }
  
  if (metrics.validationErrors.length > 5) {
    priorities.push('Fix critical validation errors');
  }
  
  return priorities;
}

export default router;
