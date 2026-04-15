/**
 * Crafting Controller
 * Leathersmith Workshop crafting system — materials, recipes, and item crafting.
 *
 * Data model (no schema migration required):
 *   User.settings.craftingMaterials: { leather, cloth, dye, metal, thread }
 *   User.settings.workshopTier: integer 0-3 (0 = no workshop, default)
 *   User.settings.inventory: Array of owned items (crafted items gain origin: 'crafted')
 *
 * Routes:
 *   GET  /api/v1/crafting/materials  → player's current material stockpile
 *   GET  /api/v1/crafting/recipes    → all recipes with availability status
 *   POST /api/v1/crafting/craft      → craft an item from a recipe
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { CRAFTING_RECIPES, findRecipe } from '../data/craftingRecipes.mjs';
import { recordTransaction } from '../../../services/financialLedgerService.mjs';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the crafting materials object from User.settings, defaulting all fields to 0.
 * @param {object|null} settings
 * @returns {{ leather: number, cloth: number, dye: number, metal: number, thread: number }}
 */
function getMaterials(settings) {
  const defaults = { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 };
  if (!settings || typeof settings !== 'object') {
    return defaults;
  }
  const m = settings.craftingMaterials;
  if (!m || typeof m !== 'object') {
    return defaults;
  }
  return {
    leather: Number(m.leather) || 0,
    cloth: Number(m.cloth) || 0,
    dye: Number(m.dye) || 0,
    metal: Number(m.metal) || 0,
    thread: Number(m.thread) || 0,
  };
}

/**
 * Returns the workshop tier from User.settings (integer 0-3).
 * @param {object|null} settings
 * @returns {number}
 */
function getWorkshopTier(settings) {
  if (!settings || typeof settings !== 'object') {
    return 0;
  }
  const tier = settings.workshopTier;
  const parsed = parseInt(tier, 10);
  if (isNaN(parsed) || parsed < 0) {
    return 0;
  }
  if (parsed > 3) {
    return 3;
  }
  return parsed;
}

/**
 * Returns the inventory array from User.settings, defaulting to [].
 * @param {object|null} settings
 * @returns {Array}
 */
function getInventory(settings) {
  if (!settings || typeof settings !== 'object') {
    return [];
  }
  const inv = settings.inventory;
  return Array.isArray(inv) ? inv : [];
}

/**
 * Checks if the player has enough materials for a recipe.
 * Returns null if sufficient, or a human-readable deficit string if not.
 * @param {{ leather, cloth, dye, metal, thread }} have
 * @param {{ leather, cloth, dye, metal, thread }} need
 * @returns {string|null}
 */
function getMaterialDeficit(have, need) {
  const deficits = [];
  for (const mat of ['leather', 'cloth', 'dye', 'metal', 'thread']) {
    const gap = (need[mat] || 0) - (have[mat] || 0);
    if (gap > 0) {
      deficits.push(`${gap} ${mat}`);
    }
  }
  return deficits.length > 0 ? deficits.join(', ') : null;
}

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /crafting/materials
 * Returns the player's current material stockpile and workshop tier.
 */
