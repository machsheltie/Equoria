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

  it('leaves exactly the owner-queued questions undecided', () => {
    const topics = newPlayerGuide
      .flatMap((section) => section.blocks)
      .filter(
        (block): block is Extract<GuideBlock, { kind: 'pending' }> => block.kind === 'pending'
      )
      .map((block) => block.topic);
    // Owner ruling 2026-10-27 (q117): the 20 traits are names only; effects come later.
    expect(topics).toEqual(['What each trait does']);
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
      'Other leaderboards',
      'More about trainers',
      'How Very Good health is earned',
      'Hosting limits and where entry fees go',
      'What trainer fit changes',
      'The event shop',
    ]) {
      expect(topics).not.toContain(settled);
    }
  });
});

describe('NEW_PLAYER_GUIDE owner rulings of 2026-10-23 to 2026-10-28', () => {
  const tableCaptioned = (caption: string) =>
    newPlayerGuide
      .flatMap((section) => section.blocks)
      .find(
        (block): block is Extract<GuideBlock, { kind: 'table' }> =>
          block.kind === 'table' && block.caption === caption
      );
  const joined = newPlayerGuide.flatMap((section) => section.blocks.flatMap(textOf)).join(' ');

  it('shows the live health and hunger bands (Equoria-qwz60, built 2026-10-24)', () => {
    expect(
      tableCaptioned(
        'Health by days since the last vet visit, and hunger by days since the last feeding'
      )?.rows
    ).toEqual([
      ['Excellent', '0–7', '0–2'],
      ['Very Good', '8–14', '3–4'],
      ['Good', '15–21', '5–6'],
      ['Fair', '22–28', '7–8'],
      ['Bad', '29 or more', '9 or more'],
    ]);
    expect(joined).toContain('Hunger at Fair lowers the horse');
  });

  it('prices the vet health check by level and says it restores Excellent (2026-10-27)', () => {
    expect(joined).toContain('Very Good 100, Good 200, Fair 300 and Bad 400');
    expect(joined).toContain('back to Excellent');
  });

  it('lists the 20-trait roster and never a rarity (2026-10-27)', () => {
    for (const trait of ['Outgoing', 'Aloof', 'Heart', 'Biddable', 'Competitive']) {
      expect(joined).toContain(trait);
    }
    expect(joined).toContain('There are 20:');
    expect(joined).not.toMatch(/Show Calm|Crowd Ready|Legendary|Ultra Rare|Uncommon|rarity/i);
  });

  it('describes the show hosting rules (2026-10-23 q60)', () => {
    expect(joined).toContain('**10 shows a week**');
    expect(joined).toContain('**10 times the entry fee**');
  });

  // Old contract (2026-10-27, q133): the guide promised an automatic Monday payday; then
  // (2026-10-28) a neutral "Staff are paid each week" while the due window was open.
  // Owner ruling 2026-10-29 (q268, Equoria-hc96y): players press Pay Groom / Pay Rider any
  // time during the week; the week ends Sunday midnight Eastern.
  it('names the Pay Groom / Pay Rider buttons and the Sunday-midnight week end (q268)', () => {
    expect(joined).toContain('**Pay Groom**');
    expect(joined).toContain('**Press Pay Rider on the Staff page once a week**');
    expect(joined).toContain('Sunday midnight (Eastern)');
    expect(joined).toContain('every owed week');
    expect(joined).not.toMatch(/Monday|payday/i);
  });

  it('never mentions removed features: stress, burnout, weather, forecasts, the Breeding Hall', () => {
    expect(joined).not.toMatch(
      /stress|burnout|weather|forecast|predict|genetic odds|lethal white|Breeding Hall|reputation/i
    );
  });
});

describe('NEW_PLAYER_GUIDE owner rulings landed later on 2026-10-28', () => {
  const blocksOf = (id: string) =>
    newPlayerGuide.find((section) => section.id === id)?.blocks ?? [];
  const joined = newPlayerGuide.flatMap((section) => section.blocks.flatMap(textOf)).join(' ');

  it('walks the five-group menu by its real names (Equoria-m5ml8)', () => {
    const start = blocksOf('getting-started').flatMap(textOf).join(' ');
    for (const group of [
      '**Home:**',
      '**World:**',
      '**Community:**',
      '**Marketplace:**',
      '**Compete:**',
    ]) {
      expect(start).toContain(group);
    }
    // Retired place names from the older menu.
    expect(joined).not.toMatch(/COMPETE|Veterinarian|Stable Rounds|Ledger/);
  });

  it('gives every horse a +5 birth discipline, gaited breeds Gaited (Equoria-tl5l8, n7ph5)', () => {
    expect(joined).toContain('every horse is born with **+5** in one discipline');
    expect(joined).toContain('a gaited breed is always born **Gaited**');
  });
});

