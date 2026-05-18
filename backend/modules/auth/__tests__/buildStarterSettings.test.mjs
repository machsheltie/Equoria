/**
 * buildStarterSettings.test.mjs
 *
 * Equoria-aazk — Lock the server-authoritative starter settings builder.
 *
 * Pure-module-import unit test (no DB), per CLAUDE.md guidance. The real-DB
 * registration path is covered by
 * registerCraftingStarterWithSettings.integration.test.mjs; this file locks
 * the constant + builder that path reads so a regression (e.g. reverting to
 * `settings || {default}`, or dropping craftingMaterials) fails fast.
 */

import {
  buildStarterSettings,
  STARTER_CRAFTING_MATERIALS,
  STARTER_KIT_INVENTORY,
} from '../controllers/authController.mjs';

describe('buildStarterSettings value lock (Equoria-aazk)', () => {
  test('STARTER_CRAFTING_MATERIALS affords at least one Tier 0 recipe', () => {
    // basic-halter needs leather:1; simple-bridle needs leather:1,dye:1;
    // cloth-blanket needs cloth:2,dye:2,thread:1. The starter must cover one.
    expect(STARTER_CRAFTING_MATERIALS).toEqual({
      leather: 2,
      cloth: 2,
      dye: 2,
      metal: 0,
      thread: 1,
    });
  });

  test('buildStarterSettings always returns the full server-owned starter', () => {
    const s = buildStarterSettings();
    expect(s.completedOnboarding).toBe(false);
    expect(s.inventory).toBe(STARTER_KIT_INVENTORY);
    expect(s.craftingMaterials).toEqual(STARTER_CRAFTING_MATERIALS);
  });

  test('craftingMaterials is a fresh copy, not the shared constant reference', () => {
    // Guards against one new account mutating the shared constant and
    // poisoning every subsequent registration.
    const a = buildStarterSettings();
    const b = buildStarterSettings();
    expect(a.craftingMaterials).not.toBe(STARTER_CRAFTING_MATERIALS);
    expect(a.craftingMaterials).not.toBe(b.craftingMaterials);
    a.craftingMaterials.leather = 9999;
    expect(STARTER_CRAFTING_MATERIALS.leather).toBe(2);
    expect(buildStarterSettings().craftingMaterials.leather).toBe(2);
  });

  test('buildStarterSettings takes no arguments — it cannot be influenced by client input', () => {
    expect(buildStarterSettings.length).toBe(0);
  });
});
