/**
 * 📚 Swagger Documentation Setup
 * 
 * Express middleware for serving interactive API documentation using Swagger UI.
 * Provides comprehensive API documentation with examples, authentication guides,
 * and interactive testing capabilities.
 * 
 * Features:
 * - Interactive API explorer with Swagger UI
 * - OpenAPI 3.0 specification
 * - Authentication flow documentation
 * - Request/response examples
 * - Schema validation
 * - Code generation support
 */

import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import logger from '../utils/logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load and parse the OpenAPI specification
 */
function loadSwaggerSpec() {
  try {
    const swaggerPath = join(__dirname, '../docs/swagger.yaml');
    const swaggerDocument = YAML.load(swaggerPath);
    
    // Add dynamic server configuration based on environment
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    swaggerDocument.servers = [
      {
        url: `${baseUrl}/api`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ];
    
    // Add build information
    swaggerDocument.info.version = process.env.API_VERSION || '1.2.0';
    swaggerDocument.info['x-build'] = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    };
    
    logger.info('[SwaggerSetup] OpenAPI specification loaded successfully');
    return swaggerDocument;
  } catch (error) {
    logger.error(`[SwaggerSetup] Failed to load OpenAPI specification: ${error.message}`);
    throw error;
  }
}

/**
 * Swagger UI configuration options
 */
