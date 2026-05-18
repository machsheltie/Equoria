# ADR-008: CSP `style-src 'unsafe-inline'` — Accepted Risk (Radix Runtime Style Injection)

**Status:** Accepted (accepted-risk; re-evaluation trigger defined below)
**Date:** 2026-05-18
**Deciders:** Backend / Security
**Epic:** 21R — Beta Deployment Readiness
**Implementation:** `backend/middleware/security.mjs` (`helmetConfig.contentSecurityPolicy.directives.styleSrc`)
**Tracking:** bd `Equoria-e3k9`

---

## Context

`backend/middleware/security.mjs` is the authoritative Helmet/CSP config. The
`script-src` directive is already tight (`'self'` only — no `'unsafe-inline'`,
no `'unsafe-eval'`), `object-src`/`frame-src`/`frame-ancestors` are `'none'`,
and `img-src` has had its `https:` wildcard removed. The one remaining CSP
weakness flagged by the security audit is:

```js
styleSrc: ["'self'", "'unsafe-inline'"],
```

`'unsafe-inline'` on `style-src` weakens CSP's defense against a class of XSS
where an attacker injects a `<style>` element or a `style="..."` attribute
(CSS-based data exfiltration, UI redressing via injected styles). It does **not**
weaken script execution defense — `script-src` has no `'unsafe-inline'`, so
the primary (script-execution) XSS path remains blocked.

### Why `'unsafe-inline'` is currently required (concrete framework constraint)

The frontend is a Vite-built React SPA using **Radix UI primitives** (Dialog,
Tooltip, Tabs, etc.) + **Tailwind CSS**, served as a **static** `index.html`
by `express.static` in production (Epic 14 deployment model).

Verified runtime constraint (codebase audit, 2026-05-18):

- Radix Dialog/Dropdown pull in `react-remove-scroll` →
  `react-style-singleton`. That module does
  `document.createElement('style')` then `head.appendChild(tag)` with
  `appendChild(document.createTextNode(css))` at runtime, in the browser,
  **after** page load
  (`frontend/node_modules/react-style-singleton/dist/es2015/singleton.js:5,20,25`).
- These injected `<style>` elements are created by client JS post-load. They
  do **not** carry any CSP nonce, because:
  1. `react-style-singleton` only supports a nonce via a global
     `setNonce()` side-channel that is not wired in this codebase, and
  2. even if wired, the nonce would have to be unique-per-response and
     embedded in the static `index.html` at request time — but the SPA is
     served as a static file by `express.static`, which performs no
     per-request HTML templating. A nonce strategy would require replacing
     static SPA serving with a per-request HTML-rewriting middleware AND
     threading that nonce through Radix's transitive style-injection chain.

So a nonce/hash migration is not a localized config change: it requires
(a) abandoning static SPA serving for dynamic per-request nonce injection,
and (b) upstream nonce-threading support across the Radix →
`react-remove-scroll` → `react-style-singleton` chain that does not exist in
the pinned versions. Attempting partial removal of `'unsafe-inline'` would
break Radix-based modals/tooltips/scroll-lock at runtime (styles silently
blocked by CSP), degrading real beta-facing UI — which the 21R doctrine
explicitly forbids ("no beta feature downgraded to broken").

## Decision

**Accept the risk.** Retain `style-src 'self' 'unsafe-inline'` for now. Do
**not** weaken any other directive to compensate, and do **not** ship a
half-nonce that breaks Radix runtime styles.

Rationale:

- `script-src` remains `'self'`-only — the high-severity XSS path
  (arbitrary script execution) is still blocked. `style-src 'unsafe-inline'`
  is a materially lower-severity residual (style-injection / CSS exfiltration),
  not script execution.
- The alternative (dynamic nonce SPA serving + upstream Radix nonce
  threading) is a large architectural change with real regression risk to
  beta-live UI, disproportionate to the residual risk it removes.
- Defense-in-depth headers already mitigate adjacent vectors:
  `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`,
  `X-Frame-Options: DENY`, tight `default-src`/`connect-src`/`object-src`.

### Alternative considered (and why deferred)

**Nonce-based `style-src` with a per-request HTML-templating middleware +
`setNonce()` propagation into `react-style-singleton`.** Rejected for now:
breaks the static-SPA serving model (Epic 14), requires upstream nonce
threading that the pinned Radix/scroll-lock chain does not support, and risks
silently breaking beta-live modals/tooltips. If pursued, it is its own
implementation story, not a CSP-config tweak. Tracked as a follow-up
(see "Re-evaluation trigger").

## Re-evaluation Trigger

Reopen this decision and migrate off `'unsafe-inline'` when **any** of:

1. The Radix / `react-remove-scroll` / `react-style-singleton` dependency
   chain ships first-class CSP-nonce support that works without a global
   side-channel, **and** the SPA serving model can inject a per-request
   nonce; or
2. The SPA serving model changes from static `express.static` to an
   SSR/per-request-templated delivery (nonce injection becomes free); or
3. A security review escalates style-injection XSS to a blocking severity
   for this product (e.g. a feature renders user-controlled HTML/CSS); or
4. CSP Level 3 `'unsafe-hashes'` + a build step that enumerates the finite
   set of Radix-injected style payloads becomes viable (pin-version
   dependent).

Until a trigger fires, this is an accepted, documented residual — not an
untracked gap.

## Consequences

- `SECURITY_ASSESSMENT_REPORT.md` A05 notes this as an accepted, tracked
  residual (not a silent omission, not a false-green "compliant").
- `backend/middleware/security.mjs` comment references this ADR by number so
  the constraint is discoverable from the code.
- A sentinel test asserts the documented CSP shape so an accidental
  _broadening_ (e.g. adding `'unsafe-inline'` to `script-src`, or a `https:`
  wildcard creeping back into `style-src`) fails CI, and so the
  accepted-risk decision can't silently rot into something worse.
