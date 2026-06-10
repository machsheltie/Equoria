# Equoria Design System — Token Reference

**Generated:** 2026-06-09 (hand-maintained)
**Canonical source:** `frontend/src/styles/tokens.css`
**Authority:** `docs/design-system/DECISIONS.md`

> This document is a hand-maintained reference snapshot.
> `tokens.css` is canonical — when in doubt, read the source file.
> Update this document when tokens are added, removed, or realiased.

---

## 1. Semantic Role Tokens (DECISIONS.md §7)

Pure aliases — no new palette values introduced. Every token resolves to an
existing spec token. Defined in the `SEMANTIC ROLE TOKENS` section of
`tokens.css`.

**Derivation rules:**

- `text` → `--status-*` for status roles; `--gold-light` for accent; `--text-secondary` for neutral
- `bg` → `--badge-*-bg` for status roles; `--btn-gold-bg` for accent; `--glass-surface-subtle-bg` for neutral
- `border` → `rgba(R,G,B,0.3)` of the status colour for status roles; `--btn-gold-border` for accent; `--glass-border` for neutral

| Token                   | Resolves to                      | Resolved value             |
| ----------------------- | -------------------------------- | -------------------------- |
| `--role-success-text`   | `var(--status-success)`          | `#22c55e`                  |
| `--role-success-bg`     | `var(--badge-success-bg)`        | `rgba(34, 197, 94, 0.15)`  |
| `--role-success-border` | literal                          | `rgba(34, 197, 94, 0.3)`   |
| `--role-warning-text`   | `var(--status-warning)`          | `#f59e0b`                  |
| `--role-warning-bg`     | `var(--badge-warning-bg)`        | `rgba(245, 158, 11, 0.15)` |
| `--role-warning-border` | literal                          | `rgba(245, 158, 11, 0.3)`  |
| `--role-danger-text`    | `var(--status-danger)`           | `#ef4444`                  |
| `--role-danger-bg`      | `var(--badge-danger-bg)`         | `rgba(239, 68, 68, 0.15)`  |
| `--role-danger-border`  | literal                          | `rgba(239, 68, 68, 0.3)`   |
| `--role-info-text`      | `var(--status-info)`             | `#3b82f6`                  |
| `--role-info-bg`        | `var(--badge-info-bg)`           | `rgba(59, 130, 246, 0.15)` |
| `--role-info-border`    | literal                          | `rgba(59, 130, 246, 0.3)`  |
| `--role-accent-text`    | `var(--gold-light)`              | `#e8d48b` (7.1:1 on dark)  |
| `--role-accent-bg`      | `var(--btn-gold-bg)`             | `rgba(200, 168, 78, 0.2)`  |
| `--role-accent-border`  | `var(--btn-gold-border)`         | `rgba(200, 168, 78, 0.4)`  |
| `--role-neutral-text`   | `var(--text-secondary)`          | `#94a3b8`                  |
| `--role-neutral-bg`     | `var(--glass-surface-subtle-bg)` | `rgba(15, 23, 42, 0.4)`    |
| `--role-neutral-border` | `var(--glass-border)`            | `rgba(148, 163, 184, 0.2)` |

---

## 2. Text Role Utility Classes (DECISIONS.md §7 / D-12)

Defined in `frontend/src/index.css` inside `@layer components`.
Replace raw Tailwind palette classes (`text-emerald-400`, `text-white/70`, etc.)
in page and component code.

| Class                  | Token used              | Resolved value          | Notes                                     |
| ---------------------- | ----------------------- | ----------------------- | ----------------------------------------- |
| `.text-role-primary`   | `var(--text-primary)`   | `#e2e8f0`               | 11.5:1 AAA — default body text            |
| `.text-role-secondary` | `var(--text-secondary)` | `#94a3b8`               | 5.2:1 AA — supporting text                |
| `.text-role-muted`     | `var(--text-muted)`     | `#64748b`               | 3.1:1 AA large — meta, timestamps         |
| `.text-role-disabled`  | `var(--text-disabled)`  | `rgba(100,116,139,0.4)` | `--text-muted` at 40% — disabled controls |
| `.text-role-inverse`   | `var(--bg-deep-space)`  | `#0a0e1a`               | Dark text on gold/bright backgrounds      |
| `.text-role-link`      | `var(--gold-light)`     | `#e8d48b`               | Inline text links and accent text         |
| `.text-role-danger`    | `var(--status-danger)`  | `#ef4444`               | Error messages, destructive labels        |

**Token added:** `--text-disabled: rgba(100, 116, 139, 0.4)` in `tokens.css`
(slate-500 `#64748b` at 40% opacity — computed as rgba rather than using
`color-mix` since that function is not yet in use in this project).

---

## 3. Radius Semantic Mapping (DECISIONS.md §3)

Defined in `tokens.css` under `RADIUS TOKENS — Legacy aliases`.

| Token             | Resolves to          | Value    | Applies to                                                               |
| ----------------- | -------------------- | -------- | ------------------------------------------------------------------------ |
| `--radius-badge`  | `var(--radius-sm)`   | `6px`    | Badges, stat bars, small chips                                           |
| `--radius-button` | `var(--radius-md)`   | `12px`   | **Buttons** (changed from `--radius-full`), inputs, selects, small cards |
| `--radius-card`   | `var(--radius-md)`   | `12px`   | Cards                                                                    |
| `--radius-panel`  | `var(--radius-lg)`   | `16px`   | Content panels, framed tools                                             |
| `--radius-modal`  | `var(--radius-xl)`   | `24px`   | Modals, feature/hero panels                                              |
| `--radius-pill`   | `var(--radius-full)` | `9999px` | Avatars, status dots, toggles, true pill controls only                   |
| `--radius-circle` | `50%`                | `50%`    | Circular clipping                                                        |

**Change from prior state:** `--radius-button` was `var(--radius-full)` (9999px pill);
it now resolves to `var(--radius-md)` (12px rounded rectangle) per DECISIONS.md §3.
Pill shape is opt-in via a `pill` prop which uses `--radius-pill` directly.

---

## Changelog

| Date       | Change                                                                            |
| ---------- | --------------------------------------------------------------------------------- |
| 2026-06-09 | Initial creation (Equoria-o5hub.6 P2.1) — role tokens, text roles, radius mapping |
