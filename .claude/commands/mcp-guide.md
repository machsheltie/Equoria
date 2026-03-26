# MCP Server Usage Guide

**Skill:** `/mcp-guide`
**Purpose:** Define exactly when to invoke each MCP server vs native Claude tools, preventing wasteful token usage

---

## CRITICAL: DO NOT CALL These Servers

The following servers are **platform-provided by Claude.ai** and are **completely irrelevant to Equoria**. Calling them wastes thousands of tokens for zero benefit.

| Server prefix | Tools | Token cost | Equoria relevance |
|---------------|-------|------------|-------------------|
| `mcp__claude_ai_Stripe__*` | 31 tools | ~9,353 tokens | **NONE** — no payments/billing |
| `mcp__claude_ai_Supabase__*` | 29 tools | ~4,696 tokens | **NONE** — uses Prisma + PostgreSQL directly |

**NEVER call any `mcp__claude_ai_Stripe__*` or `mcp__claude_ai_Supabase__*` tool.** Period. No exceptions unless the user explicitly says "integrate Stripe" or "migrate to Supabase."

---

## Active Project MCP Servers (as of 2026-03-26)

| Server | Package | Purpose |
|--------|---------|---------|
| `sequential-thinking` | local Python | Structured multi-step reasoning |
| `context7` | `@context7/mcp-server` | Current library API documentation |
| `task-manager` | `@taskmanager/mcp-server` | AI task tracking (deferred to beads) |
| `serena` | `@serena/mcp-server` | Code analysis (deferred to native tools) |
| `chrome-dev-tools` | `@chrome-devtools/mcp-server` | Live browser debugging & audits |
| `filesystem` | `@modelcontextprotocol/server-filesystem` | File operations (deferred to native tools) |
| `git` | `@modelcontextprotocol/server-git` | Git operations (deferred to native tools) |
| `github` | `@modelcontextprotocol/server-github` | GitHub API (PRs, issues, remote files) |
| `postgres` | `@modelcontextprotocol/server-postgres` | Direct SQL queries on test DB |
| `playwright` | plugin (built-in) | Browser automation & screenshots |

---

## Core Principle: Native Tools First

**ALWAYS prefer Claude's built-in tools** before reaching for an MCP server:

| Task | Use This (cheap) | NOT This (expensive) |
|------|-----------------|----------------------|
| Read a file | `Read` tool | `mcp__filesystem__*`, `mcp__serena__read_file` |
| Search code | `Grep` tool | `mcp__serena__search_for_pattern`, `mcp__filesystem__search_files` |
| Find files | `Glob` tool | `mcp__serena__find_file`, `mcp__filesystem__*` |
| Write / edit a file | `Write` / `Edit` tool | `mcp__filesystem__write_file`, `mcp__serena__replace_content` |
| List directory | `Bash(ls)` or `Glob` | `mcp__filesystem__list_directory`, `mcp__serena__list_dir` |
| Run git operations | `Bash(git ...)` | `mcp__git__*` |
| Run npm scripts | `Bash(npm ...)` | — |
| Simple reasoning | Think inline | `sequential-thinking` |
| Track issues | `bd` commands | `task-manager` |
| Browse a web page | `playwright` | `chrome-dev-tools` (unless DevTools already open) |

MCP servers add network/process overhead. Only invoke them when they provide **unique capability** native tools cannot match.

---

## Server-by-Server Decision Rules

### 1. `context7` — Library Documentation Lookup

**Invoke when:**
- You need the **current API** for a specific library version (Prisma v5, React Query v5, etc.)
- A method signature may have changed since training cutoff
- You've searched the project source and can't find a usage example

**Skip when:**
- Writing standard JS/TS you already know
- Patterns already visible in the codebase — use `Read` / `Grep` instead
- Searching project files — native tools are faster

**Workflow:** `resolve-library-id` → `query-docs` (two calls; batch your questions into one query).

**Token impact:** MEDIUM — use once at session start for an unfamiliar library, not per-file.

---

### 2. `sequential-thinking` — Structured Reasoning Chains

**Invoke when:**
- Solving a complex architecture problem with 5+ interdependent decisions
- Designing a new epic's data model + API + frontend from scratch
- Need to reason through many trade-offs before writing a single line of code

**Skip when (most tasks):**
- Bug fixes — reason inline
- Adding features that follow existing patterns
- Writing tests
- Any task completable in under 30 minutes without upfront design

**Token impact:** HIGH — call once per complex design session, never per subtask.

---

### 3. `task-manager` — AI Task Tracking

**Skip — use `bd` commands instead.**

This project uses beads for issue tracking. `task-manager` duplicates it.

```bash
bd ready              # find available work
bd show <id>          # review issue
bd update <id> --status=in_progress
bd close <id>
```

**Token impact:** HIGH per call — avoid entirely for normal development.

---

### 4. `serena` — Code Analysis

**Skip — use native tools instead.**

| Serena tool | Use instead |
|-------------|-------------|
| `mcp__serena__read_file` | `Read` |
| `mcp__serena__search_for_pattern` | `Grep` |
| `mcp__serena__find_file` | `Glob` |
| `mcp__serena__replace_content` | `Edit` |
| `mcp__serena__list_dir` | `Bash(ls)` or `Glob` |
| `mcp__serena__activate_project` | Not needed |

**Only invoke if** Serena provides a unique capability like semantic code analysis that grep can't do.

**Token impact:** MEDIUM per call — redundant with native tools.

---

### 5. `filesystem` — File System Operations

**Skip — use native tools instead.**

