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

export const GUIDE_TITLE = 'The Equoria New Player Guide';

export const NEW_PLAYER_GUIDE: readonly GuideSection[] = [
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
          '**Temperament:** each discipline suits some temperaments (+5%), is neutral to others, and is a poor fit for a few (−5%).',
          '**Rider:** a well-suited rider helps, and a poorly suited one costs a little.',
          '**Luck:** every horse rolls between +1% and +10% at every show.',
        ],
      },
      {
        kind: 'paragraph',
        text: 'Luck adds suspense between close horses, but it never makes up for breeding and training.',
      },
      {
        kind: 'pending',
        topic: 'How much of the temperament chart players see',
        ownerQuestion:
          'Should players be able to see the full temperament-by-discipline table, or only learn it through play?',
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
        kind: 'pending',
        topic: 'Conformation classes',
        ownerQuestion: "Classes by age or sex aren't decided yet.",
      },
      {
        kind: 'paragraph',
        text: '**Parades** are all about presentation:',
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
      {
        kind: 'pending',
        topic: 'Parades',
        ownerQuestion:
          "Parades aren't open yet. Confirm whether the guide should describe them before they launch.",
      },
    ],
  },
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

export const GUIDE_CLOSING_LINE = 'Welcome to the barn. Take your time, and enjoy the horses.';

/** One piece of parsed inline text. */
export type GuideInlinePart =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'link'; text: string; sectionId: string };

const INLINE_PATTERN = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(#([a-z0-9-]+)\)/g;

/**
 * Split guide text into plain, bold, italic and section-link parts. Pure and
 * total: text that matches no mark comes back as one `text` part, so a stray
 * asterisk can never drop words from the page.
 */
export function parseGuideInline(source: string): GuideInlinePart[] {
  const parts: GuideInlinePart[] = [];
  let cursor = 0;
  for (const match of source.matchAll(INLINE_PATTERN)) {
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
