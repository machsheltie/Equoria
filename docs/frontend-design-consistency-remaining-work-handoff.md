# Frontend Design Consistency: Remaining Work and Agent Handoff

**Prepared:** 2026-06-10  
**Audience:** Implementation agent working in Claude Code or an equivalent coding environment  
**Primary epic:** `Equoria-o5hub`  
**Original plan:** `docs/frontend-design-consistency-remediation-plan.md`  
**Design decisions:** `docs/design-system/DECISIONS.md`  
**Current conclusion:** The design-system foundation is partially implemented, but the repository-wide remediation is not complete.

## 1. How to Use This Document

This is an implementation handoff, not a request for another audit.

The implementing agent should:

1. Read this document completely before changing code.
2. Run `bd prime`.
3. Run `bd show Equoria-o5hub`.
4. Select one ready child issue or one explicitly described slice below.
5. Claim it with `bd update <issue-id> --claim`.
6. Inventory every consumer in the declared scope before editing.
7. Implement the entire slice, including migration, tests, residue scans, documentation, and Beads updates.
8. Do not declare the program complete while any required migration or enforcement issue remains open.

This document deliberately gives detailed instructions. Follow the existing repository architecture and tests, but do not interpret a passing primitive unit test as proof that the application has adopted the primitive.

Run Claude Code with approval prompting disabled (`--ask-for-approval never`) for this handoff. The agent should use existing repository dependencies and available permissions, avoid unnecessary privileged operations, and report a genuine environmental blocker instead of pausing repeatedly for command approval.

## 2. Executive Verdict

The previous work successfully established several useful primitives:

- `PageContainer`
- `PageHeader`
- `EntityHeader`
- `Surface`
- Semantic role tokens and text-role utilities
- Updated `Button`
- `IconButton`
- Canonical form controls and `FormField`
- Canonical tabs API
- `GameDialog`
- `Currency`
- Shared loading, error, and empty-state primitives
- Shared `AuthLayout`

Those additions compile and their focused tests pass. The production build also passes.

However, the original objective was not merely to create primitives. It was to migrate the frontend to a coherent and enforceable design system. That broader objective remains incomplete.

At the time of this handoff:

| Indicator                                                 | Current evidence |
| --------------------------------------------------------- | ---------------: |
| Top-level page files                                      |               40 |
| Page files using `PageContainer`                          |                4 |
| Page files using `PageHeader`                             |                1 |
| Page files using `EntityHeader`                           |                1 |
| Page files still referencing `PageHero`                   |               31 |
| Page consumers of canonical `Currency`                    |                1 |
| Page consumers of `Surface`                               |                0 |
| Raw `<button>` occurrences in page files                  |               82 |
| Page-local or component-local `fixed inset-0` occurrences |               31 |
| `window.confirm()` occurrences                            |                4 |
| Direct blur declarations in pages/components              |               41 |
| Unsupported outer-width patterns in pages                 |               41 |
| Direct palette/text-opacity matches in pages              |              344 |
| Unsupported large/arbitrary radius matches in pages       |               43 |

These counts are diagnostic baselines, not permanent thresholds. Some matches may be legitimate exceptions, but exceptions must be reviewed and recorded. The desired default is zero unexplained violations.

The Beads epic itself confirms the state:

- `Equoria-o5hub` is still `IN_PROGRESS`.
- Only 9 of 28 children were reported complete when reviewed.
- The tracker reported approximately 32% completion.
- Page-family migrations, baseline screenshots, bottom-surface coordination, `IconBox`, motion policy, enforcement, and legacy removal remain open.

## 3. Why the Previous Execution Stopped Short

The problem is mainly orchestration and completion criteria, not an inability to write the components.

### 3.1 Primitive completion was confused with program completion

Several issues were implemented as:

1. Build a canonical primitive.
2. Add unit tests.
3. Migrate one pilot consumer.
4. Commit a green slice.

That is a valid first slice, but it does not satisfy a repository-wide migration. The current application therefore contains both old and new systems.

Examples:

- `Currency` exists, but only Bank uses it.
- `Surface` exists, but no page uses it.
- Canonical tabs exist, but most tabbed workflows still use manual tab rows.
- `GameDialog` exists, but `BaseModal`, hand-built overlays, and browser confirmation dialogs remain.
- Async-state primitives exist, but many local loaders and empty/error components remain.

### 3.2 The work was divided into issues that intentionally allowed pilots

Some foundation issues were correctly titled around primitive creation and pilot migration. Closing those issues did not mean the page-family issues were complete.

An agent that works one issue at a time may stop after the issue it was assigned, especially after committing and pushing. Unless the prompt explicitly says to continue through all unblocked child issues, this behavior is expected.

### 3.3 Green tests verified components, not adoption

The focused tests prove that the new primitives render and behave according to their test suites. They do not prove:

- Every page uses them.
- Legacy components have no consumers.
- Direct styling has been removed.
- Page families are visually consistent.
- Fixed mobile surfaces do not collide.
- CI prevents regression.

Testing a new `Currency` component cannot detect that another page still formats prize money as US dollars.

### 3.4 The original plan used broad verbs without file-complete gates

Instructions such as "standardize tabs" and "migrate dialogs" explain direction but do not always tell the agent exactly when to stop.

Every migration issue needs:

- An explicit consumer inventory.
- A named list of files or route families.
- A before count.
- An expected after count.
- A documented exception process.
- A test list.
- A source-residue command.

Without these, an enthusiastic agent can complete a representative sample and reasonably believe it has demonstrated the pattern.

### 3.5 Baseline work was skipped before implementation

`Equoria-o5hub.1`, the route screenshot baseline, remains open even though later phases began. This violated the sequencing in the original plan.

Consequences:

- Visual changes were reviewed mainly through code and component tests.
- There is no complete before-and-after route set.
- Cross-page inconsistencies are harder to detect.
- Responsive regressions can pass unit tests.

### 3.6 Enforcement was deferred until the end

The plan correctly placed final enforcement after canonical alternatives existed. The practical problem is that no temporary ratchet was added during migration.

New and old patterns can therefore coexist indefinitely. The repository currently has no automated rule that says:

- This family may no longer add a manual tab.
- This migrated page may no longer use direct palette colors.
- `BaseModal` consumer count must never increase.
- Page-local overlays may not be added.
- `PageHero` may only be used by approved location pages.

### 3.7 The documentation became stale as soon as implementation began

The inventory files describe the pre-migration state. For example, the foundation inventory still says auth pages do not use `AuthLayout`, even though they were migrated.

Stale inventories can mislead future agents. Each completed family migration must update its inventory or replace it with an explicit completion record.

### 3.8 Some design decisions were agent-adopted rather than user-ratified

`docs/design-system/DECISIONS.md` says several decisions were adopted autonomously and remain user-ratifiable. This is workable for reversible implementation, but it leaves ambiguity around:

- Stable route naming.
- Final dialog migration policy.
- Native versus Radix Select/Switch.

An agent may pause or choose the lowest-risk partial implementation when a decision appears unresolved.

### 3.9 Large scope encourages session-sized slices

The complete remediation crosses dozens of pages and hundreds of style references. A coding agent will naturally break this into session-sized commits.

The correction is not to demand one enormous commit. The correction is to provide persistent continuation rules:

- A slice may finish.
- The issue remains open until all consumers are migrated.
- The next session resumes from the residue inventory.
- The epic closes only after the global gates pass.

## 4. Agent Operating Contract

Give the implementing agent the following rules together with this document.

### 4.1 Do not redefine the design system

Use:

- `docs/design-system/DECISIONS.md`
- `frontend/src/styles/tokens.css`
- Existing canonical primitives

Do not invent an additional page container, tab system, modal base, currency formatter, or surface abstraction.

If a canonical primitive cannot represent a real requirement:

1. Prove the missing capability with a concrete consumer.
2. Extend the canonical primitive narrowly.
3. Add tests for the capability.
4. Migrate the consumer.
5. Do not create a competing primitive.

### 4.2 Separate foundation defects from migrations

Fix defects in canonical primitives before multiplying their use.

Known defects to address early:

- `PageHeader` and `EntityHeader` truncate long titles.
- `Button` pending behavior can be overridden by prop spread order.
- `Button asChild pending` does not behaviorally disable anchor navigation.
- Canonical currency coexists with old currency helpers and USD formatting.

### 4.3 Inventory before editing

For each issue:

1. Run `rg` to list every consumer.
2. Save the list in the Beads issue notes.
3. Classify each result as:
   - Must migrate.
   - Approved exception.
   - False positive.
4. Migrate all "must migrate" results in the declared slice.
5. Run the same command again.
6. Record the after count.

### 4.4 Do not weaken tests to make migrations pass

Preserve business behavior. Update tests only when markup, accessibility semantics, or intended visual contracts change.

Do not:

- Delete behavioral assertions.
- Replace exact workflow assertions with visibility-only assertions.
- Add broad test skips.
- Hide failures behind snapshots without reviewing the rendered state.
- Treat unrelated failures as permission to avoid focused verification.

### 4.5 Use small commits but complete issue scopes

A page-family issue may use multiple commits. Each commit should be coherent, but the Beads issue stays open until its complete acceptance criteria pass.

Use notes such as:

```text
Slice 2 complete:
- Migrated GroomsPage and RidersPage tabs.
- Remaining consumers: TrainersPage, StableView, HorseDetailPage.
- Issue remains in progress.
```

### 4.6 Completion requires four kinds of evidence

Every completed migration issue needs:

1. **Behavioral evidence:** Focused tests and relevant workflow tests pass.
2. **Build evidence:** TypeScript and production build pass.
3. **Visual evidence:** Mobile and desktop screenshots were reviewed.
4. **Residue evidence:** Search commands prove the old pattern is gone from the issue scope.

### 4.7 Do not close the epic early

`Equoria-o5hub` may close only when:

- All required child issues are closed.
- Global residue gates pass.
- Exceptions are documented.
- Visual baseline and regression coverage exist.
- Legacy primitives have zero non-test consumers.
- The full frontend quality gate passes.

## 5. Required Execution Order

Use this order unless a dependency in Beads requires a small adjustment.

### Stage A: Restore trustworthy prerequisites

1. Capture baseline screenshots: `Equoria-o5hub.1`.
2. Correct canonical primitive defects.
3. Finish currently in-progress primitive issues:
   - `Equoria-o5hub.11` tabs
   - `Equoria-o5hub.12` forms
   - `Equoria-o5hub.13` dialogs
4. Implement missing visual primitives:
   - `Equoria-o5hub.8` typography and `IconBox`
   - `Equoria-o5hub.9` motion policy
5. Implement bottom-surface coordination:
   - `Equoria-o5hub.5`

### Stage B: Migrate page families

1. World services: `Equoria-o5hub.17`
2. Marketplace and economy: `Equoria-o5hub.18`
3. Community and messaging: `Equoria-o5hub.19`
4. Stable, dashboard, and entity detail: `Equoria-o5hub.20`
5. Training, breeding, and competition: `Equoria-o5hub.21`
6. Settings and profile: `Equoria-o5hub.22`

### Stage C: Enforce and remove legacy systems

1. Implement source and lint ratchets early in warning/baseline mode.
2. Reduce each baseline while migrating.
3. Make all migrated-scope rules blocking.
4. Finish global enforcement and legacy deletion under `Equoria-o5hub.23`.
5. Re-run the full route screenshot and accessibility suite.
6. Close the epic only after global verification.

## 6. Stage A Detailed Plan

### 6.1 Capture the visual baseline

**Beads:** `Equoria-o5hub.1`

#### Objective

Create a reproducible record of the current UI across supported viewport classes and important states.

#### Steps

1. Read the current route tree in `frontend/src/App.tsx`.
2. Reconcile it with `frontend/src/components/layout/navItems.ts`.
3. Build a route manifest containing:
   - Route
   - Authentication requirement
   - Required fixture/data state
   - Page family
   - Important modal or async state
4. Capture each reachable route at:
   - 390x844
   - 768x1024
   - 1440x900
5. Capture representative:
   - Loading
   - Empty
   - Error
   - Populated
   - Dialog-open
   - Destructive-confirmation
   - Long-content states
6. Store screenshots in the location selected by repository convention.
7. Document commands and required environment setup.
8. Add a stable Playwright entry point so future agents can reproduce the set.

#### Important cautions

- Do not use a mocked page that bypasses the real layout.
- Hide or stabilize timestamps and random content when necessary.
- Do not accept screenshots with loading spinners unless loading is the state being captured.
- Confirm that images have loaded.
- Confirm that mobile screenshots include bottom navigation and safe-area behavior.

#### Closure gate

- Route manifest is complete.
- Screenshot command is documented.
- Screenshots exist for every routed family.
- The screenshots can be regenerated.
- The issue notes include artifact paths and command output.

### 6.2 Repair canonical header behavior

**Primary files:**

- `frontend/src/components/layout/PageHeader.tsx`
- `frontend/src/components/layout/EntityHeader.tsx`
- Their test files

#### Problem

Both headers apply `truncate` to the `h1`. This hides long names and contradicts the plan's long-title acceptance criteria.

#### Steps

1. Remove single-line truncation from canonical titles.
2. Allow natural wrapping.
3. Add `min-w-0`, `break-words`, or an equivalent safe wrapping strategy where required.
4. Verify actions wrap below the title instead of compressing it to an unusable width.
5. Test:
   - Long unbroken entity name
   - Long multi-word title
   - Title plus two actions
   - 320px or 390px viewport behavior
   - Metadata wrapping
6. Add visual stories or screenshot fixtures for the long-title states.

#### Closure gate

- No canonical header title silently ellipsizes.
- Actions remain visible.
- No title overlaps adjacent controls.
- Unit tests and responsive screenshots pass.

### 6.3 Repair pending button semantics

**Primary files:**

- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/__tests__/button.test.tsx`
- `frontend/src/components/ui/IconButton.tsx`

#### Problems

1. Pending props are spread before caller props, so a caller can pass `disabled={false}` and override the pending lock.
2. An anchor rendered through `asChild` does not honor the HTML `disabled` attribute.
3. `asChild pending` omits the spinner and may still navigate.

#### Steps

1. Decide and document the supported contract:
   - Preferred: disallow `pending` with link-like `asChild` content.
   - Alternative: implement behavioral prevention with `aria-disabled`, click prevention, keyboard prevention, and appropriate focus behavior.
2. Ensure pending always wins over caller-supplied disabled state.
3. Preserve button dimensions.
4. Preserve accessible status text.
5. Add tests proving:
   - `pending disabled={false}` remains disabled.
   - Pending native buttons do not submit twice.
   - Pending anchor-like children cannot navigate, if supported.
   - `aria-busy` and `aria-disabled` are correct.
   - IconButton follows the same contract.

#### Closure gate

- Pending state cannot be overridden accidentally.
- Supported polymorphic behavior is explicit and tested.
- No invalid disabled semantics are relied on.

### 6.4 Finish canonical tabs

**Beads:** `Equoria-o5hub.11`

#### Current state

The canonical API exists and `CompetitionResultsPage` is migrated. The issue correctly remains in progress.

#### Known remaining consumers

- `frontend/src/pages/GroomsPage.tsx`
- `frontend/src/pages/RidersPage.tsx`
- `frontend/src/pages/TrainersPage.tsx`
- `frontend/src/pages/ClubsPage.tsx`
- `frontend/src/pages/MessagesPage.tsx`
- `frontend/src/pages/MessageBoardPage.tsx`
- `frontend/src/pages/HorseMarketplacePage.tsx`
- `frontend/src/pages/CompetitionBrowserPage.tsx`
- `frontend/src/pages/HorseDetailPage.tsx`
- `frontend/src/components/breeding/BreedingCenter.tsx`
- `frontend/src/components/breeding/CompatibilityPreview.tsx`
- Other manual tab matches found by the residue scan

Do not migrate components that use `aria-selected` for a non-tab selection control without first checking their semantics.

#### Steps

1. Add the mobile overflow edge affordance required by the issue, or record a reviewed decision rejecting it.
2. Migrate simple two-tab pages first:
   - Grooms
   - Riders
   - Trainers
3. Migrate community pages.
4. Migrate marketplace and competition browser tabs.
5. Migrate Horse Detail last because it has a large tab set and deeper state coupling.
6. Preserve:
   - Existing selected tab state
   - URL/query behavior
   - Lazy content behavior
   - Test IDs only where they are contractually needed
7. Add keyboard tests:
   - Arrow navigation
   - Home/End when provided by Radix
   - Focus visibility
   - Selected panel association
8. Verify mobile horizontal scrolling without wrapping.
9. Remove `CelestialTabs` and `GoldTabs` adapters only after zero production consumers remain.

#### Residue commands

```powershell
rg -n 'role="tablist"|role="tab"|aria-selected' frontend/src/pages frontend/src/components -g '*.tsx'
rg -n 'CelestialTabs|GoldTabs' frontend/src -g '*.tsx'
```

#### Closure gate

- All genuine tabs use the canonical Radix-backed API.
- Deprecated tab adapters have zero non-test consumers.
- Long tab sets work on mobile.
- Keyboard behavior is verified.

### 6.5 Finish canonical forms

**Beads:** `Equoria-o5hub.12`

#### Current state

The component layer exists. Several auth fields and most application forms still use legacy classes or local control recipes.

#### First remaining auth work

- `RegisterPage`
- `ResetPasswordPage`
- `ForgotPasswordPage`
- Any remaining `celestial-input` use in auth

#### Later family work

- Settings/Profile
- Marketplace filters
- Club forms
- Message compose forms
- Booking and purchase controls where they are true form fields

#### Steps

1. Resolve the native versus Radix Select/Switch decision before broad migration.
2. Do not install packages without approval if repository policy requires approval.
3. Migrate one form at a time while preserving:
   - React Hook Form or existing state integration
   - Validation timing
   - Error messages
   - Autocomplete attributes
   - Password visibility behavior
   - Disabled and pending behavior
4. Use `FormField` for label, description, required marker, and error association.
5. Ensure every field has a stable ID.
6. Ensure error text is connected with `aria-describedby`.
7. Ensure invalid state sets `aria-invalid`.
8. Avoid wrapping a canonical control in another element that duplicates its border or background.
9. Remove `celestial-input` only after zero consumers remain.

#### Residue commands

```powershell
rg -n 'celestial-input' frontend/src -g '*.tsx' -g '*.css'
rg -n '<input|<select|<textarea' frontend/src/pages -g '*.tsx'
```

Raw controls are not automatically violations. Classify native controls that are intentionally hidden, file inputs, range inputs, or accessibility mechanics before changing them.

#### Closure gate

- Declared forms use canonical controls.
- Field accessibility associations are tested.
- Legacy field recipes have zero unexplained page consumers.

### 6.6 Finish canonical dialogs

**Beads:** `Equoria-o5hub.13`

#### Current state

`GameDialog` exists and selected confirmation dialogs were migrated. `BaseModal` and many page-local overlays remain.

#### Known `BaseModal` consumers

- Competition results
- Competition detail
- Conformation entry
- Prize notification
- Breeding confirmation
- Leaderboard horse detail
- Live trait detail

Use a fresh `rg` inventory because names and counts may change.

#### Known hand-built overlay categories

- Marketplace purchase/listing flows
- Horse Detail sale and rider selection
- Settings delete account
- Community compose/governance flows
- Groom, rider, and trainer assignment flows
- Training confirmation/result/session flows

#### Steps

1. Confirm `GameDialog` supports each required size and footer layout.
2. Add any genuinely missing capability to `GameDialog` first.
3. Migrate simple confirmation dialogs.
4. Migrate forms.
5. Migrate multi-step dialogs.
6. Replace `window.confirm()` with an application dialog.
7. Preserve:
   - Focus trap
   - Escape behavior
   - Focus restoration
   - Scroll locking
   - Pending-state close prevention
   - Backdrop-click policy
8. Confirm there is one overlay and one blur owner.
9. Delete `BaseModal` only after its consumer count is zero.

#### Residue commands

```powershell
rg -n 'BaseModal' frontend/src/pages frontend/src/components -g '*.tsx'
rg -n 'fixed inset-0' frontend/src/pages frontend/src/components -g '*.tsx'
rg -n 'window\.confirm' frontend/src/pages frontend/src/components -g '*.tsx'
```

Some fixed full-screen elements are not dialogs, such as celebration layers, navigation backdrops, and full-screen loading. Review them rather than replacing them mechanically.

#### Closure gate

- No production `BaseModal` consumers remain.
- No browser confirmation dialogs remain.
- Page-local dialog overlays are removed or explicitly excepted.
- Dialog behavior tests pass.

### 6.7 Implement typography roles and `IconBox`

**Beads:** `Equoria-o5hub.8`

#### Objective

Complete the missing shared visual language for headings, labels, captions, numeric values, and icon containers.

#### Steps

1. Define role classes or components for:
   - Wordmark
   - Page title
   - Entity title
   - Section heading
   - Card title
   - Body
   - Label
   - Caption
   - Numeric/stat value
2. Map each role to existing tokens.
3. Create `IconBox` variants:
   - Neutral
   - Accent
   - Success
   - Warning
   - Danger
   - Info
4. Define a small size set.
5. Require decorative icons to be hidden from assistive technology.
6. Require meaningful icon-only controls to use `IconButton`, not `IconBox`.
7. Migrate shared headers, async states, and common cards first.
8. Remove page-local font-family declarations during each family migration.

#### Common mistake

Do not use `IconBox` as a universal decorative wrapper. Plain icons should remain plain when a container adds no semantic or visual value.

#### Closure gate

- `IconBox` exists and is documented.
- Shared headers and state primitives use approved typography roles.
- Page-family migrations no longer invent local icon-circle recipes.

### 6.8 Implement motion policy

**Beads:** `Equoria-o5hub.9`

#### Steps

1. Inventory all transitions and animations.
2. Classify them:
   - Essential state communication
   - Interaction feedback
   - Decorative ambient motion
   - Celebration
3. Ensure reduced-motion mode:
   - Removes lift and parallax
   - Disables looping decorative animation
   - Uses non-motion state changes where possible
   - Does not hide important feedback
4. Remove hover translation from static cards.
5. Resolve `Equoria-o5hub.26`.
6. Preserve celebrations only with a reduced alternative.

#### Closure gate

- Global reduced-motion policy is documented and tested.
- Static content does not move on hover.
- Shared primitives comply automatically.

### 6.9 Coordinate bottom surfaces

**Beads:** `Equoria-o5hub.5`

#### Problem

`BottomNav` and `HorseActionBar` independently occupy the viewport bottom. Fixing opacity does not fix collision, reserved space, safe-area, or virtual-keyboard behavior.

#### Steps

1. Design one contextual action API owned by `DashboardLayout`.
2. Define tokens for:
   - Bottom navigation height
   - Contextual action height
   - Safe-area inset
   - Combined content reservation
3. Render contextual actions above or inside the global bottom system.
4. Remove the Horse Detail component's independent viewport assumptions.
5. Test:
   - Mobile portrait
   - Mobile landscape
   - iOS safe area
   - Android-style viewport
   - Virtual keyboard open
   - Scroll to final page content
   - Dialog open
6. Ensure desktop behavior remains appropriate.

#### Closure gate

- No fixed bottom controls overlap.
- Final content remains reachable.
- Safe-area spacing is correct.
- Horse Detail actions remain usable with BottomNav visible.

## 7. Stage B Page-Family Migration Template

Apply this sequence to every family:

1. Read the corresponding inventory document.
2. Re-run searches because the inventory may be stale.
3. List all routes and component dependencies.
4. Capture before screenshots.
5. Select the correct `PageContainer` variant.
6. Select the correct header family.
7. Remove duplicate outer width and padding.
8. Replace local surfaces with `Surface` semantics.
9. Replace local tabs, forms, dialogs, currency, and async states.
10. Replace direct palette colors with semantic roles.
11. Replace unsupported radii.
12. Remove nested blur.
13. Verify action hierarchy.
14. Verify keyboard and screen-reader behavior.
15. Capture after screenshots.
16. Run family tests.
17. Run residue scans limited to that family.
18. Update the inventory/completion record.
19. Update Beads notes with before/after counts.
20. Close only when the full family gate passes.

## 8. World Services

**Beads:** `Equoria-o5hub.17`

**Routes/pages:**

- Veterinarian
- Farrier
- Feed Shop
- Tack Shop
- Grooms
- Riders
- Trainers
- Crafting

### Required corrections

1. Use `PageHero` only where the page is genuinely a location with real artwork.
2. Move operational pages or management subviews to `PageHeader`.
3. Standardize service-page widths.
4. Remove secondary page-local `max-w-*` and outer `px-*`.
5. Replace blurred inner cards with `Surface subtle`.
6. Migrate Grooms/Riders/Trainers tabs.
7. Standardize horse selection.
8. Standardize service/item cards.
9. Standardize booking and purchase dialogs.
10. Use canonical currency.
11. Use shared loading, empty, and error states.
12. Remove hover lift from non-interactive staff cards.

### Verification

- Move through all locations at desktop and mobile widths.
- Compare header height, content start position, card radius, and action placement.
- Test empty staff rosters and populated rosters.
- Test booking/purchase pending and error states.

### Closure gate

- Equivalent service actions look and behave alike.
- Manual tab rows are removed.
- No unexplained local blur or outer width wrappers remain.

## 9. Marketplace and Economy

**Beads:** `Equoria-o5hub.18`

**Routes/pages:**

- Marketplace Hub
- Marketplace
- Horse Marketplace
- Horse Trader
- Bank
- Inventory
- Prize History

### Required corrections

1. Replace operational `PageHero` usage with `PageHeader`.
2. Standardize listing and item card structure.
3. Standardize search/filter toolbars.
4. Migrate manual tabs.
5. Replace browser confirmation dialogs.
6. Replace page-local overlays.
7. Use canonical `Currency` everywhere.
8. Remove USD formatting for game currency.
9. Consolidate or delete `CurrencyDisplay` and duplicate currency helpers.
10. Standardize balance, signed transaction, compact, and price displays.
11. Standardize pagination.
12. Flatten nested panels.
13. Migrate no-results, empty-history, loading, and error states.

### Specific correctness check

`CompetitionResultsPage` currently formats prize money as USD. Game currency should be rendered as coins according to the approved decision.

### Closure gate

- One currency component and formatting path remains.
- No game-currency values use `$` or USD formatting.
- All purchase/listing confirmations use `GameDialog`.
- Marketplace filters and tabs use canonical controls.

## 10. Community and Messaging

**Beads:** `Equoria-o5hub.19`

**Routes/pages:**

- Community
- Clubs
- Message Board
- Message Thread
- Messages

### Required corrections

1. Replace operational `PageHero` use.
2. Migrate all manual tab rows.
3. Standardize unread count semantics and colors.
4. Standardize list rows and selected states.
5. Migrate compose forms to canonical controls.
6. Migrate compose and governance dialogs.
7. Replace local palette colors with semantic roles.
8. Standardize empty, loading, and error states.
9. Verify long usernames, club names, thread titles, and message bodies.

### Closure gate

- All genuine tabs use canonical tabs.
- Compose/governance overlays use `GameDialog`.
- Unread indicators use one semantic role.
- Long content wraps without clipping or overlap.

## 11. Stable, Dashboard, and Entity Detail

**Beads:** `Equoria-o5hub.20`

**Routes/pages:**

- Dashboard
- Stable View
- Stable Profile (`/my-stable`)
- Horse Detail
- Horse Equipment
- Foal Detail

### Required corrections

1. Apply the approved naming:
   - `/stable` -> "Stable"
   - `/my-stable` -> "Stable Profile"
2. Update:
   - Navigation
   - Breadcrumbs
   - Page titles
   - Headings
   - Tests
3. Migrate containers.
4. Use `PageHeader` or `EntityHeader` according to page semantics.
5. Migrate Horse Detail tabs.
6. Standardize entity metadata and stat layouts.
7. Fix `StatCard` keyboard accessibility under `Equoria-o5hub.24`.
8. Fix Horse Selection semantics under `Equoria-o5hub.25` where applicable.
9. Integrate contextual bottom actions through the layout API.
10. Migrate List for Sale and Rider Picker dialogs.
11. Standardize missing, loading, and error states.
12. Flatten nested panels.

### Closure gate

- Stable navigation is unambiguous.
- Entity titles wrap correctly.
- Horse actions do not overlap mobile navigation.
- All entity tabs and dialogs use canonical primitives.
- Interactive cards are keyboard accessible.

## 12. Training, Breeding, and Competition

**Beads:** `Equoria-o5hub.21`

**Routes/pages:**

- Training
- Breeding
- Competition Browser
- Competition Results
- Conformation entry/redirect surfaces

### Required corrections

1. Replace operational heroes.
2. Standardize workflow headers and action placement.
3. Migrate manual tabs.
4. Standardize horse/discipline selection controls.
5. Migrate all competition and breeding dialogs.
6. Replace local loaders, empty states, and errors.
7. Replace direct status colors.
8. Use canonical currency for prizes and fees.
9. Remove duplicate local formatters.
10. Verify long competition and discipline names.
11. Preserve workflow state and API behavior.

### Closure gate

- Complete workflows pass, not just isolated component tests.
- Confirmation, pending, success, and error states are canonical.
- No legacy competition `BaseModal` consumers remain.
- Prize values use coins.

## 13. Settings and Profile

**Beads:** `Equoria-o5hub.22`

**Routes/pages:**

- Settings
- Profile

### Required corrections

1. Confirm the correct container width for each page.
2. Replace remaining custom controls with canonical form controls.
3. Standardize section headings and dividers.
4. Migrate switches, checkboxes, and sound controls.
5. Migrate Delete Account to `GameDialog`.
6. Use destructive button treatment for destructive actions.
7. Ensure delete confirmation cannot accidentally use the primary gold style.
8. Align Profile editing with Settings validation and action placement.
9. Flatten unnecessary panel-inside-panel structures.
10. Verify long validation messages and account names.

### Closure gate

- Account forms share one field and validation architecture.
- Destructive actions are semantically and visually destructive.
- Delete Account has correct focus and pending-close behavior.

## 14. Cross-Cutting Surface and Color Migration

This work occurs inside every page-family migration.

### 14.1 Surfaces

Use:

- `page` for unframed structure
- `panel` for a top-level framed tool
- `subtle` for nested secondary content
- `interactive` for clickable repeated items
- `overlay` for dialogs/popovers

Do not:

- Put a card inside a card without a clear semantic reason.
- Add blur to nested content.
- Add hover lift to static content.
- Use `Surface interactive` on a non-interactive `div`.

### 14.2 Colors

Replace direct palette choices with semantic roles:

- Success
- Warning
- Danger
- Info
- Accent
- Neutral

Charts and data visualizations may require explicit colors. Put those in the exception registry with an owner and rationale.

### 14.3 Radius

Use the approved semantic scale. Do not mechanically replace every `rounded-full`; circles, avatars, status dots, toggles, and true pills may legitimately remain full.

### 14.4 Action hierarchy

Each workflow surface should normally have one visually primary action.

Examples:

- Save is primary; Cancel is secondary.
- Confirm purchase is primary; Back is secondary.
- Delete is destructive, never gold primary.

## 15. Async-State Adoption

The shared primitives exist, but adoption remains limited.

Known local implementations include:

- `ActivityFeed`
- Competition history/results/list components
- Horse selector
- Prize transaction history
- Leaderboard table
- Horse detail sub-tabs

### Steps

1. Decide whether the state is page-level or section-level.
2. Use `PageLoading` only for true page loading.
3. Use `SectionLoading` or skeletons for contained data.
4. Use shared `ErrorState` with a real retry action where retry is possible.
5. Use shared `EmptyState` with context-specific copy and a correctly tiered action.
6. Delete local state components after migration.
7. Preserve domain-specific content through props rather than forking the visual component.

### Closure gate

- Local state components have zero unexplained consumers.
- Loading states respect reduced motion.
- Errors provide correct recovery.
- Empty states do not masquerade as errors.

## 16. Enforcement and Legacy Removal

**Beads:** `Equoria-o5hub.23`

Do not wait until every migration is complete to start a baseline script. Add a ratchet early, then reduce it.

### 16.1 Add a source-audit script

Create a script that reports:

- Direct page palette classes
- Text opacity classes
- Unsupported radius utilities
- Page-local blur
- Unsupported outer widths
- Duplicate page-level horizontal padding
- Raw command buttons
- Page-local full-screen dialog overlays
- `window.confirm`
- Deprecated primitive imports
- Unapproved `PageHero` consumers

The script must produce:

- File
- Line
- Rule ID
- Match
- Whether an exception applies

### 16.2 Add an exception registry

Create `docs/design-system/EXCEPTIONS.md` with:

- Rule ID
- File or glob
- Owner
- Justification
- Expiry date
- Replacement plan

CI must reject expired exceptions.

### 16.3 Use a ratchet

During migration:

- Current known count is the temporary ceiling.
- No change may increase the count.
- Each family migration lowers the ceiling.
- Final completion requires zero or explicit exceptions.

### 16.4 Restrict `PageHero`

Create an allowlist of approved image-backed location routes. Operational pages should fail enforcement if they import `PageHero`.

### 16.5 Remove deprecated systems

Delete only after zero consumers:

- `BaseModal`
- `CelestialTabs`
- `GoldTabs` adapters if no longer needed
- `CurrencyDisplay`
- Duplicate currency formatters
- `celestial-input`
- Obsolete glass aliases
- Page-local state components

### 16.6 CI integration

Add fast checks to normal frontend CI:

1. Typecheck
2. Lint
3. Design-system source audit
4. Focused primitive tests
5. Relevant sentinel tests

Keep slower visual and E2E checks in their appropriate workflow while ensuring they run on relevant changes.

### Closure gate

- Violations fail locally and in CI.
- Exceptions are explicit and unexpired.
- Deprecated components have zero production consumers.
- The audit count is zero except approved exceptions.

## 17. Required Verification Commands

Use repository scripts where available. Confirm exact names in `frontend/package.json`.

Minimum focused verification:

```powershell
npm --prefix frontend run test:run -- --run <changed-test-files>
npm --prefix frontend run build
```

For a page family, also run:

- Existing page tests
- Existing component tests touched by the migration
- Relevant Playwright workflow tests
- Accessibility tests
- Screenshot tests or baseline capture

Run residue searches after tests. Passing tests before residue checks is not completion.

## 18. Global Definition of Done

The epic is complete only when every statement below is true.

1. Every routed authenticated page uses an approved page container or documented exception.
2. Every routed page uses the correct header family.
3. `PageHero` is limited to approved location pages.
4. Long titles wrap without clipping or overlap.
5. Page-level duplicate gutters and arbitrary widths are removed.
6. Surface hierarchy is used consistently.
7. Static surfaces do not lift or glow.
8. The single-blur rule is enforced.
9. All genuine tabs use the canonical API.
10. All application forms use canonical controls where appropriate.
11. All dialogs use `GameDialog` or a documented non-dialog exception.
12. `BaseModal` has zero production consumers.
13. Browser confirmation dialogs are gone.
14. Currency uses one component and one terminology.
15. Game currency is never formatted as USD.
16. Shared async states replace local visual copies.
17. Stable and Stable Profile naming is unambiguous.
18. Bottom navigation and contextual actions never overlap.
19. Reduced-motion behavior is verified.
20. Direct palette, radius, blur, width, and raw-button violations are zero or explicitly excepted.
21. Visual regression coverage represents every page family.
22. Accessibility checks cover representative workflows.
23. Inventories and architecture documentation match the implemented state.
24. Frontend tests and production build pass.
25. `Equoria-o5hub` has no open required child issues.

## 19. Recommended Prompt for the Implementing Agent

Use this prompt with the file attached or referenced:

```text
Act as the senior frontend implementation owner for Equoria-o5hub.

