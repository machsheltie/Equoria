/**
 * One short line on the Night Road (Equoria-wbt8l): the game's own entries
 * (club news, new items, seasonal competitions and crafts) and the owner's
 * updates and contests. The While You Were Away row pattern — emblem, line,
 * detail, and a chevron when the entry leads somewhere in the game.
 */

import { Link } from 'react-router';
import type { NewsItem } from '@/lib/api/news';
import { NewsEmblem } from './NewsEmblem';
import { emblemFor, endWordsFor, formatGameDate } from './newsRoad';

/** Game-written types carry no signature. */
const GAME_TYPES = new Set([
  'newItem',
  'clubNews',
  'seasonalCompetitionOpen',
  'seasonalCompetitionClose',
  'seasonalCraft',
]);

/**
 * The signature on a staff post. A post whose writer's account is gone keeps
 * no name (it is personal data): it is signed "Equoria Staff".
 */
export function signatureOf(item: NewsItem): { name: string; role: string | null } {
  return item.authorName
    ? { name: item.authorName, role: item.authorRoleLabel }
    : { name: 'Equoria Staff', role: null };
}

/** Only an in-game path is followed; anything else renders as plain text. */
function inGamePath(linkPath: string | null): string | null {
  return linkPath && linkPath.startsWith('/') && !linkPath.startsWith('//') ? linkPath : null;
}

interface EntryShellProps {
  item: NewsItem;
  detail: string;
  byline?: string | null;
}

function EntryShell({ item, detail, byline }: EntryShellProps) {
  const to = inGamePath(item.linkPath);
  const content = (
    <>
      <span className="news-entry__emblem">
        <NewsEmblem name={emblemFor(item.postType)} />
      </span>
      <span className="news-entry__words">
        <span className="news-entry__title">{item.title}</span>
        {detail && <span className="news-entry__detail">{detail}</span>}
        {byline && <span className="news-entry__byline">{byline}</span>}
      </span>
      {to && <NewsEmblem name="chevron" className="news-entry__go" />}
    </>
  );
  return to ? (
    <Link to={to} className="news-entry news-entry--link">
      {content}
    </Link>
  ) : (
    <div className="news-entry">{content}</div>
  );
}

export function NewsEntryRow({ item }: { item: NewsItem }) {
  let byline: string | null = null;
  if (!GAME_TYPES.has(item.postType)) {
    const { name, role } = signatureOf(item);
    byline = role ? `Posted by ${name}, ${role}` : `Posted by ${name}`;
  }
  return <EntryShell item={item} detail={item.body} byline={byline} />;
}

/** An entry under "Ahead": what it is, and the day it ends. */
export function AheadRow({ item }: { item: NewsItem }) {
  const detail = item.lastGameDate
    ? `${endWordsFor(item.postType)} ${formatGameDate(item.lastGameDate)}`
    : '';
  return <EntryShell item={item} detail={detail} />;
}
