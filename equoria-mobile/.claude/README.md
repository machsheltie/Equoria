# .claude Folder - Equoria Project Documentation

**Last Updated**: 2025-01-14
**Structure Version**: 2.0 (Reorganized)
**Total Files**: ~90+ markdown files

## Quick Navigation

- **🚀 Getting Started**: [Onboarding Guide](./guides/onboarding/equoriaReadme.md)
- **📋 Current Sprint**: [Week 1 Planning](./planning/current/week1/)
- **📚 Quick Reference**: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **📖 Templates**: [Documentation Templates](./templates/)
- **🔍 Migration Guide**: [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)

---

## Folder Structure

### 📁 [commands/](./commands/)
**Purpose**: Slash command implementations for Claude Code

**Files**: 3 commands
- `/code-review` - Comprehensive code quality review
- `/ultra-think` - Deep analysis and problem solving
- `/update-docs` - Documentation update automation

**Usage**: Type `/commandName` in Claude Code

---

### 📁 [planning/](./planning/)
**Purpose**: Sprint planning, day plans, and implementation strategies

**Structure**:
- **[current/](./planning/current/)** - Active planning documents
  - [week1/](./planning/current/week1/) - Day 3 plans and strategies
  - Week 2-4 plans
  - Deployment planning
- **[archive/](./planning/archive/)** - Completed plans

**Key Files**:
- Current week plans (week2Plan.md, week3Plan.md, week4Plan.md)
- Feature implementation plans
- Deployment strategies

---

### 📁 [architecture/](./architecture/)
**Purpose**: System architecture and technical design

#### [backend/](./architecture/backend/) (7 files)
Backend architecture, API specifications, layer designs
- apiSpecs.md - REST API documentation
- backendOverview.md - System architecture
- controllersLayer.md, modelsLayer.md, routesLayer.md, utilsLayer.md

#### [frontend/](./architecture/frontend/) (3 files)
Frontend architecture, UI design, component structure
- frontendArchitecture.md - React Native architecture
- uiDesignOverview.md - UI/UX design system
- horsePage.md - Key page implementation

#### [database/](./architecture/database/) (2 files)
Database schema and infrastructure
- databaseSchema.md - Complete database schema
- databaseInfrastructure.md - Database setup and migrations

#### [testing/](./architecture/testing/) (3 files)
Testing architecture and strategies
- testingArchitecture.md - Overall testing strategy
- groomApiTestPlan.md - API test plans
- groomApiTests.postman_collection.json - Postman tests

---

### 📁 [gameDesign/](./gameDesign/)
**Purpose**: Game mechanics, features, and systems design

#### [traits/](./gameDesign/traits/) (11 files)
Trait system including epigenetics, modifiers, and rare traits
- epigeneticTraits.md - Core epigenetic system
- advancedEpigeneticTraitSystem.md - Advanced mechanics
- traitModifiers.md - Trait modification rules
- comprehensiveTraitDocumentation.md - Complete trait reference
- And 7 more specialized trait documents

#### [systems/](./gameDesign/systems/) (7 files)
Core game systems (grooms, training, competitions, riders)
- groomSystem.md - Groom mechanics and progression
- trainingSystem.md - Horse training mechanics
- competitionSystemsOverview.md - Competition rules
- riderSystemsOverview.md - Rider mechanics
- And 3 more groom-related documents

#### [features/](./gameDesign/features/) (4 files)
Specific game features
- conformationShows.md - Conformation show mechanics
- disciplines.md - Riding disciplines
- gameFeaturesOverview.md - Feature summary
- foalEnrichmentSummary.md - Foal enrichment system

---

### 📁 [status/](./status/) (8 files)
**Purpose**: Status reports, technical reviews, and progress tracking

**Key Files**:
- day2TechnicalReview.md - Day 2 implementation review
- day3Phase1Summary.md - Day 3 phase 1 completion
- systemsStatusOverview.md - Current systems status
- implementationSummary.md - Overall implementation status

---

### 📁 [guides/](./guides/)
**Purpose**: How-to guides, references, and best practices

#### [onboarding/](./guides/onboarding/) (5 files)
Getting started, tech stack, contributing
- equoriaReadme.md - Project overview
- techStackDocumentation.md - Technology choices
- contributing.md - How to contribute

#### [development/](./guides/development/) (10 files)
Development workflows, security, best practices
- devNotes.md - Development notes
- security.md - Security guidelines
- deployment.md - Deployment procedures
- esModulesRequirements.md - ES modules setup

#### [tools/](./guides/tools/) (3 files)
MCP servers, Claude Code setup
- mcpInstallationGuide.md - MCP server setup
- mcpServerStatus.md - Server status
- claudeCodeRecommendations.md - Claude Code tips

---

### 📁 [rules/](./rules/) (1 file + 1 config)
**Purpose**: Development rules and coding standards

**Files**:
- generalRules.md - Core development rules
- .augmentignore - Augment exclusions

---

### 📁 [reference/](./reference/) (6 files)
**Purpose**: Product requirements, specifications, and project overview

**Key Files**:
- productRequirementsDocument.md - Product spec
- equoriaSpecifics.md - Equoria-specific details
- projectMilestones.md - Project timeline
- projectSummary.md - High-level overview

---

### 📁 [templates/](./templates/)
**Purpose**: Documentation templates for new files

**Templates** (to be created):
- gameDesignFeature.md - Game feature template
- architectureDoc.md - Architecture doc template
- implementationPlan.md - Implementation plan template
- statusReport.md - Status report template

