# Equoria Design System — Binding Implementation Decisions

**Status:** Adopted by owner direction, 2026-08-19

**Authority:** Subordinate to `PRODUCT.md` and `DESIGN.md`

**Replaces:** Agent-proposed remediation decisions dated 2026-06-09

**Reason for revision:** The prior decisions standardized the existing dashboard shell, headers, tabs, cards, and dialogs. The 2026-08-19 structural audit confirmed that this repeated grammar is a primary cause of Equoria reading as corporate SaaS.

This file resolves implementation choices that genuinely benefit from consistency. It does **not** define a universal page template. Existing code, installed dependencies, and frequently repeated components describe the current state; they do not prove that the state is approved.

When documents disagree, use the authority order in `PRODUCT.md`: current owner ruling → `PRODUCT.md` → `DESIGN.md` → tokens/motion → this file. A decision here is invalid wherever it conflicts with a higher authority.

Legacy source comments and issue text that cite numbered sections such as “DECISIONS §3/4/8” refer to the superseded 2026-06-09 document. They are historical references, not authority for the current section at that number. New cross-references should name the decision heading rather than rely on section numbers.

---

## 1. Page composition is route-specific

**Decision:** Equoria has no standard player-facing page choreography.

Every major route starts from an experiential concept, the player's task, the emotional subject, and the available scene artwork. A route is not approved merely because it uses canonical components correctly.

The following sequence is an anti-pattern, not a template:

> persistent sidebar → account bar → page header → KPI tiles → tabs → filters → card grid/table → centered modal → utility rail

- Do not begin a route by choosing `PageHeader`, tabs, grid columns, and card count.
- Do not produce interchangeable pages where only the noun, icon, and API payload change.
- Do not infer that a repeated existing layout should be repeated again.
- Shared primitives may standardize behavior, focus, tokens, and state without standardizing composition.
- A player-facing implementation must pass the Visual-Change Gate in `PRODUCT.md` before code.

## 2. The current dashboard shell is legacy, not authority

**Decision:** `DashboardLayout` is an implementation to be redesigned, not the owner of Equoria's final page silhouette.

The simultaneous desktop sidebar, sticky top bar, central column, right utility rail, footer, and floating actions form an admin-console shell. New work must not extend or use that structure as design evidence.

The replacement direction is world-oriented:

- Stable, Arena, Breeding Hall, marketplace, shops, clinic, farrier, and World read as places.
- Navigation is atmospheric and efficient without presenting every destination as a flat business-software module.
- Currency, messages, and alerts behave as discreet game HUD information.
- Care needs, cooldowns, and recent events appear contextually around relevant horses and decisions.
- A persistent right-hand KPI/activity rail is rejected.

The exact replacement navigation and shell require an owner-reviewed surface direction before implementation. An agent may not substitute another premade app shell.

## 3. Containers constrain reading; they do not compose pages

`PageContainer` may remain as a width and gutter utility during migration. Its variants are implementation tools, not semantic page families:

| Variant   |   Maximum width | Appropriate use                                                           |
| --------- | --------------: | ------------------------------------------------------------------------- |
| `narrow`  |           672px | Focused forms or readable text where a narrow measure is genuinely useful |
| `content` |           896px | Reading regions and bounded tools, not a “standard page” default          |
| `wide`    |          1152px | Dense rosters or catalogues when the route concept benefits from width    |
| `full`    | Available scene | Scenic, spatial, or edge-to-edge compositions                             |

- The scene or shell owns responsive outer gutters; avoid accidental double padding.
- A page may use multiple widths and alignments as part of one composition.
- `mx-auto` is not mandatory. Deliberate asymmetry and artwork-aware placement are approved.
- Do not wrap the whole route in a centered max-width column merely because the utility exists.
- Auth layout remains a focused special case, not evidence for player-facing page structure.

## 4. Headers are optional tools, not three mandatory families

The previous ruling that three header families cover every page is retired.

| Primitive      | Permitted role                                                           | Not permission for                                                  |
| -------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `PageHeader`   | Compact functional heading inside a genuinely operational sub-surface    | Starting every route with title, subtitle, breadcrumbs, and actions |
| `EntityHeader` | Reusable identity behavior or metadata where it supports the composition | Turning a horse into a CRM profile record                           |
| `AuthHeader`   | Wordmark and auth context inside `AuthLayout`                            | General player-facing headers                                       |
| `PageHero`     | Artwork-led arrival when the scene and route concept call for it         | A decorative banner pasted above the standard cards                 |

Routes may use scenic arrivals, open identity compositions, sign-like headings, integrated image titles, arena programs, catalogue mastheads, stable markers, or no standalone header component. Typography must follow `DESIGN.md`; component availability must not decide the opening composition.

## 5. Surface is a material primitive, not a sentence wrapper

`Surface` remains an Equoria-owned primitive for content that genuinely needs containment:

| Variant       | Purpose                                                               |
| ------------- | --------------------------------------------------------------------- |
| `page`        | Unframed spacing/typography region; no border or background           |
| `panel`       | Bounded reading or tool surface that needs a stable ground            |
| `subtle`      | Nested grouping inside an already framed region; no blur              |
| `interactive` | Discrete clickable object; the only variant that lifts on hover/focus |
| `overlay`     | Routine dialog/popover ground                                         |

