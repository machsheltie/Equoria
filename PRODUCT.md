# Product

<!-- impeccable:product-schema 1 -->

## Product Contract

Equoria is a **magical browser-based horse simulation for horsewomen who never grew up and never wanted to**. It is a place to inhabit, not a database to administer. The player should feel that she has returned to her horses and her world—not opened business software with horse nouns pasted over it.

This is durable product truth. For any player-facing work, the product identity and experience rules in this file govern before implementation convenience, installed packages, reusable component APIs, generic design-system advice, or an agent's personal taste.

**The core ruling:** every route must have an experiential concept beyond “the standard Equoria page containing this feature's data.” A technically correct screen that feels like a dashboard, admin console, CRM record, commerce backend, or tax SaaS is a product failure.

## Platform

web

## Delivery Context

- Browser-based responsive web game built with React 19, TypeScript, and Vite.
- Phone and desktop are both first-class. Neither is a reduced courtesy version.
- There is no native app and no app-store presence.
- Near-term users are closed-beta testers exercising real UI against the real backend.

## Player and Promise

The creative center is adult horse-girl escapism: collecting, dreaming, breeding, naming, raising, competing, decorating, discovering, and becoming emotionally attached to horses across generations. The game welcomes other players, but it does not dilute this point of view to resemble a neutral productivity product.

Three player motivations coexist:

- **Strategic Breeder** — plans pairings across generations; genetics is the reason she is here.
- **Competitive Player** — trains, enters shows, and builds a winning legacy.
- **Collector / Builder** — curates rare traits, beloved horses, staff, and stable prestige.

The player promise is **a bloodline with a story that she can trace back to her choices**. The interface must keep mechanical depth legible without making the horse feel like a row in a database.

## World and Emotional Target

“Celestial Night” and the creative north star **“The Enchanted Equestrian Night”** are binding. Equoria is a beautiful horse world after dusk: moonlit barns, warm shop windows, mountain valleys, horse constellations, luminous plants, lantern light, painterly scenery, and small touches of wonder in recognizable equestrian life.

Required emotional qualities:

- **Wonder** — selective discoveries, reveals, and quiet surprises.
- **Beauty** — deliberately art-directed composition that rewards looking.
- **Warmth** — inviting, humane, and emotionally alive despite the night palette.
- **Whimsy** — sophisticated horse-girl delight, never corporate neutrality.
- **Specificity** — breeding feels like breeding; the arena feels like an arena; the stable feels inhabited.
- **Attachment** — horses are companions, characters, and family lines before they are stat containers.

Equoria is not medieval fantasy, a fantasy RPG, a historical reenactment, a luxury equestrian brand, or a children's toy. “Not an RPG” does not mean “not magical.” “For adults” does not mean sterile, minimal, or joyless.

## Core Simulation

Equoria is a horse breeding, raising, training, staffing, competition, and stable-management simulation. Players breed with a multi-locus genetics model, discover epigenetic traits through care, train under real cooldowns, hire grooms/riders/trainers, enter shows, trade, and reinvest winnings.

The core loop is **breed → raise → train → compete → reinvest**, played over game-years rather than minutes.

- 7 real UTC days = 1 game year.
- Training has a global 7-day cooldown: one discipline per horse per week.
- Breeding has a one-game-year cooldown per dam.
- Horses compete from ages 3–20 and retire at 21.
- Server-side UTC jobs govern aging, cooldowns, payroll, and shows; device clocks do not.
- Genetics genuinely computes per-locus outcomes, lethal-combination filtering, and renormalized probabilities.
- Epigenetic traits emerge from how a foal is raised rather than being mere flavor rolled at birth.
- Competition outcomes must reward the horse the player bred and developed: relevant stats, training, traits, tack/care, and staff should matter. Luck may create suspense between near peers; it must not erase earned differences or make breeding and training decorative.

### Economy and show rulings

These are explicit owner decisions, not suggestions inferred from an old balance review. Changing them requires a fresh owner ruling and coordinated source, test, and product-document updates.

