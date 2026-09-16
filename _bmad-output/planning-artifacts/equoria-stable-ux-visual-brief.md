---
title: 'Equoria Stable UX / Visual Brief'
date: '2026-08-27'
status: 'Approved canonical low-fidelity direction — visual production next'
scope:
  - 'Stable Home'
  - 'Horse Roster'
  - 'Supporting navigation and Equoria Town relationship'
source_session: '../brainstorming-session-2026-08-25.md'
canonical_wireframe: 'https://claude.ai/code/artifact/518d148f-c476-4d3a-a32d-183430bda4b2'
---

# Equoria Stable UX / Visual Brief

## 1. Executive Direction

Equoria is a browser-delivered horse simulation game, not a SaaS application with horse imagery. The redesigned Stable must support players who own 5, 10, 50, 100, or more horses while preserving the pleasure of seeing and recognizing those horses.

The selected solution separates two jobs that the current interface has collapsed:

- **Stable Home** is an atmospheric arrival, a celebration of recent performance, and a gateway into stable work.
- **Horse Roster** is a dedicated collection-management surface with an art-led Portrait mode and an analysis-led Ledger mode.

The Stable Home must never become a dashboard of summaries. The Roster must never imply that a player has one active horse. Dense information is supported, but it is placed where comparison is the player's actual intent.

The selected visual direction is **Lantern Honors Yard**: a lantern-lit stable beneath a celestial night sky, balancing approximately two-thirds grounded stable life with one-third celestial wonder. White barn architecture, light and dark timber, midnight indigo, lantern gold, luminous blue flora, and quiet horse constellations establish a premium authored 2D game world.

### 1.1 Canonical low-fidelity authority

