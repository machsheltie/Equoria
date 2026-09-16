---
title: 'Equoria UI Visual Production Specification'
date: '2026-08-27'
status: 'Draft for visual-production review'
phase: 'Approved low-fidelity → high-fidelity vertical slice'
canonical_wireframe: 'https://claude.ai/code/artifact/518d148f-c476-4d3a-a32d-183430bda4b2'
governing_sources:
  - 'PRODUCT.md'
  - 'DESIGN.md'
  - 'docs/ART_DIRECTION.md'
  - '_bmad-output/planning-artifacts/equoria-stable-ux-visual-brief.md'
---

# Equoria UI Visual Production Specification

## 1. Purpose

This document turns the approved Stable and Horse Roster low-fidelity direction into a producible visual system. It defines what must be drawn, what remains live DOM/CSS, how authored assets recompose across phone and desktop, and which first assets are required to prove the direction in a high-fidelity vertical slice.

This is not permission to decorate the current dashboard. The approved composition is replaced by the canonical wireframe structure before final assets are integrated.

The visual-production goal is:

> A lantern-lit horse world whose interface appears built into its stable architecture, while live horse data remains fast, responsive, accessible, and usable at 0–200+ horses.

## 2. Authority and Scope

### 2.1 Binding authority

When sources disagree, use this order:

1. The user's latest explicit ruling
2. `PRODUCT.md`
3. `DESIGN.md`
4. The Stable UX / Visual Brief
5. The canonical low-fidelity artifact
6. This production specification
7. Existing implementation

The wireframes govern hierarchy, spatial relationships, disclosure, and responsive behavior. `DESIGN.md` governs material language, color, typography, motion, and the anti-SaaS rules. This file governs asset construction and the first high-fidelity production package.

### 2.2 In scope for the first visual slice

- Global top HUD, resting and focused
- Five-realm bottom ribbon, resting and selected
- WORLD destination submenu, desktop and mobile
- Stable Home, desktop and mobile
- Stable Home no-shows fallback treatment
- Horse Roster Portrait, desktop top and scrolled
- Horse Roster Portrait, mobile top and scrolled
- Mobile and desktop barn rail
- Portrait entry states, loading, and missing-art fallback

### 2.3 Deferred until the visual slice is approved

- Full Ledger finish
- Full Refine Roster finish
- Equoria Town final map
- Horse Profile
- COMPETE high-volume entry workflow
- Remaining route families

Deferred surfaces may receive provisional supporting assets only when required to keep the first visual family coherent.

## 3. Creative Target

### 3.1 Fantasy

**Lantern Honors Yard beneath a celestial night sky.** The visual balance is approximately two-thirds inhabited stable life and one-third celestial wonder. Equoria is magical through atmosphere, light, nature, and horse imagery—not through medieval fantasy costume.

### 3.2 Material hierarchy

1. **Painted environment:** sky, stable architecture, yard, foliage, lantern pools, distant landscape.
2. **Dark indigo stable slate:** functional information held in an in-world fixture rather than generic glass.
3. **Controlled lantern gilt:** earned rank, active navigation, focus, and significant affordance.
4. **Pale stable timber:** structural contrast and warmth; never a faux-western or rustic-app theme.
5. **Luminous celestial detail:** restrained blue flowers, constellation traces, reflected starlight, and rare cool highlights.

### 3.3 Silhouette rules

- Stable Home controls are architectural objects: doorway, stable openings, hanging slate, ribbon.
- Portrait Roster entries form one continuous barn gallery; they are not independent cards.
- Authored frames may use interrupted edges, engraved rules, brackets, endcaps, and asymmetry.
- Functional controls may remain geometrically restrained inside an authored shell.
- A thin gold stroke around a generic rectangle is not an authored treatment.

### 3.4 Gold hierarchy

- Lantern Gold marks action, focus, selected navigation, rank, and earned emphasis.
- Ember Gold supplies environmental warmth and light spill.
- Wordmark Gold is exclusive to the EQUORIA wordmark.
- Lantern Gold Dim is decorative only and never carries text.
- Stable Home has one dominant gold invitation: the luminous Roster threshold.

## 4. Typography Production Roles