---

### 📁 [archive/](./archive/) (1 file)
**Purpose**: Deprecated or historical documentation

**Files**:
- oldProjectClaude.md - Old project-level CLAUDE.md

---

## Naming Conventions

**Files**: camelCase (e.g., `apiSpecs.md`, `groomSystem.md`)
**Folders**: camelCase (e.g., `gameDesign/`, `architecture/`)
**Special Files**: README.md (index), CHANGELOG.md (changes)

**Why camelCase?**
- Consistent with codebase (TypeScript/JavaScript)
- Easy to type, no special characters
- Clear word boundaries without hyphens

---

## Common Tasks

### Finding Documentation

**By Category**:
```
Architecture? → .claude/architecture/
Game Design? → .claude/gameDesign/
Current Plans? → .claude/planning/current/
Guides? → .claude/guides/
```

**By Search** (Ctrl+Shift+F in VS Code):
- Search term: "groom system"
- Scope: .claude/ folder
- Results show in context

**Quick Reference**:
See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for most-accessed files

### Creating New Documentation

**Option 1: Use Template**
```bash
# Copy appropriate template
cp .claude/templates/gameDesignFeature.md .claude/gameDesign/features/newFeature.md
# Edit and fill in
```

**Option 2: Use Slash Command** (when created)
```
/new feature breeding-mechanics
/new architecture api-gateway
/new plan week-5-sprint-1
```

### Updating Indexes

**Manual**: Edit README.md files in each folder

**Automated** (when /generateIndexes command created):
```
/generateIndexes
# Regenerates all README.md files
```

---

## File Organization Guidelines

### When to Create a New File

**Create New File When**:
- Documenting a distinct feature or system
- Content exceeds 500 lines
- Topic is self-contained
- Multiple people will reference it

**Add to Existing File When**:
- Closely related to existing content
- Small addition (<100 lines)
- Completes an existing document

### Where to Put New Files

**Decision Tree**:
```
Is it code/architecture? → architecture/
Is it game design? → gameDesign/
Is it planning? → planning/
Is it a guide/how-to? → guides/
Is it status/review? → status/
Is it reference? → reference/
```

**Subfolder Decision**:
- Architecture: backend / frontend / database / testing
- Game Design: traits / systems / features
- Guides: onboarding / development / tools
- Planning: current / archive

---

## Maintenance

### Weekly Tasks
- [ ] Archive completed sprint plans (move to planning/archive/)
- [ ] Update status reports
- [ ] Review and clean up TODO items in guides/development/

### Monthly Tasks
- [ ] Review folder structure effectiveness
- [ ] Clean up archive folder (compress old docs)
- [ ] Update templates based on learnings
- [ ] Audit cross-references (check for broken links)

### Quarterly Tasks
- [ ] Comprehensive documentation review
- [ ] Update naming conventions if needed
- [ ] Evaluate need for documentation site (if >150 files)

---

## Tips for Effective Use

### For Daily Development
1. Check `planning/current/week1/` for today's plan
2. Reference `architecture/` for technical decisions
3. Check `gameDesign/` for feature specifications
4. Use `QUICK_REFERENCE.md` for common files

### For New Features
1. Review `gameDesign/` for feature specs
2. Check `architecture/` for patterns to follow
3. Create implementation plan in `planning/current/`
4. Update status in `status/` when complete

### For Debugging
1. Check `architecture/` for system design
2. Review `guides/development/` for troubleshooting
3. Check `status/` for known issues

### For Onboarding
1. Start with `guides/onboarding/equoriaReadme.md`
2. Review `reference/productRequirementsDocument.md`
3. Check `architecture/` for system overview
4. Review `rules/generalRules.md` for coding standards

---

## Change Log

**2025-01-14 - v2.0**: Complete reorganization
- ✅ Hierarchical structure by concern
- ✅ Consistent camelCase naming
- ✅ 78 files migrated successfully
- ✅ Index files created
- ✅ Documentation templates added
- ✅ Old docs/ and plans/ folders removed
- 🎯 Improved discoverability and navigation

**Previous**: Flat structure with docs/, plans/, rules/ (v1.0)

---

## Statistics

**Current State**:
- Total Folders: 17 organized folders
- Total Files: ~90 markdown files
- Planning Docs: 10 files
- Architecture Docs: 14 files
- Game Design Docs: 22 files
- Status Reports: 8 files
- Guides: 18 files
- Reference Docs: 6 files

**Organization**:
- Max Folder Depth: 3 levels
- Average Files per Folder: 5-8
- Naming Convention: 100% camelCase compliance
- Index Coverage: README.md in all major folders

---

## Need Help?

**Getting Started**:
- 📖 Read: [guides/onboarding/equoriaReadme.md](./guides/onboarding/equoriaReadme.md)
- 🚀 Quick Links: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- 🔧 Setup: [guides/tools/mcpInstallationGuide.md](./guides/tools/mcpInstallationGuide.md)

**Finding Things**:
- Use Ctrl+Shift+F to search all files
- Check QUICK_REFERENCE.md for common files
- Browse by category in this README

**Contributing**:
- Read: [guides/onboarding/contributing.md](./guides/onboarding/contributing.md)
- Follow: [rules/generalRules.md](./rules/generalRules.md)

---

## Feedback

Found a broken link? File in wrong place? Naming inconsistency?

Please update this README or create a note in `guides/development/docsBacklog.md`

---

*This folder structure was reorganized on 2025-01-14 for improved navigation and maintainability. See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) for details.*
