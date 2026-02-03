/**
 * 🧪 User Documentation Service Tests
 *
 * Comprehensive test suite for user documentation service including:
 * - Documentation loading and content management
 * - Search functionality and indexing
 * - Analytics tracking and reporting
 * - Content parsing and metadata extraction
 * - Table of contents generation
 *
 * Testing Approach: TDD with NO MOCKING
 * - Real file system operations with test documentation
 * - Authentic search functionality with real content
 * - Genuine analytics tracking and reporting
 * - Production-like documentation scenarios
 */

// jest import removed - not used in this file
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  getUserDocumentationService,
  getDocument,
  searchDocumentation,
  getAllDocuments,
  getDocumentationAnalytics,
  getTableOfContents,
} from '../../services/userDocumentationService.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('User Documentation Service', () => {
  let docService;
  let testDocsPath;

  beforeEach(() => {
    // Create test documentation directory
    testDocsPath = join(__dirname, 'test-user-docs');
    if (!existsSync(testDocsPath)) {
      mkdirSync(testDocsPath, { recursive: true });
    }

    // Create test documentation files
    const testDocs = {
      'feature-guide.md': `# 🐎 Feature Guide

Welcome to Equoria! This guide covers all the amazing features.

## Horse Management
Learn how to manage your horses effectively.

### Training System
- Horses must be 3+ years old
- Weekly training cooldown
- Multiple disciplines available

### Competition System
Enter your horses in competitions to earn prizes.

## Breeding System
Create the next generation of champions.`,

      'strategy-guide.md': `# 🎯 Strategy Guide

Master advanced techniques for success.

## Competition Strategies
- Choose appropriate competitions
- Train in relevant disciplines
- Manage horse age and health

## Breeding Optimization
- Select complementary parents
- Focus on trait development
- Plan for long-term improvement`,

      'troubleshooting-guide.md': `# 🔧 Troubleshooting Guide

Common issues and solutions.

## Training Problems
**Cannot train horse**: Check age requirements and cooldowns.

## Competition Issues
**Poor results**: Verify discipline match and training levels.

## Breeding Problems
**Breeding fails**: Ensure both horses meet age and health requirements.`,

      'faq.md': `# ❓ FAQ

Frequently asked questions.

## Getting Started
**Q: How do I start?**
A: Register an account and purchase your first horse.

**Q: What should I do first?**
A: Complete the tutorial and hire a groom.

## Horse Care
**Q: Why can't I train my horse?**
A: Horses must be 3+ years old and respect training cooldowns.`,
    };

    // Write test files
    for (const [filename, content] of Object.entries(testDocs)) {
      writeFileSync(join(testDocsPath, filename), content);
    }

    // Create service instance with test path
    docService = getUserDocumentationService();
    docService.docsPath = testDocsPath;
    docService.initializeDocumentation();
  });

  afterEach(() => {
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

    // Reset service state
    docService.contentCache.clear();
    docService.searchIndex.clear();
    docService.analytics.viewCounts.clear();
    docService.analytics.searchQueries = [];
  });

  describe('Documentation Loading', () => {
    test('loads all documentation files correctly', () => {
      expect(docService.contentCache.size).toBe(4);
      expect(docService.contentCache.has('feature-guide')).toBe(true);
      expect(docService.contentCache.has('strategy-guide')).toBe(true);
      expect(docService.contentCache.has('troubleshooting-guide')).toBe(true);
      expect(docService.contentCache.has('faq')).toBe(true);
    });

    test('extracts document metadata correctly', () => {
      const featureGuide = docService.contentCache.get('feature-guide');

      expect(featureGuide.title).toBe('🐎 Feature Guide');
      expect(featureGuide.wordCount).toBeGreaterThan(0);
      expect(featureGuide.sections).toBeDefined();
      expect(featureGuide.sections.length).toBeGreaterThan(0);
      expect(featureGuide.metadata).toBeDefined();
      expect(featureGuide.metadata.estimatedReadTime).toBeGreaterThan(0);
    });

    test('extracts sections correctly', () => {
      const featureGuide = docService.contentCache.get('feature-guide');
      const { sections } = featureGuide;

      expect(sections.length).toBeGreaterThanOrEqual(4);

      // Check main sections
      const mainSection = sections.find((s) => s.title === '🐎 Feature Guide');
      expect(mainSection.level).toBe(1);

      const horseSection = sections.find((s) => s.title === 'Horse Management');
      expect(horseSection.level).toBe(2);

      const trainingSection = sections.find((s) => s.title === 'Training System');
      expect(trainingSection.level).toBe(3);
    });

    test('builds search index correctly', () => {
      expect(docService.searchIndex.size).toBeGreaterThan(0);

      // Check that common words are indexed
      expect(docService.searchIndex.has('horse')).toBe(true);
      expect(docService.searchIndex.has('training')).toBe(true);
      expect(docService.searchIndex.has('competition')).toBe(true);
      expect(docService.searchIndex.has('breeding')).toBe(true);
    });
  });

  describe('Document Retrieval', () => {
    test('retrieves existing document correctly', () => {
      const document = docService.getDocument('feature-guide');

      expect(document).toBeDefined();
      expect(document.name).toBe('feature-guide');
      expect(document.title).toBe('🐎 Feature Guide');
      expect(document.content).toContain('Welcome to Equoria');
      expect(document.viewCount).toBe(1); // First view
    });

    test('returns null for non-existent document', () => {
      const document = docService.getDocument('non-existent');
      expect(document).toBeNull();
    });

    test('tracks view analytics correctly', () => {
      // View document multiple times
      docService.getDocument('feature-guide');
      docService.getDocument('feature-guide');
      docService.getDocument('strategy-guide');

      expect(docService.analytics.viewCounts.get('feature-guide')).toBe(2);
      expect(docService.analytics.viewCounts.get('strategy-guide')).toBe(1);
    });

    test('gets all documents correctly', () => {
      const documents = docService.getAllDocuments();

      expect(documents).toHaveLength(4);
      expect(documents[0]).toHaveProperty('name');
      expect(documents[0]).toHaveProperty('title');
      expect(documents[0]).toHaveProperty('wordCount');
      expect(documents[0]).toHaveProperty('sections');
      expect(documents[0]).toHaveProperty('viewCount');
    });
  });

  describe('Search Functionality', () => {
    test('searches documentation content successfully', () => {
      const results = docService.searchDocumentation('horse training');

      expect(results.query).toBe('horse training');
      expect(results.results).toBeDefined();
      expect(results.totalResults).toBeGreaterThan(0);
      expect(results.searchTime).toBeDefined();

      // Should find documents containing these terms
      const resultNames = results.results.map((r) => r.name);
      expect(resultNames).toContain('feature-guide');
    });

    test('handles single word searches', () => {
      const results = docService.searchDocumentation('breeding');

      expect(results.results.length).toBeGreaterThan(0);
      const breedingDoc = results.results.find((r) => r.name === 'feature-guide');
      expect(breedingDoc).toBeDefined();
      expect(breedingDoc.matches).toContain('breeding');
    });

    test('returns empty results for non-matching search', () => {
      const results = docService.searchDocumentation('nonexistentterm12345');

      expect(results.results).toHaveLength(0);
      expect(results.totalResults).toBe(0);
    });

    test('tracks search analytics', () => {
      docService.searchDocumentation('horse');
      docService.searchDocumentation('training');
      docService.searchDocumentation('competition');

      expect(docService.analytics.searchQueries).toHaveLength(3);
      expect(docService.analytics.searchQueries[0].query).toBe('horse');
      expect(docService.analytics.searchQueries[1].query).toBe('training');
      expect(docService.analytics.searchQueries[2].query).toBe('competition');
    });

    test('finds matching sections in search results', () => {
      const results = docService.searchDocumentation('training system');

      const featureGuideResult = results.results.find((r) => r.name === 'feature-guide');
      expect(featureGuideResult).toBeDefined();
      expect(featureGuideResult.sections).toBeDefined();

      const trainingSection = featureGuideResult.sections.find(
        (s) => s.title === 'Training System'
      );
      expect(trainingSection).toBeDefined();
    });

    test('respects search options', () => {
      const results = docService.searchDocumentation('horse', {
        limit: 2,
        includeContent: true,
        highlightMatches: true,
      });

      expect(results.results.length).toBeLessThanOrEqual(2);

      if (results.results.length > 0) {
        expect(results.results[0]).toHaveProperty('content');
        expect(results.results[0].content).toContain('**horse**');
      }
    });
  });

  describe('Analytics and Reporting', () => {
    test('generates analytics correctly', () => {
      // Generate some activity
      docService.getDocument('feature-guide');
      docService.getDocument('strategy-guide');
      docService.searchDocumentation('horse');
      docService.searchDocumentation('training');

      const analytics = docService.getAnalytics();

      expect(analytics).toBeDefined();
      expect(analytics.totalDocuments).toBe(4);
      expect(analytics.totalViews).toBe(2);
      expect(analytics.totalSearches).toBe(2);
      expect(analytics.popularDocuments).toBeDefined();
      expect(analytics.recentSearches).toBeDefined();
      expect(analytics.lastUpdated).toBeDefined();
      expect(analytics.searchIndexSize).toBeGreaterThan(0);
    });

    test('tracks popular documents correctly', () => {
      // Create view pattern
      docService.getDocument('feature-guide');
      docService.getDocument('feature-guide');
      docService.getDocument('feature-guide');
      docService.getDocument('strategy-guide');

      const analytics = docService.getAnalytics();
      const popularDocs = analytics.popularDocuments;

      expect(popularDocs).toHaveLength(2);
      expect(popularDocs[0][0]).toBe('feature-guide'); // Most popular
      expect(popularDocs[0][1]).toBe(3); // 3 views
      expect(popularDocs[1][0]).toBe('strategy-guide');
      expect(popularDocs[1][1]).toBe(1); // 1 view
    });

    test('limits search query history', () => {
      // Add many search queries
      for (let i = 0; i < 15; i++) {
        docService.searchDocumentation(`query${i}`);
      }

      const analytics = docService.getAnalytics();
      expect(analytics.recentSearches).toHaveLength(10); // Limited to 10
      expect(analytics.totalSearches).toBe(15); // But total count is accurate
    });
  });

  describe('Table of Contents', () => {
    test('generates table of contents correctly', () => {
      const toc = docService.getTableOfContents();

      expect(toc).toHaveLength(4);

      const featureGuideToc = toc.find((doc) => doc.name === 'feature-guide');
      expect(featureGuideToc).toBeDefined();
      expect(featureGuideToc.title).toBe('🐎 Feature Guide');
      expect(featureGuideToc.sections).toBeDefined();
      expect(featureGuideToc.sections.length).toBeGreaterThan(0);

      // Check section structure
      const { sections } = featureGuideToc;
      expect(sections[0]).toHaveProperty('title');
      expect(sections[0]).toHaveProperty('level');
      expect(sections[0]).toHaveProperty('anchor');
    });

    test('creates proper anchors for sections', () => {
      const toc = docService.getTableOfContents();
      const featureGuideToc = toc.find((doc) => doc.name === 'feature-guide');

      const trainingSection = featureGuideToc.sections.find((s) => s.title === 'Training System');
      expect(trainingSection.anchor).toBe('training-system');

      const horseSection = featureGuideToc.sections.find((s) => s.title === 'Horse Management');
      expect(horseSection.anchor).toBe('horse-management');
    });
  });

  describe('Content Parsing', () => {
    test('counts words correctly', () => {
      const content = 'This is a test document with exactly ten words here.';
      const wordCount = docService.countWords(content);
      expect(wordCount).toBe(10);
    });

    test('extracts searchable words correctly', () => {
      const content = 'Horse training is important for competition success.';
      const words = docService.extractSearchableWords(content);

      expect(words.has('horse')).toBe(true);
      expect(words.has('training')).toBe(true);
      expect(words.has('important')).toBe(true);
      expect(words.has('competition')).toBe(true);
      expect(words.has('success')).toBe(true);

      // Should not include stop words
      expect(words.has('is')).toBe(false);
      expect(words.has('for')).toBe(false);
    });

    test('normalizes search queries correctly', () => {
      const query = 'Horse Training AND Competition';
      const normalized = docService.normalizeSearchQuery(query);

      expect(normalized).toContain('horse');
      expect(normalized).toContain('training');
      expect(normalized).toContain('competition');
      expect(normalized).not.toContain('and'); // Stop word removed
    });

    test('identifies stop words correctly', () => {
      expect(docService.isStopWord('the')).toBe(true);
      expect(docService.isStopWord('and')).toBe(true);
      expect(docService.isStopWord('for')).toBe(true);
      expect(docService.isStopWord('horse')).toBe(false);
      expect(docService.isStopWord('training')).toBe(false);
    });
  });

  describe('System Management', () => {
    test('refreshes documentation successfully', () => {
      // Add a new document
      const newDocPath = join(testDocsPath, 'new-guide.md');
      writeFileSync(newDocPath, '# New Guide\n\nThis is a new guide.');

      const success = docService.refreshDocumentation();

      expect(success).toBe(true);
      expect(docService.contentCache.size).toBe(5); // Now includes new document
      expect(docService.contentCache.has('new-guide')).toBe(true);

      // Cleanup
      unlinkSync(newDocPath);
    });

    test('handles refresh errors gracefully', () => {
      // Simulate error by setting invalid path
      const originalPath = docService.docsPath;
      docService.docsPath = '/invalid/path/that/does/not/exist';

      // The service handles missing directories gracefully by creating empty cache
      const success = docService.refreshDocumentation();

      // Even with invalid path, the service returns true but with empty cache
      expect(success).toBe(true);
      expect(docService.contentCache.size).toBe(0);

      // Restore original path
      docService.docsPath = originalPath;
    });
  });

  describe('Helper Functions', () => {
    test('getDocument helper function works', () => {
      const document = getDocument('feature-guide');
      expect(document).toBeDefined();
      expect(document.name).toBe('feature-guide');
    });

    test('searchDocumentation helper function works', () => {
      const results = searchDocumentation('horse');
      expect(results).toBeDefined();
      expect(results.query).toBe('horse');
    });

    test('getAllDocuments helper function works', () => {
      const documents = getAllDocuments();
      expect(documents).toBeDefined();
      expect(documents.length).toBeGreaterThan(0);
    });

    test('getDocumentationAnalytics helper function works', () => {
      const analytics = getDocumentationAnalytics();
      expect(analytics).toBeDefined();
      expect(analytics.totalDocuments).toBeDefined();
    });

    test('getTableOfContents helper function works', () => {
      const toc = getTableOfContents();
      expect(toc).toBeDefined();
      expect(Array.isArray(toc)).toBe(true);
    });
  });
});
