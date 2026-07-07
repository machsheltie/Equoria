# Equoria Economy Balance Review — Faucets, Drains, and Incentive Structure

**Date:** 2026-07-07
**Status:** DESIGN REVIEW — findings + proposed balance changes, pending user triage
**Scope:** the coin economy as implemented on master at 2d0751d3c. This is a _game-design_ review (incentives, price discovery, progression fairness), not a security/enforcement audit — transaction-correctness was audited separately (epic Equoria-qz7au) and enforcement gaps are only noted where they change the economics.
**Companion docs:** `docs/design/2026-07-07-game-balance-formulas.md` (scoring/training/XP formulas), `docs/features/stud-service-economy.md` (stud spec, epic Equoria-e7tgc).
**Proposals epic:** **Equoria-52df2** (13 children, labeled `beta-candidate` / `beta-ops` / `post-beta` for triage; every player-facing change is a **user decision**, Constitution §6 — nothing here is implemented).

---

## 1. Executive summary

The Equoria economy is **nearly closed, with a tiny fixed faucet** — the opposite of the usual sim-game runaway-mint failure mode. Only two faucets exist (1,500 coins at signup, 500/week bank claim); every NPC purchase **burns** coins; show prizes are **player-funded escrow**, not system mints. Money supply still grows monotonically (~500/account/week against mostly one-time burns — see F5), but slowly and linearly, and conservation is enforced by ledger invariants.

The real balance problems are therefore not inflation but **incentive shape**:

1. **Breeding is free** — the PRD's "breeding fee" sink was never built. Foal production has zero marginal cost, which floods the player market and bypasses the NPC horse store's burn sink. (HIGH)
2. **The horse marketplace has zero friction** — no commission, no listing fee, no expiry, no flip cooldown, and a 100–9,999,999 price band with no value linkage. Wash trades and alt-account funnels are free; price discovery means nothing. (HIGH)
3. **Every per-account faucet is trivially funneled** — a fresh alt can hand its full 1,500 signup grant (plus 500/week forever, plus its 1,000-value starter horse) to a main account through a single zero-fee marketplace hop. (HIGH for beta signal quality)
4. **Leaderboard standings are purchasable** — show creators can enter their own shows, and `Horse.totalEarnings` counts self-funded prizes, so the horse-earnings board can be bought at ~0.4 coins per displayed earning. The money leaderboard rewards hoarding and alt-farming. (MEDIUM)
5. **Sinks die by mid-game** — care costs are nearly consequence-free: feed's only enforced effect is a 'critical' gate (9+ days unfed) on breeding/conformation entry that costs ~1–2 coins per horse per week to avoid, vet decay is unreachable dead code (the non-null `healthStatus` default short-circuits it), hoof condition affects nothing, crafting materials are non-renewable, tack is permanent, and riders/trainers have no recurring salary. An established account's mandatory outflow is one groom salary. (LOW during beta, HIGH structurally)
6. **New-player on-ramp is good but unbracketed competition undermines it** — new accounts get a genuinely strong start (1,500 + competition-ready horse + tack), and NPC prices are fixed so wealth can't lock system resources; but show level brackets are stored and never enforced (horses have no level), so every entry fee a newcomer pays into an open show against established stables is a pure transfer up the wealth curve. (HIGH for beta retention)

Recommended levers, in one line each: **breeding conception fee (burn); marketplace sale commission (burn); new-account listing gate; creator self-entry / earnings-integrity rule; lifetime-earned money leaderboard; enforce level brackets; post-beta: care consequences, staff salaries, stable upgrades, stud-fee burn + stallion service cap.**

---

## 2. The money map (verified against code)

### 2.1 Faucets — money created

