/**
 * Tack Shop Controller
 * Handles tack shop: listing inventory and purchasing items.
 *
 * Uses existing Horse.tack (Json) field — no schema changes required.
 *
 * Routes:
 *   GET  /api/tack-shop/inventory          → list available tack items
 *   POST /api/tack-shop/purchase           → purchase an item for a horse
 *   POST /api/tack-shop/unequip-decoration → remove a decorative item
 *
 * Tack does NOT degrade with use. The previous condition / repair system
 * was removed 2026-05-05 (Equoria-045l). Any *_condition values left in
 * existing Horse.tack JSON rows are harmless dead data — the scoring path
 * no longer reads them.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { recordTransaction } from '../../../services/financialLedgerService.mjs';

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
    disciplines: ['Show Jumping', 'Cross-Country'],
  },
  {
    id: 'basic-all-purpose-saddle',
    category: 'saddle',
    name: 'All-Purpose Saddle',
    description:
      'Versatile saddle suitable for general riding across multiple disciplines. A great starter saddle.',
    cost: 400,
    bonus: '+2 all disciplines',
    numericBonus: 2,
    tier: 'basic',
    disciplines: ['Dressage', 'Show Jumping', 'Cross-Country', 'Eventing', 'Hunter'],
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
    disciplines: ['Show Jumping', 'Cross-Country', 'Eventing'],
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
    disciplines: ['Endurance', 'Eventing', 'Cross-Country'],
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
    disciplines: ['Show Jumping', 'Cross-Country', 'Eventing'],
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
    disciplines: ['Show Jumping', 'Cross-Country', 'Barrel Racing', 'Reining'],
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
    disciplines: ['Show Jumping', 'Cross-Country', 'Eventing', 'Hunter'],
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
    disciplines: ['Cross-Country', 'Eventing', 'Hunter', 'Steeplechase'],
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
    disciplines: ['Cross-Country', 'Eventing', 'Steeplechase'],
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

// ── Category display configuration ──────────────────────────────────────────

const CATEGORY_DISPLAY = {
  saddle: 'Saddles',
  bridle: 'Bridles',
  halter: 'Halters',
  saddle_pad: 'Saddle Pads',
  leg_wraps: 'Leg Wraps & Boots',
  reins: 'Reins',
  girth: 'Girths',
  breastplate: 'Breastplates',
  decorative: 'Decorative & Parade',
};

// ── Bonus resolution ────────────────────────────────────────────────────────

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
    const saddleItem = TACK_INVENTORY.find(i => i.id === tack.saddle && i.category === 'saddle');
    if (saddleItem) {
      saddleBonus = saddleItem.numericBonus;
    }
  }

  if (tack.bridle) {
    const bridleItem = TACK_INVENTORY.find(i => i.id === tack.bridle && i.category === 'bridle');
    if (bridleItem) {
      bridleBonus = bridleItem.numericBonus;
    }
  }

  // Decorative presence bonus — only applies to parade shows
  let presenceBonus = 0;
  if (showType === 'parade') {
    const decorations = Array.isArray(tack.decorations) ? tack.decorations : [];
    for (const itemId of decorations) {
      const item = TACK_INVENTORY.find(i => i.id === itemId && i.category === 'decorative');
      if (item && typeof item.presenceBonus === 'number') {
        presenceBonus += item.presenceBonus;
      }
    }
  }

  return { saddleBonus, bridleBonus, presenceBonus };
}

// ── Route handlers ──────────────────────────────────────────────────────────

/**
 * GET /api/tack-shop/inventory
 * Returns full catalog grouped by category.
 */
export async function getTackInventory(_req, res) {
  // Build categories dynamically from the catalog
  const categories = {};
  for (const item of TACK_INVENTORY) {
    const key = item.category;
    if (!categories[key]) {
      categories[key] = [];
    }
    categories[key].push(item);
  }

  res.status(200).json({
    success: true,
    message: 'Tack inventory retrieved successfully',
    data: {
      items: TACK_INVENTORY,
      categories,
      categoryDisplayNames: CATEGORY_DISPLAY,
    },
  });
}

/**
 * POST /api/tack-shop/purchase
 * Body: { horseId, itemId }
 *
 * Stores item ID AND numeric bonuses in Horse.tack so both old and new
 * scoring code works.
 */
