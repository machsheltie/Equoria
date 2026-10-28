/**
 * Tack inventory catalog (economy / tackShop).
 *
 * Equoria-q4uem.4 (WS4 S4, controller ruling 1b): moved verbatim out of
 * controllers/tackShopController.mjs so the economy barrel can export data and
 * policy without exporting an HTTP controller file. Consumers: horses (via the
 * barrel), competition scoring, marketplace reconciliation, inventory controller.
 *
 * News (Equoria-wbt8l): an item added after launch carries
 * `addedOn: 'YYYY-MM-DD'` (its Eastern game date); the nightly News pass
 * announces it under New Items that day. Launch items carry none.
 *
 * Owner rulings 2026-10-23 (Stacey, epic Equoria-k1p62, Equoria-cv3if):
 *   - Only saddles and bridles score. Each one is for ONE discipline and gives
 *     +5 there (0 elsewhere); the All Purpose saddle and bridle give +2 in every
 *     discipline. Every one of the 24 disciplines has one discipline saddle (a
 *     harness for the four driving disciplines, which take the saddle slot) and
 *     one discipline bridle. The discipline names come from DISCIPLINES in
 *     constants/schema.mjs, the one discipline list.
 *   - Tack that does not score is kept in the game marked `comingSoon`, with no
 *     effect text.
 *   - A new discipline item has no art yet: it carries no `image`, so the client
 *     shows its image fallback. Do not invent art.
 */

import { DISCIPLINES } from '../../../../constants/schema.mjs';

/** Points for each discipline saddle, harness or bridle in its own discipline. */
export const disciplineTackPoints = 5;
/** Points for each All Purpose saddle or bridle, in any discipline. */
export const allPurposeTackPoints = 2;

/**
 * The player-facing bonus label for a saddle or bridle, derived from the same
 * disciplines list the score reads, so the shop, the crafted item and the
 * inventory say what the score really does with it.
 *
 * @param {string[]} disciplines - The item's disciplines ([] = All Purpose).
 * @returns {string} '+2 all disciplines' or '+5 in A, B and C shows'.
 */
export function tackBonusLabel(disciplines) {
  if (disciplines.length === 0) {
    return `+${allPurposeTackPoints} all disciplines`;
  }
  const names =
    disciplines.length === 1
      ? disciplines[0]
      : `${disciplines.slice(0, -1).join(', ')} and ${disciplines[disciplines.length - 1]}`;
  return `+${disciplineTackPoints} in ${names} shows`;
}

/**
 * An item category as a word (Equoria-no441, owner rulings 2026-10-28
 * q164/q165: players read names, not stored codes). Accepts either spelling of
 * a two-word category (saddle_pad / saddlePad); an unknown one reads "Tack".
 * Matches frontend/src/lib/tackLabels.ts.
 */
const tackCategoryWords = Object.freeze({
  saddle: 'Saddle',
  bridle: 'Bridle',
  halter: 'Halter',
  saddlePad: 'Saddle Pad',
  legWraps: 'Leg Wraps',
  reins: 'Reins',
  girth: 'Girth',
  breastplate: 'Breastplate',
  decorative: 'Decorative',
  feed: 'Feed',
});

export function tackCategoryLabel(category) {
  if (typeof category !== 'string') {
    return 'Tack';
  }
  const key = category.trim().replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
  return Object.hasOwn(tackCategoryWords, key) ? tackCategoryWords[key] : 'Tack';
}

/** An inventory or catalogue item with its category's word beside the code. */
export function withCategoryLabel(item) {
  return { ...item, categoryLabel: tackCategoryLabel(item?.category) };
}

// ── Discipline saddles, harnesses and bridles ───────────────────────────────

/** The driving disciplines wear a harness in the saddle slot. */
const harnessDisciplines = new Set([
  'Combined Driving',
  'Fine Harness',
  'Harness Racing',
  'Pleasure Driving',
]);

/** Every discipline, from the one discipline list in constants/schema.mjs. */
const allDisciplines = Object.values(DISCIPLINES);

/**
 * Owner ruling 2026-10-26 (q78, Equoria-dslww): every tack item costs 500
 * coins: saddles, harnesses, bridles, the All Purpose pair, halters, pads,
 * wraps, reins, girths, breastplates, the Coming soon items, the decorations
 * and the retired aliases. This is the one price; the catalogue reads it.
 */
export const tackPrice = 500;

