# Design-System Implementation Inventories

**Updated:** 2026-08-19

This directory is a routing aid for targeted design-system maintenance. It is
not a second design specification and it is not required reading for ordinary
sessions.

## Authority

Inventory files describe current implementation shape and known migration
debt. They are subordinate to, in order:

1. the owner's current ruling;
2. [`PRODUCT.md`](../../../PRODUCT.md);
3. [`DESIGN.md`](../../../DESIGN.md);
4. [`../DECISIONS.md`](../DECISIONS.md), [`../TOKENS.md`](../TOKENS.md),
   [`../MOTION.md`](../MOTION.md), and [`../EXCEPTIONS.md`](../EXCEPTIONS.md).

An inventory statement that a route currently uses `PageHeader`,
`CanonicalTabs`, `PageContainer`, `Surface`, or `GameDialog` records existing
code only. It does **not** approve that component for new work, establish a
universal page recipe, or override the route-concept gate in `PRODUCT.md`.

## Retained inventories and exact load triggers

| File                                     | Load only when                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`foundation.md`](foundation.md)         | Changing shared shell, navigation, backgrounds, layout/UI primitives, or the design-audit infrastructure       |
| [`world-services.md`](world-services.md) | Changing the World Hub, vet, farrier, shops, crafting, grooms, riders, or trainers                             |
| [`stable-entity.md`](stable-entity.md)   | Changing Stable, horse/foal detail, horse equipment, lineage, genetics, traits, or horse identity presentation |
| [`workflow-pages.md`](workflow-pages.md) | Changing breeding, training, competitions, results, conformation, or leaderboards                              |

Read at most the matching family inventory. Add `foundation.md` only when the
same task also changes a shared primitive or shell concern. Do not bulk-load
this directory.

## Retired completion records

The former `auth.md`, `marketplace-economy.md`, `community-messaging.md`, and
`settings-profile.md` files were retired on 2026-08-19 into the dated
`docs/.archive` handoff tree.

- They had no genuine active design-audit or exception debt.
- They primarily repeated completed migration commits and import facts already
  available from Git and source.
- Their fixed “canonical” header/tab/dialog recipes contradicted the newer
  route-specific composition rules.
- Keeping zero-debt history in the agent context increased staleness and gave
  old implementation choices false design authority.

For those areas, inspect the touched source and follow the root product/design
authority. Create a new inventory only if the family acquires sustained,
cross-file migration debt that cannot be represented by the audit report or a
tracked issue.

## Live truth

Static counts and line numbers do not belong in these files. Use:

```bash
node scripts/design-audit/check-design-system.mjs --report
git log -- docs/design-system frontend/src
```

The audit report is the current mechanical residue list. Git is the migration
history. Source is the current implementation. [`../EXCEPTIONS.md`](../EXCEPTIONS.md)
is the only registry for temporary audit suppression.
