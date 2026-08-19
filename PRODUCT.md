# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are simulation and strategy players (the PRD's stated audience is roughly 13–45) who want a horse-breeding game with real mechanical depth rather than a light collection or idle game. Three confirmed player shapes, from `docs/product/PRD-00-Brief.md` and `PRD-01-Overview.md`:

- **Strategic Breeder** — optimizes pairings and plans across multiple generations. The genetics system is the reason they are here.
- **Competitive Player** — trains, enters shows, and reads leaderboards. Progress is measured against other players.
- **Collector / Builder** — curates rare traits, grooms, and stable prestige. Progress is measured against their own collection.

The usage situation is a returning session, not a first visit: a player checks what changed since they last logged in (aging, training cooldowns, show results, payroll), then spends their available actions. Sessions are intended to run 15+ minutes, several times a week.

**Near-term audience is closed beta testers, not the public.** Per `CLAUDE.md`, beta deployment is gated on Epic 21R and every beta-live feature must be exercisable through real UI against a real backend. Design work should assume an unforgiving evaluator who will report anything broken, not a forgiving first-time visitor.

**Both phone and desktop are first-class** (user-confirmed 2026-08-13, resolving the contradiction between `PRD-00-Brief.md` "Mobile out-of-scope" and `docs/ux-spec-sections/13-responsive-accessibility.md`). Neither is the secondary case. A surface that only works well on desktop is incomplete. This is mobile _web_ — there is no native client.

## Product Purpose

Equoria is a browser-based horse breeding, training, and competition simulation. Players own and run a stable: they breed horses using a multi-locus genetics model, discover epigenetic traits that emerge from how a horse was raised, train toward disciplines under real cooldowns, hire staff (grooms, riders, trainers), enter shows, and reinvest winnings.

The core loop is **breed → raise → train → compete → reinvest**, played over game-years rather than minutes. Success for a player is a bloodline that wins — an outcome they can attribute to decisions they made several generations ago.

Success for the product is that depth stays legible: a player can always tell what changed, why a horse performed the way it did, and what their next best action is.

## Positioning

The differentiator is **genetics that actually compute**, not genetics as flavor text. Offspring outcomes come from per-locus Punnett-square probability across real loci, with lethal-combination filtering and renormalization (`backend/modules/horses/services/breedingColorPredictionService.mjs`). Epigenetic traits are discovered progressively based on how the foal was raised, not rolled at birth.

Neighboring horse games can copy the loop; they cannot truthfully claim the inheritance model, the trait-discovery system, or the multi-generation planning payoff those two produce together.

Second, less visible claim: time is honest. Aging, cooldowns, payroll, and show execution run on server-side UTC cron, not on client clocks, so nothing in the game can be rushed by manipulating a device.

## Operating Context

- **Time is the core constraint.** 7 real UTC days = 1 game year. Horses age on their birth weekday (daily aging cron, 00:05 UTC). Training carries a global 7-day cooldown — one discipline per horse per week. Breeding carries a one-game-year cooldown per dam. This means the game is _checked into_, not binged: a session is mostly evaluating state and committing a small number of irreversible decisions.
- **Returning-player ritual.** The session opens with "what happened while I was gone" — aging, completed training, show results, staff payroll, care status. This is the highest-traffic moment in the product.
- **Horses are the documents.** A horse detail view is the reference material a player reasons over: lineage, genotype/phenotype, discovered traits, discipline scores, care state, competition history.
- **Staff are recurring cost, not decoration.** Grooms, riders, and trainers are hired, assigned, and paid on a weekly payroll cycle. Care quality feeds trait discovery and performance.
- **Age windows gate everything.** Horses are competitively active 3–20 (inclusive) and retire at 21. A player's roster is always mid-turnover.
- **Surfaces in production today:** World Hub, My Stable, Horse/Foal detail, Breeding, Training, Competition browser and results, Conformation Shows, Leaderboards, Grooms/Riders/Trainers, Marketplace hub and horse marketplace, Tack/Feed shops, Farrier, Veterinarian, Crafting, Inventory, Bank, Clubs, Message board and DMs, Profile, Settings, Onboarding, auth flows.

## Capabilities and Constraints

**Built and wired to live API:** breeding and genetics, epigenetic trait discovery, training, competition and conformation shows, groom/rider/trainer management, marketplace and horse trading, economy (bank, transactions, prize payouts, payroll), community (forums, DMs, clubs), leaderboards, inventory and crafting, admin surfaces.

**Technical constraints that shape design:**

- React 19 + TypeScript + Vite + Tailwind on the frontend; TanStack Query owns fetching; `sonner` owns toasts; Radix primitives underpin the shared components; Recharts and Chart.js are both present for data display.
- Express + Prisma + PostgreSQL backend, versioned at `/api/v1`; 52 Prisma models. Deployment target is Railway (Docker multi-stage).
- **Honest async state is a hard rule, not a preference.** `.claude/rules/FRONTEND_ASYNC_STATE_DOCTRINE.md` mandates four states — loading / error / empty / success — with empty reachable only through success, retry wired to `refetch`, and no fabricated placeholder values. Any new surface inherits this contract.
- No mocked primary paths, no bypass headers, no placeholder data on beta-live surfaces (`CLAUDE.md` Constitution §2/§3).
- File-size doctrine ratchet: source files ≤600 lines, test files ≤800, shrink-only baseline.

