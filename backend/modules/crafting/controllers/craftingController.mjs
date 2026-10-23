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

import { randomUUID } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { updateUserSettingsPaths } from '../../../utils/userSettingsPaths.mjs';
import { CRAFTING_RECIPES, findRecipe } from '../data/craftingRecipes.mjs';
import {
  recordTransactionTx,
  debitMoneyOrThrow,
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
} from '../../economy/index.mjs';

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

/** The materials left after spending a recipe's cost. */
function deductMaterials(have, need) {
  const left = {};
  for (const mat of ['leather', 'cloth', 'dye', 'metal', 'thread']) {
    left[mat] = have[mat] - (need[mat] || 0);
  }
  return left;
}

/** Thrown inside the craft tx when the post-lock materials no longer cover the recipe. */
class InsufficientMaterialsError extends Error {
  constructor(deficit) {
    super(`Insufficient materials: need ${deficit}`);
    this.deficit = deficit;
  }
}

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /crafting/materials
 * Returns the player's current material stockpile and workshop tier.
 */
export async function getMaterialsEndpoint(req, res) {
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

    // Material check (coin check moved INTO the tx below via debitMoneyOrThrow
    // — Equoria-6g8wm). Materials checked here for fast 400 feedback only; the
    // authoritative check re-runs post-lock inside the tx (Equoria-cmvmy).
    const materials = getMaterials(user.settings);
    const deficit = getMaterialDeficit(materials, recipe.materials);
    if (deficit) {
      return res.status(400).json({
        success: false,
        message: `Insufficient materials: need ${deficit}`,
      });
    }

    const newItem = {
      // A real unique id: a millisecond timestamp collides for two crafts in the same
      // millisecond, and equip/unequip address records by id (Equoria-d5ncx).
      id: `crafted-${randomUUID()}-${recipe.result}`,
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

    // Equoria-6g8wm: wrap the money debit + settings update + ledger row in
    // ONE $transaction. Pre-fix the user.update was outside any tx and the
    // recordTransaction was fire-and-forget — meaning a debit failure left
    // no audit row, and an audit failure had already been swallowed before
    // the response went out. Post-fix the helper guards money atomically;
    // InsufficientFundsError on count===0 rolls back the settings update
    // and the ledger row, surfacing as a 400 with the original envelope.
    let newBalance;
    let newMaterials;
    try {
      newBalance = await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          // Equoria-kl16c: paired SystemAccount burn credit (money conservation).
          const moneyAfter = await debitMoneyOrThrow(tx, {
            userId,
            amount: recipe.cost,
            systemAccount: SYSTEM_ACCOUNT_BURN,
            category: 'craftingFeeBurn',
            description: `Crafting fee — ${recipe.resultName}`,
            metadata: { recipeId, result: recipe.result },
          });
          // Equoria-cmvmy: the materials + inventory read-modify-write runs on a
          // read taken AFTER the debit, whose User row lock serialises every
          // settings writer — a concurrent craft that already spent the
          // materials is seen here and rejected as a 400, never a second item.
          const fresh = await tx.user.findUnique({
            where: { id: userId },
            select: { settings: true },
          });
          const freshMaterials = getMaterials(fresh?.settings);
          const freshDeficit = getMaterialDeficit(freshMaterials, recipe.materials);
          if (freshDeficit) {
            throw new InsufficientMaterialsError(freshDeficit);
          }
          newMaterials = deductMaterials(freshMaterials, recipe.materials);
          const existingInventory = getInventory(fresh?.settings);
          // Finding 1 (Equoria-6p398.1): only the two keys this craft owns are
          // written, by path, so a concurrent bank claim's `lastWeeklyClaimDate`
          // survives. The inventory compare-and-swap stays as a second guard.
          const affectedSettings = await updateUserSettingsPaths(tx, userId, {
            set: { craftingMaterials: newMaterials, inventory: [...existingInventory, newItem] },
            expect: { inventory: { equals: existingInventory, whenMissing: [] } },
          });
          if (affectedSettings !== 1) {
            const conflict = new Error(
              'Your inventory changed while this craft was in flight. Please retry.',
            );
            conflict.status = 409;
            throw conflict;
          }
          // Equoria-4539b: tx-first ledger writer (Equoria-pqp69). Drops the
          // caller-supplied balanceAfter — recordTransactionTx reads the
          // authoritative balance from the same tx so the audit row cannot drift
          // from the actual post-debit value.
          await recordTransactionTx(tx, {
            userId,
            type: 'debit',
            amount: recipe.cost,
            category: 'crafting',
            description: `Crafted ${recipe.resultName}`,
            metadata: { recipeId, result: recipe.result },
          });
          return moneyAfter;
        }),
        { message: 'The workshop is busy right now, please retry in a moment.' },
      );
    } catch (txErr) {
      if (txErr instanceof InsufficientMaterialsError) {
        return res.status(400).json({
          success: false,
          message: `Insufficient materials: need ${txErr.deficit}`,
        });
      }
      if (txErr?.status === 409) {
        return res.status(409).json({ success: false, message: txErr.message });
      }
      if (txErr instanceof InsufficientFundsError) {
        return res.status(400).json({
          success: false,
          message: `Insufficient coins (need ${recipe.cost})`,
        });
      }
      throw txErr;
    }

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
        newBalance,
      },
    });
  } catch (err) {
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (err?.status === 503) {
      return res.status(503).json({ success: false, message: err.message });
    }
    logger.error(`[craftingController] craftItem error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
