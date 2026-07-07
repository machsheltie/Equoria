# Frontend Async-State Doctrine — loading / error / empty / retry

**Status:** ADOPTED (agent-authored 2026-07-07; user-ratified 2026-07-07 — the binding standard for the honest-state fix campaign and all new frontend data-rendering work)
**Trigger:** ~15 individually-filed swallowed-error / fabricated-data bd issues (parents: Equoria-wj4rt, Equoria-oey96) were about to be fixed as 15 improvisations. This file is the single pattern they are all implemented against.
**Scope:** `frontend/src` production code. Extends `.claude/rules/PATTERN_LIBRARY.md` (React Query patterns) and `docs/design-system/DECISIONS.md` + remediation plan D-15/D-16/D-17 (component program). It contradicts neither; where those docs name the components, this file names the *behavioral contract* for using them.
**Compliance snapshot:** `docs/audits/2026-07-07-frontend-four-state-compliance.md` (point-in-time; do not treat as current after fixes land).

---

## 1. The four canonical states

Every surface that renders fetched data has exactly four states, rendered in this priority order:

1. **LOADING** — the fetch has not resolved. Render a skeleton/spinner. Never render the empty state, a `'…'`, a `0`, or stale-looking defaults while pending.
2. **ERROR** — the fetch failed. Render a visible error with a retry affordance. Never fall through to the empty state.
3. **EMPTY** — the fetch **succeeded** and the collection is genuinely empty. Render an honest empty state that explains why and offers the action that resolves it (if one exists).
4. **SUCCESS** — real data, rendered.

The single most common defect class in this codebase is collapsing ERROR into EMPTY (`data?.items.length ?? 0 === 0` renders "No transactions yet" on a failed fetch). The branch order above is the fix: **empty is only reachable through `isSuccess`.**

### Exactly one component per state

| State | Page-level | Section/card-level | Inline/field |
| --- | --- | --- | --- |
| Loading | `PageLoading` (`ui/state`) | `SectionLoading`, or `Skeleton.*` / `SkeletonCard` family when geometry should match content (D-15) | Button `pending` prop |
| Error | `ErrorState severity="page"` (wraps `ErrorCard`) | `ErrorState` (default `severity="section"`) | `InlineError` |
| Empty | — | `EmptyState` (D-17 semantic variants: `first-use` / `no-results` / `filtered` / `unavailable` / `completed`) | — |
| Mutation feedback | sonner `toast` (already mounted in `App.tsx`) or `InlineError` next to the control | Button `pending` while in flight | — |

Do not hand-roll new `animate-pulse` blocks, red panels, plain-text `Loading…`, or bespoke empty markup. The ~20 existing hand-rolled pulse skeletons are legacy to migrate (tracked), not precedent to copy.

### Canonical query rendering skeleton

```tsx
const { data, isPending, isError, error, refetch } = useSomething(id);

if (isPending) return <SectionLoading label="Loading transactions" />;
if (isError) return <ErrorState message={userMessageFor(error)} retry={{ label: 'Try Again', onClick: () => refetch() }} />;
if (data.items.length === 0) return <EmptyState variant="first-use" title="No transactions yet" />;
return <TransactionList items={data.items} />;
```

Rules embedded in that skeleton:

- **Destructure `isError` and `refetch` on every query you render.** A query whose error state is unrepresentable in the JSX is a doctrine violation, whatever the hook does.
- **Retry is `refetch()` wired to the `ErrorState`/`ErrorCard` retry action** — not a page reload, not a dead button. If `refetch` is destructured, it must be wired (Equoria-4hra5 found it destructured and dropped).
- **Never gate the empty branch on `!isLoading` alone** — that makes error render as empty. Gate on success (`isSuccess`, or the post-`isPending`/post-`isError` fallthrough as above).
- **Multi-query pages** apply the contract per section: one query's failure must not blank or falsify the others' sections. Page-level `PageLoading`/`ErrorState severity="page"` is only for pages whose entire content hangs on one query.

## 2. Data-fetching standard

