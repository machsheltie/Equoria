/**
 * The Night Road (Equoria-wbt8l, owner-chosen Option B): every dawn the game
 * writes down what happened in the night, and News is the road of nights the
 * player walks back along.
 *
 * Ahead (a dotted stretch of what is still to come) → Tonight (the glowing
 * waypoint) → earlier nights. Quiet nights are skipped, marked only by a short
 * dotted gap. The owner's letters and seasonal events are the only framed
 * things on the road; everything else is a short line.
 */

import { Fragment } from 'react';
import type { NewsItem } from '@/lib/api/news';
import { NewsEmblem } from './NewsEmblem';
import { AheadRow, NewsEntryRow } from './NewsEntryRow';
import { NewsFeaturePost } from './NewsFeaturePost';
import {
  formatGameDate,
  groupIntoNights,
  isFeaturePost,
  nightsRemaining,
  type Night,
} from './newsRoad';
import './news.css';

function NightContent({ night }: { night: Night }) {
  const features = night.items.filter(isFeaturePost);
  const rows = night.items.filter((item) => !isFeaturePost(item));
  return (
    <>
      {features.map((item) => (
        <NewsFeaturePost key={item.id} item={item} />
      ))}
      {rows.length > 0 && (
        <ul className="news-entries">
          {rows.map((item) => (
            <li key={item.id}>
              <NewsEntryRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface NightRoadProps {
  items: NewsItem[];
  ahead: NewsItem[];
  today: string;
}

export function NightRoad({ items, ahead, today }: NightRoadProps) {
  const nights = groupIntoNights(items, today);
  return (
    <ol className="news-road">
      {ahead.length > 0 && (
        <li className="news-night news-night--ahead">
          <span className="news-node">
            <NewsEmblem name="star" />
          </span>
          <h2 className="news-night__heading">
            Ahead
            <small>coming up</small>
          </h2>
          <ul className="news-entries">
            {ahead.map((item) => (
              <li key={item.id}>
                <AheadRow item={item} />
              </li>
            ))}
          </ul>
        </li>
      )}
      {nights.map((night) => (
        <Fragment key={night.gameDate}>
          {night.quietBefore && (
            <li className="news-gap" aria-hidden="true">
              quiet nights
            </li>
          )}
          <li className={night.isToday ? 'news-night news-night--today' : 'news-night'}>
            <span className="news-node">
              <NewsEmblem name={night.isToday ? 'moon' : 'shoe'} />
            </span>
            <h2 className="news-night__heading">
              {night.isToday ? (
                <>
                  Tonight
                  <small>
                    <time dateTime={night.gameDate}>{formatGameDate(night.gameDate)}</time>
                  </small>
                </>
              ) : (
                <time dateTime={night.gameDate}>
                  {formatGameDate(night.gameDate, 'weekday')}
                  <small>{formatGameDate(night.gameDate, 'dayMonth')}</small>
                </time>
              )}
            </h2>
            <NightContent night={night} />
          </li>
        </Fragment>
      ))}
    </ol>
  );
}

interface MonthRibbonProps {
  event: NewsItem;
  today: string;
  /** True when the event's full post is on the road below, to jump to. */
  postOnRoad: boolean;
}

/** The current month's seasonal event, as a ribbon above the road. */
export function MonthRibbon({ event, today, postOnRoad }: MonthRibbonProps) {
  const last = event.lastGameDate ?? today;
  const left = nightsRemaining(today, last);
  const titleId = `news-ribbon-${event.id}`;
  return (
    <section className="news-ribbon" aria-labelledby={titleId}>
      <div className="news-ribbon__title">
        <NewsEmblem name="moon" className="news-ribbon__moon" />
        <div>
          <h2 id={titleId}>{event.title}</h2>
          <p>
            {formatGameDate(last, 'month')}&rsquo;s seasonal event &middot;{' '}
            {left === 1 ? 'the last night' : `${left} nights remain`}
          </p>
        </div>
      </div>
      {postOnRoad && (
        <a className="news-ribbon__link" href={`#news-item-${event.id}`}>
          Read the announcement
        </a>
      )}
    </section>
  );
}
