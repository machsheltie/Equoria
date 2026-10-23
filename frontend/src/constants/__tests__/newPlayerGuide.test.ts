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

describe('NEW_PLAYER_GUIDE owner rulings of 2026-10-23', () => {
  const blocksOf = (id: string) =>
    newPlayerGuide.find((section) => section.id === id)?.blocks ?? [];
  const tableCaptioned = (caption: string) =>
    newPlayerGuide
      .flatMap((section) => section.blocks)
      .find(
        (block): block is Extract<GuideBlock, { kind: 'table' }> =>
          block.kind === 'table' && block.caption === caption
      );
  const allText = newPlayerGuide.flatMap((section) => section.blocks.flatMap(textOf));

  it('tells the player where to come back to the guide', () => {
    expect(blocksOf('welcome').flatMap(textOf)).toContain(
      'You can come back to this guide at any time from the **Guide** link.'
    );
  });

  it('explains the feed stat chance plainly, tier by tier', () => {
    const table = tableCaptioned('Chance of +1 to a random stat on each feeding');
    expect(table?.rows).toEqual([
      ['Basic', 'None'],
      ['Performance', '10%'],
      ['Performance Plus', '15%'],
      ['High Performance', '20%'],
      ['Elite', '25%'],
    ]);
  });

  it('shows the whole temperament chart: every one of the 24 disciplines, each of the 12 temperaments once', () => {
    const table = tableCaptioned('How each temperament fares in each discipline');
    expect(table?.rows).toHaveLength(24);
    const twelve = [
      'Spirited',
      'Nervous',
      'Calm',
      'Bold',
      'Steady',
      'Willing',
      'Independent',
      'Reactive',
      'Stubborn',
      'Driven',
      'Lazy',
      'Aggressive',
    ].sort();
    for (const [discipline, suits, neutral, poor] of table?.rows ?? []) {
      const named = [suits, neutral, poor]
        .flatMap((cell) => (cell === '—' ? [] : cell.split(', ')))
        .sort();
      expect(named, discipline).toEqual(twelve);
    }
  });

  it('shows the competition percentages: health, temperament and luck', () => {
    const joined = allText.join(' ');
    expect(joined).toContain('Excellent +5%, Very Good +3%, Good no change, Fair −3%');
    expect(joined).toContain('(+5%)');
    expect(joined).toContain('(−5%)');
    expect(joined).toContain('between +1% and +10%');
  });

  it('presents parades as coming soon with their 40/30/20/10 breakdown', () => {
    expect(allText.join(' ')).toContain('**Parades are coming soon.**');
    expect(tableCaptioned('How a parade is judged')?.rows).toEqual([
      ['Presentation and grooming', '40%'],
      ['Movement or gait', '30%'],
      ['Temperament', '20%'],
      ['Conformation', '10%'],
    ]);
  });

  it('says conformation shows are one open class', () => {
    expect(allText).toContain(
      'Every conformation show is one open class. There are no separate classes by age or sex.'
    );
  });

  it('says traits do not change a show score yet, and promises no premium trainers', () => {
    const joined = allText.join(' ');
    expect(joined).toContain("Right now traits don't change a show score.");
    expect(joined).not.toMatch(/premium trainer/i);
  });

  it('describes the two live leaderboards and only hints that more are coming', () => {
    const boards = blocksOf('leaderboards').flatMap(textOf);
    expect(boards).toContain('More boards are coming.');
    expect(boards.join(' ')).toContain('**Win percentage:**');
    expect(boards.join(' ')).toContain('**Wins:**');
  });

  it('keeps the Very Good note pending and names the unbuilt health system without describing it as live', () => {
    const veryGood = newPlayerGuide
      .flatMap((section) => section.blocks)
      .find(
        (block): block is Extract<GuideBlock, { kind: 'pending' }> =>
          block.kind === 'pending' && block.topic === 'How Very Good health is earned'
      );
    expect(veryGood?.ownerQuestion).toContain('Equoria-qwz60');
    // The new vetting bands (8-14 Very Good, 29+ Bad) are not in any player-facing text.
    expect(allText.join(' ')).not.toMatch(/22-28|29\+|29 or more/);
  });

  it('leaves exactly the owner-queued questions undecided', () => {
    const topics = newPlayerGuide
      .flatMap((section) => section.blocks)
      .filter(
        (block): block is Extract<GuideBlock, { kind: 'pending' }> => block.kind === 'pending'
      )
      .map((block) => block.topic);
    expect(topics.sort()).toEqual(
      [
        'How Very Good health is earned',
        'What hoof condition affects',
        'When riders retire',
        'Levels above 200',
        'Hosting limits and where entry fees go',
        'What trainer fit changes',
        'The event shop',
      ].sort()
    );
  });

  it('no longer lists the settled questions as undecided', () => {
    const topics = newPlayerGuide
      .flatMap((section) => section.blocks)
      .filter(
        (block): block is Extract<GuideBlock, { kind: 'pending' }> => block.kind === 'pending'
      )
      .map((block) => block.topic);
    for (const settled of [
      'Where the Guide link lives',
      'What the better feeds add',
      'How much of the temperament chart players see',
      'Parades',
      'Conformation classes',
      'What each trait does',
      'Other leaderboards',
      'More about trainers',
    ]) {
      expect(topics).not.toContain(settled);
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
