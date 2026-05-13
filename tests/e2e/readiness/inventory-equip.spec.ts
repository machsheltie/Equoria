/**
 * Inventory Equip/Unequip E2E Smoke Test
 *
 * Verifies the /inventory equip and unequip write flows work end-to-end with
 * production parity (no bypass headers, real API calls).
 *
 * Flow:
 *   1. Register a new player and complete onboarding (provides a starter horse)
 *      — registration pre-seeds user inventory with starter-saddle + starter-bridle
 *   2. GET /api/v1/inventory to find a starter-kit item (already unequipped)
 *   3. POST /api/v1/inventory/equip — equip item to the starter horse
 *   4. GET /api/v1/inventory to assert equippedToHorseId is set
 *   5. POST /api/v1/inventory/unequip — remove item from the horse
 *   6. GET /api/v1/inventory to assert equippedToHorseId is null
 *
 * Note: The tack-shop purchase endpoint writes to Horse.tack only — not to
 * User.settings.inventory — so purchased items do not appear in GET /api/v1/inventory
 * when the user already has an inventory (which all users do via the starter kit).
 * The equip/unequip flow is exercised with starter-kit items already in inventory.
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

  // Step 1: Register fresh player — provides a starter mare (the onboarding horse).
  // Registration also pre-seeds the user's inventory with starter-saddle and starter-bridle.
  const player = await registerAndCompleteOnboarding(page, suffix, `InvEquip Horse ${suffix}`);
  const starterHorseId = Number(player.horse.id);
  expect(starterHorseId).toBeGreaterThan(0);

  // Step 2: GET /api/v1/inventory — confirm the starter kit items are present.
  // Every registered user receives starter-saddle (all-purpose-saddle) and
  // starter-bridle (all-purpose-bridle) in their inventory at registration time.
  // We also verify the tack-shop catalog is reachable (read-path smoke test).
  await expectOk(
    await page.request.get('/api/v1/tack-shop/inventory'),
    'GET /api/v1/tack-shop/inventory'
  );

  const initialInventoryJson = await expectOk(
    await page.request.get('/api/v1/inventory'),
    'GET /api/v1/inventory (initial)'
  );
  const initialInventory = unwrapData<{
    items: Array<{
      id: string;
      itemId: string;
      name: string;
      category: string;
      equippedToHorseId: number | null;
    }>;
    total: number;
  }>(initialInventoryJson);

  expect(
    initialInventory.items.length,
    'Starter kit must seed at least one item into inventory'
  ).toBeGreaterThan(0);

  // Find any unequipped inventory item to use for the equip/unequip flow.
  // Starter-kit items (starter-saddle, starter-bridle) arrive unequipped.
  // Note: starter-kit items may have equippedToHorseId as undefined (field absent) or null —
  // treat both as "unequipped". Use falsy check, not strict === null.
  const ownedItem =
    initialInventory.items.find((i) => !i.equippedToHorseId) ?? initialInventory.items[0];
  expect(ownedItem, 'At least one item must be in inventory').toBeTruthy();
  const inventoryItemId = ownedItem.id;

  // If the item happens to be equipped already (e.g. test-DB state drift), unequip it first
  // so we can exercise the equip flow from a clean unequipped state.
  // Use truthy check — equippedToHorseId may be undefined (field absent) for starter-kit items.
  if (ownedItem.equippedToHorseId) {
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
  // equippedToHorseId may be null or undefined for unequipped starter-kit items — both are falsy
  expect(beforeItem!.equippedToHorseId ?? null).toBeNull();

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
