import { describe, it, expect } from '@jest/globals';
import {
  getUserDocumentationService,
  getDocument,
  searchDocumentation,
  getAllDocuments,
  getDocumentationAnalytics,
  getTableOfContents,
} from '../../services/userDocumentationService.mjs';

describe('getUserDocumentationService (singleton)', () => {
  it('returns an object', () => {
    expect(typeof getUserDocumentationService()).toBe('object');
    expect(getUserDocumentationService()).not.toBeNull();
  });

  it('returns the same instance on repeated calls', () => {
    const a = getUserDocumentationService();
    const b = getUserDocumentationService();
    expect(a).toBe(b);
  });

  it('instance has expected method signatures', () => {
    const svc = getUserDocumentationService();
    expect(typeof svc.getDocument).toBe('function');
    expect(typeof svc.getAllDocuments).toBe('function');
    expect(typeof svc.searchDocumentation).toBe('function');
    expect(typeof svc.getAnalytics).toBe('function');
    expect(typeof svc.getTableOfContents).toBe('function');
  });
});

describe('getAllDocuments', () => {
  it('returns an array', () => {
    expect(Array.isArray(getAllDocuments())).toBe(true);
  });

  it('returns at least one document (feature-guide.md exists)', () => {
    expect(getAllDocuments().length).toBeGreaterThan(0);
  });

  it('each document has name, title, wordCount, and sections fields', () => {
    const docs = getAllDocuments();
    for (const doc of docs) {
      expect(doc).toHaveProperty('name');
      expect(doc).toHaveProperty('title');
      expect(doc).toHaveProperty('wordCount');
      expect(doc).toHaveProperty('sections');
    }
  });

  it('documents are sorted alphabetically by title', () => {
    const docs = getAllDocuments();
    for (let i = 1; i < docs.length; i++) {
      expect(docs[i - 1].title.localeCompare(docs[i].title)).toBeLessThanOrEqual(0);
    }
  });
});

describe('getDocument', () => {
  it('returns null for a non-existent document', () => {
    expect(getDocument('no-such-document-xyz')).toBeNull();
  });

  it('returns a document object for feature-guide', () => {
    const doc = getDocument('feature-guide');
    expect(doc).not.toBeNull();
    expect(doc).toHaveProperty('name', 'feature-guide');
    expect(doc).toHaveProperty('content');
    expect(doc).toHaveProperty('title');
  });

  it('returned document has wordCount > 0', () => {
    const doc = getDocument('feature-guide');
    expect(doc.wordCount).toBeGreaterThan(0);
  });

  it('returned document has sections array', () => {
    const doc = getDocument('feature-guide');
    expect(Array.isArray(doc.sections)).toBe(true);
  });

  it('returned document includes viewCount tracking', () => {
    const doc = getDocument('feature-guide');
    expect(typeof doc.viewCount).toBe('number');
    expect(doc.viewCount).toBeGreaterThanOrEqual(0);
  });
});

