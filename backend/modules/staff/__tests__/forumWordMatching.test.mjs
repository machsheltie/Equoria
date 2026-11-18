/**
 * Word-list matching (Equoria-puj1e.3, owner ruling q380): whole words only,
 * ignoring capitals. Pure functions; the routes that use them are covered by
 * staffForumWordsAuthz.integration.test.mjs against the real database.
 */

import { describe, it, expect } from '@jest/globals';
import { containsListedWord, normalizeForumWord, wholeWordPattern } from '../services/forumWordService.mjs';

describe('containsListedWord (q380)', () => {
  it('does not let a blocked "ass" touch "class", "assess" or "bass"', () => {
    for (const text of ['A riding class', 'We assess the foal', 'Bass guitar', 'classy']) {
      expect(containsListedWord([text], ['ass'])).toBe(false);
    }
  });

  it('finds "ass" as a word in any capitals', () => {
    for (const text of ['ASS', 'You ass', 'Ass.', 'what an ASS!', '(ass)', "ass's"]) {
      expect(containsListedWord([text], ['ass'])).toBe(true);
    }
  });

  it('reads accented letters and numbers as part of a word', () => {
    expect(containsListedWord(['assé'], ['ass'])).toBe(false);
    expect(containsListedWord(['ass2'], ['ass'])).toBe(false);
    expect(containsListedWord(['Élan'], ['élan'])).toBe(true);
  });

  it('matches a phrase with any spacing, and checks every text it is given', () => {
    expect(containsListedWord(['title', 'Buy  CHEAP\ncoins'], ['cheap coins'])).toBe(true);
    expect(containsListedWord(['cheap and coins'], ['cheap coins'])).toBe(false);
    expect(containsListedWord([null, 7, 'fine'], ['cheap'])).toBe(false);
  });

  it('matches nothing for an empty list', () => {
    expect(wholeWordPattern([])).toBeNull();
    expect(containsListedWord(['anything'], [])).toBe(false);
  });

  it('treats list entries as words, not patterns', () => {
    expect(containsListedWord(['a.b'], ['a'])).toBe(true);
    expect(containsListedWord(['axb'], [normalizeForumWord("a'b")])).toBe(false);
    expect(containsListedWord(["a'b"], [normalizeForumWord("a'b")])).toBe(true);
  });
});

describe('normalizeForumWord', () => {
  it('lowercases, trims and single-spaces an entry', () => {
    expect(normalizeForumWord('  Cheap   COINS ')).toBe('cheap coins');
    expect(normalizeForumWord('Ass-Hat')).toBe('ass-hat');
  });

  it('refuses anything that is not a word or short phrase', () => {
    for (const raw of ['', '   ', 'a*', '.*', '-ass', 'ass-', 'x'.repeat(51), 7, null]) {
      expect(normalizeForumWord(raw)).toBeNull();
    }
  });
});