| Filesystem MCP tool | Use instead |
|---------------------|-------------|
| `mcp__filesystem__read_text_file` / `read_file` / `read_multiple_files` | `Read` |
| `mcp__filesystem__write_file` | `Write` |
| `mcp__filesystem__edit_file` | `Edit` |
| `mcp__filesystem__list_directory` / `list_directory_with_sizes` | `Bash(ls)` or `Glob` |
| `mcp__filesystem__search_files` | `Grep` or `Glob` |
| `mcp__filesystem__directory_tree` | `Bash(ls -R)` or `Glob(**/*.*)` |
| `mcp__filesystem__create_directory` | `Bash(mkdir)` |
| `mcp__filesystem__move_file` | `Bash(mv)` |
| `mcp__filesystem__get_file_info` | `Bash(ls -la)` |
| `mcp__filesystem__read_media_file` | `Read` (supports images natively) |

Every single filesystem MCP tool has a cheaper native equivalent. **Never call filesystem MCP tools.**

**Token impact:** LOW per call but completely redundant.

---

### 6. `git` — Git Operations

**Skip — use `Bash(git ...)` instead.**

Native `Bash(git status)`, `Bash(git log)`, `Bash(git diff)` etc. are faster and don't need MCP overhead.

**Token impact:** LOW but redundant.

---

### 7. `chrome-dev-tools` — Browser Debugging & Audits

**Invoke when:**
- Debugging a **live browser session** (errors on screen, layout broken)
- Running Lighthouse / accessibility / performance audit on the rendered page
- Inspecting the actual DOM of a rendered component
- The Chrome DevTools MCP server is actively connected

**Skip when:**
- Writing backend code
- Writing frontend code without a running dev server
- Reading source files — use `Read` / `Grep`
- No browser tab is open and connected to the DevTools server
- Use `playwright` instead for automated browser interaction

**Token impact:** MEDIUM — only useful when a browser is live and DevTools connected.

---

### 8. `github` — GitHub API

**Invoke when:**
- Creating a pull request
- Checking PR review status or PR comments
- Creating or updating GitHub issues
- Fetching file contents from a remote branch (not local checkout)
- Any operation requiring the GitHub REST API

**Skip when:**
- Working with local git history — use `Bash(git ...)`
- Reading local files — use `Read`
- Searching local code — use `Grep` / `Glob`

**Requires:** `GITHUB_TOKEN` environment variable set.

**Token impact:** MEDIUM — only when the GitHub API is genuinely required.

---

### 9. `postgres` — Direct SQL on Test DB

**Invoke when:**
- Running raw SQL queries against the test database for debugging
- Checking table contents, row counts, or schema state
- Investigating data issues that Prisma Studio can't easily show
- Need to verify a migration applied correctly

**Skip when:**
- Writing application code — use Prisma ORM in the app
- Reading schema — just read `packages/database/prisma/schema.prisma`
- Running migrations — use `Bash(npx prisma migrate ...)`
- Application logic — the app uses Prisma, not raw SQL

**WARNING:** This connects to `equoria_test` — never use for production data.

**Token impact:** LOW per query — useful for debugging but don't use for app logic.

---

### 10. `playwright` — Browser Automation & Screenshots

**Invoke when:**
- Taking screenshots to verify UI changes visually
- Automating browser interactions (click, fill, navigate) for testing
- Running E2E test scenarios interactively
- Need to inspect the accessibility tree / DOM snapshot of a live page

**Skip when:**
- Writing code without needing visual verification
- Backend-only work
- No dev server is running
- Writing Playwright test files — just write the code with `Write`/`Edit`

**Token impact:** MEDIUM — launches a browser, useful for visual verification.

---

## Quick Decision Flowchart

```
What do I need to do?
│
├── Read / write / search LOCAL files?
│   → Read / Write / Edit / Glob / Grep  ✅
│   → NOT filesystem MCP, NOT serena
│
├── Run a shell command?
│   → Bash(...)  ✅
│   → NOT git MCP
│
├── Look up a library's current API docs?
│   → context7  ✅
│
├── Debug or screenshot a RUNNING BROWSER?
│   → playwright  ✅  (or chrome-dev-tools if DevTools connected)
│
├── Create a PR / interact with GitHub API?
│   → github MCP  ✅
│
├── Run raw SQL on test DB?
│   → postgres MCP  ✅
│
├── Design a complex multi-decision architecture?
│   → sequential-thinking  ✅  (once, at session start)
│
├── Track a task or issue?
│   → bd commands  ✅  (NOT task-manager)
│
├── Process payments or billing?
│   → ❌ NOT Stripe — not used in Equoria
│
└── Manage hosted database / auth?
    → ❌ NOT Supabase — Equoria uses Prisma + local PostgreSQL
```

---

## Session Discipline Rules

1. **Do not call MCP servers at session start "just in case"** — only invoke for a specific need
2. **Do not loop MCP calls** — plan your question, make one call, process the result
3. **Batch context7 queries** — resolve the library ID once, then query multiple topics in sequence
4. **NEVER call Stripe or Supabase MCP tools** — completely irrelevant, wastes ~14,000 tokens
5. **NEVER call filesystem, serena, or git MCP tools** — native tools do the same thing cheaper
6. **task-manager = never** for normal development — use `bd` exclusively
7. **chrome-dev-tools = only with live browser** — don't call blindly
8. **postgres = debugging only** — app code uses Prisma, not raw SQL

---

## When to Invoke This Skill

Load `/mcp-guide` when:
- Starting a new session and unsure which tools to use
- About to call an MCP server and want to verify it's the right choice
- Reviewing why a previous session was slow or token-heavy