describe('searchDocumentation', () => {
  it('returns an object with query, results, and totalResults fields', () => {
    const result = searchDocumentation('horse');
    expect(result).toHaveProperty('query');
    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('totalResults');
  });

  it('returns results array', () => {
    const result = searchDocumentation('horse');
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('returns empty results for a query that matches nothing', () => {
    const result = searchDocumentation('zzzzunlikelytomatch99999xyz');
    expect(result.totalResults).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it('respects the limit option', () => {
    const result = searchDocumentation('the', { limit: 1 });
    expect(result.results.length).toBeLessThanOrEqual(1);
  });

  it('query field echoes the input', () => {
    const result = searchDocumentation('breeding strategy');
    expect(result.query).toBe('breeding strategy');
  });
});

describe('getDocumentationAnalytics', () => {
  it('returns an object (not null)', () => {
    const analytics = getDocumentationAnalytics();
    expect(analytics).not.toBeNull();
    expect(typeof analytics).toBe('object');
  });

  it('has totalDocuments field >= 0', () => {
    const { totalDocuments } = getDocumentationAnalytics();
    expect(typeof totalDocuments).toBe('number');
    expect(totalDocuments).toBeGreaterThanOrEqual(0);
  });

  it('has totalSearches field >= 0', () => {
    const { totalSearches } = getDocumentationAnalytics();
    expect(typeof totalSearches).toBe('number');
    expect(totalSearches).toBeGreaterThanOrEqual(0);
  });

  it('has popularDocuments array', () => {
    const { popularDocuments } = getDocumentationAnalytics();
    expect(Array.isArray(popularDocuments)).toBe(true);
  });

  it('has lastUpdated ISO string', () => {
    const { lastUpdated } = getDocumentationAnalytics();
    expect(typeof lastUpdated).toBe('string');
    expect(() => new Date(lastUpdated)).not.toThrow();
  });
});

describe('getTableOfContents', () => {
  it('returns an array', () => {
    expect(Array.isArray(getTableOfContents())).toBe(true);
  });

  it('each entry has name, title, and sections', () => {
    const toc = getTableOfContents();
    for (const entry of toc) {
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('title');
      expect(entry).toHaveProperty('sections');
      expect(Array.isArray(entry.sections)).toBe(true);
    }
  });
});

// ─── Pure helper methods on the class instance ───────────────────────────────

describe('UserDocumentationService — extractTitle', () => {
  const svc = getUserDocumentationService();

  it('extracts H1 title from markdown content', () => {
    expect(svc.extractTitle('# My Guide\nsome content')).toBe('My Guide');
  });

  it('returns "Untitled" when no H1 found', () => {
    expect(svc.extractTitle('no heading here')).toBe('Untitled');
  });

  it('trims whitespace from title', () => {
    expect(svc.extractTitle('#   Padded Title  \n')).toBe('Padded Title');
  });

  it('ignores H2+ headings for title', () => {
    expect(svc.extractTitle('## Section\ncontent')).toBe('Untitled');
  });
});

describe('UserDocumentationService — extractSections', () => {
  const svc = getUserDocumentationService();

  it('returns empty array for content with no headings', () => {
    expect(svc.extractSections('just plain text')).toEqual([]);
  });

  it('extracts H1 as level 1', () => {
    const sections = svc.extractSections('# Main Title');
    expect(sections[0].level).toBe(1);
    expect(sections[0].title).toBe('Main Title');
  });

  it('extracts H2 as level 2', () => {
    const sections = svc.extractSections('## Sub Section');
    expect(sections[0].level).toBe(2);
  });

  it('extracts multiple heading levels', () => {
    const content = '# H1\n## H2\n### H3';
    const sections = svc.extractSections(content);
    expect(sections).toHaveLength(3);
    expect(sections.map(s => s.level)).toEqual([1, 2, 3]);
  });
});

describe('UserDocumentationService — countWords', () => {
  const svc = getUserDocumentationService();

  it('counts words in plain text', () => {
    expect(svc.countWords('hello world foo')).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(svc.countWords('')).toBe(0);
  });

  it('strips markdown syntax before counting', () => {
    // # and * are stripped; "Title" is 1 word
    const count = svc.countWords('# Title');
    expect(count).toBe(1);
  });
});

describe('UserDocumentationService — extractMetadata', () => {
  const svc = getUserDocumentationService();

  it('detects code blocks', () => {
    const meta = svc.extractMetadata('```js\ncode\n```');
    expect(meta.hasCodeBlocks).toBe(true);
  });

  it('detects absence of code blocks', () => {
    const meta = svc.extractMetadata('plain text');
    expect(meta.hasCodeBlocks).toBe(false);
  });

  it('detects images', () => {
    const meta = svc.extractMetadata('![alt](image.png)');
    expect(meta.hasImages).toBe(true);
  });

  it('detects links', () => {
    const meta = svc.extractMetadata('[link](url)');
    expect(meta.hasLinks).toBe(true);
  });

  it('detects tables', () => {
    const meta = svc.extractMetadata('| col1 | col2 |');
    expect(meta.hasTables).toBe(true);
  });

  it('estimatedReadTime is at least 1 for non-empty content', () => {
    const meta = svc.extractMetadata('word '.repeat(250));
    expect(meta.estimatedReadTime).toBeGreaterThanOrEqual(1);
  });
});

describe('UserDocumentationService — normalizeSearchQuery', () => {
  const svc = getUserDocumentationService();

  it('lowercases the query', () => {
    const terms = svc.normalizeSearchQuery('HORSE BREEDING');
    expect(terms).toContain('horse');
    expect(terms).toContain('breeding');
  });

  it('filters stop words', () => {
    const terms = svc.normalizeSearchQuery('the and for horse');
    expect(terms).not.toContain('the');
    expect(terms).not.toContain('and');
    expect(terms).not.toContain('for');
    expect(terms).toContain('horse');
  });

  it('filters terms shorter than 3 chars', () => {
    const terms = svc.normalizeSearchQuery('ab cd horse');
    expect(terms).not.toContain('ab');
    expect(terms).not.toContain('cd');
    expect(terms).toContain('horse');
  });

  it('returns empty array for all-stopword query', () => {
    expect(svc.normalizeSearchQuery('the and for')).toEqual([]);
  });
});

describe('UserDocumentationService — isStopWord', () => {
  const svc = getUserDocumentationService();

  it('identifies "the" as a stop word', () => {
    expect(svc.isStopWord('the')).toBe(true);
  });

  it('identifies "and" as a stop word', () => {
    expect(svc.isStopWord('and')).toBe(true);
  });

  it('"horse" is not a stop word', () => {
    expect(svc.isStopWord('horse')).toBe(false);
  });

  it('"breeding" is not a stop word', () => {
    expect(svc.isStopWord('breeding')).toBe(false);
  });
});

describe('UserDocumentationService — createAnchor', () => {
  const svc = getUserDocumentationService();

  it('lowercases the title', () => {
    expect(svc.createAnchor('My Title')).toMatch(/^my-title/);
  });

  it('replaces spaces with hyphens', () => {
    expect(svc.createAnchor('Section One Two')).toBe('section-one-two');
  });

  it('removes special characters', () => {
    const anchor = svc.createAnchor('Hello, World!');
    expect(anchor).not.toContain(',');
    expect(anchor).not.toContain('!');
  });
});

describe('UserDocumentationService — highlightSearchTerms', () => {
  const svc = getUserDocumentationService();

  it('wraps matched terms in **bold**', () => {
    const result = svc.highlightSearchTerms('horse training', ['horse']);
    expect(result).toContain('**horse**');
  });

  it('leaves non-matching content unchanged', () => {
    const result = svc.highlightSearchTerms('horse training', ['groom']);
    expect(result).toBe('horse training');
  });

  it('highlights multiple terms', () => {
    const result = svc.highlightSearchTerms('horse training breed', ['horse', 'breed']);
    expect(result).toContain('**horse**');
    expect(result).toContain('**breed**');
  });

  it('is case-insensitive (replaces with lowercase term)', () => {
    const result = svc.highlightSearchTerms('Horse Training', ['horse']);
    expect(result).toContain('**horse**');
  });
});
