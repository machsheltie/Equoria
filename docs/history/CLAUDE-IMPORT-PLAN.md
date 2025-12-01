# CLAUDE-IMPORT-PLAN

## Scope
Map .claude docs (root/api/planning/systems/guides/rules) into the main doc IA without breaking tooling. Do NOT delete .claude originals until confirmed safe.

## Proposed Placements
- Product/Game systems → feed into PRD-03 and history: .claude/docs/GAME_FEATURES.md, COMPREHENSIVE_TRAIT_DOCUMENTATION.md, TRAINING-SYSTEM.md, epigenetic*.md, groomsystem*.md, groompersonalitytraitbonus.md, longtermtrait.md, ultrarareexotictraits.md, FOAL_ENRICHMENT_SUMMARY.md, horsepage.md → move copies to docs/history/claude-systems/ and cite in PRD-03.
- API layer → .claude/docs/api/*.md → move copies to docs/history/claude-api/; extract into docs/api/API-01-Overview.md and future endpoint guides.
- Architecture/Tech → .claude/docs/TECH_STACK_DOCUMENTATION.md, FRONTEND_ARCHITECTURE.md, BACKEND_DOCUMENTATION_VERIFICATION.md → move copies to docs/history/claude-architecture/; incorporate into docs/architecture/ARCH-01-Overview.md and IMPL-01/02.
- Planning/Roadmaps → .claude/docs/PROJECT_MILESTONES.md, project-summary.md, REORGANIZATION_SUMMARY.md, CRITICAL_PROJECT_CORRECTIONS.md, DEV_NOTES.md, EXTERNAL_DOCUMENTATION_UPDATES.md, systems_status_overview.md, 	askplan.md, week2.md → move copies to docs/history/claude-planning/; distill into docs/project/PM-01-Roadmap.md and sprint artifacts.
- Rules/Guides → .claude/guides/*, .claude/rules/* → archive to docs/history/claude-rules/; cite only if needed.

## Execution Notes
- Use Move-Item (or Copy-Item if preserving originals) into docs/history/claude-* subfolders to avoid breaking .claude tooling. Suggest Copy first, then prune once confirmed.
- Update docs/README.md only after new locations are set.
- Keep a thin pointer in history noting source path.
