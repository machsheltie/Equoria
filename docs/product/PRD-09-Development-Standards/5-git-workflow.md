# 5. Git Workflow

### 5.1 Commit Messages

**Format:** Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting |
| `refactor` | Code restructuring |
| `test` | Adding tests |
| `chore` | Maintenance |

**Examples:**

```
feat(breeding): Add genetic trait inheritance system

Implemented multi-allele genetic system with dominant/recessive
traits for coat color, height, and temperament.

Closes #123
```

### 5.2 Branch Policy (rewritten 2026-06-10)

**Work lands directly on `master` in small, same-session commits.** Feature branches (`feat/*`, `fix/*`, `epic-*`) are **forbidden** — CLAUDE.md Constitution §1 ("Visible work beats hidden work"): branches accumulate untested surface area, and the 2026-05-04 incident (a 56-commit branch, multi-hour rebase, 24 bypassed CI checks) is the canonical failure this rule prevents.

- Every session starts with `git checkout master && git pull --rebase origin master`.
- One issue → one or two commits → one push → one session. Work too big for a session is split into smaller `bd` issues.
- The only exception is a hotfix requiring staged rollback infrastructure (e.g. a major schema migration), and that requires explicit user authorization at the start of the work.

The branch-naming convention below is retained only for that authorized-exception case:

```
type/description   (authorized hotfix branches only)
```

### 5.3 Pull Request Guidelines

> **Note (2026-06-10):** with master-direct workflow, PRs are the exception, not the norm. When a PR does exist, the PR Body Evidence workflow (`.github/workflows/pr-body-evidence.yml`) enforces the repository template — placeholder evidence blocks and unticked bypass checkboxes fail the gate.

**Title:** Same as commit message format

**Description Template:**

```markdown
## Summary

Brief description of changes

## Changes Made

- Bullet point list of key changes

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests passing
- [ ] Manual testing completed

## Screenshots

(If UI changes)
```

---
