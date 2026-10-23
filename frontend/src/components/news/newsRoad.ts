/**
 * The Night Road's arithmetic (Equoria-wbt8l): pure functions, no React.
 *
 * News arrives one batch per Eastern game day. The server stamps every entry
 * with its game date ('YYYY-MM-DD'); here those dates become the nights of the
 * road, the "quiet nights" gaps between them, and the words for each night.
 * All date strings are calendar dates, so they are read on UTC and never on
 * the player's own clock.
 */

import type { NewsItem } from '@/lib/api/news';
import type { NewsEmblemName } from './NewsEmblem';

const msPerDay = 86_400_000;

export interface Night {
  gameDate: string;
  isToday: boolean;
  /** At least one game day with no news lies between this night and the one above. */
  quietBefore: boolean;
  items: NewsItem[];
}

function dayNumber(dateKey: string): number {
  return Date.parse(`${dateKey}T00:00:00Z`) / msPerDay;
}

/** Newest-first entries → nights, newest first. Nights with no news never appear. */
export function groupIntoNights(items: NewsItem[], today: string): Night[] {
  const nights: Night[] = [];
  for (const item of items) {
    const last = nights[nights.length - 1];
    if (last && last.gameDate === item.gameDate) {
      last.items.push(item);
      continue;
    }
    nights.push({
      gameDate: item.gameDate,
      isToday: item.gameDate === today,
      quietBefore: last ? dayNumber(last.gameDate) - dayNumber(item.gameDate) > 1 : false,
      items: [item],
    });
  }
  return nights;
}

const formatters = {
  weekday: new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long' }),
  dayMonth: new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long' }),
  full: new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }),
  month: new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long' }),
};

/** 'Thursday', '23 October', 'Thursday 23 October' or 'October' for a game date. */
export function formatGameDate(dateKey: string, style: keyof typeof formatters = 'full'): string {
  return formatters[style].format(new Date(`${dateKey}T00:00:00Z`));
}

/** Game days left including today: 1 on the event's last day. */
export function nightsRemaining(today: string, lastGameDate: string): number {
  return Math.max(0, dayNumber(lastGameDate) - dayNumber(today) + 1);
}

/** Written by the owner or an Admin, shown in the night's framed panel. */
export const featurePostTypes: readonly string[] = [
  'seasonalEvent',
  'headAdminLetter',
  'adminLetter',
];

export function isFeaturePost(item: NewsItem): boolean {
  return featurePostTypes.includes(item.postType);
}

/** The emblem for an entry row on the road. */
export function emblemFor(postType: string): NewsEmblemName {
  switch (postType) {
    case 'clubNews':
      return 'pennant';
    case 'newItem':
      return 'saddle';
    case 'contest':
    case 'seasonalCompetitionOpen':
    case 'seasonalCompetitionClose':
      return 'rosette';
    case 'update':
      return 'scroll';
    case 'seasonalEvent':
      return 'moon';
    default:
      return 'star';
  }
}

/** How an "Ahead" entry's end is said: "Polls close", "Entries close", … */
export function endWordsFor(postType: string): string {
  switch (postType) {
    case 'clubNews':
      return 'Polls close';
    case 'contest':
      return 'Entries close';
    case 'seasonalCompetitionOpen':
      return 'Closes';
    default:
      return 'Ends';
  }
}
