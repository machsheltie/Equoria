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
          '**Finding a stallion.** The **Horse Marketplace** search covers every horse. Tick **At stud**, **For sale**, or both, and narrow it down by breed, age, sex, color, sale price, stud fee and Public or Private Stud.',
          "**Breeding is done on the stallion's page.** Open his page and press **Breed to** his name, then pick your mare. At a Public Stud she's bred at once and the fee is paid. At a Private Stud your request waits for his owner to accept or reject it. Your own pair works the same way, free of charge.",
          "**Breeding requests.** The **Breeding requests** button on a horse's page lists the requests waiting for your stallion, and the ones you've sent for your mare.",
        ],
      },
      {
        kind: 'paragraph',
        text: "**Pregnancy lasts 7 days.** A mare bred on one day foals in the nightly run 7 days later. Feed her every day while she's in foal: each feeding counts toward her foal's chance of a positive trait, and better feed counts for more. Each missed day adds a small chance of a negative trait. A mare in Fair or Bad health when she foals also makes a negative trait more likely.",
      },
      {
        kind: 'paragraph',
        text: '**Traits run in families.** A foal can inherit a trait from either parent that carries it, and a trait both parents carry is more likely to pass on. A trait that showed on a parent can arrive already revealed. One that was still hidden stays hidden on the foal.',
      },
      {
        kind: 'paragraph',
        text: "**A foal's stats come from its parents.** Each of its 12 stats starts at the average of its sire's and dam's, give or take up to 10%.",
      },
      {
        kind: 'paragraph',
        text: "**Bloodlines.** When three ancestors within three generations share the same most-competed discipline, the foal also gets a lineage bonus: 2% of its parents' average on each of its 12 stats. Strong lines are worth building.",
      },
      {
        kind: 'paragraph',
        text: "**A foal's birth discipline.** Every foal is born with **+5** in one discipline, picked from the disciplines its parents trained in. A foal of a gaited breed is always born **Gaited**.",
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
          'how well it suits a trainer (coming soon).',
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
        kind: 'paragraph',
        text: "**Traits** are hidden at birth, unless a parent passed one on already showing, and are revealed through a young horse's care (see [Grooms](#grooms)). There are 20: Brave, Confident, Outgoing, Affectionate, Resilient, Fearful, Insecure, Aloof, Fragile, Skittish, Eager Learner, People Trusting, Adaptable, Heart, Focused, Excitable, Curious, Playful, Biddable and Competitive.",
      },
      {
        kind: 'pending',
        topic: 'What each trait does',
        ownerQuestion:
          "Owner ruling 2026-10-27 (q117): the 20-trait roster is names only - 'Do not add what each actually does yet. We will address that later.' Replace this note with each trait's effect once she rules them.",
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
        kind: 'paragraph',
        text: "Right now traits don't change a show score. A show score is built from the stats, training and tack described under [Competitions](#competitions), plus the day's adjustments.",
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
        text: "Horses retire on their 21st birthday, and only then. You can't retire a horse early. A retired horse no longer trains, shows or breeds, and it doesn't need feeding. Its staff are released from it.",
      },
      {
        kind: 'paragraph',
        text: '**The one exception: a mare in foal.** A mare bred at 20 stays in foal past her 21st birthday. She keeps her groom, and you can feed and vet her until her foal arrives. After she foals, her staff and feeding stop.',
      },
    ],
  },
  {
    id: 'hall-of-fame',
    title: 'The Hall of Fame',
    tagline: 'A place among the best of the best.',
    blocks: [
      {
        kind: 'paragraph',
        text: "The Hall of Fame is for the best of the best, so retiring doesn't put a horse in it. Players choose who joins, one horse a week:",
      },
      {
        kind: 'list',
        items: [
          '**Nominate.** Once your horse has retired, a **Nominate horse to the Hall of Fame** button appears on its page. Each horse can be nominated **once, ever**.',
          '**Vote.** Hall of Fame weeks start on Sunday, Eastern. Horses nominated one week are voted on the next, and every player has **one vote** per round, even for their own horse.',
          '**Join.** The horse with the most votes joins the Hall of Fame, with the date it joined. A tie for the top goes to a one-day run-off between the tied horses.',
          "The **Hall of Fame** page, under Community, shows this week's **Nominees** and every **Hall of Fame Horse**.",
        ],
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
        text: 'Each month brings a themed event, announced on the News page on the 1st. An event can include:',
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
        kind: 'paragraph',
        text: 'The **Premium Shop** in the World is coming soon.',
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
        text: "Everyday shows open and close by the hundreds, so they don't appear in the News. Find them under **Compete**.",
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
          'The entry fees from shows you host.',
        ],
      },
      { kind: 'paragraph', text: '**Going out:**' },
      {
        kind: 'table',
        caption: 'What you pay for, and when',
        columns: ['What', 'When you pay'],
        rows: [
          ['Grooms', 'their star level price (100 to 500), per groom, each week'],
          ['Riders', 'their star level price (100 to 500), per rider, each week'],
          ['Training', "the trainer's star level price (100 to 500), once per session"],
          ['Feed', 'when you buy the bag'],
          ['Tack', '500 coins a piece, when you buy it'],
          ['Vet health check', '100 coins for each level below Excellent, each visit'],
          ['Genetic Testing', '500 coins, once per horse'],
          ['Farrier', '50 coins, once a week per horse'],
          ['Show entry', 'when you enter'],
          ['Hosting a show', 'the prize money, 10 times the entry fee, when you create it'],
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
          '**Feed Shop**, **Tack Shop** (saddles, bridles and decorations), **Vet Clinic**, **Farrier**, and the **Leathersmith** for crafting.',
          "**Horse Trader** sells horses bred by the game. They arrive in Excellent health and fully fed, with no parents and their breed's +5 birth discipline. Their stats total 200, with each stat between 1 and 20, and each carries between one and five hidden traits, none of them revealed.",
          '**Horse Marketplace** is where players sell to each other. The seller sets the price, and there are no listing fees or commissions. Its search covers every horse: tick **For sale**, **At stud**, or both.',
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
        kind: 'paragraph',
        text: 'More boards are coming.',
      },
    ],
  },
];