Rules:

- Containment is semantic, not decorative. A concept does not receive a rounded rectangle merely because `Surface` exists.
- Prefer open sections, scenic framing, image-led regions, dividers, ledgers, timelines, shelves, ribbons, banners, and purpose-built structures where they fit the task.
- Adjacent information that forms one story should usually share space rather than fragment into nested cards.
- Static surfaces never lift. Interactive surfaces expose equivalent hover and keyboard-focus feedback.
- At most one active `backdrop-filter: blur()` layer is visible. Page-local blur utilities remain violations.
- Frosted navy is one material in the world, not the required background for every thought.

## 6. Tabs are exceptional navigation, not default information architecture

**Decision:** There is no canonical Radix-backed tab system. shadcn/Radix are rejected by `PRODUCT.md` and `CLAUDE.md`; do not add, copy, reinstall, or introduce new imports.

Use tabs only when all of these are true:

1. The views are genuine peers rather than stages, chapters, or unrelated modules.
2. Players benefit from switching frequently without losing context.
3. The visible choices remain comprehensible on phone and desktop.
4. A more specific game-world structure would not communicate the content better.

Two to four compact mode switches may use an Equoria-owned segmented control. Larger bodies of horse information should use a few meaningful chapters, spatial sections, journeys, ledgers, or secondary dossiers—not a horizontally scrolling row of peer tabs. Thirteen-tab entity dossiers are explicitly rejected.

The native, Equoria-owned behavior primitive in `frontend/src/components/ui/tabs.tsx` may remain where tabs are semantically justified; its existence does not make tabs the default information architecture. `CanonicalTabs`, `CelestialTabs`, `GoldTabs`, and current page consumers are migration inventory to be reevaluated route by route, not precedent. Any replacement requiring a new dependency must be brought to the owner before selection.

## 7. Routine dialogs and authored game moments are separate families

`GameDialog` is not the universal destination for overlays. Its current Equoria-owned/native behavior may support routine dialogs, but its centered panel/header/body/footer choreography is not appropriate for every event. Comments or compatibility APIs that refer to former Radix behavior do not authorize new Radix use.

### Routine dialog

Use a restrained, accessible dialog for mundane confirmations, small assignments, account settings, and destructive actions. It must preserve focus trapping/restoration, Escape, scroll lock, labelled title/description, keyboard operation, and a safe cancel path.

### Authored game moment

Foal birth, breeding commitment, training outcomes, championship results, prizes, relationship progress, and rare-trait discovery receive purpose-built presentation proportional to their emotional importance. The horse, result, or reward is the payload; it is not body copy inside the routine dialog template.

### Contextual feedback

Do not use `sonner` or another toast package. Existing `sonner` consumers are migration debt, not approved precedent. Routine success/error feedback stays with the affected workflow or appears in the in-game event/message log. Important events use an authored bounded moment. Auto-dismiss must never be the only way to learn consequential information.

## 8. Data presentation must speak horse, lineage, and season—not analytics

Recharts, Chart.js, and `react-chartjs-2` are not approved for player-facing visualization. Their dependencies and current consumers are legacy migration inventory, not an exception.

- Pedigree and ancestry → accessible family tree, spatial lineage, or registry ledger.
- Genetics and predicted inheritance → purpose-built probability presentation, trait threads, Punnett information, or inline SVG where useful.
- Training and development → journey, timeline, progress path, or care record.
- Competition history → season record, program, results sheet, podium, or narrative history.
- Dense exact values → accessible HTML table or ledger when that is genuinely the clearest form.

Do not translate horse systems into revenue-chart grammar. A table is allowed when the player truly needs a table; it should be secondary to the horse or event when the moment is emotional.

## 9. Shape, action, color, and type remain consistent at component level

These implementation mappings remain binding, but they do not require pages to be made of rounded rectangles:

| Role           | Decision                                                    |
| -------------- | ----------------------------------------------------------- |
| Small details  | 6px radius for badges, stat bars, and compact chips         |
| Controls/cards | 12px radius for buttons, inputs, selects, and genuine cards |
| Panels/tools   | 16px radius for bounded content panels and framed tools     |
| Modals/heroes  | 24px radius for routine modals and feature panels           |
| Full round     | Avatars, status dots, toggles, and true pill controls only  |

- Buttons are 12px rounded rectangles. Pills require a semantic reason.
- One gold primary action per workflow surface, except documented owner-approved exceptions in `DESIGN.md`.
- Destructive actions are red and never visually recommended with gold.
- Lantern Gold is the inline-link color. Lantern Gold Light is reserved for the documented higher-emphasis roles in `DESIGN.md`.
- Raw Tailwind palette colors and the retired shadcn semantic color utilities are prohibited in player-facing code.
- Dragon Tales, Basteleur Bold, Basteleur Moonlight, Whisperleaf, Proda Sans, and Artavion Mono keep the semantic roles defined in `DESIGN.md`.
- Lucide may clarify utility controls but may not supply a route's personality or replace game-specific art direction.