const keptImage = Object.freeze({
  'dressage-saddle': '/images/tack/dressage-saddle.png',
  'saddleseat-saddle': '/images/tack/saddleseatsaddle.png',
});

const slug = discipline => discipline.toLowerCase().replaceAll(' ', '-');

function disciplineSaddleOrHarness(discipline) {
  const harness = harnessDisciplines.has(discipline);
  // Fine Harness already says what it is; the others take the noun.
  const name = discipline.endsWith('Harness')
    ? discipline
    : `${discipline} ${harness ? 'Harness' : 'Saddle'}`;
  const id = slug(name);
  return {
    id,
    category: 'saddle',
    name,
    description: harness
      ? `A harness built for ${discipline}, worn where other disciplines use a saddle.`
      : `A saddle made for ${discipline} and no other discipline.`,
    cost: tackPrice,
    bonus: tackBonusLabel([discipline]),
    tier: 'quality',
    disciplines: [discipline],
    ...(keptImage[id] ? { image: keptImage[id] } : {}),
  };
}

function disciplineBridle(discipline) {
  const id = `${slug(discipline)}-bridle`;
  return {
    id,
    category: 'bridle',
    name: `${discipline} Bridle`,
    description: `A bridle made for ${discipline} and no other discipline.`,
    cost: tackPrice,
    bonus: tackBonusLabel([discipline]),
    tier: 'quality',
    disciplines: [discipline],
  };
}

const disciplineSaddles = allDisciplines.map(disciplineSaddleOrHarness);
const disciplineBridles = allDisciplines.map(disciplineBridle);

/**
 * Saddles and bridles that were shared by several disciplines before the
 * one-discipline ruling (q02). Players may still have them on a horse, so they
 * keep working as hidden aliases of the single-discipline item named by
 * `target` (the first discipline they listed) at the one saddle-and-bridle price.
 * `racing-bridle` kept its id on the Racing bridle and needs no alias.
 */
const retiredSharedTack = Object.freeze([
  { id: 'jumping-saddle', target: 'show-jumping-saddle' },
  { id: 'western-saddle', target: 'western-pleasure-saddle' },
  { id: 'racing-exercise-saddle', target: 'racing-saddle' },
  { id: 'snaffle-bridle', target: 'dressage-bridle' },
  { id: 'hackamore', target: 'western-pleasure-bridle' },
  { id: 'double-bridle', target: 'dressage-bridle' },
  { id: 'figure-eight-bridle', target: 'show-jumping-bridle' },
]);

const retiredSharedAliases = retiredSharedTack.map(({ id, target }) => {
  const item = [...disciplineSaddles, ...disciplineBridles].find(i => i.id === target);
  return { ...item, id, isLegacyAlias: true };
});

// ── Tack inventory catalog ──────────────────────────────────────────────────