describe('NEW_PLAYER_GUIDE staff rulings of 2026-10-28', () => {
  const blocksOf = (id: string) =>
    newPlayerGuide.find((section) => section.id === id)?.blocks ?? [];
  const joined = newPlayerGuide.flatMap((section) => section.blocks.flatMap(textOf)).join(' ');

  it('prices staff by the five star levels (Equoria-nawn5)', () => {
    const table = blocksOf('staff-levels').find(
      (block): block is Extract<GuideBlock, { kind: 'table' }> => block.kind === 'table'
    );
    expect(table?.rows).toEqual([
      ['Rookie', '★', '100'],
      ['Novice', '★★', '200'],
      ['Intermediate', '★★★', '300'],
      ['Advanced', '★★★★', '400'],
      ['Expert', '★★★★★', '500'],
    ]);
  });

  it('says riders and grooms grow by shows and reveal hidden items; trainers do not (Equoria-xlw03)', () => {
    const staff = blocksOf('staff-levels').flatMap(textOf).join(' ');
    expect(staff).toContain('**Riders and grooms grow with every show.**');
    expect(staff).toContain('A Rookie shows you only their personality.');
    expect(staff).toContain("**Trainers don't grow.**");
    // The old fixed-NPC wording is gone.
    expect(joined).not.toMatch(/don't level up|keeps the skill they came with/);
  });

  it('states the trainer limit, the rider horse limit and the one weekly groom fee', () => {
    expect(joined).toContain(
      '2 at player level 1, and one more for each level after that, up to 10'
    );
    expect(joined).toContain('**Each rider can ride up to 20 horses.**');
    expect(joined).toContain('Each groom costs one weekly fee at their star level');
    expect(joined).not.toMatch(/Grooms for Hire|Trainers for Hire/);
  });
});

describe('NEW_PLAYER_GUIDE horse rulings of 2026-10-28', () => {
  const blocksOf = (id: string) =>
    newPlayerGuide.find((section) => section.id === id)?.blocks ?? [];
  const joined = newPlayerGuide.flatMap((section) => section.blocks.flatMap(textOf)).join(' ');

  it('says horses retire only at 21 and players never retire them (Equoria-s9brd)', () => {
    const retirement = blocksOf('retirement').flatMap(textOf).join(' ');
    expect(retirement).toContain(
      "Horses retire on their 21st birthday, and only then. You can't retire a horse early."
    );
  });

  it('describes the Hall of Fame as weekly nominate-and-vote, once per horse (Equoria-vb1n0)', () => {
    const hall = blocksOf('hall-of-fame').flatMap(textOf).join(' ');
    expect(hall).toContain("retiring doesn't put a horse in it");
    expect(hall).toContain('**Nominate horse to the Hall of Fame**');
    expect(hall).toContain('**once, ever**');
    expect(hall).toContain('Hall of Fame weeks start on Sunday, Eastern.');
    expect(hall).toContain('**one vote** per round');
    expect(hall).toContain('one-day run-off');
  });

  it("gives foals their parents' average stats, give or take 10%, plus the lineage bonus (Equoria-fq9ob)", () => {
    const breeding = blocksOf('breeding').flatMap(textOf).join(' ');
    expect(breeding).toContain(
      "starts at the average of its sire's and dam's, give or take up to 10%"
    );
    expect(breeding).toContain("2% of its parents' average on each of its 12 stats");
    expect(breeding).toContain('A foal of a gaited breed is always born **Gaited**.');
  });

  it('says Horse Trader horses arrive Excellent and fed with one to five hidden traits (Equoria-fd3f2, i366a)', () => {
    expect(joined).toContain('They arrive in Excellent health and fully fed');
    expect(joined).toContain('between one and five hidden traits');
  });

  it('points players to the show Level filter (Equoria-i33ow)', () => {
    expect(blocksOf('competitions').flatMap(textOf).join(' ')).toContain('**Level**');
  });

  it('keeps US spelling for Color and favorite (Equoria-at90e)', () => {
    expect(joined).not.toMatch(/colour|favourite|grey/i);
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
