/**
 * Tack Shop Controller
 * Handles tack shop: listing inventory, purchasing items, condition tracking, and repairs.
 *
 * Uses existing Horse.tack (Json) field — no schema changes required.
 *
 * Routes:
 *   GET  /api/tack-shop/inventory   → list available tack items
 *   POST /api/tack-shop/purchase    → purchase an item for a horse
 *   POST /api/tack-shop/repair      → repair a tack item (restore condition to 100)
 *
 * Condition system:
 *   - Stored as <category>_condition in Horse.tack JSON (e.g. saddle_condition: 95)
 *   - Default/initial condition: 100
 *   - Degrades per competition: basic -5, quality -3, premium -2
 *   - Bonus halved when condition < 50; no bonus when condition = 0
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

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
};

// ── Bonus resolution ────────────────────────────────────────────────────────

/**
 * Apply condition penalty to a raw bonus value.
 * - condition >= 50: full bonus
 * - condition < 50: halved bonus
 * - condition == 0: no bonus
 *
 * @param {number} rawBonus - The item's base numeric bonus
 * @param {number} condition - Item condition (0–100), defaults to 100
 * @returns {number} Adjusted bonus
 */
function applyConditionPenalty(rawBonus, condition) {
  const cond = typeof condition === 'number' ? condition : 100;
  if (cond <= 0) return 0;
  if (cond < 50) return Math.floor(rawBonus / 2);
  return rawBonus;
}

/**
 * Resolve tack bonuses from a Horse.tack JSON object.
 * Applies condition penalties: bonus halved below 50%, zeroed at 0%.
 *
 * @param {Object} tack - Horse.tack JSON object
 * @returns {{ saddleBonus: number, bridleBonus: number }}
 */