Typography remains live text. No player-facing copy, horse name, count, timer, destination, status, or value is baked into an asset.

| Role                               | Typeface            | First-slice usage                                                                            |
| ---------------------------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| Wordmark                           | Dragon Tales        | EQUORIA only                                                                                 |
| Major world arrival                | Basteleur Bold      | Use sparingly if a location arrival title is required; Stable Home has no generic page title |
| Horse identity / important fixture | Basteleur Moonlight | Honors horse names and prominent portrait names where size permits                           |
| Enchanted accent                   | Whisperleaf         | Optional short environmental accent only after readability proof                             |
| Functional UI                      | Proda Sans          | HUD, realm labels, barn labels, state text, controls, submenu destinations                   |
| Recorded data                      | Artavion Mono       | Ledger/registry use later; not decorative texture in the first slice                         |

Phone typography must preserve readable full realm and barn names. `COMMUNITY` and `MARKETPLACE` may use an authored two-line arrangement rather than shrinking below the functional readability floor.

## 5. Layer-Ownership Contract

| Element             | Authored asset owns                                                  | DOM/CSS owns                                                          |
| ------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Stable environment  | Painting, architecture, light pools, foliage, safe-zone composition  | Responsive placement, crop selection, loading state                   |
| Barn threshold      | Doorway base, glow mask, sparkle artwork                             | Link semantics, label, focus, hover/touch/reduced-motion state        |
| Honors opening      | Frame, rank ornament, material edge                                  | Horse image, name, rank text, points, link semantics                  |
| Stable Rounds       | Slate silhouette, bracket/post, engraved separators, icons           | Three labels, counts, deep-link controls, focus and live values       |
| Top HUD             | Plates, medallions, decorative joints                                | Coins, accessible names, unread state, routing, tooltips/focus labels |
| Realm ribbon        | Ribbon silhouette, joints, realm emblems, selected illumination mask | Realm names, selected semantics, submenu control behavior             |
| Destination submenu | Authored panel/ribbon shell, destination emblem holders              | Destination labels, focus order, open/close state, routing            |
| Barn rail           | Rail, joints, six emblems, selected illumination                     | Labels, counts, sticky behavior, selected barn, 44px targets          |
| Portrait bay        | Canopy, supports, sill, image mask, fallback crest                   | Horse image, identity, states, link semantics, responsive grid        |
| Refine board        | Hanging steward-board silhouette and hardware                        | Inputs, counts, labels, validation, Apply/Clear/Close behavior        |
| Ledger              | Header rule, frozen-edge treatment, continuation fade                | Real semantic table, sorting, data, horizontal scrolling              |

## 6. Responsive Composition Contracts

### 6.1 Stable Home desktop

Reference frame: 1280×800 CSS pixels.

- Environment art fills the scene between the compact HUD and realm ribbon.
- The doorway is the only Roster gateway.
- Honors are stable openings at unequal depth and scale, not three cards.
- First place is optically dominant; second and third remain secondary.
- Stable Rounds hangs from a yard post and never docks as an application aside.
- Open sky, yard, architecture, and foliage remain visible after UI placement.

Recommended first export for layout proof: 2560×1600 at 2×. The art master may be larger, but the prototype export should not exceed what representative phones and laptops can decode comfortably without evidence.

### 6.2 Stable Home mobile

Reference frame: 390×844 CSS pixels plus safe-area inset.

- Use an intentionally authored mobile composition, not a crop chosen by `object-position` alone.
- Threshold and principal honors opening are staggered; their boundaries do not align into a module row.
- Stable Rounds is approximately two-thirds of the content width, overlaps the facade/yard transition, and keeps three 44px rows.
- Second and third openings have staggered bottoms with open ground between them.
- Facade, beam, ground, and foliage geometry must remain visible between every interactive object.
- The fixed bottom ribbon reserves safe-area space and never traps the last interactive object.

Recommended first export for layout proof: 780×1688 at 2×.

### 6.3 Portrait Roster desktop

- Three bays across where the approved container width permits.
- Shared canopy and row structure visually connect entries.
- Sills carry live identity and state text below unobstructed artwork.
- The desktop barn rail is one slim six-choice fixture.
- The large Roster title scrolls away; rail, mode, and Refine remain reachable.

