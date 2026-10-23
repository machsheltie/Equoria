/**
 * newPlayerGuide — the single content module behind the in-game Guide page
 * (Equoria-kd2dd).
 *
 * STATUS: DRAFT, awaiting the owner's section-by-section review. The text was
 * written from the owner's rulings (MEMORY.md), the competition bible and live
 * code; the sources for each rule are traced in the issue notes, never in the
 * player-facing text. Do not add a rule here that no ruling or bible page backs.
 *
 * Shape. Every section is a list of typed blocks so the page renders real
 * semantic HTML (paragraphs, lists, tables) and never injects markup. Inline
 * text supports three marks only, parsed by `parseGuideInline`:
 *   **bold**              emphasis
 *   *italic*              a name or a gentle stress
 *   [label](#section-id)  a link to another section of this guide
 *
 * Undecided rules. A `pending` block marks something the owner has not ruled on.
 * The page shows only `topic` (deliberately vague, so nothing unannounced is
 * revealed) as a quiet "still being decided" note. `ownerQuestion` is the full
 * question for the owner's review; it is never rendered to players.
 */

import type { GuideSection } from './guide/guideTypes';
import { guideSectionsStart } from './guide/guideSectionsStart';
import { guideSectionsShows } from './guide/guideSectionsShows';
import { guideSectionsWorld } from './guide/guideSectionsWorld';

export type { GuideBlock, GuideSection } from './guide/guideTypes';

export const guideTitle = 'The Equoria New Player Guide';

export const newPlayerGuide: readonly GuideSection[] = [
  ...guideSectionsStart,
  ...guideSectionsShows,
  ...guideSectionsWorld,
];

export const guideClosingLine = 'Welcome to the barn. Take your time, and enjoy the horses.';

/** One piece of parsed inline text. */
export type GuideInlinePart =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'link'; text: string; sectionId: string };

const inlinePattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(#([a-z0-9-]+)\)/g;

/**
 * Split guide text into plain, bold, italic and section-link parts. Pure and
 * total: text that matches no mark comes back as one `text` part, so a stray
 * asterisk can never drop words from the page.
 */
export function parseGuideInline(source: string): GuideInlinePart[] {
  const parts: GuideInlinePart[] = [];
  let cursor = 0;
  for (const match of source.matchAll(inlinePattern)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push({ kind: 'text', text: source.slice(cursor, start) });
    if (match[1] !== undefined) parts.push({ kind: 'bold', text: match[1] });
    else if (match[2] !== undefined) parts.push({ kind: 'italic', text: match[2] });
    else parts.push({ kind: 'link', text: match[3], sectionId: match[4] });
    cursor = start + match[0].length;
  }
  if (cursor < source.length) parts.push({ kind: 'text', text: source.slice(cursor) });
  return parts;
}
