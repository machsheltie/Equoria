---
title: 'All Purpose Saddle & Bridle — rename, +5 bonus, saddle image, inventory quantity display'
type: 'feature'
created: '2026-05-07'
status: 'in-review'
baseline_commit: '0104434968e2d495dccac09a69bdaefb9acff747'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The starter-kit saddle ("Training Saddle") and bridle ("Standard Bridle") have no catalog entries, so `resolveTackBonus` returns 0 for both when equipped; the saddle shows a wrench placeholder; and inventory displays category labels with a `×N` badge instead of a plain quantity.

**Approach:** Rename both to "All Purpose Saddle" / "All Purpose Bridle", add catalog entries with `numericBonus: 5`, wire `allpurposesaddle.png` for the saddle (bridle keeps Wrench — no image provided), migrate existing DB records to the new IDs, and update inventory/equip pages to show "N in inventory" subtitle with no `×N` badge.

## Boundaries & Constraints

**Always:**
- Saddle image renders at `w-20 h-20 object-contain` — transparent PNG, no background fill.
- Saddle item ID unifies to `'all-purpose-saddle'`; bridle item ID unifies to `'all-purpose-bridle'`.
- `resolveTackBonus` must return `saddleBonus = 5` and `bridleBonus = 5` for the new items (catalog lookup path, not the legacy hasDirect path).
- DB migration is a one-time Node.js script via Prisma; runs on the real production DB before the new code is deployed.
- Keep `'basic-all-purpose-saddle'` in the catalog as a no-op legacy alias (do NOT remove in this spec) so any horse whose tack.saddle still holds the old ID during migration window still resolves a bonus.

**Ask First:**
- If migration finds Horse.tack.saddleBonus or bridleBonus values other than 0, 1, or 2 for the affected IDs — HALT; those may be legitimate higher-tier values.

**Never:**
- Do not change the Dressage Saddle, Jump Saddle, Snaffle Bridle, or any other existing catalog item.
- Do not add a bridle image in this spec — the bridle Wrench placeholder stays until a future image is provided.
- Do not add TypeScript enums or lock item IDs into rigid types.
- Do not consolidate TACK_IMAGES into a shared module; keep it local to each page (existing pattern).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Inventory — 1 All Purpose Saddle unequipped | `itemId = 'all-purpose-saddle'`, `qty = 1` | `allpurposesaddle.png` at w-20 h-20 object-contain; subtitle "1 in inventory"; no `×1` badge | N/A |
| Inventory — 1 All Purpose Bridle unequipped | `itemId = 'all-purpose-bridle'`, `qty = 1` | Wrench placeholder (no image); subtitle "1 in inventory"; no `×1` badge | N/A |
| Equip page — user owns All Purpose Saddle | `item.itemId = 'all-purpose-saddle'` | Card shows saddle image; other unmapped tack keeps Wrench | N/A |
| Competition — `tack.saddle = 'all-purpose-saddle'` | `resolveTackBonus` catalog lookup | `saddleBonus = 5` | N/A |
| Competition — `tack.bridle = 'all-purpose-bridle'` | `resolveTackBonus` catalog lookup | `bridleBonus = 5` | N/A |
| Legacy hasDirect — `tack.saddleBonus = 2` pre-migration | hasDirect branch fires | Returns 2 — migration script corrects before deploy | N/A |
| Migration — Horse.tack.saddle ∈ `{'training-saddle','basic-all-purpose-saddle'}` | Script runs | `tack.saddle → 'all-purpose-saddle'`, `tack.saddleBonus → 5` | Abort + log if unexpected bonus value |
| Migration — Horse.tack.bridle = `'standard-bridle'` | Script runs | `tack.bridle → 'all-purpose-bridle'`, `tack.bridleBonus → 5` | Abort + log if unexpected bonus value |
| Migration — User.settings.inventory saddle item | Script runs | `itemId → 'all-purpose-saddle'`, `name → 'All Purpose Saddle'`, `bonus → '+5 all disciplines'` | N/A |
| Migration — User.settings.inventory bridle item | Script runs | `itemId → 'all-purpose-bridle'`, `name → 'All Purpose Bridle'`, `bonus → '+5 all disciplines'` | N/A |

</frozen-after-approval>

## Code Map

- `backend/modules/auth/controllers/authController.mjs:25-42` — STARTER_KIT_INVENTORY; saddle + bridle entries need itemId, name, bonus updated
- `backend/modules/services/controllers/tackShopController.mjs:51-61` — `'basic-all-purpose-saddle'` catalog entry; rename + numericBonus + image
- `backend/modules/services/controllers/tackShopController.mjs:99-121` — bridle section; add new `'all-purpose-bridle'` entry
- `backend/modules/services/controllers/tackShopController.mjs:460-506` — `resolveTackBonus`; driven by catalog — no logic change needed once catalog is correct
- `frontend/src/pages/InventoryPage.tsx:48-128` — TACK_IMAGES map + InventoryCard subtitle/meta
- `frontend/src/pages/horses/HorseEquipPage.tsx:178-182` — hardcoded Wrench; replace with TACK_IMAGES conditional render
- `frontend/public/images/tack/allpurposesaddle.png` — already present untracked; stage in git add

## Tasks & Acceptance

