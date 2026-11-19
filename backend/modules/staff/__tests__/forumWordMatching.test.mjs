/**
 * Word-list matching (Equoria-puj1e.3, owner ruling q380): whole words only,
 * ignoring capitals. Pure functions; the routes that use them are covered by
 * staffForumWordsAuthz.integration.test.mjs against the real database.
 */

import { describe, it, expect } from '@jest/globals';
import {
  containsListedWord,
  foldForumText,
  normalizeForumWord,
  wholeWordPattern,
} from '../services/forumWordService.mjs';

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

describe('Unicode-equivalent spellings read the same (Codex r2 #6)', () => {
  it('matches ß against SS in any capitals, either way round', () => {
    expect(containsListedWord(['Auf der STRASSE'], [normalizeForumWord('straße')])).toBe(true);
    expect(containsListedWord(['Auf der Straße'], [normalizeForumWord('STRASSE')])).toBe(true);
    // A word stored before folding existed is folded when it is compared.
    expect(containsListedWord(['STRASSE'], ['straße'])).toBe(true);
    expect(containsListedWord(['Strasse'], ['STRAẞE'])).toBe(true);
  });

  it('matches composed and decomposed accents as the same word', () => {
    const composed = 'café';
    const decomposed = 'café';
    expect(containsListedWord([`a ${decomposed} here`], [normalizeForumWord(composed)])).toBe(true);
    expect(containsListedWord([`a ${composed} here`], [normalizeForumWord(decomposed)])).toBe(true);
    expect(normalizeForumWord(decomposed)).toBe(composed);
  });

  it('matches fullwidth and compatibility forms', () => {
    expect(containsListedWord(['ＡＳＳ hat'], ['ass'])).toBe(true);
    expect(containsListedWord(['ﬁsh'], ['fish'])).toBe(true);
  });

  it('keeps whole-word matching: a combining mark or a trailing letter still continues the word', () => {
    const word = normalizeForumWord('café');
    expect(containsListedWord(['cafés'], [word])).toBe(false);
    expect(containsListedWord(['cafés'], [word])).toBe(false);
    expect(containsListedWord(['decafé'], [word])).toBe(false);
    expect(containsListedWord(['(café)'], [word])).toBe(true);
    expect(containsListedWord(['Strasseneck'], [normalizeForumWord('straße')])).toBe(false);
    expect(containsListedWord(['STRASSE.'], [normalizeForumWord('straße')])).toBe(true);
  });

  it('does not add fuzzy or look-alike matching', () => {
    expect(containsListedWord(['a$$'], ['ass'])).toBe(false);
    expect(containsListedWord(['cafe'], [normalizeForumWord('café')])).toBe(false);
  });

  it('folds with NFKC and a full case fold', () => {
    expect(foldForumText('STRAẞE')).toBe('strasse');
    expect(foldForumText('Ａb')).toBe('ab');
    // Final sigma and ordinary sigma are one letter.
    expect(foldForumText('ΟΣ')).toBe(foldForumText('οσ'));
    expect(foldForumText('ος')).toBe(foldForumText('οσ'));
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
