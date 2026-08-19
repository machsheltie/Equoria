# World-Services Implementation Inventory

**Load only when:** changing World Hub, Veterinarian, Farrier, Feed Shop, Tack
Shop, Crafting, Grooms, Riders, or Trainers.

## Purpose and authority

This file identifies shared implementation and active debt in the world-service
family. It is subordinate to `PRODUCT.md`, `DESIGN.md`, and
`../DECISIONS.md`; it does not prescribe one composition for the family.

## Experience guardrail

World services are places in Equoria. Their artwork, staff, buildings, shop
character, and the player's current errand lead the composition. They must not
read as service-management dashboards with a shared title row, peer tabs,
filter cards, and inventory tables simply because those primitives already
exist.

- `PageHero` is available only for allow-listed, artwork-backed locations and
  remains optional. Its presence does not make every service page identical.
- Grooms, riders, and trainers are people in the stable world, not HR records.
- Purchases and treatment decisions show relevant horse, cost, consequence,
  and receipt in context.
- World Hub must act as travel through a place, not a module launcher.

## Current implementation map

- Routed pages live under `frontend/src/pages/` with related shop and service
  components under `frontend/src/components/`.
- Shared scene/header behavior lives in `frontend/src/components/layout/`.
- Rider and trainer management currently include dashboard-named components;
  the names and present structure are implementation evidence, not product
  direction.

## Active cleanup concerns

- `WorldHubPage.tsx` still owns a page-local outer-width wrapper.
- `MyRidersDashboard.tsx` and `MyTrainersDashboard.tsx` still own hand-rolled
  full-screen picker overlays.
- `WhileYouWereGone.tsx` is an authored returning-player event and must be
  evaluated as game-event choreography, not flattened into a toast or generic
  modal.

Confirm all locations with the live audit; do not preserve static line numbers
or counts here.

## Verification

```bash
node scripts/design-audit/check-design-system.mjs --report
npm run typecheck
```
