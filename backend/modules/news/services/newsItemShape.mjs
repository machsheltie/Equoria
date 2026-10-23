/**
 * The wire shape of one News entry (Equoria-wbt8l), shared by the players'
 * feed and the News Desk.
 *
 * Dates go out twice: as instants (publishAt, endsAt) and as Eastern game
 * dates (gameDate = the night it was posted; lastGameDate = the last game day
 * before endsAt), so the page never has to work out the game calendar itself.
 */

import { gameDateKey } from '../../../utils/gameTime.mjs';

/**
 * Tiles as stored: keep only well-formed { imageUrl, caption } entries.
 * @param {unknown} raw
 * @returns {{ imageUrl: string, caption: string }[]}
 */
export function readTiles(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      tile =>
        tile !== null &&
        typeof tile === 'object' &&
        !Array.isArray(tile) &&
        typeof tile.imageUrl === 'string' &&
        typeof tile.caption === 'string',
    )
    .map(tile => ({ imageUrl: tile.imageUrl, caption: tile.caption }));
}

/**
 * The last game day before an end instant ('YYYY-MM-DD'), or null.
 * An event ending at 00:00 Eastern on the 1st last ran on the day before.
 * @param {Date|null} endsAt
 * @returns {string|null}
 */
export function lastGameDateBefore(endsAt) {
  return endsAt ? gameDateKey(endsAt.getTime() - 1) : null;
}

/**
 * @param {object} row - a NewsItem row
 */
export function toNewsItemDto(row) {
  return {
    id: row.id,
    postType: row.postType,
    title: row.title,
    body: row.body,
    tiles: readTiles(row.tiles),
    authorName: row.authorName ?? null,
    authorRoleLabel: row.authorRoleLabel ?? null,
    linkPath: row.linkPath ?? null,
    publishAt: row.publishAt.toISOString(),
    gameDate: gameDateKey(row.publishAt),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    lastGameDate: lastGameDateBefore(row.endsAt),
  };
}