| #   | Source                                             | Amount                                                                  | Cadence                                                                                    | Notes                                                                                                                 | Source                                                                                 |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Registration grant                                 | **1,500** (1,000 + 500 bonus)                                           | once/account                                                                               | server-authoritative (Equoria-448du); plus starter horse (NPC value 1,000), saddle+bridle (+5/+5), crafting materials | `authConstants.mjs:58,80`; `authController.mjs:160,176`                                |
| 2   | Bank weekly claim                                  | **500**                                                                 | weekly (Sun 00:00 UTC reset, no rollover)                                                  | atomic once-per-week guard; `financialRateLimiter` 20/15min                                                           | `bankController.mjs:18,72`                                                             |
| 3   | _Latent:_ under-funded show payout                 | winner always credited; escrow debit skipped when `prizeEscrow < prize` | only for shows created outside `createShow` (seed scripts: 5 + 15 shows, prizes 400–2,000) | "system implicitly mints at payout" legacy branch — not recurring, but live if seeds run against prod                 | `showController.mjs:588-614`; `seedDevData.mjs:192-238`; `generateMockShows.mjs:55-59` |
| —   | _Dead:_ `updateUserMoney` raw increment, no ledger | uncapped                                                                | routes 410 Gone                                                                            | dead code, test-only reachability                                                                                     | `userUpdates.mjs:10-66`; `competitionRoutes.mjs:85-94`                                 |

**There is no daily-login reward, no achievement payout, no leaderboard/season payout, no NPC horse buyback, no XP→money conversion, and no recurring material income.** Events/community/labs/leaderboards modules move no money at all.

### 2.2 Drains — money destroyed (all burn to `SystemAccount[burn]`)

| Drain                             | Amount                                                             | Cadence                         | Mandatory?                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Groom hire (direct / marketplace) | 350–1,000 / `sessionRate×7` (~105–420+)                            | one-time                        | optional                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Groom weekly salary**           | 50–150 base + 0–15 specialty                                       | **weekly cron (Mon 09:00 UTC)** | **yes once hired** (7-day grace → auto-termination)                                                                                                                                                                                                                                                                                                                                                                                                  |
| Rider hire                        | 150–800 (`weeklyRate`, one week upfront)                           | one-time                        | optional — **no recurring salary exists**                                                                                                                                                                                                                                                                                                                                                                                                            |
| Trainer hire                      | 400–2,400 (`sessionRate×4`)                                        | one-time                        | optional — **no recurring salary exists**                                                                                                                                                                                                                                                                                                                                                                                                            |
| Staff marketplace refresh         | 50–100 (free 1/24h)                                                | per-use                         | optional                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Farrier                           | 80–320/service                                                     | per-use                         | **effectively optional — `hoofCondition` decays nightly but is read by zero scoring/eligibility paths** (0 hits in `backend/modules/competition` + `backend/logic`)                                                                                                                                                                                                                                                                                  |
| Vet                               | 120–350/service                                                    | per-use                         | **effectively optional — the `lastVettedDate` decay in `getVetHealth` is unreachable**: `healthStatus String? @default("Excellent")` is non-null on every normally-created horse, and the override branch (`horseHealth.mjs:138-140`) short-circuits the decay; nothing in code nulls or degrades it. Two of four services change nothing (`healthOutcome: null`); the 150-coin health-check _downgrades_ Excellent→Good (`vetController.mjs:24-42`) |
| Feed                              | 100–200 per 100-unit pack; 1 unit/day/horse (~1–2 coins/day/horse) | consumable                      | weak real consequence: 9+ days unfed → `displayedHealth 'critical'` → blocked from **breeding** (`horseFoalingController.mjs:82-87`) and **conformation-show entry** (`conformationShowController.mjs:86`); the main riding-show entry path checks only `injured` and ignores it                                                                                                                                                                     |
| Tack shop                         | 40–900/item                                                        | one-time                        | optional; tack is permanent (degradation removed 2026-05-05)                                                                                                                                                                                                                                                                                                                                                                                         |
| Crafting                          | 75–1,000/recipe burn                                               | per-use                         | **bounded by non-renewable materials** — starter grant only, no material shop or drops                                                                                                                                                                                                                                                                                                                                                               |
| NPC store horse                   | **1,000** flat                                                     | per-use                         | optional                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Training sessions and groom interactions are free. There is no boarding/upkeep/stable-rent sink.

