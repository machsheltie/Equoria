/**
 * 📚 User Documentation Routes
 *
 * REST API endpoints for serving user-friendly documentation including:
 * - Feature guides and tutorials
 * - Strategy guides and advanced techniques
 * - Troubleshooting guides and problem resolution
 * - FAQ sections and common questions
 * - Documentation search and analytics
 *
 * Features:
 * - Content serving with caching
 * - Full-text search capabilities
 * - Analytics and usage tracking
 * - Table of contents generation
 * - Mobile-optimized responses
 */

import express from 'express';
import { query, validationResult } from 'express-validator';
import {
  getUserDocumentationService,
  getDocument,
  searchDocumentation,
  getAllDocuments,
  getDocumentationAnalytics,
  getTableOfContents,
} from '../services/userDocumentationService.mjs';
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
 * GET /api/user-docs
 * Get list of all available documentation
 */
router.get('/',
  async (req, res) => {
    try {
      logger.info('[UserDocRoutes] Getting all documentation list');

      const documents = getAllDocuments();
      const toc = getTableOfContents();

      res.json({
        success: true,
        message: 'Documentation list retrieved successfully',
        data: {
          documents,
          tableOfContents: toc,
          totalDocuments: documents.length,
        },
      });
    } catch (error) {
      logger.error(`[UserDocRoutes] Error getting documentation list: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve documentation list',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/user-docs/search
 * Search documentation content
 */
router.get('/search',
  query('q').notEmpty().withMessage('Search query is required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('includeContent').optional().isBoolean().withMessage('includeContent must be boolean'),
  query('highlight').optional().isBoolean().withMessage('highlight must be boolean'),
  validateRequest,
  async (req, res) => {
    try {
      const { q: query, limit = 10, includeContent = false, highlight = true } = req.query;

      logger.info(`[UserDocRoutes] Searching documentation for: "${query}"`);

      const searchResults = searchDocumentation(query, {
        limit: parseInt(limit),
        includeContent: includeContent === 'true',
        highlightMatches: highlight === 'true',
      });

      res.json({
        success: true,
        message: 'Search completed successfully',
        data: searchResults,
      });
    } catch (error) {
      logger.error(`[UserDocRoutes] Error searching documentation: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to search documentation',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/user-docs/analytics
 * Get documentation usage analytics
 */
router.get('/analytics',
  async (req, res) => {
    try {
      logger.info('[UserDocRoutes] Getting documentation analytics');

      const analytics = getDocumentationAnalytics();

      if (!analytics) {
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve analytics data',
        });
      }

      res.json({
        success: true,
        message: 'Analytics retrieved successfully',
        data: analytics,
      });
    } catch (error) {
      logger.error(`[UserDocRoutes] Error getting analytics: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/user-docs/toc
 * Get table of contents for all documentation
 */
router.get('/toc',
  async (req, res) => {
    try {
      logger.info('[UserDocRoutes] Getting table of contents');

      const toc = getTableOfContents();

      res.json({
        success: true,
        message: 'Table of contents retrieved successfully',
        data: {
          tableOfContents: toc,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error(`[UserDocRoutes] Error getting table of contents: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve table of contents',
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/user-docs/refresh
 * Refresh documentation cache (admin only)
 */
router.post('/refresh',
  async (req, res) => {
    try {
      logger.info('[UserDocRoutes] Refreshing documentation cache');

      const docService = getUserDocumentationService();
      const success = docService.refreshDocumentation();

      if (success) {
        res.json({
          success: true,
          message: 'Documentation cache refreshed successfully',
          data: {
            refreshedAt: new Date().toISOString(),
            totalDocuments: docService.contentCache.size,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to refresh documentation cache',
        });
      }
    } catch (error) {
      logger.error(`[UserDocRoutes] Error refreshing documentation: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh documentation',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/user-docs/health
 * Health check for documentation system
 */
router.get('/health',
  async (req, res) => {
    try {
      const docService = getUserDocumentationService();
      const analytics = getDocumentationAnalytics();

      const health = {
        status: 'healthy',
        documentsLoaded: docService.contentCache.size,
        searchIndexSize: docService.searchIndex.size,
        totalViews: analytics ? analytics.totalViews : 0,
        lastUpdated: analytics ? analytics.lastUpdated : null,
        systemTime: new Date().toISOString(),
      };

      res.json({
        success: true,
        message: 'Documentation system is healthy',
        data: health,
      });
    } catch (error) {
      logger.error(`[UserDocRoutes] Health check failed: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Documentation system health check failed',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/user-docs/:docName
 * Get specific documentation by name
 */
router.get('/:docName',
  async (req, res) => {
    try {
      const { docName } = req.params;
      const { format = 'json' } = req.query;

      logger.info(`[UserDocRoutes] Getting document: ${docName}`);

      const document = getDocument(docName);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: `Documentation "${docName}" not found`,
          availableDocuments: getAllDocuments().map(doc => doc.name),
        });
      }

      // Handle different response formats
      if (format === 'markdown' || format === 'md') {
        res.setHeader('Content-Type', 'text/markdown');
        res.send(document.content);
        return;
      }

      if (format === 'text' || format === 'txt') {
        res.setHeader('Content-Type', 'text/plain');
        res.send(document.content.replace(/[#*`[\]()]/g, ''));
        return;
      }

      // Default JSON response
      res.json({
        success: true,
        message: 'Document retrieved successfully',
        data: document,
      });
    } catch (error) {
      logger.error(`[UserDocRoutes] Error getting document: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve document',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/user-docs/:docName/sections
 * Get sections/table of contents for a specific document
 */
router.get('/:docName/sections',
  async (req, res) => {
    try {
      const { docName } = req.params;

      logger.info(`[UserDocRoutes] Getting sections for document: ${docName}`);

      const document = getDocument(docName);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: `Documentation "${docName}" not found`,
        });
      }

      const sections = document.sections.map(section => ({
        title: section.title,
        level: section.level,
        anchor: section.title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-'),
      }));

      res.json({
        success: true,
        message: 'Document sections retrieved successfully',
        data: {
          documentName: docName,
          documentTitle: document.title,
          sections,
          totalSections: sections.length,
        },
      });
    } catch (error) {
      logger.error(`[UserDocRoutes] Error getting document sections: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve document sections',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/user-docs/:docName/search
 * Search within a specific document
 */
router.get('/:docName/search',
  query('q').notEmpty().withMessage('Search query is required'),
  query('highlight').optional().isBoolean().withMessage('highlight must be boolean'),
  validateRequest,
  async (req, res) => {
    try {
      const { docName } = req.params;
      const { q: query, highlight = true } = req.query;

      logger.info(`[UserDocRoutes] Searching in document "${docName}" for: "${query}"`);

      const document = getDocument(docName);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: `Documentation "${docName}" not found`,
        });
      }

      // Simple search within document content
      const searchTerms = query.toLowerCase().split(/\s+/);
      const _content = document.content.toLowerCase();

      const matches = [];
      const lines = document.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();

        for (const term of searchTerms) {
          if (lowerLine.includes(term)) {
            matches.push({
              lineNumber: i + 1,
              content: highlight === 'true'
                ? line.replace(new RegExp(term, 'gi'), `**${term}**`)
                : line,
              context: {
                before: i > 0 ? lines[i - 1] : null,
                after: i < lines.length - 1 ? lines[i + 1] : null,
              },
            });
            break;
          }
        }
      }

      res.json({
        success: true,
        message: 'Document search completed successfully',
        data: {
          documentName: docName,
          documentTitle: document.title,
          query,
          matches,
          totalMatches: matches.length,
        },
      });
    } catch (error) {
      logger.error(`[UserDocRoutes] Error searching document: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to search document',
        error: error.message,
      });
    }
  },
);

export default router;