export async function purchaseTackItem(req, res) {
  try {
    const userId = req.user.id;
    const { horseId, itemId } = req.body;

    const item = TACK_INVENTORY.find(i => i.id === itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: 'Item not found in inventory', data: null });
    }

    const horse = await prisma.horse.findFirst({ where: { id: horseId, userId } });
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found', data: null });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    if (user.money < item.cost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. ${item.name} costs $${item.cost}`,
        data: { required: item.cost, available: user.money },
      });
    }

    // Merge item into horse.tack JSON — store item ID, numeric bonuses, and initial condition
    const currentTack = typeof horse.tack === 'object' && horse.tack !== null ? horse.tack : {};
    const updatedTack = { ...currentTack };

    if (item.category === 'decorative') {
      // Decorative items are additive — append to decorations array (no duplicates)
      const existing = Array.isArray(updatedTack.decorations) ? updatedTack.decorations : [];
      if (!existing.includes(item.id)) {
        updatedTack.decorations = [...existing, item.id];
      }
    } else {
      // Functional items replace the slot
      updatedTack[item.category] = item.id;

      // Also store numeric bonus fields for scoring compatibility
      if (item.category === 'saddle') {
        updatedTack.saddleBonus = item.numericBonus;
      } else if (item.category === 'bridle') {
        updatedTack.bridleBonus = item.numericBonus;
      }
    }

    const [updatedHorse, updatedUser] = await prisma.$transaction([
      prisma.horse.update({
        where: { id: horseId },
        data: { tack: updatedTack },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { money: { decrement: item.cost } },
        select: { money: true },
      }),
    ]);
    // Record financial transaction as best-effort (non-blocking)
    recordTransaction({
      userId,
      type: 'debit',
      amount: item.cost,
      category: 'tack_purchase',
      description: `${item.name} for ${horse.name ?? horseId}`,
      balanceAfter: updatedUser?.money,
      metadata: { horseId, itemId: item.id, category: item.category },
    }).catch(err => logger.error(`[tackShopController] ledger error: ${err.message}`));

    logger.info(
      `[tackShopController] User ${userId} purchased "${item.name}" for horse ${horseId} — cost $${item.cost}`,
    );

    res.status(200).json({
      success: true,
      message: `${item.name} purchased successfully`,
      data: {
        horse: {
          id: updatedHorse.id,
          name: updatedHorse.name,
          tack: updatedHorse.tack,
        },
        item,
        cost: item.cost,
        remainingMoney: updatedUser.money,
      },
    });
  } catch (error) {
    logger.error(`[tackShopController] purchaseTackItem error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to purchase tack item', data: null });
  }
}

/**
 * POST /api/tack-shop/unequip-decoration
 * Body: { horseId, itemId }
 *
 * Removes a decorative item from Horse.tack.decorations[] by item ID.
 * Does not charge coins — this is purely a cosmetic management operation.
 */
export async function unequipDecoration(req, res) {
  try {
    const userId = req.user.id;
    const { horseId, itemId } = req.body;

    const horse = await prisma.horse.findFirst({ where: { id: horseId, userId } });
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found', data: null });
    }

    const currentTack = typeof horse.tack === 'object' && horse.tack !== null ? horse.tack : {};
    const existing = Array.isArray(currentTack.decorations) ? currentTack.decorations : [];

    if (!existing.includes(itemId)) {
      return res.status(400).json({
        success: false,
        message: `Decoration "${itemId}" is not equipped on this horse`,
        data: null,
      });
    }

    const updatedTack = { ...currentTack, decorations: existing.filter(id => id !== itemId) };
    const updatedHorse = await prisma.horse.update({
      where: { id: horseId },
      data: { tack: updatedTack },
    });

    logger.info(
      `[tackShopController] User ${userId} unequipped decoration "${itemId}" from horse ${horseId}`,
    );

    res.status(200).json({
      success: true,
      message: 'Decoration removed successfully',
      data: {
        horse: { id: updatedHorse.id, name: updatedHorse.name, tack: updatedHorse.tack },
        removedItemId: itemId,
      },
    });
  } catch (error) {
    logger.error(`[tackShopController] unequipDecoration error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to unequip decoration', data: null });
  }
}