## 10. Accessibility behavior belongs to Equoria, not a vendor kit

Removing generic libraries does not permit inaccessible replacements.

- Prefer native semantic HTML when it provides the required behavior.
- Preserve keyboard operation, visible focus, focus restoration, Escape/cancel, screen-reader names, announcements, and reduced-motion handling.
- Minimum touch target is 44×44px; compact visuals may use an expanded hit area.
- Loading, error, empty, and success remain distinct and honestly announced.
- Never rely on color, glow, motion, or icon shape alone.
- If a complex control cannot be implemented reliably with current Equoria primitives and native HTML, stop and present behavior/dependency options to the owner. Do not silently import a component kit.

Accessibility is a non-negotiable behavioral floor. It is not a reason to surrender composition or visual identity to shadcn, Radix, or another vendor.

## 11. Currency and utility iconography

- Game currency renders as a coin mark plus locale-formatted digits; prose says “coins.”
- Never use dollar signs or real-money formatting for gameplay currency.
- `Currency` may support standard, compact, signed, and balance formatting when those variants are actually needed.
- Lucide `Coins` is a temporary utility glyph until owner-approved bespoke art exists. It is not a brand asset and does not authorize Lucide-led page identity.
- Icon-only controls require accessible names; unfamiliar actions also need visible labels or contextual explanation.

## 12. Stable routes are product facts, not a design-system naming mandate

`/stable` currently serves the horse roster and `/my-stable` currently serves stable profile/Hall of Fame content. Retaining, merging, or renaming them is a product information-architecture decision.

The former agent-proposed “Stable” / “Stable Profile” naming is not ratified by this file. Do not rename routes, navigation, headings, or tests as a side effect of visual remediation. Bring the complete player-facing naming choice to the owner.

## 13. Structural redesign order

The previous migration order is retired. Token polish cannot rescue SaaS composition, and redesigning individual cards inside the admin shell entrenches the wrong structure.

1. **Global shell and navigation** — remove the admin-console frame and persistent utility rail.
2. **Horse Detail vertical slice** — establish horse-led identity, chapters, lineage, care, and career as the new composition language.
3. **Stable / home** — build the returning-player ritual and inhabited roster experience.
4. **Breeding, Competition, and Marketplace** — give each a distinct game-specific metaphor and flow.
5. **Feedback families** — separate routine dialogs, contextual messages, and authored game moments.
6. **Reduce universal containment** — migrate away from Surface/card-per-thought composition and establish non-card patterns.
7. **Secondary routes** — adapt world services, community, economy, settings, profile, onboarding, and auth without cloning one new template everywhere.
8. **Token and legacy cleanup** — remove residual palette, radius, shadow, icon, package, and adapter debt after structural direction is proven.

Each step must be completed as a coherent vertical slice on phone and desktop before its pattern is generalized.

## 14. Enforcement and legacy policy

The following are enforceable repository doctrine, not optional style preferences:

- No new shadcn or Radix dependencies, imports, copied components, or semantic color utilities.
- Existing `sonner`, Recharts, Chart.js, and `react-chartjs-2` consumers are migration debt. Do not add them, and remove their use when a touched surface receives its replacement feedback or visualization design.
- No page-local `backdrop-blur-*` or `backdropFilter` outside the approved surface/chrome implementation.
- No unsupported raw radius utilities, raw Tailwind palette colors, or raw command-style buttons where an Equoria primitive exists.
- No new universal dashboard rail, KPI-strip, page-header/tabs/card-grid template, or page-local fixed overlay.
- Exceptions require an owner, concrete product reason, narrow scope, and expiry in `docs/design-system/EXCEPTIONS.md`. “Existing pattern,” “industry standard,” “faster,” or “the library is installed” are not valid justifications.

Automated scans should enforce mechanically detectable rules. Screenshot and structural review must enforce composition rules that source scans cannot judge. Passing tokens, lint, or accessibility checks does not prove that a screen belongs in Equoria.

---

## Retired Decisions

| Former decision                                                     | Status     | Reason                                                                       |
| ------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| `DashboardLayout` owns the approved outer shell                     | Retired    | The shell is the audit's primary admin-console failure                       |
| Three header families cover every page                              | Retired    | Component availability was dictating route composition                       |
| One Radix-backed canonical Tabs                                     | Retired    | Radix is rejected; tabs were becoming default information architecture       |
| One Radix-backed `GameDialog` for overlay migration                 | Retired    | Routine confirmations and meaningful game moments require different families |
| Chart-library exception list                                        | Retired    | Player-facing analytics grammar is rejected                                  |
| Authentication/world services migrate before horse/stable structure | Retired    | It polished leaves before replacing the structural root                      |
| Agent-proposed Stable / Stable Profile naming                       | Unratified | Player-facing information architecture requires an owner decision            |

## Changelog

| Date       | Change                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-09 | Agent-proposed remediation decisions recorded; several items remained unratified                                                                                                         |
| 2026-08-19 | Rewritten by owner direction after the structural SaaS audit; dashboard-shell, mandatory-header, Radix-tab, universal-dialog, chart-exception, and old migration-order decisions retired |
