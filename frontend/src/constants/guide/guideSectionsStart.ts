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
        kind: 'paragraph',
        text: 'You can come back to this guide at any time from the **Guide** link.',
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
      {
        kind: 'paragraph',
        text: '**Up to four accounts.** Each player may keep up to four accounts.',
      },
      { kind: 'paragraph', text: '**A good first day:**' },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Buy feed at the **Feed Shop**, equip it on your horse, and feed it.',
          'At the **Veterinarian**, choose your horse and press **Vet Horse**.',
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
          '**12 stats:** Precision, Strength, Speed, Agility, Endurance, Intelligence, Stamina, Balance, Boldness, Flexibility, Obedience and Focus. **Stats have no cap, ever.** They never change with age. You raise them through feeding, the farrier, showing, Horse Points and breeding.',
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
        text: '**Health is the only consequence in Equoria.** Neglect never kills a horse, and nothing else wears it down. But a horse in **Bad** health cannot breed, train or enter a show until you bring it back.',
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
          'Equip a feed on the horse, then press **Feed**. Each feeding uses one unit.',
          "A well-fed horse eats once per game day. A hungry horse goes up one hunger level with each feeding, and you can keep feeding it until it's back to Excellent.",
          'When the feed runs out, the horse goes back to having no feed equipped. Buy more and equip it again.',
          'Feeds come in five tiers: Basic, Performance, Performance Plus, High Performance and Elite. Better feed matters most for a mare in foal (see [Breeding](#breeding)).',
        ],
      },
      {
        kind: 'paragraph',
        text: '**A chance at a stat.** Every feeding above Basic gets one roll. If it comes up, the horse gains **+1 to one of its 12 stats**, picked at random. A better feed rolls more often:',
      },
      {
        kind: 'table',
        caption: 'Chance of +1 to a random stat on each feeding',
        columns: ['Feed', 'Chance per feeding'],
        rows: [
          ['Basic', 'None'],
          ['Performance', '10%'],
          ['Performance Plus', '15%'],
          ['High Performance', '20%'],
          ['Elite', '25%'],
        ],
      },
      {
        kind: 'paragraph',
        text: 'Each feeding gets its own roll. Stats have no cap, so a gain is always kept.',
      },
      {
        kind: 'paragraph',
        text: "**The Veterinarian.** Choose a horse and press **Vet Horse**. A health check always brings the horse's vet care back to Excellent. It costs **100 coins for each level** its vet care has slipped below Excellent: Very Good 100, Good 200, Fair 300 and Bad 400. A horse whose vet care is already Excellent doesn't need one.",
      },
      {
        kind: 'paragraph',
        text: "**Genetic Testing.** A horse's color genes stay hidden until you test it. Choose the horse at the Veterinarian and press **Run Panel** (500 coins).",
      },
      {
        kind: 'paragraph',
        text: "**How health is worked out.** A horse's health comes from its vet care, and hunger can pull it down:",
      },
      {
        kind: 'table',
        caption:
          'Health by days since the last vet visit, and hunger by days since the last feeding',
        columns: ['Level', 'Health: days since last vet visit', 'Hunger: days since last feeding'],
        rows: [
          ['Excellent', '0–7', '0–2'],
          ['Very Good', '8–14', '3–4'],
          ['Good', '15–21', '5–6'],
          ['Fair', '22–28', '7–8'],
          ['Bad', '29 or more', '9 or more'],
        ],
      },
      {
        kind: 'paragraph',
        text: "Hunger at Fair lowers the horse's health by one level, and hunger at Bad lowers it by two. So feeding doesn't cancel out a missed vet visit, and a vet visit doesn't cancel out missed meals.",
      },
      {
        kind: 'paragraph',
        text: '**The Farrier.** Once a week, choose a horse at the Farrier and press **Shoe Horse** (50 coins). The horse is recorded as shod, and for now it gains +1 in one stat, picked at random.',
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
        text: "**The bond.** Daily grooming builds a bond between groom and horse, starting from nothing. You can see the bond on every horse's page. Some temperaments get along with some grooms better than others. The bond also counts in conformation shows.",
      },
      {
        kind: 'paragraph',
        text: "**Foals and young horses.** For horses under 3, your groom does the **enrichment**. Each week of a young horse's life brings different activities to choose from. You choose the activity, and the groom does the work.",
      },
      {
        kind: 'paragraph',
        text: "**How traits come to light.** A horse's first 21 days, the three years before it turns 3, are when its traits are discovered. Once a foal has had a few days of grooming, each further day it's groomed gives a chance for a good trait to be revealed. Days without grooming give bad traits the same kind of chance, and can switch a good trait off. Grooming can also switch off a bad trait a foal was born with. Nothing is guaranteed, and some traits need grooming on most of those 21 days.",
      },
      {
        kind: 'paragraph',
        text: '**Conformation shows need a groom.** A horse must have an assigned groom to enter. The groom it enters with stays with that entry until the show runs, even if you reassign the groom later.',
      },
      {
        kind: 'paragraph',
        text: '**Groom fees.** A groom costs **70 coins per horse per week**, and each groom looks after up to 20 horses. A groom with no horses costs nothing. Fees are taken on Monday mornings, Eastern.',
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
          "Hire riders from **Riders** in the Marketplace. Each rider has a weekly rate, and you're charged **one week at a time**, never weeks in advance. Hiring pays the first week.",
          '**Payday is every Monday morning, Eastern**, like the grooms. All your riders are paid together in one payment.',
          "**If you can't cover payday,** nothing is taken, your riders can't ride in shows, and the missed week is owed. A rider rides again only once that week's pay and every owed week are paid. A rider left unpaid for a full week leaves your staff.",
          '**A horse needs an assigned rider to enter a ridden show**, and the rider must be on your staff.',
          'Some riders suit a horse better than others, and a good pairing helps the score a little.',
          "Riders, trainers and grooms are hired staff. They don't level up or gain experience. Each keeps the skill they came with.",
        ],
      },
      {
        kind: 'paragraph',
        text: '**Riders retire on their own.** The game decides when, and nobody can see it coming. You get a notice a week before a rider retires, so you can hire a replacement.',
      },
    ],
  },
];