export const TACK_INVENTORY = [
  // ── All Purpose saddle and bridle (+2 in every discipline) ──────────────
  {
    id: 'all-purpose-saddle',
    category: 'saddle',
    name: 'All Purpose Saddle',
    description:
      'Versatile saddle suitable for general riding across multiple disciplines. A great starter saddle.',
    cost: tackPrice,
    // An empty list is how the shop filter shows an item under every discipline.
    bonus: tackBonusLabel([]),
    tier: 'basic',
    disciplines: [],
    image: '/images/tack/allpurposesaddle.png',
  },
  {
    id: 'all-purpose-bridle',
    category: 'bridle',
    name: 'All Purpose Bridle',
    description:
      'Versatile bridle suitable for general training and competition across disciplines.',
    cost: tackPrice,
    bonus: tackBonusLabel([]),
    tier: 'basic',
    disciplines: [],
  },

  // ── One +5 saddle or harness and one +5 bridle per discipline ───────────
  ...disciplineSaddles,
  ...disciplineBridles,
  ...retiredSharedAliases,

  // ── Halters ──────────────────────────────────────────────────────────────
  {
    id: 'leather-halter',
    category: 'halter',
    comingSoon: true,
    name: 'Leather Halter',
    description: 'Durable leather halter for daily handling and turnout. A stable essential.',
    cost: tackPrice,
    tier: 'basic',
    disciplines: [],
  },
  {
    id: 'show-halter',
    category: 'halter',
    comingSoon: true,
    name: 'Show Halter',
    description:
      'Polished halter with silver fittings for in-hand showing. Presents your horse at its best.',
    cost: tackPrice,
    tier: 'quality',
    disciplines: ['Halter', 'In-Hand'],
  },

  // ── Saddle Pads ──────────────────────────────────────────────────────────
  {
    id: 'basic-saddle-pad',
    category: 'saddle_pad',
    comingSoon: true,
    name: 'Cotton Saddle Pad',
    description: 'Standard cotton pad providing cushioning and sweat absorption under the saddle.',
    cost: tackPrice,
    tier: 'basic',
    disciplines: [],
  },
  {
    id: 'memory-foam-pad',
    category: 'saddle_pad',
    comingSoon: true,
    name: 'Memory Foam Saddle Pad',
    description:
      "Contoured memory foam pad that molds to the horse's back. Reduces pressure points during long rides.",
    cost: tackPrice,
    tier: 'quality',
    disciplines: ['Endurance', 'Eventing', 'Cross Country'],
  },

  // ── Leg Wraps & Boots ────────────────────────────────────────────────────
  {
    id: 'polo-wraps',
    category: 'leg_wraps',
    comingSoon: true,
    name: 'Polo Wraps',
    description: 'Soft fleece wraps providing light support and protection during exercise.',
    cost: tackPrice,
    tier: 'basic',
    disciplines: [],
  },
  {
    id: 'splint-boots',
    category: 'leg_wraps',
    comingSoon: true,
    name: 'Splint Boots',
    description:
      'Hard-shell boots protecting the cannon bone and splint area from strikes during jumping.',
    cost: tackPrice,
    tier: 'quality',
    disciplines: ['Show Jumping', 'Cross Country', 'Eventing'],
  },
  {
    id: 'sport-medicine-boots',
    category: 'leg_wraps',
    comingSoon: true,
    name: 'Sport Medicine Boots',
    description:
      'High-performance boots with fetlock support and shock absorption. Used by top competitors.',
    cost: tackPrice,
    tier: 'premium',
    disciplines: ['Show Jumping', 'Cross Country', 'Barrel Racing', 'Reining'],
  },

  // ── Girths ───────────────────────────────────────────────────────────────
  {
    id: 'leather-girth',
    category: 'girth',
    comingSoon: true,
    name: 'Leather Girth',
    description: 'Traditional leather girth. Durable and reliable for everyday riding.',
    cost: tackPrice,
    tier: 'basic',
    disciplines: [],
  },
  {
    id: 'anatomic-girth',
    category: 'girth',
    comingSoon: true,
    name: 'Anatomic Girth',
    description:
      'Contoured girth with cutaway design for shoulder freedom. Improves comfort and movement.',
    cost: tackPrice,
    tier: 'quality',
    disciplines: ['Dressage', 'Show Jumping', 'Eventing'],
  },

  // ── Reins ────────────────────────────────────────────────────────────────
  {
    id: 'rubber-reins',
    category: 'reins',
    comingSoon: true,
    name: 'Rubber Grip Reins',
    description: 'Leather reins with rubber grip for secure hold in all conditions.',
    cost: tackPrice,
    tier: 'basic',
    disciplines: [],
  },
  {
    id: 'laced-reins',
    category: 'reins',
    comingSoon: true,
    name: 'Laced Reins',
    description:
      'Hand-laced leather reins providing excellent grip without bulk. Preferred for jumping.',
    cost: tackPrice,
    tier: 'quality',
    disciplines: ['Show Jumping', 'Cross Country', 'Eventing', 'Hunter'],
  },

  // ── Breastplates ─────────────────────────────────────────────────────────
  {
    id: 'hunting-breastplate',
    category: 'breastplate',
    comingSoon: true,
    name: 'Hunting Breastplate',
    description: 'Three-point breastplate preventing saddle slip on galloping and jumping horses.',
    cost: tackPrice,
    tier: 'quality',
    disciplines: ['Cross Country', 'Eventing', 'Hunter', 'Steeplechase'],
  },
  {
    id: 'five-point-breastplate',
    category: 'breastplate',
    comingSoon: true,
    name: 'Five-Point Breastplate',
    description:
      'Full chest breastplate distributing pressure evenly. Maximum saddle stability for demanding courses.',
    cost: tackPrice,
    tier: 'premium',
    disciplines: ['Cross Country', 'Eventing', 'Steeplechase'],
  },

  // ── Young Horse Prep (age-gated) ─────────────────────────────────────────
  {
    id: 'foal-halter',
    category: 'halter',
    comingSoon: true,
    name: 'Foal Halter',
    description:
      'Adjustable halter sized for young horses. Used for early handling and desensitisation.',
    cost: tackPrice,
    tier: 'basic',
    disciplines: [],
    ageRestriction: 2,
  },
  {
    id: 'surcingle',
    category: 'saddle_pad',
    comingSoon: true,
    name: 'Surcingle',
    description:
      'Training surcingle for backing and lunging young horses. Introduces the feel of girth pressure.',
    cost: tackPrice,
    tier: 'basic',
    disciplines: [],
    ageRestriction: 2,
  },

  // ── Decorative & Parade Tack ─────────────────────────────────────────────
  {
    id: 'show-ribbon',
    category: 'decorative',
    name: 'Show Ribbon',
    description: 'A silk ribbon braided into the mane. Adds elegance and charm to parade shows.',
    cost: tackPrice,
    bonus: '+3 presentation',
    presenceBonus: 3,
    tier: 'basic',
    disciplines: ['Parade'],
    isCosmetic: true,
  },
  {
    id: 'braided-mane-wrap',
    category: 'decorative',
    name: 'Braided Mane Wrap',
    description:
      'Intricate braided mane styling with gold thread accents. A staple for high-scoring parade entries.',
    cost: tackPrice,
    bonus: '+4 presentation',
    presenceBonus: 4,
    tier: 'basic',
    disciplines: ['Parade'],
    isCosmetic: true,
  },
  {
    id: 'parade-blanket',
    category: 'decorative',
    name: 'Parade Blanket',
    description:
      'Embroidered ceremonial blanket draped over the hindquarters. Impressive at full presentation speed.',
    cost: tackPrice,
    bonus: '+5 presentation',
    presenceBonus: 5,
    tier: 'quality',
    disciplines: ['Parade'],
    isCosmetic: true,
  },
  {
    id: 'glitter-spray',
    category: 'decorative',
    name: 'Glitter Spray',
    description: 'Shimmering coat spray for that extra sparkle. Limited use — 3 applications.',
    cost: tackPrice,
    bonus: '+2 presentation',
    presenceBonus: 2,
    tier: 'basic',
    disciplines: ['Parade'],
    isCosmetic: true,
    limitedUse: 3,
  },
  {
    id: 'floral-browband',
    category: 'decorative',
    name: 'Floral Browband',
    description:
      'Fresh flowers woven into the browband. A classic touch of nature for summer parade classes.',
    cost: tackPrice,
    bonus: '+3 presentation',
    presenceBonus: 3,
    tier: 'basic',
    disciplines: ['Parade'],
    isCosmetic: true,
  },
  // Seasonal decorative item
  {
    id: 'snowflake-parade-tack',
    category: 'decorative',
    name: 'Snowflake Parade Tack',
    description:
      'A limited winter set with silver snowflake embroidery. Available during the frost season.',
    cost: tackPrice,
    bonus: '+6 presentation',
    presenceBonus: 6,
    tier: 'premium',
    disciplines: ['Parade'],
    isCosmetic: true,
    seasonalTag: 'winter',
  },
];

