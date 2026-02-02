# Historical Documentation Archive

**Status:** ARCHIVED - Content consolidated into PRD structure
**Archived Date:** 2025-12-01
**Consolidated By:** BMAD documentation workflow

---

## Important Notice

The documentation in this folder has been **consolidated into the main PRD structure** located at `docs/product/`.

**For current documentation, please refer to:**
- [Documentation Index](../index.md)
- [PRD-00 Product Brief](../product/PRD-00-Brief.md)

---

## Consolidation Mapping

The following table shows where each historical folder's content has been consolidated:

| Historical Location | Consolidated Into | PRD Document |
|---------------------|-------------------|--------------|
| `claude-systems/` | Gameplay & Advanced Systems | PRD-03, PRD-04 |
| `claude-api/` | API Documentation | api-contracts-backend.md |
| `backend-docs/user-guide/` | Player Guide | PRD-07 |
| `backend-docs/` (other) | Development Standards | PRD-09 |
| `claude-guides/` | Development Standards | PRD-09, PRD-06 |
| `claude-rules/` | Security Architecture | PRD-08 |
| `claude-docs/` | Milestones & Standards | PRD-09, PRD-10 |
| `claude-planning/` | Deployment Guide | PRD-05 |

---

## Why Keep This Folder?

This archive is retained for:
1. **Historical Reference:** Original source documents for audit trails
2. **Granular Details:** Some implementation notes may have details not in PRDs
3. **Context:** Understanding how the project evolved
4. **Backup:** In case any content needs to be recovered

---

## Folder Structure

```
docs/history/
├── backend-docs/           # Backend implementation notes
│   ├── user-guide/         # → Consolidated into PRD-07
│   └── *.md                # → Consolidated into PRD-09
├── claude-api/             # → Consolidated into api-contracts-backend.md
├── claude-docs/            # → Consolidated into PRD-09, PRD-10
│   ├── archive/            # Day-by-day implementation logs
│   └── systems/            # System design docs (duplicate of claude-systems)
├── claude-guides/          # → Consolidated into PRD-06, PRD-09
├── claude-planning/        # → Consolidated into PRD-05
├── claude-rules/           # → Consolidated into PRD-08, PRD-09
├── claude-systems/         # → Consolidated into PRD-03, PRD-04
├── codehelpers-augment/    # → Consolidated into architecture docs
└── project-cheatsheets/    # Quick reference guides
```

---

## PRD Structure (Current)

For current documentation, use the PRD structure:

| PRD | Title | Content |
|-----|-------|---------|
| PRD-00 | Product Brief | Scope, personas, success metrics |
| PRD-01 | Overview | Vision, market, KPIs |
| PRD-02 | Core Features | User & horse management |
| PRD-03 | Gameplay Systems | Training, competition, grooms, breeding |
| PRD-04 | Advanced Systems | Epigenetics, ultra-rare traits |
| PRD-05 | Deployment Guide | Docker, CI/CD, monitoring |
| PRD-06 | Testing Strategy | TDD, coverage, quality gates |
| PRD-07 | Player Guide | Features, strategy, player docs |
| PRD-08 | Security Architecture | Auth, exploits, protection |
| PRD-09 | Development Standards | Code style, best practices |
| PRD-10 | Project Milestones | Timeline, roadmap, achievements |

---

## Do Not Edit

**These files are archived for reference only.** All updates should be made to the corresponding PRD documents in `docs/product/`.

If you find content here that should be in a PRD but isn't, please update the appropriate PRD document rather than editing these archived files.

---

*Archive created: 2025-12-01*
*Consolidation workflow: BMAD document-project*