### 6.4 Portrait Roster mobile

- Two columns at 390px; one column only at genuinely narrow widths or accessibility scaling.
- Barn rail is two 42px rows of three, 84px total, at all scroll positions.
- Rail geometry never collapses, abbreviates labels, or reflows while scrolling.
- Portrait/Ledger and Refine sit directly beneath the rail.
- All three state labels remain visible without hover.
- Artwork begins as high as the fixed HUD and sticky controls allow.

### 6.5 Mobile HUD

- Coins/Bank and Chronicle use compact labeled plates.
- Notifications, Settings, and Logout may use smaller visible medallions inside non-overlapping 44×44px controls.
- EQUORIA remains centered and noninteractive.
- The arrangement must be tested at 360px and 200% text scaling; a collision requires responsive recomposition, not deletion of Chronicle or Logout.

## 7. State and Motion Specification

### 7.1 Universal interactive states

Every asset-skinned control requires:

- Rest
- Hover where a pointer exists
- Keyboard focus
- Pressed/touch feedback
- Selected/current where applicable
- Disabled only where the action can legitimately be unavailable
- Loading/pending where navigation or data may pause
- Reduced-motion equivalent

Focus is a 2px Lantern Gold Bright ring with a 2px dark offset and must remain visible against both the lightest sky and darkest stable region.

### 7.2 Threshold motion

- Rest: warm doorway spill and legible static affordance.
- Hover/focus: illumination strengthens; restrained sparks may travel inward.
- Pressed: brief light-settle response before travel.
- Reduced motion: no traveling particles; stronger static spill and focus treatment remain.
- The small `View Horses` label reinforces the doorway but is not the only affordance.

### 7.3 Honors motion

- Resting rank treatment is sufficient; no constant bobbing, bouncing, or pulsing.
- A restrained lantern or starlight shimmer may identify first place.
- Hover/focus may brighten the sill and rank ornament without obscuring the horse.
- No horse is marked active or selected.

### 7.4 Roster motion

- Sticky controls settle without elastic movement.
- Portrait links may receive a restrained material lift or edge illumination.
- Sill text never moves, expands, or appears only on hover.
- Image loading cannot change bay dimensions.

## 8. Asset Manifest

Manifest keys are the stable public API. Filenames may change without requiring component changes.

### 8.1 Priority P0 — shared shell

| Manifest key                         | Asset                            | Format / assembly                     | Variants and notes                                     |
| ------------------------------------ | -------------------------------- | ------------------------------------- | ------------------------------------------------------ |
| `ui.shell.hud.coin`                  | Coin/Bank plate                  | Modular SVG + optional raster texture | Rest, hover, focus, pressed; live amount               |
| `ui.shell.hud.chronicle`             | Chronicle plate                  | Modular SVG                           | Full label remains live text                           |
| `ui.shell.hud.notification`          | Notification medallion           | SVG                                   | Rest, unread, hover, focus, pressed                    |
| `ui.shell.hud.settings`              | Settings medallion               | SVG                                   | Rest, hover, focus, pressed                            |
| `ui.shell.hud.logout`                | Logout medallion                 | SVG                                   | Rest, hover, focus, pressed                            |
| `ui.shell.realm.ribbon.desktop`      | Five-realm desktop ribbon        | Modular SVG, repeatable center        | Safe text insets for five live labels                  |
| `ui.shell.realm.ribbon.mobile`       | Five-realm mobile ribbon         | Alternate modular SVG assembly        | Includes bottom safe-area behavior                     |
| `ui.shell.realm.home`                | HOME emblem                      | SVG                                   | Rest, selected, focus illumination                     |
| `ui.shell.realm.world`               | WORLD emblem                     | SVG                                   | Rest, selected, focus illumination                     |
| `ui.shell.realm.community`           | COMMUNITY emblem                 | SVG                                   | Rest, selected, focus illumination                     |
| `ui.shell.realm.marketplace`         | MARKETPLACE emblem               | SVG                                   | Rest, selected, focus illumination                     |
| `ui.shell.realm.compete`             | COMPETE emblem                   | SVG                                   | Rest, selected, focus illumination                     |
| `ui.shell.destination.panel.desktop` | Destination submenu shell        | Modular SVG + texture                 | Supports 2–7 live destinations without stretched cells |
| `ui.shell.destination.panel.mobile`  | Mobile destination submenu shell | Alternate modular assembly            | Supports two columns and four rows; no scrolling       |

