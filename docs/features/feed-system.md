# Feed and Pregnancy-Care Contract

- **Status:** Active gameplay contract
- **Updated:** 2026-08-19
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
- Feeding is a deliberate, once-per-UTC-calendar-day care action from the
  horse's own context. It consumes one unit of the equipped tier.
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

Health shown to the player is the worse of feed health and vet health.
`retired` is a terminal state rather than a degradation band.

Feed health is based on UTC calendar days since `lastFedDate`:

|            Days | Band        |
| --------------: | ----------- |
|             0–2 | `excellent` |
|             3–4 | `good`      |
|             5–6 | `fair`      |
|             7–8 | `poor`      |
| 9+ or never fed | `critical`  |

Vet health uses the explicit `healthStatus` finding when present; otherwise it
decays from `lastVettedDate`: 0–7 days `excellent`, 8–14 `good`, 15–21 `fair`,
22–28 `poor`, and 29+ or never vetted `critical`. Known band names are compared
case-insensitively. An unknown free-form vet finding is conservatively treated
as critical for combined-health ordering.

Critical displayed health blocks breeding and competition entry. Feeding does
not erase an independent vet problem, and a vet visit does not erase neglect.

## Pregnancy-care contract

Gestation lasts seven days. A successful daily feeding while a mare is in foal
increments `pregnancyFeedingsByTier` for the equipped tier. At foaling:

```text
totalFeedings = sum(recognized tier counts)
weightedSum = sum(count × tier pregnancy weight)
positive_chance = weightedSum / max(7, totalFeedings)
unfedDays = max(0, 7 - totalFeedings)
negative_chance = unfedDays × 5
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
  migrations
- Frontend formula mirror: `frontend/src/lib/utils/pregnancyChances.ts`

Load this document only when changing or reviewing feed purchase/equipment,
the daily feed action, feed/vet/displayed health, critical-health gates,
pregnancy feeding counters, the seven-day foaling window, or the pregnancy
bonus calculation. Do not load it for unrelated horse pages, generic inventory
work, visual styling, or ordinary economy changes.
