# Equoria Game-Balance Formula Specification

**Date:** 2026-07-07
**Status:** DESIGN SPEC — implementation-ready, pending user ratification of the flagged open points
**Scope:** the five decision-gated formulas blocking the Round-2 implementation fleet:

| §   | Formula                          | bd issue(s)                                       | Decision state                                                                                                  |
| --- | -------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Canonical competition scoring    | Equoria-oey96.11, Equoria-ek242                   | "Full scorer" decided (Round-2 fleet table, 2026-07-06); this spec supplies the exact pipeline                  |
| 2   | Trainer training modifier        | Equoria-oey96.7                                   | Path (a) implement, per PRD-06 §3; this spec supplies the weights/caps PRD-06 lacks                             |
| 3   | Rider/trainer roster-cap scaling | Equoria-oey96.8                                   | "Scaled by stable level" decided (Day-4, recorded on issue); this spec supplies the curve + stable-level source |
| 4   | User XP / level curve            | Equoria-smqn7                                     | This spec recommends the PRD curve with the pacing comparison the issue asks for                                |
| 5   | Horse age-cap policy             | Equoria-2nacc (coordinates with Equoria-cpu7v D7) | This spec supplies the canonical caps and the 20-vs-21 reconciliation                                           |

**How to read this document:** each section is self-contained: (1) exact math, (2) balance rationale + system interactions, (3) degenerate-strategy analysis, (4) sensitivity notes (tunable vs structural), (5) the TDD test matrix the implementer writes FIRST (real DB, no mocks, per Constitution §3 and AUDIT_EXECUTION_PROTOCOL.md). Cross-formula interactions are collected in §6.

**What this document is not:** an implementation. No code changes ship with this spec. Issues remain open until their implementers land the work and the user closes them (Constitution §6).

---

## §1. Canonical competition scoring formula

**Issues:** Equoria-oey96.11 (decision + overnight-show routing), Equoria-ek242 (live-scorer residual).
**Decision being executed:** _full scorer — stats + traits + training + tack + health — with luck multiplicative_ (Round-2 fleet decision table; consistent with the README FinalScore formula and `docs/data-models.md`).

### 1.1 The three engines today, and what the canonical formula unifies

| Component                      | cron `executeClosedShows` (only live scorer) | `calculateCompetitionScoreDetailed` (utils/competitionScore.mjs) | `simulateCompetition` (logic/simulateCompetition.mjs)         |
| ------------------------------ | -------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| Stat base                      | flat mean of 5 fixed stats                   | unweighted sum of 3 stats (4 disciplines mapped)                 | **50/30/20 weighted triad from statMap.mjs (23 disciplines)** |
| Discipline affinity trait +5   | —                                            | ✔                                                                | ✔ (plus legacy `trait` column +5, stackable)                  |
| Training (disciplineScores)    | —                                            | —                                                                | ✔ additive                                                    |
| Tack                           | —                                            | —                                                                | ✔ additive                                                    |
| Rider modifiers (+flag compat) | ✔                                            | —                                                                | ✔                                                             |
| Health modifier                | —                                            | —                                                                | ✔                                                             |
| Temperament modifier           | —                                            | ✔                                                                | —                                                             |
| Epigenetic flag influence      | —                                            | ✔                                                                | —                                                             |
| Stress impact                  | —                                            | —                                                                | ✔                                                             |
| Trait competition impact (%)   | —                                            | —                                                                | ✔                                                             |
| Luck                           | **absolute ±9 points** (mislabeled "±9%")    | ±9% multiplicative, injectable `_luckFn`                         | ±9% multiplicative, `Math.random` inline                      |

No engine implements the full decided formula. The canonical pipeline below is `simulateCompetition`'s spine with the two stages only `competitionScore.mjs` has (temperament, flags) inserted, the legacy/affinity double-count collapsed, and luck injectable. The implementation target is **one scoring function** (recommended home: extend `backend/logic/simulateCompetition.mjs`, since it already has 8 of the 11 stages and its own test suite) that **both** the nightly cron and any future instant path call. `competitionScoring.mjs`'s header claim that the engines "differ ON PURPOSE" is superseded by the oey96.11 decision — that comment must be updated to cite this spec and issue (oey96.11 AC2 already requires this).

### 1.2 Exact pipeline (order is normative)

Inputs: `horse` (10 stats 0–100, `trait`, `epigeneticModifiers`, `epigeneticFlags`, `temperament`, `tack` JSONB, `healthStatus`, `stressLevel`, `disciplineScores` JSONB, active rider assignment), `show` (`discipline`, `showType`), `luckFn` (injectable, default `Math.random`).

```
// ── additive stage (points) ─────────────────────────────────────────
B  = 0.5·primary + 0.3·secondary + 0.2·tertiary     // triad from statMap.mjs; range 0–100
A  = 5 if (affinity trait for discipline present OR legacy horse.trait === discipline) else 0
                                                     // ONE +5, never stacked (see 1.3.1)
Tr = disciplineScores[discipline] ?? 0               // uncapped in DB; lifetime-bounded, see §6.1
Tk = ridden/conformation: saddleBonus + bridleBonus  // catalog values, 1–7 each
     parade:              presenceBonus              // 2–6 (see 1.3.2)
S1 = B + A + Tr + Tk

// ── multiplicative stage (each factor ×(1 + m)) ─────────────────────
S2 = S1 · (1 + temperamentMod)        // TEMPERAMENT_COMPETITION_MODIFIERS, ridden|conformation
                                       // (parade uses ridden), clamp [-1, 1]; ±5% max in table
S3 = applyFlagInfluencesToCompetition(S2, epigeneticFlags, discipline).modifiedScore
                                       // existing module, unchanged
S4 = S3 · (1 + riderBonus − riderPenalty)
                                       // computeRiderModifiers + applyRiderCompatibility;
                                       // caps: bonus ≤ 0.10, penalty ≤ 0.08 (riderBonus.mjs)
S5 = S4 · (1 + healthMod)             // Excellent +5% … Bad −5% (healthBonus.mjs)
S6 = S5 − S5 · (stressLevel · 0.002 · stressResistanceFactors)
                                       // existing stress stage from simulateCompetition
S7 = S6 · (1 + traitImpactModifier)   // traitCompetitionImpact: per-trait % summed,
                                       // × diminishing factor {1: 1.0, 2: 0.95, 3: 0.90,
                                       //   4: 0.85, ≥5: 0.80}

// ── luck LAST, multiplicative, injectable ───────────────────────────
L      = luckFn() · 0.18 − 0.09        // uniform in [−0.09, +0.09], clamped
final  = max(0, round1(S7 · (1 + L)))  // round to 1 decimal
```

