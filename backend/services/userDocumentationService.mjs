/**
 * 📚 User Documentation Service
 * 
 * Service for managing and serving user-friendly documentation including
 * feature guides, strategy guides, troubleshooting guides, and FAQ sections.
 * Provides content management, search functionality, and analytics.
 * 
 * Features:
 * - Documentation content management and serving
 * - Search functionality across all documentation
 * - User engagement analytics and tracking
 * - Content versioning and updates
 * - Accessibility and mobile optimization
 * - Multi-language support preparation
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class UserDocumentationService {
  constructor() {
    this.docsPath = join(__dirname, '../docs/user-guide');
    this.contentCache = new Map();
    this.searchIndex = new Map();
    this.analytics = {
      viewCounts: new Map(),
      searchQueries: [],
      popularSections: new Map(),
      lastUpdated: new Date().toISOString(),
    };
    
    this.initializeDocumentation();
  }

  /**
   * Initialize documentation system
   */
  initializeDocumentation() {
    try {
      this.loadAllDocuments();
      this.buildSearchIndex();
      logger.info('[UserDocService] Documentation system initialized successfully');
    } catch (error) {
      logger.error(`[UserDocService] Failed to initialize documentation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load all documentation files
   */
  loadAllDocuments() {
    try {
      if (!existsSync(this.docsPath)) {
        logger.warn('[UserDocService] Documentation directory not found');
        return;
      }

      const files = readdirSync(this.docsPath);
      
      for (const file of files) {
        if (extname(file) === '.md') {
          const filePath = join(this.docsPath, file);
          const content = readFileSync(filePath, 'utf8');
          const docName = file.replace('.md', '');
          
          const document = {
            name: docName,
            title: this.extractTitle(content),
            content,
            lastModified: statSync(filePath).mtime,
            wordCount: this.countWords(content),
            sections: this.extractSections(content),
            metadata: this.extractMetadata(content),
          };
          
          this.contentCache.set(docName, document);
          logger.debug(`[UserDocService] Loaded document: ${docName}`);
        }
      }
      
      logger.info(`[UserDocService] Loaded ${this.contentCache.size} documentation files`);
    } catch (error) {
      logger.error(`[UserDocService] Failed to load documents: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build search index for fast content searching
   */
  buildSearchIndex() {
    try {
      this.searchIndex.clear();
      
      for (const [docName, document] of this.contentCache) {
        const words = this.extractSearchableWords(document.content);
        
        for (const word of words) {
          if (!this.searchIndex.has(word)) {
            this.searchIndex.set(word, new Set());
          }
          this.searchIndex.get(word).add(docName);
        }
      }
      
      logger.info(`[UserDocService] Built search index with ${this.searchIndex.size} terms`);
    } catch (error) {
      logger.error(`[UserDocService] Failed to build search index: ${error.message}`);
    }
  }

  /**
   * Get a specific document
   */
  getDocument(docName) {
    try {
      const document = this.contentCache.get(docName);
      
      if (!document) {
        logger.warn(`[UserDocService] Document not found: ${docName}`);
        return null;
      }
      
      // Track view analytics
      this.trackView(docName);
      
      return {
        ...document,
        viewCount: this.analytics.viewCounts.get(docName) || 0,
      };
    } catch (error) {
      logger.error(`[UserDocService] Failed to get document ${docName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get all available documents
   */
  getAllDocuments() {
    try {
      const documents = [];
      
      for (const [docName, document] of this.contentCache) {
        documents.push({
          name: docName,
          title: document.title,
          lastModified: document.lastModified,
          wordCount: document.wordCount,
          sections: document.sections.length,
          viewCount: this.analytics.viewCounts.get(docName) || 0,
        });
      }
      
      return documents.sort((a, b) => a.title.localeCompare(b.title));
    } catch (error) {
      logger.error(`[UserDocService] Failed to get all documents: ${error.message}`);
      return [];
    }
  }

  /**
   * Search documentation content
   */
  searchDocumentation(query, options = {}) {
    try {
      const {
        limit = 10,
        includeContent = false,
        highlightMatches = true,
      } = options;
      
      // Track search analytics
      this.trackSearch(query);
      
      const searchTerms = this.normalizeSearchQuery(query);
      const results = new Map();
      
      // Find documents containing search terms
      for (const term of searchTerms) {
        const matchingDocs = this.searchIndex.get(term) || new Set();
        
        for (const docName of matchingDocs) {
          if (!results.has(docName)) {
            results.set(docName, { score: 0, matches: [] });
          }
          
          const result = results.get(docName);
          result.score += 1;
          result.matches.push(term);
        }
      }
      
      // Sort by relevance score
      const sortedResults = Array.from(results.entries())
        .sort(([, a], [, b]) => b.score - a.score)
        .slice(0, limit);
      
      // Format results
      const formattedResults = sortedResults.map(([docName, result]) => {
        const document = this.contentCache.get(docName);
        const searchResult = {
          name: docName,
          title: document.title,
          score: result.score,
          matches: result.matches,
          sections: this.findMatchingSections(document, searchTerms),
        };
        
        if (includeContent) {
          searchResult.content = highlightMatches 
            ? this.highlightSearchTerms(document.content, searchTerms)
            : document.content;
        }
        
        return searchResult;
      });
      
      return {
        query,
        results: formattedResults,
        totalResults: results.size,
        searchTime: Date.now(),
      };
    } catch (error) {
      logger.error(`[UserDocService] Search failed for query "${query}": ${error.message}`);
      return {
        query,
        results: [],
        totalResults: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get documentation analytics
   */
  getAnalytics() {
    try {
      const totalViews = Array.from(this.analytics.viewCounts.values())
        .reduce((sum, count) => sum + count, 0);
      
      const popularDocs = Array.from(this.analytics.viewCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
      
      const recentSearches = this.analytics.searchQueries
        .slice(-10)
        .reverse();
      
      return {
        totalDocuments: this.contentCache.size,
        totalViews,
        totalSearches: this.analytics.searchQueries.length,
        popularDocuments: popularDocs,
        recentSearches,
        lastUpdated: this.analytics.lastUpdated,
        searchIndexSize: this.searchIndex.size,
      };
    } catch (error) {
      logger.error(`[UserDocService] Failed to get analytics: ${error.message}`);
      return null;
    }
  }

  /**
   * Get documentation table of contents
   */
  getTableOfContents() {
    try {
      const toc = [];
      
      for (const [docName, document] of this.contentCache) {
        toc.push({
          name: docName,
          title: document.title,
          sections: document.sections.map(section => ({
            title: section.title,
            level: section.level,
            anchor: this.createAnchor(section.title),
          })),
        });
      }
      
      return toc;
    } catch (error) {
      logger.error(`[UserDocService] Failed to generate table of contents: ${error.message}`);
      return [];
    }
  }

  /**
   * Track document view for analytics
   */
  trackView(docName) {
    const currentCount = this.analytics.viewCounts.get(docName) || 0;
    this.analytics.viewCounts.set(docName, currentCount + 1);
    
    // Update popular sections
    const sectionCount = this.analytics.popularSections.get(docName) || 0;
    this.analytics.popularSections.set(docName, sectionCount + 1);
  }

  /**
   * Track search query for analytics
   */
  trackSearch(query) {
    this.analytics.searchQueries.push({
      query: query.toLowerCase(),
      timestamp: new Date().toISOString(),
    });
    
    // Keep only last 1000 searches
    if (this.analytics.searchQueries.length > 1000) {
      this.analytics.searchQueries = this.analytics.searchQueries.slice(-1000);
    }
  }

  /**
   * Extract title from markdown content
   */
  extractTitle(content) {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : 'Untitled';
  }

  /**
   * Extract sections from markdown content
   */
  extractSections(content) {
    const sections = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        sections.push({
          level: headerMatch[1].length,
          title: headerMatch[2].trim(),
          line: lines.indexOf(line),
        });
      }
    }
    
    return sections;
  }

  /**
   * Extract metadata from content
   */
  extractMetadata(content) {
    return {
      hasCodeBlocks: content.includes('```'),
      hasImages: content.includes('!['),
      hasLinks: content.includes('['),
      hasTables: content.includes('|'),
      estimatedReadTime: Math.ceil(this.countWords(content) / 200), // 200 WPM
    };
  }

  /**
   * Count words in content
   */
  countWords(content) {
    return content
      .replace(/[#*`\[\]()]/g, '') // Remove markdown syntax
      .split(/\s+/)
      .filter(word => word.length > 0)
      .length;
  }

  /**
   * Extract searchable words from content
   */
  extractSearchableWords(content) {
    const words = new Set();
    
    // Remove markdown syntax and extract words
    const cleanContent = content
      .replace(/[#*`\[\]()]/g, ' ')
      .replace(/\n/g, ' ')
      .toLowerCase();
    
    const wordMatches = cleanContent.match(/\b\w{3,}\b/g) || [];
    
    for (const word of wordMatches) {
      if (word.length >= 3 && !this.isStopWord(word)) {
        words.add(word);
      }
    }
    
    return words;
  }

  /**
   * Normalize search query
   */
  normalizeSearchQuery(query) {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(term => term.length >= 3 && !this.isStopWord(term));
  }

  /**
   * Check if word is a stop word
   */
  isStopWord(word) {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
      'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
      'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy',
      'did', 'she', 'use', 'way', 'will', 'with', 'this', 'that', 'have',
    ]);
    
    return stopWords.has(word);
  }

  /**
   * Find matching sections for search terms
   */
  findMatchingSections(document, searchTerms) {
    const matchingSections = [];
    
    for (const section of document.sections) {
      const sectionText = section.title.toLowerCase();
      
      for (const term of searchTerms) {
        if (sectionText.includes(term)) {
          matchingSections.push({
            title: section.title,
            level: section.level,
            anchor: this.createAnchor(section.title),
          });
          break;
        }
      }
    }
    
    return matchingSections;
  }

  /**
   * Highlight search terms in content
   */
  highlightSearchTerms(content, searchTerms) {
    let highlightedContent = content;
    
    for (const term of searchTerms) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      highlightedContent = highlightedContent.replace(regex, `**${term}**`);
    }
    
    return highlightedContent;
  }

  /**
   * Create anchor from section title
   */
  createAnchor(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  /**
   * Refresh documentation cache
   */
  refreshDocumentation() {
    try {
      this.contentCache.clear();
      this.searchIndex.clear();
      this.loadAllDocuments();
      this.buildSearchIndex();
      this.analytics.lastUpdated = new Date().toISOString();
      
      logger.info('[UserDocService] Documentation refreshed successfully');
      return true;
    } catch (error) {
      logger.error(`[UserDocService] Failed to refresh documentation: ${error.message}`);
      return false;
    }
  }
}

// Singleton instance
let userDocService = null;

/**
 * Get or create the user documentation service instance
 */
export function getUserDocumentationService() {
  if (!userDocService) {
    userDocService = new UserDocumentationService();
  }
  return userDocService;
}

/**
 * Helper function to get a document
 */
export function getDocument(docName) {
  const service = getUserDocumentationService();
  return service.getDocument(docName);
}

/**
 * Helper function to search documentation
 */
export function searchDocumentation(query, options = {}) {
  const service = getUserDocumentationService();
  return service.searchDocumentation(query, options);
}

/**
 * Helper function to get all documents
 */
export function getAllDocuments() {
  const service = getUserDocumentationService();
  return service.getAllDocuments();
}

/**
 * Helper function to get analytics
 */
export function getDocumentationAnalytics() {
  const service = getUserDocumentationService();
  return service.getAnalytics();
}

/**
 * Helper function to get table of contents
 */
export function getTableOfContents() {
  const service = getUserDocumentationService();
  return service.getTableOfContents();
}

export default {
  getUserDocumentationService,
  getDocument,
  searchDocumentation,
  getAllDocuments,
  getDocumentationAnalytics,
  getTableOfContents,
};
