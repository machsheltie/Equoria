/**
 * The framed posts on the Night Road (Equoria-wbt8l, owner rulings
 * 2026-10-23): the existing FrostedPanel, inside the night it was posted.
 *
 * - Letters: 'From The Head Admin' (the owner's) and 'From Admin <name>' (a
 *   regular Admin's own), with the ceremonial panel title and a signature.
 * - Seasonal events, the owner's large format (her sample, seasonalformat):
 *   lantern + SEASONAL EVENT, a big Basteleur title, her words, a row of up to
 *   four captioned gold-bordered picture tiles, and her signature beneath.
 */

import { useState } from 'react';
import { FrostedPanel, FrostedPanelTitle } from '@/components/ui/game';
import type { NewsItem, NewsTile } from '@/lib/api/news';
import { NewsEmblem } from './NewsEmblem';
import { signatureOf } from './NewsEntryRow';

/** The owner's words: paragraphs split on blank lines, line breaks kept. */
function Paragraphs({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className="news-post__body">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function Signature({ item }: { item: NewsItem }) {
  const { name, role } = signatureOf(item);
  return (
    <p className="news-post__signature">
      <span className="news-post__signature-name">{name}</span>
      {role && <span className="news-post__signature-role">{role}</span>}
    </p>
  );
}

function Kicker({ children }: { children: string }) {
  return (
    <p className="news-post__kicker">
      <NewsEmblem name="lantern" />
      {children}
    </p>
  );
}

function letterKicker(item: NewsItem): string {
  if (item.postType === 'headAdminLetter') return 'From The Head Admin';
  return item.authorName ? `From Admin ${item.authorName}` : 'From Equoria Staff';
}

function NewsTileFigure({ tile }: { tile: NewsTile }) {
  // A picture that fails to load leaves its caption on the night ground
  // instead of a broken-image glyph (image fallback; nothing to report).
  const [failed, setFailed] = useState(false);
  return (
    <figure className="news-tile">
      {!failed && (
        <img
          src={tile.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      <figcaption>{tile.caption}</figcaption>
    </figure>
  );
}

export function NewsFeaturePost({ item }: { item: NewsItem }) {
  const titleId = `news-item-${item.id}-title`;

  if (item.postType === 'seasonalEvent') {
    return (
      <article
        id={`news-item-${item.id}`}
        className="news-feature news-feature--seasonal"
        aria-labelledby={titleId}
      >
        <FrostedPanel className="news-post news-post--seasonal">
          <Kicker>Seasonal Event</Kicker>
          <h3 id={titleId} className="news-seasonal__title">
            {item.title}
          </h3>
          <Paragraphs text={item.body} />
          {item.tiles.length > 0 && (
            <ul className="news-tiles">
              {item.tiles.map((tile) => (
                <li key={tile.imageUrl + tile.caption}>
                  <NewsTileFigure tile={tile} />
                </li>
              ))}
            </ul>
          )}
          <Signature item={item} />
        </FrostedPanel>
      </article>
    );
  }

  return (
    <article id={`news-item-${item.id}`} className="news-feature" aria-labelledby={titleId}>
      <FrostedPanel className="news-post">
        <Kicker>{letterKicker(item)}</Kicker>
        <FrostedPanelTitle id={titleId} variant="ceremonial" className="news-post__title">
          {item.title}
        </FrostedPanelTitle>
        <Paragraphs text={item.body} />
        <Signature item={item} />
      </FrostedPanel>
    </article>
  );
}
