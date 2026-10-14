/**
 * Keyset cursors for the staff ticket list and ticket threads (STAFF-CR-03,
 * STAFF-CR-09).
 *
 * A cursor names the last row a page showed by its (createdAt, id) pair,
 * written as base64url text. It is a position, never a permission: the
 * caller's own-tickets rule and filters are applied again on every page.
 */

const SEP = '|';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_INT4 = 2147483647;

/** The cursor for a row: its createdAt and id. */
export function encodeCursor(row) {
  return Buffer.from(`${row.createdAt.toISOString()}${SEP}${row.id}`, 'utf8').toString('base64url');
}

/**
 * The { createdAt, id } a cursor names, or null for anything this module did
 * not write. Callers answer null with a 400.
 */
export function decodeCursor(raw) {
  if (typeof raw !== 'string' || raw === '' || raw.length > 64 || !/^[A-Za-z0-9_-]+$/.test(raw)) {
    return null;
  }
  const [stamp, idText, extra] = Buffer.from(raw, 'base64url').toString('utf8').split(SEP);
  if (extra !== undefined || !ISO.test(stamp ?? '') || !/^[1-9]\d{0,9}$/.test(idText ?? '')) {
    return null;
  }
  const createdAt = new Date(stamp);
  const id = Number(idText);
  if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== stamp || id > MAX_INT4) {
    return null;
  }
  return { createdAt, id };
}

/** Rows strictly after `cursor` in (createdAt DESC, id DESC) order. */
export const olderThan = cursor => ({
  OR: [
    { createdAt: { lt: cursor.createdAt } },
    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
  ],
});

/**
 * Split a `take: size + 1` read into the page and the cursor for the next
 * one (null when this page is the last).
 */
export function pageOf(rows, size) {
  const page = rows.slice(0, size);
  return { page, next: rows.length > size ? encodeCursor(page[page.length - 1]) : null };
}
