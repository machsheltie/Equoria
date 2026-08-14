---
name: Equoria
description: Celestial Night — a lantern-lit stable under a star field, where gold marks what was earned.
colors:
  lantern-gold: "#c8a84e"
  lantern-gold-light: "#e8d48b"
  lantern-gold-bright: "#f5e6a3"
  lantern-gold-dim: "#8b7635"
  stable-midnight: "#0a0e1a"
  night-sky: "#0a1628"
  midnight-panel: "#0f2346"
  twilight: "#243154"
  surface-slate: "#1e293b"
  frosted-panel: "rgba(15, 23, 42, 0.6)"
  frosted-panel-heavy: "rgba(15, 23, 42, 0.85)"
  frosted-panel-subtle: "rgba(15, 23, 42, 0.4)"
  frosted-border: "rgba(148, 163, 184, 0.2)"
  moonlit-slate: "#dcebff"
  muted-slate: "#94a3b8"
  dim-slate: "#64748b"
  celestial-blue: "#3a6fdd"
  status-success: "#22c55e"
  status-warning: "#f59e0b"
  status-danger: "#ef4444"
  status-info: "#3b82f6"
  status-rare: "#a78bfa"
  status-legendary: "#f5e6a3"
  tier-silver: "#c4ccd6"
  tier-bronze: "#cd7f4a"
typography:
  display:
    fontFamily: "Cinzel Decorative, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.05em"
  headline:
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "2.441rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "1.563rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.05em"
rounded:
  sm: "6px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "64px"
components:
  button-primary:
    backgroundColor: "{colors.lantern-gold}"
    textColor: "{colors.stable-midnight}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.lantern-gold-light}"
    textColor: "{colors.stable-midnight}"
  button-secondary:
    backgroundColor: "{colors.frosted-panel-subtle}"
    textColor: "{colors.moonlit-slate}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.moonlit-slate}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-destructive:
    backgroundColor: "rgba(224, 90, 90, 0.15)"
    textColor: "{colors.status-danger}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.frosted-panel}"
    textColor: "{colors.moonlit-slate}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  badge-default:
    backgroundColor: "rgba(200, 168, 78, 0.15)"
    textColor: "{colors.lantern-gold-light}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  surface-panel:
    backgroundColor: "{colors.frosted-panel}"
    textColor: "{colors.moonlit-slate}"
    rounded: "{rounded.md}"
    padding: "24px"
  surface-overlay:
    backgroundColor: "{colors.frosted-panel-heavy}"
    textColor: "{colors.moonlit-slate}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Equoria

## Overview

**Creative North Star: "The Midnight Stable"**

It is late, the barn is quiet, and the only light is lantern-gold on brass and tack. Above the paddock the sky is deep and full of stars. That is the whole system in one image: a near-black navy ground, frosted panels that read like breath-fogged glass, and gold used the way lamplight actually behaves — pooled where something matters, absent everywhere else. The astronomy is atmosphere. The horses are the subject.

The register is **rich, warm, and ceremonial**. This is not a restrained interface that happens to be dark; surfaces are appointed, primary actions carry gilt edges and horseshoe arcs, and featured panels hold a resting gold glow so the warmth is visible the moment a page arrives rather than only on hover. The ceremony is earned by what the product is — players commit irreversible decisions about bloodlines that took real weeks to build, and the interface should feel like it takes that seriously.

The discipline that keeps ceremony from becoming noise is hierarchy. Gold is the loudest thing in the system, so exactly one gold action leads any workflow surface — with one confirmed, surface-specific exception recorded under the rule itself. Blur is expensive and reads as cheap when stacked, so one blurred layer is visible at a time. Motion belongs to moments, not to resting content. Everything else — the shadow ladder, the frosted panel family, the eight-step spacing scale — exists to make those three scarcities readable.

**Explicitly rejected.** Three anti-references, all confirmed, in order of danger:

1. **Generic dark-mode SaaS** — the most egregious failure. Flat slate cards, blue accents, uniform gray text, no craft. If a screen would look at home in any admin panel after a navy repaint, it has failed. **This explicitly includes shadcn/ui.** Its component look and its `--background` / `--foreground` / `--primary` RGB-triplet color layer are being removed from this codebase (user decision, 2026-08-13): they are built for a tax-filing SaaS, not for a game. Equoria has one color system — the Celestial Night tokens — and one component library, its own.
2. **Skeuomorphic fantasy RPG** — no wood grain, no leather texture, no scroll edges, no ornate metal frames, no drop-shadowed medieval lettering. The world is a real stable at night, not a costume drama.
3. **Loud casual mobile game** — no cartoon gradients, no permanent bounce, no confetti as decoration. *Bounded exception:* reward and reveal moments (cinematic trait reveals, foal birth, rarity coding, celebration glow) legitimately borrow game energy. They are earned moments with a beginning and an end, never the resting state of a screen.