**Terminology (use these words, they are the product's vocabulary):** stable, foal, dam, sire, lineage, genotype/phenotype, locus, epigenetic trait, trait discovery, discipline, cooldown, groom, rider, trainer, payroll, show, conformation show, entry fee, prize, care status, world hub, club.

**Premium features are in scope now** (user-confirmed 2026-08-13, overriding the "no payments in Equoria" line in `CLAUDE.md`'s MCP guidance). Design work may account for tier gating, upsell surfaces, and purchase flows. **Open and undecided:** there is no payment infrastructure, no subscription or entitlement model in the Prisma schema, and no published price points. Do not invent tiers, prices, or entitlement names — those are product decisions still to be made. All existing in-game currency is gameplay-only and unrelated.

## Brand Commitments

- **Name and wordmark:** Equoria.
- **"Celestial Night" is binding** (user-confirmed 2026-08-13), and its creative north star is **"The Enchanted Equestrian Night"** (`DESIGN.md`, the binding visual authority at the repo root): a beautiful horse world after dusk — near-black navy under real per-scene artwork, frosted-glass surfaces, lantern-gold accents rationed by meaning, and storybook wonder, warmth, and whimsy as product requirements. It is explicitly _not_ generic dark-mode SaaS, card-grid dashboard composition, or medieval-fantasy costume. Future work refines within this world; it is not a candidate for replacement. The "Celestial Night visual rebuild" named in `PRD-00-Brief.md` is a completion effort inside this identity, not a search for a different one.
- **Typefaces are committed by semantic role** (`DESIGN.md` Typography): Dragon Tales for the EQUORIA wordmark only; Basteleur Bold for major ceremonial and location-arrival titles and Basteleur Moonlight for horse/entity names and important section headings (two distinct families, never synthesized from one another); Whisperleaf for short opt-in enchanted accents; Proda Sans for all functional UI and body copy; Artavion Mono for genotype, registry, and ledger records. Dragon Tales, Proda Sans, and Artavion Mono are self-hosted and live today (`frontend/public/fonts`, `src/styles/fonts.css`); the Basteleur pair and Whisperleaf are committed direction still being wired in. The earlier Cinzel/Inter set is retired (Cinzel survives only as a fallback stack entry).
- **Existing design-system decisions are authoritative** and should not be relitigated per surface: `DESIGN.md` (creative direction, named rules, palette, typography roles, composition stance — cards are one tool, not the default layout primitive), `docs/design-system/DECISIONS.md` (container widths, three header families plus the allow-listed PageHero, radius scale, surface/blur policy, one gold primary action per surface, canonical tabs), `TOKENS.md`, `MOTION.md`, `EXCEPTIONS.md`.
- **Blur budget:** at most one active `backdrop-filter: blur()` layer visible at a time. It belongs to `Surface(panel|overlay)` and layout chrome, never page-local utilities.

## Evidence on Hand

**Real assets that exist and should be used rather than replaced with placeholders:**

- Location artwork: `frontend/public/images/` — `veterinarian.webp`, `equinehospital.webp`, `farriershop.webp`, `feedstore.webp`, `feedstore2.webp`, `tackstore.webp`, `tackstoreclerk.webp`, `bg-stable.webp`, `bg-horse-detail.webp`, plus a full aspect-ratio background set (`bg-1.1` through `bg-21.9`).
- Brand/auth imagery: `frontend/public/equoriacelestial.png`, `equorialogin.png`.
- Horse, breed, feed, and tack image sets under `public/images/` and `public/assets/`.
- Self-hosted webfonts (above).
- Reference data: `breeds.csv`, `docs/BreedData/`.

**Absences that future work must not fabricate:**

- **No real players, testimonials, reviews, press, or case studies.** The product has not launched; beta is still gated.
- **The numbers in `PRD-01-Overview.md` are targets, not measurements** — "100K downloads," "$2.50 ARPU," "40% D7 retention," "3651+ tests." Never present a target as an achieved result on any surface.
- **No pricing, no payment provider, no entitlement model** (see Capabilities).
- **No mobile app.** Do not imply an app store presence.
- `horse-placeholder.png` and `placeholder.svg` exist as honest fallbacks; a missing image renders a fallback, never invented content.

## Product Principles

1. **The system must be legible, not just deep.** A player should be able to trace any outcome — a foal's color, a show placing, a payroll charge — back to a decision or a rule. Depth that cannot be inspected reads as randomness.
2. **Honest state over reassuring state.** Loading is not zero, error is not empty, unknown is an em dash. A surface that lies about the system's condition is worse than a surface that shows the problem.
3. **Respect irreversibility.** Cooldowns, breeding, retirement, and money moves cannot be undone. Any surface committing one of these owes the player a clear picture of the cost before they commit and a clear receipt after.
4. **The returning session is the product.** Optimize for the player who left three days ago and wants to know what changed and what to do next — not for a first-time visitor's tour.
5. **Both screens, one product.** Phone and desktop are the same game with the same capability. Neither is a stripped-down courtesy version.

## Accessibility & Inclusion

- **Target standard: WCAG 2.1 AA** (referenced throughout `docs/epics.md`).
- Loading regions announce (`role="status"` / `aria-live="polite"`, `aria-busy` on in-place refresh); errors announce (`role="alert"`) and take focus at section and page level.
- **Never signal by color alone** — every error and empty state pairs color with an icon and text. This matters more than usual here: the game's own content is color-coded (coat genetics, care status, trait rarity).
- Motion respects `prefers-reduced-motion` per `docs/design-system/MOTION.md`.
- Tooling in place: `eslint-plugin-jsx-a11y`, `@storybook/addon-a11y`. These are floors, not proof.
- Touch targets: 44px minimum, already codified in the `IconButton` decision (`DECISIONS.md` §5).
