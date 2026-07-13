# Equoria Economy Balance Re-Review — 2026-07-13 (post-10× ruling)

**Date:** 2026-07-13
**Status:** DESIGN REVIEW — findings + proposed balance changes, pending user triage
**Scope:** delta re-review of the coin economy against master at `7f3d0c0eb` plus the six days of landings since the 2026-07-07 review. This is a game-design review (incentives, progression fairness, economy health), not an enforcement audit. Every constant cited below was re-verified against current code this session.
**Prior review:** `docs/design/2026-07-07-economy-balance-review.md` (epic Equoria-52df2). The full faucet/drain narrative lives there; this document covers **what changed, what the changes broke or fixed, and what remains** — it does not re-litigate anything the user has already ruled on.
**Proposals epic:** **Equoria-pd7p8** (children labeled `beta-candidate` / `post-beta`; every player-facing change is a user decision, Constitution §6 — nothing here is implemented).

---

## 1. Standing rulings treated as constraints (2026-07-07)

These are the user's ratified design decisions. Findings below work **within** them; none proposes reversing them.

| Ruling                                                                                                             | Consequence for this review                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Faucets re-sized: signup **10,000**, weekly claim **5,000** (`authConstants.mjs:85`, `bankController.mjs:19`)      | The new baseline all math below uses                                                                                                        |
| **No added fees** — no conception fee, no marketplace commission, no listing fee, no stud-fee burn                 | Fee-shaped levers are off the table; remaining friction tools are **cooldowns, caps, gates, binding, and re-pricing of existing NPC sinks** |
| Creator self-entry into own shows is **intended**; leaderboard-purchase implications accepted                      | Self-entry math is reported as informational only                                                                                           |
| Breeding's only cost is the player-set stud fee — the stud economy (Equoria-e7tgc) **is** the breeding-cost system | e7tgc's build priority is an economy-health matter, not just a feature                                                                      |
| Horse level formula **pinned**: `floor(horseXp/100)+1` (Equoria-g8qg0)                                             | G4 proposes entry-throttle/bracket-semantics levers, not a formula change                                                                   |

## 2. What changed since 2026-07-07 (verified)

**Landed:**

- `18287a273` — signup 1,500 → **10,000**; weekly claim 500 → **5,000**.
- `f03e2825d` (g8qg0) — **show level brackets now enforced server-side in both entry paths** (`getHorseXpLevel` at `showController.mjs:337`, in-tx check at `showEscrowTx.mjs:52`). The prior review's F6 lever landed; 52df2.8 is superseded (recommend closing it as covered).
- `cc0e2987b` + `31c73672f` (709qm) — legacy instant-competition path retired; legacy non-ledger money writers deleted. Side effect: **`Horse.totalEarnings` is now dead** — no live path credits it (tracked: Equoria-xal4m), so the horse-earnings leaderboard (`totalEarnings > 0`) is empty; the live earnings surface is `/leaderboards/competition?metric=earnings` (SUM of `competitionResult.prizeWon`).
- `e86578d42` (oey96.4) — cron executor now awards horse XP (30/27/25 podium, 20 participation), owner XP, stat gains.
- Buy endpoints got `mutationRateLimiter` (`marketplaceRoutes.mjs:44,47`); list/delist remain unthrottled.
- `c073183fe` (3k96w) — integer guards on `entryFee`/`prize`; `cf9b7ce0a` (8sag0) — feed-shop debit-first row-lock.

**In progress (uncommitted working tree):** Equoria-c7mx0 stale-`executing` show reaper (`claimedAt` column + 30-min cron job). Not treated as landed.

**Unchanged — and this is the headline:** every drain-side constant is at its pre-ruling value. Groom hire 350–1,000 direct / ~105–630 marketplace (`groomRosterController.mjs:13`, `groomMarketplace.mjs:57-62`); groom salary 50–150 + 0–15 weekly (`groomSalaryService.mjs:42-54`); rider hire 150–800, trainer hire 400–2,400, both with **no recurring salary**; staff refresh 50–100; farrier 80–320; vet 120–350; feed 100–200 per 100-unit pack at 1 unit/day/horse; tack 40–900 permanent; crafting 75–1,000 on non-renewable materials; NPC store horse **1,000 flat** (`marketplaceController.mjs:41`). No new drains exist (full `debitMoneyOrThrow` call-site enumeration, 13 burn categories). Marketplace band still 100–9,999,999 with zero commission (`marketplaceController.mjs:180,354-357`). Show fee/prize bands and the 50/30/20 split unchanged; the 0-entry prize-strand, 1-entry auto-win (oey96.14), 2-entry 20%-strand (52df2.7), and implicit-mint branch (52df2.6, now at `showController.mjs:624-641`) are all still live.

