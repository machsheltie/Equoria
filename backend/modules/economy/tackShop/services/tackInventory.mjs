/**
 * Tack inventory catalog and tack-bonus policy (economy / tackShop).
 *
 * Equoria-q4uem.4 (WS4 S4, controller ruling 1b): moved verbatim out of
 * controllers/tackShopController.mjs so the economy barrel can export data and
 * policy without exporting an HTTP controller file. Consumers: horses (via the
 * barrel), competition scoring, marketplace reconciliation, inventory controller.
 */

// ── Tack inventory catalog ──────────────────────────────────────────────────

export const TACK_INVENTORY = [
  // ── Saddles ──────────────────────────────────────────────────────────────
  {
    id: 'dressage-saddle',
    category: 'saddle',
    name: 'Dressage Saddle',
    description:
      'Deep-seated saddle designed for precision movements. Enhances rider position in dressage disciplines.',
    cost: 800,
    bonus: '+5 dressage score',
    numericBonus: 5,
    tier: 'quality',
    disciplines: ['Dressage'],
    image: '/images/tack/dressage-saddle.png',
  },
  {
    id: 'jumping-saddle',
    category: 'saddle',
    name: 'Jump Saddle',
    description: 'Forward-cut saddle with knee rolls for optimal balance over fences.',
    cost: 750,
    bonus: '+5 jumping score',
    numericBonus: 5,
    tier: 'quality',
    disciplines: ['Show Jumping', 'Cross Country'],
  },
  {
    id: 'all-purpose-saddle',
    category: 'saddle',
    name: 'All Purpose Saddle',
    description:
      'Versatile saddle suitable for general riding across multiple disciplines. A great starter saddle.',
    cost: 400,
    // Owner ruling 2026-10-21: all-purpose tack is +2 in every discipline. An
    // empty list is how the shop filter shows an item under every discipline.
    bonus: '+2 all disciplines',
    numericBonus: 2,
    tier: 'basic',
    disciplines: [],
    image: '/images/tack/allpurposesaddle.png',
  },
  // Legacy alias — kept for backwards compat during migration window; do not remove until all Horse.tack records are migrated
  {
    id: 'basic-all-purpose-saddle',
    isLegacyAlias: true,
    category: 'saddle',
    name: 'All Purpose Saddle',
    description:
      'Versatile saddle suitable for general riding across multiple disciplines. A great starter saddle.',
    cost: 400,
    // Owner ruling 2026-10-21: all-purpose tack is +2 in every discipline. An
    // empty list is how the shop filter shows an item under every discipline.
    bonus: '+2 all disciplines',
    numericBonus: 2,
    tier: 'basic',
    disciplines: [],
    image: '/images/tack/allpurposesaddle.png',
  },
  {
    id: 'western-saddle',
    category: 'saddle',
    name: 'Western Saddle',
    description:
      'Classic western saddle with deep seat and horn. Built for comfort and security in western events.',
    cost: 700,
    bonus: '+5 western score',
    numericBonus: 5,
    tier: 'quality',
    disciplines: ['Western Pleasure', 'Reining', 'Barrel Racing', 'Cutting', 'Roping'],
  },
  {
    id: 'endurance-saddle',
    category: 'saddle',
    name: 'Endurance Saddle',
    description:
      'Lightweight saddle designed for long-distance riding. Minimises rider fatigue and horse soreness.',
    cost: 850,
    bonus: '+5 endurance score',
    numericBonus: 5,
    tier: 'quality',
    disciplines: ['Endurance'],
  },
  {
    id: 'racing-exercise-saddle',
    category: 'saddle',
    name: 'Racing Exercise Saddle',
    description:
      'Ultra-light flat saddle used for race training and competition. Every gram counts at top speed.',
    cost: 900,
    bonus: '+7 racing score',
    numericBonus: 7,
    tier: 'premium',
    disciplines: ['Racing', 'Steeplechase'],
  },

  // ── Bridles ──────────────────────────────────────────────────────────────
  {
    id: 'all-purpose-bridle',
    category: 'bridle',
    name: 'All Purpose Bridle',
    description:
      'Versatile bridle suitable for general training and competition across disciplines.',
    cost: 300,
    // Owner ruling 2026-10-21: all-purpose tack is +2 in every discipline. An
    // empty list is how the shop filter shows an item under every discipline.
    bonus: '+2 all disciplines',
    numericBonus: 2,
    tier: 'basic',
    disciplines: [],
  },
  // Legacy alias — kept for backwards compat during migration window
  {
    id: 'standard-bridle',
    isLegacyAlias: true,
    category: 'bridle',
    name: 'All Purpose Bridle',
    description:
      'Versatile bridle suitable for general training and competition across disciplines.',
    cost: 300,
    // Owner ruling 2026-10-21: all-purpose tack is +2 in every discipline. An
    // empty list is how the shop filter shows an item under every discipline.
    bonus: '+2 all disciplines',
    numericBonus: 2,
    tier: 'basic',
    disciplines: [],
  },
  {
    id: 'snaffle-bridle',
    category: 'bridle',
    name: 'Snaffle Bridle',
    description: 'Classic English bridle with snaffle bit. Suitable for training and competition.',
    cost: 200,
    bonus: '+2 obedience',
    numericBonus: 2,
    tier: 'basic',
    disciplines: ['Dressage', 'Show Jumping'],
  },
  {
    id: 'hackamore',
    category: 'bridle',
    name: 'Hackamore',
    description: 'Bitless bridle offering gentle control. Popular in western and trail riding.',
    cost: 180,
    bonus: '+2 comfort score',
    numericBonus: 2,
    tier: 'basic',
    disciplines: ['Western Pleasure', 'Endurance'],
  },
  {
    id: 'double-bridle',
    category: 'bridle',
    name: 'Double Bridle',
    description:
      'Two-bit bridle with bradoon and curb for advanced riders. Provides refined aids in upper-level dressage.',
    cost: 500,
    bonus: '+5 dressage score',
    numericBonus: 5,
    tier: 'quality',
    disciplines: ['Dressage'],
  },
  {
    id: 'figure-eight-bridle',
    category: 'bridle',
    name: 'Figure-Eight Bridle',
    description:
      'Crossed noseband prevents the horse from opening its mouth. Favoured in show jumping.',
    cost: 450,
    bonus: '+4 jumping score',
    numericBonus: 4,
    tier: 'quality',
    disciplines: ['Show Jumping', 'Cross Country', 'Eventing'],
  },
  {
    id: 'racing-bridle',
    category: 'bridle',
    name: 'Racing Bridle',
    description:
      'Minimal, lightweight bridle designed for speed. Reduces interference while maintaining control.',
    cost: 600,
    bonus: '+5 racing score',
    numericBonus: 5,
    tier: 'premium',
    disciplines: ['Racing', 'Steeplechase', 'Harness Racing'],
  },

  // ── Halters ──────────────────────────────────────────────────────────────
  {
    id: 'leather-halter',
    category: 'halter',
    name: 'Leather Halter',
    description: 'Durable leather halter for daily handling and turnout. A stable essential.',
    cost: 80,
    bonus: '+1 handling',
    numericBonus: 1,
    tier: 'basic',
    disciplines: [],
  },
  {
    id: 'show-halter',
    category: 'halter',
    name: 'Show Halter',
    description:
      'Polished halter with silver fittings for in-hand showing. Presents your horse at its best.',
    cost: 250,
    bonus: '+3 conformation score',
    numericBonus: 3,
    tier: 'quality',
    disciplines: ['Halter', 'In-Hand'],
  },

  // ── Saddle Pads ──────────────────────────────────────────────────────────
  {
    id: 'basic-saddle-pad',
    category: 'saddle_pad',
    name: 'Cotton Saddle Pad',
    description: 'Standard cotton pad providing cushioning and sweat absorption under the saddle.',
    cost: 60,
    bonus: '+1 comfort',
    numericBonus: 1,
    tier: 'basic',
    disciplines: [],
  },
  {
    id: 'memory-foam-pad',
    category: 'saddle_pad',
    name: 'Memory Foam Saddle Pad',
    description:
      "Contoured memory foam pad that moulds to the horse's back. Reduces pressure points during long rides.",
    cost: 200,
    bonus: '+2 comfort',
    numericBonus: 2,
    tier: 'quality',
    disciplines: ['Endurance', 'Eventing', 'Cross Country'],
  },

  // ── Leg Wraps & Boots ────────────────────────────────────────────────────
  {
    id: 'polo-wraps',
    category: 'leg_wraps',
    name: 'Polo Wraps',
    description: 'Soft fleece wraps providing light support and protection during exercise.',
    cost: 50,
    bonus: '+1 protection',
    numericBonus: 1,
    tier: 'basic',
    disciplines: [],
  },
  {
    id: 'splint-boots',
    category: 'leg_wraps',
    name: 'Splint Boots',
    description:
      'Hard-shell boots protecting the cannon bone and splint area from strikes during jumping.',
    cost: 150,
    bonus: '+2 protection',
    numericBonus: 2,
    tier: 'quality',
    disciplines: ['Show Jumping', 'Cross Country', 'Eventing'],
  },
  {
    id: 'sport-medicine-boots',
    category: 'leg_wraps',
    name: 'Sport Medicine Boots',
    description:
      'High-performance boots with fetlock support and shock absorption. Used by top competitors.',
    cost: 350,
    bonus: '+3 protection',
    numericBonus: 3,
    tier: 'premium',
    disciplines: ['Show Jumping', 'Cross Country', 'Barrel Racing', 'Reining'],
  },

  // ── Girths ───────────────────────────────────────────────────────────────
  {
    id: 'leather-girth',
    category: 'girth',
    name: 'Leather Girth',
    description: 'Traditional leather girth. Durable and reliable for everyday riding.',
    cost: 100,
    bonus: '+1 stability',
    numericBonus: 1,
    tier: 'basic',
    disciplines: [],
  },
  {
    id: 'anatomic-girth',
    category: 'girth',
    name: 'Anatomic Girth',
    description:
      'Contoured girth with cutaway design for shoulder freedom. Improves comfort and movement.',
    cost: 280,
    bonus: '+2 comfort',
    numericBonus: 2,
    tier: 'quality',
    disciplines: ['Dressage', 'Show Jumping', 'Eventing'],
  },

  // ── Reins ────────────────────────────────────────────────────────────────
  {
    id: 'rubber-reins',
    category: 'reins',
    name: 'Rubber Grip Reins',
    description: 'Leather reins with rubber grip for secure hold in all conditions.',
    cost: 70,
    bonus: '+1 control',
    numericBonus: 1,
    tier: 'basic',
    disciplines: [],
  },
  {
    id: 'laced-reins',
    category: 'reins',
    name: 'Laced Reins',
    description:
      'Hand-laced leather reins providing excellent grip without bulk. Preferred for jumping.',
    cost: 120,
    bonus: '+2 control',
    numericBonus: 2,
    tier: 'quality',
    disciplines: ['Show Jumping', 'Cross Country', 'Eventing', 'Hunter'],
  },

  // ── Breastplates ─────────────────────────────────────────────────────────
  {
    id: 'hunting-breastplate',
    category: 'breastplate',
    name: 'Hunting Breastplate',
    description: 'Three-point breastplate preventing saddle slip on galloping and jumping horses.',
    cost: 180,
    bonus: '+2 stability',
    numericBonus: 2,
    tier: 'quality',
    disciplines: ['Cross Country', 'Eventing', 'Hunter', 'Steeplechase'],
  },
  {
    id: 'five-point-breastplate',
    category: 'breastplate',
    name: 'Five-Point Breastplate',
    description:
      'Full chest breastplate distributing pressure evenly. Maximum saddle stability for demanding courses.',
    cost: 320,
    bonus: '+3 stability',
    numericBonus: 3,
    tier: 'premium',
    disciplines: ['Cross Country', 'Eventing', 'Steeplechase'],
  },

  // ── Young Horse Prep (age-gated) ─────────────────────────────────────────
  {
    id: 'foal-halter',
    category: 'halter',
    name: 'Foal Halter',
    description:
      'Adjustable halter sized for young horses. Used for early handling and desensitisation.',
    cost: 40,
    bonus: '+1 handling',
    numericBonus: 1,
    tier: 'basic',
    disciplines: [],
    ageRestriction: 2,
  },
  {
    id: 'surcingle',
    category: 'saddle_pad',
    name: 'Surcingle',
    description:
      'Training surcingle for backing and lunging young horses. Introduces the feel of girth pressure.',
    cost: 120,
    bonus: '+2 training prep',
    numericBonus: 2,
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
    cost: 120,
    bonus: '+3 presentation',
    numericBonus: 0,
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
    cost: 200,
    bonus: '+4 presentation',
    numericBonus: 0,
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
    cost: 350,
    bonus: '+5 presentation',
    numericBonus: 0,
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
    cost: 80,
    bonus: '+2 presentation',
    numericBonus: 0,
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
    cost: 160,
    bonus: '+3 presentation',
    numericBonus: 0,
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
    cost: 500,
    bonus: '+6 presentation',
    numericBonus: 0,
    presenceBonus: 6,
    tier: 'premium',
    disciplines: ['Parade'],
    isCosmetic: true,
    seasonalTag: 'winter',
  },
];

