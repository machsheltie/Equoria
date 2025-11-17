# Guides Folder

**Purpose**: How-to guides, references, and best practices for developing the Equoria platform.

**Last Updated**: 2025-01-14

---

## Folder Structure

```
guides/
├── onboarding/        # Getting started guides (5 files)
├── development/       # Development workflows (10 files)
└── tools/             # Tool setup and usage (3 files)
```

**Total**: 18 guide documents

---

## Onboarding Guides

**Folder**: [onboarding/](./onboarding/)

**Purpose**: Getting started with the Equoria project

| File | Purpose | Lines | Audience |
|------|---------|-------|----------|
| [equoriaReadme.md](./onboarding/equoriaReadme.md) | Project overview | ~600 | New developers |
| [techStackDocumentation.md](./onboarding/techStackDocumentation.md) | Technology choices | ~800 | New developers |
| [contributing.md](./onboarding/contributing.md) | How to contribute | ~400 | Contributors |
| [rulesReadme.md](./onboarding/rulesReadme.md) | Rules folder overview | ~200 | All |
| [prdTechStackAddendum.md](./onboarding/prdTechStackAddendum.md) | PRD tech details | ~300 | Stakeholders |

**Total**: 5 files, ~2,300 lines

**Start Here**:
1. [equoriaReadme.md](./onboarding/equoriaReadme.md) - Project introduction
2. [techStackDocumentation.md](./onboarding/techStackDocumentation.md) - Technology overview
3. [contributing.md](./onboarding/contributing.md) - Contribution guidelines

---

## Development Guides

**Folder**: [development/](./development/)

**Purpose**: Development workflows, best practices, and procedures

| File | Purpose | Lines | Topic |
|------|---------|-------|-------|
| [devNotes.md](./development/devNotes.md) | Development notes | ~500 | General |
| [rulesDevNotes.md](./development/rulesDevNotes.md) | Rules-specific notes | ~300 | Rules |
| [docsBacklog.md](./development/docsBacklog.md) | Documentation TODO | ~200 | Docs |
| [rulesBacklog.md](./development/rulesBacklog.md) | Rules backlog | ~150 | Rules |
| [taskPlan.md](./development/taskPlan.md) | Task planning | ~250 | Planning |
| [consoleLogging.md](./development/consoleLogging.md) | Logging guidelines | ~150 | Best practices |
| [esModulesRequirements.md](./development/esModulesRequirements.md) | ES modules setup | ~200 | Setup |
| [security.md](./development/security.md) | Security guidelines | ~600 | Security |
| [securityImplementationTasks.md](./development/securityImplementationTasks.md) | Security tasks | ~300 | Security |
| [deployment.md](./development/deployment.md) | Deployment procedures | ~500 | Deployment |

**Total**: 10 files, ~3,150 lines

**Key Topics**:
- Development workflow and notes
- Security best practices
- Deployment procedures
- ES modules configuration
- Task planning and backlog

---

## Tool Guides

**Folder**: [tools/](./tools/)

**Purpose**: MCP servers, Claude Code, and development tool setup

| File | Purpose | Lines | Tool |
|------|---------|-------|------|
| [mcpInstallationGuide.md](./tools/mcpInstallationGuide.md) | MCP server setup | ~400 | MCP |
| [mcpServerStatus.md](./tools/mcpServerStatus.md) | Server status tracking | ~250 | MCP |
| [claudeCodeRecommendations.md](./tools/claudeCodeRecommendations.md) | Claude Code tips | ~350 | Claude Code |

**Total**: 3 files, ~1,000 lines

**Key Tools**:
- MCP servers (sequential-thinking, context7, serena, etc.)
- Claude Code CLI
- Development environment setup

---

## Guide Categories

### Getting Started (New Developers)
1. Read [equoriaReadme.md](./onboarding/equoriaReadme.md)
2. Review [techStackDocumentation.md](./onboarding/techStackDocumentation.md)
3. Set up MCP servers: [mcpInstallationGuide.md](./tools/mcpInstallationGuide.md)
4. Read [contributing.md](./onboarding/contributing.md)
5. Check [devNotes.md](./development/devNotes.md) for current context

### Best Practices
- **Security**: [security.md](./development/security.md)
- **Logging**: [consoleLogging.md](./development/consoleLogging.md)
- **Deployment**: [deployment.md](./development/deployment.md)
- **ES Modules**: [esModulesRequirements.md](./development/esModulesRequirements.md)

### Task Management
- **Planning**: [taskPlan.md](./development/taskPlan.md)
- **Docs Backlog**: [docsBacklog.md](./development/docsBacklog.md)
- **Rules Backlog**: [rulesBacklog.md](./development/rulesBacklog.md)

### Tool Setup
- **MCP Setup**: [mcpInstallationGuide.md](./tools/mcpInstallationGuide.md)
- **MCP Status**: [mcpServerStatus.md](./tools/mcpServerStatus.md)
- **Claude Code**: [claudeCodeRecommendations.md](./tools/claudeCodeRecommendations.md)

---