## 3. Findings

Scenario map (mission → finding): breeding-for-profit → G5 · marketplace balance → G6 · multiple-account advantage → G2 · leaderboard integrity → G3/G4 · inflation trajectory → G1 · new-player fairness → G4/G7.

### G1. The 10× faucet rescale left every drain at 1× — sink tension collapsed to ~zero (severity: HIGH structurally, MEDIUM for beta)

The 2026-07-07 ruling multiplied both faucets by ~6.7–10× and (deliberately or not) nothing on the drain side moved. The ratios that made the early game tight are gone:

- **Day 0:** the complete durable catalog — master groom 1,000 + expert trainer 2,400 + experienced rider 800 + premium tack ~1,500 + NPC store horse 1,000 + a month of feed ~800 ≈ **7,500** — fits inside the signup grant with ~2,500 left over. Under the old 1,500 grant this was ~5 weeks of income and a sequence of real choices; now it's a day-one checkout, and the "weeks 1–4 net-negative" tension the prior review praised no longer exists.
- **Steady state:** mandatory outflow is one groom salary (50–165/wk) plus feed (~7–14/wk per horse). For a 5-horse stable that's ~120–235/wk against a 5,000/wk faucet — **sinks absorb ~2–5% of recurring income** (was ~30% at the old scale). The single largest burn in the game (store horse, 1,000) is 20% of one weekly claim.
- **Beta trajectory (100 accounts × 12 weeks):** minted = 100×10,000 + 100×5,000×12 = **7,000,000**. Even if every account bought the entire premium catalog (750,000) and paid max salaries (240,000), burns absorb ~14%; realistically 6–10%. Net supply ≈ +6.0–6.6M concentrating through a zero-rake market. At the old scale the same beta minted 750k and burned roughly a third.

Nothing here mints money out of conservation (the ledger is structurally sound — `financialLedgerService.mjs:82-135`); the problem is that with coins this abundant relative to every priced good, **prices stop steering behavior**: NPC sinks go dark, "what should I spend on" disappears as a decision, the money leaderboard degenerates into weeks-since-signup × alt-count, and beta telemetry about sink engagement measures nothing. Player-market horse prices will inflate to absorb the surplus (the only place left for coins to go), which is exactly where new-player fairness erodes (G7).

**Proposed lever (Equoria-pd7p8.1, beta-candidate):** re-price the existing burn sinks to the new scale — this adds no new fee types and is consistent with the "simple horse game" ruling; it just restores the ratios the original prices were designed around. Options: (A) ×10 across the board (store horse 10,000, groom salary 500–1,650/wk, feed 1,000–2,000/pack…): restores pre-ruling ratios exactly; (B) ×5: money still feels abundant, sinks stay visible; (C) accept abundance for beta as intentional (coins as light-touch soft currency) — then 52df2.5 (retire the balance leaderboard) rises in priority and shop prices should at least be revisited before launch, because re-pricing after beta players have anchored is much harder. **User decides A/B/C and the multiplier.**

### G2. Multi-account advantage is now ~10× a single account's income, and the one pending lever doesn't block the main funnel (severity: HIGH for beta signal)

Per-account faucets at the new scale make each free alt worth **10,000 up front + 5,000/week forever** plus a starter mare and tack. The funnel is unchanged: the main lists a junk foal (free to produce, G5) at 10,000; the alt buys it on day 0; every Sunday the alt claims 5,000 and buys another junk listing. Ten alts = **+100,000 in week one and +50,000/week sustained** — a 12-week beta yields 700,000 vs 70,000 for a single-account player. The weekly claim needs only an authenticated account (`bankController.mjs:42-85`) — no level, no activity.

