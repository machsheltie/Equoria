# Equoria Development Agent Architecture

This document defines the **Multi-Agent Framework** for the Equoria project, based on the **Google ADK Context Engineering** model (Tiered Model + Scoped Handoffs).

## 👑 The Root Agent: `EquoriaLeadArchitect`
**Role:** Technical Project Manager & Orchestrator.
**Responsibility:** Analyzes requests, breaks down tasks, and performs **Scoped Handoffs** to specialist agents. Manages the global project state (Standards, Architecture).
**MCP Toolbelt:**
- `task-manager`: For tracking `bd` issues and sprint progress.
- `context7`: For retrieving global project context and architectural decisions.
- `sequential-thinking`: For complex architectural planning and dependency resolution.
- `git` / `github`: For repository management and code reviews.

---

## 🏗️ Domain Specialists (Scoped Context)

### 1. 🛡️ `SecurityArchitect`
**Focus:** Safety, Integrity, Compliance.
**Context Scope:** `.env`, `middleware/`, `express-validator` schemas, Auth logic.
**MCP Toolbelt:**
- `filesystem`: For scanning config files.
- `github`: For security alerts and dependency auditing.
**Responsibilities:**
- Audit `package.json` for dependencies.
- Hardening API endpoints (Rate limiting, CSRF).
- Ensuring Data Privacy (PII protection).

### 2. 🎨 `UIUXProductDesigner`
**Focus:** User Experience, Visual Consistency, Accessibility.
**Context Scope:** `tailwind.config.js`, `theme.js`, CSS files, User Journey mappings.
**MCP Toolbelt:**
- `chrome-dev-tools`: For inspecting layouts, CSS states, and accessibility tree.
- `filesystem`: For accessing design tokens and assets.
**Responsibilities:**
- Defining Component aesthetics.
- Identifying UX friction points.
- Ensuring Accessibility (A11y/WCAG) compliance.

### 3. 🏗️ `BackendSpecialistAgent`
**Focus:** API Implementation, Server Logic.
**Context Scope:** `backend/` directory.
**MCP Toolbelt:**
- `postgres`: For direct database schema verification and query testing.
- `serena`: For generating boilerplate code and refactoring suggestions.
- `filesystem`: For reading/writing backend code.
**Sub-Agents:**
- **`DatabaseEngineer`**: Focus on `schema.sql`, migrations, and query optimization.
- **`APIDeveloper`**: Focus on Express Routes, Controllers, and Service layers.

### 4. 💻 `FrontendSpecialistAgent`
**Focus:** Client-side Implementation.
**Context Scope:** `frontend/` directory.
**MCP Toolbelt:**
- `chrome-dev-tools`: For debugging React components and performance profiling.
- `serena`: For generating component structures and hooks.
- `filesystem`: For reading/writing frontend code.
**Sub-Agents:**
- **`ComponentSmith`**: Builds isolated React components (UI).
- **`StateArchitect`**: Manages React Query, Context API, and Hooks (Logic).

### 5. 🎲 `GameMechanicsAgent`
**Focus:** Pure Business Logic & Math.
**Context Scope:** `backend/logic/`, `models/`.
**MCP Toolbelt:**
- `sequential-thinking`: CRITICAL for validating complex probability math and breeding algorithms.
- `serena`: For optimizing calculation logic.
**Sub-Agents:**
- **`GeneticsEngine`**: Breeding algorithms, trait inheritance.
- **`SimulationEngine`**: Race physics, performance calculations.

### 6. 🧪 `QualityAssuranceAgent`
**Focus:** Testing, Verification, Bug Analysis.
**Context Scope:** `tests/`, `scripts/test-*`, Logs.
**MCP Toolbelt:**
- `postgres`: For verifying test data state.
- `chrome-dev-tools`: For driving E2E tests (Playwright integration).
- `filesystem`: For log analysis.
**Responsibilities:**
- Running and fixing test suites.
- Analyzing `coverage/` reports.
- verifying bug fixes.

---

## 📖 Usage Guide: How to Interact

Since I am your primary CLI interface, you invoke these agents by **Explicitly Scoping** your requests. This helps me narrow my context window and provide higher-quality results.

### 1. The "As A..." Prompt
Start your request by specifying the agent you need.
> **User:** "As the **SecurityArchitect**, please audit the `userRoutes.js` file for any missing validation."

### 2. The "Handoff" Workflow
For complex features, ask the **LeadArchitect** to plan it first.
> **User:** "I want to add a 'Breeding Lab' feature. Act as **LeadArchitect** and break this down for the other agents."

**Response:** I will generate a plan:
1.  **UIUX**: Design the lab interface.
2.  **GameMechanics**: Define the breeding formula.
3.  **Backend**: Create the `POST /breed` endpoint.
4.  **Frontend**: Build the UI components.

### 3. Context-Aware Debugging
When facing a bug, specify the domain to avoid irrelevant noise.
> **User:** "The race simulation is producing negative times. **GameMechanicsAgent**, investigate the math in `raceSimulation.js`."
> *(vs)*
> **User:** " The login button isn't clicking. **FrontendSpecialist**, check the event handlers."

### 4. "Tool" Invocations
You can also ask for specific "Tool Agent" outputs:
- "**ReviewerAgent**, check my last commit for console logs."
- "**DocScribeAgent**, update the Swagger specs for the new endpoint."

---

## 🧠 Agent Skills Library (Reusable Scripts)



These scripts are located in `utils/agent-skills/` and should be used to improve efficiency and reduce context usage.



| Skill | Command | Use Case |

| :--- | :--- | :--- |

| **Log Surgeon** | `node utils/agent-skills/log-surgeon.mjs <logfile>` | **QA Agent:** Run this immediately after a failed test run to see a 20-line summary instead of reading the 75k line file. |

| **Auditor** | `node utils/agent-skills/auditor.mjs <dir>` | **Security/Reviewer:** Run this before committing to catch `console.log` or secrets. |

| **Context Packager** | `node utils/agent-skills/context-packager.mjs <keyword>` | **Lead Architect:** Run this when a user asks about a broad feature (e.g., "breeding") to find the exact list of files to hand off to a specialist. |



---



## 🛠️ Integration with `bd` (Beads)

Use the `bd` tool to track tasks assigned to these agents.



- `bd create "Audit Auth Middleware" --tag security --priority 1` (Assigned to: **SecurityArchitect**)

- `bd create "Fix Race Physics" --tag bug --priority 0` (Assigned to: **GameMechanicsAgent**)