### 2.3 Transfers — player-to-player (zero-sum, no sink)

| Surface                        | Friction                                                                                                                                | Bounds                            | Notes                                                                                                                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Horse marketplace (`buyHorse`) | **none** — no listing fee, **zero commission** (seller credited full `salePrice`), no expiry, no flip cooldown, list/delist unthrottled | price 100–9,999,999               | only guard: cannot buy your own horse (`userId` equality). Alt accounts are distinct users → any in-band price clears. The 100k `validateTransaction` cap is dead code (never mounted). `marketplaceController.mjs:180,340-357` |
| Show entry fees                | escrowed, settle to the **creator** at execution                                                                                        | fee 0–100,000                     | creator hosting take = `fee × entries`; unlimited entries                                                                                                                                                                       |
| Show prizes                    | creator escrows **full prize** at creation; 50/30/20 to placed entrants                                                                 | prize 0–10,000,000, **≥ 10× fee** | 0-entry: prize stranded, no refund (Equoria-oey96.14); crash mid-execution: stranded (Equoria-c7mx0)                                                                                                                            |
| Stud fees                      | **spec-only** — `studFee` stored/displayed, never charged (epic Equoria-e7tgc unstarted)                                                | ≥ 0, no ceiling                   | when built: 100% user→user, no house cut, no stallion-side cap                                                                                                                                                                  |
| Gifting / money transfer       | **no endpoint exists**                                                                                                                  | —                                 | the marketplace at arbitrary prices _is_ the de-facto gift channel                                                                                                                                                              |

---

## 3. Findings

### F1. Breeding profitability — free foals undercut everything (severity: HIGH for beta)

Breeding costs **nothing**: `createFoal` performs no debit, no fee, no ledger row (`horseFoalingController.mjs:43-287`); the only throttle is the 7-day dam cooldown (stallions unlimited, no per-account foal cap). Foals inherit conformation, gait, color genetics, and epigenetic traits from both parents (`foalingService.mjs:245-571`), so bred output has real market value. PRD-03 §5.1 lists "Breeding Fee — per breeding" as a core sink; it was never implemented.

**Worked example.** A player with 10 mares produces 10 foals/week at effectively zero marginal cost (conception → 7d gestation; dam re-breedable 7d after conception, so 1 foal/mare/week steady-state; the only real cost is one feed unit per mare per ≤8 days — ~1–2 coins — to stay out of the critical-health breeding gate). Sold at even the 100-coin listing floor: **1,000/week extracted from other players — 2× the weekly faucet — at zero cost and zero risk**. At a modest 300/foal it's 3,000/week. Meanwhile the NPC store horse costs 1,000 _burned_: the moment the player market has 100–300-coin foals, no rational player ever burns 1,000 at the store, so the economy's one horse-acquisition sink goes dark. Because production is free and listing is free, the market clears at the floor — a market for lemons where new players can't sell their own bred horses and the only foals with value are elite-lineage ones.

Note this is **not** a money-printing loop against the system (there is no NPC buyback; breed→sell only redistributes player coins). The damage is market health, not money supply.

**Recommended lever:** a flat **conception fee burned at breeding time** (proposal: **250**, tunable), charged in the same transaction as the pregnancy claim. Calibration: it makes floor-price foal spam a guaranteed loss (250 cost vs 100 floor) while leaving quality breeding profitable (any foal worth >250 nets positive), and it finally gives breeding — the game's core loop — a recurring sink that scales with activity. Interlock: when the stud economy (Equoria-e7tgc) ships, the conception fee applies to both the own-both path and the stud path (on top of the user→user stud fee), or breeding migrates entirely to fee-bearing paths.