/**
 * The catalogue items of one category, legacy aliases included. Ridden show
 * scoring reads a saddle's or bridle's `disciplines` through this
 * (competition/rules/tackScoring.mjs, Equoria-k1p62.2).
 *
 * @param {string} category - e.g. 'saddle', 'bridle', 'decorative'.
 * @returns {Array<object>}
 */
export function tackCatalogItems(category) {
  return TACK_INVENTORY.filter(item => item.category === category);
}

/**
 * Resolve tack bonuses from a Horse.tack JSON object.
 *
 * @param {Object} tack - Horse.tack JSON object
 * @param {string} [showType='ridden'] - Show type: 'ridden' | 'conformation' | 'parade'
 * @returns {{ saddleBonus: number, bridleBonus: number, presenceBonus: number }}
 */
export function resolveTackBonus(tack, showType = 'ridden') {
  if (!tack || typeof tack !== 'object') {
    return { saddleBonus: 0, bridleBonus: 0, presenceBonus: 0 };
  }

  // If numeric fields already exist (test data / legacy), return them directly
  const hasDirect = typeof tack.saddleBonus === 'number' || typeof tack.bridleBonus === 'number';
  if (hasDirect) {
    return {
      saddleBonus: tack.saddleBonus || 0,
      bridleBonus: tack.bridleBonus || 0,
      presenceBonus: 0,
    };
  }

  // Look up item IDs in the catalog
  let saddleBonus = 0;
  let bridleBonus = 0;

  if (tack.saddle) {
    const saddleItem = tackCatalogItems('saddle').find(i => i.id === tack.saddle);
    if (saddleItem) {
      saddleBonus = saddleItem.numericBonus;
    }
  }

  if (tack.bridle) {
    const bridleItem = tackCatalogItems('bridle').find(i => i.id === tack.bridle);
    if (bridleItem) {
      bridleBonus = bridleItem.numericBonus;
    }
  }

  // Decorative presence bonus — only applies to parade shows
  let presenceBonus = 0;
  if (showType === 'parade') {
    const decorations = Array.isArray(tack.decorations) ? tack.decorations : [];
    for (const itemId of decorations) {
      const item = tackCatalogItems('decorative').find(i => i.id === itemId);
      if (item && typeof item.presenceBonus === 'number') {
        presenceBonus += item.presenceBonus;
      }
    }
  }

  return { saddleBonus, bridleBonus, presenceBonus };
}