Destination emblem keys:

- `ui.destination.home.profile`
- `ui.destination.home.avatar`
- `ui.destination.home.stable`
- `ui.destination.home.inventory`
- `ui.destination.home.bank`
- `ui.destination.world.town`
- `ui.destination.world.veterinarian`
- `ui.destination.world.feed-shop`
- `ui.destination.world.tack-shop`
- `ui.destination.world.training-center`
- `ui.destination.world.breeding-specialist`
- `ui.destination.world.leathersmith`
- `ui.destination.community.forum`
- `ui.destination.community.clubs`
- `ui.destination.community.leaderboard`
- `ui.destination.marketplace.horse-trader`
- `ui.destination.marketplace.horse-marketplace`
- `ui.destination.marketplace.grooms-for-hire`
- `ui.destination.marketplace.riders`
- `ui.destination.marketplace.trainers-for-hire`
- `ui.destination.compete.under-saddle`
- `ui.destination.compete.conformation`

Training Center and Trainers for Hire require visibly different emblems. Training Center represents an arena/location; Trainers for Hire represents hireable human staff and skillsets.

### 8.2 Priority P1 — Stable Home

| Manifest key                 | Asset                                   | Working export / format                          | Layers and variants                                    |
| ---------------------------- | --------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| `scene.stable-home.desktop`  | Lantern Honors Yard desktop environment | 2560×1600 AVIF/WebP                              | No baked text or dynamic horses; safe zones documented |
| `scene.stable-home.mobile`   | Authored mobile recomposition           | 780×1688 AVIF/WebP                               | Not an automatic crop                                  |
| `ui.stable.threshold.base`   | Doorway interactive base                | Alpha WebP/PNG or SVG+raster hybrid              | Desktop/mobile placement variants                      |
| `ui.stable.threshold.glow`   | Lantern light-spill overlay             | Alpha WebP                                       | Rest, active; compositing cost tested                  |
| `ui.stable.threshold.sparks` | Restrained sparkle elements             | Small alpha sequence or CSS-positioned particles | Static reduced-motion frame required                   |
| `ui.stable.honors.first`     | First-place opening/frame               | Modular SVG + optional texture                   | Strongest rank silhouette; live horse and text         |
| `ui.stable.honors.secondary` | Second/third opening family             | Modular SVG                                      | Rank attachments remain separate                       |
| `ui.stable.rank.first`       | First-place ornament                    | SVG / alpha WebP                                 | Earned gold prestige                                   |
| `ui.stable.rank.second`      | Second-place ornament                   | SVG / alpha WebP                                 | Silver hierarchy                                       |
| `ui.stable.rank.third`       | Third-place ornament                    | SVG / alpha WebP                                 | Bronze hierarchy                                       |
| `ui.stable.points-plate`     | Nightly-points sill/plate               | Modular SVG                                      | Live points and rank text                              |
| `ui.stable.rounds.shell`     | Hanging Stable Rounds slate and bracket | Modular SVG + texture                            | Desktop/mobile assembly; 3×44px rows                   |
| `ui.stable.rounds.care`      | Requires Care icon                      | SVG                                              | Written label remains visible                          |
| `ui.stable.rounds.train`     | Can Train icon                          | SVG                                              | Distinct from Training Center emblem                   |
| `ui.stable.rounds.breedable` | Breedable Mares icon                    | SVG                                              | No sex meaning by color alone                          |
| `ui.stable.honors.fallback`  | Non-prestige resident opening treatment | Modular SVG                                      | No rank, ornament, or points                           |

### 8.3 Priority P1 — Portrait Roster

