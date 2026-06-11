/**
 * Messages constants + helpers (extracted from MessagesPage — Equoria-w2kyx)
 *
 * The MessageTab union, the per-tag GameBadge variant map, and the
 * relativeTime formatter. No JSX, so this is a plain .ts module shared by
 * the page container and the message/notification row components.
 *
 * Equoria-o5hub community lane: the old raw-palette tagColors class map was
 * replaced by a semantic GameBadge variant map (DECISIONS.md §7).
 */

export type MessageTab = 'inbox' | 'sent' | 'notifications';

/** Semantic GameBadge variant per message tag (DECISIONS.md §7 role model). */
export type TagBadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'primary'
  | 'outline';

export const tagBadgeVariant: Record<string, TagBadgeVariant> = {
  Sales: 'success',
  Clubs: 'default',
  Breeding: 'warning',
  System: 'primary',
  News: 'secondary',
  Art: 'outline',
};

export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