Read:
- docs/frontend-design-consistency-remaining-work-handoff.md
- docs/frontend-design-consistency-remediation-plan.md
- docs/design-system/DECISIONS.md
- AGENTS.md

Run bd prime and bd show Equoria-o5hub before editing.
Operate with --ask-for-approval never. Do not pause to request command approval;
work within available permissions and report only genuine environmental blockers.

Your job is to execute the remaining remediation, not to produce another audit.
Work one Beads issue or explicitly documented slice at a time. Claim the issue,
inventory every consumer before editing, implement the full declared slice,
run focused tests and the production build, capture/review required screenshots,
run residue scans, update the Beads notes with before/after counts, and keep the
issue open if any declared consumer remains.

Do not stop merely because a primitive was created or a pilot page is green.
Do not create competing primitives. Extend the canonical primitive only when a
real consumer proves a missing capability. Preserve business behavior and do
not weaken tests.

At the end of each slice, report:
1. Beads issue and scope completed.
2. Files migrated.
3. Tests/build/screenshots run.
4. Residue before and after.
5. Remaining consumers.
6. Whether the issue stays open or can close, with evidence.

The epic may close only when the Global Definition of Done in the handoff is
fully satisfied.
```

## 20. First Recommended Assignment

Start with a bounded prerequisite rather than a large page family:

1. Claim `Equoria-o5hub.1` and capture the baseline route screenshots.
2. Fix canonical header wrapping and pending button semantics.
3. Resume `Equoria-o5hub.11`, `Equoria-o5hub.12`, and `Equoria-o5hub.13` from their documented remaining consumer lists.
4. Implement `Equoria-o5hub.5`, `Equoria-o5hub.8`, and `Equoria-o5hub.9`.
5. Then begin page-family migrations in the order in Section 5.

This order reduces the chance of migrating dozens of pages onto primitives that still need behavioral corrections.