### F2. Marketplace health — zero-friction trades make prices meaningless (severity: HIGH for beta)

The horse market has no commission, no listing fee, no expiry, no relist cooldown, and no linkage between price and horse quality — only the static 100–9,999,999 band (`marketplaceController.mjs:180`). The seller receives 100% of the sale price (`:354-357`). List/delist endpoints have no rate limiter.

Three consequences:

- **Wash trading is free.** Two cooperating accounts can trade the same horse back and forth at 9,999,999 to manufacture fake comparables; total cost of a round trip: 0. Any future price-history UI, "average sale price" stat, or valuation tool is poisoned from day one.
- **Instant flips are frictionless.** `buyHorse` clears `forSale`/`salePrice` and the buyer can relist in the same breath at any price — no hold time is tracked. Sniping mispriced newbie listings and relisting at 5× is the optimal trading strategy and it costs nothing to attempt at scale.
- **The largest money surface has no sink.** Player-to-player horse trades will dwarf every burn sink in volume, and 0% of that flow leaves the economy.

**Worked example.** Alt funnel (see F3): moving 1,500 coins via one junk-horse sale costs 0 today; with a 5% commission it costs 75/hop, and a 9,999,999 wash-trade round trip costs ~1,000,000 — dead on arrival.

**Recommended levers:** (a) **sale commission of 5%, burned** (`floor(0.05 × salePrice)`, min 5) — one change that adds the missing sink, taxes funnels, and kills free wash-trading; (b) either a flat **listing fee (~25, burned)** or a **14-day listing expiry** to stop costless market flooding (fee preferred: simpler, also a sink); (c) surface `HorseSale` history (last-sold price) on listings so price discovery has honest data — a UI lever, no economic change.

### F3. Per-account faucet assumptions — every grant funnels to the main (severity: HIGH for beta signal)

All faucets are per-_account_: 1,500 signup, 500/week claim, starter horse (NPC value 1,000), starter tack, starter materials. The zero-fee marketplace is a free transfer channel, so per-account grants are effectively per-_alt_ income for one player:

**Worked example.** Day 0: main lists a junk foal (free to produce, F1) at 1,500; alt registers and buys it → main +1,500. Alt lists its starter horse at the 100 floor; main buys → main gets a 1,000-value competition-ready horse for 100. Every following week the alt claims 500 and buys another 500-coin junk listing. **Steady state: each alt is worth 1,500 up front + a 900-coin horse discount + 500/week forever, at zero marginal cost.** Ten alts = 5,000/week — 10× the intended single-player faucet — which drowns the beta's economic telemetry and the money leaderboard.

Enforcement (device/IP dedup) was audited separately; the _economic design_ frictions that keep progression fair without hurting normal friend-to-friend trading:

**Recommended levers:** (a) the F2 commission (taxes every hop); (b) a **new-account market gate: creating a horse listing requires account age ≥ 7 days _and_ user level ≥ 2** (~100 XP ≈ 1–2 active days by the ratified curve). Buying stays unrestricted — a newcomer can still be gifted _purchases_ by generous friends but a day-0 alt cannot _sell_ its grant to anyone. (c) Optionally make the starter horse **non-listable** (account-bound) — its purpose is onboarding, not liquidity; binding exactly one designated horse leaves all normal trading untouched.

### F4. Leaderboard integrity — standings are purchasable (severity: MEDIUM)

Leaderboards pay nothing (prestige-only — correct for beta), but two boards fail the "reward play, not spending" test:

- **Horse earnings board.** Nothing prevents a show creator from entering their own show (`createdByUserId` stored, never checked at entry — `showController.mjs:294-325`), and `Horse.totalEarnings` counts every prize equally. **Worked example:** create a show with entry fee 0 (legal; the ≥10× rule binds at 10×0=0) and prize 1,000,000; enter your elite horse plus one alt junk horse (two entries survives the Equoria-oey96.14 minimum-entries fix). Placements pay 50% + 30%: your horse "earns" 500,000, the alt gets 300,000 back (funneled home via F3), 200,000 strands in escrow. **Net cost: 200,000 coins for +500,000 displayed earnings — #1 on the earnings board at 0.4 coins per earnings point**, no competition required. Before oey96.14 lands it's even simpler (1-entry auto-win).
- **Money board** (`getTopUsersByMoney`) ranks current balance: it rewards hoarding (never spend = climb) and is directly pumped by the F3 alt funnel.

**Recommended levers:** (a) **decide creator self-entry policy** — cleanest is to block creators from entering their own shows (standard in the genre); alternatively count `totalEarnings` only from shows with ≥ 3 distinct owners among entrants; (b) replace the money board with **lifetime earned** (sum of ledger credits — the `UserTransaction` table already supports it), so spending isn't punished and hoarding isn't glorified. Host economics themselves (creator take = fee × entries vs prize ≥ 10× fee, break-even at 10 entrants, profit beyond) are a _healthy_ risk-bearing incentive and should stay.

### F5. Inflation trajectory — tight early game, sink-starved mid-game (severity: LOW for beta, HIGH structural)

Weeks 1–4 an active account is net-negative: groom hire (350–1,000) + salary (50–165/wk), rider/trainer hires (150–2,400), tack (40–900), show entries, feed — against 500/wk + 1,500 start. Good tension.

By week ~6–8 everything durable is owned and the sink structure collapses. A derived-health seam exists (`getDisplayedHealth = worseOf(feedHealth, vetHealth)`, `horseHealth.mjs`) and is enforced as a critical-gate on breeding and conformation-show entry — but its economic pull is negligible: staying out of 'critical' costs one feed unit per ≤8 days per horse (~1–2 coins), the main riding-show path ignores it entirely, and the vet half of the seam is unreachable (the non-null `healthStatus @default("Excellent")` short-circuits `getVetHealth`'s decay for every normally-created horse — so vet spending is economically irrational, and the health-check service actually _downgrades_ Excellent→Good). `hoofCondition` decays nightly but no scoring/eligibility path reads it. Tack never degrades, crafting dies when starter materials run out, and riders/trainers charge nothing recurring (the prior balance spec's assumption that "weekly rider salaries stay a real sink" is false — no such cron exists; only grooms have salaries). Mandatory steady-state outflow ≈ one groom salary. **Net drift ≈ +350–450/account/week with nothing left to buy.**

**Worked example.** 100-account beta, 12 weeks: gross faucet ≈ 100×500×12 + 100×1,500 = **750,000 minted**; realistic burns (hires, tack, feed, store horses, mostly front-loaded) absorb maybe a third. Money supply roughly doubles over the beta and concentrates upward through the zero-rake market. Not hyperinflation — but the trajectory is monotone and the mid-game has no pressure valve.

**Recommended levers (mostly post-beta):** (a) **care consequences** — _finish the existing `displayedHealth` seam_ rather than build anew: extend the critical-gate to the main show-entry path, make the intermediate bands matter (e.g., feed the §1 scoring health stage from `displayedHealth`), and fix the vet-override deadlock so `lastVettedDate` decay is reachable; the drains, prices, UI, decay math, and two of the gates already exist — only the consequence wiring is missing; (b) **rider/trainer weekly salaries** reusing the groom salary cron machinery (`weeklyRate`/`sessionRate` fields already exist); (c) **stable-upgrade purchase flow** — already named as the post-beta roster-cap path in the balance spec §3.1; the natural big-ticket sink; (d) **crafting material shop** (burn) so the crafting sink is renewable; (e) F1's breeding fee and F2's commission, which scale with activity.

### F6. New-player fairness — great kit, no brackets (severity: HIGH for beta retention)