**Key Characteristics:**

- Near-black navy ground with a live star field behind everything
- Frosted glass panels in a strict four-step family (panel / subtle / interactive / overlay)
- Lantern-gold as the single accent, rationed by rule
- Cinzel for names and titles, Inter for everything read at length
- Horseshoe arcs as the primary-button signature
- Depth by tonal layering first, shadow second, glow only where earned
- 44px touch targets and visible focus rings everywhere, on both phone and desktop

## Colors

A single warm accent held against a cold, near-black sky — the palette has one voice, and everything else is atmosphere or status.

### Primary

- **Lantern Gold** (#c8a84e): the accent. Primary button fill, active navigation accents, section-header icons, featured-panel borders and glow. **7.91:1** on the night ground.
- **Lantern Gold Light** (#e8d48b): the emphasis gold. Ghost and link button labels, accent body copy. **12.28:1**.
- **Lantern Gold Bright** (#f5e6a3): high-emphasis and active states, focus rings, legendary/ultra-rare emphasis. **14.44:1**.
- **Lantern Gold Dim** (#8b7635): decorative borders, inactive gilt, the shadow end of gold gradients. **4.09:1 — decorative only, never carries text.** It is the one gold that fails the body floor.

### Secondary

- **Celestial Blue** (#3a6fdd): the cool counter-accent. Focus glow on non-gold surfaces, electric highlights, informational emphasis, onboarding spotlight rings. Deliberately *not* used on primary actions — gold owns action, blue owns attention.

### Tertiary

- **Discipline accents**: dressage violet (#7c5cbf), show-jumping green (#2e8b57), racing red (#c0392b), cross-country ochre (#8b6914), western brown (#7b3f00), endurance teal (#1a7a7a). Each identifies a competition discipline on action buttons and nowhere else.
- **Rarity and tier**: rare violet (#a78bfa), legendary pale gold (#f5e6a3), plus podium metals — Lantern Gold for first, **Silver** (#c4ccd6) for second, **Bronze** (#cd7f4a) for third.

### Neutral

- **Stable Midnight** (#0a0e1a): the void. Body background, outermost layer, the ground the star field sits on.
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

> **Confirmed exception — the horse detail Quick Actions Bar** (user directive, confirmed 2026-08-14; `pages/HorseDetailPage.tsx`). **Train This Horse** and **Enter Competition** are *both* gold primaries there; View Parents stays secondary. The reasoning is that a horse's detail page has two genuinely co-equal destinations — the horse exists to be trained and to be competed — and forcing a rank between them misrepresents the product rather than clarifying it.
>
> This is the only sanctioned exception. It is a surface-specific ruling, not a softening of the rule: **two golds require a user decision, never an agent's judgement**, and a third gold on that bar would still be wrong. If you are adding a second gold primary anywhere else, you are violating the rule — ask.

**The Gold Text Floor Rule.** *(Relaxed by user ruling, 2026-08-13.)* **Lantern Gold (#c8a84e) is cleared for body-size text** — it measures **7.91:1** on the night ground, comfortably past AA and near AAA. The floor is one step lower than the palette suggests: **Lantern Gold Dim (#8b7635) is the only gold that may not carry text at any size** (4.09:1 — under the 4.5:1 body floor, and large-text-only at best). It stays decorative: borders, inactive gilt, the shadow end of gradients.

The rule previously forbade Lantern Gold for body copy on the strength of a 4.2:1 figure annotated in `tokens.css`. That figure was wrong — every contrast comment in that file is understated by 1.3–1.5× (`Equoria-kcau0`). **Do not cite 4.2:1 anywhere.** Choosing Lantern Gold Light or Bright for a piece of text is now an emphasis decision, not a compliance one; the ghost and link button variants keep the light gold because it reads better against a busy panel, not because the primary gold would fail.

**The Discipline Containment Rule.** Discipline accent colors appear on action buttons only. They are forbidden in navigation, sidebar active states, tab indicators, and breadcrumbs — chrome stays gold-and-navy so discipline color always means "this competition," never "you are here."

**The One Palette Rule.** There is exactly one color system: the Celestial Night tokens in `tokens.css`. The parallel shadcn-style RGB-triplet layer in `index.css` (`--background`, `--foreground`, `--primary`, `--muted`, and their Tailwind utilities `bg-primary`, `text-primary`, `border-primary`) is deprecated and being removed. It defines a *second, contradictory* primary — cobalt `#2563eb` by way of `--forest-green` — so a component styled with those utilities is not in this design system at all. New code uses `var(--gold-primary)` and its siblings; nothing new consumes the triplet layer.

**The Never-Color-Alone Rule.** Every status, error, and empty state pairs its color with an icon and text. The game's own content is color-coded (coat genetics, care status, rarity), so color as the sole signal collides with real data.

## Typography

**Display Font:** Cinzel Decorative (with Georgia, serif)
**Heading Font:** Cinzel (with Georgia, serif)
**Body Font:** Inter (with system-ui, sans-serif)
**Mono Font:** JetBrains Mono (with monospace) — data and debug readouts only

**Character:** Cinzel is a Roman-inscriptional serif — it carries the ceremony without a single drop of fantasy pastiche, which is exactly why it survives the skeuomorphic-RPG anti-reference. Inter underneath it is plain, modern, and screen-native. The pairing reads as an engraved nameplate above a well-set technical document, which is what a horse's detail page actually is.

### Hierarchy

- **Display** (Cinzel Decorative 700, 2.25rem/36px, tracking 0.05em): the EQUORIA wordmark. Nothing else.
- **Headline** (Cinzel 700, 2.441rem/39px, line-height 1.25): page titles.
- **Section** (Cinzel 600, 1.953rem/31px): section headers.
- **Title** (Cinzel 600, 1.563rem/25px): card titles and horse names — the most important recurring use of the serif in the product.
- **Sub-title** (Cinzel 500, 1.25rem/20px): sub-sections and tab labels.
- **Body** (Inter 400, 1rem/16px, line-height 1.5): all UI text and reading copy.
- **Stat** (Inter 600, 1.125rem/18px): numeric values — stats, prices, counts.
- **Label** (Inter 600, 0.75rem/12px, tracking 0.05em, uppercase): badges, micro-labels, captions.

Scale is 1.25-ratio on a 16px base. Weights are 400/500/600/700 only. Line heights are 1.25 (tight), 1.5 (normal), 1.75 (loose).

### Named Rules

**The Wordmark-Only Rule.** Cinzel Decorative is reserved for the EQUORIA wordmark. Using the decorative cut for headings is the single fastest way to tip the whole system into costume-drama fantasy.

**The Serif Ceiling Rule.** Cinzel names things — pages, sections, cards, horses. Inter says everything else. Any block of text a player reads for comprehension rather than identification is Inter, at any length.

## Layout

The shell is a centered 1440px maximum with 16px gutters that open to 32px at the medium breakpoint; the layout owns those gutters absolutely. Inside it, content is constrained by one of four container widths: **narrow** (672px) for forms, settings, and focused account workflows; **content** (896px) for standard operational pages and detail reading; **wide** (1152px) for grids, marketplaces, and rosters; and **full** for the exceptional edge-to-edge tool.

Rhythm runs on an 8px base — 4, 8, 12, 16, 24, 32, 48, 64. Card padding is 16px, panel padding 24px, major section separation 32px, page-level separation 48px.

**Both phone and desktop are first-class.** CSS is mobile-first; the sidebar (280px) appears at the large breakpoint and the bottom navigation (56px) hides at the same moment. Card grids run 1 → 2 → 3 → 4 columns across the scale. Fixed bottom chrome reserves space for the iOS home-indicator inset and for the 60px contextual action bar, so content is never trapped underneath it. Breakpoints are the Tailwind defaults: 640 / 768 / 1024 / 1280 / 1536.

Three header families cover every page and they do not overlap: **PageHeader** for standard operational pages (title, optional subtitle, actions, metadata, breadcrumbs — compact, no artwork), **EntityHeader** for identity-centered detail pages (horse, foal, club — image, name, core metadata, entity actions), and **AuthHeader** for the wordmark-plus-context of authentication. A fourth, **PageHero**, is the allow-listed image-backed location header for world-service pages that have real artwork — the vet, the farrier, the shops. Its ceremonial treatment is **the gilt icon container and the gold gradient divider** (user ruling, 2026-08-13): the icon sits in a 46px container with a gold border at 45%, a 14% gold fill, and the resting gold glow; the divider is a 2px dim-gold → gold → dim-gold gradient beneath the title block. **Ambient mood orbs stay removed.** They sat on top of the location artwork and washed out the region the title occupies, and the artwork is the reason the header exists.

> **Implementation note.** The divider needs its own token. `--gradient-gold-accent` is reserved for button and badge use; give the divider a dedicated `--gradient-gold-divider` alias of the same ramp so the reservation stays honest rather than quietly broken.

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

**The Featured Glow Rule.** A resting gold glow marks a surface as featured: a gold border at 40% and the gold glow at 25%, escalating on hover to a solid gold edge and the strong glow at 40%. **One featured surface per screen — no exceptions.** If everything glows, nothing is featured; the glow is a designation, not a finish. Because a featured panel now glows before anyone touches it, glow no longer means "clickable" on its own — the −2px lift carries that signal alone, so an interactive featured panel must still lift.

## Shapes

The form language is **rounded rectangles with gilt edges**. Corners run a four-step scale: 6px for badges, chips, and stat bars; 12px for buttons, inputs, and cards; 16px for content panels and framed tools; 24px for modals and hero panels. Full-round is reserved for genuinely circular things — avatars, status dots, toggles — and for badges, where the pill is the semantically correct form.

Buttons are rounded rectangles at 12px. Pill-shaped buttons are an explicit opt-in for compact filter chips and segmented options, never the default. Borders are 1px and nearly always the soft blue-white frosted edge; gold borders mark featured, accent, and primary surfaces specifically.

The recurring signature is the **horseshoe arc** — two 12×20px half-ellipse arcs, gold, inset 12px from each end of a primary button, at 50% opacity rising to full on hover. It is the one piece of literal equestrian iconography in the entire chrome, and it earns its place by being small, structural, and applied to exactly one thing.

### Named Rules

**The Rounded-Rectangle Rule.** Buttons are 12px rounded rectangles. A pill is a deliberate opt-in with a semantic reason, not a default and not a style preference.

**The Horseshoe Signature Rule.** Arcs appear only on the gold primary variant at default, large, and extra-large sizes — never on small or icon buttons, where the arc collides with the touch-target expander and floats a stray gold circle above the control.

## Components

Controls are **appointed and ceremonial** — each one reads as finished hardware. Gilt edges, weighted presence, real press feedback. Using the interface should feel like handling good equipment, not like filling in a form.

### Buttons

- **Shape:** rounded rectangle (12px). Heights are 44px default, 36px small with a hit-area expander to 44px, 48px large, 56px extra-large, 44×44px icon.
- **Primary:** a left-to-right gold gradient from Lantern Gold to Lantern Gold Light, Stable Midnight text, Cinzel semibold with wide tracking, a warm gold drop shadow, and the horseshoe arcs. Hover raises brightness 10% and deepens the shadow; press scales to 0.98.
- **Secondary:** the subtle frosted surface with a 30%-alpha gold border and Moonlit Slate text. Hover brightens the border to 55% and darkens the fill.
- **Outline:** transparent with a pale navy border; hover shifts both border and text to gold.
- **Ghost / Link:** no fill, Lantern Gold Light text, underline on hover. Link keeps square corners and zero horizontal padding at all times.
- **Destructive:** a 15% red fill with a solid red border and red semibold text. Never gold, never gradient.
- **Focus:** a 2px Lantern Gold Bright ring, offset 2px against the Stable Midnight ground — on every variant, no exceptions.
- **Pending:** the spinner replaces the label in place while the button keeps its exact dimensions, sets `aria-busy`, and locks against activation.
- **Disabled:** 40% opacity with muted text and no pointer events.

### Cards / Containers

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

- **Style:** full-round pills, 10px × 2px padding, uppercase Inter semibold at 12px with wide tracking, 1px border.
- **Fill formula:** a 15–20% tint of the semantic color, a solid border in that color, and text in the readable variant of it.
- **Rarity ladder:** common slate → uncommon green → rare blue → ultra-rare gold → legendary pale gold. Rarity is the one place where a color ramp carries genuine game meaning, so it is never repurposed for anything else.

### Navigation

- **Sidebar:** 280px on a deep navy ground with a frosted right border, collapsing to a 64px icon rail. Labels are Cinzel; icons are gold when active.
- **Active state:** a 2px Lantern Gold left border, a 10% gold background wash, and Lantern Gold Light text. The active marker is a gold edge, never a filled gold block.
- **Inactive:** Muted Slate text, brightening to primary with a frosted background wash on hover.
- **Mobile:** a 56px bottom navigation bar below the large breakpoint, padded for the home-indicator inset.
- Chrome never takes discipline color. See The Discipline Containment Rule.

### Star Field

The global background: a fixed, pointer-transparent layer behind everything, built from six tiled radial-gradient star sizes over a three-stop vertical gradient running Stable Midnight → Night Sky → Midnight Panel. It breathes on a 6-second opacity cycle between 55% and 90%, and offers dense tiling (~180–300px) for hubs, landing, and onboarding versus sparse (~420–600px) for reading-heavy pages like results and messages. It sits behind the page background layer and never touches content contrast. Under reduced motion the twinkle stops and the stars hold at full visibility.

### Cinematic Moment

The celebration surface for foal birth, ultra-rare trait discovery, and major rewards. It sits above all other chrome, runs on the 1200ms cinematic duration with the reward easing (`--ease-reward`, an expressive ease-out — bounce/elastic easing was retired by user ruling 2026-08-14), and carries the strong gold glow. Under reduced motion the transit is removed but the payload — the trait, the foal, the prize — still renders. This is the one place the system is allowed to be loud, and it is bounded by having an end.

### Named Rules

**The Replacement Is a Conversation Rule.** When a component is removed for being generic — the shadcn layer is the live case — **an agent does not pick its replacement alone.** Deleting SaaS-shaped drivel and substituting a different vendor's SaaS-shaped drivel is not progress; it is the same failure with a new import path. Bring the replacement to the user through `/impeccable` (`shape` for a component's behavior and states, `critique` or `bolder` for an existing one, `document` when the outcome changes this file) and let them choose the direction before the code is written. The only thing an agent decides unilaterally here is *that* something must go, never *what arrives in its place*.

## Do's and Don'ts

### Do:

- **Do** use a token for every color, radius, shadow, and duration. Raw hex and rgba in component files are violations; the token layer is the source of truth.
- **Do** use Lantern Gold (#c8a84e) freely for text at any size — it is 7.91:1. Reach for the light or bright gold to raise emphasis, not to satisfy contrast. The one gold that never carries text is Lantern Gold Dim (#8b7635, 4.09:1).
- **Do** put exactly one gold primary action on a workflow surface, and make it the action the player most likely came to take.
- **Do** compose surfaces with the panel / subtle / interactive / overlay variants rather than hand-rolling a glass rectangle. Nesting a panel inside a panel means the inner one is subtle.
- **Do** drive every duration and easing through the motion tokens, so reduced-motion support is automatic rather than remembered.
- **Do** keep 44px minimum touch targets, and expand the hit area rather than inflating the visual size when a control needs to look smaller.
- **Do** give celebrations a reduced-motion alternative that still delivers the information — the reveal may be removed, the reward may not.
- **Do** treat the star field density as a reading decision: dense where the player is arriving, sparse where they are reading.
- **Do** render honest empty and error states. An empty roster shows an honest empty state; a failed fetch shows an error with a retry, never an empty state.

### Don't:

- **Don't** use the shadcn semantic color utilities — `bg-primary`, `text-primary`, `bg-muted`, `border-border`, `bg-card`, `text-foreground` and the rest of that family. They resolve to the deprecated RGB-triplet layer, not to Celestial Night, and `primary` there is cobalt blue.
- **Don't** replace a removed generic component with another generic component on your own judgment. Take the replacement to the user through `/impeccable` first — see The Replacement Is a Conversation Rule.
- **Don't** add a shadcn/ui component, or copy one in. The product has its own primitives — Button, Surface, GameBadge, the shared field recipe. A game does not borrow its controls from an accounting dashboard.
- **Don't** add `backdrop-blur` in page code. Blur belongs to the panel and overlay surfaces and to layout chrome — one visible blurred layer at a time.
- **Don't** put hover lift or glow on static content. Only the interactive surface variant moves.
- **Don't** use discipline accent colors anywhere in navigation, sidebars, tab indicators, or breadcrumbs.
- **Don't** use Cinzel Decorative for anything but the EQUORIA wordmark.
- **Don't** put horseshoe arcs on small or icon buttons — the arc collides with the touch-target expander.
- **Don't** add an outer `max-w-* mx-auto px-*` wrapper in page code, or horizontal padding on a content container. The shell owns the gutter.
- **Don't** apply opacity modifiers to a CSS-variable color (`text-[var(--x)]/60`) — Tailwind 3.4 silently drops the entire utility. Use the pre-multiplied alpha tokens instead.
- **Don't** use radius values outside the 6 / 12 / 16 / 24 / full scale, and don't reach for `rounded-2xl` or `rounded-3xl` in page code.
- **Don't** render game currency with a dollar sign or any real-money formatting. In-game currency is not money.
- **Don't** use `window.confirm` for destructive confirmation — irreversible actions get a real dialog on the overlay surface.
- **Don't** make a gold button the destructive action. Gold means recommended; destructive is red and always looks like a decision.
- **Don't** signal anything by color alone. The content is already color-coded; add an icon and words.
