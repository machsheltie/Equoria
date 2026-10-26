/**
 * Test helpers for tack bought in the shop (owner ruling 2026-10-26, q78,
 * Equoria-dslww).
 *
 * The Tack Shop no longer involves a horse: buying puts the item in the player's
 * inventory and equipping is a separate inventory action. `buyAndEquip` is that
 * real two-step flow through the real endpoints.
 *
 * `seedLegacyShopTack` writes the state every horse bought BEFORE that ruling
 * is in: the item on `Horse.tack` with NO inventory record. Sales and slot
 * replacements still have to reconcile that state for existing players, so the
 * tests that prove it set it up directly. It is the only way to reach it now.
 */

import prisma from '../../../packages/database/prismaClient.mjs';

/**
 * Buy `itemId` into the inventory, then equip the new record to `horseId`.
 *
 * @param {(path: string, token: string, body?: object) => Promise<import('supertest').Response>} post
 *   the file's own authenticated POST helper
 * @returns the equip response, or the purchase response when the purchase failed
 */
export async function buyAndEquip(post, token, horseId, itemId) {
  const bought = await post('/api/v1/tack-shop/purchase', token, { itemId });
  if (bought.status !== 200) {
    return bought;
  }
  return post('/api/v1/inventory/equip', token, {
    inventoryItemId: bought.body.data.inventoryItem.id,
    horseId,
  });
}

/**
 * Put a catalogue item on a horse the way the retired buy-for-a-horse purchase
 * did: slot items replace their slot, decorations append; no inventory record.
 */
export async function seedLegacyShopTack(horseId, item) {
  const row = await prisma.horse.findUnique({ where: { id: horseId }, select: { tack: true } });
  const tack =
    row?.tack && typeof row.tack === 'object' && !Array.isArray(row.tack) ? { ...row.tack } : {};
  if (item.category === 'decorative') {
    const existing = Array.isArray(tack.decorations) ? tack.decorations : [];
    tack.decorations = existing.includes(item.id) ? existing : [...existing, item.id];
  } else {
    tack[item.category] = item.id;
  }
  await prisma.horse.update({ where: { id: horseId }, data: { tack } });
}
