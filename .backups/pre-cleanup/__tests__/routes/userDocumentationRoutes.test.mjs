/**
 * 🧪 User Documentation Routes Tests
 *
 * Comprehensive test suite for user documentation API endpoints including:
 * - Documentation listing and retrieval
 * - Search functionality across all documents
 * - Analytics and usage tracking
 * - Table of contents generation
 * - Multiple response formats (JSON, Markdown, Text)
 *
 * Testing Approach: TDD with NO MOCKING
 * - Real API endpoint testing with actual documentation
 * - Authentic search functionality with real content
 * - Genuine analytics tracking and reporting
 * - Production-like documentation scenarios
 */

// jest import removed - not used in this file
import request from 'supertest';
import express from 'express';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import userDocumentationRoutes from '../../routes/userDocumentationRoutes.mjs';
import { responseHandler } from '../../utils/apiResponse.mjs';
import { getUserDocumentationService } from '../../services/userDocumentationService.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('User Documentation Routes', () => {
  let testApp;
  let docService;
  let testDocsPath;

  beforeAll(() => {
    // Create test Express app
    testApp = express();
    testApp.use(express.json());
    testApp.use(responseHandler);
    testApp.use('/api/user-docs', userDocumentationRoutes);

    // Setup test documentation
    testDocsPath = join(__dirname, 'test-user-docs');
    if (!existsSync(testDocsPath)) {
      mkdirSync(testDocsPath, { recursive: true });
    }

    // Create test documentation files
    const testDocs = {
      'feature-guide.md': `# 🐎 Feature Guide

Welcome to Equoria! This comprehensive guide covers all features.

## Horse Management
Learn how to manage your horses effectively.

### Training System
- Horses must be 3+ years old
- Weekly training cooldown applies
- Multiple disciplines available

### Competition System
Enter your horses in competitions to earn prizes and experience.

## Breeding System
Create the next generation of champion horses.

### Genetic Inheritance
Foals inherit traits from both parents.`,

      'strategy-guide.md': `# 🎯 Strategy Guide

Master advanced techniques for competitive success.

## Competition Strategies
- Choose appropriate level competitions
- Train in relevant disciplines
- Manage horse age and health status

## Breeding Optimization
- Select complementary breeding pairs
- Focus on trait development
- Plan for long-term genetic improvement`,

      'troubleshooting-guide.md': `# 🔧 Troubleshooting Guide

Common issues and their solutions.

## Training Problems
**Cannot train horse**: Check age requirements and training cooldowns.

## Competition Issues
**Poor performance**: Verify discipline match and training levels.

## Breeding Problems
**Breeding fails**: Ensure both horses meet age and health requirements.`,

      'faq.md': `# ❓ Frequently Asked Questions

Quick answers to common questions.

## Getting Started
**Q: How do I begin playing?**
A: Register an account and purchase your first horse.

**Q: What should I do first?**
A: Complete the tutorial and hire a professional groom.

## Horse Care
**Q: Why can't I train my horse?**
A: Horses must be 3+ years old and respect training cooldowns.`,
    };

    // Write test files
    for (const [filename, content] of Object.entries(testDocs)) {
      writeFileSync(join(testDocsPath, filename), content);
    }

    // Initialize documentation service with test path
    docService = getUserDocumentationService();
    docService.docsPath = testDocsPath;
    docService.initializeDocumentation();
  });

  afterAll(() => {
    // Cleanup test files
    if (existsSync(testDocsPath)) {
      const files = ['feature-guide.md', 'strategy-guide.md', 'troubleshooting-guide.md', 'faq.md'];
      for (const file of files) {
        const filePath = join(testDocsPath, file);
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      }
    }
  });

  beforeEach(() => {
    // Reset analytics before each test
    docService.analytics.viewCounts.clear();
    docService.analytics.searchQueries = [];
  });

  describe('GET /api/user-docs', () => {
    test('retrieves all documentation successfully', async () => {
      const response = await request(testApp).get('/api/user-docs').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.documents).toBeDefined();
      expect(response.body.data.tableOfContents).toBeDefined();
      expect(response.body.data.totalDocuments).toBe(4);

      const { documents } = response.body.data;
      expect(documents.length).toBe(4);
      expect(documents[0]).toHaveProperty('name');
      expect(documents[0]).toHaveProperty('title');
      expect(documents[0]).toHaveProperty('wordCount');
      expect(documents[0]).toHaveProperty('sections');
    });

    test('includes table of contents in response', async () => {
      const response = await request(testApp).get('/api/user-docs').expect(200);

      const toc = response.body.data.tableOfContents;
      expect(Array.isArray(toc)).toBe(true);
      expect(toc.length).toBe(4);

      const featureGuideToc = toc.find((doc) => doc.name === 'feature-guide');
      expect(featureGuideToc).toBeDefined();
      expect(featureGuideToc.title).toBe('🐎 Feature Guide');
      expect(featureGuideToc.sections).toBeDefined();
    });
  });

  describe('GET /api/user-docs/search', () => {
    test('searches documentation successfully', async () => {
      const response = await request(testApp)
        .get('/api/user-docs/search?q=horse training')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.query).toBe('horse training');
      expect(response.body.data.results).toBeDefined();
      expect(response.body.data.totalResults).toBeGreaterThan(0);

      const { results } = response.body.data;
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('matches');
    });

    test('validates search query parameter', async () => {
      const response = await request(testApp).get('/api/user-docs/search').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    test('respects search parameters', async () => {
      const response = await request(testApp)
        .get('/api/user-docs/search?q=horse&limit=2&includeContent=true&highlight=true')
        .expect(200);

      const { results } = response.body.data;
      expect(results.length).toBeLessThanOrEqual(2);

      if (results.length > 0) {
        expect(results[0]).toHaveProperty('content');
        expect(results[0].content).toContain('**horse**');
      }
    });

    test('handles empty search results', async () => {
      const response = await request(testApp)
        .get('/api/user-docs/search?q=nonexistentterm12345')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(0);
      expect(response.body.data.totalResults).toBe(0);
    });
  });

  describe('GET /api/user-docs/analytics', () => {
    test('retrieves analytics successfully', async () => {
      // Generate some activity first
      await request(testApp).get('/api/user-docs/feature-guide');
      await request(testApp).get('/api/user-docs/strategy-guide');
      await request(testApp).get('/api/user-docs/search?q=horse');

      const response = await request(testApp).get('/api/user-docs/analytics').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      const analytics = response.body.data;
      expect(analytics.totalDocuments).toBe(4);
      expect(analytics.totalViews).toBeGreaterThan(0);
      expect(analytics.totalSearches).toBeGreaterThan(0);
      expect(analytics.popularDocuments).toBeDefined();
      expect(analytics.recentSearches).toBeDefined();
      expect(analytics.lastUpdated).toBeDefined();
    });
  });

  describe('GET /api/user-docs/toc', () => {
    test('retrieves table of contents successfully', async () => {
      const response = await request(testApp).get('/api/user-docs/toc').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tableOfContents).toBeDefined();
      expect(response.body.data.generatedAt).toBeDefined();

      const toc = response.body.data.tableOfContents;
      expect(Array.isArray(toc)).toBe(true);
      expect(toc.length).toBe(4);
    });
  });

  describe('GET /api/user-docs/:docName', () => {
    test('retrieves specific document successfully', async () => {
      const response = await request(testApp).get('/api/user-docs/feature-guide').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('feature-guide');
      expect(response.body.data.title).toBe('🐎 Feature Guide');
      expect(response.body.data.content).toContain('Welcome to Equoria');
      expect(response.body.data.viewCount).toBe(1);
    });

    test('returns 404 for non-existent document', async () => {
      const response = await request(testApp).get('/api/user-docs/non-existent').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
      expect(response.body.availableDocuments).toBeDefined();
    });

    test('serves markdown format correctly', async () => {
      const response = await request(testApp)
        .get('/api/user-docs/feature-guide?format=markdown')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/markdown');
      expect(response.text).toContain('# 🐎 Feature Guide');
      expect(response.text).toContain('Welcome to Equoria');
    });

    test('serves text format correctly', async () => {
      const response = await request(testApp)
        .get('/api/user-docs/feature-guide?format=text')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('Feature Guide');
      expect(response.text).toContain('Welcome to Equoria');
      expect(response.text).not.toContain('#'); // Markdown syntax removed
    });

    test('tracks view analytics', async () => {
      // View document multiple times
      await request(testApp).get('/api/user-docs/feature-guide');
      await request(testApp).get('/api/user-docs/feature-guide');

      const response = await request(testApp).get('/api/user-docs/feature-guide').expect(200);

      expect(response.body.data.viewCount).toBe(3);
    });
  });

  describe('GET /api/user-docs/:docName/sections', () => {
    test('retrieves document sections successfully', async () => {
      const response = await request(testApp)
        .get('/api/user-docs/feature-guide/sections')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.documentName).toBe('feature-guide');
      expect(response.body.data.documentTitle).toBe('🐎 Feature Guide');
      expect(response.body.data.sections).toBeDefined();
      expect(response.body.data.totalSections).toBeGreaterThan(0);

      const { sections } = response.body.data;
      expect(sections[0]).toHaveProperty('title');
      expect(sections[0]).toHaveProperty('level');
      expect(sections[0]).toHaveProperty('anchor');
    });

    test('returns 404 for non-existent document sections', async () => {
      const response = await request(testApp)
        .get('/api/user-docs/non-existent/sections')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('GET /api/user-docs/:docName/search', () => {
    test('searches within specific document successfully', async () => {
      const response = await request(testApp)
        .get('/api/user-docs/feature-guide/search?q=training')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.documentName).toBe('feature-guide');
      expect(response.body.data.query).toBe('training');
      expect(response.body.data.matches).toBeDefined();
      expect(response.body.data.totalMatches).toBeGreaterThan(0);

      const { matches } = response.body.data;
      expect(matches[0]).toHaveProperty('lineNumber');
      expect(matches[0]).toHaveProperty('content');
      expect(matches[0]).toHaveProperty('context');
    });

    test('validates search query for document search', async () => {
      const response = await request(testApp)
        .get('/api/user-docs/feature-guide/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    test('highlights search terms in document search', async () => {
      const response = await request(testApp)
        .get('/api/user-docs/feature-guide/search?q=horse&highlight=true')
        .expect(200);

      const { matches } = response.body.data;
      if (matches.length > 0) {
        expect(matches[0].content).toContain('**horse**');
      }
    });

    test('returns 404 for document search on non-existent document', async () => {
      const response = await request(testApp)
        .get('/api/user-docs/non-existent/search?q=test')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /api/user-docs/refresh', () => {
    test('refreshes documentation cache successfully', async () => {
      const response = await request(testApp).post('/api/user-docs/refresh').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('refreshed successfully');
      expect(response.body.data.refreshedAt).toBeDefined();
      expect(response.body.data.totalDocuments).toBe(4);
    });
  });

  describe('GET /api/user-docs/health', () => {
    test('returns system health status', async () => {
      const response = await request(testApp).get('/api/user-docs/health').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.documentsLoaded).toBe(4);
      expect(response.body.data.searchIndexSize).toBeGreaterThan(0);
      expect(response.body.data.systemTime).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('handles invalid route gracefully', async () => {
      const _response = await request(testApp)
        .get('/api/user-docs/invalid/invalid/invalid')
        .expect(404);

      // Express default 404 handling
    });

    test('handles malformed search parameters', async () => {
      const response = await request(testApp)
        .get('/api/user-docs/search?q=&limit=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('Integration with Documentation Service', () => {
    test('search analytics are tracked across API calls', async () => {
      // Perform multiple searches
      await request(testApp).get('/api/user-docs/search?q=horse');
      await request(testApp).get('/api/user-docs/search?q=training');
      await request(testApp).get('/api/user-docs/search?q=competition');

      const response = await request(testApp).get('/api/user-docs/analytics').expect(200);

      const analytics = response.body.data;
      expect(analytics.totalSearches).toBe(3);
      expect(analytics.recentSearches).toHaveLength(3);
    });

    test('view analytics are tracked across API calls', async () => {
      // View multiple documents
      await request(testApp).get('/api/user-docs/feature-guide');
      await request(testApp).get('/api/user-docs/feature-guide');
      await request(testApp).get('/api/user-docs/strategy-guide');

      const response = await request(testApp).get('/api/user-docs/analytics').expect(200);

      const analytics = response.body.data;
      expect(analytics.totalViews).toBe(3);
      expect(analytics.popularDocuments).toHaveLength(2);
      expect(analytics.popularDocuments[0][0]).toBe('feature-guide');
      expect(analytics.popularDocuments[0][1]).toBe(2);
    });

    test('document content is consistent across different endpoints', async () => {
      // Get document through main endpoint
      const docResponse = await request(testApp).get('/api/user-docs/feature-guide').expect(200);

      // Get same document in markdown format
      const markdownResponse = await request(testApp)
        .get('/api/user-docs/feature-guide?format=markdown')
        .expect(200);

      expect(docResponse.body.data.content).toBe(markdownResponse.text);
    });
  });
});
