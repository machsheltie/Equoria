/**
 * Inventory Equip/Unequip E2E Smoke Test
 *
 * Verifies the /inventory equip and unequip write flows work end-to-end with
 * production parity (no bypass headers, real API calls).
 *
 * Flow:
 *   1. Register a new player and complete onboarding (provides a starter horse)
 *   2. Purchase a tack item via GET /api/v1/tack-shop/inventory + POST /api/v1/tack-shop/purchase
 *   3. GET /api/v1/inventory to confirm the item is in inventory (unequipped)
 *   4. POST /api/v1/inventory/equip — equip item to the starter horse
 *   5. GET /api/v1/inventory to assert equippedToHorseId is set
 *   6. POST /api/v1/inventory/unequip — remove item from the horse
 *   7. GET /api/v1/inventory to assert equippedToHorseId is null
 *
 * Issue: Equoria-lqpb
 */

import { test, expect } from '@playwright/test';
// @ts-expect-error — JS module without .d.ts; import works at runtime via Node.
import prisma from '../../../packages/database/prismaClient.mjs';
import {
  csrfRequest,
  expectOk,
  installProductionParityNetworkGuard,
  registerAndCompleteOnboarding,
  unwrapData,
} from './support/prodParity';

test.afterAll(async () => {
  try {
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'InvEquip Horse' } },
    });
  } finally {
    await prisma.$disconnect();
  }
});

test('inventory equip and unequip flow uses real API with no bypass headers', async ({ page }) => {
  const guard = installProductionParityNetworkGuard(page);
  const suffix = `${Date.now()}_inv`;

  // Step 1: Register fresh player — provides a starter mare (the onboarding horse)
  const player = await registerAndCompleteOnboarding(page, suffix, `InvEquip Horse ${suffix}`);
  const starterHorseId = Number(player.horse.id);
  expect(starterHorseId).toBeGreaterThan(0);

  // Step 2: Buy a tack item via the tack-shop so the player has something to equip
  const tackCatalogJson = await expectOk(
    await page.request.get('/api/v1/tack-shop/inventory'),
    'GET /api/v1/tack-shop/inventory'
  );
  const tackCatalog = unwrapData<{ items: Array<{ id: string; cost: number; name: string }> }>(
    tackCatalogJson
  );
  expect(tackCatalog.items.length, 'Tack shop must have at least one item').toBeGreaterThan(0);

  // Pick the cheapest tack item to minimise cost impact on real game state
  const cheapestTack = tackCatalog.items.reduce((cheapest, item) =>
    item.cost < cheapest.cost ? item : cheapest
  );

  await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/tack-shop/purchase', {
      horseId: starterHorseId,
      itemId: cheapestTack.id,
    }),
    'POST /api/v1/tack-shop/purchase'
  );

  // Step 3: GET /api/v1/inventory — confirm the item landed in inventory
  const afterPurchaseJson = await expectOk(
    await page.request.get('/api/v1/inventory'),
    'GET /api/v1/inventory (after purchase)'
  );
  const afterPurchase = unwrapData<{
    items: Array<{
      id: string;
      itemId: string;
      name: string;
      category: string;
      equippedToHorseId: number | null;
    }>;
    total: number;
  }>(afterPurchaseJson);

  // The purchased item may already be "equipped" because the tack-shop purchase
  // writes directly to Horse.tack and the inventory derive-from-tack path seeds it
  // as equipped. If so, we first unequip it, then re-equip it to fully exercise both flows.
  const ownedItem = afterPurchase.items.find((i) => i.itemId === cheapestTack.id);
  expect(ownedItem, `Purchased item "${cheapestTack.id}" must appear in inventory`).toBeTruthy();
  const inventoryItemId = ownedItem!.id;

  // If the item is already equipped (derive-from-tack seeded it that way), unequip first
  // so we can exercise the equip flow from a clean unequipped state.
  if (ownedItem!.equippedToHorseId !== null) {
    await expectOk(
      await csrfRequest(page, 'POST', '/api/v1/inventory/unequip', { inventoryItemId }),
      'POST /api/v1/inventory/unequip (pre-test reset)'
    );
  }

  // Confirm item is now unequipped before we test the equip path
  const beforeEquipJson = await expectOk(
    await page.request.get('/api/v1/inventory'),
    'GET /api/v1/inventory (before equip)'
  );
  const beforeEquip = unwrapData<{
    items: Array<{ id: string; equippedToHorseId: number | null }>;
  }>(beforeEquipJson);
  const beforeItem = beforeEquip.items.find((i) => i.id === inventoryItemId);
  expect(beforeItem!.equippedToHorseId).toBeNull();

  // Step 4: POST /api/v1/inventory/equip
  const equipJson = await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/inventory/equip', {
      inventoryItemId,
      horseId: starterHorseId,
    }),
    'POST /api/v1/inventory/equip'
  );
  const equipResult = unwrapData<{
    items: Array<{ id: string; equippedToHorseId: number | null }>;
    equippedItem: { id: string; equippedToHorseId: number | null };
  }>(equipJson);
  expect(
    equipResult.equippedItem.equippedToHorseId,
    'equippedItem.equippedToHorseId must be set to the target horse after equip'
  ).toBe(starterHorseId);

  // Step 5: GET /api/v1/inventory — assert item is recorded as equipped
  const afterEquipJson = await expectOk(
    await page.request.get('/api/v1/inventory'),
    'GET /api/v1/inventory (after equip)'
  );
  const afterEquip = unwrapData<{
    items: Array<{ id: string; equippedToHorseId: number | null }>;
  }>(afterEquipJson);
  const equippedItem = afterEquip.items.find((i) => i.id === inventoryItemId);
  expect(
    equippedItem!.equippedToHorseId,
    'inventory record must show item as equipped to the horse'
  ).toBe(starterHorseId);

  // Step 6: POST /api/v1/inventory/unequip
  const unequipJson = await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/inventory/unequip', { inventoryItemId }),
    'POST /api/v1/inventory/unequip'
  );
  const unequipResult = unwrapData<{
    items: Array<{ id: string; equippedToHorseId: number | null }>;
    unequippedItem: { id: string; equippedToHorseId: number | null };
  }>(unequipJson);
  expect(
    unequipResult.unequippedItem.equippedToHorseId,
    'unequippedItem.equippedToHorseId must be null after unequip'
  ).toBeNull();

  // Step 7: GET /api/v1/inventory — assert item returned to unequipped state
  const afterUnequipJson = await expectOk(
    await page.request.get('/api/v1/inventory'),
    'GET /api/v1/inventory (after unequip)'
  );
  const afterUnequip = unwrapData<{
    items: Array<{ id: string; equippedToHorseId: number | null }>;
  }>(afterUnequipJson);
  const returnedItem = afterUnequip.items.find((i) => i.id === inventoryItemId);
  expect(
    returnedItem!.equippedToHorseId,
    'inventory record must show item as unequipped (null) after unequip'
  ).toBeNull();

  guard.assertClean();
});