The approved desktop and mobile decision pass is the [Equoria Redesign Wireframes artifact](https://claude.ai/code/artifact/518d148f-c476-4d3a-a32d-183430bda4b2), finalized 2026-08-27. It is the canonical spatial reference for Stable Home, Portrait Roster, Ledger, Refine Roster, Equoria Town, global navigation, and supporting system states. Its rejected-pattern frame remains binding: discarded alternatives must not be recombined during high-fidelity design or implementation.

The wireframes establish structure and responsive behavior, not finished visual styling. Where gray placeholder geometry appears, this brief, `DESIGN.md`, `PRODUCT.md`, and the forthcoming visual-production specification govern the authored material, silhouette, typography, and asset construction.

## 2. Non-Negotiable Product Truths

1. Players may own and actively manage very large stables.
2. There is no single active horse, companion relationship meter, chapter structure, or quest-like Stable progression.
3. Players may enter hundreds of shows in a night. A horse may enter as many qualifying shows as its owner chooses.
4. Exact show eligibility belongs to the selected competition, discipline, and level—not to the general Horse Roster.
5. Horses under 3 or over 21 are not enterable in competitions.
6. Filters and organization may reduce hunting, but they must not complete gameplay labor.
7. There is no batch feeding, grooming, shoeing, veterinary care, training, breeding, selling, or show entry.
8. Horse artwork is a first-class part of collection play, not a thumbnail reluctantly attached to a spreadsheet.
9. Responsive layout, semantic data, interaction, state, filtering, and accessibility belong to DOM/CSS.
10. Authored assets own atmosphere, silhouette, material identity, ceremony, prestige, location character, and signature controls.

### 2.1 Current Stable diagnosis

The current screenshots and implementation demonstrate functional information delivery but the wrong visual and interaction genre:

- A persistent left sidebar and collapsible/hamburger behavior frame the game as an application suite.
- The top bar, currency container, notification controls, and repeated rounded panels resemble a productivity shell.
- Stable Summary, Cooldown Timers, Recent Activity, and Next Actions compete as equal dashboard modules.
- Horse entries expose all twelve statistics, repeated state pills, and readiness badges directly beside small artwork, making the collection read as records first and horses second.
- The scenic background behaves as wallpaper beneath translucent rectangles instead of participating in hierarchy and interaction.
- Repeating the same panel recipe for summaries, actions, timers, and horses creates a visually interchangeable page structure.

Useful foundations should be retained: live semantic data, readable status, responsive behavior, clear focus states, and predictable routing. The redesign changes the screen model rather than merely replacing navy cards with decorated navy cards.

### 2.2 Competitor reference synthesis

| Reference                                                             | Keep                                                                               | Avoid                                                              | Translate for Equoria                                                                                              |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| [Howrse](https://www.howrse.com/aide/manuelEleveur/?type=section-5-2) | Mature collection-management depth and learnable horse-management vocabulary       | Dense legacy desktop page structure and utility-first presentation | Preserve depth while separating art-led browsing from comparison-led Ledger use                                    |
| [Horse Reality](https://horsereality.wiki/en/Account/Estate)          | Strong sense of estate ownership, horse identity, and detailed individual profiles | Portal-like page segmentation and conventional browser-game chrome | Make the Stable an illustrated place and keep deep detail on the horse profile                                     |
| [Horse Eden](https://horseeden.com/)                                  | Fast access to horse and stable information for experienced players                | Small, dense, legacy table/page presentation                       | Retain speed through sticky navigation, filtering, and state restoration rather than visual compression everywhere |
| [Horse World Online](https://www.horseworldonline.net/)               | Broad management capability and information availability                           | Form/table-heavy desktop-web character                             | Place dense comparison in an intentional semantic Ledger and keep Portrait visually authored                       |
| [Morning Dust Ranch](https://www.morning-dust-ranch.com/)             | Themed horse-world identity and game-specific subject matter                       | Long-page, old-school desktop composition                          | Preserve specificity and charm through responsive location art and modern one-step interaction                     |

The goal is not to imitate another horse game's skin. Equoria should combine their proven depth and collection literacy with modern responsive state handling, RPG-informed spatial hierarchy, and original graphical UI assets.

## 3. Experience Principles

### 3.1 Place before panels

The first impression must be arrival at a stable under the Equoria night sky. Environment art is part of the interface, not wallpaper behind generic containers.

### 3.2 Recognition before analysis

New players begin with horse artwork and identity. Players deliberately enter Ledger mode when they want dense comparison. Stable size never silently changes their preferred mode.

### 3.3 Efficient does not mean automated

Stable organization should make the next horse easy to find and the previous context easy to recover. It should not eliminate the player's meaningful decisions or repeated work.

### 3.4 One-step reversible travel

Opening a horse, changing barns, entering the Roster, or visiting a town location is harmless and reversible. These interactions should not require confirmation steps.

### 3.5 Authored identity around live content

Custom frames, sills, rails, emblems, thresholds, ribbons, signs, and illumination establish Equoria's visual authorship. Horse names, counts, timers, statuses, filters, and table values remain live semantic text.

## 4. Stable and Roster Relationship

| Surface                 | Player question                                                | Information density | Primary outcome                                              |
| ----------------------- | -------------------------------------------------------------- | ------------------: | ------------------------------------------------------------ |
| Stable Home             | “Where am I, who excelled, and where should I go?”             |                 Low | Enter Roster, open a standout, or follow one workload signal |
| Horse Roster — Portrait | “Which horse am I looking for, and what is its concise state?” |              Medium | Recognize and open an individual horse                       |
| Horse Roster — Ledger   | “How do these horses compare?”                                 |                High | Sort, compare, and open an individual horse                  |
| Horse Profile           | “What is true about this horse, and what can I do with it?”    |                Deep | Inspect and perform horse-specific actions                   |
| COMPETE                 | “Which horses qualify for this selected show?”                 |          Contextual | Enter horses manually according to that competition's rules  |

Stable Home may deep-link into a filtered Roster. The Roster may open a horse profile. Neither surface performs care, training, breeding, or show entry directly.

## 5. Stable Home Screen Hierarchy

### 5.1 First-five-seconds hierarchy

1. **Atmosphere and stable identity** — the player has arrived at their authored Stable.
2. **Horse Roster gateway** — the barn entrance clearly but naturally invites entry.
3. **Recent achievement** — last night's three highest-performing horses occupy the honors composition.
4. **Workload orientation** — one Stable Rounds marker communicates three aggregate conditions.
5. **Global travel** — compact HUD and the five-realm ribbon remain available without boxing in the scene.

The hierarchy is intentionally asymmetrical. These are not equal modules and must not become equally weighted rectangles.

### 5.2 Last Night's Standouts

Stable Home displays exactly three horses from the previous nightly show run:

- The highest-point horse occupies the largest central stable opening.
- Second and third occupy smaller flanking openings.
- Each shows horse artwork, horse name, and restrained total nightly points.
- Placement breakdowns, stat blocks, earnings, and task controls are excluded.
- Selecting a horse opens its profile.

Ranking uses the total show points earned across every show in the nightly run. A horse with many second- and third-place finishes may outrank a horse with one first-place finish. The illustrative 10/5/3 scoring example must not be hard-coded if the authoritative scoring table differs.

Fallback behavior:

- If shows ran and points were earned, rank by total points.
- If shows ran but no horse earned a top-three placement, use the best available finish/results ordering defined by the results system.
- If no shows ran, display three random stable residents without winner prestige treatment.

This is recent recognition, not an active-horse selector.

### 5.3 Luminous Barn Threshold

The barn entrance is the primary Horse Roster control.

- No permanent `HORSE ROSTER` plaque is mounted above it.
- Warm light spills from the doorway, with restrained gold sparkles or moving light drawing attention toward the threshold.
- Hover and keyboard focus may reveal a small `View Horses` label and strengthen the illumination.
- Touch activation opens the Roster in one tap.
- A strong static illumination remains when reduced motion is enabled.
- The control has an accessible name independent of the artwork.
- A one-time onboarding cue may be used on mobile if testing shows the threshold is missed.

### 5.4 Stable Rounds

Stable Home displays one hanging environmental marker with three interactive lines:

- Requires Care
- Can Train
- Breedable Mares

Each line shows a bespoke icon, count, short text label, and focus/hover illumination. Selecting a line opens the separate Roster with the corresponding filter already applied. Three separate KPI plaques or cards are prohibited.

### 5.5 Stable Home mobile recomposition

- The threshold and first-place horse occupy staggered architectural openings; neither becomes a generic full-width module.
- First place is the principal honors opening and receives the strongest scale and rank treatment.
- Stable Rounds hangs from a yard post, overlaps the lower facade edge, and extends into the yard at approximately two-thirds width rather than becoming a full-width panel.
- Second and third occupy smaller staggered openings with visible ground, beams, facade, and foliage maintaining environmental continuity between them.
- The barn threshold remains visually obvious without becoming a large generic CTA.
- The five-realm navigation remains persistent at the bottom.
- Controls preserve at least 44px touch targets even when their visible art is smaller.
- The composition may scroll vertically, but aligned horizontal module boundaries and a feed of dashboard cards are prohibited.

## 6. Horse Roster Information Architecture

### 6.1 Entry and persistence

- Every new player enters in Portrait mode.
- Ledger mode appears only after the player chooses it.
- The preferred mode persists across sessions.
- Stable size never automatically switches modes.
- Returning from a horse profile or another destination restores the exact barn, filters, mode, Ledger sort, and scroll position.

### 6.2 Automatic barns

The Roster has six factual divisions:

1. All Horses
2. Mares
3. Stallions
4. Colts
5. Fillies
6. Retired

Assignment is automatic from age, sex, and retirement state. Players do not manually move horses between these barns.

Each barn has a custom emblem and a visible label. Colts and Fillies must not depend on pink/blue coding. Retired should communicate peaceful pasture or rest. The selected barn uses lantern-gold illumination; inactive barns remain legible indigo.

### 6.3 Compact sticky barn rail

Barn switching is frequent navigation and must remain continuously reachable.

- **Mobile:** two compact rows of three choices, approximately 72–88px total.
- **Desktop:** the same six choices in one slim row.
- Small 16–20px bespoke emblems accompany visible labels and understated counts.
- The shared rail is one lightweight authored fixture, not six framed cards.
- It stays sticky beneath the compact HUD while the collection scrolls.
- On mobile it remains two 42px rows (84px total) at every scroll position. It may become visually quieter after scrolling, but it never collapses, abbreviates labels, or changes geometry.
- The larger `Horse Roster` title may scroll away.
- One tap switches barns immediately.
- Horse artwork begins directly beneath the compact navigation and utility controls.

The rejected large two-by-three architectural directory studies must not be revived. The barn selector is navigation, not a hero object.

## 7. Portrait Mode

### 7.1 Purpose

Portrait mode supports visual recognition, identity, and quick state scanning across a large collection. It is not a compressed Ledger.

### 7.2 Entry content boundary

Each Portrait entry contains only:

- Authored horse artwork
- Horse name
- Sex
- Age
- Breed
- Care state
- Training state
- Breeding state

It excludes numerical competition statistics, earnings, pedigree, genotype, detailed show history, equipment, sale price, inline actions, and overflow menus.

### 7.3 Entry composition

- The horse artwork remains unobstructed by names, badges, and state text.
- A restrained engraved stable sill beneath the artwork carries the information.
- Horse name is the strongest text.
- Sex · age · breed appear on one concise line.
- Care, Training, and Breeding occupy three consistent positions beneath.
- The complete entry is one large link to the horse profile.
- Status indicators are descriptive, not nested action buttons.

### 7.4 Three-state rail

Each position pairs a bespoke icon with a short visible state:

| Position | Examples                                      |
| -------- | --------------------------------------------- |
| Care     | `Well`, `Needs Care`                          |
| Training | `Ready`, or rounded cooldown such as `2h 15m` |
| Breeding | `Breedable`, `In Foal`, `At Stud`, or `—`     |

The labels are part of the sill composition, not pills. Meaning never depends on color alone. Assistive text may provide fuller descriptions.

Training cooldowns display hours and minutes as appropriate, never seconds. Exact timestamps belong on the horse profile.

### 7.5 Gallery structure

The selected direction is **Open Celestial Barn Gallery**:

- Three horse bays across on desktop where width permits.
- Two columns on typical phones.
- One column only for genuinely narrow widths or accessibility text scaling.
- Each row shares a light canopy and/or sill.
- Slender supports establish stable bays without creating a heavy floor-to-ceiling cage.
- Open gutters reveal celestial night between horses.
- Gold is restrained; lighter beams, indigo, lantern points, and negative space dominate.
- Entries must not read as independent rounded SaaS cards.

### 7.6 Horse artwork variants

The art pipeline provides intentionally composed portrait and landscape variants. Components select the appropriate authored variant for their art slot instead of inventing composition through aggressive CSS crops.

Default usage:

- Roster gallery favors portrait-format artwork.
- Stable Home honors openings favor landscape-format artwork.
- Horse profile hero uses the format appropriate to its approved composition.
- Ledger thumbnails use a thumbnail-safe crop or derivative from an authored source.

Important horse silhouettes, legs, tails, and environmental context remain within each variant's safe area.

## 8. Ledger Mode

### 8.1 Purpose

Ledger supports dense comparison for experienced players. It is a semantic table styled as an Equoria stable record, not a collection of expandable cards.

### 8.2 Core columns

- Frozen Horse identity column with a restrained 40–48px artwork thumbnail and linked horse name
- Breed
- Sex
- Age
- Care state
- Training state
- Breeding state
- All twelve competition statistics: PRC, STR, SPD, AGI, END, INT, STA, BAL, BLD, FLX, OBD, and FCS

Canonical full labels must be exposed to assistive technology wherever abbreviations are displayed.

The core Ledger excludes genotype, pedigree, detailed show history, equipment, sale pricing, and other profile-level information. Total earnings may appear only as a visually unimportant trailing comparison column; it is outside the default mobile viewport and never competes with identity, current state, or competition statistics.

### 8.3 Sorting and scrolling

- Default order is horse name ascending.
- Useful displayed columns may be sortable.
- Ledger sorting remains local to Ledger and does not change Portrait's alphabetical order.
- Mobile uses horizontal table scrolling with the identity column frozen.
- Column headers remain persistent while rows scroll.
- An edge fade or equivalent cue communicates that additional columns continue horizontally.
- Horse names open profiles in one activation.

## 9. Filtering, Search, and Collection Loading

### 9.1 Filter set

The Roster supports:

- Breed
- Requires Care
- Can Train
- Breedable
- In Foal
- For Sale
- At Stud

Name, age, coat color, discipline, level, and competition eligibility are excluded from the general Roster filters.

### 9.2 Refine Roster workflow

- One clearly labeled `Refine Roster` control opens a dedicated mobile filter view.
- It is not a hamburger, drawer, bottom sheet, or permanently expanded filter bar.
- Applying filters returns to the Roster.
- The Roster displays one concise human-readable summary and a clear reset action.
- Irrelevant filters disappear in context: Mares do not show At Stud; Stallions do not show In Foal; Colts and Fillies omit adult breeding predicates.
- Desktop may expose the same semantics in a restrained optional side region if it does not become a dashboard panel.
- The approved desktop treatment is a bracket-mounted hanging steward's board that opens from the barn fixture, overlaps the aisle edge, keeps live results visible, and closes explicitly. Calling a conventional application sidebar “authored” without changing its silhouette is insufficient.

### 9.3 Search and ordering

- Unfiltered Portrait mode is alphabetical.
- No redundant name-search field is added solely to imitate application UI.
- Device/browser text finding remains viable because horse names must remain discoverable in the document.
- Artwork may lazy-load; horse identity text must not silently become undiscoverable.
- If future row virtualization removes unloaded names from the DOM, Equoria must add an accessible in-game name lookup before relying on virtualization.

### 9.4 Continuous collection

- No numbered pagination.
- Each barn is one continuous collection.
- Artwork lazy-loads as the player scrolls.
- Navigation back to the Roster restores the exact position.
- An A–Z jump aid remains optional and should be added only if testing proves it useful without crowding mobile.

## 10. Bulk-Action Boundary

The Horse Roster contains:

- No checkboxes
- No multi-select mode
- No bulk-action toolbar
- No batch care, training, breeding, selling, or show entry

Filters answer “which horses need my attention?” Selecting a result answers “which individual horse will I work with now?”

Competition entry belongs to COMPETE. There, the selected show's discipline, level, age limits, and other rules determine which horses appear as eligible. The design of high-volume manual show entry requires its own focused brief; the Stable Roster must not absorb or automate it.

## 11. Global Navigation Relationship

### 11.1 Primary realm ribbon

The persistent bottom navigation has five realms:

- HOME
- WORLD
- COMMUNITY
- MARKETPLACE
- COMPETE

These are category controls, not placeholder pages. Selecting a realm reveals its authored destination submenu. Selecting a destination loads it and dismisses the submenu. The relevant realm remains highlighted.

No hamburger, generic sidebar, all-purpose drawer, or disguised menu sheet is approved.

### 11.2 Destinations

**HOME:** Profile, Avatar, Stable, Inventory, Bank  
**WORLD:** Equoria Town, Veterinarian, Feed Shop, Tack Shop, Training Center, Breeding Specialist, Leathersmith  
**COMMUNITY:** Forum, Clubs/Associations, Leaderboard  
**MARKETPLACE:** Horse Trader, Horse Marketplace, Grooms for Hire, Riders, Trainers for Hire  
**COMPETE:** Under Saddle, Conformation, with room to expand

Bank remains in HOME even though the coin balance is also a shortcut.

### 11.3 Top HUD

- Centered noninteractive EQUORIA wordmark
- Coin balance linking to Bank
- Explicit Equoria Chronicle control
- Notifications
- Settings
- Logout

Chronicle is separate from personal notifications and provides a persistent return to game News after the automatic login presentation.

All five HUD destinations remain available on mobile. Coins and Chronicle retain labeled plates; notifications, settings, and logout may use authored medallions with accessible names and focus labels. Every interactive HUD target is at least 44×44px even when the visible medallion is smaller.

### 11.4 Destination emblem behavior

Secondary destinations use original engraved-line emblems with DOM labels. At rest they are restrained gold linework on indigo. Hover, focus, and selected states introduce selective painted color, lantern illumination, and material depth. Full painted pictograms are reserved for location entrances, rewards, onboarding, and promotional surfaces.

## 12. Equoria Town

Equoria Town is the first WORLD destination and an optional immersive route to the six specialist locations. Direct WORLD submenu travel remains available for repeated visits.

### 12.1 Map model

- One authored clickable service-quarter map, not a list of six scene cards.
- All six foreground destinations are visible within the intended composition.
- No sideways map scrolling or horizontal panning on mobile.
- No vertically reconstructed replacement street.
- Every hotspot travels in one click, tap, or keyboard activation.
- No select-then-confirm step.
- Hotspots are generously sized, non-overlapping semantic controls.

Mobile location names remain provisionally visible through subtle environmental signs. This may be replaced if the final map discovers a more intuitive affordance that preserves recognition, one-tap travel, and accessibility without writing across the artwork.

### 12.2 Canonical landmarks

Existing exterior art establishes three canonical designs:

- Feed Shop — `frontend/public/images/feedstore2.webp`
- Tack Shop — `frontend/public/images/tackstore.webp`
- Equine Hospital / Veterinarian — `frontend/public/images/equinehospital.webp`

New matching exteriors are needed for:

- Training Center — open arena complex, covered ring, illuminated rails
- Breeding Specialist — elegant cottage or small manor with restrained celestial genealogy motifs
- Leathersmith — warm timber workshop, hanging tack, working chimney; aligned with `farriershop.webp`

Existing interior art such as `feedstore.webp`, `tackstoreclerk.webp`, `veterinarian.webp`, and `farriershop.webp` supports destination continuity. Interiors may provide an environmental `Return to Town` exit.

## 13. Visual Directions Considered

### 13.1 Lantern Honors Yard — selected

Grounded white stable architecture, open night sky, warm lanterns, restrained gold, luminous blue flora, and a quiet constellation. Controls inhabit the stable: honors openings, glowing threshold, Stable Rounds marker, and travel ribbon.

**Why it avoids a website:** hierarchy is spatial and environmental. Recent achievement is staged in stable architecture; the primary navigation affordance is a doorway; workload appears on one in-world marker rather than KPI cards.

### 13.2 Celestial Stable Gallery — not selected as the primary direction

More ceremonial celestial framing, luminous metalwork, and stronger gallery presentation.

**Why it avoids a website:** authored framing and horse-centered composition replace generic containers.  
**Why it lost:** it risks over-ornamenting routine management and drifting toward a fantasy inventory screen.

### 13.3 Working Stable at Midnight — not selected as the primary direction

More timber, practical tack-room cues, grounded lantern light, and restrained magic.

**Why it avoids a website:** physical stable fixtures carry the interface and the location remains specific.  
**Why it lost:** it underplays Equoria's celestial identity and premium wonder compared with Lantern Honors Yard.

## 14. Bespoke Asset Plan

### 14.1 Global shell kit

- Modular five-realm travel ribbon with desktop and mobile assemblies
- Five primary realm emblems and selected-state overlays
- Indigo secondary-destination ribbon or frame family
- Engraved-line destination emblem set
- Compact HUD plates for coins, Chronicle, notifications, settings, and logout
- Focus, selected, unread, and disabled overlays that preserve semantic controls
- Decorative dividers, joints, endcaps, and safe-area variants

### 14.2 Stable Home kit

- Lantern Honors Yard master environment art with responsive compositions/safe zones
- Luminous barn doorway base and separate glow/sparkle overlays
- First-place stable opening frame
- Second/third-place opening frame
- Rank-one, rank-two, and rank-three ornaments or ribbons
- Restrained nightly-points plate
- Hanging Stable Rounds marker shell
- Requires Care, Can Train, and Breedable Mares icons
- Static reduced-motion threshold treatment
- Loading/empty-state scene treatments that remain honest and in-world

### 14.3 Horse Roster kit

- Open Celestial Barn Gallery canopy, sill, slender support, and gutter pieces
- Modular responsive assembly rather than one fixed-size raster panel
- Engraved horse-information sill with safe insets for live text
- Six small barn emblems
- Compact desktop/mobile barn rail background, joints, and selected-state treatment
- Care, Training, and Breeding state icon families
- Portrait/Ledger mode-control plate
- Refine Roster control plate and filter-summary ornament
- Stable-ledger background, header rule, frozen-column edge, and continuation cue
- Small thumbnail mask/treatment
- Loading placeholders that preserve gallery rhythm without pretending unavailable art is final

### 14.4 Horse artwork pipeline

- Intentionally composed portrait and landscape variants
- Declared focal/safe areas
- Thumbnail-safe derivatives where needed
- Optimized WebP/AVIF delivery with suitable fallbacks
- Stable manifest keys independent of filenames
- Lazy loading for offscreen Roster art

Transparent horse cutouts are not a core requirement. They may be commissioned selectively for major rewards, events, onboarding, or marketing.

### 14.5 Equoria Town kit

- Canonical service-quarter master map preserving all six destinations
- Responsive export strategy that preserves the same map identity and does not create a replacement scrolling street
- New Training Center, Breeding Specialist, and Leathersmith exterior artwork
- Separate per-building hover/focus illumination overlays
- Window, sign, lantern, and threshold glow layers where appropriate
- Accessible DOM hotspot map and optional environmental mobile labels
- Environmental Return to Town exit treatment for interiors

### 14.6 Construction guidance

- Use SVG for scalable engraved linework, emblems, dividers, and ornaments where it retains the desired authored quality.
- Use WebP/AVIF for painterly environments and textured surfaces.
- Use alpha WebP/PNG for painterly overlays when SVG cannot reproduce the texture.
- Use nine-slice-style construction, `border-image`, repeatable edges, masks, and modular corners for flexible frames.
- Never bake horse names, counts, timers, prices, dynamic states, or localized labels into raster assets.
- CSS variables own palette and state tokens.
- React/DOM owns filtering, sorting, tables, text, interaction, keyboard behavior, and accessibility.
- No game engine or canvas is required for these management surfaces. Add one only if a later world interaction has a concrete rendering need.

## 15. Interaction, Accessibility, and Motion

- Minimum touch target: 44px; expand invisible hit areas rather than inflating visual art.
- Visible Lantern Gold Bright focus treatment with dark offset.
- No action depends on hover.
- No state depends on color alone.
- The full Portrait entry exposes one clear accessible link name.
- Barn labels remain visible; icons do not replace words.
- Ledger uses real table semantics and sortable headers.
- Town hotspots expose destination names even when the visible affordance is environmental.
- Decorative motion is restrained and supports discovery, selection, or reward.
- Reduced-motion mode removes sparkle travel and unnecessary transitions while preserving static hierarchy and information.
- Text remains selectable and zoomable where appropriate.
- Authored ornament cannot cover focus, text, or interactive hit areas.

## 16. State and Performance Boundaries

- Save serializable Roster state: mode, barn, filters, Ledger sort, and scroll restoration key.
- Do not make artwork or the rendering layer the source of truth for horse state.
- Preload only the Stable's critical arrival art, navigation shell, and first visible horse assets.
- Lazy-load offscreen horse artwork.
- Measure transfer size, decode cost, memory, paint/compositing, and representative phone performance before simplifying approved art.
- Prefer reusable asset modules and stable manifest keys over filename-coupled component logic.
- Preserve semantic horse names if progressive loading or virtualization is introduced.

## 17. Anti-Dashboard Acceptance Tests

A design fails if any of the following are true:

- Stable Home could become a finance dashboard after replacing horse nouns.
- The initial viewport is dominated by cards, KPI tiles, or equal-weight bordered panels.
- The background can be removed without revealing that the remaining composition is a generic app shell.
- Stable Home presents one active horse, relationship progress, chapters, or quest steps.
- Portrait mode exposes the twelve-stat block.
- Every horse becomes an isolated rounded card.
- The barn selector becomes a large hero directory or disappears far above a long roster.
- Filters become seven permanent phone controls.
- Ledger becomes expandable mobile cards instead of a table.
- Multi-select or batch task completion appears in the Roster.
- Generic icon-library symbols dominate horse states or locations.
- Authored frames are flattened into plain rectangles solely for convenience.

A design succeeds when:

- A screenshot reads immediately as a premium horse game location.
- The horse art remains visually important with 5, 50, and 200 horses.
- A player can switch barns from deep in a long Roster without returning to the top.
- Portrait and Ledger solve visibly different jobs.
- Players can identify care/training/breeding state without opening every horse.
- Returning from a horse profile restores exact working context.
- The Stable provides direction without performing the player's work.

## 18. Validation Matrix

Test the approved design at minimum against:

- Stable sizes of 5, 20, 50, and 200 horses
- Desktop, tablet, typical phone portrait, narrow phone, and 200% text scaling
- Portrait and Ledger mode switching
- Deep-scroll barn switching
- Filter entry from Stable Rounds and from Refine Roster
- Back navigation from horse profiles
- No shows run, shows with no placements, and dense previous-night results
- Ready and long/short training cooldown states
- Mares, Stallions, young horses, and Retired contextual filters
- Empty barn, loading, fetch error, and missing horse-art states
- Keyboard-only navigation, screen reader labels, reduced motion, and high contrast
- Equoria Town one-tap hotspots on touch without accidental overlap

## 19. Open Decisions

These remain explicitly unresolved rather than silently assumed:

- Final mobile Equoria Town label treatment; visible environmental names are provisional.
- Final artwork export count and dimensions for each responsive scene family.
- The authoritative nightly competition scoring configuration and tie-break rules.
- The detailed high-volume COMPETE entry workflow, which requires a separate brief.

## 20. Recommended Next Deliverables

1. Produce the Equoria UI visual-production specification and asset manifest with dimensions, safe insets, state variants, formats, layer ownership, and stable manifest keys.
2. Create one high-fidelity vertical slice: Stable Home desktop/mobile, Portrait Roster desktop/mobile at top and scrolled, and WORLD submenu desktop/mobile.
3. Build a non-production React interaction prototype covering Stable threshold → Roster → filtered Roster → horse profile placeholder → restored Roster state.
4. Validate the prototype with representative 0-, 5-, 50-, and 200-horse datasets before completing the remaining final assets.
5. Extend the approved visual family to Ledger, Refine Roster, system states, and Equoria Town.
6. Create a separate Horse Profile design pass and a separate COMPETE UX brief for repeated manual entry across hundreds of shows.