| Manifest key                  | Asset                          | Format / assembly            | Variants and notes                                          |
| ----------------------------- | ------------------------------ | ---------------------------- | ----------------------------------------------------------- |
| `ui.roster.canopy`            | Shared celestial barn canopy   | Repeatable SVG/raster hybrid | Desktop/mobile density variants                             |
| `ui.roster.support`           | Slender bay support            | Repeatable SVG               | Must not create floor-to-ceiling cages                      |
| `ui.roster.sill`              | Engraved live-information sill | Nine-slice SVG/raster hybrid | Safe insets for name, identity, three states                |
| `ui.roster.bay-mask`          | Horse artwork mask             | SVG mask                     | Portrait safe area; no aggressive crop                      |
| `ui.roster.barn-rail.desktop` | Slim six-barn rail             | Modular SVG                  | One row                                                     |
| `ui.roster.barn-rail.mobile`  | Compact six-barn rail          | Modular SVG                  | Two 42px rows; fixed geometry                               |
| `ui.roster.barn.all`          | All Horses emblem              | SVG                          | 16–20px visible size                                        |
| `ui.roster.barn.mares`        | Mares emblem                   | SVG                          | Not color-only                                              |
| `ui.roster.barn.stallions`    | Stallions emblem               | SVG                          | Not color-only                                              |
| `ui.roster.barn.colts`        | Colts emblem                   | SVG                          | No blue coding dependency                                   |
| `ui.roster.barn.fillies`      | Fillies emblem                 | SVG                          | No pink coding dependency                                   |
| `ui.roster.barn.retired`      | Retired emblem                 | SVG                          | Peaceful pasture/rest meaning                               |
| `ui.roster.mode-control`      | Portrait/Ledger control shell  | SVG                          | Live labels and selected semantics                          |
| `ui.roster.refine-control`    | Refine Roster plate            | SVG                          | Written label required                                      |
| `ui.roster.state.care`        | Care state icon family         | SVG                          | Well and Needs Care attachments                             |
| `ui.roster.state.training`    | Training state icon family     | SVG                          | Ready/cooldown meaning with text                            |
| `ui.roster.state.breeding`    | Breeding state icon family     | SVG                          | Breedable/In Foal/At Stud/Too Young with text               |
| `ui.roster.art-fallback`      | Missing-art crest              | SVG + live initial           | Breed silhouette plus live initial; not a broken-image icon |
| `ui.roster.loading-bay`       | Loading material treatment     | CSS + optional texture       | Fixed dimensions; no fake horse data                        |

### 8.4 Priority P2 — Ledger, Refine, and supporting states

| Manifest key               | Asset                               | Format / assembly       | Notes                                      |
| -------------------------- | ----------------------------------- | ----------------------- | ------------------------------------------ |
| `ui.ledger.header-rule`    | Stable-record header rule           | Repeatable SVG          | Real table remains DOM                     |
| `ui.ledger.frozen-edge`    | Frozen identity-column edge         | SVG/CSS gradient        | Must remain clear during horizontal scroll |
| `ui.ledger.continuation`   | More-columns cue                    | CSS gradient + ornament | Not the only accessibility cue             |
| `ui.ledger.thumbnail-mask` | 40–48px horse thumbnail treatment   | SVG mask                | Artwork optional; identity remains text    |
| `ui.refine.steward-board`  | Bracket-mounted hanging board       | Modular SVG + texture   | Explicit close; desktop only               |
| `ui.refine.mobile-header`  | Dedicated Refine destination header | SVG accents + DOM       | Not a drawer/sheet silhouette              |
| `ui.empty.stable-interior` | Empty barn scene                    | AVIF/WebP               | No implied six-horse capacity              |

### 8.5 Priority P3 — Equoria Town

| Manifest key                             | Asset                              | Working export / format | Notes                                |
| ---------------------------------------- | ---------------------------------- | ----------------------- | ------------------------------------ |
| `scene.town.desktop`                     | Service-quarter master map         | 2560×1600 AVIF/WebP     | All six destinations visible         |
| `scene.town.mobile`                      | Authored mobile-safe recomposition | 780×1688 AVIF/WebP      | No panning; no replacement card list |
| `scene.town.hotspot.feed-shop`           | Feed Shop illumination             | Alpha WebP/SVG mask     | Rest remains identifiable            |
| `scene.town.hotspot.tack-shop`           | Tack Shop illumination             | Alpha WebP/SVG mask     | Focus ring survives artwork          |
| `scene.town.hotspot.veterinarian`        | Veterinarian illumination          | Alpha WebP/SVG mask     | Uses canonical exterior              |
| `scene.town.hotspot.training-center`     | Training Center illumination       | Alpha WebP/SVG mask     | New exterior commission              |
| `scene.town.hotspot.breeding-specialist` | Breeding Specialist illumination   | Alpha WebP/SVG mask     | New exterior commission              |
| `scene.town.hotspot.leathersmith`        | Leathersmith illumination          | Alpha WebP/SVG mask     | New exterior commission              |