export function resolveTackBonus(tack) {
  if (!tack || typeof tack !== 'object') {
    return { saddleBonus: 0, bridleBonus: 0 };
  }

  // If numeric fields already exist (test data / legacy), apply condition and return
  const hasDirect = typeof tack.saddleBonus === 'number' || typeof tack.bridleBonus === 'number';
  if (hasDirect) {
    return {
      saddleBonus: applyConditionPenalty(tack.saddleBonus || 0, tack.saddle_condition),
      bridleBonus: applyConditionPenalty(tack.bridleBonus || 0, tack.bridle_condition),
    };
  }

  // Look up item IDs in the catalog and apply condition penalties
  let saddleBonus = 0;
  let bridleBonus = 0;

  if (tack.saddle) {
    const saddleItem = TACK_INVENTORY.find(i => i.id === tack.saddle && i.category === 'saddle');
    if (saddleItem) {
      saddleBonus = applyConditionPenalty(saddleItem.numericBonus, tack.saddle_condition);
    }
  }

  if (tack.bridle) {
    const bridleItem = TACK_INVENTORY.find(i => i.id === tack.bridle && i.category === 'bridle');
    if (bridleItem) {
      bridleBonus = applyConditionPenalty(bridleItem.numericBonus, tack.bridle_condition);
    }
  }

  return { saddleBonus, bridleBonus };
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
    const updatedTack = { ...currentTack, [item.category]: item.id };

    // Store initial condition = 100 for the newly purchased item
    updatedTack[`${item.category}_condition`] = 100;

    // Also store numeric bonus fields for scoring compatibility
    if (item.category === 'saddle') {
      updatedTack.saddleBonus = item.numericBonus;
    } else if (item.category === 'bridle') {
      updatedTack.bridleBonus = item.numericBonus;
    }

    const [updatedHorse] = await prisma.$transaction([
      prisma.horse.update({ where: { id: horseId }, data: { tack: updatedTack } }),
      prisma.user.update({ where: { id: userId }, data: { money: { decrement: item.cost } } }),
    ]);

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
        remainingMoney: user.money - item.cost,
      },
    });
  } catch (error) {
    logger.error(`[tackShopController] purchaseTackItem error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to purchase tack item', data: null });
  }
}

// ── Condition degradation rates per tier ────────────────────────────────────

const DEGRADE_BY_TIER = {
  basic: 5,
  quality: 3,
  premium: 2,
};

// ── Repair costs per tier ────────────────────────────────────────────────────

const REPAIR_COST_BY_TIER = {
  basic: 50,
  quality: 150,
  premium: 300,
};

// ── Categories that degrade during competition ───────────────────────────────

const COMPETITION_WEAR_CATEGORIES = ['saddle', 'bridle'];

/**
 * Degrade tack condition for a horse after a competition event.
 * Only saddle and bridle categories degrade during competition.
 * Does nothing if the horse has no tack equipped in those categories.
 *
 * @param {number} horseId - ID of the horse
 * @param {string[]} usedCategories - Categories that were used (default: saddle + bridle)
 * @returns {Promise<{ horseId: number, tackWear: Array<{ category, previousCondition, newCondition, itemId }> }>}
 */
export async function degradeTackCondition(horseId, usedCategories = COMPETITION_WEAR_CATEGORIES) {
  try {
    const horse = await prisma.horse.findUnique({ where: { id: horseId }, select: { tack: true } });
    if (!horse || !horse.tack || typeof horse.tack !== 'object') {
      return { horseId, tackWear: [] };
    }

    const currentTack = horse.tack;
    const updatedTack = { ...currentTack };
    const tackWear = [];

    for (const category of usedCategories) {
      const itemId = currentTack[category];
      if (!itemId) continue; // no item equipped in this category

      const item = TACK_INVENTORY.find(i => i.id === itemId && i.category === category);
      if (!item) continue;

      const conditionKey = `${category}_condition`;
      const previousCondition =
        typeof currentTack[conditionKey] === 'number' ? currentTack[conditionKey] : 100;

      const degradeAmount = DEGRADE_BY_TIER[item.tier] ?? 3;
      const newCondition = Math.max(0, previousCondition - degradeAmount);

      updatedTack[conditionKey] = newCondition;
      tackWear.push({ category, itemId, previousCondition, newCondition, degradeAmount });
    }

    if (tackWear.length > 0) {
      await prisma.horse.update({ where: { id: horseId }, data: { tack: updatedTack } });
      logger.info(
        `[tackShopController] Degraded tack for horse ${horseId}: ${tackWear.map(w => `${w.category} ${w.previousCondition}→${w.newCondition}`).join(', ')}`,
      );
    }

    return { horseId, tackWear };
  } catch (error) {
    logger.error(
      `[tackShopController] degradeTackCondition error for horse ${horseId}: ${error.message}`,
    );
    return { horseId, tackWear: [] };
  }
}

/**
 * POST /api/tack-shop/repair
 * Body: { horseId, category }
 *
 * Restores condition for the equipped item in the given category to 100%.
 * Charges coins proportional to item tier.
 */
export async function repairTackItem(req, res) {
  try {
    const userId = req.user.id;
    const { horseId, category } = req.body;

    const horse = await prisma.horse.findFirst({ where: { id: horseId, userId } });
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found', data: null });
    }

    const tack = typeof horse.tack === 'object' && horse.tack !== null ? horse.tack : {};
    const itemId = tack[category];
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: `No ${category} equipped on this horse`,
        data: null,
      });
    }

    const item = TACK_INVENTORY.find(i => i.id === itemId && i.category === category);
    if (!item) {
      return res.status(400).json({
        success: false,
        message: 'Equipped item not found in catalog',
        data: null,
      });
    }

    const conditionKey = `${category}_condition`;
    const currentCondition = typeof tack[conditionKey] === 'number' ? tack[conditionKey] : 100;

    if (currentCondition >= 100) {
      return res.status(400).json({
        success: false,
        message: `${item.name} is already in perfect condition`,
        data: { currentCondition },
      });
    }

    const repairCost = REPAIR_COST_BY_TIER[item.tier] ?? 150;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    if (user.money < repairCost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. Repair costs $${repairCost}`,
        data: { required: repairCost, available: user.money },
      });
    }

    const updatedTack = { ...tack, [conditionKey]: 100 };

    const [updatedHorse] = await prisma.$transaction([
      prisma.horse.update({ where: { id: horseId }, data: { tack: updatedTack } }),
      prisma.user.update({ where: { id: userId }, data: { money: { decrement: repairCost } } }),
    ]);

    logger.info(
      `[tackShopController] User ${userId} repaired "${item.name}" (${category}) on horse ${horseId} — cost $${repairCost}`,
    );

    res.status(200).json({
      success: true,
      message: `${item.name} repaired successfully`,
      data: {
        horse: {
          id: updatedHorse.id,
          name: updatedHorse.name,
          tack: updatedHorse.tack,
        },
        item,
        category,
        repairCost,
        previousCondition: currentCondition,
        newCondition: 100,
        remainingMoney: user.money - repairCost,
      },
    });
  } catch (error) {
    logger.error(`[tackShopController] repairTackItem error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to repair tack item', data: null });
  }
}
