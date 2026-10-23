/**
 * New player guide content: Breeding and foals, temperaments and traits, retirement, clubs, events, news, economy and leaderboards.
 *
 * DRAFT awaiting owner review (Equoria-kd2dd). Part of constants/newPlayerGuide.ts,
 * which joins these files into the one guide the page renders.
 */

import type { GuideSection } from './guideTypes';

export const guideSectionsWorld: readonly GuideSection[] = [
  {
    id: 'breeding',
    title: 'Breeding',
    tagline: 'Same breed, ages 3 to 20, and 7 days to a foal.',
    blocks: [
      {
        kind: 'list',
        items: [
          '**Same breed only.** A mare and stallion must be the same breed, and the foal is that breed too.',
          '**Ages 3 to 20** for both mare and stallion, and both must be in **Fair health or better**.',
          "**Mares rest 7 days** (one game year) after being bred. Stallions don't need to rest.",
          '**Your own pair is free.** Breeding your mare to your own stallion costs nothing.',
          "**Stud fees are set by players.** If you own a stallion aged 3 or over, you decide whether he stands at stud and what his fee is. Choose **Public Stud**, where bookings go through automatically, or **Private Stud**, where you approve or turn down each request. When a mare is bred to another player's stallion, her owner pays that stallion's fee to his owner. There are no other breeding fees.",
          "**Look before you breed.** You can view genetic odds, lineage and warnings, such as a lethal white risk, for any stallion at stud, including ones you don't own. Public studs can be found in the Horse Marketplace search.",
        ],
      },
      {
        kind: 'paragraph',
        text: "**Pregnancy lasts 7 days.** A mare bred on one day foals in the nightly run 7 days later. Feed her every day while she's in foal: each feeding counts toward her foal's chance of a positive trait, and better feed counts for more. Each missed day adds a small chance of a negative trait.",
      },
      {
        kind: 'paragraph',
        text: '**Bloodlines.** When three ancestors within three generations share the same most-competed discipline, the foal gets +2% on all 12 stats. Strong lines are worth building.',
      },
    ],
  },
  {
    id: 'foals-growing-up',
    title: 'Foals growing up',
    tagline: "From first steps to age 3, at the horse's own pace.",
    blocks: [
      {
        kind: 'list',
        items: [
          "**A foal ages one year every 7 real days.** Nothing hurries it along, and there's no way to skip ahead. The wait is part of raising a horse.",
          "**A foal lives on the same horse page it will have all its life.** It's described by its age, and the activities on the page change as it grows.",
          "**Grooms raise foals.** Each day, press **Groom horse** and choose that day's enrichment activity. Each week brings different activities until the horse turns 3.",
          "**Traits come to light through this care.** When a trait is revealed, it glows on the horse's trait list the first time you look.",
          'At 3 your horse can train, enter ridden shows and breed.',
        ],
      },
    ],
  },
  {
    id: 'temperaments-and-traits',
    title: 'Temperaments and traits',
    tagline: 'Who your horse is, and what you discover along the way.',
    blocks: [
      {
        kind: 'paragraph',
        text: '**Temperament** is set at birth and never changes. There are 12: Spirited, Nervous, Calm, Bold, Steady, Willing, Independent, Reactive, Stubborn, Driven, Lazy and Aggressive. Temperament matters in three places:',
      },
      {
        kind: 'list',
        items: [
          'show scores, where each discipline suits, ignores or dislikes it (±5%);',
          'how well a horse bonds with its groom;',
          'how well it suits a trainer.',
        ],
      },
      {
        kind: 'subheading',
        text: 'Which temperaments suit which show',
      },
      {
        kind: 'paragraph',
        text: "In a ridden show, a temperament that **suits** the discipline adds **5%** to the day's score, a **neutral** one adds nothing, and a **poor fit** takes **5%** away. This is the whole chart.",
      },
      {
        kind: 'table',
        caption: 'How each temperament fares in each discipline',
        columns: ['Discipline', 'Suits (+5%)', 'Neutral', 'Poor fit (−5%)'],
        rows: [
          [
            'Barrel Racing',
            'Spirited, Bold, Willing, Independent, Driven',
            'Calm, Steady, Reactive',
            'Nervous, Stubborn, Lazy, Aggressive',
          ],
          [
            'Combined Driving',
            'Calm, Bold, Steady, Willing',
            'Spirited',
            'Nervous, Independent, Reactive, Stubborn, Driven, Lazy, Aggressive',
          ],
          [
            'Cross Country',
            'Spirited, Bold, Willing, Independent, Driven',
            'Calm, Steady',
            'Nervous, Reactive, Stubborn, Lazy, Aggressive',
          ],
          [
            'Cutting',
            'Spirited, Calm, Bold, Independent, Reactive',
            'Steady, Willing, Driven, Aggressive',
            'Nervous, Stubborn, Lazy',
          ],
          [
            'Dressage',
            'Calm, Steady, Willing',
            'Spirited, Bold, Lazy',
            'Nervous, Independent, Reactive, Stubborn, Driven, Aggressive',
          ],
          [
            'Endurance',
            'Calm, Bold, Steady, Independent, Driven',
            'Spirited, Willing',
            'Nervous, Reactive, Stubborn, Lazy, Aggressive',
          ],
          [
            'Eventing',
            'Spirited, Calm, Bold, Willing, Independent',
            'Steady, Driven',
            'Nervous, Reactive, Stubborn, Lazy, Aggressive',
          ],
          [
            'Fine Harness',
            'Spirited, Bold, Willing',
            'Calm, Steady',
            'Nervous, Independent, Reactive, Stubborn, Driven, Lazy, Aggressive',
          ],
          [
            'Gaited',
            'Spirited, Calm, Bold, Willing',
            'Steady, Independent, Driven',
            'Nervous, Reactive, Stubborn, Lazy, Aggressive',
          ],
          [
            'Gymkhana',
            'Spirited, Calm, Bold, Willing, Driven',
            'Steady, Independent, Reactive',
            'Nervous, Stubborn, Lazy, Aggressive',
          ],
          [
            'Harness Racing',
            'Spirited, Steady, Driven',
            'Calm, Bold, Willing, Independent, Aggressive',
            'Nervous, Reactive, Stubborn, Lazy',
          ],
          [
            'Hunter',
            'Calm, Steady, Willing',
            'Bold, Independent, Lazy',
            'Spirited, Nervous, Reactive, Stubborn, Driven, Aggressive',
          ],
          [
            'Pleasure Driving',
            'Spirited, Calm, Bold, Steady, Willing',
            'Independent, Lazy',
            'Nervous, Reactive, Stubborn, Driven, Aggressive',
          ],
          [
            'Polo',
            'Spirited, Bold, Independent, Driven',
            'Calm, Steady, Willing, Reactive, Aggressive',
            'Nervous, Stubborn, Lazy',
          ],
          [
            'Racing',
            'Spirited, Bold, Driven',
            'Calm, Steady, Willing, Independent, Reactive, Aggressive',
            'Nervous, Stubborn, Lazy',
          ],
          [
            'Reining',
            'Spirited, Bold, Steady, Willing',
            'Calm, Independent, Reactive, Driven',
            'Nervous, Stubborn, Lazy, Aggressive',
          ],
          [
            'Rodeo',
            'Spirited, Bold, Steady, Driven',
            'Calm, Willing, Independent',
            'Nervous, Reactive, Stubborn, Lazy, Aggressive',
          ],
          [
            'Roping',
            'Calm, Bold, Steady, Willing, Independent',
            'Spirited, Reactive, Driven',
            'Nervous, Stubborn, Lazy, Aggressive',
          ],
          [
            'Saddleseat',
            'Spirited, Bold, Willing',
            'Calm, Steady, Reactive, Driven',
            'Nervous, Independent, Stubborn, Lazy, Aggressive',
          ],
          [
            'Show Jumping',
            'Spirited, Bold, Willing',
            'Calm, Steady, Independent, Reactive, Driven',
            'Nervous, Stubborn, Lazy, Aggressive',
          ],
          [
            'Steeplechase',
            'Spirited, Bold, Independent, Driven',
            'Calm, Steady, Willing, Aggressive',
            'Nervous, Reactive, Stubborn, Lazy',
          ],
          [
            'Team Penning',
            'Spirited, Bold, Independent',
            'Calm, Steady, Willing, Reactive, Driven',
            'Nervous, Stubborn, Lazy, Aggressive',
          ],
          [
            'Vaulting',
            'Calm, Steady, Willing',
            'Bold, Independent, Lazy',
            'Spirited, Nervous, Reactive, Stubborn, Driven, Aggressive',
          ],
          [
            'Western Pleasure',
            'Calm, Steady, Willing, Lazy',
            'Spirited, Bold',
            'Nervous, Independent, Reactive, Stubborn, Driven, Aggressive',
          ],
        ],
      },
      {
        kind: 'pending',
        topic: 'What trainer fit changes',
        ownerQuestion: 'What trainer fit changes, given that training always adds +5.',
      },
      {
        kind: 'paragraph',
        text: "**Traits** are hidden at birth and revealed through a young horse's care. There are 19: Brave, Fearful, Confident, Insecure, Affectionate, Skittish, Resilient, Fragile, High Immunity, Low Immunity, People Trusting, Show Calm, Crowd Ready, Bonded, Eager Learner, Social, Antisocial, Presentation Boosted and Legendary Bloodline.",
      },
      {
        kind: 'list',
        items: [
          "**A hidden trait does nothing** until it's revealed.",
          '**No one can see hidden traits**, including you.',
          '**A revealed trait is public forever**, which is what makes an established line worth more than a store horse.',
          'Traits never carry stat numbers.',
        ],
      },
      {
        kind: 'pending',
        topic: 'What each trait does',
        ownerQuestion:
          "Traits are being reworked. Today they don't change show scores, and each trait's effect is still to be decided.",
      },
    ],
  },
  {
    id: 'retirement',
    title: 'Retirement at 21',
    tagline: 'A well-earned rest.',
    blocks: [
      {
        kind: 'paragraph',
        text: "Horses retire on their 21st birthday. A retired horse no longer trains, shows or breeds, and it doesn't need feeding. Its staff are released from it.",
      },
      {
        kind: 'paragraph',
        text: '**The one exception: a mare in foal.** A mare bred at 20 stays in foal past her 21st birthday. She keeps her groom, and you can feed and vet her until her foal arrives. After she foals, her staff and feeding stop.',
      },
    ],
  },
  {
    id: 'clubs-and-elections',
    title: 'Clubs and elections',
    tagline: 'Find your people.',
    blocks: [
      {
        kind: 'list',
        items: [
          'Clubs are built around a **breed** or a **discipline**. Join one, or start your own and become its president.',
          'Members can be **members**, **officers** or the **president**. Officers and the president can call elections for club positions. Members nominate and vote.',
          '**Ties go to a run-off.** If an election ends in a tie, a **1-day run-off** opens between the tied candidates. If that ties too, another run-off follows, until someone wins.',
          'Club news, such as elections opening and run-off results, appears on the News page.',
        ],
      },
    ],
  },
  {
    id: 'seasonal-events',
    title: 'Seasonal events',
    tagline: 'A new theme every month.',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Seasonal events have nothing to do with weather. Each month brings a themed event, announced on the News page on the 1st. An event can include:',
      },
      {
        kind: 'list',
        items: [
          '**special game-run competitions** that pay **double Horse Points**;',
          '**limited-edition tack** to win, or to buy from the premium shop;',
          'special monthly crafts.',
        ],
      },
      {
        kind: 'pending',
        topic: 'The event shop',
        ownerQuestion:
          "The premium shop and its currency aren't designed yet. Confirm how the guide should mention them.",
      },
    ],
  },
  {
    id: 'news',
    title: 'News',
    tagline: "What's happening across Equoria.",
    blocks: [
      {
        kind: 'paragraph',
        text: "The News page is where you land after **While You Were Away**. You'll find:",
      },
      {
        kind: 'list',
        items: [
          "letters **From The Head Admin** and from Equoria's admins;",
          'game **Updates** and **Contests**;',
          "each month's **Seasonal Event**;",
          '**New Items** in the shops;',
          '**Club News**, such as elections and run-off results;',
          'seasonal event competitions opening and closing, and special monthly crafts.',
        ],
      },
      {
        kind: 'paragraph',
        text: "Everyday shows open and close by the hundreds, so they don't appear in the News. Find them under **COMPETE**.",
      },
    ],
  },
  {
    id: 'economy',
    title: 'Economy basics',
    tagline: 'Coins in, coins out.',
    blocks: [
      { kind: 'paragraph', text: '**Coming in:**' },
      {
        kind: 'list',
        items: [
          '10,000 coins to start.',
          '**5,000 coins** from the **Bank** every week. Remember to claim it.',
          'Show prize money, horse sales, and stud fees from other players.',
        ],
      },
      { kind: 'paragraph', text: '**Going out:**' },
      {
        kind: 'table',
        caption: 'What you pay for, and when',
        columns: ['What', 'When you pay'],
        rows: [
          ['Grooms', '70 coins per horse, per week'],
          ['Riders', 'their weekly rate, one week at a time'],
          ['Training', "the trainer's advertised fee, once per session"],
          ['Feed', 'when you buy the bag'],
          ['Vet and farrier', 'each visit'],
          ['Show entry', 'when you enter'],
        ],
      },
      {
        kind: 'paragraph',
        text: "Hiring a trainer is free, and grooming itself costs nothing beyond the groom's weekly fee.",
      },
      { kind: 'paragraph', text: '**Where to shop:**' },
      {
        kind: 'list',
        items: [
          '**Feed Shop**, **Tack Shop** (saddles, bridles and decorations), **Veterinarian**, **Farrier**, and the **Leathersmith** for crafting.',
          '**Horse Trader** sells horses bred by the game. They come with no parents and no revealed traits, and their stats total 200, with each stat between 1 and 20.',
          '**Horse Marketplace** is where players sell to each other. The seller sets the price, and there are no listing fees or commissions.',
        ],
      },
      { kind: 'paragraph', text: "Coins are for play only. They're never real money." },
    ],
  },
  {
    id: 'leaderboards',
    title: 'Leaderboards',
    tagline: 'See how your horses measure up.',
    blocks: [
      {
        kind: 'list',
        items: [
          '**Win percentage:** wins divided by shows entered. A horse needs at least **100 shows** to qualify.',
          '**Wins:** the horses with the most first places.',
        ],
      },
      {
        kind: 'pending',
        topic: 'Other leaderboards',
        ownerQuestion:
          'The other boards, Horse Level (which currently ranks players) and the discipline board, are waiting on rulings (Equoria-rghuf).',
      },
    ],
  },
];
