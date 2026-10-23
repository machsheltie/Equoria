/**
 * New player guide content: Getting started, the stable, care, grooms, training and riders.
 *
 * DRAFT awaiting owner review (Equoria-kd2dd). Part of constants/newPlayerGuide.ts,
 * which joins these files into the one guide the page renders.
 */

import type { GuideSection } from './guideTypes';

export const guideSectionsStart: readonly GuideSection[] = [
  {
    id: 'welcome',
    title: 'Welcome to Equoria',
    tagline: 'Everything a new rider needs for the first week.',
    blocks: [
      {
        kind: 'paragraph',
        text: "Equoria is a horse world after dusk. You breed, raise, train and show horses, and over the years you build bloodlines you can trace back to your own choices. Nobody rushes you here. A good stable takes seasons to build, and that's the fun of it.",
      },
      { kind: 'paragraph', text: 'A few things to know before you start:' },
      {
        kind: 'list',
        items: [
          '**7 real days make 1 game year.** A horse born today turns 1 a week from now.',
          '**Game time runs on Eastern time.** Days roll over at midnight Eastern. The nightly run that settles shows and delivers foals happens in the early hours, Eastern.',
          '**You start with 10,000 coins**, and you can claim **5,000 coins** from the Bank every week.',
          '**Only two birthdays change what a horse can do: 3 and 21.** At 3 a horse can train, show and breed. At 21 it retires.',
        ],
      },
      {
        kind: 'pending',
        topic: 'Where the Guide link lives',
        ownerQuestion:
          'The draft said "You can come back to this guide at any time from the Guide link." The Guide has no navigation link yet: its placement (top bar, realm ribbon or Chronicle menu) is an open owner question. Until it is decided the page is reachable only from the welcome note.',
      },
    ],
  },
  {
    id: 'getting-started',
    title: 'Getting started',
    tagline: 'From signing up to your first morning in the barn.',
    blocks: [
      {
        kind: 'paragraph',
        text: "**Signing up takes three short steps.** First a welcome. Then you choose your first horse: pick a breed, choose a mare or a stallion, and give your horse a name. Then you're ready. Your first horse arrives already 3 years old, so it can train, show and breed right away.",
      },
      {
        kind: 'paragraph',
        text: '**Your starter kit.** Along with your horse and your 10,000 coins, you get an **All Purpose Saddle** and an **All Purpose Bridle**, plus a few crafting materials for the Leathersmith.',
      },
      {
        kind: 'paragraph',
        text: "**Your first visit.** When you first enter the game, a welcome note greets you by name and points you to this guide. Press **Continue** and you'll arrive at the **News** page, where you'll find game announcements, events and club news.",
      },
      {
        kind: 'paragraph',
        text: '**Every visit after that.** When you return, the **While You Were Away** panel tells you what happened to your horses since you left. It appears every time, even on a quiet night. Press **Okay** to go on to the News.',
      },
      { kind: 'paragraph', text: '**A good first day:**' },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Buy feed at the **Feed Shop**, equip it on your horse, and feed it.',
          'Book a **Veterinarian** visit.',
          'Hire a groom from **Grooms for Hire** and press **Groom horse**.',
          'Hire a trainer from **Trainers for Hire** (hiring is free), then train at the **Training Center**.',
          'Hire a rider from **Riders**, then browse shows under **COMPETE**.',
        ],
      },
    ],
  },
  {
    id: 'your-stable',
    title: 'Your stable',
    tagline: 'Where your horses live, and how to find them.',
    blocks: [
      {
        kind: 'paragraph',
        text: "**Stable Home** is your yard. It shows last night's standout horses and a **Stable Rounds** marker for horses that need care, horses that can train this week, and mares ready to breed.",
      },
      {
        kind: 'paragraph',
        text: "**The Horse Roster** holds every horse you own. **Portrait** view shows each horse's picture and current state. **Ledger** view lays your horses out side by side so you can sort and compare them. Whether you keep 5 horses or 200, the roster groups them into barns so you can always find the one you want.",
      },
      {
        kind: 'paragraph',
        text: "**Each horse has one page for life.** It's the same page from foal to retirement, and only the activities on it change as the horse grows. On it you'll find the horse's portrait, lineage, care, training log and a **Show Results** tab.",
      },
      { kind: 'paragraph', text: '**What a horse is made of:**' },
      {
        kind: 'list',
        items: [
          '**12 stats:** Precision, Strength, Speed, Agility, Endurance, Intelligence, Stamina, Balance, Boldness, Flexibility, Obedience and Focus. **Stats have no cap, ever.** They never change with age. You raise them through showing, Horse Points and breeding.',
          '**Conformation and gaits:** scored 0 to 100 and fixed for life. Only selective breeding improves them, generation by generation.',
          '**Temperament:** one of 12, set at birth (see [Temperaments and traits](#temperaments-and-traits)).',
          "**Traits:** discovered over a horse's early life, not chosen.",
        ],
      },
      {
        kind: 'paragraph',
        text: "Equoria never tells you which horse to train or which show to enter. Those choices are yours, and they're what makes your stable your own.",
      },
    ],
  },
  {
    id: 'caring-for-horses',
    title: 'Caring for horses',
    tagline: 'Feed, vet and farrier, and what health really means.',
    blocks: [
      {
        kind: 'paragraph',
        text: "**Health is the only consequence in Equoria.** Neglect never kills a horse, and there's no fatigue or burnout to manage. But a horse in **Bad** health cannot breed, train or enter a show until you bring it back.",
      },
      {
        kind: 'paragraph',
        text: '**The five health levels:** Excellent, Very Good, Good, Fair and Bad. **A horse must be Fair or better to breed, train or show.** Health also nudges show scores up or down a little (see [Competitions](#competitions)).',
      },
      { kind: 'paragraph', text: '**Feeding.**' },
      {
        kind: 'list',
        items: [
          "Buy feed at the **Feed Shop**. It goes into your inventory. Buying feed doesn't feed a horse.",
          'Equip a feed on the horse, then press **Feed** once per game day. Each feeding uses one unit.',
          'When the feed runs out, the horse goes back to having no feed equipped. Buy more and equip it again.',
          'Feeds come in five tiers: Basic, Performance, Performance Plus, High Performance and Elite. Better feed matters most for a mare in foal (see [Breeding](#breeding)).',
        ],
      },
      {
        kind: 'pending',
        topic: 'What the better feeds add',
        ownerQuestion:
          'Should the guide mention that the tiers above Basic give a small daily chance of +1 to a random stat (10/15/20/25%)? This is in the feed contract but has not been confirmed against the "stats are not gifts" ruling.',
      },
      {
        kind: 'paragraph',
        text: "**The Veterinarian.** Book a check-up and pay per visit. A vet visit keeps the horse's health up. If the vet finds a problem, such as an injury, that finding sets the horse's health until it's treated.",
      },
      {
        kind: 'paragraph',
        text: "**How health is worked out.** Equoria looks at feeding and vet care separately, and the horse's health is the **worse of the two**:",
      },
      {
        kind: 'table',
        caption: 'Health by days since the last feeding and the last vet visit',
        columns: ['Health', 'Days since last feeding', 'Days since last vet visit'],
        rows: [
          ['Excellent', '0–2', '0–7'],
          ['Good', '3–4', '8–14'],
          ['Fair', '5–6', '15–21'],
          ['Bad', '7 or more', '22 or more'],
        ],
      },
      {
        kind: 'paragraph',
        text: "So feeding doesn't cancel out a missed vet visit, and a vet visit doesn't cancel out missed meals.",
      },
      {
        kind: 'pending',
        topic: 'How Very Good health is earned',
        ownerQuestion:
          'No care band produces Very Good yet. Should, say, feeding 3 days ago give Very Good, or is Very Good kept for vet findings only? (Equoria-j0254)',
      },
      {
        kind: 'paragraph',
        text: '**The Farrier.** Book a Hoof Trim, Standard Shoeing, Corrective Shoeing or Emergency Care, and pay per visit. Hoof condition slips one step at a time as weeks pass since the last visit.',
      },
      {
        kind: 'pending',
        topic: 'What hoof condition affects',
        ownerQuestion:
          "What hoof condition affects. Today it doesn't change health, training or show scores.",
      },
      {
        kind: 'paragraph',
        text: '**Care is a daily habit.** Nothing in Equoria feeds, grooms, shoes or vets your horses for you, and there are no bulk buttons. Each horse gets your own hands.',
      },
    ],
  },
  {
    id: 'grooms',
    title: 'Grooms',
    tagline: 'Your groom is ready every day, but waits for you.',
    blocks: [
      {
        kind: 'paragraph',
        text: '**Hire a groom** from **Grooms for Hire** in the Marketplace. New grooms come onto the market each week.',
      },
      {
        kind: 'paragraph',
        text: '**Press "Groom horse" every day.** A groom never works on their own. Each day, for each horse in their care, you press **Groom horse** and choose the activity. Each horse gets one groom activity a day.',
      },
      {
        kind: 'paragraph',
        text: '**The bond.** Daily grooming builds a bond between groom and horse. Some temperaments get along with some grooms better than others. The bond also counts in conformation shows.',
      },
      {
        kind: 'paragraph',
        text: "**Foals and young horses.** For horses under 3, your groom does the **enrichment**. Each week of a young horse's life brings different activities to choose from. This early care is how a young horse's traits come to light. You choose the activity, and the groom does the work.",
      },
      {
        kind: 'paragraph',
        text: '**Conformation shows need a groom.** A horse must have an assigned groom to enter. The groom it enters with stays with that entry until the show runs, even if you reassign the groom later.',
      },
      {
        kind: 'paragraph',
        text: '**Groom fees.** A groom costs **70 coins per horse per week**, and each groom looks after up to 10 horses. A groom with no horses costs nothing. Fees are taken on Monday mornings, Eastern.',
      },
      {
        kind: 'list',
        items: [
          "If you can't pay, the groom stays on your staff for one week's grace, but can't groom until you pay.",
          'If a second week goes unpaid, the groom leaves and returns to Grooms for Hire, where anyone can hire them.',
        ],
      },
    ],
  },
  {
    id: 'training',
    title: 'Training',
    tagline: 'Once a week, one discipline, one fee.',
    blocks: [
      {
        kind: 'paragraph',
        text: '**The rule:** each horse aged 3 to 20 can train **once a week**, in **one discipline** you choose that week. You can pick a different discipline next week.',
      },
      {
        kind: 'paragraph',
        text: "**What training does:** each session adds **+5 to the horse's score in that discipline.** It doesn't change the horse's stats, and it doesn't help any other discipline. A horse trained in Hunter is no better at Racing. Five weeks of Hunter training adds +25 to its Hunter score.",
      },
      { kind: 'paragraph', text: '**Trainers:**' },
      {
        kind: 'list',
        items: [
          'A horse needs an assigned trainer to train. **Hiring a trainer is free** at **Trainers for Hire**.',
          "Each trainer advertises a **training fee**. You pay it **once**, when you press **Train** at the **Training Center**. You're never charged twice for the same session.",
        ],
      },
      {
        kind: 'pending',
        topic: 'More about trainers',
        ownerQuestion:
          'Premium trainers giving +10 are planned (three tiers), but not designed yet.',
      },
      {
        kind: 'paragraph',
        text: '**Health matters.** A horse must be in Fair health or better to train.',
      },
      { kind: 'paragraph', text: '**Gaited.** Only gaited breeds can train or show in Gaited.' },
      {
        kind: 'paragraph',
        text: "Each session is recorded in the horse's training log, so you can always see what a horse has worked on.",
      },
    ],
  },
  {
    id: 'riders',
    title: 'Riders',
    tagline: 'Every ridden show needs someone in the saddle.',
    blocks: [
      {
        kind: 'list',
        items: [
          "Hire riders from **Riders** in the Marketplace. Each rider has a weekly rate, and you're charged **one week at a time**, never weeks in advance.",
          '**A horse needs an assigned rider to enter a ridden show**, and the rider must be on your staff.',
          'Some riders suit a horse better than others, and a good pairing helps the score a little.',
          "Riders, trainers and grooms are hired staff. They don't level up or gain experience. Each keeps the skill they came with.",
        ],
      },
      {
        kind: 'pending',
        topic: 'When riders retire',
        ownerQuestion:
          'When riders retire. Today the game retires them and the warnings on screen disagree about when (Equoria-oey96.26).',
      },
    ],
  },
];
