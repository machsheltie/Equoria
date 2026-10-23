/**
 * The News Desk (Equoria-wbt8l, owner rulings 2026-10-23): staff write, edit
 * and remove News posts. The post type is chosen first and decides the fields
 * (see ../newsPostTypes.mjs for the types and who may write each).
 *
 * The writer's role is read fresh from the database on every call, so a
 * demotion takes effect at once, whatever the access token still says.
 * Game entries (written by the nightly job) are facts: they cannot be edited
 * or removed here.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import AppError from '../../../errors/AppError.mjs';
import { gameDateKey, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import {
  STAFF_POST_TYPES,
  isStaffPostType,
  mayManageAllNews,
  mayPostNewsType,
  mayUseNewsDesk,
  newsRoleLabel,
  newsTypesForRole,
} from '../newsPostTypes.mjs';
import { lastGameDateBefore, readTiles, toNewsItemDto } from './newsItemShape.mjs';
import { isNewsImageUrl, newsImageStorageConfig } from './newsImageStorage.mjs';

export const NEWS_TITLE_MAX = 120;
export const NEWS_BODY_MAX = 6000;
export const NEWS_TILE_CAPTION_MAX = 60;
export const NEWS_TILES_MAX = 4;
const DESK_LIST_LIMIT = 60;
const MS_PER_DAY = 86_400_000;
const LETTER_TYPES = Object.freeze(['headAdminLetter', 'adminLetter']);

/** @returns {Promise<{ id: string, username: string, role: string }>} */
async function loadStaffWriter(userId) {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true },
  });
  if (!account || !mayUseNewsDesk(account.role)) {
    throw new AppError('Only the Head Admin and Admins write News.', 403);
  }
  return account;
}

function requiredText(value, max, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(`The ${label} is required.`, 400);
  }
  const text = value.trim();
  if (text.length > max) {
    throw new AppError(`The ${label} can be at most ${max} characters.`, 400);
  }
  return text;
}

function readTileInput(raw) {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw) || raw.length > NEWS_TILES_MAX) {
    throw new AppError(`A seasonal event has at most ${NEWS_TILES_MAX} picture tiles.`, 400);
  }
  if (raw.length > 0 && !newsImageStorageConfig()) {
    throw new AppError(
      'Image storage is not set up yet, so picture tiles cannot be added. Post without them for now.',
      400,
    );
  }
  return raw.map(tile => {
    if (tile === null || typeof tile !== 'object' || Array.isArray(tile)) {
      throw new AppError('Each tile needs a picture and a caption.', 400);
    }
    if (!isNewsImageUrl(tile.imageUrl)) {
      throw new AppError('Tile pictures must be uploaded at the News Desk.', 400);
    }
    return {
      imageUrl: tile.imageUrl,
      caption: requiredText(tile.caption, NEWS_TILE_CAPTION_MAX, 'tile caption'),
    };
  });
}

/** 'YYYY-MM' → the month's [start, end) on the Eastern game clock. */
function monthBounds(month) {
  const match = typeof month === 'string' ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month) : null;
  if (!match) {
    throw new AppError('Choose the month the seasonal event runs.', 400);
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return {
    start: startOfGameDayIndex(Date.UTC(year, monthIndex, 1) / MS_PER_DAY),
    end: startOfGameDayIndex(Date.UTC(year, monthIndex + 1, 1) / MS_PER_DAY),
  };
}

/** 'YYYY-MM-DD' (the last open day) → the instant it closes: 00:00 the day after. */
function closingInstant(closesOn) {
  const match = typeof closesOn === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(closesOn) : null;
  const dayMs = match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : NaN;
  if (!match || Number.isNaN(dayMs) || new Date(dayMs).toISOString().slice(0, 10) !== closesOn) {
    throw new AppError('The closing day must be a date.', 400);
  }
  return startOfGameDayIndex(dayMs / MS_PER_DAY + 1);
}

/**
 * The stored fields for a staff post, from desk input. `existing` is the row
 * being edited (null on create): an edit keeps the original publishAt.
 */
function postFields(postType, input, now, existing) {
  const fields = {
    title: requiredText(input.title, NEWS_TITLE_MAX, 'title'),
    body: requiredText(input.body, NEWS_BODY_MAX, 'body'),
  };

  if (postType !== 'seasonalEvent' && input.tiles !== undefined && input.tiles.length !== 0) {
    throw new AppError('Only a seasonal event has picture tiles.', 400);
  }
  if (postType !== 'seasonalEvent' && input.month !== undefined) {
    throw new AppError('Only a seasonal event has a month.', 400);
  }
  if (postType !== 'contest' && input.closesOn !== undefined && input.closesOn !== null) {
    throw new AppError('Only a contest has a closing day.', 400);
  }

  if (postType === 'seasonalEvent') {
    const { start, end } = monthBounds(input.month);
    if (end <= now) {
      throw new AppError('That month has already ended.', 400);
    }
    fields.tiles = readTileInput(input.tiles);
    fields.endsAt = end;
    const monthUnchanged = existing && existing.endsAt?.getTime() === end.getTime();
    if (monthUnchanged) {
      fields.publishAt = existing.publishAt;
    } else if (existing && existing.publishAt <= now) {
      throw new AppError('A seasonal event that is already published keeps its month.', 409);
    } else {
      // Published at the start of the 1st; a late post for the current month
      // goes out now rather than back-dated onto the 1st.
      fields.publishAt = start > now ? start : now;
    }
    return fields;
  }

  fields.tiles = [];
  fields.publishAt = existing ? existing.publishAt : now;
  if (postType === 'contest' && input.closesOn !== undefined && input.closesOn !== null) {
    const endsAt = closingInstant(input.closesOn);
    if (endsAt <= now) {
      throw new AppError('That closing day has already passed.', 400);
    }
    fields.endsAt = endsAt;
  } else {
    fields.endsAt = null;
  }
  return fields;
}