- A new account starts with **10,000 gameplay coins**. The weekly Bank claim is **5,000 gameplay coins**.
- Do not invent a system conception fee, horse-market listing fee, sale commission, or stud-fee house cut. A horse's sale cost is the seller's chosen price. Cross-owner breeding uses the player's chosen stud fee when that system is available; breeding horses already owned by the same stable remains free.
- A show creator may enter her own horses. This is intended play, not an abuse condition to “correct.”
- Show brackets use the horse's XP level, `floor(horseXp / 100) + 1`, and are enforced by the server. Do not replace this with a stat-composite level formula without a new owner decision.
- Detailed old proposals about re-pricing, new gates, bound currency, salaries, marketplace expiry, scoring pipelines, or alternate progression curves are not approved merely because they appear in an audit or formula document.

## The Returning-Player Ritual

Equoria is checked into for 15+ minute sessions several times a week. The opening question is not “which module do you want?” It is “what happened to my horses while I was away, and who needs me now?”

Changes such as aging, care, completed training, show results, foaling, trait discovery, and payroll should be presented as events in the player's stable life. Do not turn the arrival experience into a KPI strip, notification center, or right-hand business-intelligence rail.

## Experience Architecture

### World before modules

Stable, Arena, Breeding Hall, marketplace, shops, clinic, farrier, and World are places. Navigation may remain efficient, but it must frame movement through a world rather than expose fourteen flat peer modules in an admin sidebar. Currency, messages, and alerts are discreet game HUD information, not account-management chrome.

### Horses before records

The horse is the visual and emotional subject. Portrait, name, condition, relationship, and current story lead. Lineage, genotype/phenotype, care history, training, and competition records remain available, but completeness of the dossier must not dominate identity.

### Story before summary metrics

Prefer “Moonflower placed second at Halcyon Downs” to “Podiums: 1.” Prefer a lineage, season record, care journal, stable activity, or recent chapter to anonymous KPI tiles. Summary numbers may support a composition; they may not become the composition.

### Context before global surveillance

Surface urgent care, cooldowns, risks, and costs beside the relevant horse or decision. Do not keep every system visible at all times merely because an app shell has room for it.

### Artwork as composition

Environment artwork is not wallpaper beneath generic software. Respect its focal regions and compose content around buildings, paths, paddocks, horses, open sky, warm windows, and safe reading zones. Deliberately open, beautiful space is useful space.

## Structural Anti-SaaS Rules

The dominant SaaS grammar is forbidden as a default:

> persistent admin sidebar → account top bar → generic page header → KPI tiles → peer tabs → filter panel → card grid/table → generic centered modal → utility rail

Changing this grammar to navy and gold does not make it Equoria. Adding horse icons, magical copy, scenic wallpaper, glass, or glow does not rescue it.

- No universal dashboard shell with simultaneous sidebar, sticky account bar, utility rail, footer, and floating actions.
- No route-template monoculture built from `PageHeader + Tabs + Surface/Card grid`.
- No default KPI strips, bento grids, analytics summaries, or one-rounded-rectangle-per-thought composition.
- No database-entity/CRM treatment for horses, staff, clubs, or player identity.
- No interchangeable pages where only the title, icon, and API payload change.
- No generic modal choreography for emotionally important game events.
- No dense filters or account-management controls as the first impression of a place.
- No tiny uppercase labels, status pills, charts, or Lucide icons as the primary source of visual identity.
- Do not cover artwork uniformly with panels. Containment must have a semantic reason.

Reusable primitives are allowed; reusable page sameness is not. A shared accessibility behavior may underpin compositions with very different silhouettes.

## Canonical Experience Directions

These are steering examples, not complete wireframes:

