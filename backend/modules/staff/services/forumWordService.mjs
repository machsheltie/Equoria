/**
 * The forum's word lists (Equoria-puj1e.3, owner rulings q375, q380 and q381).
 *
 * Two lists, kept by the Owner and Admins in the Steward's Office:
 * - blocked: a new thread or reply containing one of these words is refused;
 * - review:  it is saved held, shown only to its author until a moderator
 *   accepts it (q376).
 *
 * q380: a word matches only as a WHOLE word, ignoring capitals. A blocked "ass"
 * does not touch "class" or "assess", and "ASS" or "Ass" is blocked. A word is a
 * run of letters and numbers (with any accents); anything else (a space, a full
 * stop, an apostrophe, an underscore) ends it. An entry may be a short phrase,
 * which matches with any spacing between its words.
 *
 * Spelling is compared after Unicode folding (foldForumText): compatibility forms
 * (fullwidth letters), composed and decomposed accents, and full case folding
 * (ß and SS) all read the same. No fuzzy or look-alike matching is done.
 *
 * Words are stored folded with single spaces. The lists are read from the
 * database for every post: at this game's scale that is one small query, and a
 * change made in the office applies to the very next post.
 */

export const forumWordLists = Object.freeze(['blocked', 'review']);

export const maxForumWordLength = 50;

// Letters (and their combining marks) and numbers make a word; nothing else does.
const wordChar = String.raw`[\p{L}\p{M}\p{N}]`;
const validWord = new RegExp(
  String.raw`^${wordChar}+(?:['\-]${wordChar}+)*(?: ${wordChar}+(?:['\-]${wordChar}+)*)*$`,
  'u',
);

/**
 * Fold text for comparison: NFKC (compatibility forms, composed accents), then a
 * full case fold. JavaScript has no casefold(), so: lower-case (turns the capital
 * sharp S into ß), upper-case (ß becomes SS), lower-case again, make final sigma
 * an ordinary sigma, and a last NFKC recomposes anything the case change decomposed.
 * @param {string} text
 * @returns {string}
 */
export function foldForumText(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .toUpperCase()
    .toLowerCase()
    .replace(/ς/gu, 'σ')
    .normalize('NFKC');
}

/**
 * A list entry as stored: trimmed, single-spaced and folded, or null when it
 * is not a word or short phrase of letters and numbers (an apostrophe or hyphen
 * may join two parts of a word).
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeForumWord(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const word = foldForumText(raw.trim().replace(/\s+/gu, ' '));
  if (word === '' || word.length > maxForumWordLength || !validWord.test(word)) {
    return null;
  }
  return word;
}

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One pattern matching any of `words` as a whole word, or null for an empty list.
 * It matches folded text: test it against foldForumText(text), not the raw text.
 * @param {string[]} words stored (normalised) entries
 * @returns {RegExp | null}
 */
export function wholeWordPattern(words) {
  if (words.length === 0) {
    return null;
  }
  const alternatives = words
    .map(word => escapeRegExp(foldForumText(word)).replace(/ /g, String.raw`\s+`))
    // Longest first, so a phrase is tried before a word it starts with.
    .sort((a, b) => b.length - a.length)
    .join('|');
  return new RegExp(`(?<!${wordChar})(?:${alternatives})(?!${wordChar})`, 'u');
}

/**
 * Whether any of `texts` contains any of `words` as a whole word, ignoring capitals.
 * @param {unknown[]} texts the title, body and tags of a post; non-strings are skipped
 * @param {string[]} words stored (normalised) entries
 * @returns {boolean}
 */
export function containsListedWord(texts, words) {
  const pattern = wholeWordPattern(words);
  return (
    pattern !== null &&
    texts.some(text => typeof text === 'string' && pattern.test(foldForumText(text)))
  );
}

/**
 * What the word lists say about a new thread or reply: 'blocked' (refuse it),
 * 'review' (hold it for a moderator) or null (publish it). A blocked word wins
 * over a review word.
 * @param {object} db Prisma client or transaction
 * @param {unknown[]} texts
 * @returns {Promise<'blocked' | 'review' | null>}
 */
export async function forumWordVerdict(db, texts) {
  const rows = await db.forumWord.findMany({ select: { list: true, word: true } });
  const on = list => rows.filter(row => row.list === list).map(row => row.word);
  if (containsListedWord(texts, on('blocked'))) {
    return 'blocked';
  }
  if (containsListedWord(texts, on('review'))) {
    return 'review';
  }
  return null;
}

/** The refusal a player sees for a blocked word. It never names the word. */
export const blockedWordRefusal = Object.freeze({
  status: 400,
  body: Object.freeze({
    success: false,
    code: 'forumBlockedWord',
    message: 'This cannot be posted as written. Please change the wording and try again.',
  }),
});