/**
 * The player-facing effect fields of a catalogue item or crafting recipe: its
 * `bonus` label when it scores, `comingSoon: true` when it does not yet (owner
 * ruling q32, 2026-10-23). Every inventory record is written from this, so no
 * stale or invented effect text is copied into a player's inventory.
 *
 * @param {{ bonus?: string, comingSoon?: boolean } | null | undefined} definition
 * @returns {{ bonus?: string, comingSoon?: true }}
 */
export function tackEffectFields(definition) {
  return {
    ...(definition?.bonus ? { bonus: definition.bonus } : {}),
    ...(definition?.comingSoon ? { comingSoon: true } : {}),
  };
}

/**
 * The catalogue items of one category, legacy aliases included. Ridden show
 * scoring reads a saddle's or bridle's `disciplines` through this
 * (competition/rules/tackScoring.mjs, Equoria-k1p62.2).
 *
 * @param {string} category - e.g. 'saddle', 'bridle', 'decorative'.
 * @returns {Array<object>}
 */
export function tackCatalogItems(category) {
  return allTackItems().filter(item => item.category === category);
}

/**
 * Every catalogue item, legacy aliases included (camelCase accessor; the
 * nightly News pass reads new items through it, Equoria-wbt8l).
 *
 * @returns {ReadonlyArray<object>}
 */
export function allTackItems() {
  return TACK_INVENTORY;
}