**Direction correction to the prior review:** the pending new-account **listing** gate (Equoria-52df2.3, age ≥7d + level ≥2 to list) only stops the alt _selling_ its starter horse (a ~1,000-value transfer). The money funnel runs the other way — **the alt buys the main's listing** — and buying is (rightly) ungated. So with fees rejected, the funnel currently has _no_ pending countermeasure at all. Levers that respect the rulings:

- **Weekly-claim eligibility gate (Equoria-pd7p8.2, beta-candidate):** require user level ≥ 2 (~100 XP ≈ 1–2 active days) or a minimal weekly activity bar (e.g., ≥1 show entry or training session that week) to claim. Kills the _recurring_ half of idle alt income while costing a real player nothing; also makes the faucet read as an engagement reward instead of a UBI.
- **Signup-grant split (Equoria-pd7p8.3, beta-candidate):** pay part of the 10,000 as **account-bound NPC store credit** (spendable at feed/tack/vet/farrier/staff/store-horse shops, non-transferable) and the rest as liquid coins — e.g., 3,000 liquid + 7,000 bound. A newcomer's purchasing power is untouched (everything they need day-one is NPC-priced); a day-0 alt's transferable value drops 70%. Binding, not a fee.
- **52df2.3 stays worth shipping** for the horse-side funnel and market hygiene — recommend beta — but it should not be scored as the multi-account fix.

### G3. Leaderboards at the new scale (severity: LOW — informational under standing rulings)

Standing purchasable (self-entry + self-funded prizes) is accepted design; noting only what changed: the **balance** leaderboard is now pumped 10× faster by alt farms and says even less about play (52df2.5's lifetime-earned swap remains the fix, pending). The **horse-earnings** board is currently _empty_ — `totalEarnings` is dead since 709qm (Equoria-xal4m has the fix spec); when it lands, self-funded prizes resume counting, per the accepted ruling. The live `?metric=earnings` board has the same accepted property.

### G4. Bracket integrity — the g8qg0 fix works, but XP-only level + free breeding + uncapped concurrent entry = a sandbag conveyor through the newcomer brackets (severity: HIGH for beta retention)

Bracket enforcement landed and works as pinned. But three verified facts compose badly:

1. Horse XP accrues **only from show participation** (20–30/entry, `competitionAwards.mjs:41-50`); training raises capability without XP.
2. Base stats come from **genetics** — an elite-bred foal inherits ~90-range stats at birth for free (G5), while the newcomer starter mare has all stats 17 (`onboardingService.mjs:107-135`).
3. The only entry guard is per-show uniqueness — **no cross-show or per-week entry cap**, and the bracket is checked at _entry_ time against current XP.

**Worked example.** An established breeder's foal (inherited 90/85/80 triad, a few weeks' free training Tr≈50, +5 affinity, +10 tack, Excellent health, bloodline traits) scores **pre-luck ≈ 190–195, luck band [~176, ~211]**. The starter mare scores **pre-luck ≈ 22.7, band [~20.7, ~24.7]** (B = 17 flat-stats triad + Tr 5, ×1.03). The bands are ~8× apart; no luck outcome ever crosses. At 0 XP the foal is level 1, and because XP lands only at execution (shows close 7 days after creation), it can enter **every open L1 show in its first week simultaneously** — winning the 50% share in each. A 10-mare stable produces 10 such foals per week (7-day dam cooldown, `horseFoalingController.mjs:26,144-154`), so the L1 bracket — the one bracket newcomers were just given — is permanently occupied by elite yearlings. The bracket fix's newcomer-protection intent is structurally defeated while the letter of it holds.

**Proposed levers (Equoria-pd7p8.4, beta-candidate — formula untouched):** (a) **per-horse concurrent-entry cap** (e.g., a horse may hold ≤ N un-executed entries; N=3–5) — a cap/cooldown, the user's preferred friction class, which also bounds every other entry-spam shape; and/or (b) **maiden-show semantics** — an optional creator flag restricting entry to horses with zero career wins (checkable from `competitionResult`), the genre-standard green-horse protection, orthogonal to the XP level. **User picks (a), (b), both, or accepts the conveyor as bloodlines-matter design.**

