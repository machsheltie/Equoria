# TEA Handoff - Equoria Security Hardening

**Date:** 2026-04-24  
**Author:** Murat (TEA)  
**Purpose:** Hand off system-level security hardening test design into implementation and story planning.

---

## TEA Artifacts Inventory

| Artifact | Path |
| --- | --- |
| Architecture doc | `_bmad-output/test-artifacts/test-design/equoria-security-hardening-test-design-architecture.md` |
| QA doc | `_bmad-output/test-artifacts/test-design/equoria-security-hardening-test-design-qa.md` |
| Existing broad TD audit | `_bmad-output/test-artifacts/test-design/TD-equoria-test-architecture-2026-04-07.md` |

---

## Epic-Level Integration Guidance

### P0 Workstreams

1. **Secrets and startup validation**
   - Risks: `R-001`, `R-004`
   - Outcomes: no deployable placeholder secrets, no CSRF fallback, blocking CI enforcement

2. **Token-at-rest hardening**
   - Risks: `R-002`, `R-003`
   - Outcomes: hashed refresh and verification tokens, safe migration, regression-proof lifecycle

3. **Parser-layer hostile payload defense**
   - Risks: `R-005`
   - Outcomes: duplicate-key and prototype-pollution rejection before handlers, skipped tests restored

4. **Readiness evidence and gate reproducibility**
   - Risks: `R-006`, `R-007`
   - Outcomes: controlled readiness evidence with artifact retention and deploy dependency

---

## Story-Level Integration Guidance

| Candidate Story | Primary Risks | Acceptance Focus |
| --- | --- | --- |
| Enforce runtime secret validation | R-001 | Deployable modes fail on missing/placeholder secrets |
| Remove CSRF fallback secret | R-001 | CSRF middleware requires configured secret only |
| Hash refresh tokens at rest | R-002 | DB no longer stores usable refresh tokens |
| Hash verification tokens at rest | R-003 | DB no longer stores usable verification tokens |
| Restore parser-layer security tests | R-005 | Duplicate-key and prototype-pollution tests pass |
| Add blocking security gate | R-004 | Deploy blocked on security failures |
| Upgrade readiness signoff lane | R-006/R-007 | Reproducible artifacted evidence exists in CI/staging |

---

## Risk-to-Story Mapping

| Risk ID | Story Theme | Priority |
| --- | --- | --- |
| R-001 | Secret validation and CSRF secret governance | P0 |
| R-002 | Refresh token hash migration | P0 |
| R-003 | Email verification token hash migration | P0 |
| R-004 | Security gate and deployment policy | P0 |
| R-005 | Parser-layer malicious payload rejection | P1 |
| R-006 | Readiness lane reproducibility | P1 |
| R-007 | Risk-to-gate traceability evidence | P1 |
| R-008 | Security performance smoke | P2 |

---

## Recommended Workflow Sequence

1. Implement `R-001` and `R-004` first because they close the process gap.
2. Implement `R-002` and `R-003` next because they close active compromise paths.
3. Implement `R-005` immediately after to restore known missing defenses.
4. Finish with `R-006` and `R-007` so launch evidence is reproducible.

---

## Phase Transition Quality Gates

- No open score-9 risks
- No skipped P0 security tests
- Blocking security gate present in deployment dependencies
- Token-at-rest verification green
- Parser-layer hostile payload tests green
- Readiness artifacts available from controlled execution path