## How to Use This Folder

### Finding Guides

**By Purpose**:
- Need project overview? → [onboarding/equoriaReadme.md](./onboarding/equoriaReadme.md)
- Need security guidelines? → [development/security.md](./development/security.md)
- Need MCP setup? → [tools/mcpInstallationGuide.md](./tools/mcpInstallationGuide.md)

**By Audience**:
- New developer: Start with [onboarding/](./onboarding/)
- Contributor: Read [onboarding/contributing.md](./onboarding/contributing.md)
- Security focus: Read [development/security.md](./development/security.md)
- Tool setup: Check [tools/](./tools/)

### Creating New Guides

1. **Determine category**: onboarding / development / tools
2. **Create file**:
   ```bash
   # Use descriptive camelCase name
   touch guides/category/guideName.md
   ```
3. **Write guide**:
   - Clear title and purpose
   - Step-by-step instructions
   - Code examples
   - Screenshots (if helpful)
   - Troubleshooting section
4. **Link from README**: Add entry to appropriate table above

### Updating Guides

**When to update**:
- Tool versions change
- Process improvements
- New best practices discovered
- User feedback

**Update process**:
1. Edit guide with new information
2. Update "Last Updated" date
3. Add changelog entry at bottom
4. Update this README if needed

---

## Development Workflow Overview

### Daily Development Flow

1. **Morning**:
   - Check [taskPlan.md](./development/taskPlan.md) for today's tasks
   - Review [devNotes.md](./development/devNotes.md) for context
   - Check MCP server status: [mcpServerStatus.md](./tools/mcpServerStatus.md)

2. **During Development**:
   - Follow TDD methodology
   - Follow security guidelines: [security.md](./development/security.md)
   - Use proper logging: [consoleLogging.md](./development/consoleLogging.md)
   - Update dev notes as needed

3. **End of Day**:
   - Update [taskPlan.md](./development/taskPlan.md)
   - Add notes to [devNotes.md](./development/devNotes.md)
   - Commit changes with proper message

### Contributing Flow

1. Read [contributing.md](./onboarding/contributing.md)
2. Follow code style in [../rules/generalRules.md](../rules/generalRules.md)
3. Ensure tests pass (see [../architecture/testing/testingArchitecture.md](../architecture/testing/testingArchitecture.md))
4. Create clear commit messages
5. Update documentation if needed

---

## Key Concepts

### MCP Servers

**Purpose**: Extend Claude Code with specialized capabilities

**Core Servers**:
- `sequential-thinking`: Advanced reasoning
- `task-manager`: Task tracking
- `git`: Version control operations
- `context7`: Context management
- `serena`: Workflow optimization

**Setup**: See [mcpInstallationGuide.md](./tools/mcpInstallationGuide.md)

### Claude Code

**Purpose**: AI-powered development assistant

**Key Features**:
- Slash commands (/update-docs, /code-review, etc.)
- Agent orchestration
- MCP server integration
- TDD workflow support

**Tips**: See [claudeCodeRecommendations.md](./tools/claudeCodeRecommendations.md)

### Security Best Practices

**Key Principles**:
1. Input validation on all user data
2. Secure token storage (SecureStore)
3. HTTPS enforcement
4. No secrets in code
5. Rate limiting on API endpoints

**Full Guide**: [security.md](./development/security.md)

---

## Common Tasks

### Setting Up Development Environment

1. **Clone repository**
2. **Install dependencies**: `npm install`
3. **Setup MCP servers**: Follow [mcpInstallationGuide.md](./tools/mcpInstallationGuide.md)
4. **Configure environment**: Copy `.env.example` to `.env`
5. **Run tests**: `npm test`
6. **Start dev server**: `npm start`

### Adding a New Feature

1. **Plan**: Update [taskPlan.md](./development/taskPlan.md)
2. **Design**: Document in [../gameDesign/](../gameDesign/) or [../architecture/](../architecture/)
3. **TDD**: Write tests first
4. **Implement**: Follow [../rules/generalRules.md](../rules/generalRules.md)
5. **Security Review**: Check [security.md](./development/security.md)
6. **Document**: Update relevant guides

### Deploying to Production

1. **Pre-deploy checks**: Run all tests, security scan
2. **Follow deployment guide**: [deployment.md](./development/deployment.md)
3. **Monitor**: Check logs and metrics
4. **Rollback plan**: Be ready to revert if needed

---

## Related Documentation

- **Architecture**: [../architecture/](../architecture/) - Technical design
- **Rules**: [../rules/generalRules.md](../rules/generalRules.md) - Coding standards
- **Planning**: [../planning/](../planning/) - Current work
- **Status**: [../status/](../status/) - Project status

---

## Statistics

**Total Guides**: 18 files
- Onboarding: 5 files (~2,300 lines)
- Development: 10 files (~3,150 lines)
- Tools: 3 files (~1,000 lines)

**Total Lines**: ~6,450 lines of guide documentation

**Coverage**: All major workflows documented

---

**For complete .claude folder documentation, see [../README.md](../README.md)**
