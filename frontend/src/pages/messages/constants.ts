/**
 * Messages constants + helpers (extracted from MessagesPage — Equoria-w2kyx)
 *
 * The MessageTab union, the per-tag badge color map, and the relativeTime
 * formatter. No JSX, so this is a plain .ts module shared by the page
 * container and the message/notification row components.
 */

export type MessageTab = 'inbox' | 'sent' | 'notifications';

export const tagColors: Record<string, string> = {
  Sales: 'bg-emerald-500/20 text-emerald-400',
  Clubs: 'bg-celestial-gold/20 text-celestial-gold',
  Breeding: 'bg-pink-500/20 text-pink-400',
  System: 'bg-blue-500/20 text-blue-400',
  News: 'bg-violet-500/20 text-violet-400',
  Art: 'bg-rose-500/20 text-rose-400',
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
