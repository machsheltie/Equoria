/**
 * The forum's word lists in the Steward's Office (Equoria-puj1e.3, owner rulings
 * q375, q380 and q381).
 *
 * `words.manage` (the Owner and Admins; never moderators, q381): read both lists,
 * add a word to either, remove one. A blocked word refuses a new thread or reply;
 * a review word holds it for a moderator. Matching is whole words, ignoring
 * capitals (q380; forumWordService.mjs). Every change and its staff log entry
 * commit together.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { Refusal, fail, intId, runContentAction } from '../services/staffContentAction.mjs';
import {
  forumWordLists,
  maxForumWordLength,
  normalizeForumWord,
} from '../services/forumWordService.mjs';

/** GET /api/v1/staff/forum/words: both lists, each alphabetical. */
export async function listForumWords(req, res, next) {
  try {
    const rows = await prisma.forumWord.findMany({
      orderBy: [{ list: 'asc' }, { word: 'asc' }],
      select: { id: true, list: true, word: true },
    });
    const on = list => rows.filter(row => row.list === list).map(({ id, word }) => ({ id, word }));
    return res.status(200).json({ blocked: on('blocked'), review: on('review') });
  } catch (error) {
    logger.error(`[staff] forum words failed: ${error.message}`);
    return next(error);
  }
}

/** POST /api/v1/staff/forum/words { list, word } */
export function addForumWord(req, res, next) {
  const list = req.body?.list;
  if (!forumWordLists.includes(list)) {
    return fail(res, 400, 'Choose the blocked words or the review words.', 'forumWordList');
  }
  const word = normalizeForumWord(req.body?.word);
  if (!word) {
    return fail(
      res,
      400,
      `A word or short phrase of letters and numbers, up to ${maxForumWordLength} characters.`,
      'forumWordInvalid',
    );
  }
  return runContentAction(req, res, next, {
    capability: 'words.manage',
    targetType: 'forumWord',
    reasonRequired: false,
    async apply(tx) {
      // Serialise adds of the same word so a double click answers "already there".
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`forumWord:${list}:${word}`}))`;
      const existing = await tx.forumWord.findFirst({
        where: { list, word },
        select: { id: true },
      });
      if (existing) {
        throw new Refusal(409, 'That word is already on this list.', 'forumWordExists');
      }
      const row = await tx.forumWord.create({ data: { list, word } });
      return {
        targetId: String(row.id),
        after: { list, word },
        body: { id: row.id, list, word },
      };
    },
  });
}

/** POST /api/v1/staff/forum/words/:wordId/remove */
export function removeForumWord(req, res, next) {
  return runContentAction(req, res, next, {
    capability: 'words.manage',
    targetType: 'forumWord',
    reasonRequired: false,
    async apply(tx) {
      const id = intId(req.params.wordId);
      const rows = id
        ? await tx.$queryRaw`SELECT id, list, word FROM "forum_words" WHERE id = ${id} FOR UPDATE`
        : [];
      const row = rows[0];
      if (!row) {
        throw new Refusal(404, 'That word is no longer on the list.', 'forumWordNotFound');
      }
      await tx.forumWord.delete({ where: { id: row.id } });
      return {
        targetId: String(row.id),
        before: { list: row.list, word: row.word },
        after: { removed: true },
        body: { id: row.id, removed: true },
      };
    },
  });
}
