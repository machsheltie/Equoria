/**
 * newPlayerGuide content integrity (Equoria-kd2dd)
 *
 * The guide is one content module. These tests keep it honest as it is edited:
 * stable unique anchors, every in-guide link landing on a real section, tables
 * that stay rectangular, and an inline parser that never drops words.
 */

import { describe, expect, it } from 'vitest';
import { newPlayerGuide, parseGuideInline, type GuideBlock } from '../newPlayerGuide';

const textOf = (block: GuideBlock): string[] => {
  switch (block.kind) {
    case 'paragraph':
    case 'subheading':
    case 'example':
      return [block.text];
    case 'list':
      return block.items;
    case 'table':
      return block.rows.flat();
    case 'pending':
      return [];
  }
};

describe('newPlayerGuide content', () => {
  it('has unique, url-safe section ids', () => {
    const ids = newPlayerGuide.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('every section has a title, a tagline and at least one block', () => {
    for (const section of newPlayerGuide) {
      expect(section.title.trim()).not.toBe('');
      expect(section.tagline.trim()).not.toBe('');
      expect(section.blocks.length).toBeGreaterThan(0);
    }
  });

  it('every in-guide link points at a real section', () => {
    const ids = new Set(newPlayerGuide.map((section) => section.id));
    const dangling: string[] = [];
    for (const section of newPlayerGuide) {
      for (const block of section.blocks) {
        for (const text of textOf(block)) {
          for (const part of parseGuideInline(text)) {
            if (part.kind === 'link' && !ids.has(part.sectionId)) {
              dangling.push(`${section.id}: ${part.sectionId}`);
            }
          }
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it('tables are rectangular', () => {
    for (const section of newPlayerGuide) {
      for (const block of section.blocks) {
        if (block.kind !== 'table') continue;
        for (const row of block.rows) expect(row).toHaveLength(block.columns.length);
      }
    }
  });

  it('every undecided rule carries a player-safe topic and the full owner question', () => {
    const pending = newPlayerGuide
      .flatMap((section) => section.blocks)
      .filter(
        (block): block is Extract<GuideBlock, { kind: 'pending' }> => block.kind === 'pending'
      );
    expect(pending.length).toBeGreaterThan(0);
    for (const block of pending) {
      expect(block.topic.trim()).not.toBe('');
      expect(block.ownerQuestion.trim()).not.toBe('');
      // Topics are shown to players: no ticket ids, no internal markers.
      expect(block.topic).not.toMatch(/Equoria-|PENDING|owner/i);
    }
  });

  it('player-facing text carries no leftover draft markers', () => {
    for (const section of newPlayerGuide) {
      for (const block of section.blocks) {
        for (const text of textOf(block)) {
          expect(text).not.toMatch(/PENDING OWNER|DRAFT/);
        }
      }
    }
  });
});

describe('parseGuideInline', () => {
  it('returns plain text as one part', () => {
    expect(parseGuideInline('Just words.')).toEqual([{ kind: 'text', text: 'Just words.' }]);
  });

  it('splits bold, italic and section links in order', () => {
    expect(parseGuideInline('A **bold** and *italic* and [Breeding](#breeding) end')).toEqual([
      { kind: 'text', text: 'A ' },
      { kind: 'bold', text: 'bold' },
      { kind: 'text', text: ' and ' },
      { kind: 'italic', text: 'italic' },
      { kind: 'text', text: ' and ' },
      { kind: 'link', text: 'Breeding', sectionId: 'breeding' },
      { kind: 'text', text: ' end' },
    ]);
  });

  it('keeps an unmatched asterisk as text instead of dropping it', () => {
    const joined = parseGuideInline('5 * 3 = 15')
      .map((part) => part.text)
      .join('');
    expect(joined).toBe('5 * 3 = 15');
  });
});
