/**
 * Shared auth-module constants.
 *
 * Extracted from authController.mjs (Equoria-vhv3i) so that:
 *   - settingsValidation.mjs (users/services) does NOT have to import from a
 *     controller, breaking a cross-module-boundary smell.
 *   - The backfill script can import data without dragging the controller's
 *     prisma / bcrypt / jwt / mfa deps into a one-shot migration.
 *
 * Test-locking contracts (do NOT silently change values without owners):
 *   - STARTER_KIT_INVENTORY: backend/modules/auth/__tests__/starterKitInventory.test.mjs
 *     (Equoria-oroi).
 *   - STARTER_CRAFTING_MATERIALS: backend/modules/auth/__tests__/buildStarterSettings.test.mjs
 *     and backfillCraftingMaterials.integration.test.mjs (Equoria-aazk).
 *   - ALLOWED_PREFERENCE_KEYS: backend/modules/auth/__tests__/preferencesRoutes.integration.test.mjs
 *     and users/services/settingsValidation.mjs (cross-module consumer).
 */

/**
 * Starter kit seeded for every new user at registration (Story 15-2).
 * Any drift in itemId / name / bonus values must be intentional.
 */
export const STARTER_KIT_INVENTORY = [
  {
    id: 'starter-saddle',
    itemId: 'all-purpose-saddle',
    category: 'saddle',
    name: 'All Purpose Saddle',
    bonus: '+5 all disciplines',
    quantity: 1,
  },
  {
    id: 'starter-bridle',
    itemId: 'all-purpose-bridle',
    category: 'bridle',
    name: 'All Purpose Bridle',
    bonus: '+5 all disciplines',
    quantity: 1,
  },
];

/**
 * Starter crafting materials — enough to craft at least one Tier 0 recipe (4.3 fix).
 * Tier 0 recipes: simple-bridle (leather:1, dye:1), basic-halter (leather:1),
 *                 cloth-blanket (cloth:2, dye:2, thread:1).
 */
export const STARTER_CRAFTING_MATERIALS = Object.freeze({
  leather: 2,
  cloth: 2,
  dye: 2,
  metal: 0,
  thread: 1,
});

/**
 * One-time coin bonus added to a new account's starting money.
 */
export const STARTER_BONUS_COINS = 500;

/**
 * Whitelisted preference keys persisted under `settings.preferences`.
 *
 * Shape mirrors what `frontend/src/pages/SettingsPage.tsx` renders:
 *   - Notification toggles (email/in-app)
 *   - Display toggles (accessibility + density)
 *   - Sound
 *
 * Story 21S-5 — when adding a new preference, extend this list AND the
 * frontend types; unknown keys are rejected by the validator.
 */
export const ALLOWED_PREFERENCE_KEYS = [
  // Email notifications
  'emailCompetition',
  'emailBreeding',
  'emailSystem',
  // In-app notifications
  'inAppTraining',
  'inAppAchievements',
  'inAppNews',
  // Display / accessibility
  'reducedMotion',
  'highContrast',
  'compactCards',
  // Sound
  'soundEnabled',
];