### G5. Breeding-for-profit — still free by design; the intended cost system is 0/11 built (severity: MEDIUM, mostly a priority signal)

Under the ruling, breeding's only cost is the player-set stud fee — and the stud economy (Equoria-e7tgc) that charges it does not exist yet (`studFee` stored/displayed, never charged; spec has **no house cut and no stallion service cap** by design, zero-fee listings legal). Until e7tgc lands, all breeding is free; after it lands, **own-stable breeding stays free forever** (the fee is cross-owner only) — which is the ratified design, but means the G4 conveyor and G6 flooding are permanent features of a stable that owns both parents. No system-mint exists anywhere in the loop (no NPC buyback — breed→sell only redistributes player coins), so this is market-health, not money-supply. The one economy-shaped action: **e7tgc is now the entire breeding-cost system and should be treated as economy-priority for beta**, not a nice-to-have feature. (Its 52df2.13 companion — stud-fee burn — stays rejected; the stallion weekly service-cap half of that proposal remains open for the user.)

### G6. Marketplace — no changes; the two non-fee hygiene levers were never ruled on (severity: LOW for beta)

Zero commission/listing-fee is ratified and respected. What remains, at the new scale: the 100-coin floor is now 1% of the signup grant (junk listings are effectively free to park forever — no expiry, no listing fee); wash-trading costs zero (accepted); price discovery has no honest data surface. Undervalued-listing sniping is bounded a little by the new buy-side `mutationRateLimiter`, is first-buyer-wins atomic, and is genre-normal. Two levers from the old F2 that are **not fees** and were never explicitly ruled on (Equoria-pd7p8.5, post-beta): (a) **14-day listing expiry** (relist is free — pure anti-flooding hygiene); (b) **last-sold price history on listings** (pure UX). List/delist rate-limiting stays an enforcement-track note.

### G7. New-player fairness — materially improved; residual risks are G4 and player-market inflation (severity: LOW-MEDIUM)

The on-ramp is the strongest it has been: 10,000 + competition-ready mare + tack, brackets now enforced, ten 100-fee entries cost 10% of starting bank (was 67%), and all NPC prices are fixed so wealth cannot lock system resources. Two residuals: the G4 conveyor sits exactly on the newcomer bracket, and G1's surplus will inflate player-market horse prices (newcomers remain protected on essentials by fixed NPC prices — the 1,000 store horse is now trivially affordable — but _selling_ their own bred horses into an inflated, flooded market stays hard). No new lever beyond G1/G4's.

## 4. Money-integrity items re-ranked at 10× (already filed — referenced, not duplicated)

Prize/escrow bugs now move 10× the coins: **oey96.14** (0-entry prize strands with no refund; 1-entry auto-wins 50%), **52df2.7** (2-entry shows strand the 20% share forever), **52df2.6** (under-funded payout implicitly mints — branch now at `showController.mjs:624-641`), **c7mx0** (crash-stranded escrow; reaper in progress). Recommendation: treat oey96.14 + 52df2.7 as beta-blocking money bugs now that typical prize sizes will be 10× larger. **xal4m** (dead `totalEarnings`) should land before any earnings surface is shown to testers.

## 5. Adjacent observations (not economy design)

- `trainingController.mjs:744` reads `horse.horseXp?.level` — `horseXp` is an `Int`, so this is always `undefined ?? 1`: the training payload reports every horse as level 1 (display bug, filed Equoria-fdwly).
- The uncommitted c7mx0 reaper in the working tree calls `creditSystemAccount` with a positional signature that doesn't match the live API and references fields not on the current models — flagged to the owner of that in-progress work; not treated as landed here.

## 6. What was NOT done

- No implementation, no config/schema changes — every lever is a proposal (Constitution §6); rejected 7-07 levers were not re-proposed.
- No telemetry/simulation — worked examples are arithmetic from constants re-verified this session.
- No frontend price-display audit (USD-label issue stays with oey96.12); enforcement-track gaps (list/delist throttling) noted but not owned here.
- Groom marketplace-hire pricing (~105–630 via `sessionRate×7`) sits oddly below direct-hire (350–1,000); folded into pd7p8.1's re-pricing pass rather than filed separately.
