# Feed and Pregnancy-Care Contract

- **Status:** Active gameplay contract
- **Updated:** 2026-10-23
- **Origin:** Equoria-3gqg feed-system redesign, implemented in 2026-04

This document preserves the durable player-facing rules that are expensive to
infer from isolated call sites. It is not an implementation plan. Current
source, schema, tests, and API contracts govern technical details; `PRODUCT.md`
and `DESIGN.md` govern presentation.

## Player loop

- The feed shop sells feed into the player's pooled inventory. Buying feed does
  not feed a horse.
- A horse has one persistent equipped feed tier. Equipping is separate from
  buying and feeding.
- Feeding is a deliberate care action from the horse's own context. It consumes
  one unit of the equipped tier. Below Excellent hunger a horse may be fed again
  the same day; at Excellent, once per Eastern game day (see the health contract).
- Running out removes the depleted inventory row and clears that tier from the
  horse. The game must explain that the player needs to buy and equip feed; it
  must not invent units or silently feed the horse.
- Horses aged 21 or older are retired and do not require feeding.
- There is no automatic feeding, scheduled feeding, feed spoilage, or
  per-discipline feed bonus.

The action is transactional. A concurrent double-submit may produce only one
successful daily feed: inventory, `lastFedDate`, stat boost, and pregnancy
counter must succeed or fail together.

## Feed tiers and stat rolls

Each successful feeding prevents neglect for that day. The non-basic tiers
also have one chance to add one point to one uniformly selected stat from the
canonical 12-stat roster.

| Tier key          | Stat-roll chance | Pregnancy weight |
| ----------------- | ---------------: | ---------------: |
| `basic`           |               0% |                0 |
| `performance`     |              10% |                5 |
| `performancePlus` |              15% |               10 |
| `highPerformance` |              20% |               15 |
| `elite`           |              25% |               20 |

The roster is `precision`, `strength`, `speed`, `agility`, `endurance`,
`intelligence`, `stamina`, `balance`, `boldness`, `flexibility`, `obedience`,
and `focus`. `coordination` is not a horse stat.

## Health contract

Owner ruling 2026-10-23 (Equoria-u0jop): health is exactly **Excellent, Very
Good, Good, Fair, Bad**. Stored or legacy Poor, Bad and Critical all read as
Bad. `backend/utils/horseHealth.mjs` `healthGradeOf` is the one mapping every
gate, serializer and the show score use (`toHealthWord` words it);
`frontend/src/lib/healthWords.ts` `formatHealth` / `healthLabel` is the one
on-screen formatter.

Health and hunger are two five-word levels (owner ruling 2026-10-23,
Equoria-qwz60). Health comes from Eastern game days since the last vet visit
(`lastVettedDate`):

|                Days | Health      |
| ------------------: | ----------- |
|                 0-7 | `Excellent` |
|                8-14 | `Very Good` |
|               15-21 | `Good`      |
|               22-28 | `Fair`      |
| 29+ or never vetted | `Bad`       |

Hunger comes from Eastern game days since the hunger clock (`hungerSince`, else
`lastFedDate`): 0-2 `Excellent`, 3-4 `Very Good`, 5-6 `Good`, 7-8 `Fair`, 9+ or
never fed `Bad`. Hunger Fair lowers the health shown by one level, hunger Bad by
two; the floor is Bad. A free-form or legacy vet finding in `healthStatus`
(Injured, Poor, Critical, anything that is not Excellent, Very Good, Good or
Fair) reads as Bad. The four good words stored in `healthStatus` no longer
override the vet days. `retired` is a terminal state rather than a health word;
the age rules, not the health gate, refuse a retired horse.

Hunger is a fill bar. One feeding raises it one level. Below Excellent the horse
may be fed again and again until it is Excellent (each feeding still consumes a
unit and may roll a stat boost); at Excellent, feeding is once per Eastern game
day. A feeding below Excellent back-dates `hungerSince` to the oldest day of the
next level up; `lastFedDate` always stays the real time of the last feeding.

A horse must be **Fair or better** to breed, train, or enter any show (ridden
or conformation): displayed health Bad blocks all three (`hasBadHealth`).
Next-actions applies the same gate; its vet line reads "<Horse> is in bad health
and needs to be vetted", plus " and fed" when hunger is Fair or Bad. Feeding does
not erase an independent vet problem, and a vet visit does not erase neglect.
The show-score health modifier keyed on the five words reads `horseHealthGrade`
(`backend/modules/competition/rules/healthScoring.mjs`).

A foal is born with its mare's care clocks (`lastVettedDate`, `lastFedDate`,
`hungerSince`). A Fair mare at foaling raises the foal's negative-trait chance by
25%, a Bad mare by 50% (`negativeTraitChanceMultiplier`, applied to the
pregnancy negative-trait chance as it stands).

## Pregnancy-care contract

Gestation lasts seven days. A successful daily feeding while a mare is in foal
increments `pregnancyFeedingsByTier` for the equipped tier. At foaling:

```text
totalFeedings = sum(recognized tier counts)
weightedSum = sum(count × tier pregnancy weight)
positiveChance = weightedSum / max(7, totalFeedings)
unfedDays = max(0, 7 - totalFeedings)
negativeChance = unfedDays × 5
```

The values are percentage chances. Unknown tier keys do not contribute. The
positive and negative rolls are independent, so both may succeed or both may
fail. Feeding after seven recorded feedings cannot inflate the positive chance
beyond the weighted average and cannot make the missed-day count negative.

## Live implementation map

- Catalog and purchase: `backend/modules/economy/feedShop/`
- Daily action: `backend/modules/horses/services/horseFeedService.mjs`
- Health helpers: `backend/utils/horseHealth.mjs`
- Pregnancy formula: `backend/utils/pregnancyBonus.mjs`
- Delayed foaling: `backend/modules/horses/services/foalingService.mjs`
- Schema history: migration `20260430055822_feed_phase_a` and later pregnancy
  migrations. That migration's comment block cites
  `docs/superpowers/specs/2026-04-29-feed-system-redesign-design.md`, a spec
  retired in `fee265d07`; **this document is its successor.** The stale pointer
  cannot be corrected, because Prisma hashes the migration file's raw bytes and
  editing it after it was applied is what broke `prisma migrate dev` for three
  weeks (Equoria-mxftz). Treat the citation as provenance and read this file
  instead. Never edit a file under `packages/database/prisma/migrations/` once
  it has been applied — comments included.
- Frontend formula mirror: `frontend/src/lib/utils/pregnancyChances.ts`

Load this document only when changing or reviewing feed purchase/equipment,
the daily feed action, feed/vet/displayed health, the Fair-or-better health gate,
pregnancy feeding counters, the seven-day foaling window, or the pregnancy
bonus calculation. Do not load it for unrelated horse pages, generic inventory
work, visual styling, or ordinary economy changes.
