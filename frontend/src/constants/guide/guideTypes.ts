/**
 * Shapes of the new player guide content (Equoria-kd2dd). See ../newPlayerGuide.ts
 * for how the blocks are written and rendered.
 */

export type GuideBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'subheading'; text: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'table'; columns: string[]; rows: string[][]; caption?: string }
  | { kind: 'example'; text: string }
  | { kind: 'pending'; topic: string; ownerQuestion: string };

export interface GuideSection {
  /** URL fragment: /guide#<id>. Stable once shipped, so links keep working. */
  id: string;
  title: string;
  /** One short line under the title. */
  tagline: string;
  blocks: GuideBlock[];
}