- **React Query is the fetching layer** (PATTERN_LIBRARY cache-strategy table still governs `staleTime`/`gcTime`). New imperative `fetch`/`apiClient` calls in components are exceptional; when one exists (modals doing one-shot lookups), the same four-state contract applies via local state — a `catch` that sets `[]`/`null` and renders the empty branch is the same lie in imperative form.
- **Hooks do not swallow.** A query hook must let the error propagate to the consumer (React Query does this by default — do not `catch` inside `queryFn` and return a fabricated shape). A mutation hook may keep an `onError` for cache rollback, but user-visible feedback is still mandatory somewhere: either the hook raises a toast, or the call site does. One of the two, verifiably, per mutation.
- **Mutations:**
  - Every mutation has user-visible failure feedback (toast or `InlineError`). `onSuccess`-only hooks with no error handling at any layer are forbidden (Equoria-pqor7 class).
  - Do not reset/clear form state until `onSuccess`. Clearing in the submit handler before the promise resolves destroys the user's input on failure.
  - Buttons driving mutations use the shared Button `pending` prop (keeps accessible label; no bare spinners — Equoria-4yocc).
  - Money-moving mutations invalidate every query that renders the balance (`['profile']` and any page-local money query), not just the domain entity (Equoria-z3yv3 class).
- **Global safety net (to be added, one commit):** configure the shared `QueryClient` with `QueryCache`/`MutationCache` `onError` that reports to Sentry (when enabled) and `console.error`s in dev. This is telemetry, **not** a substitute for local state rendering — a page with no error branch is still broken with the global handler present.
- **Container/presentational split** (PATTERN_LIBRARY): the container owns the four-state branching; presentational components receive real data and may assume SUCCESS. Do not push `isError` handling down into leaf components as optional props.

## 3. Error taxonomy — what the user sees

Never render `error.message` from the server verbatim (backend 500 bodies can leak internals — Equoria-ot1mo). Map by class:

| Class | User-facing copy (pattern) | Retry? | Sentry? |
| --- | --- | --- | --- |
| Network / offline (fetch rejected) | "Can't reach the stable. Check your connection and try again." | Yes | No (noise) |
| 5xx | "Something went wrong on our end. Try again in a moment." | Yes | **Yes** |
| 429 | "Slow down a moment — too many requests. Try again shortly." | Yes (delayed) | No |
| 404 (entity) | Section-level "not found" `ErrorState` with back action, or honest `EmptyState variant="unavailable"` when it's a list member | No | No |
| 403 / ownership | "You don't have access to this." + back action | No | Yes (possible IDOR probe — matches backend audit posture) |
| 401 / session expired | Redirect to login via the existing apiClient session flow; if rendered, "Your session expired — log in again." | No (re-auth) | No |
| 400 / validation (forms) | Field-level `InlineError` from the structured validation payload; generic top `InlineError` if unmapped | No (fix input) | No |
| Render crash (boundary) | `ErrorCard` with Try Again (boundary reset) + Go Home — never a bare `<p>` (Equoria-oey96.57) | Yes | **Yes** (boundary is Sentry's) |

A shared `userMessageFor(error)` helper (on `ApiError` from `lib/http/apiClient.ts`) is the single mapping point — planned in Equoria-8cnzr, to land early in the fix campaign; pages must not each invent copy for the same class.

## 4. Honest values — no fabricated data

- **Loading is not zero.** `'…'`/skeleton only while `isPending`; once settled, render the real value **including a real `0`** (Equoria-buznf).
- **Unknown is not a real value.** An unrecognized/absent field renders `'—'` (or "Unknown"), never a plausible fabrication like defaulting sex to `'Stallion'` (Equoria-b9yi1) or scores to `|| 75` (Equoria-m54lr). `?? '—'` for display; **never `|| <plausible literal>`** — `||` also eats legitimate `0`s.
- **Client-side arithmetic is not server truth.** Prices, fees, and balances shown before a commit come from the backend (or render loading/error until they do) — no hardcoded fee constants in display paths (Equoria-8doyo).
- **Unbuilt features are absent, not simulated.** No permanent-placeholder cards, unconditional badges, or hardcoded `'5'` literals presented as live stats (Equoria-r4cyk / oey96.54/.55/.56). The honest options are: wire real data, remove the surface, or explicit "coming soon" copy — a user decision per Constitution §6, not a silent default.
- **Empty is honest only after success** (§1). "No vet records on file" over a hardcoded `[]` that never queried is a fabricated empty (Equoria-oey96.56).

### Blessed swallow classes (the ONLY legitimate silent catches)

1. **Storage/media environment guards** — `localStorage`/`sessionStorage`/`AudioContext` wrapped for quota/private-browsing; failure degrades a preference, never data.
2. **Optimistic-update rollback `onError` arms** whose call site verifiably surfaces the toast (`useInventory`, `useEquipFeed`, `useUpdatePreferences` pattern).
3. **Image `onError` → placeholder-image swap.**
4. **`apiClient` auth/CSRF internals** — the original error is intentionally collapsed into the surfaced generic 401/403 flow.

Anything else that catches an API/network error and renders a non-error state is a defect. When writing a blessed swallow, comment it with the class name (e.g. `// storage guard — quota/private browsing`) so the enforcement check (§6) can allowlist it explicitly.

## 5. Accessibility of the states themselves

- **Loading regions announce.** Shared primitives already carry `role="status"` + `aria-live="polite"`; bare `Skeleton.*`/`SkeletonBase` pieces are `aria-hidden`, so their **container must supply** `role="status"` + an `aria-label` (StableView is the model). Set `aria-busy="true"` on a region being refreshed in place.
- **Errors announce and take focus.** `ErrorCard`/`InlineError` carry `role="alert"`. For section/page errors, move focus to the error heading on arrival (`tabIndex={-1}` + `ref.focus()`); note `ErrorState`'s JSDoc currently *claims* this and `ErrorCard` doesn't implement it — that gap is a tracked fix, and until it lands the claim is a forward-reference to strip (OPTIMAL_FIX §4).
- **Non-color signaling:** every error/empty state pairs color with an icon + text; never a red border alone.
- **No silent suspense:** `Suspense fallback={null}` around user-visible content is a loading-state FAIL; use a fallback with `role="status"` (decorative/off-screen widgets exempt, with a comment).
- **Reduced motion:** skeleton/spinner animation respects `prefers-reduced-motion` per `docs/design-system/MOTION.md`.

## 6. Enforcement — doctrine ratchet (proposed, not yet built)

House-style shrink-only ratchet, mirroring `check-no-new-silent-cleanup-catch.mjs` / `check-file-size-thresholds.mjs`:

- **`scripts/doctrine-checks/check-frontend-swallowed-catch.mjs`** — scans `frontend/src` production code (comment-stripped, string-safe, same scanner conventions as the rethrow-after-log check) for catch arms that are empty / console-only / fallback-only, MINUS arms carrying a blessed-class comment marker (§4 list). Per-file baseline JSON (`frontend-swallowed-catch-baseline.json`) records current legacy counts; NEW occurrences or growth fail; stale entries fail. Sentinel-positive test proves it fires on a planted violation (OPTIMAL_FIX §2). Runs via the existing `run-all.sh` glob + `doctrine-gate` CI.
- **Complementary ESLint sketch** (follow-up, not the primary gate — `--max-warnings 0` makes a new warn-level rule a flag-day): `no-restricted-syntax` entries for `CatchClause > BlockStatement[body.length=0]` and catch bodies whose only statement is `console.*`, scoped to `frontend/src`, `error` level once the baseline hits zero.
- **Not mechanically enforceable** (stays a review-checklist item, §7): fabricated `|| literal` display fallbacks, empty-gated-on-`!isLoading`, missing `EmptyState` — these need human/agent judgment during `bmad-code-review`.

## 7. Fix-campaign review checklist

Any PR touching a data-rendering surface answers, in the verification log:

- [ ] All four states representable in the JSX (point to the branches).
- [ ] Empty branch reachable only via success.
- [ ] `refetch` wired to the retry affordance.
- [ ] Mutations: user-visible failure feedback + form state preserved on error.
- [ ] No new fabricated fallbacks (`|| literal` on displayed values); unknowns render `'—'`.
- [ ] Loading regions have `role="status"`/`aria-busy`; errors have `role="alert"`.
- [ ] E2E: forced-error renders error+retry (not empty); success-empty renders honest empty; success-data renders rows (per-issue Playwright tests already specify this — real backend, no bypass headers).

## 8. Issue map (which fixes implement which sections)

New-findings umbrella: **Equoria-xi8oz** (2026-07-07 sweep).

- §1 queries/empty/retry: Equoria-4hra5, l22ki, llhf6, mljz9, uo273, ffmha, ye01k, 6p78r, si3m2, gle1m, rbso5, fslmm, oey96.51
- §2 mutations + global net: pqor7, zwcg6, z3yv3, 14wp7
- §3 taxonomy/boundary: 8cnzr (userMessageFor), oey96.57 (backend cross-ref: ot1mo)
- §4 honest values: m54lr, 8doyo, r4cyk (+dup oey96.54), b9yi1, buznf, ky2ob, qqhwh, ffj5j, 7zyn3, 2je95, oey96.55/.56, gejdf (blessed-list DECISION)
- §5 a11y: 4yocc, 3r6n3 (focus), 2fzcy (skeleton migration)
- §6 enforcement: axl7d (ratchet build)

Sequencing: land 8cnzr and axl7d early so sibling fixes consume the helper and shrink the ratchet baseline.