## 9. Horse Artwork Delivery Contract

Each horse artwork record should be addressable through stable manifest roles rather than raw filenames:

- `portrait` — Roster-first composition
- `landscape` — Stable honors composition
- `thumbnail` — Ledger-safe derivative
- `hero` — future Horse Profile role after that composition is approved

Each role declares:

- Intrinsic width and height
- Focal point
- Safe bounding box for ears, muzzle, legs, and tail
- Background treatment
- Fallback key
- Preferred loading priority

Transparent cutouts are not required for the core Roster. They remain selective prestige assets.

## 10. File and Export Standards

- SVG: engraved linework, emblems, ornaments, masks, repeatable edges, and state overlays.
- AVIF/WebP: painterly environments and large opaque texture fields.
- Alpha WebP or PNG: painterly transparent overlays where SVG cannot retain the desired texture.
- Keep source masters separate from runtime exports.
- Do not rasterize live text or values.
- Avoid one giant UI atlas for unrelated routes; load by domain and priority.
- Document color profile, export scale, transparent padding, and safe insets beside every delivered asset family.
- Test SVG complexity and raster decode cost on representative phones before simplifying art.

Suggested runtime organization:

```text
frontend/public/assets/ui/
  shell/
  stable/
  roster/
  ledger/
  refine/
  town/
frontend/public/assets/scenes/
  stable-home/
  town/
```

The manifest, not these filenames, is consumed by components.

## 11. High-Fidelity Vertical Slice Deliverables

Produce these as one coherent review package:

1. Stable Home desktop, normal nightly-results state
2. Stable Home mobile, normal nightly-results state
3. Stable Home mobile, no-shows fallback
4. Portrait Roster desktop at top
5. Portrait Roster desktop after scrolling
6. Portrait Roster mobile at top
7. Portrait Roster mobile after scrolling
8. WORLD submenu open on desktop
9. WORLD submenu open on mobile
10. Interaction sheet: HUD medallion, realm emblem, destination, threshold, honors opening, barn choice, portrait bay
11. Reduced-motion threshold and selected-navigation examples
12. Loading and missing-art Portrait examples

Every high-fidelity frame must use representative live text lengths and show its intended 44px hit areas separately from its visible artwork.

## 12. Vertical Slice Acceptance Gate

The slice is ready for interaction prototyping only when all are true:

- Stable Home reads as a location before it reads as information.
- Removing the scene art would remove the composition rather than reveal a complete dashboard underneath.
- The threshold is discoverable without becoming a generic CTA block.
- Honors look embedded in stable architecture and first place is visibly dominant.
- Stable Rounds is one environmental fixture, not three KPIs.
- Portrait Roster shows two phone columns without losing all three written states.
- The barn rail remains 84px tall and unchanged during scrolling.
- Horse artwork is the dominant repeated visual in Portrait mode.
- No card, pill, or generic icon library becomes the dominant language.
- Full realm and destination labels remain readable on phone.
- All five HUD controls survive at 360px without overlapping targets.
- Focus, touch, loading, missing-art, and reduced-motion states are shown—not postponed to implementation.
- The visual family can plausibly extend to Ledger and Refine without turning those dense surfaces into ornate noise.

## 13. Review Decisions Required Before Final Asset Production

The high-fidelity vertical slice should resolve, with the user:

- Exact stable environment composition and art-safe zones
- Degree of timber versus indigo slate in the Roster gallery
- Final shape and ornament density of the realm ribbon
- Final realm and destination emblem family
- Final honors rank treatment
- Final Stable Rounds silhouette
- Whether mobile Town location names remain environmental signs
- Final production export sizes after representative-device testing

These decisions must be made from rendered high-fidelity examples. They must not be silently decided by implementation convenience.