**Ranking:** sort descending by `final`. **Tie-break (new, normative):** higher pre-luck score `S7` wins; if still tied, earlier show entry (`ShowEntry.createdAt`) wins. Today's engines have no defined tie-break (JS sort instability decides) — with integer-ish scores and small fields, ties are common enough to need a deterministic rule.

**Explicitly excluded (deliberate):** PRD-03 §2.1's "Age Factor = peak_at_6-8_years_curve" is implemented nowhere and is NOT part of the canonical formula. Age is an _eligibility_ gate (§5), not a performance multiplier. An age-performance curve stays a post-beta option (it would also double-punish elderly horses that the age cap already retires). PRD-03 §2.1's "±5% variance" is superseded by the ratified ±9% (README formula, both rich engines, ek242's fix plan). **The oey96.11 implementer amends PRD-03 §2.1 in the same commit** (docs move with code): scoring block replaced by this pipeline, ±9% stated, Age Factor line removed.

### 1.3 Sub-decisions folded into the pipeline

1. **Legacy trait +5 and affinity trait +5 collapse to a single +5.** `simulateCompetition` today stacks them (+10 for a horse with both the legacy `trait` column match and the `disciplineAffinity*` epigenetic trait). The legacy column is a pre-epigenetics artifact; stacking double-counts one concept ("this horse suits this discipline"). Canonical: `OR`, one +5. Legacy horses lose nothing; double-dippers lose 5 points of unearned edge.
2. **Parade tack:** `simulateCompetition`'s comment says "presenceBonus × 10" but the code applies `presenceBonus × 1.0` (the ×10 comment describes an abandoned draft). Canonical: **presenceBonus × 1** (2–6 points, matching the saddle+bridle magnitude for ridden shows). The implementer deletes the misleading comment. The `groomBondModifier` stub stays 1.0 and out of the spec until a groom-bond feature ships.
3. **Luck injectability is part of the contract.** `simulateCompetition` calls `Math.random()` inline, which is why oey96.11's test plan has to hedge ("if luck is not injectable…"). The canonical function takes `luckFn` as a parameter (mirroring `calculateCompetitionScoreDetailed._luckFn`), making every test in the matrix below deterministic. This is structural, not tunable.
4. **The cron keeps its money invariants.** The scorer swap must not touch the claim-then-process pattern, escrow debits, or prize math in `executeClosedShows` (oey96.11 trap: "assert prize payouts unchanged").
5. **`statMap.mjs` is the canonical stat-triad table.** Three triad sources exist and partially disagree (e.g. Racing: speed/stamina/**focus** in `statMap.mjs` vs speed/stamina/**intelligence** in PRD-03 §1.2 and `competitionScore.mjs`; `trainingController`'s stat-gain map is a fourth, different-purpose table). The canonical scorer reads `statMap.mjs` via `getStatScore`. The oey96.11 implementer corrects PRD-03 §1.2's triads to match `statMap.mjs` doc-side where they drift (docs move with code) — and does NOT edit `statMap.mjs` itself, which would silently re-rank every horse.

### 1.4 Worked examples (Racing; triad speed/stamina/focus per statMap.mjs)

Luck shown as the deterministic pre-luck score and the ±9% band.

**Low — fresh 3-year-old, first week of training.**
speed 30 / stamina 25 / focus 20 → B = 15 + 7.5 + 4 = **26.5**. No affinity (A=0), Tr = 5 (one session), no tack, no rider. Temperament Steady (+3% ridden), health Good (0), stress 0, no impact traits.
S1 = 31.5 → S2 = 31.5 × 1.03 = 32.45 → S3..S7 unchanged → **pre-luck 32.4**, band **[29.5, 35.4]**.

**Mid — competitive 8-year-old, 10 training weeks in.**
speed 65 / stamina 55 / focus 50 → B = 32.5 + 16.5 + 10 = **59**. Affinity trait (A=5), Tr = 50, tack 5+5 = 10. Temperament Bold (+5%), rider (developing, L5, prestige 20, medium affinity → bonus 0 + 0.016 + 0.008 + 0.01 = 3.4%), health Excellent (+5%), stress 20, trait `athletic` (Racing-specialized +7%, 1 trait → factor 1.0).
S1 = 124 → S2 = 130.2 → S4 = 130.2 × 1.034 = 134.6 → S5 = 141.4 → S6 = 141.4 × (1 − 0.04) = 135.7 → S7 = 135.7 × 1.07 = **145.2**, band **[132.1, 158.3]**.

**High — elite 12-year-old, near lifetime training max.**
speed 95 / stamina 90 / focus 85 → B = 47.5 + 27 + 17 = **91.5**. A = 5, Tr = 90, tack 7+5 = 12. Temperament Bold (+5%), rider (experienced, L10, prestige 100, high affinity → 3% + 3.6% + 4% + 2% = 12.6% → capped **10%**), health Excellent (+5%), stress 0, traits `legendaryBloodline` (+10% Racing) + `athletic` (+7% Racing) → (0.17 × 0.95) = +16.15%.
S1 = 198.5 → S2 = 208.4 → S4 = 229.3 → S5 = 240.7 → S7 = 279.6 → **pre-luck 279.6**, band **[254.4, 304.8]**.

**Upset arithmetic (why ±9% multiplicative is the right shape):** horse X beats horse Y _regardless of luck_ exactly when `S7_X × 0.91 > S7_Y × 1.09`, i.e. when X's pre-luck score is ≥ ~19.8% higher. The High horse (279.6) can never lose to the Mid horse (145.2, ratio 1.93). Two mid-pack horses 10% apart trade wins — small gaps stay exciting, earned gaps are safe. Compare the current cron's _absolute_ ±9: at Low-example scores (base ~25) it is a ±35% swing that regularly inverts real 20-point stat differences, and at High scores it is ±3% noise — exactly backwards.

### 1.5 Degenerate-strategy analysis

- **"Train one horse forever" (uncapped `disciplineScores`):** bounded by structure, not by a clamp. The 7-day global cooldown allows ~1 session per game year, and the active career is ages 3–20 (§5) → ≈ 18 lifetime sessions → Tr ≈ 90 typical, ≈ 145 absolute max (all best modifiers every week). Training legitimately rivals the stat base (0–100) — that is the _point_ of oey96.11 (training must matter) — but it cannot run away, and it costs the horse's entire lifespan. **This bound is an interlock with §5: raising the age cap silently raises max training score.**
- **"Stack multipliers":** the multiplicative stage's best case is 1.05 (temperament) × 1.10 (rider) × 1.05 (health) × ~1.16 (two elite specialized traits) ≈ **+41%** over the additive subtotal, most of it from rare traits. Rider and trait contributions are capped/diminished; no single multiplier exceeds +16%. Multipliers amplify a good horse; they cannot substitute for one.
- **"Buy the win with tack":** tack tops out around 12–14 points — decisive between near-equals (inside the luck window), irrelevant against a 50-point stat gap. Money buys the last 5%, not the first 95%.
- **"Enter foals/elderly horses in weak fields":** blocked by §5 eligibility, not by scoring.
- **"Stat-allocation sniping" (horse XP → stat points):** 100 horse XP per stat point at 20–30 XP per show ≈ 4 shows per point. A min-maxer routing all points into the 50%-weighted primary stat gains 0.5 pt of B per point — efficient but slow, and it is the intended optimization surface, not an exploit.
- **Small fields / auto-win:** a 1-entry show still pays 50% of the pot to the only entrant. That is oey96.14's scope (cancellation below minimum entries), not a scoring problem — noted here so the implementer does not "fix" it in the scorer.

### 1.6 Sensitivity notes

| Constant                                                                                                     | Value       | Tunable post-beta?                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------- |
| Stat weights                                                                                                 | 50/30/20    | Yes — but changes every horse's ranking; re-run balance examples                                         |
| Affinity bonus                                                                                               | +5          | Yes (cheap)                                                                                              |
| Tack magnitudes                                                                                              | catalog 1–7 | Yes (cheap; catalog data)                                                                                |
| Health table                                                                                                 | +5…−5%      | Yes (cheap)                                                                                              |
| Temperament tables                                                                                           | ±5%         | Yes (PRD-03 §7.5 must move in lockstep)                                                                  |
| Rider caps                                                                                                   | 10% / 8%    | Yes — shared constants in riderBonus.mjs                                                                 |
| Stress rate                                                                                                  | 0.002/pt    | Yes (cheap)                                                                                              |
| Trait diminishing factors                                                                                    | 1.0→0.80    | Yes (cheap)                                                                                              |
| Luck width                                                                                                   | ±9%         | Yes — the single strongest lever on upset frequency; the ~19.8% guaranteed-win threshold scales directly |
| Pipeline order, multiplicative composition, luck-last, injectable luckFn, single +5 affinity, tie-break rule | —           | **Structural. Changing any of these is a design change, not a tune.**                                    |

### 1.7 Test matrix (write first, real DB)

Every test seeds `TestFixture-` horses via `createTestHorse()` and injects `luckFn` for determinism.

| #   | Arrange                                                                                      | Assert                                                                                |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| T1  | Two horses identical except discipline score (0 vs 50), luckFn fixed 0.5                     | trained horse scores exactly +50 pre-multiplier points higher; wins deterministically |
| T2  | Identical except one has affinity trait; and one arm with BOTH legacy trait + affinity trait | +5 exactly; double-carrier ALSO +5 exactly (no +10)                                   |
| T3  | Identical except tack (none vs saddle 5 + bridle 5)                                          | +10 through the additive stage                                                        |
| T4  | Identical except health (Excellent vs Bad)                                                   | ×1.05 vs ×0.95 on the post-rider score                                                |
| T5  | Identical except temperament (Bold vs Nervous, ridden)                                       | ×1.05 vs ×0.95 applied at S2                                                          |
| T6  | Identical except rider (none vs experienced L10 P100 high-affinity)                          | rider horse ×1.10 exactly (cap engaged)                                               |
| T7  | luckFn = 0 and luckFn = 1 arms                                                               | final = S7×0.91 and S7×1.09; never outside; monotone in luckFn                        |
| T8  | All-zero-stat horse, no modifiers                                                            | score 0, no throw, placement recorded                                                 |
| T9  | Conformation showType                                                                        | conformation temperament column used, not ridden                                      |
| T10 | Cron path (`executeClosedShows`) vs direct canonical-function call, same fixtures + luckFn   | identical scores (engine parity — the sentinel that prevents re-drift)                |
| T11 | Full cron run over a seeded show                                                             | prize/escrow/ledger rows byte-identical to pre-change behavior (money invariant)      |
| T12 | Two horses tied at S7·(1+L)                                                                  | higher S7 places first; entry-time breaks the remainder                               |
| T13 | Sentinel-positive: re-introduce flat 5-stat mean in a planted branch                         | parity test T10 fails                                                                 |

---

## §2. Trainer training modifier — `computeTrainerModifiers`

**Issue:** Equoria-oey96.7 (path (a): implement; this spec is the embedded second gate — "exact formula on the issue before coding").
**PRD contract (PRD-06 §2.1, §3):** magnitude derived from _skill level + discipline match + personality–horse compatibility_, with a penalty when personality conflicts with temperament; no-trainer sessions unchanged.

### 2.1 Exact math

Signature and shape mirror `computeRiderModifiers` (defensive, pure, capped):

```
computeTrainerModifiers({ trainer, discipline, horseTemperament })
  → { bonusPercent, penaltyPercent }        // decimals; both ≥ 0

// null/malformed trainer → { 0, 0 }  (no-trainer path unchanged — control arm)

bonus  = SKILL_BONUS[skillLevel]            // novice 0.02 | developing 0.05 | expert 0.10
       + (clamp(level,1,10) − 1) · 0.005    // +0.5%/level above 1, max +4.5%
       + (speciality === discipline ? 0.05 : 0)
       + max(0, COMPAT[personality][temperament])   // positive side of matrix

penalty = max(0, −COMPAT[personality][temperament]) // negative side of matrix
if (trainer.retired === true) penalty = TRAINER_PENALTY_CAP   // defensive; assign-guard is oey96.24

bonus   = clamp(bonus,   0, TRAINER_BONUS_CAP)      // TRAINER_BONUS_CAP   = 0.20
penalty = clamp(penalty, 0, TRAINER_PENALTY_CAP)    // TRAINER_PENALTY_CAP = 0.08
```

**Compatibility matrix** (5 canonical personalities × 11 canonical temperaments; unlisted pairs = 0; values in [−0.04, +0.04]). Guard with the canonical-set pattern from PATTERN_LIBRARY (`CANONICAL_TRAINER_PERSONALITIES`, and validate temperament against `TEMPERAMENT_TYPES`) so a typo'd value silently gets 0, never a bonus:

| personality   | positive pairs                                                  | negative pairs                                                   | design identity                          |
| ------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `focused`     | Playful +0.03, Spirited +0.02, Reactive +0.02                   | Lazy −0.02                                                       | channels distractible energy             |
| `encouraging` | Nervous +0.04, Lazy +0.03, Playful +0.02                        | Aggressive −0.02                                                 | builds confidence, can't confront        |
| `technical`   | Calm +0.03, Steady +0.03, Independent +0.02                     | Reactive −0.03, Nervous −0.02                                    | precision needs a steady partner         |
| `competitive` | Bold +0.04, Spirited +0.03, Aggressive +0.02                    | **Nervous −0.04** (the PRD-06 §3 worked example), Reactive −0.02 | pushes hard; breaks fragile temperaments |
| `patient`     | Stubborn +0.04, Nervous +0.03, Reactive +0.03, Aggressive +0.02 | _(none)_                                                         | the safe-with-everyone default           |

**Application point and composition order (normative — the issue's trap):** in `trainingController.trainHorse`, the discipline-score gain becomes a **single-rounded** composition:

```
gain = max(1, round( 5 · (1 + traitMod) · (1 + temperamentScoreMod) · (1 + bonusPercent − penaltyPercent) ))
```

Order: **traits → temperament → trainer**, one terminal `round` (the current code rounds after each stage, which both loses small modifiers and makes composition order observable; the single terminal round fixes that as part of this change). The trainer modifier applies to the **discipline-score gain only** — NOT to user XP (paid staff must not inflate account progression) and NOT to the 15% stat-gain chance (single-lever design; a stat-chance interaction is a considered-and-rejected alternative, revisitable post-beta). The training response payload must surface the trainer contribution (`trainerModifier: { bonusPercent, penaltyPercent, net }`) so the UI can show the effect even in sessions where rounding absorbs the point delta.

Module placement per the issue: `computeTrainerModifiers` lives in `backend/modules/trainers/services/`, exported through `backend/modules/trainers/index.mjs`; `trainingController` imports it through the barrel only.

### 2.2 Worked examples (base gain 5, no trait modifiers, for clarity)

| Scenario                                                           | bonus                                         | penalty    | net                                  | gain vs no-trainer                                                                                                                                   |
| ------------------------------------------------------------------ | --------------------------------------------- | ---------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expert L6 Dressage-specialist `patient` + Stubborn horse, Dressage | 0.10+0.025+0.05+0.04 = 0.215 → **0.20 (cap)** | 0          | +20%                                 | 5·0.90·1.20 = 5.4 → **5** vs 5·0.90 = 4.5 → **5** (per-session delta absorbed by rounding; lifetime delta ≈ +13 points over 18 sessions — see below) |
| Developing L3 matched, neutral compat + Calm horse                 | 0.05+0.01+0.05 = 0.11                         | 0          | +11%                                 | 5·1.10·1.11 = 6.1 → **6** vs 5·1.10 = 5.5 → **6** … at trait-modified bases the +1 lands ~half of sessions                                           |
| Novice L1, wrong discipline, `competitive` + Nervous horse         | 0.02                                          | 0.04       | **−2%**                              | 5·0.95·0.98 = 4.66 → **5** vs 4.75 → **5**; at higher bases the mismatch costs real points — a bad hire is worse than no hire                        |
| Retired trainer (defensive path)                                   | any                                           | 0.08 (cap) | ≤ −8% + no bonus retention above cap | never better than unstaffed                                                                                                                          |

**Honest magnitude statement (put this in the PRD-06 §3 rewrite):** with a base gain of 5, a single session's trainer delta is 0–1 points after rounding. The trainer's real product is the _lifetime_ delta: an expert matched trainer adds ≈ +13–18 discipline points over a horse's ~18-session career (≈ +15–20%), which §1 converts 1:1 into competition points. The UI claim "trainers boost training session effectiveness" becomes true, but the surface where the player _sees_ it is the response payload percentage and the lifetime curve, not every single +5 becoming +6.

### 2.3 Degenerate-strategy analysis

- **"Hire one expert per discipline":** capped by the trainer roster (§3: 1–5 trainers by stable level) — a min-maxer cannot cover 23 disciplines; they must specialize their stable around 2–5 disciplines, which is exactly the strategic pressure we want staff to create.
- **"Trainer + best temperament stacking":** max stack is ×1.20 (cap). Temperament (+10% Calm/Steady) and traits (+30% trainabilityBoost) still outweigh it — breeding remains the primary lever, staff the secondary. The cap is below the combined trait+temperament ceiling by design.
- **"Ignore compat, buy skill":** compat is ±4% against skill's 2–10% — a personality conflict roughly cancels one skill tier. Enough to make matching matter at the margin, not enough to make the matrix a hard gate on hiring.
- **"One trainer, whole stable":** nothing prevents assigning one trainer to many horses (multi-horse assignment is the existing contract; only `@@unique([trainerId, horseId, isActive])` per pair). Trainer XP then accrues fast (§ riderTrainerProgressionService), pushing the trainer to L10 (+4.5%). That is acceptable: it is time-gated by each horse's weekly cooldown, and the level contribution is the smallest term.

### 2.4 Sensitivity notes

Tunable (cheap): all SKILL_BONUS values, per-level 0.005, match bonus 0.05, every matrix cell, both caps. Structural: the `{bonusPercent, penaltyPercent}` shape, barrel-only import, compat validated against canonical sets before lookup, composition order traits→temperament→trainer with single terminal round, trainer-does-not-touch-XP/stat-chance, no-trainer path returning exactly `{0,0}`.

### 2.5 Test matrix (write first, real DB; fail-first per the issue)

| #                                               | Arrange                                                                                                          | Assert                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| T1 (two-arm, the issue's mandated failing test) | Horse+expert matched trainer w/ assignment vs identical control horse w/o trainer; drive the real train endpoint | trained-with-trainer gain > control gain (fails today: identical)          |
| T2 (mismatch arm)                               | `competitive` trainer + Nervous horse vs no trainer                                                              | gain ≤ control (penalty path live)                                         |
| T3 (composition pin)                            | Horse with trait mod +25%, temperament Calm (+10%), trainer +20%                                                 | gain == max(1, round(5·1.25·1.10·1.20)) == 8 — pins order AND single-round |
| T4 (cap sentinel)                               | Expert L10 matched `patient`+Stubborn (raw 0.235)                                                                | applied net == +20% exactly                                                |
| T5 (canonical-set guard)                        | Trainer personality "competetive" (typo) / temperament "nervouss"                                                | modifiers {0,0}; no bonus leak                                             |
| T6 (retired defensive)                          | Retired trainer with active assignment (until oey96.24 guards assign)                                            | penalty == cap; never net-positive                                         |
| T7 (control invariance)                         | Re-run T1 control arm before/after change                                                                        | no-trainer gain byte-identical (no-trainer path untouched)                 |
| T8 (payload honesty)                            | T1 response body                                                                                                 | `trainerModifier.{bonusPercent,penaltyPercent}` present and correct        |
| T9 (user XP unchanged)                          | T1 both arms                                                                                                     | `xpAwarded` identical across arms                                          |

---

## §3. Rider/trainer roster-cap scaling curve

**Issue:** Equoria-oey96.8. **Decision already recorded:** cap scales by **stable level**, not flat. Remaining gate (this section): the curve, and where "stable level" comes from — no `stableLevel` column exists.

### 3.1 The stable-level source (the schema question, answered without a schema change)

Candidates found in the tree:

1. **Derive from `User.level`** _(recommended)_ — live, monotonic (XP never decreases), already loaded on every hire path, zero schema change.
2. `Facility.level` — the model exists in schema.prisma with `level Int @default(1)` and type `'basic_stable'`, but it is **dead**: zero backend reads/writes outside a fixture-purge script. Resurrecting it means building a purchase/upgrade flow first — real scope, not a cap fix.
3. New `User.stableLevel` column + paid upgrade flow — the best long-term economy sink, but a schema migration + shop feature that should not block closing an "unlimited staff via API" exploit.

**Recommendation: (1) now, (3) as the post-beta upgrade path.** When a purchasable stable upgrade ships later, `getStableLevel()` switches source behind the same function signature and the caps below don't move. (This satisfies the issue's requirement to "name a real source or flag the schema need": the real source is `User.level`; the schema need is explicitly deferred, not hidden.)

```
// single source of truth, exported from the users module barrel
getStableLevel(user) = clamp(ceil(user.level / 4), 1, 5)
```

| User level       | 1–4 | 5–8 | 9–12 | 13–16 | 17+ |
| ---------------- | --- | --- | ---- | ----- | --- |
| **Stable level** | 1   | 2   | 3    | 4     | 5   |

### 3.2 The caps

```
// backend/modules/riders/config/riderConfig.mjs   (exported via riders barrel)
RIDER_ROSTER_CAP_BY_STABLE_LEVEL   = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }
// backend/modules/trainers/config/trainerConfig.mjs (exported via trainers barrel)
TRAINER_ROSTER_CAP_BY_STABLE_LEVEL = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }
```

- The rider map **adopts the existing (orphaned) frontend map** `SLOT_CAP_BY_STABLE_LEVEL` in `frontend/src/types/riderCareer.ts:75` — it finally gets its consumer, and the display constant and the enforced constant are reconciled rather than parallel. The frontend file gains a comment naming the backend config as canonical.
- Trainers run one below riders at every level: every horse can carry a rider _and_ a trainer, but trainers multi-assign across horses (§2.3) while riders are the per-entry competition surface — riders need slightly more room.
- Only **non-retired** staff count (`where: { userId, retired: false }` — PRD FR-\*-7, and the issue's retired-heavy-user test arm).
- Grooms are untouched: flat `MAX_GROOMS_PER_USER = 10` in `backend/config/groomConfig.mjs` stays as-is (deliberately out of scope for oey96.8).

**Pacing (with §4's ratified XP curve, level = floor(xp/100)+1):** stable level 2 arrives at 400 XP, SL3 at 800, SL4 at 1200, SL5 at 1600. An active player (5 horses training weekly ≈ 25 XP + a few show placements ≈ 40–80 XP/week) reaches SL2 in ~1–2 weeks, SL5 in ~3–5 months — a real progression arc across a beta, with the band width (`4`) as the single pacing knob.

**Enforcement (already decided on the issue — restated, not re-decided):** copy the landed n4m5j/hduc5 groom pattern — module-owned config + shared `CapExceededError` + fast-path pre-check + **authoritative post-lock in-tx re-count** after `debitMoneyOrThrow` row-locks the User row, throw → 400, transaction rolls back debit + staff row + ledger. Two concurrent hires at cap−1 → exactly one succeeds.

**Grandfathering rule:** the cap is enforced at **hire time only**. If a player's stable level implies a lower cap than their current roster (only possible if the curve is later tuned down — `User.level` itself never decreases), existing staff are untouched; the player simply cannot hire until attrition brings them under the cap. No forced retirement, ever.

### 3.3 Degenerate-strategy analysis

- **"Level past the cap":** the cap curve is the _reward_ for account progression — that's the decided design. The XP required is time-gated by training cooldowns and show cadence; there is no purchasable XP.
- **"Retire-churn":** retiring staff frees a slot at the cost of the sunk hire fee and the staff member's accumulated level/prestige (retired staff never return). Churn is allowed but self-punishing.
- **"Hoard at SL5":** 6 riders + 5 trainers is the endgame ceiling — enough to specialize a large stable, small enough that weekly rider salaries (`weeklyRate`, default 200) and session costs stay a real sink.
- **"Race the counter":** closed by the in-tx re-count (the exact TOCTOU the issue's concurrent-hire test arm proves).

### 3.4 Sensitivity notes

Tunable: both cap maps' values, the band width 4, the SL clamp ceiling 5. Structural: derivation via a single exported `getStableLevel()` (never inline `ceil(level/4)` at call sites — that's how display and enforcement drift), count-in-tx enforcement, non-retired-only counting, hire-time-only enforcement, module-owned config files exported via barrels (PRD names the basenames `riderConfig.mjs` / `trainerConfig.mjs`).

### 3.5 Test matrix (write first, real DB; fail-first)

| #   | Arrange                                                                      | Assert                                                                                    |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| T1  | User level 1 (SL1) with 2 non-retired riders; marketplace hire via supertest | 400; no debit, no rider row, no ledger row (atomicity trio) — fails today (hire succeeds) |
| T2  | Same for trainers at cap 1                                                   | 400 + atomicity trio                                                                      |
| T3  | User level 5 (SL2) with 2 riders                                             | hire succeeds (cap now 3) — proves scaling, not just blocking                             |
| T4  | User at cap with 3 additional retired riders                                 | hire succeeds (retired don't count)                                                       |
| T5  | Two concurrent hires at cap−1 (Promise.all)                                  | exactly one 200, one 400; roster == cap; money conserved                                  |
| T6  | Boundary users at levels 4 and 5                                             | SL 1 vs 2 (ceil boundary pinned)                                                          |
| T7  | `getStableLevel` unit boundaries: level 1, 4, 5, 16, 17, 999                 | 1, 1, 2, 4, 5, 5                                                                          |
| T8  | Sentinel-positive: planted cap-bypass (hire path skipping the re-count)      | concurrency test T5 fails                                                                 |

---

## §4. User XP / level curve

**Issue:** Equoria-smqn7. The Day-5 note is right that the original ":222 while-loop" evidence is stale — re-derived against the landed jvi3u code:

- **Code today** (`userModelService.mjs:38-40`): `levelForXp(xp) = max(1, floor(xp/100))` → level 1 spans **0–199**, level N spans [100N, 100N+99]. Level 2 at 200 XP.
- **PRD-02 §1.2 + PRD-03 §5.2 (agreeing):** `level = floor(xp/100) + 1` → level 1 spans **0–99**, level N spans [100(N−1), 100(N−1)+99]. Level 2 at 100 XP.

Precisely characterized: this is **not** a 2× rate difference — both curves cost 100 XP per level in steady state. The code curve is the PRD curve **minus one level everywhere past 99 XP** (a doubled first level, then a constant one-level lag).

### 4.1 The two options, with pacing tradeoffs (the decision the issue asks to present)

|                             | **(A) PRD curve — recommended** `level = floor(xp/100)+1`                                                                 | (B) Ratify code curve `level = max(1, floor(xp/100))`   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| First level-up              | 100 XP ≈ first 1–2 active days (20 training sessions, or 5 podiums, or a mix)                                             | 200 XP ≈ double the wait for the first progression beat |
| Steady state                | identical (100 XP/level)                                                                                                  | identical                                               |
| Doc alignment               | matches PRD-02 §1.2, PRD-03 §5.2, and the `userController.mjs` comment                                                    | requires amending two PRDs + comment                    |
| Migration                   | one-time backfill `UPDATE users SET level = FLOOR(xp/100)+1` — **strictly non-decreasing** (no player ever loses a level) | none                                                    |
| Roster-cap interaction (§3) | SL bands land at 400/800/1200/1600 XP                                                                                     | everything shifts +100 XP; SL2 at 500                   |

**Recommendation: (A).** The first level-up is the game's first progression payoff; halving its arrival time is worth more to beta retention than the one-line diff costs, three documentation sources already promise it, and the migration can only move players _up_. (B)'s only advantage is zero migration.

### 4.2 Exact math (option A, canonical)

```
levelForXp(xp)      = floor(xp / 100) + 1          // xp ≥ 0; level 1 = 0–99
xpFloorOfLevel(n)   = (n − 1) · 100
xpToNextLevel(xp)   = 100 − (xp mod 100)
progressPercent(xp) = xp mod 100                    // conveniently already 0–99
```

No level cap for beta (today's code has none). **Single source of truth is mandatory** (the issue's AC): `levelForXp` (and the display helpers above) are exported from `userModelService.mjs` and consumed by (a) the atomic award path in `addXpToUserCore`, (b) `userController.getUserProgressAPI` — whose current display math is _internally_ wrong on both curves (`xpForCurrentLevel = level*100`, `xpNeededForLevel = level===1 ? 200 : 100`) and gets replaced by the helpers, and (c) the one-time backfill. The `xpThreshold()` helper is deleted or reduced to an alias so no second curve can drift.

Award values are **out of scope** here (they are oey96.4's decision surface); the curve must stay award-agnostic. For pacing intuition only: training +5/session/horse-week, competition +20/15/10, breeding +15 → an active 5-horse player earns ≈ 40–80 XP/week → ≈ 1 level every 1.5–2.5 weeks after the early ramp.

### 4.3 Degenerate-strategy analysis

Linear 100/level with no cap means account level grows unboundedly ≈ linearly with playtime — acceptable because level gates only the §3 roster curve (clamped at SL5 = level 17) and the stable-limit display formula; nothing unbounded compounds off level. XP farming routes (mass training) are time-gated by per-horse weekly cooldowns — buying more horses buys XP throughput linearly and costs money, which is the intended tradeoff, not an exploit. If level later gates rewards with real economic value, revisit a soft-cap curve then (post-beta consideration; the groom/rider quadratic `100·N` curve is the in-house precedent).

### 4.4 Sensitivity notes

Tunable: XP-per-level (100), a future level cap, award values (elsewhere). Structural: closed-form level derivation from cumulative XP (this is what makes jvi3u's atomic increments concurrency-correct — **never** reintroduce a stored-level-increment loop), single exported source of truth for curve + display, monotonicity (XP never decreases; levels never revoked).

### 4.5 Test matrix (write first; boundary-driven per the issue)

| #   | Arrange (real DB award through the live path)                 | Assert                                                                                                      |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| T1  | xp 0 → award 99                                               | level 1, leveledUp false                                                                                    |
| T2  | xp 99 → award 1                                               | level 2, leveledUp true, levelsGained 1                                                                     |
| T3  | xp 100..199                                                   | level 2 throughout; xpToNextLevel(150) == 50                                                                |
| T4  | xp 199 → award 1                                              | level 3                                                                                                     |
| T5  | award 250 in one call from 0                                  | level 3, levelsGained 2 (multi-level single award)                                                          |
| T6  | display endpoint at xp 0 / 99 / 100 / 250                     | progressPercent 0 / 99 / 0 / 50; xpToNextLevel 100 / 1 / 100 / 50 (kills the `level===1 ? 200` display bug) |
| T7  | Backfill dry-run over seeded fixture users at xp 0/99/100/500 | levels 1/1/2/6; no fixture's level decreases                                                                |
| T8  | Concurrent awards (Promise.all ×10 of +10 XP)                 | final xp 100, level exactly 2 (curve holds under the atomic path)                                           |

---

## §5. Horse age-cap policy

**Issues:** Equoria-2nacc (canonical caps + both competition paths), coordinating with Equoria-cpu7v (D7 stallion max age — **user-owned; this spec proposes, cpu7v ratifies**) and Equoria-oey96.15 (training gate implementation home).

### 5.1 The 20-vs-21 reconciliation

The apparent conflict dissolves as a fencepost reading: **"retires at 21" means age 20 is the last active year.** Every primary source is consistent with that reading except one code path:

| Source                                      | Says                                                                      | Canonical reading                                       |
| ------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| PRD-03 §1.1 (training)                      | max 20                                                                    | active through 20 ✔                                     |
| PRD-03 §2.1 (competition)                   | "Maximum age: 21 years (retirement)"                                      | _retires at_ 21 → last competes at 20                   |
| `isHorseEligible.mjs:23`                    | `age > 20` → ineligible                                                   | active through 20 ✔                                     |
| stud spec §5 + boundary table               | `MAX_MARE_BREEDING_AGE_YEARS = 20`; "age exactly 20 eligible, 21 overage" | active through 20 ✔                                     |
| PRD-08 §2.5                                 | "3–21 years for both"                                                     | the outlier doc — **correct to "3–20 (retires at 21)"** |
| `competitionLogic.mjs#checkAgeRequirements` | `>= 3 && <= 21`                                                           | the outlier code — **align to `<= 20`**                 |

### 5.2 Canonical policy

One shared constants module — `backend/constants/horseAgePolicy.mjs` (sibling of the existing `constants/schema.mjs`; cross-cutting across training/competition/breeding, so module-local config would force barrel gymnastics for no ownership gain):

```
MIN_ACTIVE_AGE_YEARS  = 3     // training, competition, breeding all begin
MAX_ACTIVE_AGE_YEARS  = 20    // last year of ALL activity (inclusive)
RETIREMENT_AGE_YEARS  = 21    // display/UX label: the age a horse "retires at"
```

| Activity            | Rule (game years, inclusive)                       | Enforcement point                                                                                                                                            |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Training            | 3 ≤ age ≤ 20                                       | `canTrain` (implementation home: **oey96.15**)                                                                                                               |
| Competition entry   | 3 ≤ age ≤ 20 on **both** paths                     | canonical async `enterShow` path (adds the missing max) + `isHorseEligible` (already right) + `checkAgeRequirements` (21→20)                                 |
| Breeding — mare     | 3 ≤ age ≤ 20                                       | shared stud eligibility validator (`MAX_MARE_BREEDING_AGE_YEARS` re-exported from the policy module); `createFoal` leg lands with the cr03/3sfys unification |
| Breeding — stallion | **proposed 3 ≤ age ≤ 20** — same cap, for symmetry | shared validator; **ratification belongs to cpu7v (D7)** — do not implement the stallion max until the user decides there                                    |

All age reads go through `getHorseAgeYears` / `backend/utils/horseAge.mjs` (Equoria-vdw5) — never inline date math; date-only UTC semantics make every boundary test deterministic.

**D7 proposal rationale (for cpu7v):** with 7 real days = 1 game year, an uncapped stallion is permanent: ~5 real months in, top stallions become immortal stud-fee annuities that never leave the market, and the breeding meta ossifies around a fixed elite set. Capping stallions at 20 like mares keeps generational churn — the game's core loop is _breeding the next horse_, which requires the previous generation to actually exit. Alternatives if the user wants asymmetry: stallions to 25 (softer churn, still bounded), or uncapped (maximum player attachment, accepting the annuity meta). Recommended: 20.

### 5.3 Balance rationale and the training interlock

Active career = ages 3–20 inclusive = 18 game years = **18 real weeks** (7-day game-year clock) ≈ 18 lifetime training sessions under the 7-day global cooldown. This is the bound that keeps §1's _uncapped, additive_ training score at ≈ 90–145 lifetime — the age cap is not just lifecycle flavor, it is **the load-bearing clamp on competition-score inflation**. Tuning `MAX_ACTIVE_AGE_YEARS` re-tunes §1: +1 year of cap ≈ +5–8 max training points ≈ +5–8 competition points for dedicated horses. Any future change to this constant must re-run §1.4's worked examples.

### 5.4 Degenerate-strategy analysis

- **"Immortal champion":** closed — the 20-cap ends every horse's competitive and (pending cpu7v) breeding career on the same clock; dynasty-building routes through breeding, which is the designed loop.
- **"Race the clock" (breed at 20, foal ages out of value):** a foal born to a 20-year-old parent is a normal foal; parent age has no offspring penalty. No trap.
- **"Enter at 2.9 / train at 20.9":** date-only UTC arithmetic makes the boundary a whole-day flip; ages are integers in game-years. Eligible-at-exactly-20, ineligible-at-21 is the tested contract.
- **"Path-shop the missing max":** today's actual exploit — the async `enterShow` path has no max, so an aged-out horse can still enter regular shows while being rejected from the instant path. Closing the inconsistency IS the fix.

### 5.5 Sensitivity notes

Tunable: `MAX_ACTIVE_AGE_YEARS` (with the §1 re-balance obligation above), the stallion cap independently _if_ cpu7v ratifies asymmetry. Structural: one constants module consumed by every gate (no per-path literals — that is how 20-vs-21 drift happened), min-3 (already uniformly enforced), inclusive-max semantics ("retires AT 21"), `getHorseAgeYears`-only age reads.

### 5.6 Test matrix (write first, real DB; boundary tests per the issue)

| #   | Arrange (fixture horses with dateOfBirth set for exact game-ages) | Assert                                                                                               |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| T1  | Ages 2 / 3 / 20 / 21 vs training gate                             | ineligible / eligible / eligible / ineligible (T-21 arm fails today: no max)                         |
| T2  | Same four ages vs canonical `enterShow` HTTP path                 | 400 / entered / entered / 400 (age-21 arm fails today)                                               |
| T3  | Same vs instant-path eligibility (`isHorseEligibleForShow`)       | identical verdicts to T2 — **path-consistency sentinel**                                             |
| T4  | `checkAgeRequirements` at 21                                      | false (fails today: `<= 21`)                                                                         |
| T5  | Mare age exactly 20 / 21 vs stud validator                        | eligible / `MARE_OVERAGE` (already per stud spec — regression pin)                                   |
| T6  | Stallion age 21 vs stud validator                                 | **only after cpu7v ratifies** — until then, absence of a stallion max is the pinned current behavior |
| T7  | Grep-sentinel                                                     | no inline `age > 2[01]` literals outside `horseAgePolicy.mjs` consumers (adjacent-locations lock)    |
| T8  | PRD-08 §2.5 + PRD-03 §2.1 text                                    | amended in the same commit as the code legs they describe                                            |

---

## §6. Cross-formula interactions (read before implementing any one section)

1. **§5 bounds §1:** the age cap × weekly training cooldown is the only thing bounding the uncapped additive training score. These two constants co-tune; neither spec may be re-tuned in isolation.
2. **§4 feeds §3:** roster caps derive from `User.level`, so the XP-curve choice moves every stable-level breakpoint (400/800/1200/1600 XP under option A). If the user picks option B in §4, §3's pacing table shifts +100 XP but the curve itself stands.
3. **§2 feeds §1:** the trainer modifier raises discipline-score gain, which §1 converts 1:1 into competition points via the additive `Tr` term. The +20% trainer cap therefore implies ≈ +18 max competition points over a horse's lifetime — already reflected in §1.5's max-training bound.
4. **§1 depends on oey96.4** (show XP awards) only operationally — the scorer swap and the XP awards are separate commits in the same serial showController lane (Round-1/Round-2 lane ordering: .4 lands before .11).
5. **Shared enforcement patterns:** §3 copies n4m5j/hduc5 (count-in-tx); §1 keeps koodu/si69u (claim-then-process, escrow); §5 uses vdw5 (date-only UTC age). No new concurrency patterns are introduced by this spec.

## §7. What this spec deliberately does NOT decide

- **oey96.4's XP award table** (show XP/stat-gain values) — separate issue, same lane.
- **cpu7v's two decisions** (crossbreed ruleset; D7 stallion cap) — §5.2 provides the recommended stallion default; the decision stays with the user on cpu7v.
- **Groom roster caps** — flat 10 stands.
- **Award-value rebalancing** (training +5 XP, competition 20/15/10) — the §4 curve is award-agnostic.
- **A future stable-upgrade purchase flow** — §3.1 names it as the post-beta path behind the stable `getStableLevel()` seam.