The on-ramp is genuinely strong: 1,500 coins, a 3-year-old competition-ready starter horse, +5/+5 tack, and crafting materials. Crucially, **all NPC prices are fixed** (store horse 1,000, per-user staff pools, fixed shop prices), so established wealth structurally _cannot_ outbid newcomers for system resources. The F1 foal flood even helps newcomers _buy_ cheap horses (while destroying their ability to _sell_).

The failure is competitive: `Show.levelMin`/`levelMax` are chosen at creation and stored, but horses have no `level` column, so the bracket is unenforced on entry (`isHorseEligible.mjs:27-29` documents this). Every show is effectively open-field. Per the companion formulas doc §1.4, a fresh starter horse scores ~32 pre-luck vs ~280 for an elite trained horse; the ±9% luck band can never close a gap over ~19.8%. **Worked example:** a newcomer entering ten 100-fee open shows spends 1,000 — two-thirds of their starting bank — with effectively zero probability of placing against any established stable, and that 1,000 settles to (mostly established) show creators. The system tells new players to compete, then takes their bank as a regressive transfer.

**Recommended lever:** enforce level brackets at entry using the already-specified horse-level formula (PRD-03 §2.2: base stats + traits + affinity + training, 50-point tiers) — the schema fields, creation-time UI, and the formula spec all exist; only the derivation + entry check are missing. Newcomer-protected brackets (e.g., horse level ≤ 2) give new players winnable fields, which is the difference between "lost my bank in week 1" churn and a progression ladder.

---

## 4. Cross-finding interactions

1. **F1 + F2 compose:** the breeding fee sets a production floor, the commission sets a transaction floor; together the junk-foal flood costs ~255+ per attempt instead of 0.
2. **F3 depends on F2:** the commission is the funnel tax; the listing gate closes the day-0 window the commission can't price.
3. **F4's fix rides oey96.14:** minimum-entries cancellation removes the 1-entry pump; the self-entry/earnings rule removes the 2-entry version. Ship them together.
4. **F5's care-consequences lever re-tunes F6:** if health gates entry, newcomers need feed/vet budget — bracket rewards (F6) and the weekly claim should cover a small stable's care costs by design (~50–100/wk).
5. **Stud economy (e7tgc):** when it ships, its user→user fees inherit F2's wash-trade concern at 0% house cut — a small stud-fee burn (e.g., 5%) plus a stallion weekly service cap keeps the annuity bounded. The stallion max-age decision stays with Equoria-cpu7v (D7).

## 5. Existing issues this review deliberately does NOT duplicate

| Issue                | Owns                                                       |
| -------------------- | ---------------------------------------------------------- |
| Equoria-oey96.14     | <2-entry cancellation + refunds + 1-entry auto-win removal |
| Equoria-c7mx0        | crash-stranded `executing` shows / frozen escrow reaper    |
| Equoria-qz7au (epic) | transaction-correctness of all money movers                |
| Equoria-e7tgc (epic) | stud service economy implementation (S1–S8)                |
| Equoria-cpu7v        | crossbreed ruleset + stallion max-age (D7) decisions       |
| Equoria-oey96.4      | missing XP awards on the cron show path                    |
| Equoria-oey96.8      | rider/trainer roster-cap enforcement                       |
| Equoria-icqqm        | weekly-salary cron idempotency                             |

**New gap found by this review** (bug-shaped, filed with the epic): partial-field shows with exactly 2 entries pay 50%+30% and strand the 20% third-place share in escrow forever — between oey96.14's scope (<2 entries) and c7mx0's (crash), nothing returns unawarded placement shares to the creator at settlement (`showController.mjs:562-614`).

## 6. What was NOT done

- No implementation, no config changes, no schema changes — every lever is a proposal (Constitution §6).
- No frontend/UX audit of how prices and fees are displayed.
- No load/abuse simulation — worked examples are arithmetic from verified constants, not telemetry.
- Rate-limiter wiring gaps (unwired `competitionRateLimiter`, unthrottled list/delist) are noted but belong to the enforcement track, not this design review.