const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'list',
    filter: true,
    showRequestDuration: true,
    tryItOutEnabled: true,
    requestInterceptor: (req) => {
      // Add custom headers or modify requests
      req.headers['X-API-Client'] = 'Swagger-UI';
      return req;
    },
    responseInterceptor: (res) => {
      // Log API responses for debugging
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`[SwaggerUI] API Response: ${res.status} ${res.url}`);
      }
      return res;
    },
    persistAuthorization: true,
    displayRequestDuration: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    showExtensions: true,
    showCommonExtensions: true,
  },
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { color: #2c3e50; }
    .swagger-ui .scheme-container { background: #f8f9fa; padding: 15px; border-radius: 5px; }
    .swagger-ui .auth-wrapper { margin: 20px 0; }
    .swagger-ui .btn.authorize { background-color: #3498db; border-color: #3498db; }
    .swagger-ui .btn.authorize:hover { background-color: #2980b9; border-color: #2980b9; }
    .swagger-ui .response-col_status { font-weight: bold; }
    .swagger-ui .response.highlighted { border-left: 4px solid #27ae60; }
    .swagger-ui .opblock.opblock-post { border-color: #27ae60; }
    .swagger-ui .opblock.opblock-get { border-color: #3498db; }
    .swagger-ui .opblock.opblock-put { border-color: #f39c12; }
    .swagger-ui .opblock.opblock-delete { border-color: #e74c3c; }
  `,
  customSiteTitle: 'Equoria API Documentation',
  customfavIcon: '/favicon.ico',
};

/**
 * Custom CSS for enhanced styling
 */
const customCss = `
  .swagger-ui {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }
  
  .swagger-ui .info .title {
    font-size: 2.5em;
    color: #2c3e50;
    margin-bottom: 10px;
  }
  
  .swagger-ui .info .description {
    font-size: 1.1em;
    line-height: 1.6;
    color: #34495e;
  }
  
  .swagger-ui .info .description h1 {
    color: #2c3e50;
    border-bottom: 2px solid #3498db;
    padding-bottom: 10px;
  }
  
  .swagger-ui .info .description h2 {
    color: #34495e;
    margin-top: 30px;
  }
  
  .swagger-ui .info .description code {
    background-color: #f8f9fa;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Monaco', 'Consolas', monospace;
  }
  
  .swagger-ui .info .description pre {
    background-color: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 5px;
    padding: 15px;
    overflow-x: auto;
  }
  
  .swagger-ui .auth-wrapper {
    background-color: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 5px;
    padding: 15px;
    margin: 20px 0;
  }
  
  .swagger-ui .auth-wrapper .auth-container .auth-btn-wrapper {
    text-align: center;
  }
  
  .swagger-ui .opblock-tag {
    font-size: 1.3em;
    font-weight: 600;
    color: #2c3e50;
    border-bottom: 2px solid #ecf0f1;
    padding-bottom: 10px;
    margin-bottom: 15px;
  }
  
  .swagger-ui .opblock {
    margin-bottom: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .swagger-ui .opblock .opblock-summary {
    padding: 15px;
  }
  
  .swagger-ui .opblock .opblock-summary-method {
    font-weight: 700;
    min-width: 80px;
    text-align: center;
    border-radius: 4px;
  }
  
  .swagger-ui .response-col_status {
    font-weight: 700;
    font-size: 1.1em;
  }
  
  .swagger-ui .response-col_status.response-200 {
    color: #27ae60;
  }
  
  .swagger-ui .response-col_status.response-201 {
    color: #27ae60;
  }
  
  .swagger-ui .response-col_status.response-400 {
    color: #e74c3c;
  }
  
  .swagger-ui .response-col_status.response-401 {
    color: #e67e22;
  }
  
  .swagger-ui .response-col_status.response-404 {
    color: #e74c3c;
  }
  
  .swagger-ui .response-col_status.response-500 {
    color: #c0392b;
  }
`;

/**
 * Setup Swagger documentation middleware
 */
export function setupSwaggerDocs(app) {
  try {
    const swaggerDocument = loadSwaggerSpec();
    
    // Serve Swagger UI at /api-docs
    app.use('/api-docs', swaggerUi.serve);
    app.get('/api-docs', swaggerUi.setup(swaggerDocument, {
      ...swaggerOptions,
      customCss: customCss,
    }));
    
    // Serve raw OpenAPI spec at /api-docs/swagger.json
    app.get('/api-docs/swagger.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerDocument);
    });
    
    // Serve OpenAPI spec in YAML format at /api-docs/swagger.yaml
    app.get('/api-docs/swagger.yaml', (req, res) => {
      try {
        const yamlContent = readFileSync(join(__dirname, '../docs/swagger.yaml'), 'utf8');
        res.setHeader('Content-Type', 'text/yaml');
        res.send(yamlContent);
      } catch (error) {
        logger.error(`[SwaggerSetup] Failed to serve YAML spec: ${error.message}`);
        res.status(500).json({ error: 'Failed to load YAML specification' });
      }
    });
    
    // Health check for documentation
    app.get('/api-docs/health', (req, res) => {
      res.json({
        success: true,
        message: 'API documentation is available',
        endpoints: {
          interactive: '/api-docs',
          json: '/api-docs/swagger.json',
          yaml: '/api-docs/swagger.yaml',
        },
        version: swaggerDocument.info.version,
        lastUpdated: swaggerDocument.info['x-build']?.timestamp,
      });
    });
    
    logger.info('[SwaggerSetup] API documentation setup completed');
    logger.info('[SwaggerSetup] Interactive docs available at: /api-docs');
    logger.info('[SwaggerSetup] OpenAPI JSON available at: /api-docs/swagger.json');
    logger.info('[SwaggerSetup] OpenAPI YAML available at: /api-docs/swagger.yaml');
    
  } catch (error) {
    logger.error(`[SwaggerSetup] Failed to setup Swagger documentation: ${error.message}`);
    throw error;
  }
}

/**
 * Middleware to add API documentation links to responses
 */
export function addDocumentationHeaders() {
  return (req, res, next) => {
    // Add documentation links to response headers
    res.setHeader('X-API-Docs', '/api-docs');
    res.setHeader('X-API-Spec-JSON', '/api-docs/swagger.json');
    res.setHeader('X-API-Spec-YAML', '/api-docs/swagger.yaml');
    
    next();
  };
}

export default {
  setupSwaggerDocs,
  addDocumentationHeaders,
};
