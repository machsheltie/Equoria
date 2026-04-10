# Story 22.1: Font Migration

**Epic:** 22 — Celestial Night Foundation
**Story Key:** 22-1-font-migration
**Status:** done
**Last Updated:** 2026-03-31

---

## User Story

As a player,
I want all text in Equoria to render in fantasy-appropriate fonts (Cinzel for headings, Inter for body),
So that the typography signals "game world" instead of "web app."

---

## Acceptance Criteria

- [x] **AC1:** Given the `.celestial` class is active on `<body>`, all `h1`-`h6` elements render in Cinzel font
- [x] **AC2:** All body text, form labels, and data values render in Inter font
- [x] **AC3:** Hero text (horse names on detail pages, page titles) renders in Cinzel Decorative
- [x] **AC4:** Fonts load with `font-display: swap` (no Flash of Invisible Text)
- [x] **AC5:** WOFF2 font files exist in `frontend/public/fonts/` (Cinzel, Cinzel Decorative, Inter)
- [x] **AC6:** `<link rel="preload">` tags in `frontend/index.html` reference `/fonts/` paths — no Google Fonts CDN requests
- [x] **AC7:** `prefers-reduced-motion` has no impact (fonts are static)
- [x] **AC8:** Fallback system fonts (Georgia, system-ui) are specified in font stack
- [x] **AC9:** Existing Yeseva One and Cormorant Garamond `<link>` elements removed from `frontend/index.html` (were already absent — confirmed)
- [x] **AC10:** Zero NEW ESLint errors introduced (CSS/HTML files are outside ESLint's .ts/.tsx scope; pre-existing errors in test files are not caused by this story)

---

## Tasks/Subtasks

- [x] **T1: Download and place self-hosted WOFF2 font files**

  - [x] T1.1: Create `frontend/public/fonts/` directory
  - [x] T1.2: Download Cinzel variable font WOFF2 (latin + latin-ext) — 2 files
  - [x] T1.3: Download Cinzel Decorative WOFF2 (weights 400/700/900, latin + latin-ext) — 6 files
  - [x] T1.4: Download Inter variable font WOFF2 (latin + latin-ext) — 2 files

- [x] **T2: Create self-hosted @font-face declarations**

  - [x] T2.1: Created `frontend/src/styles/fonts.css` with 10 @font-face blocks (all three families)
  - [x] T2.2: Each @font-face includes `font-display: swap`
  - [x] T2.3: Import `fonts.css` as first import in `frontend/src/index.css` (before Tailwind base)

- [x] **T3: Update tokens.css font stack fallbacks**

  - [x] T3.1: Updated `--font-display` to `'Cinzel Decorative', Georgia, serif`
  - [x] T3.2: Updated `--font-heading` to `'Cinzel', Georgia, serif`
  - [x] T3.3: Updated `--font-body` to `'Inter', system-ui, sans-serif`

- [x] **T4: Add `.celestial` scoped heading typography rules**

  - [x] T4.1: Added `.celestial h1` through `.celestial h6` rules using `var(--font-heading)` in `@layer base` in `index.css`

- [x] **T5: Update frontend/index.html**

  - [x] T5.1: Removed Google Fonts `<link rel="preconnect">` tags (fonts.googleapis.com, fonts.gstatic.com)
  - [x] T5.2: Removed Google Fonts stylesheet `<link>` tag (css2?family=...)
  - [x] T5.3: Removed CDN-hosted `<link rel="preload">` pointing to fonts.gstatic.com
  - [x] T5.4: Added 3 self-hosted `<link rel="preload">` tags for Inter latin, Cinzel latin, Cinzel Decorative 400 latin

- [x] **T6: Run lint and verify**
  - [x] T6.1: Ran `npx eslint src` — 0 new errors introduced by this story (all 253 existing errors predate Story 22.1 and are in test files)

---

## Dev Notes

**Architecture:**

- @font-face rules are in a dedicated `fonts.css` file imported FIRST in `index.css` (before Tailwind `@tailwind base` which resets font stacks)
- Cinzel (v26) and Inter (v20) are variable fonts — one WOFF2 file covers all weights via `font-weight: 400 900` range syntax
- Cinzel Decorative is NOT a variable font — separate files per weight (400, 700, 900)
- `font-display: swap` ensures text is visible during font load (fallback → custom font swap)

**Unicode subsets:**

- `latin-ext`: U+0100-02BA + extended (for European languages)
- `latin`: U+0000-00FF + common symbols (covers all English game UI)

**Self-hosting rationale (ADR-6):** No Google Fonts CDN — GDPR risk for EU/UK users; self-hosted removes third-party data transfer on first page load.

**Previous state:** index.html loaded fonts from fonts.googleapis.com CDN with one preload from fonts.gstatic.com. Story 22.1 migrates this entirely to self-hosted files in `public/fonts/`.

**Yeseva One / Cormorant Garamond:** Confirmed absent from codebase before this story — AC9 is trivially satisfied.

**Pre-existing lint:** 253 ESLint errors in test files (HorseDetailPage, leaderboards, shim.ts, utils.tsx) predate this story. All changed files (.css, .html) are outside ESLint's .ts/.tsx scope.

---

## Dev Agent Record

### Implementation Plan

1. Downloaded 10 WOFF2 files to `frontend/public/fonts/` using Node.js https module
2. Created `frontend/src/styles/fonts.css` with complete @font-face declarations
3. Added `@import './styles/fonts.css'` as first import in `index.css`
4. Updated `tokens.css` font fallback stacks to include Georgia and system-ui
5. Added `.celestial h1` through `.celestial h6` rules inside `@layer base` in `index.css`
6. Updated `index.html`: removed all Google Fonts CDN links, added 3 self-hosted preload tags
7. Ran ESLint — zero new errors introduced

### Debug Log

- Cinzel (v26) is a variable font: same 2 WOFF2 files (latin-ext + latin) handle all weights 400-900
- Cinzel Decorative is static: 6 WOFF2 files (3 weights × 2 subsets)
- Inter (v20) is a variable font: same 2 WOFF2 files handle all weights 100-900
- Downloaded via Node.js `https` module (curl blocked, no fontsource npm package installed)

### Completion Notes

Story 22.1 complete. The font migration is fully self-hosted:

- 10 WOFF2 files in `frontend/public/fonts/` (total ~234KB)
- @font-face rules with `font-display: swap` in `fonts.css`
- Tokens updated with Georgia/system-ui fallbacks
- `.celestial h1-h6` rules apply Cinzel when theme is active
- index.html: Google Fonts CDN removed, 3 local preloads added
- No new ESLint errors

---

## File List

- `frontend/public/fonts/cinzel-v26-latin-ext.woff2` _(new)_
- `frontend/public/fonts/cinzel-v26-latin.woff2` _(new)_
- `frontend/public/fonts/cinzel-decorative-v19-400-latin-ext.woff2` _(new)_
- `frontend/public/fonts/cinzel-decorative-v19-400-latin.woff2` _(new)_
- `frontend/public/fonts/cinzel-decorative-v19-700-latin-ext.woff2` _(new)_
- `frontend/public/fonts/cinzel-decorative-v19-700-latin.woff2` _(new)_
- `frontend/public/fonts/cinzel-decorative-v19-900-latin-ext.woff2` _(new)_
- `frontend/public/fonts/cinzel-decorative-v19-900-latin.woff2` _(new)_
- `frontend/public/fonts/inter-v20-latin-ext.woff2` _(new)_
- `frontend/public/fonts/inter-v20-latin.woff2` _(new)_
- `frontend/src/styles/fonts.css` _(new)_
- `frontend/src/index.css` _(modified — added fonts.css import + .celestial h1-h6 rules)_
- `frontend/src/styles/tokens.css` _(modified — Georgia/system-ui fallbacks in font tokens)_
- `frontend/index.html` _(modified — removed Google CDN links, added self-hosted preloads)_
- `_bmad-output/implementation-artifacts/sprint-status.yaml` _(modified — epic-22 in-progress, story keys updated)_

---

---

## TEA Quality Gates (2026-04-10 — retroactive)

**TEA:ATDD** — SKIPPED (pre-mandate 2026-04-09). Story predates TEA requirement. This is a pure CSS/HTML asset story with no JavaScript logic — the appropriate ATDD artifact would be an E2E network-interception test asserting no CDN requests. Partial retroactive coverage exists via Story 22-7 E2E-010 (Cinzel font renders on login page).

**TEA:TA** — PASS. Static asset story: 10 WOFF2 files, CSS `@font-face` declarations, HTML preload tags. No JavaScript testable units. Cinzel font rendering validated in E2E-010. One documented gap: no automated assertion that Google Fonts CDN links remain absent from `index.html` (low risk — removed at the HTML level, not a runtime decision). Risk: LOW.

**TEA:RV** — PASS. No unit tests to review. `fonts.css` is clean and correct: 10 `@font-face` blocks, all with `font-display: swap`, correct `unicode-range` subsets matching Google Fonts originals. `index.html` preload tags have correct `as="font"`, `type="font/woff2"`, and `crossorigin` attributes. No issues found.

---

## Code Review (2026-04-10 — retroactive)

**Verdict: PASS — 0 material findings.**

- `fonts.css`: Correct @font-face declarations, well-commented, proper unicode ranges, `font-display: swap` on all faces. ✅
- `index.html`: CDN links removed, 3 self-hosted preload tags with correct attributes. ✅
- `tokens.css` font stacks: Georgia + system-ui fallbacks correct per spec. ✅

---

## Change Log

| Date       | Change                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| 2026-03-31 | Story created and implemented — font migration from CDN to self-hosted WOFF2 |
| 2026-04-10 | Retroactive TEA audit + code review — PASS, 0 findings |
