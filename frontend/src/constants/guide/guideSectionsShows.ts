/**
 * New player guide content: Competitions and conformation shows, including how a score is built.
 *
 * DRAFT awaiting owner review (Equoria-kd2dd). Part of constants/newPlayerGuide.ts,
 * which joins these files into the one guide the page renders.
 */

import type { GuideSection } from './guideTypes';

export const guideSectionsShows: readonly GuideSection[] = [
  {
    id: 'competitions',
    title: 'Competitions',
    tagline: 'How shows work, and how a score is built.',
    blocks: [
      { kind: 'subheading', text: 'Entering a show' },
      {
        kind: 'list',
        items: [
          '**Age 3 to 20**, and **health Fair or better**.',
          '**A rider** assigned and on your staff.',
          '**Up to 3 disciplines at a time.** A horse can be entered in shows of up to three different disciplines at once, and in as many shows within those three as you like. It can start a fourth discipline once every show in one of its current three has run.',
          "**No cooldown** between shows, but a horse can't enter the same show twice.",
          '**Gaited shows** are for gaited breeds only.',
          "**Levels.** Each discipline has levels based on the horse's score in it. Level 1 is a score of 0–25, Level 2 is 26–50, Level 3 is 51–100, Level 4 is 101–150 and Level 5 is 151–200. A horse whose score climbs past its level after entering stays in the show, and is judged on its score on show day.",
        ],
      },
      {
        kind: 'pending',
        topic: 'Levels above 200',
        ownerQuestion: 'Levels above 200.',
      },
      {
        kind: 'list',
        items: ["**Show day.** A show runs **7 days after it's created**, in the nightly run."],
      },
      {
        kind: 'paragraph',
        text: 'Players can host shows too, and a host may enter her own horses.',
      },
      {
        kind: 'pending',
        topic: 'Hosting limits and where entry fees go',
        ownerQuestion: 'How many shows a player may host each week, and where entry fees go.',
      },
      { kind: 'subheading', text: 'How a score is built' },
      {
        kind: 'paragraph',
        text: "**Step 1: the stats.** Each discipline counts three of the horse's stats: **50%** of the main stat, **30%** of the second and **20%** of the third.",
      },
      {
        kind: 'table',
        caption: 'The three stats each discipline counts',
        columns: ['Discipline', '50%', '30%', '20%'],
        rows: [
          ['Barrel Racing', 'Speed', 'Agility', 'Obedience'],
          ['Combined Driving', 'Obedience', 'Stamina', 'Focus'],
          ['Cross Country', 'Stamina', 'Boldness', 'Intelligence'],
          ['Cutting', 'Intelligence', 'Agility', 'Boldness'],
          ['Dressage', 'Precision', 'Focus', 'Obedience'],
          ['Endurance', 'Stamina', 'Intelligence', 'Speed'],
          ['Eventing', 'Stamina', 'Boldness', 'Agility'],
          ['Fine Harness', 'Flexibility', 'Precision', 'Balance'],
          ['Gaited', 'Flexibility', 'Balance', 'Obedience'],
          ['Gymkhana', 'Speed', 'Flexibility', 'Focus'],
          ['Harness Racing', 'Speed', 'Precision', 'Stamina'],
          ['Hunter', 'Balance', 'Precision', 'Intelligence'],
          ['Pleasure Driving', 'Obedience', 'Balance', 'Focus'],
          ['Polo', 'Speed', 'Boldness', 'Agility'],
          ['Racing', 'Speed', 'Stamina', 'Focus'],
          ['Reining', 'Agility', 'Precision', 'Focus'],
          ['Rodeo', 'Boldness', 'Agility', 'Stamina'],
          ['Roping', 'Precision', 'Focus', 'Speed'],
          ['Saddleseat', 'Flexibility', 'Balance', 'Obedience'],
          ['Show Jumping', 'Balance', 'Agility', 'Boldness'],
          ['Steeplechase', 'Stamina', 'Boldness', 'Balance'],
          ['Team Penning', 'Intelligence', 'Agility', 'Stamina'],
          ['Vaulting', 'Flexibility', 'Balance', 'Obedience'],
          ['Western Pleasure', 'Focus', 'Obedience', 'Intelligence'],
        ],
      },
      { kind: 'paragraph', text: '**Step 2: training and tack.** Add flat points:' },
      {
        kind: 'list',
        items: [
          '**Training:** +5 for every week the horse has trained in that discipline.',
          '**Tack:** a horse wears one saddle and one bridle. A **discipline saddle** or **discipline bridle** (a Hunter Saddle, for example) adds **+5 each, but only in its own discipline**. **All Purpose** tack adds **+2 each** in any discipline.',
        ],
      },
      {
        kind: 'example',
        text: "**An example.** Moonflower enters a Hunter show. Her Balance is 80 (half of it counts: 40), her Precision is 60 (30%: 18) and her Intelligence is 50 (20%: 10). That's **68**. She has trained in Hunter for two weeks (**+10**) and wears a Hunter Saddle and a Hunter Bridle (**+5** and **+5**). Her score going into the ring is **88**.",
      },
      {
        kind: 'paragraph',
        text: 'Halves round up: a score ending in .5 or more rounds up, and .4 or less rounds down.',
      },
      {
        kind: 'paragraph',
        text: '**Step 3: the day itself.** A few small percentage adjustments are added together and applied once, at the end:',
      },
      {
        kind: 'list',
        items: [
          '**Health:** Excellent +5%, Very Good +3%, Good no change, Fair −3%. (A horse that drops to Bad after entering still runs, at −5%.)',
          '**Temperament:** each discipline suits some temperaments (+5%), is neutral to others, and is a poor fit for a few (−5%). The full chart is under [Temperaments and traits](#temperaments-and-traits).',
          '**Rider:** a well-suited rider helps, and a poorly suited one costs a little.',
          '**Luck:** every horse rolls between +1% and +10% at every show.',
        ],
      },
      {
        kind: 'paragraph',
        text: 'Luck adds suspense between close horses, but it never makes up for breeding and training.',
      },
      {
        kind: 'paragraph',
        text: "**What you'll see afterwards.** The horse's **Show Results** tab lists every show it entered, with the date, show name, discipline, placing, Horse Points, winnings and any stat it gained. The judges' cards stay private. You'll see where you placed, but not a breakdown of the score.",
      },
      { kind: 'subheading', text: 'Prizes and rewards' },
      {
        kind: 'list',
        items: [
          '**Prize money:** 1st takes **50%** of the prize pool, 2nd **30%** and 3rd **20%**.',
          '**Horse Points:** **10** for 1st, **5** for 2nd, **3** for 3rd and **1** for every other finisher. Game-run seasonal event competitions pay **double** (20 / 10 / 6 / 2).',
          '**Stat allocations:** every **1,000 Horse Points** earns your horse one stat point to place where you choose. You can save allocations and use them whenever you like.',
          "**A chance at a stat:** after a show, 1st place has a **10%** chance, 2nd **5%** and 3rd **3%** of gaining +1 in one of that discipline's three stats, picked at random.",
          '**Ties:** if two horses finish on the same score, their luck is rolled again until one comes out ahead. Placings are never shared and prizes are never split.',
        ],
      },
    ],
  },
  {
    id: 'conformation-shows',
    title: 'Conformation shows and parades',
    tagline: 'Judged on the horse itself, not on a ridden test.',
    blocks: [
      {
        kind: 'paragraph',
        text: '**Conformation shows** judge how a horse is built and how it presents:',
      },
      {
        kind: 'table',
        caption: 'How a conformation show is judged',
        columns: ['Part', 'Weight'],
        rows: [
          ['Conformation', '50%'],
          ['Gaits', '20%'],
          ['Presentation and groom handling', '15%'],
          ['Temperament', '10%'],
          ['Groom bond', '5%'],
        ],
      },
      {
        kind: 'list',
        items: [
          "They're open to young horses as well as adults, and use the same levels as ridden shows, based on the horse's conformation score.",
          "The horse needs an assigned groom to enter, and you pay the show's entry fee when you enter.",
          "Shows run 7 days after they're created, in the nightly run.",
          "Rewards are ribbons, title points and a boost to the horse's breeding value. There's no prize money.",
        ],
      },
      {
        kind: 'paragraph',
        text: 'Every conformation show is one open class. There are no separate classes by age or sex.',
      },
      {
        kind: 'paragraph',
        text: '**Parades are coming soon.** They will be all about presentation, and this is how they will be judged:',
      },
      {
        kind: 'table',
        caption: 'How a parade is judged',
        columns: ['Part', 'Weight'],
        rows: [
          ['Presentation and grooming', '40%'],
          ['Movement or gait', '30%'],
          ['Temperament', '20%'],
          ['Conformation', '10%'],
        ],
      },
      {
        kind: 'paragraph',
        text: "Decorations from the Tack Shop's Decorative & Parade range help only the presentation part of a parade score. They do nothing in other shows.",
      },
    ],
  },
];