**Execution:**
- [x] `backend/modules/services/controllers/tackShopController.mjs` -- (a) Update `'basic-all-purpose-saddle'` entry: `id → 'all-purpose-saddle'`, `name → 'All Purpose Saddle'`, `numericBonus → 5`, `bonus → '+5 all disciplines'`, add `image: '/images/tack/allpurposesaddle.png'`. (b) Add new `'all-purpose-bridle'` entry in the bridles section: `id: 'all-purpose-bridle'`, `category: 'bridle'`, `name: 'All Purpose Bridle'`, `description: 'Versatile bridle suitable for general training and competition across disciplines.'`, `cost: 300`, `bonus: '+5 all disciplines'`, `numericBonus: 5`, `tier: 'basic'`, `disciplines: ['Dressage','Show Jumping','Cross-Country','Eventing','Hunter','Western Pleasure','Endurance']` -- fixes competition bonus lookups for both starter items
- [x] `backend/modules/auth/controllers/authController.mjs` -- Saddle entry: `itemId → 'all-purpose-saddle'`, `name → 'All Purpose Saddle'`, `bonus → '+5 all disciplines'`. Bridle entry: `itemId → 'all-purpose-bridle'`, `name → 'All Purpose Bridle'`, `bonus → '+5 all disciplines'` -- new users get correctly named and bonused starter items
- [x] `backend/scripts/migrate-all-purpose-tack.mjs` -- New one-time script: (1) Update Horse records where `tack.saddle ∈ {'training-saddle','basic-all-purpose-saddle'}` → set saddle `'all-purpose-saddle'` + `saddleBonus: 5`; where `tack.bridle = 'standard-bridle'` → set bridle `'all-purpose-bridle'` + `bridleBonus: 5`. (2) Update User.settings.inventory items matching old saddle/bridle itemIds. Log counts; abort with message if unexpected bonus value detected -- aligns production records with new catalog IDs before deploy
- [x] `frontend/src/pages/InventoryPage.tsx` -- Add `'all-purpose-saddle': '/images/tack/allpurposesaddle.png'` to TACK_IMAGES. Change tack subtitle from `<span className="capitalize">{item.category}</span>` to `"{item.quantity} in inventory"`. Remove the `×{item.quantity}` badge from tack meta (set tack meta to `undefined`) -- quantity now in subtitle; no redundant badge
- [x] `frontend/src/pages/horses/HorseEquipPage.tsx` -- Add `const TACK_IMAGES` with entries for `'dressage-saddle'`, `'dressage-bridle'`, `'all-purpose-saddle'`. Replace the hardcoded Wrench block with a conditional: if `TACK_IMAGES[item.itemId]` render `<img src={...} alt={item.name} loading="lazy" className="w-20 h-20 object-contain" />` else render the existing Wrench `<div>` -- saddle image appears on equip page; other items gracefully fall back

**Acceptance Criteria:**
- Given `TACK_INVENTORY`, when looking up `id = 'all-purpose-saddle'`, then `numericBonus = 5` and `image = '/images/tack/allpurposesaddle.png'`
- Given `TACK_INVENTORY`, when looking up `id = 'all-purpose-bridle'`, then `numericBonus = 5`
- Given a new user registration, when starter kit is seeded, then saddle has `itemId = 'all-purpose-saddle'` / `name = 'All Purpose Saddle'` and bridle has `itemId = 'all-purpose-bridle'` / `name = 'All Purpose Bridle'`
- Given a horse with `tack = { saddle: 'all-purpose-saddle', bridle: 'all-purpose-bridle' }` (no numeric fields), when `resolveTackBonus` is called, then `saddleBonus = 5` and `bridleBonus = 5`
- Given inventory page, when user has All Purpose Saddle qty 1, then card image is `allpurposesaddle.png` at `w-20 h-20 object-contain`, subtitle "1 in inventory", no `×1` badge
- Given inventory page, when user has All Purpose Bridle qty 1, then subtitle "1 in inventory", no `×1` badge (Wrench placeholder shown)
- Given equip page, when user owns All Purpose Saddle, then card shows `allpurposesaddle.png`; all other tack without an image entry still shows Wrench
- Given migration script runs, when Horse has old saddle/bridle IDs, then after migration `tack.saddle = 'all-purpose-saddle'`, `tack.saddleBonus = 5`, `tack.bridle = 'all-purpose-bridle'`, `tack.bridleBonus = 5`

## Design Notes

**Inventory subtitle (matching feed pattern):**
```tsx
// tack items: was <span className="capitalize">{item.category}</span>
const subtitle = isFeed ? `${item.quantity} units in stock` : `${item.quantity} in inventory`;
```

**HorseEquipPage conditional image:**
```tsx
const TACK_IMAGES: Record<string, string> = {
  'dressage-saddle': '/images/tack/dressage-saddle.png',
  'dressage-bridle': '/images/tack/dressage-bridle.png',
  'all-purpose-saddle': '/images/tack/allpurposesaddle.png',
};
// media slot:
TACK_IMAGES[item.itemId]
  ? <img src={TACK_IMAGES[item.itemId]} alt={item.name} loading="lazy" className="w-20 h-20 object-contain" />
  : <div className="w-20 h-20 rounded-lg bg-black/20 flex items-center justify-center text-[var(--text-muted)]"><Wrench className="w-10 h-10" /></div>
```

## Verification

**Commands:**
- `node scripts/migrate-all-purpose-tack.mjs` (from backend/) -- expected: "Migration complete. X Horse records updated, Y User inventory records updated."
- `cd frontend && npx tsc --noEmit` -- expected: zero type errors
- `cd frontend && npm run build` -- expected: build succeeds

**Manual checks:**
- `/inventory` — All Purpose Saddle shows saddle image, "1 in inventory", no badge; All Purpose Bridle shows Wrench, "1 in inventory", no badge
- `/horses/:id/equip` — All Purpose Saddle shows saddle image; other tack shows Wrench
- Competition with all-purpose-saddle + all-purpose-bridle equipped — backend logs show saddleBonus=5, bridleBonus=5