export async function getMaterials_endpoint(req, res) {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const materials = getMaterials(user.settings);
    const workshopTier = getWorkshopTier(user.settings);

    logger.info(`[craftingController] getMaterials for user ${userId}`);
    return res.json({
      success: true,
      data: { materials, workshopTier },
    });
  } catch (err) {
    logger.error(`[craftingController] getMaterials error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * GET /crafting/recipes
 * Returns all crafting recipes enriched with locked/unlocked status based on player's workshop tier.
 */
export async function getRecipes(req, res) {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const workshopTier = getWorkshopTier(user.settings);
    const materials = getMaterials(user.settings);

    const recipes = CRAFTING_RECIPES.map(recipe => {
      const locked = recipe.tier > workshopTier;
      const deficit = getMaterialDeficit(materials, recipe.materials);
      return {
        ...recipe,
        locked,
        affordable: !locked && deficit === null,
        deficit: deficit ?? undefined,
        lockReason: locked ? `Requires Leathersmith Workshop Tier ${recipe.tier}` : undefined,
      };
    });

    logger.info(
      `[craftingController] getRecipes for user ${userId} (workshopTier ${workshopTier})`,
    );
    return res.json({ success: true, data: { workshopTier, recipes } });
  } catch (err) {
    logger.error(`[craftingController] getRecipes error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * POST /crafting/craft
 * Body: { recipeId: string }
 * Validates materials + coins + workshop tier, deducts resources, adds crafted item to inventory.
 */
export async function craftItem(req, res) {
  try {
    const userId = req.user.id;
    const { recipeId } = req.body;

    const recipe = findRecipe(recipeId);
    if (!recipe) {
      return res.status(404).json({ success: false, message: 'Recipe not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, money: true, settings: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const workshopTier = getWorkshopTier(user.settings);

    // Tier check
    if (recipe.tier > workshopTier) {
      return res.status(403).json({
        success: false,
        message: `Leathersmith Workshop upgrade required (need Tier ${recipe.tier}, have Tier ${workshopTier})`,
      });
    }

    // Coin check
    if (user.money < recipe.cost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient coins (need ${recipe.cost}, have ${user.money})`,
      });
    }

    // Material check
    const materials = getMaterials(user.settings);
    const deficit = getMaterialDeficit(materials, recipe.materials);
    if (deficit) {
      return res.status(400).json({
        success: false,
        message: `Insufficient materials: need ${deficit}`,
      });
    }

    // Deduct materials and coins, add crafted item to inventory
    const newMaterials = {
      leather: materials.leather - (recipe.materials.leather || 0),
      cloth: materials.cloth - (recipe.materials.cloth || 0),
      dye: materials.dye - (recipe.materials.dye || 0),
      metal: materials.metal - (recipe.materials.metal || 0),
      thread: materials.thread - (recipe.materials.thread || 0),
    };

    const existingSettings =
      user.settings && typeof user.settings === 'object' ? user.settings : {};
    const existingInventory = getInventory(user.settings);

    const newItem = {
      id: `crafted-${Date.now()}-${recipe.result}`,
      itemId: recipe.result,
      category: recipe.resultCategory,
      name: recipe.resultName,
      bonus: recipe.bonus,
      numericBonus: recipe.numericBonus,
      isCosmetic: recipe.isCosmetic,
      quantity: 1,
      origin: 'crafted',
      craftedAt: new Date().toISOString(),
      equippedToHorseId: null,
      equippedToHorseName: null,
    };

    const updatedSettings = {
      ...existingSettings,
      craftingMaterials: newMaterials,
      inventory: [...existingInventory, newItem],
    };

    const updatedUser = await prisma.$transaction(async tx => {
      const userUpdate = await tx.user.update({
        where: { id: userId },
        data: {
          money: { decrement: recipe.cost },
          settings: updatedSettings,
        },
        select: { money: true },
      });
      await recordTransaction(
        {
          userId,
          type: 'debit',
          amount: recipe.cost,
          category: 'crafting',
          description: `Crafted ${recipe.resultName}`,
          balanceAfter: userUpdate.money,
          metadata: { recipeId, result: recipe.result },
        },
        tx,
      );
      return userUpdate;
    });

    logger.info(
      `[craftingController] craftItem: user ${userId} crafted ${recipe.resultName} (recipe: ${recipeId})`,
    );

    return res.json({
      success: true,
      message: `You crafted ${recipe.resultName}!`,
      data: {
        item: newItem,
        remainingMaterials: newMaterials,
        coinsSpent: recipe.cost,
        newBalance: updatedUser.money,
      },
    });
  } catch (err) {
    logger.error(`[craftingController] craftItem error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