- **Stable / home:** an inhabited arrival with a current companion, recent stable events, and a visual roster or paddock rhythm—not welcome text, action tiles, horse-card grid, and a summary aside.
- **Horse detail:** a horse-led portrait or environmental composition with a few meaningful chapters such as Companion, Career, Bloodline, and Care—not a CRM header, six stat tiles, and thirteen peer tabs.
- **Breeding:** a pairing tableau with mare and stallion in relationship, lineage and predicted inheritance revealed between them, then risk and cost at commitment—not two selector cards plus compatibility tabs and a cost modal.
- **Competition:** an arena program or noticeboard, an entry journey, then a podium/reveal with season records available afterward—not filters, equal event cards, KPI results, and report tabs.
- **Marketplace:** an illustrated catalogue or sales-ring experience that presents horses with portrait scale, provenance, temperament, lineage, and seller voice—not commerce-admin tabs, inventory rows, transaction history, and a purchase dialog on arrival.
- **Hall of Fame / achievements:** a commemorative gallery or ceremony—not another repeated card list.
- **Foal birth, rare traits, championships, and major rewards:** authored, bounded game moments centered on the horse or achievement—not toast pills or an ordinary confirmation dialog.

Do not clone these examples mechanically. Their common lesson is that each feature earns its own experiential metaphor and composition.

## Frontend Dependency Policy

Installed dependencies describe repository history, **not product permission**.

- **React, TypeScript, and Vite:** implementation foundation; they do not dictate appearance.
- **TanStack Query:** approved for server-state fetching and caching; it has no visual authority.
- **Tailwind:** approved as a low-level styling engine using Equoria's tokens. Tailwind defaults, starter layouts, and common dashboard recipes are not approved design direction.
- **shadcn/ui and Radix UI:** rejected as Equoria's component strategy or visual/structural default. Do not add, copy, reinstall, or introduce new imports. Use existing Equoria-owned primitives or appropriate semantic HTML. If complex accessible behavior needs a new dependency or a replacement component, present the options to the user before implementation.
- **`sonner`:** not an approved feedback architecture. Do not use or import it. Routine feedback belongs contextually in the affected workflow or game log; meaningful rewards get authored game moments.
- **Recharts, Chart.js, and `react-chartjs-2`:** not approved for player-facing visualization. Do not use or import them for pedigrees, traits, performance, breeding outcomes, or other game information. Prefer purpose-built HTML, CSS Grid, accessible tables, timelines, ledgers, and inline SVG where the game concept calls for them.
- **Lucide:** utility icon vocabulary only. It may clarify controls but may not carry a page's identity or replace illustration, typography, composition, or game-specific motifs.

The `sonner`, Recharts, Chart.js, and `react-chartjs-2` dependencies and their current consumers are legacy migration inventory/removal candidates, not endorsed architecture. Do not retain or use a package merely because it is installed or already imported elsewhere. Do not replace any rejected library with another premade UI kit or notification/chart package without an explicit user decision.

## Feedback and Irreversibility

Cooldowns, breeding, retirement, sales, and money moves deserve a clear cost before commitment and a clear receipt afterward. Routine destructive or transactional confirmations may use a restrained accessible dialog. Foal birth, championship results, rare discovery, relationship progress, and major rewards require authored presentation. Emotional importance determines choreography.

## Truth, State, and Accessibility

- Loading, error, empty, and success are distinct states. Empty is reachable only through a successful response.
- Retry calls the real refetch path. Never invent placeholder values or treat an error as “nothing here.”
- No mocked primary paths, bypass headers, or fabricated beta-live data.
- Unknown is an em dash or explicit unknown state, never a reassuring fake zero.
- Target WCAG 2.1 AA. Never rely on color alone; preserve keyboard navigation, focus management, announcements, reduced motion, and 44px minimum touch targets.
- Accessibility is a behavioral requirement, not permission to import a generic component system or neutralize the art direction.

## Product Truth and Document Authority

Use this hierarchy when documents disagree:

1. The user's explicit current ruling.
2. `PRODUCT.md` for product identity, player promise, experience architecture, and allowed/rejected product behavior.
3. `DESIGN.md` for the binding Celestial Night visual language, typography, composition, motion, and component expression.
4. Current token and motion implementation in `docs/design-system/TOKENS.md` and `MOTION.md`.
5. Narrow implementation decisions that do not conflict with items 1–4.

The following are **historical evidence, not governing design authority**, wherever they prescribe shadcn/Radix, universal FrostedPanel/Card replacement, dashboard shells, standard header/tab/card choreography, aside rails, generic RewardToast, chart libraries, or responsive card grids:

- the archived March 2026 UX specification and its retired shards
- older Epic 22 implementation artifacts
- conflicting portions of `docs/design-system/DECISIONS.md` and component inventories

Existing code is evidence of current state, not proof that its structure is desirable. Do not infer “approved pattern” from repetition; the audit established that repetition is the defect.

## Visual-Change Gate

Before implementing or approving a player-facing route, answer all of these:

1. What is the route's one-sentence experiential concept?
2. What is the emotional or visual subject before the data?
3. How does its silhouette differ from the generic header/tabs/cards template?
4. How does it use the actual scene artwork rather than merely sit on top of it?
5. Which information is contextual, and which can move to a secondary ledger/dossier/drawer?
6. Does any installed library or existing component dictate the design? If yes, redesign from product intent.
7. Does the result create beauty, warmth, wonder, or attachment—not merely avoid violations?
8. On phone and desktop, does the same game experience survive with touch and keyboard access?

If those answers are missing, stop before code. Explore the route, inspect its artwork and real data, propose a specific direction, and get user input when the choice would establish a new visual pattern or replace a rejected component.

## Capabilities and Current Scope

Live product areas include World Hub, Stable, horse/foal detail, Breeding, Training, competitions and conformation shows, leaderboards, grooms/riders/trainers, marketplace, tack/feed shops, Farrier, Veterinarian, crafting, inventory, Bank, Clubs, message board/DMs, Profile, Settings, onboarding, auth, and admin surfaces.

The backend is Express ESM + Prisma + PostgreSQL, versioned at `/api/v1`, deployed to Railway. All player-state mutations must remain transactional.

Premium features are in scope as a future product concern, but there is no approved payment provider, price, tier, entitlement model, or tier name. Do not invent them. In-game currency is gameplay-only and must never use a dollar sign or imply real money.

## Evidence and Assets

Use real assets before generating or fabricating substitutes:

- Location and scene artwork in `frontend/public/images/`, including stable, horse-detail, vet, hospital, farrier, feed, and tack scenes plus the aspect-ratio background set.
- Brand/auth art in `frontend/public/equoriacelestial.png` and `equorialogin.png`.
- Horse, breed, feed, and tack imagery under `frontend/public/images/` and `frontend/public/assets/`.
- Self-hosted Dragon Tales, Basteleur Bold, Basteleur Moonlight, Whisperleaf, Proda Sans, and Artavion Mono fonts.
- Breed/reference data in the runtime source directory `backend/data/breeds/`.

Do not fabricate players, testimonials, reviews, press, prices, app-store availability, achieved metrics, or launch success. PRD numbers such as downloads, ARPU, retention, and test counts are targets unless proven otherwise.

## Product Principles

1. **Horses are the heart; systems support attachment.**
2. **The world is inhabited, not administered.**
3. **Structure creates genre before color does.**
4. **Depth must be legible without becoming business intelligence.**
5. **Every major route needs a specific experiential idea.**
6. **The returning session is the product.**
7. **Respect irreversible choices and tell the truth about state.**
8. **Phone and desktop are one complete game.**
9. **Reuse behavior, not page sameness.**
10. **Equoria is entertainment. Preserve delight.**

## Product Vocabulary

Use the world's own words: stable, foal, dam, sire, lineage, genotype, phenotype, locus, epigenetic trait, trait discovery, discipline, cooldown, groom, rider, trainer, payroll, show, conformation show, entry fee, prize, care status, World Hub, and club.
