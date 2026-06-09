# Frontend Design Consistency Audit and Remediation Plan

**Status:** Proposed for review  
**Scope:** `frontend/src/pages`, shared layout components, UI primitives, and page-level interaction patterns  
**Prepared:** 2026-06-09  
**Primary objective:** Establish a coherent, enforceable frontend design system and migrate all pages to it without changing business behavior.

## 1. Executive Summary

The frontend has a recognizable Celestial Night visual direction, but it does not yet operate as a coherent design system. Shared primitives exist, including `PageHero`, `Button`, `CelestialTabs`, glass surfaces, background helpers, and semantic tokens. Pages frequently bypass those primitives or apply them inconsistently.

The result is systemic drift:

- Pages have different widths, gutters, headers, card radii, and spacing.
- Identical controls are implemented differently across domains.
- Direct colors and opacity-based text styles bypass semantic tokens.
- Static panels animate like interactive cards.
- Multiple blurred layers violate the intended rendering architecture.
- Authentication pages duplicate a shared layout instead of using it.
- Tabs, modals, loading states, errors, empty states, and currency presentation have competing implementations.
- Mobile fixed navigation can collide with contextual action bars.

This plan recommends a controlled migration:

1. Record the current visual baseline.
2. Approve a small set of design decisions.
3. Correct foundational layout and token behavior.
4. Build canonical reusable primitives.
5. Migrate related page families.
6. Add automated enforcement and visual regression coverage.
7. Remove obsolete styles and temporary compatibility paths.

The work should not proceed as independent page restyling. That would preserve the underlying inconsistency and simply replace it with a new set of local conventions.

## 2. Goals

- Make page structure predictable across the application.
- Make equivalent controls look and behave consistently.
- Reduce page-level CSS and Tailwind class duplication.
- Preserve a distinctive Equoria identity without excessive decoration.
- Improve responsive behavior and accessibility.
- Make design-system violations detectable in CI.
- Permit intentional exceptions only when documented and reviewed.

## 3. Non-Goals

- Rewriting business logic or API behavior.
- Redesigning all user workflows at the same time.
- Replacing React, Tailwind, Radix, or the current routing architecture.
- Removing all visual personality from the application.
- Requiring every page to have identical composition.
- Combining unrelated behavioral refactors with design migration pull requests.

## 4. Review Principles

Every correction should follow these principles:

1. **Semantics before styling:** Choose the correct component role before applying visual treatment.
2. **One owner per responsibility:** The application shell owns page gutters; pages own internal composition.
3. **Shared behavior belongs in primitives:** Focus, disabled, loading, error, and responsive behavior must not be reimplemented per page.
4. **Use tokens instead of incidental colors:** Components request a semantic role, not a specific hue.
5. **Static content should remain visually stable:** Hover motion and glow belong only on interactive elements.
6. **Avoid nested framing:** Page sections should generally be unframed; cards should represent repeated items or isolated tools.
7. **Accessibility is part of the component contract:** Keyboard support, focus behavior, contrast, touch targets, reduced motion, and screen-reader labels are acceptance criteria.
8. **Migrate by page family:** Related pages should converge together so users do not encounter different conventions inside one workflow.

## 5. Evidence and Affected Areas

Representative sources:

- `frontend/src/components/layout/DashboardLayout.tsx`
- `frontend/src/components/layout/PageHero.tsx`
- `frontend/src/components/layout/PageBackground.tsx`
- `frontend/src/components/auth/AuthLayout.tsx`
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/game/CelestialTabs.tsx`
- `frontend/src/components/ui/game/GoldTabs.tsx`
- `frontend/src/index.css`
- `frontend/src/styles/tokens.css`
- `frontend/src/pages/*`
- `frontend/src/pages/horse-detail/*`
- `frontend/src/pages/settings/*`
- `frontend/src/pages/messages/*`
- `frontend/src/pages/clubs/*`
- `frontend/src/pages/tack-shop/*`

The audit found approximately 198 direct Tailwind palette references in page code. Authenticated pages also commonly add their own horizontal padding and maximum width inside a dashboard shell that already owns both.

## 6. Target Design Architecture

### 6.1 Layout Ownership

`DashboardLayout` should own:

- Global navigation
- Outer responsive gutters
- Maximum application width
- Background selection
- Footer
- Bottom navigation reservation
- Contextual bottom-action placement

Pages should own:

- Header selection
- Section ordering
- Internal grids
- Workflow-specific controls
- Content-density decisions

Pages should not normally add another full-page `max-w-* mx-auto px-*` wrapper.

### 6.2 Canonical Page Containers

Create `PageContainer` with named variants:

| Variant   | Intended use                                             |
| --------- | -------------------------------------------------------- |
| `narrow`  | Forms, settings panels, focused account workflows        |
| `content` | Standard operational pages                               |
| `wide`    | Grids, marketplaces, stable rosters, data-rich workflows |
| `full`    | Exceptional edge-to-edge tools within shell gutters      |

The variants should resolve to tokens or centralized classes. Arbitrary page widths such as `max-w-[52rem]` should be removed.

### 6.3 Canonical Headers

Create three explicit header families:

| Header         | Intended use                                                         |
| -------------- | -------------------------------------------------------------------- |
| `PageHeader`   | Standard page title, subtitle, actions, optional contextual metadata |
| `EntityHeader` | Horse, foal, club, or other identity-centered detail page            |
| `AuthHeader`   | Equoria branding and focused authentication context                  |

`PageHero` should either be replaced by `PageHeader` or reduced to an approved image-backed location header variant. Decorative radial orbs should not be the default page-header language.

### 6.4 Surface Hierarchy

Create a canonical `Surface` primitive:

| Variant       | Meaning                                            |
| ------------- | -------------------------------------------------- |
| `page`        | Unframed page section or structural band           |
| `panel`       | Framed tool or isolated content group              |
| `subtle`      | Secondary content inside an unblurred parent       |
| `interactive` | Clickable repeated item with hover/focus treatment |
| `overlay`     | Modal, popover, or other elevated surface          |

Only `interactive` may lift or glow on hover. Blur should be limited to the outermost eligible surface.

### 6.5 Control Hierarchy

Canonical controls:

- `Button`
- `IconButton`
- `Tabs`
- `Input`
- `PasswordInput`
- `Select`
- `Textarea`
- `NumberInput` or stepper
- `Checkbox`
- `Switch`
- `FormField`
- `Dialog`
- `Currency`

All shared controls must include accessibility and responsive behavior in their contract.

## 7. Detailed Issue Register

### D-01: Inconsistent Page Headers

**Problem**

Most pages use `PageHero`, while Stable, Horse Detail, Foal Detail, dashboard, onboarding, and auth routes implement unrelated title structures. Title sizes, icon treatment, spacing, imagery, and metadata placement vary.

**Risks**

- Users cannot predict where page actions or context will appear.
- Page identity changes unnecessarily between domains.
- Header code is duplicated and hard to improve globally.

**Correction**

1. Inventory every routed page and classify its required header as standard, entity, auth, or exceptional.
2. Define the API for `PageHeader`, including title, subtitle, breadcrumbs, actions, metadata, image, and status.
3. Define `EntityHeader` around identity, image, core metadata, and entity actions.
4. Define `AuthHeader` around the wordmark and focused auth context.
5. Remove default ambient orb decorations from `PageHero`.
6. Migrate one pilot page for each header type.
7. Review responsive behavior and title wrapping.
8. Migrate remaining pages by family.
9. Delete or deprecate obsolete header implementations.

**Acceptance criteria**

- Every routed page uses an approved header type or documents an exception.
- Page title hierarchy is consistent.
- Actions occupy predictable locations.
- Header text does not overlap or truncate incorrectly at supported viewports.

### D-02: Arbitrary Page Widths

**Problem**

Pages use unrelated `max-w-4xl`, `5xl`, `6xl`, `7xl`, and arbitrary widths despite already living inside a shared shell.

**Correction**

1. Measure representative page content at supported desktop widths.
2. Approve `PageContainer` width variants.
3. Add the shared component.
4. Document which page families use each variant.
5. Replace arbitrary page wrappers.
6. Remove obsolete maximum-width classes.
7. Verify long tables, grids, forms, and empty states.

**Acceptance criteria**

- Routed pages use approved container variants.
- No unexplained arbitrary maximum widths remain.
- Content alignment remains consistent between header and body.

### D-03: Double Horizontal Padding

**Problem**

`DashboardLayout` provides outer gutters, then pages frequently apply another responsive padding layer.

**Correction**

1. Make shell gutter ownership explicit in documentation.
2. Add a development-only visual guide or Storybook layout fixture showing the canonical content edges.
3. Remove page-level outer `px-*` classes.
4. Retain padding only inside genuine panels and cards.
5. Verify mobile edge spacing and desktop alignment.
6. Add a source check for known duplicated outer-wrapper patterns.

**Acceptance criteria**

- Page headers and primary content share the same left and right edges.
- Mobile content retains minimum safe gutters.
- Pages do not narrow unpredictably inside the dashboard shell.

### D-04: Uncontrolled Corner Radii

**Problem**

Page code mixes token radii with `rounded`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, and `rounded-full` without semantic distinction.

**Correction**

1. Approve radius tokens for controls, cards, and overlays.
2. Update Tailwind configuration or shared classes to expose only approved semantics.
3. Update shared primitives first.
4. Replace arbitrary page-level radius classes.
5. Reserve circles/pills for avatars, status indicators, toggles, and actual pill controls.
6. Add a lint/source rule for unsupported radius utilities in page code.

**Acceptance criteria**

- Equivalent surfaces use the same radius.
- Buttons are not universally pill-shaped.
- Arbitrary radii require explicit documented exceptions.

### D-05: Static Glass Panels Animate Like Interactive Cards

**Problem**

`.glass-panel:hover` globally lifts and glows all glass panels, including static forms, summaries, alerts, and content containers.

**Correction**

1. Remove hover transform and glow from `.glass-panel`.
2. Add an explicit interactive surface variant.
3. Find panels that are links, buttons, or clickable cards.
4. Apply interactive treatment only to those elements.
5. Check keyboard focus styling matches hover affordance.
6. Verify layout does not shift during hover.

**Acceptance criteria**

- Static panels remain stationary.
- Interactive cards have clear hover and focus affordance.
- Hover effects do not change surrounding layout.

### D-06: Multiple Active Blur Layers

**Problem**

The stylesheet documents a single-blur-layer rule, but pages and footer components directly add backdrop blur in addition to glass surfaces.

**Correction**

1. Inventory all `backdrop-blur`, `backdropFilter`, and glass blur usage.
2. Classify each occurrence as page layer, overlay, or unnecessary decoration.
3. Keep blur only on the outermost approved layer.
4. Convert nested surfaces to opaque or semi-transparent non-blurred backgrounds.
5. Remove page-local blur utilities.
6. Add a source check with a narrow allowlist for layout and dialog primitives.
7. Test performance on lower-powered mobile hardware.

**Acceptance criteria**

- No nested blurred surfaces remain.
- Blur is controlled by shared primitives.
- Text remains readable when blur is unsupported.

### D-07: Button Implementation Drift

**Problem**

The shared `Button` defines a hierarchy, but many pages hand-style command buttons with unrelated dimensions, radii, gradients, colors, and focus behavior.

**Correction**

1. Audit raw buttons and classify them as command, icon command, tab, list row, toggle, or composite-control element.
2. Update `Button` to use the approved control radius.
3. Add or refine primary, secondary, tertiary, ghost, icon, and destructive variants.
4. Add pending/loading support without changing button dimensions.
5. Migrate command buttons to `Button`.
6. Migrate icon-only commands to `IconButton` with tooltips and accessible labels.
7. Leave raw buttons only where required by an accessible composite primitive.
8. Add source checks for command-style raw buttons.

**Acceptance criteria**

- Every workflow surface has at most one visually primary action.
- Equivalent actions use equivalent variants.
- All command buttons meet touch-target and focus requirements.

### D-08: Excessive Primary Actions

**Problem**

Some surfaces present multiple equally prominent primary buttons, such as Login showing both entry and account creation as gold primary actions.

**Correction**

1. Identify the intended primary action for every major workflow state.
2. Reclassify navigation and cancellation actions as secondary, tertiary, or links.
3. Document action hierarchy examples in Storybook.
4. Review confirmation dialogs and destructive workflows separately.
5. Validate hierarchy through screenshot review.

**Acceptance criteria**

- A user can identify the next intended action at a glance.
- Destructive actions do not resemble positive primary actions.
- Navigation does not compete with form submission.

### D-09: Universal Pill-Shaped Buttons

**Problem**

The shared button base applies `rounded-full` to every button while local controls often use rectangular shapes.

**Correction**

1. Change the shared button base to the approved control radius.
2. Add an explicit `pill` presentation only where appropriate.
3. Review compact filters and segmented controls for genuine pill usage.
4. Update screenshots and component tests.
5. Check long localized labels and narrow mobile widths.

**Acceptance criteria**

- Ordinary command buttons use a compact rounded rectangle.
- Pills are reserved for suitable semantics.

### D-10: Multiple Tab Systems

**Problem**

The frontend has `CelestialTabs`, `GoldTabs`, generic Radix tabs, and multiple manual tab implementations.

**Correction**

1. Choose one Radix-backed canonical Tabs API.
2. Support approved `underline` and `segmented` presentations through variants.
3. Standardize tab list overflow behavior.
4. Migrate Competition Results.
5. Migrate Grooms, Riders, Trainers, and Stable pages.
6. Migrate Clubs, Messages, Marketplace, and Competition Browser.
7. Remove old adapters after all consumers migrate.
8. Add keyboard-navigation and responsive tests.

**Acceptance criteria**

- All tab interfaces share keyboard behavior and selected-state semantics.
- Tab presentation changes through variants, not separate components.
- Mobile tabs scroll or wrap according to an approved rule.

### D-11: Direct Palette Colors

**Problem**

Page code frequently uses raw Tailwind colors and raw RGB/RGBA values rather than semantic design tokens.

**Correction**

1. Define semantic color roles: success, warning, danger, information, accent, neutral, disabled, and inverse.
2. Define background, border, icon, and text values for each role.
3. Map existing status components to the semantic roles.
4. Replace direct colors by page family.
5. Review contrast in default, hover, focus, and disabled states.
6. Add lint/source checks against direct palette colors in page code.
7. Maintain a short exception list for data visualization when necessary.

**Acceptance criteria**

- UI state colors derive from semantic tokens.
- Theme changes do not require page-level color edits.
- All text combinations meet the selected WCAG target.

### D-12: Competing Text Color Systems

**Problem**

Some components use semantic text tokens while others use `text-white` with arbitrary opacity.

**Correction**

1. Define text roles: primary, secondary, muted, disabled, inverse, link, and danger.
2. Test each role on every supported surface.
3. Replace opacity-based body and metadata text.
4. Keep opacity only for decorative nonessential elements.
5. Review small text separately because it has stricter contrast needs.

**Acceptance criteria**

- Body and metadata text use named semantic roles.
- Information is not communicated only by low opacity.
- Small text remains readable on all backgrounds.

### D-13: Fragmented Form Controls

**Problem**

Auth uses `celestial-input`, while Settings, Marketplace, Clubs, Messages, and other pages recreate inputs, selects, textareas, and focus rings.

**Correction**

1. Inventory input types and required states.
2. Build canonical `Input`, `PasswordInput`, `Select`, `Textarea`, `NumberInput`, `Checkbox`, and `Switch`.
3. Build `FormField` to own labels, descriptions, required markers, errors, and IDs.
4. Add normal, hover, focus, invalid, disabled, read-only, and loading stories.
5. Migrate authentication as the pilot.
6. Migrate Settings and Profile.
7. Migrate Marketplace and economy filters.
8. Migrate Clubs, Messages, and remaining forms.
9. Remove `celestial-input` after migration if it is no longer needed.

**Acceptance criteria**

- Equivalent fields have identical dimensions and state treatment.
- Every field has an accessible label and error association.
- Focus styling is consistent and visible.

### D-14: Fragmented Modal and Dialog Presentation

**Problem**

Modals use different overlays, widths, radii, z-index forms, padding, close buttons, and focus behavior.

**Correction**

1. Inventory every modal and classify it as informational, form, confirmation, destructive, or complex workflow.
2. Select either `GameDialog` or `BaseModal` as the canonical implementation.
3. Standardize overlay, panel, header, body, footer, close action, and width variants.
4. Implement scroll locking, focus trapping, Escape handling, and focus restoration.
5. Migrate simple confirmation dialogs first.
6. Migrate form dialogs.
7. Migrate multi-step marketplace and horse-detail dialogs.
8. Delete page-local overlay implementations.

**Acceptance criteria**

- All dialogs share predictable structure and accessibility behavior.
- Long dialog content scrolls without moving the page.
- Destructive dialogs use the approved danger hierarchy.

### D-15: Inconsistent Loading States

**Problem**

Pages use unrelated spinners, skeletons, plain text, and full-page loading states.

**Correction**

1. Define loading categories: route, page, section, collection, card, and button.
2. Build `PageLoading`, `SectionLoading`, and shared skeleton patterns.
3. Ensure skeleton geometry resembles final content.
4. Standardize pending labels and spinner placement in buttons.
5. Migrate page families.
6. Verify no layout shift when data resolves.
7. Apply reduced-motion behavior.

**Acceptance criteria**

- Similar loading contexts look and behave consistently.
- Loading states preserve page structure.
- Screen readers receive an appropriate loading announcement.

### D-16: Inconsistent Error States

**Problem**

Some pages use `ErrorCard`; others create custom red panels or plain red text.

**Correction**

1. Define field, inline, section, page, and fatal error levels.
2. Build shared `InlineError`, `ErrorState`, and page-level fallback behavior.
3. Define when retry, back, support, or dismiss actions appear.
4. Migrate recoverable data-fetch errors.
5. Migrate form/API errors.
6. Verify errors do not expose internal server details.

**Acceptance criteria**

- Error severity maps to a consistent visual treatment.
- Recoverable errors provide a clear next step.
- Errors are announced accessibly.

### D-17: Inconsistent Empty States

**Problem**

Empty rosters, search results, messages, marketplace history, and first-use states use unrelated icon sizes, spacing, and actions.

**Correction**

1. Define first-use, no-results, filtered-empty, unavailable, and completed-state variants.
2. Build a shared `EmptyState`.
3. Standardize optional primary and secondary actions.
4. Migrate high-traffic collections first.
5. Review copy for clarity and concision.

**Acceptance criteria**

- Empty states clearly explain why content is absent.
- Actions are shown only when they can resolve the state.
- Equivalent empty states have matching structure.

### D-18: Typography Hierarchy Drift

**Problem**

Titles and headings mix `fantasy-title`, `fantasy-header`, inline font families, plain bold text, and unrelated tracking values.

**Correction**

1. Approve roles for wordmark, page title, entity title, section heading, card title, body, label, caption, and numeric value.
2. Map each role to font family, size, weight, line height, and tracking tokens.
3. Add typography stories with long and short content.
4. Update headers and shared primitives.
5. Migrate page families.
6. Remove page-local font-family styles.

**Acceptance criteria**

- Typography communicates hierarchy consistently.
- Decorative display typography is reserved for the brand and exceptional moments.
- Headings wrap without overlap.

### D-19: Uncontrolled Icon Containers

**Problem**

Icons appear bare or inside many unrelated circle, square, gradient, and glow treatments.

**Correction**

1. Define icon sizes for page, section, card, inline, and compact action contexts.
2. Create `IconBox` with neutral and semantic variants.
3. Remove containers that add decoration without meaning.
4. Migrate header and state icons.
5. Migrate repeated cards and list rows.
6. Ensure unfamiliar icon buttons include tooltips.

**Acceptance criteria**

- Icon scale is predictable by context.
- Icon color communicates a semantic role where applicable.
- Decorative treatments do not compete with page content.

### D-20: Overdecorated `PageHero`

**Problem**

The current page hero uses radial glow orbs, gradient dividers, glowing icon containers, and image overlays as default presentation.

**Correction**

1. Decide whether operational pages need a hero at all.
2. Replace the default with a compact `PageHeader`.
3. Create an optional location-header variant using real artwork.
4. Remove orb configuration and decorative glow defaults.
5. Validate title readability over approved images.
6. Migrate operational pages first, followed by location pages.

**Acceptance criteria**

- Operational pages have restrained headers.
- Artwork is used only when it communicates location or subject.
- Header decoration does not dominate the first viewport.

### D-21: Inconsistent Route Backgrounds

**Problem**

Some routes use responsive scene backgrounds, some use fixed images, and others add page-local banners and overlays.

**Correction**

1. Inventory every route and current background source.
2. Define background categories and approved assets.
3. Centralize route mapping in the layout/background system.
4. Define one readability veil per category.
5. Remove page-local duplicate atmospheric backgrounds.
6. Test image loading, fallback gradients, and mobile crop.

**Acceptance criteria**

- Background selection follows documented route rules.
- Missing artwork falls back gracefully.
- Text contrast remains stable across assets.

### D-22: Nested Cards and Excessive Framing

**Problem**

Pages frequently place glass panels inside glass panels, making every section appear equally elevated.

**Correction**

1. Identify page sections that can become unframed layout bands.
2. Reserve cards for repeated entities, modals, and genuinely isolated tools.
3. Replace nested panels with spacing, dividers, or subtle backgrounds.
4. Flatten dialog internals.
5. Review Bank, Marketplace, Breeding, Settings, and dashboard first.

**Acceptance criteria**

- No card is nested inside another card without a documented functional reason.
- Page hierarchy is communicated through spacing and typography before borders.

### D-23: Inconsistent Currency Presentation

**Problem**

Money appears as literal “coins,” emojis, symbols, and differently formatted values.

**Correction**

1. Approve a canonical coin icon and terminology.
2. Build `Currency` with standard, compact, signed, and balance variants.
3. Include accessible text for icon-only representations.
4. Replace price and balance formatting across marketplace, shops, bank, rewards, and dialogs.
5. Add locale-aware numeric formatting.

**Acceptance criteria**

- All currency values use the shared component.
- Negative, positive, pending, and insufficient-funds values are consistent.

### D-24: Mobile Bottom-Surface Collision

**Problem**

The global `BottomNav` and Horse Detail `HorseActionBar` both occupy fixed bottom space.

**Correction**

1. Measure both components at supported mobile widths and safe-area insets.
2. Add a contextual-action slot to `DashboardLayout`.
3. Render contextual actions above or within the global bottom navigation.
4. Reserve the total height in document flow.
5. Account for virtual keyboards and landscape screens.
6. Migrate `HorseActionBar`.
7. Test modals and scroll-to-bottom behavior.

**Acceptance criteria**

- Fixed controls never overlap one another or obscure content.
- All actions remain reachable at mobile sizes.
- Safe-area insets are respected.

### D-25: Authentication Pages Bypass `AuthLayout`

**Problem**

`AuthLayout` exists, but Login, Register, Forgot Password, Reset Password, and Verify Email largely duplicate shells, branding, cards, and footers.

**Correction**

1. Compare all auth page requirements against `AuthLayout`.
2. Update `AuthLayout` to support required states without page-specific styling hooks becoming a dumping ground.
3. Add shared auth form header, footer, field, error, and success-state components.
4. Migrate Login.
5. Migrate Register.
6. Migrate Forgot and Reset Password.
7. Migrate Verify Email.
8. Remove duplicate page backgrounds and footers.
9. Add shared responsive and accessibility tests.

**Acceptance criteria**

- All auth pages use the shared layout.
- Branding, widths, spacing, and footer content are consistent.
- No auth route duplicates the outer shell.

### D-26: Authentication Footer Drift

**Problem**

Some pages calculate the current year while Forgot Password hardcodes 2025.

**Correction**

1. Move all footer rendering to `AuthLayout`.
2. Remove page-local copyright strings.
3. Add a simple shared-layout test.

**Acceptance criteria**

- Auth footer content has one implementation.
- The year updates dynamically.

### D-27: Ambiguous Stable Navigation

**Problem**

`/stable` and `/my-stable` both present as “My Stable” while serving different experiences.

**Correction**

1. Document the product purpose of each route.
2. Decide whether they should be merged or clearly renamed.
3. If merged, create one information architecture and redirect the old route.
4. If retained, assign distinct names, icons, descriptions, and navigation placement.
5. Update breadcrumbs, links, page titles, and tests.

**Acceptance criteria**

- Users can predict the destination of each stable-related link.
- Duplicate naming is eliminated.

### D-28: Uncontrolled Motion

**Problem**

Panels lift, buttons scale, glows intensify, skeletons pulse, and custom animations run without a unified motion policy.

**Correction**

1. Define approved durations, easing, and motion types.
2. Restrict hover movement to interactive elements.
3. Add global reduced-motion handling.
4. Disable nonessential shimmer and floating effects under reduced motion.
5. Review modal, disclosure, loading, toast, and celebration motion.
6. Add automated reduced-motion screenshots where practical.

**Acceptance criteria**

- Motion communicates state or interaction.
- Static content does not move on hover.
- Reduced-motion users receive a stable experience.

### D-29: Missing Design-System Enforcement

**Problem**

Nothing reliably prevents pages from adding new direct colors, arbitrary radii, raw blur, duplicate outer padding, custom modal overlays, or command-style raw buttons.

**Correction**

1. Define enforceable rules after canonical primitives exist.
2. Implement ESLint rules where AST context is needed.
3. Implement narrow source scans for class-pattern restrictions.
4. Add Storybook coverage requirements for shared primitives.
5. Add Playwright screenshots for representative page families.
6. Maintain an exception file containing owner, justification, and expiry.
7. Fail CI on expired or stale exceptions.

**Acceptance criteria**

- New violations fail locally and in CI.
- Exceptions are explicit, temporary, and reviewable.
- Enforcement runs quickly enough for normal development.

## 8. Phased Implementation Plan

### Phase 0: Baseline, Inventory, and Approval

**Purpose:** Prevent subjective redesign and establish measurable starting conditions.

#### Tasks

1. Generate a route inventory from `nav-items.tsx` and direct routes in `App.tsx`.
2. Record each page’s:
   - Header type
   - Container width
   - Outer padding
   - Background
   - Surface types
   - Tab implementation
   - Forms
   - Dialogs
   - Loading, error, and empty states
   - Mobile fixed elements
3. Capture screenshots at:
   - 390x844 mobile
   - 768x1024 tablet
   - 1440x900 desktop
4. Capture loading, empty, error, populated, dialog-open, and destructive states where available.
5. Approve the target design architecture in Section 6.
6. Identify intentional exceptions.
7. Create implementation Beads issues grouped by phase and page family.

#### Deliverables

- Route/design inventory
- Baseline screenshot set
- Approved token and primitive decisions
- Prioritized Beads backlog

#### Exit criteria

- No foundation implementation begins before width, radius, typography, surface, button, and color decisions are approved.

### Phase 1: Layout Foundation

**Issues addressed:** D-01, D-02, D-03, D-20, D-21, D-24

#### Work package 1.1: Page containers

1. Implement `PageContainer`.
2. Add Storybook examples for every variant.
3. Migrate three representative pages.
4. Verify content alignment.
5. Approve the API before broad migration.

#### Work package 1.2: Headers

1. Implement `PageHeader`.
2. Implement `EntityHeader`.
3. Refactor `AuthHeader`.
4. Add action, breadcrumb, metadata, long-title, and mobile stories.
5. Pilot on Settings, Horse Detail, and Login.

#### Work package 1.3: Background ownership

1. Document route background categories.
2. Consolidate route mapping.
3. Remove duplicate page-level background layers.
4. Test fallback behavior and image crops.

#### Work package 1.4: Bottom surfaces

1. Design contextual bottom-action API.
2. Add safe-area and reserved-height tokens.
3. Migrate Horse Detail.
4. Test mobile keyboard and landscape behavior.

#### Exit criteria

- Pilot pages use canonical containers and headers.
- Shell and page padding ownership is unambiguous.
- No fixed bottom controls overlap.

### Phase 2: Visual Foundation

**Issues addressed:** D-04, D-05, D-06, D-11, D-12, D-18, D-19, D-22, D-28

#### Work package 2.1: Tokens

1. Finalize semantic colors.
2. Finalize text roles.
3. Finalize radii.
4. Finalize spacing and elevation.
5. Finalize motion values.
6. Add token documentation and visual swatches.

#### Work package 2.2: Surfaces

1. Implement `Surface`.
2. Remove hover behavior from base glass panels.
3. Implement explicit interactive behavior.
4. Add blur ownership rules.
5. Migrate common panel components.

#### Work package 2.3: Typography and icons

1. Implement typography role classes/components.
2. Implement `IconBox`.
3. Update shared headers, states, and cards.
4. Remove page-local font declarations during migration.

#### Work package 2.4: Motion

1. Add reduced-motion CSS.
2. Update shared transitions.
3. Remove motion from static surfaces.
4. Audit celebration effects separately so meaningful moments can remain expressive.

#### Exit criteria

- Shared primitives use approved tokens.
- Static panels no longer animate.
- Nested blur is eliminated from pilot pages.
- Reduced-motion behavior exists globally.

### Phase 3: Controls and Interaction Primitives

**Issues addressed:** D-07, D-08, D-09, D-10, D-13, D-14, D-23

#### Work package 3.1: Buttons

1. Correct shared radius.
2. Finalize variants.
3. Add `IconButton`.
4. Add pending state.
5. Add stories and accessibility tests.
6. Migrate shared components before pages.

#### Work package 3.2: Tabs

1. Consolidate on one API.
2. Implement approved variants.
3. Add overflow and mobile behavior.
4. Add keyboard tests.

#### Work package 3.3: Forms

1. Implement form controls.
2. Implement `FormField`.
3. Add validation and disabled-state stories.
4. Add accessibility tests.

#### Work package 3.4: Dialogs

1. Choose canonical dialog base.
2. Implement size and purpose variants.
3. Add focus and scroll behavior tests.
4. Provide migration examples.

#### Work package 3.5: Currency

1. Approve icon and terminology.
2. Implement formatting variants.
3. Add signed amount and insufficient-funds examples.

#### Exit criteria

- Canonical controls cover all known page requirements.
- New page migration does not require local copies of these controls.

### Phase 4: Semantic State Primitives

**Issues addressed:** D-15, D-16, D-17

#### Work package 4.1: Loading

1. Implement page and section loaders.
2. Implement shared skeleton shapes.
3. Implement button pending behavior.
4. Add reduced-motion handling.

#### Work package 4.2: Errors

1. Implement error severity levels.
2. Define retry and navigation actions.
3. Standardize field and API errors.

#### Work package 4.3: Empty states

1. Implement empty-state variants.
2. Add optional action hierarchy.
3. Review and standardize copy.

#### Exit criteria

- Page teams can represent every asynchronous state with shared components.

### Phase 5: Authentication Pilot Migration

**Issues addressed:** D-07, D-08, D-13, D-14, D-15, D-16, D-18, D-25, D-26

#### Steps

1. Update `AuthLayout`.
2. Migrate Login.
3. Verify login validation, API error, pending, and redirected states.
4. Migrate Register.
5. Verify password requirements and long validation messages.
6. Migrate Forgot Password.
7. Migrate Reset Password.
8. Migrate Verify Email.
9. Remove duplicate backgrounds, wordmarks, cards, and footers.
10. Capture before/after screenshots.
11. Run keyboard, screen-reader, and responsive checks.
12. Remove obsolete auth styles.

#### Exit criteria

- All authentication routes use one visual and interaction architecture.
- No auth page implements its own shell.

### Phase 6: World Service Page Migration

**Pages**

- Veterinarian
- Farrier
- Feed Shop
- Tack Shop
- Grooms
- Riders
- Trainers
- Crafting

#### Steps

1. Define a reusable service-page composition.
2. Standardize location header and artwork ratio.
3. Standardize horse selector.
4. Standardize service/item cards.
5. Standardize tabs.
6. Standardize booking/purchase controls.
7. Standardize currency.
8. Standardize loading, empty, success, and error states.
9. Remove duplicate image-banner wrappers.
10. Verify one-column mobile and dense desktop layouts.

#### Exit criteria

- Moving between service locations feels like navigating one application.
- Equivalent booking and purchase actions use the same interaction patterns.

### Phase 7: Marketplace and Economy Migration

**Pages**

- Marketplace Hub
- Horse Marketplace
- Horse Trader
- Groom Marketplace
- Bank
- Inventory
- Prize History

#### Steps

1. Standardize listing cards and item cards.
2. Standardize search and filter toolbars.
3. Standardize advanced-filter disclosure.
4. Standardize pricing and balance display.
5. Migrate purchase and listing dialogs.
6. Standardize pagination.
7. Flatten nested surfaces.
8. Migrate loading, no-results, empty-history, and error states.
9. Verify narrow mobile toolbars and long currency values.

#### Exit criteria

- Economy workflows use consistent filters, cards, currency, confirmations, and states.

### Phase 8: Community and Messaging Migration

**Pages**

- Community
- Clubs
- Message Board
- Message Thread
- Messages

#### Steps

1. Standardize community navigation and tabs.
2. Standardize list rows and unread indicators.
3. Standardize badges and tags.
4. Migrate compose and governance dialogs.
5. Migrate club forms to shared fields.
6. Remove isolated violet/indigo focus styling unless approved semantically.
7. Standardize empty and loading states.
8. Verify long thread titles, usernames, and message content.

#### Exit criteria

- Community surfaces share one visual grammar and accessible control behavior.

### Phase 9: Stable, Dashboard, and Entity Detail Migration

**Pages**

- Dashboard
- Stable View
- My Stable
- Horse Detail
- Horse Equipment
- Foal Detail

#### Steps

1. Resolve `/stable` versus `/my-stable` naming and product scope.
2. Consolidate duplicate horse-card implementations where possible.
3. Migrate dashboard and stable containers.
4. Replace bespoke stable header with canonical header.
5. Implement and migrate `EntityHeader`.
6. Standardize entity tabs.
7. Standardize stat grids and metadata.
8. Migrate contextual bottom actions.
9. Flatten nested surfaces.
10. Standardize entity loading, missing, and error states.
11. Verify dense content at mobile widths.

#### Exit criteria

- Stable and entity workflows have clear information architecture.
- Horse identity and actions remain consistent across roster and detail views.

### Phase 10: Training, Breeding, and Competition Migration

**Pages**

- Training
- Breeding
- Competition Browser
- Competition Results
- Conformation redirect/entry surfaces

#### Steps

1. Standardize workflow page headers.
2. Standardize selection cards and selectors.
3. Standardize step and confirmation layouts.
4. Standardize primary action placement.
5. Consolidate tab systems.
6. Standardize result summaries and statistics.
7. Replace direct status colors.
8. Migrate loading, validation, error, and success states.
9. Verify long discipline and competition names.
10. Test complete workflows on mobile and desktop.

#### Exit criteria

- Core game workflows use predictable controls, actions, and feedback.

### Phase 11: Settings and Profile Migration

#### Steps

1. Apply canonical narrow/content container.
2. Migrate account fields and preferences.
3. Standardize section headings and dividers.
4. Migrate switches, checkboxes, and sound controls.
5. Migrate delete-account dialog.
6. Align Profile editing with Settings form behavior.
7. Ensure the danger zone is distinct but not visually dominant.

#### Exit criteria

- Account management uses one form system and predictable save/cancel behavior.

### Phase 12: Enforcement and Legacy Removal

#### Steps

1. Add lint rules for direct colors where practical.
2. Add source checks for:
   - Unsupported radius utilities
   - Raw backdrop blur
   - Duplicate outer page padding
   - Unsupported page maximum widths
   - Page-local modal overlays
   - Command-style raw buttons
3. Add a reviewed exception registry.
4. Add Storybook coverage for all shared primitives.
5. Add Playwright screenshots for representative pages and states.
6. Add Axe checks to representative workflows.
7. Delete deprecated components and CSS aliases.
8. Verify no stale imports remain.
9. Update frontend architecture and development documentation.

#### Exit criteria

- New inconsistency is blocked by CI.
- Legacy primitives have no consumers.
- Exceptions have owners and expiration dates.

## 9. Pull Request Strategy

Each pull request should contain one of:

- One foundational primitive
- One tightly related primitive family
- One page family migration
- One enforcement gate

Every migration pull request should include:

1. Linked Beads issue.
2. Scope statement.
3. Before/after screenshots for desktop and mobile.
4. Accessibility notes.
5. Tests added or updated.
6. Any retained exception and its reason.
7. Confirmation that business behavior did not change.

Avoid combining:

- API changes with visual migration
- Business logic refactors with token migration
- Multiple unrelated page families
- Large formatting-only churn with functional component work

## 10. Verification Matrix

Each page family must pass:

| Area          | Required verification                                         |
| ------------- | ------------------------------------------------------------- |
| Layout        | Mobile, tablet, desktop screenshots                           |
| Typography    | Long titles, wrapping, hierarchy                              |
| Controls      | Hover, focus, active, disabled, pending                       |
| Forms         | Labels, errors, autocomplete, keyboard behavior               |
| Tabs          | Keyboard navigation, overflow, selected state                 |
| Dialogs       | Focus trap, Escape, close button, restoration, scroll lock    |
| Async states  | Loading, empty, error, populated                              |
| Accessibility | Axe plus manual keyboard review                               |
| Motion        | Normal and reduced-motion mode                                |
| Content       | Long names, large numbers, zero values, missing optional data |
| Mobile        | Safe areas, virtual keyboard, fixed controls, landscape       |

## 11. Risk Management

### Risk: Broad visual regressions

**Mitigation:** Establish screenshot baselines and migrate in small page-family pull requests.

### Risk: Shared primitive changes break unrelated pages

**Mitigation:** Add component stories and tests before changing consumers; use temporary compatibility variants only when necessary.

### Risk: Migration stalls with both old and new systems

**Mitigation:** Track each old primitive’s consumers, assign an owner, and set removal criteria.

### Risk: Source checks create noisy false positives

**Mitigation:** Introduce enforcement after canonical alternatives exist; use narrow patterns and expiry-tracked exceptions.

### Risk: Design cleanup alters business behavior

**Mitigation:** Keep data fetching, state transitions, and domain logic unchanged in visual migration pull requests.

### Risk: Accessibility regresses during visual standardization

**Mitigation:** Make accessibility tests part of primitive acceptance criteria and page-family verification.

## 12. Suggested Priority

### Priority 0: Structural blockers

- D-02 Arbitrary page widths
- D-03 Double horizontal padding
- D-05 Static panel hover behavior
- D-06 Multiple blur layers
- D-24 Mobile bottom-surface collision

### Priority 1: Core consistency

- D-01 Headers
- D-04 Radii
- D-07 Buttons
- D-10 Tabs
- D-11 Semantic colors
- D-12 Text roles
- D-13 Forms
- D-14 Dialogs
- D-18 Typography

### Priority 2: Workflow quality

- D-08 Action hierarchy
- D-15 Loading
- D-16 Errors
- D-17 Empty states
- D-19 Icons
- D-22 Nested cards
- D-23 Currency
- D-25 Auth layout migration
- D-27 Stable navigation
- D-28 Motion

### Priority 3: Long-term protection

- D-20 Page hero simplification
- D-21 Background consolidation
- D-26 Footer cleanup
- D-29 Enforcement

## 13. Definition of Done

The frontend consistency program is complete when:

- Every routed page uses an approved container and header.
- Shell and page layout responsibilities are documented and enforced.
- Shared primitives cover buttons, tabs, forms, dialogs, surfaces, currency, and async states.
- Direct page-level palette colors and arbitrary radii have been eliminated or explicitly excepted.
- Static panels do not animate as interactive controls.
- Blur follows the single-layer rule.
- Auth pages use one shared layout.
- Stable navigation is unambiguous.
- Fixed mobile controls do not overlap.
- Representative pages have desktop/mobile screenshot coverage.
- Core workflows pass accessibility checks.
- Reduced-motion behavior is implemented.
- Legacy design components and styles have no consumers.
- CI blocks new violations.

## 14. Approval Decisions Required

Before implementation, reviewers should approve:

1. The `PageContainer` variants and widths.
2. The three header families.
3. The radius scale.
4. The surface hierarchy and blur policy.
5. The button shape and action hierarchy.
6. The canonical tab presentation variants.
7. The semantic color and text-role model.
8. The canonical dialog base.
9. The currency icon and terminology.
10. Whether `/stable` and `/my-stable` should merge or be renamed.
11. The initial page-family migration order.
12. The proposed lint and source enforcement rules.

No broad page migration should begin until these decisions are approved.
