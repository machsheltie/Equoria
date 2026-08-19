---
name: Equoria
description: Celestial Night — a lantern-lit stable under a star field, where gold marks what was earned.
colors:
  lantern-gold: '#c8a84e'
  lantern-gold-light: '#e8d48b'
  lantern-gold-bright: '#f5e6a3'
  lantern-gold-dim: '#8b7635'
  wordmark-gold: '#d4a843'
  ember-gold: '#c9a227'
  stable-midnight: '#0a0e1a'
  night-sky: '#0a1628'
  midnight-panel: '#0f2346'
  twilight: '#243154'
  surface-slate: '#1e293b'
  frosted-panel: 'rgba(15, 23, 42, 0.6)'
  frosted-panel-heavy: 'rgba(15, 23, 42, 0.85)'
  frosted-panel-subtle: 'rgba(15, 23, 42, 0.4)'
  frosted-border: 'rgba(148, 163, 184, 0.2)'
  moonlit-slate: '#dcebff'
  muted-slate: '#94a3b8'
  dim-slate: '#64748b'
  celestial-blue: '#3a6fdd'
  celestial-secondary: '#10b981'
  status-success: '#22c55e'
  status-warning: '#f59e0b'
  status-danger: '#ef4444'
  status-info: '#3b82f6'
  status-rare: '#a78bfa'
  status-legendary: '#f5e6a3'
  tier-silver: '#c4ccd6'
  tier-bronze: '#cd7f4a'
typography:
  wordmark:
    fontFamily: 'Dragon Tales, Cinzel Decorative, serif'
    fontSize: '2.25rem'
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: '0.05em'
  announcer-major:
    fontFamily: 'Basteleur Bold, Georgia, serif'
    fontSize: '2.441rem'
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: 'normal'
  announcer-secondary:
    fontFamily: 'Basteleur Moonlight, Georgia, serif'
    fontSize: '1.563rem'
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: 'normal'
  enchanted-accent:
    fontFamily: 'Whisperleaf, Georgia, serif'
    fontSize: '1.25rem'
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: 'normal'
  functional-title:
    fontFamily: 'Proda Sans, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 'normal'
  button-text:
    fontFamily: 'Proda Sans, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 600
    lineHeight: 1
    letterSpacing: '0.02em'
  body:
    fontFamily: 'Proda Sans, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  label:
    fontFamily: 'Proda Sans, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '0.05em'
  ledger:
    fontFamily: 'Artavion Mono, monospace'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
rounded:
  sm: '6px'
  md: '12px'
  lg: '16px'
  xl: '24px'
  full: '9999px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '24px'
  '6': '32px'
  '7': '48px'
  '8': '64px'
components:
  button-primary:
    backgroundColor: '{colors.lantern-gold}'
    textColor: '{colors.stable-midnight}'
    typography: '{typography.button-text}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '44px'
  button-primary-hover:
    backgroundColor: '{colors.lantern-gold-light}'
    textColor: '{colors.stable-midnight}'
  button-secondary:
    backgroundColor: '{colors.frosted-panel-subtle}'
    textColor: '{colors.moonlit-slate}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '44px'
  button-outline:
    backgroundColor: 'transparent'
    textColor: '{colors.moonlit-slate}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '44px'
  button-destructive:
    backgroundColor: 'rgba(224, 90, 90, 0.15)'
    textColor: '{colors.status-danger}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '44px'
  input-field:
    backgroundColor: '{colors.frosted-panel}'
    textColor: '{colors.moonlit-slate}'
    rounded: '{rounded.md}'
    padding: '8px 12px'
  badge-default:
    backgroundColor: 'rgba(200, 168, 78, 0.15)'
    textColor: '{colors.lantern-gold-light}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '2px 10px'
  surface-panel:
    backgroundColor: '{colors.frosted-panel}'
    textColor: '{colors.moonlit-slate}'
    rounded: '{rounded.md}'
    padding: '24px'
  surface-overlay:
    backgroundColor: '{colors.frosted-panel-heavy}'
    textColor: '{colors.moonlit-slate}'
    rounded: '{rounded.lg}'
    padding: '24px'
---

# Design System: Equoria

## Overview

**Creative North Star: “The Enchanted Equestrian Night”**

Equoria is a beautiful horse world after dusk: moonlit barns, glowing windows, old-world shops, mountain valleys, horse constellations, luminous plants, lantern light, and small touches of wonder woven into recognizable equestrian life. It is grounded enough to feel inhabited and magical enough to feel worth escaping into.

The world is **not** medieval fantasy, an RPG, a historical reenactment, or a luxury equestrian brand. Its magic is atmospheric rather than plot-driven: starlight, moon glow, painterly scenery, old-world warmth, whimsical detail, handcrafted typography, and the sense that ordinary horse life is happening somewhere just slightly more wonderful than our own.

**The interface belongs to that world.** Environment art is not wallpaper behind a neutral software product. UI typography, composition, ornament, transitions, surfaces, and moments of delight must participate in the same visual register.

Creative success is not merely the absence of violations. A screen that is technically compliant but generic, emotionally flat, card-grid-heavy, visually interchangeable with a SaaS product, or disconnected from the environment artwork has failed this design system.

Equoria is designed for players who want to inhabit a beautiful horse world, not merely manage horse data. The target experience is grown-up horse-girl escapism: sophisticated enough for adults, emotionally rich enough to preserve the collecting, dreaming, decorating, breeding, and horse-obsession energy that made horse games compelling in the first place.

### Explicitly Required Qualities

These are requirements, not optional flourishes:

- **Wonder** — the interface should periodically create a small sense of discovery or enchantment: an unexpected celestial detail, a beautifully staged reveal, an elegant transition into a location, a horse name given room to feel important, or a quiet visual surprise. Wonder is selective; it is not constant animation.
- **Beauty** — composition, typography, spacing, image treatment, and hierarchy should feel deliberately art-directed. “Clean” is not enough. A screen should reward looking at it.
- **Warmth** — despite the night palette, Equoria should feel inviting rather than cold. Lantern gold, warm interiors, wood-and-light cues from artwork, friendly copy, and generous visual breathing room keep the world humane.
- **Whimsy** — subtle playfulness and charm are welcome: expressive typography, unusual but fitting decorative details, delightful labels, small visual jokes, or storybook touches. Whimsy must fit the world, not look childish.
- **Specificity** — generic UI patterns are not a virtue. A breeding screen should feel like breeding, a tack shop should feel like a tack shop, and the Hall of Fame should feel like an honored place. Avoid interchangeable page templates where only the nouns change.
- **Visual authorship** — screens should look designed for Equoria by someone with a point of view. Prefer deliberate asymmetry, composition, image integration, bespoke framing, custom hierarchy, and thematic details over default component-library arrangements.
- **Moments of delight** — rewards, reveals, arrivals, achievements, new foals, championship results, and other emotionally important moments should receive visual treatment proportional to their meaning. Delight should also appear in small ways outside celebration surfaces.
- **Storybook atmosphere** — the UI may echo the illustrated world through framing, spacing, ornament, type, and scenic composition. It should feel like entering a beautiful illustrated horse world, not opening an admin dashboard.
- **Typographic personality** — expressive faces are an intentional part of the game’s voice. Typography may be magical, decorative, or unusual when the semantic role and actual rendered size support it.

### Explicitly Rejected

1. **Generic dark-mode SaaS** — the most egregious failure. Flat slate card grids, bento layouts, dashboard tiles, blue-accent admin patterns, identical containers around every section, and “clean product UI” that could belong to a tax app after a color swap are rejected. This explicitly includes shadcn/ui as a visual default.

2. **Card-first composition** — cards are one tool, not the default layout primitive. Do not put every statistic, action, subsection, piece of text, or image in its own rounded rectangle. Avoid endless stacks of same-weight cards, four-up KPI tiles, bento dashboards, and “one component per box” composition. Use open layout, scenic framing, dividers, image-led sections, layered regions, typography, negative space, lists, ribbons, ledgers, timelines, shelves, sign-like treatments, or purpose-built structures when they better fit the game task.

3. **Genre-fantasy costume** — magical atmosphere is encouraged; fantasy cosplay is not. Avoid blackletter, rune alphabets, parchment UI, scroll edges, faux-medieval metalwork, heraldic overload, tavern-menu styling, swords-and-sorcery motifs, or anything that implies quests, wizards, kingdoms, or historical role-play.

4. **Loud casual-mobile-game noise** — no permanent bounce, cartoon gradients, confetti wallpaper, hyper-saturated reward clutter, or constant attention-seeking motion. Reward/reveal moments may become louder because they are earned and bounded.

### Named Creative Rules

**The Magic Is Not Genre Rule.** “Magical,” “storybook,” “whimsical,” “enchanted,” and “fantasy-adjacent” are not synonyms for “fantasy RPG.” Do not suppress ornament, curls, unusual lettering, celestial motifs, or old-world character merely because they are expressive. Reject a treatment only when the _whole result_ communicates the wrong genre.

**The Artwork Sets the Register Rule.** Environment art is primary art-direction evidence. When generic design-system guidance conflicts with the established atmosphere of the artwork, the artwork is the stronger evidence of intended tone.

**The Art Direction Precedence Rule.** Generic design-system heuristics are advisory, not governing. Minimal font count, conventional component patterns, hypothetical future scalability, and industry-standard aesthetics do not override Equoria’s established creative direction. “Less conventional” is not itself a defect. “More reusable” is not itself a virtue.

**The No Invented Governance Rule.** An agent may identify a concern, but it may not turn its own concern into a new project rule and then use that rule to veto creative direction. New restrictions on art direction, tone, typography, visual language, or expressive range require an explicit user ruling.

**The No SaaS-by-Stealth Rule.** Rejecting SaaS colors while preserving SaaS composition is still SaaS. A navy-and-gold dashboard made of generic cards, KPI tiles, tabs, and form panels is not Equoria merely because the palette is correct.

**The Specific Screen Rule.** Start from what the player is doing and what the place means, not from a generic page template. Location pages, horse identity pages, breeding, competition, marketplace, Hall of Fame, stable management, and records may require different compositions. Shared primitives are allowed; repeated page choreography is not mandatory.

**The Delight Is Functional Rule.** Beauty, charm, and atmosphere are product requirements because Equoria is entertainment. A choice may be justified because it creates delight, provided it does not create a concrete usability or accessibility failure.

### Key Characteristics

- Near-black navy ground, with real per-scene artwork carrying the sky and location atmosphere
- Lantern gold as the primary accent, rationed by meaning rather than removed in the name of restraint
- Scenic, layered, image-aware page composition instead of universal card grids
- Dragon Tales for the EQUORIA identity
- Basteleur Bold (distinct family/file) for major ceremonial/world arrivals
- Basteleur Moonlight (distinct family/file) for entity names and important secondary headings
- Whisperleaf for a few short enchanted accents where readability is proven
- Proda Sans for functional UI, body copy, controls, labels, tabs, ordinary dialogs, and stats
- Artavion Mono for registry/genetics/record data
- Horseshoe arcs as a primary-button signature, not the entire visual identity
- Depth by tonal layering first, shadow second, glow where it carries meaning
- 44px touch targets and visible focus states on phone and desktop
- Typography, imagery, and composition should make the interface feel as authored as the artwork

## Colors

A single warm accent held against a cold, near-black sky — the palette has one voice, and everything else is atmosphere or status.

### Primary