/**
 * Whether `writer` may edit or remove `post`: their own post; any post for
 * the owner (news.manageAll); otherwise a non-letter type its writer may use.
 */
function mayChangePost(writer, post) {
  if (post.authorUserId === writer.id || mayManageAllNews(writer.role)) {
    return true;
  }
  return !LETTER_TYPES.includes(post.postType) && mayPostNewsType(writer.role, post.postType);
}

async function loadStaffPost(id, writer) {
  const post = await prisma.newsItem.findUnique({ where: { id } });
  if (!post) {
    throw new AppError('That post no longer exists.', 404);
  }
  if (!isStaffPostType(post.postType)) {
    throw new AppError('Entries the game writes cannot be changed.', 409);
  }
  if (!mayChangePost(writer, post)) {
    throw new AppError('Your staff role cannot change this post.', 403);
  }
  return post;
}

/** A desk row: the feed shape plus what the edit form needs. */
function toDeskDto(row, now) {
  return {
    ...toNewsItemDto(row),
    scheduled: row.publishAt > now,
    month:
      row.postType === 'seasonalEvent' && row.endsAt
        ? lastGameDateBefore(row.endsAt).slice(0, 7)
        : null,
    closesOn: row.postType === 'contest' ? lastGameDateBefore(row.endsAt) : null,
  };
}

/**
 * The desk: the post types this writer may use and the staff posts so far
 * (scheduled ones included), newest first.
 * @param {{ writerId: string, now?: Date }} params
 */
export async function getNewsDesk({ writerId, now = new Date() }) {
  const writer = await loadStaffWriter(writerId);
  const rows = await prisma.newsItem.findMany({
    where: { postType: { in: [...STAFF_POST_TYPES] } },
    orderBy: [{ publishAt: 'desc' }, { id: 'desc' }],
    take: DESK_LIST_LIMIT,
  });
  return {
    allowedTypes: newsTypesForRole(writer.role),
    signature: { name: writer.username, roleLabel: newsRoleLabel(writer.role) },
    imageUploadsReady: newsImageStorageConfig() !== null,
    today: gameDateKey(now),
    posts: rows.map(row => ({ ...toDeskDto(row, now), canChange: mayChangePost(writer, row) })),
  };
}

/**
 * @param {{ writerId: string, input: object, now?: Date }} params
 */
export async function createNewsPost({ writerId, input, now = new Date() }) {
  const writer = await loadStaffWriter(writerId);
  const { postType } = input;
  if (!isStaffPostType(postType)) {
    throw new AppError('Choose what kind of post this is.', 400);
  }
  if (!mayPostNewsType(writer.role, postType)) {
    throw new AppError('Your staff role cannot write this kind of post.', 403);
  }
  const row = await prisma.newsItem.create({
    data: {
      postType,
      ...postFields(postType, input, now, null),
      authorUserId: writer.id,
      authorName: writer.username,
      authorRoleLabel: newsRoleLabel(writer.role),
    },
  });
  return toDeskDto(row, now);
}

/**
 * Edit a staff post's words, tiles, month (while still scheduled) or
 * closing day. The type and the signature never change.
 * @param {{ writerId: string, id: number, input: object, now?: Date }} params
 */
export async function updateNewsPost({ writerId, id, input, now = new Date() }) {
  const writer = await loadStaffWriter(writerId);
  const post = await loadStaffPost(id, writer);
  if (input.postType !== undefined && input.postType !== post.postType) {
    throw new AppError('A post keeps its type. Write a new post instead.', 400);
  }
  const fields = postFields(post.postType, { tiles: readTiles(post.tiles), ...input }, now, post);
  // Guarded write: the row must still exist (a concurrent removal wins).
  const { count } = await prisma.newsItem.updateMany({ where: { id }, data: fields });
  if (count === 0) {
    throw new AppError('That post no longer exists.', 404);
  }
  return toDeskDto(await prisma.newsItem.findUniqueOrThrow({ where: { id } }), now);
}

/**
 * @param {{ writerId: string, id: number }} params
 */
export async function deleteNewsPost({ writerId, id }) {
  const writer = await loadStaffWriter(writerId);
  await loadStaffPost(id, writer);
  await prisma.newsItem.deleteMany({ where: { id } });
  return { id };
}