- **Lantern Gold** (#c8a84e): the accent. Primary button fill, active navigation accents, section-header icons, featured-panel borders and glow. **7.91:1** on the night ground.
- **Lantern Gold Light** (#e8d48b): the emphasis gold — for text that must carry against a busy or crowded surface. Ghost and link _button_ variants, accent body copy. **12.28:1**. **Not the default for links:** inline text links use Lantern Gold (see below).

> **Inline links are Lantern Gold** (user ruling, 2026-08-17; `--link-gold` resolves to `--gold-primary`). Both golds clear AA at 12px — 7.91:1 and 12.28:1 — so this was hierarchy, not contrast. Lantern Gold Light was rejected on three counts: it dilutes _gold means one thing_, it reads as **pre-hovered** — already lit before the cursor arrives — and it is simply harsher against Muted Slate body text. The ghost/link **Button** variants keep Lantern Gold Light because they sit on busy panels where the extra separation earns its keep; an inline link inside a paragraph does not have that problem.

- **Lantern Gold Bright** (#f5e6a3): high-emphasis and active states, focus rings, legendary/ultra-rare emphasis. **14.44:1**.
- **Lantern Gold Dim** (#8b7635): decorative borders, inactive gilt, the shadow end of gold gradients. **4.09:1 — decorative only, never carries text.** It is the one gold that fails the body floor.
- **Ember Gold** (#c9a227): **ambient warmth — glows, drop-shadows, soft panel borders and low-alpha tints.** Light that spills, as opposed to a surface you act on. **7.49:1** on the night ground. Visibly hotter than Lantern Gold (blue channel 39 against 78; **ΔE 14.3**, nearly twice the wordmark gold's distance from canonical) — this is a distinct colour, not a rounding error. It carries the primary button's own drop-shadow, the footer divider and glow, and the warm tinting on the breeding, foal and hub surfaces. **Named 2026-08-17 after hiding from three separate gold sweeps:** 76 of its 78 occurrences are written `rgba(201,162,39,*)`, never as a hex, so every search for `#d4a843` or `212,168,67` walked straight past it. Lantern Gold remains the colour of definite things — button fills, active states, icons, focus. **Floor: 15%.** Below that the two golds measure under the just-noticeable threshold on the panel ground (ΔE 2.2 at 10%), so a tint that faint cannot be a deliberate choice of the warmer gold — the 3–12% tiers were retired to canonical by user ruling 2026-08-18. New Ember usage starts at 15%.
- **Wordmark Gold** (#d4a843): **an identity colour, not a UI colour** (user ruling, 2026-08-17). The warmer legacy gold, chosen by eye in the 2026-08-14 wordmark fitting A/B, kept because that choice was made on the letterforms themselves. It exists in exactly one place — the mid-stop of `--gradient-wordmark` — and has exactly one job. 8.19:1 on the night ground, ΔE 8.0 from Lantern Gold: close enough to belong to the same family, far enough to see side by side. **It never sets text, borders, icons, or fills.** Anything in the interface uses Lantern Gold.

### Secondary

- **Celestial Blue** (#3a6fdd): the cool counter-accent. Focus glow on non-gold surfaces, electric highlights, informational emphasis, onboarding spotlight rings. Deliberately _not_ used on primary actions — gold owns action, blue owns attention.
- **Celestial Secondary** (#10b981): the emerald end of progress-fill gradients — today the FenceJumpBar fill, paired with Celestial Blue. Minted 2026-08-17 (user ruling) to make a phantom token real: `--celestial-secondary` was consumed but never defined, so this value already rendered via its fallback. Gradient-fill use only — never text, never an action colour.

### Tertiary

- **Discipline accents**: dressage violet (#7c5cbf), show-jumping green (#2e8b57), racing red (#c0392b), cross-country ochre (#8b6914), western brown (#7b3f00), endurance teal (#1a7a7a). Each identifies a competition discipline on action buttons and nowhere else.
- **Rarity and tier**: rare violet (#a78bfa), legendary pale gold (#f5e6a3), plus podium metals — Lantern Gold for first, **Silver** (#c4ccd6) for second, **Bronze** (#cd7f4a) for third.

### Neutral

- **Stable Midnight** (#0a0e1a): the void. Body background, outermost layer, the ground everything else sits on.
- **Night Sky** (#0a1628): page containers and the primary background players actually look at.
- **Midnight Panel** (#0f2346): card interiors and secondary panels.
- **Twilight** (#243154): hover states and active sections — the lift color.
- **Frosted Panel** (rgba(15, 23, 42, 0.6)): the glass fill. Its subtle (0.4) and heavy (0.85) siblings carry nesting and overlays.
- **Frosted Border** (rgba(148, 163, 184, 0.2)): the soft blue-white edge that defines every glass surface.
- **Moonlit Slate** (#dcebff): primary text. **15.00:1** — AAA.
- **Muted Slate** (#94a3b8): secondary and supporting text. **7.07:1** — AA.
- **Dim Slate** (#64748b): timestamps and metadata. **3.81:1 — below the 4.5:1 floor, so large text only.** It is not safe for the small metadata it is often reached for; use Muted Slate there.

### Status

Success green (#22c55e) for healthy, complete, eligible. Warning amber (#f59e0b) for cooldown active and needs-attention. Danger red (#ef4444) for injured, ineligible, error. Info blue (#3b82f6) for neutral informational states. Each pairs with a 15% background tint and a 30%-alpha border of the same hue.

### Named Rules

**The One Gold Action Rule.** Exactly one gold primary action per workflow surface. Navigation and cancellation are secondary, outline, or link. Destructive actions never take the gold treatment — an irreversible action must not look like the recommended one.

> **Confirmed exception — the horse detail Quick Actions Bar** (user directive, confirmed 2026-08-14; `pages/HorseDetailPage.tsx`). **Train This Horse** and **Enter Competition** are _both_ gold primaries there; View Parents stays secondary. The reasoning is that a horse's detail page has two genuinely co-equal destinations — the horse exists to be trained and to be competed — and forcing a rank between them misrepresents the product rather than clarifying it.
>
> This is the only sanctioned exception. It is a surface-specific ruling, not a softening of the rule: **two golds require a user decision, never an agent's judgement**, and a third gold on that bar would still be wrong. If you are adding a second gold primary anywhere else, you are violating the rule — ask.

**The Gold Text Floor Rule.** _(Relaxed by user ruling, 2026-08-13.)_ **Lantern Gold (#c8a84e) is cleared for body-size text** — it measures **7.91:1** on the night ground, comfortably past AA and near AAA. The floor is one step lower than the palette suggests: **Lantern Gold Dim (#8b7635) is the only gold that may not carry text at any size** (4.09:1 — under the 4.5:1 body floor, and large-text-only at best). It stays decorative: borders, inactive gilt, the shadow end of gradients.

The rule previously forbade Lantern Gold for body copy on the strength of a 4.2:1 figure annotated in `tokens.css`. That figure was wrong — every contrast comment in that file is understated by 1.3–1.5× (`Equoria-kcau0`). **Do not cite 4.2:1 anywhere.** Choosing Lantern Gold Light or Bright for a piece of text is now an emphasis decision, not a compliance one; the ghost and link button variants keep the light gold because it reads better against a busy panel, not because the primary gold would fail.

**The Discipline Containment Rule.** Discipline accent colors appear on action buttons only. They are forbidden in navigation, sidebar active states, tab indicators, and breadcrumbs — chrome stays gold-and-navy so discipline color always means "this competition," never "you are here."

**The One Palette Rule.** There is exactly one color system: the Celestial Night tokens in `tokens.css`. The parallel shadcn-style RGB-triplet layer in `index.css` (`--background`, `--foreground`, `--primary`, `--muted`, and their Tailwind utilities `bg-primary`, `text-primary`, `border-primary`) is deprecated and being removed. It defines a _second, contradictory_ primary — cobalt `#2563eb` by way of `--forest-green` — so a component styled with those utilities is not in this design system at all. New code uses `var(--gold-primary)` and its siblings; nothing new consumes the triplet layer.

**The Never-Color-Alone Rule.** Every status, error, and empty state pairs its color with an icon and text. The game's own content is color-coded (coat genetics, care status, rarity), so color as the sole signal collides with real data.

## Typography

**The Typography Principle:** Use as few fonts as necessary — but as many as the art direction actually benefits from.

Font count is not a success metric. Ambiguous roles, unreadable text, arbitrary usage, and stylistic inconsistency are the failures to avoid.

Fonts attach to **semantic roles**, not HTML heading levels and not a universal “fantasy” class.

### UI Typography Roles

> **Implementation note:** `Basteleur Bold` and `Basteleur Moonlight` are separate font families/files. Treat them as separate `@font-face` family names and separate semantic tokens. Do not declare them as weights of a shared `Basteleur` family unless the actual font files themselves prove they share one internal family name and render correctly that way.

**Wordmark — Dragon Tales**

- EQUORIA auth/login wordmark
- navigation brand mark
- footer brand mark
- nothing else
- single weight is intentional; never synthesize bold

**Major Announcer — Basteleur Bold**
Basteleur Bold is a distinct font family/file, not a weight of Basteleur Moonlight.

Use for strong world-facing or ceremonial moments:

- The World of Equoria
- Vet Clinic
- Tack Shop
- Feed Shop
- The Farrier
- Breeding Hall
- Training Grounds
- Competition Arena
- Rider Hall
- Trainer Academy
- Groom Quarters
- Leathersmith Workshop
- Horse Trader
- The Vault
- championship, birth, major reward, level-up, and similar cinematic announcements
- optional in-content Hall of Fame title

Typical range: approximately 24–39px, adjusted by real rendering rather than forced scale purity.

**Secondary Announcer / Entity Voice — Basteleur Moonlight**
Basteleur Moonlight is a distinct font family/file, not a lighter weight of Basteleur Bold.

Use for:

- horse and foal names in identity-focused headers
- prominent horse-card names
- retired/champion horse names in Hall of Fame
- important section headings
- Genetic Overview
- Lineage & Genetic Contribution
- Trait Development Timeline
- Trait Interactions
- Development
- Family Tree
- Current Status
- Equipped Tack
- substantial panel or feature titles
- result/reward/reveal dialog titles where ceremony is appropriate

Typical range: approximately 20–31px.

Dense selectors, tables, transaction rows, assignment lists, search results, and editable horse-name fields remain Proda Sans even when they contain horse names.

**Enchanted Accent — Whisperleaf**
Whisperleaf is opt-in and specialist, not a replacement for every decorative class.

Candidate uses:

- Featured Companion
- Chronicles
- Your Adventure Begins
- Trait Discovery
- short shop-sign-like labels over authored location art
- a rare short Hall of Fame or event epithet
- short phrases where the distinctive ampersand becomes part of the visual signature

Restrictions:

- short strings only
- never dynamic long names
- never controls, tabs, status text, confirmations, or data
- never below its proven readability floor
- never chosen merely because “a decorative font is needed”

**Functional UI / Body — Proda Sans**
Use for:

- body copy
- all navigation and breadcrumbs
- tab triggers
- every button variant
- forms and field labels
- ordinary dialog titles
- small card labels
- editable horse-name fields
- statuses
- scores
- prices
- percentages
- counts
- cooldowns
- fees and totals
- toasts and notification titles
- ordinary operational page titles such as Settings, Messages, Inventory, Profile, Clubs, Community, Prize History, Equip, and dynamic message-thread titles

Proda numeric columns and aligned stats MUST request `font-variant-numeric: tabular-nums`; its `tnum` feature is present and verified.

**Ledger / Registry — Artavion Mono**
Use for recorded technical facts:

- genotype notation and allele pairs
- registry IDs
- transaction references
- lineage record references
- selected locus symbols where useful

Do not use it for ordinary scores, prices, counts, buttons, navigation, body text, or “technical-looking” decoration.

### Hierarchy by Meaning

The expressive gradient is:

**Identity → ceremonial → atmospheric → functional → recorded data**

A horse name or Hall of Fame title is not the same typographic job as a tab label merely because both are headings.

Functional density moves typography toward Proda Sans. Narrative, identity, world-building importance, and ceremony may move it toward Basteleur Bold, Basteleur Moonlight, or the enchanted accent role.

### Named Rules

**The Wordmark Rule.** Dragon Tales renders EQUORIA and brand echoes only. Its exclusivity is about identity recognition, not a finite “decoration budget.”

**The Expressive Gradient Rule.** Assign typography according to the player’s experience of the text, not the tag name, legacy CSS class, or desire to minimize font families.

**The Specialist-Font Rule.** A specialist face needs only the styles its role actually uses. Never reject a one- or two-style family merely because it lacks unused weights. Never synthesize missing weights.

**The Functional Floor Rule.** Do not force Basteleur Bold, Basteleur Moonlight, or Whisperleaf into small functional UI merely to preserve family consistency. Below the point where expression harms clarity, use Proda Sans.

**The No Universal Heading Rule.** Do not assign a decorative family to all `h1`–`h6` elements globally. Heading level expresses document structure; typographic role expresses visual meaning.

**The Legacy-Class Rule.** `.fantasy-title` is not a semantic role and must not be globally remapped. Its occurrences are migrated one at a time according to actual use, then the class is retired.

**The Record Rule.** Recorded facts use Artavion Mono where fixed-width presentation helps the player read them as records. Everyday numbers remain Proda Sans + tabular figures.

### Migration Guidance from the Typography Audit

- Major world/location arrival titles and cinematic announcements → Basteleur Bold
- Horse/foal identity titles, prominent horse cards, Hall of Fame horse names, substantial sections → Basteleur Moonlight
- A few short magical accents → Whisperleaf by explicit opt-in
- Navigation, tabs, buttons, forms, ordinary dialogs, statuses, scores, prices, counts, percentages, cooldowns → Proda Sans
- Genotype, registry IDs, transaction refs, lineage record IDs → Artavion Mono
- Dragon Tales → EQUORIA brand marks only

`PageHeader` must not become Basteleur globally because it serves both ceremonial and functional pages. `PageHero`, `EntityHeader`, `PageHeader`, and ceremonial dialogs should expose explicit typography variants.

## Layout

The shell is a centered 1440px maximum with 16px gutters that open to 32px at the medium breakpoint; the layout owns those gutters absolutely. Inside it, content is constrained by one of four container widths: **narrow** (672px) for forms, settings, and focused account workflows; **content** (896px) for standard operational pages and detail reading; **wide** (1152px) for grids, marketplaces, and rosters; and **full** for the exceptional edge-to-edge tool.

Rhythm runs on an 8px base — 4, 8, 12, 16, 24, 32, 48, 64. Card padding is 16px, panel padding 24px, major section separation 32px, page-level separation 48px.

**Both phone and desktop are first-class.** CSS is mobile-first; the sidebar (280px) appears at the large breakpoint and the bottom navigation (56px) hides at the same moment. Card grids run 1 → 2 → 3 → 4 columns across the scale. Fixed bottom chrome reserves space for the iOS home-indicator inset and for the 60px contextual action bar, so content is never trapped underneath it. Breakpoints are the Tailwind defaults: 640 / 768 / 1024 / 1280 / 1536.

Three header families cover every page and they do not overlap: **PageHeader** for standard operational pages (title, optional subtitle, actions, metadata, breadcrumbs — compact, no artwork), **EntityHeader** for identity-centered detail pages (horse, foal, club — image, name, core metadata, entity actions), and **AuthHeader** for the wordmark-plus-context of authentication. A fourth, **PageHero**, is the allow-listed image-backed location header for world-service pages that have real artwork — the vet, the farrier, the shops. Its ceremonial treatment is **the gilt icon container and the gold gradient divider** (user ruling, 2026-08-13): the icon sits in a 46px container with a gold border at 45%, a 14% gold fill, and the resting gold glow; the divider is a 2px dim-gold → gold → dim-gold gradient beneath the title block. **Ambient mood orbs stay removed.** They sat on top of the location artwork and washed out the region the title occupies, and the artwork is the reason the header exists.

> **Implementation note.** The divider needs its own token. `--gradient-gold-accent` is reserved for button and badge use; give the divider a dedicated `--gradient-gold-divider` alias of the same ramp so the reservation stays honest rather than quietly broken.

### Composition Rules

**The Page Is Not a Dashboard Rule.** Do not default to a header followed by a grid of cards. Build the composition around the task and atmosphere of the screen.

**The Container Economy Rule.** Every border, panel, and rounded rectangle must earn its boundary. If spacing, typography, alignment, or a divider can establish grouping, prefer those lighter tools.

**The Scenic Integration Rule.** Where location artwork exists, design with it rather than covering it with opaque UI furniture. Preserve meaningful areas of the scene, place titles and actions intentionally against the composition, and use overlays only where readability requires them.

**The Repetition Test.** If several consecutive regions share the same rectangle, padding, title position, and shadow treatment, stop and ask whether the page has become a SaaS template.

### Named Rules

**The Shell Owns the Gutter Rule.** Horizontal padding and outer max-width belong to the layout shell. Page code never adds its own `max-w-* mx-auto px-*` wrapper, and content containers never add horizontal padding — only vertical rhythm.

**The Real-Screen Rule.** A layout is not done until it has been seen on a phone. Mobile is not a degraded copy of the desktop view; it is the same product at a different width.

## Elevation & Depth

Depth is built by **tonal layering first, shadow second, glow third**. The ground is Stable Midnight, page containers sit at Night Sky, panels at Midnight Panel, hover and active states at Twilight — four steps of lightening navy that read as depth before a single shadow is drawn. On top of that sits a frosted-glass family whose translucency does the rest of the work: light passes through a panel, so the layer beneath it is felt rather than hidden.

Shadow is a three-step structural ladder, not an expressive device. Gold glow is the third layer and the only one that carries meaning: **featured and hero surfaces hold a resting glow** as ambient warmth, while ordinary panels stay on the shadow ladder and receive glow only in response to hover, focus, selection, or reward.

### Shadow Vocabulary

- **Subtle** (`box-shadow: 0 1px 3px rgba(0,0,0,0.4)`): resting cards and nested surfaces.
- **Raised** (`box-shadow: 0 4px 12px rgba(0,0,0,0.5)`): hovered cards, dropdowns, popovers.
- **Floating** (`box-shadow: 0 8px 24px rgba(0,0,0,0.6)`): modals and overlays.
- **Glass inset** (`inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.2)`): the top-edge highlight that makes a frosted panel read as glass rather than as a flat translucent rectangle.
- **Gold glow** (`0 0 20px rgba(200,168,78,0.25)`): featured surfaces at rest; interactive surfaces on hover and focus.
- **Gold glow strong** (`0 0 30px rgba(200,168,78,0.4)`): celebrations and rare discoveries.
- **Celestial glow** (`0 0 40px rgba(59,130,246,0.2)`): informational highlights and onboarding spotlights.

### Named Rules

**The Single Blur Rule.** At most one active `backdrop-filter: blur()` layer is visible at any time. Blur is owned by the panel and overlay surfaces and by the layout's navigation and footer chrome. Page-local blur utilities are violations, and a blurred surface nested inside another blurred surface converts to the subtle variant.

**The Lift Belongs to Interactive Rule.** Only the interactive surface variant lifts (−2px) and glows on hover, and it does the same on keyboard focus so the two input methods match. Static cards never move. A page whose every card floats on hover has told the player nothing about what is clickable.

**The No-Bounce Rule.** _(User ruling, 2026-08-14 — permanent, not time-boxed.)_ **Bounce and elastic easing are retired from this system.** The `--ease-bounce` token is deleted, `--ease-reward` is an expressive ease-out (`cubic-bezier(0.22, 1, 0.36, 1)`), and `animate-bounce` has no consumers. Real objects decelerate; they do not spring back. Nothing bounces — not cards, not badges, not celebration moments, and above all **not a section of the page because the cursor entered it.** Hovering a region is not an event worth animating the region for; if a hover needs to say anything, it says it with a border, a glow, or the sanctioned −2px lift on something that is genuinely clickable. Reintroducing a spring curve is a regression, not a style choice.

**The Featured Glow Rule.** A resting gold glow marks a surface as featured: a gold border at 40% and the gold glow at 25%, escalating on hover to a solid gold edge and the strong glow at 40%. **One featured surface per screen — no exceptions.** If everything glows, nothing is featured; the glow is a designation, not a finish. Because a featured panel now glows before anyone touches it, glow no longer means "clickable" on its own — the −2px lift carries that signal alone, so an interactive featured panel must still lift.

## Shapes

The form language is **rounded rectangles with gilt edges**. Corners run a four-step scale: 6px for badges, chips, and stat bars; 12px for buttons, inputs, and cards; 16px for content panels and framed tools; 24px for modals and hero panels. Full-round is reserved for genuinely circular things — avatars, status dots, toggles — and for badges, where the pill is the semantically correct form.

Buttons are rounded rectangles at 12px. Pill-shaped buttons are an explicit opt-in for compact filter chips and segmented options, never the default. Borders are 1px and nearly always the soft blue-white frosted edge; gold borders mark featured, accent, and primary surfaces specifically.

The recurring signature is the **horseshoe arc** — two 12×20px half-ellipse arcs, gold, inset 12px from each end of a primary button, at 50% opacity rising to full on hover. It is the one piece of literal equestrian iconography in the entire chrome, and it earns its place by being small, structural, and applied to exactly one thing.

### Named Rules

**The Rounded-Rectangle Rule.** Buttons are 12px rounded rectangles. A pill is a deliberate opt-in with a semantic reason, not a default and not a style preference.

**The Horseshoe Signature Rule.** Arcs appear only on the gold primary variant at default, large, and extra-large sizes — never on small or icon buttons, where the arc collides with the touch-target expander and floats a stray gold circle above the control.

## Components

Components should feel **authored for a magical horse world**, not imported from a productivity app and recolored. Controls must be clear and tactile, but clarity does not require visual neutrality.

A component may borrow from the atmosphere of Equoria through subtle gilt details, celestial accents, image-aware framing, elegant typography, or bespoke interaction states. The goal is not to make every control ornate. The goal is to make the _system as a whole_ feel like it belongs inside the illustrated world.

Equoria is not an equestrian luxury brand, registry institution, or heritage tack company. Real-world equestrian references ground the world; they do not define its entire aesthetic. Do not prefer a treatment merely because it resembles brass plaques, saddlery branding, racing-club stationery, or stud-book typography.

**Cards are not the default unit of composition.** Use a card when content genuinely benefits from containment, grouping, portability, or interaction. Otherwise prefer open sections, image-led composition, lists, timelines, ledgers, shelves, ribbons, banners, scenic overlays, dividers, anchored side regions, or purpose-built structures. A page made of ten slightly different rounded rectangles is a design failure even if each card individually follows the token system.

### Buttons

- **Shape:** rounded rectangle (12px). Heights are 44px default, 36px small with a hit-area expander to 44px, 48px large, 56px extra-large, 44×44px icon.
- **Primary:** a left-to-right gold gradient from Lantern Gold to Lantern Gold Light, Stable Midnight text, Proda Sans 600 with wide tracking, a warm gold drop shadow, and the horseshoe arcs. Hover raises brightness 10% and deepens the shadow; press scales to 0.98.
- **Secondary:** the subtle frosted surface with a 30%-alpha gold border and Moonlit Slate text. Hover brightens the border to 55% and darkens the fill.
- **Outline:** transparent with a pale navy border; hover shifts both border and text to gold.
- **Ghost / Link:** no fill, Lantern Gold Light text, underline on hover. Link keeps square corners and zero horizontal padding at all times.
- **Destructive:** a 15% red fill with a solid red border and red semibold text. Never gold, never gradient.
- **Focus:** a 2px Lantern Gold Bright ring, offset 2px against the Stable Midnight ground — on every variant, no exceptions.
- **Pending:** the spinner replaces the label in place while the button keeps its exact dimensions, sets `aria-busy`, and locks against activation.
- **Disabled:** 40% opacity with muted text and no pointer events.

### Cards / Containers

**Containment is semantic, not decorative.** Do not wrap content merely because a reusable Card component exists. Adjacent information that belongs to one visual story should often share space instead of being fragmented into a grid of boxes.

Use cards for:

- discrete interactive objects
- inventory/marketplace items
- compact repeatable entities
- genuinely separate grouped records

Prefer non-card composition for:

- page introductions
- scenic/location arrivals
- narrative explanations
- large identity moments
- section transitions
- timelines and pedigrees
- Hall of Fame presentations
- feature storytelling
- any screen where cards would reduce visual hierarchy to a dashboard grid

- **Corner style:** 12px for cards, 16px for content panels, 24px for modals.
- **Background:** the frosted panel fill; nested surfaces step down to the subtle variant.
- **Border:** 1px frosted blue-white; gold at 10% for the subtle variant.
- **Shadow:** the glass inset for panels, subtle for nested surfaces, floating for overlays. See Elevation.
- **Padding:** 24px for panels, 16px for cards.
- **Hover:** nothing, unless the card is the interactive variant.

### Inputs / Fields

- **Style:** frosted panel fill, 1px frosted border, 12px corners, Moonlit Slate text with Dim Slate placeholders, 12px × 8px padding.
- **Focus:** border shifts to Lantern Gold with a 1px gold ring — a warm edge rather than a bright glow.
- **Invalid:** border and focus ring shift to the danger border color; text color is unchanged, and the message is always adjacent, never color-only.
- **Disabled:** 40% opacity with a not-allowed cursor.
- Every control — input, textarea, select, number field — composes the same recipe. There is exactly one field appearance in the product.

### Badges

- **Style:** full-round pills, 10px × 2px padding, uppercase Proda Sans 600 at 12px with wide tracking, 1px border.
- **Fill formula:** a 15–20% tint of the semantic color, a solid border in that color, and text in the readable variant of it.
- **Rarity ladder:** common slate → uncommon green → rare blue → ultra-rare gold → legendary pale gold. Rarity is the one place where a color ramp carries genuine game meaning, so it is never repurposed for anything else.

### Navigation

- **Sidebar:** 280px on a deep navy ground with a frosted right border, collapsing to a 64px icon rail. Labels use Proda Sans; icons are gold when active. Expressive typography belongs to destination content, not functional navigation.
- **Active state:** a 2px Lantern Gold left border, a 10% gold background wash, and Lantern Gold Light text. The active marker is a gold edge, never a filled gold block.
- **Inactive:** Muted Slate text, brightening to primary with a frosted background wash on hover.
- **Mobile:** a 56px bottom navigation bar below the large breakpoint, padded for the home-indicator inset.
- Chrome never takes discipline color. See The Discipline Containment Rule.

### The Sky

The night sky is **real artwork, not a generated effect** (ruling 2026-08-17). Every route renders a per-scene background through `PageBackground` — `background-size: cover`, a `rgba(5,10,20,0.45)` readability veil over it, and an opaque navy gradient (`#0a0e1a → #111827`) as the floor while art loads or where a scene's art has not been delivered yet.

A procedural CSS star field used to sit behind all of that at `z-index: -2`. It was deleted once the layering was actually measured: the artwork above is opaque in **every** state — loaded, loading, and art-not-yet-delivered — so the star field rendered zero visible pixels on every page, while running a fixed full-viewport layer with a 6-second infinite opacity animation and `will-change: opacity` on a product where phone is a first-class target. The sky belongs to the artwork.

**The Artwork Sets the Register Rule.**
Environment art is not wallpaper behind an otherwise neutral product interface. It is primary art direction evidence. UI typography, shapes, ornament and presentation should be evaluated against the visual world depicted by the assets.
When abstract design-system guidance conflicts with the established atmosphere of the artwork, the artwork is the stronger evidence of intended tone.

### Cinematic Moment

The celebration surface for foal birth, ultra-rare trait discovery, and major rewards. It sits above all other chrome, runs on the 1200ms cinematic duration with the reward easing (`--ease-reward`, an expressive ease-out — bounce/elastic easing was retired by user ruling 2026-08-14), and carries the strong gold glow. Under reduced motion the transit is removed but the payload — the trait, the foal, the prize — still renders. This is the one place the system is allowed to be loud, and it is bounded by having an end.

### Named Rules

**The Replacement Is a Conversation Rule.** When a component is removed for being generic — the shadcn layer is the live case — **an agent does not pick its replacement alone.** Deleting SaaS-shaped drivel and substituting a different vendor's SaaS-shaped drivel is not progress; it is the same failure with a new import path. Bring the replacement to the user through `/impeccable` (`shape` for a component's behavior and states, `critique` or `bolder` for an existing one, `document` when the outcome changes this file) and let them choose the direction before the code is written. The only thing an agent decides unilaterally here is _that_ something must go, never _what arrives in its place_.

**The Art Direction Precedence Rule.**
Generic design-system heuristics are advisory, not governing. Consistency, minimal font count, conventional component patterns, scalability to hypothetical future products, and industry-standard aesthetics do not override Equoria's established visual direction.
When an unusual choice is coherent with the authored world and works at its actual use size, preserve the choice unless there is a concrete usability, accessibility or implementation failure.
“Less conventional” is not itself a defect. “More reusable” is not itself a virtue.

**The No Invented Governance Rule.**
An agent may identify a concern, but it may not turn its own concern into a new project rule and then use that rule to veto creative direction.
If the design docs do not prohibit something, do not infer a prohibition merely because conventional practice would avoid it.
New restrictions on art direction, tone, typography, visual language, satire, or expressive range require an explicit user ruling.

## Do's and Don'ts

### Do:

- **Do** use a token for every color, radius, shadow, and duration. Raw hex and rgba in component files are violations; the token layer is the source of truth.
- **Do** use Lantern Gold (#c8a84e) freely for text at any size — it is 7.91:1. Reach for the light or bright gold to raise emphasis, not to satisfy contrast. The one gold that never carries text is Lantern Gold Dim (#8b7635, 4.09:1).
- **Do** put exactly one gold primary action on a workflow surface, and make it the action the player most likely came to take.
- **Do** compose surfaces with the panel / subtle / interactive / overlay variants rather than hand-rolling a glass rectangle. Nesting a panel inside a panel means the inner one is subtle.
- **Do** drive every duration and easing through the motion tokens, so reduced-motion support is automatic rather than remembered.
- **Do** keep 44px minimum touch targets, and expand the hit area rather than inflating the visual size when a control needs to look smaller.
- **Do** give celebrations a reduced-motion alternative that still delivers the information — the reveal may be removed, the reward may not.
- **Do** render honest empty and error states. An empty roster shows an honest empty state; a failed fetch shows an error with a retry, never an empty state.
- **Do** allow decorative typography to participate in recurring UI when its role, size and readability support it.
- **Do** use the environment artwork as evidence when deciding how whimsical, magical or ornate a surface may be.
- **Do** prefer a memorable project-specific solution over a generic safe solution once both satisfy the functional requirement.
- **Do** preserve delight. Equoria is entertainment.
- **Do** design each major screen around its actual game meaning instead of filling a generic page template.
- **Do** use open composition, scenic framing, layered sections, timelines, ledgers, banners, ribbons, shelves, image crops, and bespoke structures where they tell the story better than cards.
- **Do** let major horse identities, locations, achievements, and ceremonies breathe; not every important thing needs a rectangular container.
- **Do** use expressive typography as part of visual hierarchy when its semantic role and rendered readability support it.

### Don't:

- **Don't** use the shadcn semantic color utilities — `bg-primary`, `text-primary`, `bg-muted`, `border-border`, `bg-card`, `text-foreground` and the rest of that family. They resolve to the deprecated RGB-triplet layer, not to Celestial Night, and `primary` there is cobalt blue.
- **Don't** replace a removed generic component with another generic component on your own judgment. Take the replacement to the user through `/impeccable` first — see The Replacement Is a Conversation Rule.
- **Don't** add a shadcn/ui component, or copy one in. The product has its own primitives — Button, Surface, GameBadge, the shared field recipe. A game does not borrow its controls from an accounting dashboard.
- **Don't** add `backdrop-blur` in page code. Blur belongs to the panel and overlay surfaces and to layout chrome — one visible blurred layer at a time.
- **Don't** put hover lift or glow on static content. Only the interactive surface variant moves.
- **Don't** use discipline accent colors anywhere in navigation, sidebars, tab indicators, or breadcrumbs.
- **Don't** use Dragon Tales for anything but the EQUORIA wordmark.
- **Don't** put horseshoe arcs on small or icon buttons — the arc collides with the touch-target expander.
- **Don't** add an outer `max-w-* mx-auto px-*` wrapper in page code, or horizontal padding on a content container. The shell owns the gutter.
- **Don't** apply opacity modifiers to a CSS-variable color (`text-[var(--x)]/60`) — Tailwind 3.4 silently drops the entire utility. Use the pre-multiplied alpha tokens instead.
- **Don't** use radius values outside the 6 / 12 / 16 / 24 / full scale, and don't reach for `rounded-2xl` or `rounded-3xl` in page code.
- **Don't** render game currency with a dollar sign or any real-money formatting. In-game currency is not money.
- **Don't** use `window.confirm` for destructive confirmation — irreversible actions get a real dialog on the overlay surface.
- **Don't** make a gold button the destructive action. Gold means recommended; destructive is red and always looks like a decision.
- **Don't** signal anything by color alone. The content is already color-coded; add an icon and words.
- **Don't** interpret “not fantasy RPG” as “not magical.”
- **Don't** impose an arbitrary one-decorative-font limit.
- **Don't** reject a specialist font because it lacks weights its assigned role does not use.
- **Don't** use “industry standard,” “more scalable,” “more conventional,” or “fewer fonts” as sufficient reasons to override art direction.
- **Don't** turn horse-game subject matter into a requirement for heritage-club, engraved-brass, stud-book, or luxury-equestrian aesthetics.
- **Don't** make the interface visually safer than the world it belongs to.
- **Don't** default to card grids, bento layouts, KPI tiles, dashboard summaries, or one-rounded-rectangle-per-thought composition.
- **Don't** mistake component reuse for visual repetition. Shared primitives may produce different compositions.
- **Don't** cover scenic artwork with generic panels simply because the content needs structure.
- **Don't** treat “clean,” “minimal,” “scalable,” or “consistent” as automatic reasons to remove personality.
- **Don't** make every page share the same header + tabs + card-grid choreography unless the tasks truly warrant it.
